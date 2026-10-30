import { RequestHandler } from 'express';
import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode, AuditAction, AuditOutcome, ActorType } from '@ins-solar/shared';
import { AuditService } from '../services/auditService.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates a HMAC-signed CSRF token bound to a session secret.
 */
export function generateCsrfToken(sessionSecret: string): string {
  const salt = crypto.randomBytes(8).toString('hex');
  const signature = crypto
    .createHmac('sha256', config.CSRF_SECRET)
    .update(`${sessionSecret}:${salt}`)
    .digest('hex');
  return `${salt}.${signature}`;
}

/**
 * Validates a submitted CSRF token against the session secret.
 */
export function verifyCsrfToken(token: string, sessionSecret: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [salt, expectedSignature] = parts as [string, string];
  const actualSignature = crypto
    .createHmac('sha256', config.CSRF_SECRET)
    .update(`${sessionSecret}:${salt}`)
    .digest('hex');

  const actualBuf = Buffer.from(actualSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Middleware ensuring a CSRF secret exists on the session and setting readable XSRF-TOKEN cookie.
 */
export const csrfInitMiddleware: RequestHandler = (req, res, next) => {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }

  const token = generateCsrfToken(req.session.csrfSecret);

  // Set non-HttpOnly readable cookie for Axios/Fetch clients
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    sameSite: config.COOKIE_SAME_SITE,
    path: '/'
  });

  next();
};

/**
 * Middleware verifying anti-CSRF token on all state-mutating HTTP requests.
 */
export const csrfProtectionMiddleware: RequestHandler = async (req, _res, next) => {
  // Safe read-only HTTP methods are exempt
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // If request has an Origin header, verify it matches configured origins or trusted domain
  const origin = req.headers.origin;
  const configuredOrigins = config.CORS_ORIGIN.split(',').map(s => s.trim());
  const isTrustedOrigin =
    !origin ||
    configuredOrigins.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    origin === `http://localhost:${config.PORT}` ||
    (req.headers.host &&
      (origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`));

  if (origin && !isTrustedOrigin) {
    await AuditService.recordEvent({
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.CSRF_VIOLATION,
      outcome: AuditOutcome.DENIED,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: (req as any).correlationId || crypto.randomUUID(),
      details: { reason: 'Origin mismatch', submittedOrigin: origin }
    });
    return next(new AppError(403, 'Cross-origin request blocked.', ErrorCode.PERMISSION_DENIED));
  }

  // Mutation routes that are explicitly public unauthenticated entrypoints
  const isPublicAuthEntrypoint =
    req.path.endsWith('/auth/login') ||
    req.path.endsWith('/auth/login/mfa') ||
    req.path.endsWith('/auth/logout') ||
    req.path.endsWith('/auth/password-reset/request') ||
    req.path.endsWith('/auth/password-reset/confirm') ||
    req.path.endsWith('/customer-auth/magic-link') ||
    req.path.endsWith('/customer-auth/magic-link/verify') ||
    req.path.endsWith('/customer-auth/otp/verify') ||
    req.path.endsWith('/customer-auth/logout');

  // If unauthenticated public entrypoint and no session user, skip CSRF header check
  if (isPublicAuthEntrypoint && !req.session?.user && !req.session?.customer) {
    return next();
  }

  const csrfSecret = req.session?.csrfSecret;
  if (!csrfSecret) {
    return next(
      new AppError(403, 'Invalid or missing CSRF session context.', ErrorCode.PERMISSION_DENIED)
    );
  }

  const submittedToken =
    (req.headers['x-csrf-token'] as string) ||
    (req.headers['x-xsrf-token'] as string) ||
    (req.body && req.body._csrf);

  if (!submittedToken || !verifyCsrfToken(submittedToken, csrfSecret)) {
    await AuditService.recordEvent({
      actorId: req.session?.user?.userId || req.session?.customer?.customerId,
      actorType: req.session?.user
        ? ActorType.EMPLOYEE
        : req.session?.customer
          ? ActorType.CUSTOMER
          : ActorType.ANONYMOUS,
      action: AuditAction.CSRF_VIOLATION,
      outcome: AuditOutcome.DENIED,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: (req as any).correlationId || crypto.randomUUID(),
      details: {
        path: req.originalUrl,
        method: req.method,
        tokenProvided: !!submittedToken
      }
    });

    return next(new AppError(403, 'Invalid or missing CSRF token.', ErrorCode.PERMISSION_DENIED));
  }

  next();
};
