import { IObjectStorageAdapter } from './types.js';
import { S3StorageAdapter } from './S3StorageAdapter.js';
import { MemoryStorageAdapter } from './MemoryStorageAdapter.js';
import { config } from '../../config/env.js';

export * from './types.js';
export * from './S3StorageAdapter.js';
export * from './MemoryStorageAdapter.js';

let activeStorageAdapter: IObjectStorageAdapter | null = null;

export function getStorageAdapter(): IObjectStorageAdapter {
  if (activeStorageAdapter) {
    return activeStorageAdapter;
  }

  const currentEnv = process.env.NODE_ENV || config.NODE_ENV;
  const currentProvider = process.env.STORAGE_PROVIDER || config.STORAGE_PROVIDER;

  // Strict production fail-safe: Never silently fall back to simulated storage in production
  if (currentEnv === 'production' && currentProvider !== 's3') {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Production environment cannot use simulated storage. STORAGE_PROVIDER must be s3.'
    );
  }

  if (currentProvider === 's3') {
    activeStorageAdapter = new S3StorageAdapter({
      bucketName: config.AWS_S3_BUCKET!,
      region: config.AWS_REGION!,
      accessKeyId: config.AWS_ACCESS_KEY_ID!,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY!
    });
    return activeStorageAdapter;
  }

  activeStorageAdapter = new MemoryStorageAdapter(config.SESSION_SECRET);
  return activeStorageAdapter;
}

export function setStorageAdapter(adapter: IObjectStorageAdapter | null): void {
  activeStorageAdapter = adapter;
}

export function resetStorageAdapter(): void {
  activeStorageAdapter = null;
}
