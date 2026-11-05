import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import {
  IObjectStorageAdapter,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult
} from './types.js';
import { AppError } from '../../errors/AppError.js';

interface StoredRecord {
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  checksumSha256: string;
  lastModified: Date;
}

const DISK_STORAGE_DIR = path.resolve(process.cwd(), '.storage_vault');

function getDiskPaths(storageKey: string) {
  if (!fs.existsSync(DISK_STORAGE_DIR)) {
    try {
      fs.mkdirSync(DISK_STORAGE_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }
  }
  const safeFilename = crypto.createHash('sha256').update(storageKey).digest('hex');
  return {
    filePath: path.join(DISK_STORAGE_DIR, safeFilename),
    metaPath: path.join(DISK_STORAGE_DIR, `${safeFilename}.meta.json`)
  };
}

export class MemoryStorageAdapter implements IObjectStorageAdapter {
  private storage = new Map<string, StoredRecord>();
  private signingSecret: string;

  constructor(signingSecret = 'memory-storage-adapter-default-secret') {
    this.signingSecret = signingSecret;
  }

  public async uploadObject(
    storageKey: string,
    data: Buffer | Readable,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.length;

    this.storage.set(storageKey, {
      buffer,
      contentType: options.contentType,
      metadata: options.metadata,
      checksumSha256,
      lastModified: new Date()
    });

    // Also persist to local disk directory so files survive backend restarts
    try {
      const { filePath, metaPath } = getDiskPaths(storageKey);
      fs.writeFileSync(filePath, buffer);
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          storageKey,
          contentType: options.contentType,
          metadata: options.metadata,
          checksumSha256,
          lastModified: new Date().toISOString()
        })
      );
    } catch (diskErr) {
      console.warn('[Storage] Disk fallback notice:', diskErr);
    }

    return {
      storageKey,
      checksumSha256,
      sizeBytes,
      contentType: options.contentType
    };
  }

  public async downloadObject(storageKey: string): Promise<StorageDownloadResult> {
    let record = this.storage.get(storageKey);

    // If not in RAM, attempt to load from local disk cache
    if (!record) {
      try {
        const { filePath, metaPath } = getDiskPaths(storageKey);
        if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
          const buffer = fs.readFileSync(filePath);
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          record = {
            buffer,
            contentType: meta.contentType || 'application/octet-stream',
            metadata: meta.metadata,
            checksumSha256: meta.checksumSha256 || '',
            lastModified: new Date(meta.lastModified || Date.now())
          };
          this.storage.set(storageKey, record);
        }
      } catch (loadErr) {
        console.warn('[Storage] Failed to read disk file for', storageKey, loadErr);
      }
    }

    if (!record) {
      throw AppError.notFound(`Storage object '${storageKey}' not found.`);
    }

    return {
      stream: Readable.from(record.buffer),
      contentType: record.contentType,
      contentLength: record.buffer.length,
      checksumSha256: record.checksumSha256,
      lastModified: record.lastModified
    };
  }

  public async deleteObject(storageKey: string): Promise<void> {
    this.storage.delete(storageKey);
    try {
      const { filePath, metaPath } = getDiskPaths(storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {
      // Ignore
    }
  }

  public async objectExists(storageKey: string): Promise<boolean> {
    if (this.storage.has(storageKey)) return true;
    try {
      const { filePath } = getDiskPaths(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  public async generatePresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number
  ): Promise<string> {
    const expiresAt = Date.now() + Math.min(Math.max(60, expiresInSeconds), 900) * 1000;
    const token = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${storageKey}:${expiresAt}`)
      .digest('hex');

    return `/api/v1/storage/download?key=${encodeURIComponent(storageKey)}&token=${token}&expires=${expiresAt}`;
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }

  public clear(): void {
    this.storage.clear();
  }

  public getRawBuffer(storageKey: string): Buffer | undefined {
    return this.storage.get(storageKey)?.buffer;
  }
}
