import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/env.js';
import { ErrorCode, AuditAction, AuditOutcome, ActorType } from '@ins-solar/shared';
import { AuditService } from '../services/auditService.js';

function createCustomLimiterHandler(actionName: string) {
  return async (req: Request, res: Response) => {
    await AuditService.recordEvent({
      actorType: req.session?.user
        ? ActorType.EMPLOYEE
        : req.session?.customer
          ? ActorType.CUSTOMER
          : ActorType.ANONYMOUS,
      actorId: req.session?.user?.userId || req.session?.customer?.customerId,
      action: AuditAction.RATE_LIMIT_BLOCKED,
      outcome: AuditOutcome.DENIED,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: (req as any).correlationId || 'rate-limit-exceeded',
      details: {
        endpoint: req.originalUrl,
        action: actionName
      }
    });

    res.status(429).json({
      success: false,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please slow down and try again later.',
        details: []
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || 'rate-limit-exceeded'
      }
    });
  };
}

const isTest = config.NODE_ENV === 'test';

/**
 * Sensitive rate limiter for employee login attempts (5 requests per 15 minutes).
 */
export const loginRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 1000 : config.RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomLimiterHandler('EMPLOYEE_LOGIN')
});

/**
 * Rate limiter for MFA challenge and recovery attempts.
 */
export const mfaRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomLimiterHandler('MFA_VERIFY')
});

/**
 * Rate limiter for customer magic-link and OTP requests.
 */
export const customerTokenRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomLimiterHandler('CUSTOMER_AUTH_REQUEST')
});

/**
 * Rate limiter for password reset requests (3 requests per 15 mins).
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 1000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createCustomLimiterHandler('PASSWORD_RESET_REQUEST')
});
