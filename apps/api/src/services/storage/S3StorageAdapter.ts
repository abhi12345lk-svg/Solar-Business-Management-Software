import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  IObjectStorageAdapter,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult
} from './types.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../errors/AppError.js';

export interface S3AdapterConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3StorageAdapter implements IObjectStorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor(config: S3AdapterConfig) {
    if (!config.bucketName || !config.region || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error(
        'Incomplete S3 configuration: bucketName, region, accessKeyId, and secretAccessKey are required.'
      );
    }

    this.bucketName = config.bucketName;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? false
    });
  }

  public async uploadObject(
    storageKey: string,
    data: Buffer | Readable,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
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

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: buffer,
        ContentType: options.contentType,
        ContentLength: sizeBytes,
        ServerSideEncryption: 'AES256',
        Metadata: {
          ...options.metadata,
          'sha256-checksum': checksumSha256
        }
      });

      await this.client.send(command);

      logger.info(
        { storageKey, sizeBytes, contentType: options.contentType },
        '[S3StorageAdapter] Object uploaded successfully to private bucket.'
      );

      return {
        storageKey,
        checksumSha256,
        sizeBytes,
        contentType: options.contentType
      };
    } catch (err: any) {
      logger.error(
        { storageKey, error: err?.message },
        '[S3StorageAdapter] Failed to upload object to S3.'
      );
      throw AppError.internal('Failed to persist document to secure cloud storage.');
    }
  }

  public async downloadObject(storageKey: string): Promise<StorageDownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('S3 response body is empty.');
      }

      const stream = response.Body as Readable;
      const contentType = response.ContentType || 'application/octet-stream';
      const contentLength = response.ContentLength;
      const checksumSha256 = response.Metadata?.['sha256-checksum'];
      const lastModified = response.LastModified;

      return {
        stream,
        contentType,
        contentLength,
        checksumSha256,
        lastModified
      };
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        throw AppError.notFound(`Storage object '${storageKey}' not found.`);
      }
      logger.error(
        { storageKey, error: err?.message },
        '[S3StorageAdapter] Failed to download object from S3.'
      );
      throw AppError.internal('Failed to retrieve document from secure cloud storage.');
    }
  }

  public async deleteObject(storageKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      });
      await this.client.send(command);
    } catch (err: any) {
      logger.error(
        { storageKey, error: err?.message },
        '[S3StorageAdapter] Failed to delete object from S3.'
      );
      throw AppError.internal('Failed to delete object from secure cloud storage.');
    }
  }

  public async objectExists(storageKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  public async generatePresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number
  ): Promise<string> {
    const safeTtl = Math.min(Math.max(60, expiresInSeconds), 900); // 1 to 15 mins
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey
    });

    return getSignedUrl(this.client, command, { expiresIn: safeTtl });
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucketName
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}
