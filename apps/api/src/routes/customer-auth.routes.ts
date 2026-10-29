import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Customer } from '../models/Customer.js';
import { AppError } from '../errors/AppError.js';
import {
  ErrorCode,
  AuditAction,
  AuditOutcome,
  ActorType,
  CustomerMagicLinkRequestSchema,
  CustomerMagicLinkVerifySchema,
  CustomerOtpRequestSchema,
  CustomerOtpVerifySchema
} from '@ins-solar/shared';
import { generateRandomToken, hashToken } from '../utils/crypto.js';
import { AuditService } from '../services/auditService.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { customerTokenRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth, requireCustomer } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { config } from '../config/env.js';
import { EmailService } from '../services/emailService.js';
import { SmsService } from '../services/smsService.js';

export const customerAuthRouter = Router();

// Test/development token capture when external mail/SMS gateways are disabled
export const devCustomerTokens = {
  lastMagicLinkToken: null as string | null,
  lastOtp: null as string | null
};

/**
 * POST /api/v1/customer-auth/magic-link
 * Requests a passwordless email magic link.
 */
customerAuthRouter.post(
  '/magic-link',
  customerTokenRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CustomerMagicLinkRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { identifier } = parseResult.data;
      const lowerIdentifier = identifier.toLowerCase();

      // Query customer identity by email or phone
      const identity = await CustomerIdentity.findOne({
        $or: [{ email: lowerIdentifier }, { phone: identifier }]
      });

      if (identity && identity.isActive) {
        const rawToken = generateRandomToken(32);
        identity.magicLinkTokenHash = hashToken(rawToken);
        identity.magicLinkExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await identity.save();

        // Capture in test/dev store only
        if (config.NODE_ENV !== 'production') {
          devCustomerTokens.lastMagicLinkToken = rawToken;
        }

        // Dispatch transactional email via EmailService
        if (identity.email) {
          const portalUrl = `${config.CORS_ORIGIN}/customer-portal?token=${rawToken}`;
          await EmailService.sendMagicLink(identity.email, portalUrl);
        }

        await AuditService.recordEvent({
          actorId: identity._id.toString(),
          actorType: ActorType.CUSTOMER,
          action: AuditAction.CUSTOMER_MAGIC_LINK_REQUESTED,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'cust-ml-req'
        });
      }

      // Generic response to defeat identity enumeration
      return sendSuccess(req, res, {
        message: 'If an account matches those details, a secure access link has been dispatched.'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/customer-auth/magic-link/verify
 * Consumes single-use magic link token and creates customer session.
 */
customerAuthRouter.post(
  '/magic-link/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CustomerMagicLinkVerifySchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { token } = parseResult.data;
      const tokenHash = hashToken(token);

      const identity = await CustomerIdentity.findOne({
        magicLinkTokenHash: tokenHash,
        magicLinkExpiresAt: { $gt: new Date() },
        isActive: true
      });

      if (!identity) {
        return next(
          new AppError(400, 'Access link is invalid or has expired.', ErrorCode.VALIDATION_FAILED)
        );
      }

      // Invalidate token immediately (single-use guarantee)
      identity.magicLinkTokenHash = undefined;
      identity.magicLinkExpiresAt = undefined;
      identity.lastLoginAt = new Date();
      await identity.save();

      const customer = await Customer.findById(identity.customerId);

      // Rotate and initialize customer session
      req.session.regenerate(async err => {
        if (err) {
          return next(
            new AppError(500, 'Session initialization failed.', ErrorCode.INTERNAL_SERVER_ERROR)
          );
        }

        req.session.customer = {
          customerIdentityId: identity._id.toString(),
          customerId: identity.customerId.toString(),
          email: identity.email,
          phone: identity.phone
        };
        req.session.createdAt = Date.now();
        req.session.lastActivity = Date.now();
        req.session.csrfSecret = crypto.randomBytes(32).toString('hex');

        const csrfToken = generateCsrfToken(req.session.csrfSecret);
        res.cookie('XSRF-TOKEN', csrfToken, {
          httpOnly: false,
          secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
          sameSite: config.COOKIE_SAME_SITE,
          path: '/'
        });

        await AuditService.recordEvent({
          actorId: identity._id.toString(),
          actorType: ActorType.CUSTOMER,
          action: AuditAction.CUSTOMER_MAGIC_LINK_VERIFIED,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'cust-ml-verify'
        });

        return sendSuccess(req, res, {
          customer: {
            id: identity._id.toString(),
            customerId: identity.customerId.toString(),
            customerCode: customer?.customerCode || identity.customerCode,
            name: identity.name,
            email: identity.email,
            phone: identity.phone,
            type: customer?.type || 'INDIVIDUAL'
          },
          csrfToken
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/customer-auth/otp/request
 * Requests a 6-digit verification OTP.
 */
customerAuthRouter.post(
  '/otp/request',
  customerTokenRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CustomerOtpRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { phone } = parseResult.data;
      const identity = await CustomerIdentity.findOne({ phone, isActive: true });

      if (identity) {
        // Generate 6-digit numeric OTP
        const otpNumber = crypto.randomInt(100000, 999999).toString();
        identity.otpHash = hashToken(otpNumber);
        identity.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        identity.otpAttempts = 0;
        await identity.save();

        if (config.NODE_ENV !== 'production') {
          devCustomerTokens.lastOtp = otpNumber;
        }

        // Dispatch OTP via DLT-compliant SMS service
        if (identity.phone) {
          await SmsService.sendOtp(identity.phone, otpNumber);
        }

        await AuditService.recordEvent({
          actorId: identity._id.toString(),
          actorType: ActorType.CUSTOMER,
          action: AuditAction.CUSTOMER_OTP_REQUESTED,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'cust-otp-req'
        });
      }

      return sendSuccess(req, res, {
        message:
          'If an account matches that mobile number, a verification code has been dispatched.'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/customer-auth/otp/verify
 * Verifies mobile OTP and establishes customer session.
 */
customerAuthRouter.post('/otp/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CustomerOtpVerifySchema.safeParse(req.body);
    if (!parseResult.success) {
      return next(AppError.validation(parseResult.error));
    }

    const { phone, otp } = parseResult.data;
    const identity = await CustomerIdentity.findOne({ phone, isActive: true });

    if (!identity || !identity.otpHash || !identity.otpExpiresAt) {
      return next(
        new AppError(400, 'Invalid or expired verification code.', ErrorCode.VALIDATION_FAILED)
      );
    }

    // Check max attempts (3)
    if (identity.otpAttempts >= 3) {
      identity.otpHash = undefined;
      identity.otpExpiresAt = undefined;
      await identity.save();
      return next(
        new AppError(
          400,
          'Maximum OTP attempts exceeded. Please request a new code.',
          ErrorCode.VALIDATION_FAILED
        )
      );
    }

    // Check expiry
    if (Date.now() > identity.otpExpiresAt.getTime()) {
      identity.otpHash = undefined;
      identity.otpExpiresAt = undefined;
      await identity.save();
      return next(
        new AppError(
          400,
          'Verification code has expired. Please request a new code.',
          ErrorCode.VALIDATION_FAILED
        )
      );
    }

    // Verify hash
    const submittedHash = hashToken(otp);
    if (submittedHash !== identity.otpHash) {
      identity.otpAttempts += 1;
      await identity.save();
      return next(
        new AppError(400, 'Invalid or expired verification code.', ErrorCode.VALIDATION_FAILED)
      );
    }

    // Clear OTP upon success
    identity.otpHash = undefined;
    identity.otpExpiresAt = undefined;
    identity.otpAttempts = 0;
    identity.lastLoginAt = new Date();
    await identity.save();

    const customer = await Customer.findById(identity.customerId);

    req.session.regenerate(async err => {
      if (err) {
        return next(
          new AppError(500, 'Session initialization failed.', ErrorCode.INTERNAL_SERVER_ERROR)
        );
      }

      req.session.customer = {
        customerIdentityId: identity._id.toString(),
        customerId: identity.customerId.toString(),
        email: identity.email,
        phone: identity.phone
      };
      req.session.createdAt = Date.now();
      req.session.lastActivity = Date.now();
      req.session.csrfSecret = crypto.randomBytes(32).toString('hex');

      const csrfToken = generateCsrfToken(req.session.csrfSecret);
      res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false,
        secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
        sameSite: config.COOKIE_SAME_SITE,
        path: '/'
      });

      await AuditService.recordEvent({
        actorId: identity._id.toString(),
        actorType: ActorType.CUSTOMER,
        action: AuditAction.CUSTOMER_OTP_VERIFIED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'cust-otp-verify'
      });

      return sendSuccess(req, res, {
        customer: {
          id: identity._id.toString(),
          customerId: identity.customerId.toString(),
          customerCode: customer?.customerCode || identity.customerCode,
          name: identity.name,
          email: identity.email,
          phone: identity.phone,
          type: customer?.type || 'INDIVIDUAL'
        },
        csrfToken
      });
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/customer-auth/me
 * Retrieves current customer portal identity profile.
 */
customerAuthRouter.get(
  '/me',
  requireAuth,
  requireCustomer,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerSession = req.session.customer!;
      const identity = await CustomerIdentity.findById(customerSession.customerIdentityId);

      if (!identity || !identity.isActive) {
        req.session.destroy(() => {});
        return next(
          new AppError(
            401,
            'Customer identity not found or inactive.',
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      const customer = await Customer.findById(identity.customerId);

      return sendSuccess(req, res, {
        id: identity._id.toString(),
        customerId: identity.customerId.toString(),
        customerCode: customer?.customerCode || identity.customerCode,
        name: identity.name,
        email: identity.email,
        phone: identity.phone,
        type: customer?.type || 'INDIVIDUAL'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/customer-auth/logout
 * Destroys customer session.
 */
customerAuthRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  const actorId = req.session?.customer?.customerIdentityId;

  req.session.destroy(async err => {
    if (err) {
      return next(
        new AppError(500, 'Failed to terminate session.', ErrorCode.INTERNAL_SERVER_ERROR)
      );
    }

    res.clearCookie('ins_session', { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });

    if (actorId) {
      await AuditService.recordEvent({
        actorId,
        actorType: ActorType.CUSTOMER,
        action: AuditAction.CUSTOMER_LOGOUT,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'cust-logout'
      });
    }

    return sendSuccess(req, res, { message: 'Logged out successfully.' });
  });
});
