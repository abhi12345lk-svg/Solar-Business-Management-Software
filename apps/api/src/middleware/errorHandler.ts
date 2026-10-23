import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCode, ApiErrorDetail } from '@ins-solar/shared';
import { AppError } from '../errors/AppError.js';
import { sendError } from '../utils/responseEnvelope.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = req.correlationId || 'unknown';
  const timestamp = new Date().toISOString();

  // 1. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.errors.map(e => ({
      field: e.path.join('.'),
      issue: e.message
    }));

    logger.warn({ correlationId, details, path: req.path }, 'Validation failed on request');

    sendError(
      res,
      {
        code: ErrorCode.VALIDATION_FAILED,
        message: 'The submitted request payload failed schema validation.',
        details,
        correlationId,
        timestamp
      },
      400
    );
    return;
  }

  // 2. Known Operational Application Errors
  if (err instanceof AppError) {
    logger.warn(
      { correlationId, code: err.code, statusCode: err.statusCode, path: req.path },
      err.message
    );

    sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details,
        correlationId,
        timestamp
      },
      err.statusCode
    );
    return;
  }

  // 3. Uncaught / Unexpected Server Errors
  logger.error(
    {
      correlationId,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      path: req.path,
      method: req.method
    },
    'Unhandled server error occurred'
  );

  const safeMessage =
    config.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message || 'An unexpected internal server error occurred.';

  sendError(
    res,
    {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: safeMessage,
      correlationId,
      timestamp
    },
    500
  );
}
