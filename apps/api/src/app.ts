import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sessionMiddleware, sessionTimeoutMiddleware } from './middleware/session.js';
import { csrfInitMiddleware, csrfProtectionMiddleware } from './middleware/csrf.js';
import { apiRouter } from './routes/index.js';
import { AppError } from './errors/AppError.js';

export function createApp(): Express {
  const app = express();

  // 0. Trusted Reverse Proxy Configuration (Safeguards client IP resolution & secure cookies)
  if (config.TRUST_PROXY === 'false' || config.TRUST_PROXY === '0') {
    app.set('trust proxy', false);
  } else if (!isNaN(Number(config.TRUST_PROXY))) {
    app.set('trust proxy', Number(config.TRUST_PROXY));
  } else if (config.TRUST_PROXY.includes(',')) {
    app.set(
      'trust proxy',
      config.TRUST_PROXY.split(',').map(s => s.trim())
    );
  } else {
    app.set('trust proxy', config.TRUST_PROXY);
  }

  // 1. Basic Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
      frameguard: config.NODE_ENV === 'production' ? { action: 'sameorigin' } : false
    })
  );

  // 2. Strict CORS Configuration (Credentials enabled only for trusted origins)
  const configuredOrigins = config.CORS_ORIGIN.split(',').map(s => s.trim());

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Disallow wildcard with credentials; only allow configured origins or null origin
        if (
          !requestOrigin ||
          configuredOrigins.includes(requestOrigin) ||
          requestOrigin.endsWith('.vercel.app') ||
          requestOrigin.includes('vercel.app')
        ) {
          callback(null, true);
        } else {
          callback(new AppError(403, `CORS blocked: Origin ${requestOrigin} not permitted.`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Correlation-ID',
        'X-CSRF-Token',
        'X-XSRF-Token',
        'Idempotency-Key'
      ],
      exposedHeaders: ['X-CSRF-Token']
    })
  );

  // 3. Request Body Size Limits (Allows site survey rooftop photo uploads & documents)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 4. Cookie Parser
  app.use(cookieParser(config.SESSION_SECRET));

  // 5. Request Correlation ID
  app.use(correlationIdMiddleware);

  // 6. Server-Managed Session
  app.use(sessionMiddleware);

  // 7. Session Timeout & Idle Expiry Enforcement
  app.use(sessionTimeoutMiddleware);

  // 8. CSRF Initialization & Anti-CSRF Token Enforcement on Mutations
  app.use(csrfInitMiddleware);
  app.use(csrfProtectionMiddleware);

  // 9. Structured HTTP Request Logging
  if (config.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        customProps: req => ({
          correlationId: (req as any).correlationId
        }),
        customSuccessMessage: (req, res, responseTime) => {
          return `${req.method} ${req.url} -> ${res.statusCode} (${responseTime}ms)`;
        },
        customErrorMessage: (req, res, error) => {
          return `${req.method} ${req.url} -> ${res.statusCode}: ${error.message}`;
        },
        serializers:
          config.NODE_ENV === 'development'
            ? {
                req: (req: any) => ({
                  id: req.id,
                  method: req.method,
                  url: req.url
                }),
                res: (res: any) => ({
                  statusCode: res.statusCode
                })
              }
            : undefined,
        autoLogging: {
          ignore: req => req.url?.includes('/health/live') || false
        }
      })
    );
  }

  // 10. Mount API Version 1 Prefix
  app.use(config.API_PREFIX, apiRouter);

  // 11. Unmatched Route Handler (404 Not Found)
  app.use((req, _res, next) => {
    next(AppError.notFound(`Endpoint ${req.method} ${req.originalUrl}`));
  });

  // 12. Centralized Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
