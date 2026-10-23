import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Health Endpoints (/api/v1/health)', () => {
  describe('GET /api/v1/health/live', () => {
    it('returns HTTP 200 with alive status and correlation ID header', async () => {
      const response = await request(app)
        .get('/api/v1/health/live')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'alive'
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
      expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('preserves existing client-provided X-Correlation-ID', async () => {
      const clientCorrelationId = 'client-trace-12345';
      const response = await request(app)
        .get('/api/v1/health/live')
        .set('X-Correlation-ID', clientCorrelationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(clientCorrelationId);
      expect(response.body.meta.correlationId).toBe(clientCorrelationId);
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns readiness report without exposing secrets or connection strings', async () => {
      const response = await request(app)
        .get('/api/v1/health/ready')
        .expect('Content-Type', /json/);

      // Status should be 200 (if ready or unconfigured) or 503 (if disconnected)
      expect([200, 503]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(['ready', 'degraded', 'unhealthy']).toContain(response.body.data.status);
      expect(['connected', 'disconnected', 'unconfigured']).toContain(response.body.data.database);

      // Crucial: Must never expose secrets or environment variables
      expect(JSON.stringify(response.body)).not.toContain('mongodb://');
      expect(JSON.stringify(response.body)).not.toContain('mongodb+srv://');
      expect(JSON.stringify(response.body)).not.toContain('SESSION_SECRET');
    });
  });
});
