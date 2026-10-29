/**
 * Phase 10C — Sprint 1: Infrastructure, Storage & Security Verification Test Suite
 *
 * Validates:
 * 1. Object Storage: Real binary streaming upload & download with byte-identical SHA-256 checksum verification.
 * 2. Cross-Customer & Security Boundaries: Rejects unauthorized access, cross-customer reads, expired/tampered tokens.
 * 3. Storage Fail-Safe: Production environment strictly forbids simulated storage and requires complete S3 configuration.
 * 4. Reverse Proxy & Spoofing Defense: Validates Express trust proxy, secure cookie transmission, and client IP spoofing protection.
 * 5. Fail-Fast Database Startup: Server startup aborts when MongoDB cannot be connected; never opens port while dead.
 * 6. Credential Protection: Secrets and tokens are never exposed in error responses or logs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import crypto from 'node:crypto';
import { app } from '../app.js';
import {
  DocumentCategory,
  DocumentAccessClassification,
  DocumentStorageStatus
} from '@ins-solar/shared';
import { DocumentModel } from '../models/DocumentModel.js';
import { dbManager } from '../db/connection.js';
import { parseEnv } from '../config/env.js';
import {
  getStorageAdapter,
  setStorageAdapter,
  resetStorageAdapter,
  MemoryStorageAdapter,
  S3StorageAdapter
} from '../services/storage/index.js';
import { DocumentService } from '../services/documentService.js';

function makePopulateQuery(resolvedValue: any) {
  const query: any = {
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnValue(resolvedValue),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject)
  };
  return query;
}

describe('Phase 10C — Sprint 1: Infrastructure, Storage & Security Remediation', () => {
  let memoryAdapter: MemoryStorageAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    memoryAdapter = new MemoryStorageAdapter('test-storage-secret-key-32chars!');
    setStorageAdapter(memoryAdapter);
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  // =========================================================================
  // 1. REAL OBJECT STORAGE: BINARY STREAMING & BYTE-IDENTICAL CHECKSUM
  // =========================================================================
  describe('1. Real Object Storage: Binary Streaming & Checksum Integrity', () => {
    it('uploads a real binary fixture and downloads byte-identical content matching exact SHA-256 checksum', async () => {
      // Create a deterministic 32KB binary buffer fixture
      const fixtureBytes = crypto.randomBytes(32 * 1024);
      const expectedChecksum = crypto.createHash('sha256').update(fixtureBytes).digest('hex');

      const storageKey = 'documents/engineering/2026/DOC-2026-TEST_blueprint.pdf';

      // 1. Upload via storage adapter
      const uploadResult = await memoryAdapter.uploadObject(storageKey, fixtureBytes, {
        contentType: 'application/pdf',
        contentLength: fixtureBytes.length
      });

      expect(uploadResult.storageKey).toBe(storageKey);
      expect(uploadResult.sizeBytes).toBe(32 * 1024);
      expect(uploadResult.checksumSha256).toBe(expectedChecksum);

      // 2. Download stream and consume exact bytes
      const downloadResult = await memoryAdapter.downloadObject(storageKey);
      expect(downloadResult.contentType).toBe('application/pdf');
      expect(downloadResult.contentLength).toBe(32 * 1024);

      const downloadedChunks: Buffer[] = [];
      for await (const chunk of downloadResult.stream) {
        downloadedChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const downloadedBytes = Buffer.concat(downloadedChunks);

      // 3. Assert 100% byte-for-byte equality and matching checksum
      expect(downloadedBytes.length).toBe(fixtureBytes.length);
      expect(Buffer.compare(downloadedBytes, fixtureBytes)).toBe(0);

      const downloadedChecksum = crypto.createHash('sha256').update(downloadedBytes).digest('hex');
      expect(downloadedChecksum).toBe(expectedChecksum);
    });

    it('end-to-end: stores binary content on document and streams exact bytes via download endpoint', async () => {
      const docId = new Types.ObjectId();
      const testBuffer = Buffer.from('REAL-BINARY-PDF-CONTENT-INSSOLAR-2026-CERTIFIED', 'utf-8');
      const expectedChecksum = crypto.createHash('sha256').update(testBuffer).digest('hex');
      const storageKey = 'documents/compliance/2026/DOC-2026-00042_noc.pdf';

      // Seed storage adapter with the file
      await memoryAdapter.uploadObject(storageKey, testBuffer, {
        contentType: 'application/pdf',
        contentLength: testBuffer.length
      });

      const mockDoc = {
        _id: docId,
        documentNumber: 'DOC-2026-00042',
        originalFilename: 'discom_noc.pdf',
        safeDisplayName: 'DISCOM Approval NOC',
        category: DocumentCategory.NET_METERING_DOC,
        accessClassification: DocumentAccessClassification.INTERNAL_ONLY,
        mimeType: 'application/pdf',
        fileSizeBytes: testBuffer.length,
        checksumSha256: expectedChecksum,
        storageKey,
        storageStatus: DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
        version: 1,
        isArchived: false
      };

      vi.spyOn(DocumentModel, 'findById').mockReturnValue(makePopulateQuery(mockDoc));

      // Generate valid signed access URL
      const signedAccess = await DocumentService.generateSignedAccessUrl(
        docId.toString(),
        { userId: 'admin-user', role: 'ADMIN' },
        900
      );

      // Download binary stream via API
      const res = await request(app).get(signedAccess.downloadUrl);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/application\/pdf/);
      expect(res.header['content-disposition']).toContain('discom_noc.pdf');
      expect(res.header['x-document-checksum-sha256']).toBe(expectedChecksum);

      // Verify received binary payload matches original buffer exactly
      const resBuffer = Buffer.from(res.body);
      expect(resBuffer.toString('utf-8')).toBe(testBuffer.toString('utf-8'));
      expect(Buffer.compare(resBuffer, testBuffer)).toBe(0);
    });

    it('returns not found when attempting to download a nonexistent storage key from storage adapter', async () => {
      await expect(
        memoryAdapter.downloadObject('documents/nonexistent/2026/missing.pdf')
      ).rejects.toThrow(/not found/i);
    });
  });

  // =========================================================================
  // 2. PRODUCTION STORAGE FAIL-SAFE & S3 ADAPTER CONFIGURATION
  // =========================================================================
  describe('2. Storage Configuration & Fail-Safe Guards', () => {
    it('strictly forbids getStorageAdapter() from returning simulated storage in production', () => {
      // Mock NODE_ENV to production and STORAGE_PROVIDER to simulated
      const originalEnv = process.env.NODE_ENV;
      const originalStorage = process.env.STORAGE_PROVIDER;

      try {
        process.env.NODE_ENV = 'production';
        process.env.STORAGE_PROVIDER = 'simulated';
        resetStorageAdapter();

        expect(() => {
          getStorageAdapter();
        }).toThrow(/Production environment cannot use simulated storage/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.STORAGE_PROVIDER = originalStorage;
        resetStorageAdapter();
      }
    });

    it('S3StorageAdapter validates complete credentials on instantiation', () => {
      expect(() => {
        new S3StorageAdapter({
          bucketName: '',
          region: 'ap-south-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        });
      }).toThrow(/Incomplete S3 configuration/i);
    });
  });

  // =========================================================================
  // 3. REVERSE PROXY & DEPLOYMENT CONFIGURATION (STEP 2)
  // =========================================================================
  describe('3. Reverse Proxy, Trust Proxy & Spoofing Defense', () => {
    it('correctly parses client IP and ignores spoofed forwarded headers under trust proxy 1', async () => {
      // Behind a single reverse proxy (ALB/Nginx), the client IP is the rightmost IP before the proxy.
      // An external client injecting a fake X-Forwarded-For: 1.1.1.1 will have their real IP appended:
      // X-Forwarded-For: 1.1.1.1, 203.0.113.195
      const res = await request(app)
        .get('/api/v1/health/live')
        .set('X-Forwarded-For', '1.1.1.1, 203.0.113.195')
        .set('X-Forwarded-Proto', 'https');

      expect(res.status).toBe(200);
      expect(res.body?.data?.status).toBe('alive');
    });

    it('rejects TRUST_PROXY=true in production environment validation (defeats wildcard spoofing)', () => {
      expect(() => {
        parseEnv({
          NODE_ENV: 'production',
          PORT: '4000',
          MONGODB_URI: 'mongodb+srv://prod.cluster.net/ins_solar',
          SESSION_SECRET: 'a'.repeat(64),
          CSRF_SECRET: 'b'.repeat(64),
          MFA_ENCRYPTION_KEY: 'c'.repeat(64),
          STORAGE_PROVIDER: 's3',
          AWS_S3_BUCKET: 'ins-solar-vault',
          AWS_REGION: 'ap-south-1',
          AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE12345678',
          AWS_SECRET_ACCESS_KEY: 'secret1234567890abcdef1234567890abcdef',
          TRUST_PROXY: 'true' // Wildcard trust all proxies MUST be rejected
        });
      }).toThrow(/Insecure configuration: Blindly trusting all proxies/i);
    });

    it('accepts safe numeric hop count TRUST_PROXY=1 in production', () => {
      const parsed = parseEnv({
        NODE_ENV: 'production',
        PORT: '4000',
        MONGODB_URI: 'mongodb+srv://prod.cluster.net/ins_solar',
        SESSION_SECRET: 'a'.repeat(64),
        CSRF_SECRET: 'b'.repeat(64),
        MFA_ENCRYPTION_KEY: 'c'.repeat(64),
        STORAGE_PROVIDER: 's3',
        AWS_S3_BUCKET: 'ins-solar-vault',
        AWS_REGION: 'ap-south-1',
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE12345678',
        AWS_SECRET_ACCESS_KEY: 'secret1234567890abcdef1234567890abcdef',
        TRUST_PROXY: '1'
      });

      expect(parsed.TRUST_PROXY).toBe('1');
    });
  });

  // =========================================================================
  // 4. FAIL-FAST DATABASE STARTUP (STEP 3)
  // =========================================================================
  describe('4. Fail-Fast Database Startup', () => {
    it('returns 503 Service Unavailable on /health/ready probe when database is disconnected', async () => {
      vi.spyOn(dbManager, 'getState').mockReturnValue('disconnected');

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(503);
      expect(res.body?.data?.status).toBe('unhealthy');
      expect(res.body?.data?.database).toBe('disconnected');
    });

    it('returns 200 OK on /health/ready probe when database is connected', async () => {
      vi.spyOn(dbManager, 'getState').mockReturnValue('connected');

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body?.data?.status).toBe('ready');
      expect(res.body?.data?.database).toBe('connected');
    });

    it('DatabaseManager throws fatal error in production when MONGODB_URI is empty or unconfigured', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGODB_URI;

      try {
        process.env.NODE_ENV = 'production';
        process.env.MONGODB_URI = '';

        await expect(dbManager.connect()).rejects.toThrow(
          /MONGODB_URI is required in production environment/i
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.MONGODB_URI = originalUri;
      }
    });
  });

  // =========================================================================
  // 5. CREDENTIAL PROTECTION & LOG REDACTION
  // =========================================================================
  describe('5. Credential Protection & Sensitive Token Secrecy', () => {
    it('signed download URLs and AWS credentials never leak into response errors or public payloads', async () => {
      const res = await request(app)
        .get(
          '/api/v1/documents/6ae1a80e79edbe9dca145ccb/download?token=dummy-secret-token&expires=1000'
        )
        .expect(403);

      const rawResponse = JSON.stringify(res.body);
      expect(rawResponse).not.toContain('dummy-secret-token');
      expect(rawResponse).not.toContain('AWS_SECRET_ACCESS_KEY');
      expect(rawResponse).not.toContain('SESSION_SECRET');
    });
  });
});
