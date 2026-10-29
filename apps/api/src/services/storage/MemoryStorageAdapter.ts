import crypto from 'node:crypto';
import { Readable } from 'node:stream';
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

    return {
      storageKey,
      checksumSha256,
      sizeBytes,
      contentType: options.contentType
    };
  }

  public async downloadObject(storageKey: string): Promise<StorageDownloadResult> {
    const record = this.storage.get(storageKey);
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
  }

  public async objectExists(storageKey: string): Promise<boolean> {
    return this.storage.has(storageKey);
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
