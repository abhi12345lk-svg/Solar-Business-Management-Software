import { Router, Request, Response } from 'express';
import { dbManager } from '../db/connection.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { HealthCheckLiveResponse, HealthCheckReadyResponse } from '@ins-solar/shared';

export const healthRouter = Router();

/**
 * GET /api/v1/health/live
 * Process liveness check. Always returns 200 if the process is responsive.
 */
healthRouter.get('/live', (req: Request, res: Response) => {
  const liveData: HealthCheckLiveResponse = {
    status: 'alive',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };

  sendSuccess(req, res, liveData, 200);
});

/**
 * GET /api/v1/health/ready
 * System readiness probe. Inspects external dependencies (MongoDB).
 * Returns 200 when ready, 200 with degraded state when unconfigured in local dev,
 * or 503 Service Unavailable when configured database is unreachable.
 */
healthRouter.get('/ready', (req: Request, res: Response) => {
  const dbState = dbManager.getState();
  const timestamp = new Date().toISOString();

  if (dbState === 'connected') {
    const readyData: HealthCheckReadyResponse = {
      status: 'ready',
      database: 'connected',
      timestamp
    };
    sendSuccess(req, res, readyData, 200);
    return;
  }

  if (dbState === 'unconfigured') {
    // Local dev without MONGODB_URI set
    const degradedData: HealthCheckReadyResponse = {
      status: 'degraded',
      database: 'unconfigured',
      timestamp
    };
    sendSuccess(req, res, degradedData, 200);
    return;
  }

  // Database is configured but disconnected/unhealthy -> 503 Service Unavailable
  const unhealthyData: HealthCheckReadyResponse = {
    status: 'unhealthy',
    database: 'disconnected',
    timestamp
  };
  sendSuccess(req, res, unhealthyData, 503);
});
