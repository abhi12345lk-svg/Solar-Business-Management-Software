import { Readable } from 'node:stream';

export interface StorageUploadOptions {
  storageKey?: string;
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  checksumSha256?: string;
}

export interface StorageUploadResult {
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageDownloadResult {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  checksumSha256?: string;
  lastModified?: Date;
}

export interface IObjectStorageAdapter {
  uploadObject(
    storageKey: string,
    data: Buffer | Readable,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  downloadObject(storageKey: string): Promise<StorageDownloadResult>;

  deleteObject(storageKey: string): Promise<void>;

  objectExists(storageKey: string): Promise<boolean>;

  generatePresignedDownloadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;

  healthCheck(): Promise<boolean>;
}
