import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { ErrorCode } from '@ins-solar/shared';

describe('Standardized Error Handling', () => {
  it('returns HTTP 404 and uniform error envelope for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent-endpoint')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: expect.stringContaining('not found'),
        correlationId: expect.any(String),
        timestamp: expect.any(String)
      }
    });
  });

  it('preserves correlationId between header and error payload', async () => {
    const clientTrace = 'error-trace-uuid-999';
    const response = await request(app)
      .get('/api/v1/does-not-exist')
      .set('X-Correlation-ID', clientTrace)
      .expect(404);

    expect(response.headers['x-correlation-id']).toBe(clientTrace);
    expect(response.body.error.correlationId).toBe(clientTrace);
  });
});
