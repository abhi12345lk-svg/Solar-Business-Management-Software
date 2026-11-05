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

function getStorageDirs(): string[] {
  const dirs = new Set<string>();
  const cwd = process.cwd();
  dirs.add(path.resolve(cwd, '.storage_vault'));
  dirs.add(path.resolve(cwd, 'apps/api/.storage_vault'));
  dirs.add(path.resolve(cwd, '..', '.storage_vault'));
  dirs.add(path.resolve('d:/My project/Solar Business Management Software/.storage_vault'));
  dirs.add(path.resolve('d:/My project/Solar Business Management Software/apps/api/.storage_vault'));
  return Array.from(dirs);
}

function findExistingDiskPaths(storageKey: string): { filePath: string; metaPath: string } | null {
  const safeFilename = crypto.createHash('sha256').update(storageKey).digest('hex');
  const dirs = getStorageDirs();
  for (const dir of dirs) {
    const filePath = path.join(dir, safeFilename);
    const metaPath = path.join(dir, `${safeFilename}.meta.json`);
    if (fs.existsSync(filePath)) {
      return { filePath, metaPath };
    }
  }
  return null;
}

function getWriteDiskPaths(storageKey: string): Array<{ filePath: string; metaPath: string }> {
  const safeFilename = crypto.createHash('sha256').update(storageKey).digest('hex');
  const dirs = getStorageDirs();
  return dirs.map(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return {
      filePath: path.join(dir, safeFilename),
      metaPath: path.join(dir, `${safeFilename}.meta.json`)
    };
  });
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
      const diskTargets = getWriteDiskPaths(storageKey);
      for (const { filePath, metaPath } of diskTargets) {
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
      }
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
        const found = findExistingDiskPaths(storageKey);
        if (found && fs.existsSync(found.filePath) && fs.existsSync(found.metaPath)) {
          const buffer = fs.readFileSync(found.filePath);
          const meta = JSON.parse(fs.readFileSync(found.metaPath, 'utf-8'));
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
      const diskTargets = getWriteDiskPaths(storageKey);
      for (const { filePath, metaPath } of diskTargets) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      }
    } catch {
      // Ignore
    }
  }

  public async objectExists(storageKey: string): Promise<boolean> {
    if (this.storage.has(storageKey)) return true;
    try {
      const found = findExistingDiskPaths(storageKey);
      return !!found && fs.existsSync(found.filePath);
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
