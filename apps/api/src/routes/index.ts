import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter, devTestTokens } from './auth.routes.js';
import { customerAuthRouter, devCustomerTokens } from './customer-auth.routes.js';
import { config } from '../config/env.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import {
  requireAuth,
  requireEmployee,
  requireCustomer,
  requirePermission,
  requireMfa,
  requireDepartmentScope,
  checkAntiSelfApproval,
  requireCustomerOwnership
} from '../middleware/authorize.js';

export const apiRouter = Router();

// Mount Subrouters
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customer-auth', customerAuthRouter);

// Development/Test only tokens route (strictly unavailable in production)
if (config.NODE_ENV !== 'production') {
  apiRouter.get('/dev/last-tokens', (req, res) => {
    sendSuccess(req, res, {
      lastPasswordResetToken: devTestTokens.lastPasswordResetToken,
      lastMagicLinkToken: devCustomerTokens.lastMagicLinkToken,
      lastOtp: devCustomerTokens.lastOtp
    });
  });
}

// Test-only authorization guard test harnesses
if (config.NODE_ENV === 'test') {
  const testGuardRouter = Router();

  testGuardRouter.post(
    '/department-scoped',
    requireAuth,
    requireEmployee,
    requireDepartmentScope(req => req.body.targetDepartment),
    (req, res) => sendSuccess(req, res, { authorized: true })
  );

  testGuardRouter.post(
    '/anti-self-approval',
    requireAuth,
    requireEmployee,
    checkAntiSelfApproval(req => req.body.ownerUserId),
    (req, res) => sendSuccess(req, res, { approved: true })
  );

  testGuardRouter.post(
    '/customer-resource',
    requireAuth,
    requireCustomer,
    requireCustomerOwnership(req => req.body.resourceCustomerId),
    (req, res) => sendSuccess(req, res, { customerData: 'confidential' })
  );

  testGuardRouter.get('/privileged-mfa', requireAuth, requireEmployee, requireMfa, (req, res) =>
    sendSuccess(req, res, { mfaProtected: true })
  );

  testGuardRouter.get(
    '/permission-guarded',
    requireAuth,
    requireEmployee,
    requirePermission('quote:discount_approve'),
    (req, res) => sendSuccess(req, res, { permissionApproved: true })
  );

  apiRouter.use('/test-guard', testGuardRouter);
}
