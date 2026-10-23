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

  // 1. Basic Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false
    })
  );

  // 2. Strict CORS Configuration (Credentials enabled only for trusted origins)
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Disallow wildcard with credentials; only allow configured origin or null origin
        if (!requestOrigin || requestOrigin === config.CORS_ORIGIN) {
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

  // 3. Request Body Size Limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
