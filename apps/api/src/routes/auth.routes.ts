import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { AppError } from '../errors/AppError.js';
import {
  ErrorCode,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole,
  Permission,
  ROLE_DEFAULT_PERMISSIONS,
  LoginSchema,
  MfaLoginChallengeSchema,
  MfaConfirmEnrollSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UpdateUserPrivilegesSchema
} from '@ins-solar/shared';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  encryptAesGcm,
  decryptAesGcm
} from '../utils/crypto.js';
import {
  generateMfaSetup,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  consumeRecoveryCode
} from '../utils/mfa.js';
import { AuditService } from '../services/auditService.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import {
  loginRateLimiter,
  mfaRateLimiter,
  passwordResetRateLimiter
} from '../middleware/rateLimiter.js';
import {
  requireAuth,
  requireEmployee,
  requireRole,
  requirePermission
} from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { config } from '../config/env.js';

export const authRouter = Router();

// In-memory capture for test/development verification when email provider is unavailable
export const devTestTokens = {
  lastPasswordResetToken: null as string | null,
  lastMagicLinkToken: null as string | null
};

/**
 * GET /api/v1/auth/csrf
 * Retrieves CSRF token and sets readable cookie.
 */
authRouter.get('/csrf', (req: Request, res: Response) => {
  if (!req.session) {
    throw new AppError(500, 'Session store unavailable.');
  }
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }
  const token = generateCsrfToken(req.session.csrfSecret);

  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    sameSite: config.COOKIE_SAME_SITE,
    path: '/'
  });

  return sendSuccess(req, res, { csrfToken: token });
});

/**
 * POST /api/v1/auth/login
 * Standard employee login with Argon2id and optional inline MFA.
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = LoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { email, password, totpCode, recoveryCode } = parseResult.data;

      // 1. Query user by lowercase email
      const user = await User.findOne({ email });

      // Constant-time dummy hash verification if user does not exist to defeat timing attacks
      if (!user || !user.isActive) {
        await hashPassword('dummy-timing-mitigation-password');
        await AuditService.recordEvent({
          actorType: ActorType.ANONYMOUS,
          action: AuditAction.AUTH_LOGIN_FAILURE,
          outcome: AuditOutcome.FAILURE,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'login-fail',
          details: { reason: 'User not found or inactive', submittedEmail: email }
        });
        return next(
          new AppError(401, 'Invalid email or password.', ErrorCode.AUTHENTICATION_REQUIRED)
        );
      }

      // 2. Verify password with Argon2id
      const passwordValid = await verifyPassword(user.passwordHash, password);
      if (!passwordValid) {
        await AuditService.recordEvent({
          actorId: user._id.toString(),
          actorType: ActorType.EMPLOYEE,
          action: AuditAction.AUTH_LOGIN_FAILURE,
          outcome: AuditOutcome.FAILURE,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'login-fail',
          details: { reason: 'Password mismatch' }
        });
        return next(
          new AppError(401, 'Invalid email or password.', ErrorCode.AUTHENTICATION_REQUIRED)
        );
      }

      // 3. MFA Handling
      let mfaVerified = false;
      if (user.mfaEnabled && user.mfaSecretEncrypted) {
        const plaintextSecret = decryptAesGcm(user.mfaSecretEncrypted);

        if (totpCode) {
          if (!verifyTotpCode(totpCode, plaintextSecret)) {
            await AuditService.recordEvent({
              actorId: user._id.toString(),
              actorType: ActorType.EMPLOYEE,
              action: AuditAction.AUTH_MFA_FAILED,
              outcome: AuditOutcome.FAILURE,
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              correlationId: (req as any).correlationId || 'login-mfa-fail',
              details: { reason: 'Invalid TOTP code' }
            });
            return next(
              new AppError(
                401,
                'Invalid multi-factor authentication code.',
                ErrorCode.AUTHENTICATION_REQUIRED
              )
            );
          }
          mfaVerified = true;
        } else if (recoveryCode && user.mfaRecoveryCodesHashed) {
          const { valid, remainingHashes } = consumeRecoveryCode(
            recoveryCode,
            user.mfaRecoveryCodesHashed
          );
          if (!valid) {
            await AuditService.recordEvent({
              actorId: user._id.toString(),
              actorType: ActorType.EMPLOYEE,
              action: AuditAction.AUTH_MFA_FAILED,
              outcome: AuditOutcome.FAILURE,
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              correlationId: (req as any).correlationId || 'login-recovery-fail',
              details: { reason: 'Invalid or already used recovery code' }
            });
            return next(
              new AppError(
                401,
                'Invalid or already used recovery code.',
                ErrorCode.AUTHENTICATION_REQUIRED
              )
            );
          }
          user.mfaRecoveryCodesHashed = remainingHashes;
          await user.save();
          mfaVerified = true;
          await AuditService.recordEvent({
            actorId: user._id.toString(),
            actorType: ActorType.EMPLOYEE,
            action: AuditAction.AUTH_MFA_RECOVERY_USED,
            outcome: AuditOutcome.SUCCESS,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            correlationId: (req as any).correlationId || 'login-recovery-success',
            details: { remainingCodesCount: remainingHashes.length }
          });
        } else {
          // MFA challenge required: return challenge token
          const challengeToken = generateRandomToken(24);
          req.session.mfaChallenge = {
            userId: user._id.toString(),
            challengeToken,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
          };

          return sendSuccess(req, res, {
            requiresMfa: true,
            userId: user._id.toString(),
            challengeToken
          });
        }
      }

      // 4. Session rotation on successful authentication
      req.session.regenerate(async err => {
        if (err) {
          return next(
            new AppError(500, 'Session initialization failed.', ErrorCode.INTERNAL_SERVER_ERROR)
          );
        }

        req.session.user = {
          userId: user._id.toString(),
          employeeCode: user.employeeCode,
          email: user.email,
          role: user.role,
          department: user.department,
          mfaVerified,
          sessionVersion: user.sessionVersion
        };
        req.session.createdAt = Date.now();
        req.session.lastActivity = Date.now();
        req.session.csrfSecret = crypto.randomBytes(32).toString('hex');

        user.lastLoginAt = new Date();
        await user.save();

        const csrfToken = generateCsrfToken(req.session.csrfSecret);
        res.cookie('XSRF-TOKEN', csrfToken, {
          httpOnly: false,
          secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
          sameSite: config.COOKIE_SAME_SITE,
          path: '/'
        });

        await AuditService.recordEvent({
          actorId: user._id.toString(),
          actorType: ActorType.EMPLOYEE,
          action: AuditAction.AUTH_LOGIN_SUCCESS,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'login-success',
          details: { mfaUsed: mfaVerified }
        });

        const userDto = user.toJSON();
        (userDto as any).permissions = user.getEffectivePermissions();

        return sendSuccess(req, res, {
          user: userDto,
          csrfToken
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login/mfa
 * Resolves MFA challenge initiated during login.
 */
authRouter.post(
  '/login/mfa',
  mfaRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = MfaLoginChallengeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { userId, challengeToken, totpCode, recoveryCode } = parseResult.data;
      const challenge = req.session?.mfaChallenge;

      if (
        !challenge ||
        challenge.userId !== userId ||
        challenge.challengeToken !== challengeToken ||
        Date.now() > challenge.expiresAt
      ) {
        return next(
          new AppError(
            401,
            'MFA challenge has expired or is invalid. Please log in again.',
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      const user = await User.findById(userId);
      if (!user || !user.isActive || !user.mfaSecretEncrypted) {
        return next(
          new AppError(401, 'Invalid MFA verification context.', ErrorCode.AUTHENTICATION_REQUIRED)
        );
      }

      const plaintextSecret = decryptAesGcm(user.mfaSecretEncrypted);

      if (totpCode) {
        if (!verifyTotpCode(totpCode, plaintextSecret)) {
          await AuditService.recordEvent({
            actorId: user._id.toString(),
            actorType: ActorType.EMPLOYEE,
            action: AuditAction.AUTH_MFA_FAILED,
            outcome: AuditOutcome.FAILURE,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            correlationId: (req as any).correlationId || 'mfa-challenge-fail',
            details: { reason: 'Invalid TOTP code' }
          });
          return next(
            new AppError(
              401,
              'Invalid multi-factor authentication code.',
              ErrorCode.AUTHENTICATION_REQUIRED
            )
          );
        }
      } else if (recoveryCode && user.mfaRecoveryCodesHashed) {
        const { valid, remainingHashes } = consumeRecoveryCode(
          recoveryCode,
          user.mfaRecoveryCodesHashed
        );
        if (!valid) {
          return next(
            new AppError(
              401,
              'Invalid or already used recovery code.',
              ErrorCode.AUTHENTICATION_REQUIRED
            )
          );
        }
        user.mfaRecoveryCodesHashed = remainingHashes;
        await user.save();
      }

      // Complete session creation
      req.session.regenerate(async err => {
        if (err) {
          return next(
            new AppError(500, 'Session initialization failed.', ErrorCode.INTERNAL_SERVER_ERROR)
          );
        }

        req.session.user = {
          userId: user._id.toString(),
          employeeCode: user.employeeCode,
          email: user.email,
          role: user.role,
          department: user.department,
          mfaVerified: true,
          sessionVersion: user.sessionVersion
        };
        req.session.createdAt = Date.now();
        req.session.lastActivity = Date.now();
        req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
        delete req.session.mfaChallenge;

        user.lastLoginAt = new Date();
        await user.save();

        const csrfToken = generateCsrfToken(req.session.csrfSecret);
        res.cookie('XSRF-TOKEN', csrfToken, {
          httpOnly: false,
          secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
          sameSite: config.COOKIE_SAME_SITE,
          path: '/'
        });

        await AuditService.recordEvent({
          actorId: user._id.toString(),
          actorType: ActorType.EMPLOYEE,
          action: AuditAction.AUTH_MFA_VERIFIED,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'mfa-verified',
          details: { method: totpCode ? 'TOTP' : 'RECOVERY_CODE' }
        });

        const userDto = user.toJSON();
        (userDto as any).permissions = user.getEffectivePermissions();

        return sendSuccess(req, res, {
          user: userDto,
          csrfToken
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Destroys server-side session and clears cookies.
 */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  const actorId = req.session?.user?.userId;

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
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.AUTH_LOGOUT,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'logout'
      });
    }

    return sendSuccess(req, res, { message: 'Logged out successfully.' });
  });
});

/**
 * GET /api/v1/auth/me
 * Retrieves authenticated employee profile and effective permissions.
 */
authRouter.get(
  '/me',
  requireAuth,
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.currentUser;
    if (!user) {
      if (req.session?.user) {
        const role = req.session.user.role;
        const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
        const sessionPermissions = (req.session.user as any).permissions || [];
        const permissions = Array.from(new Set<Permission>([...defaults, ...sessionPermissions]));
        return sendSuccess(req, res, {
          id: req.session.user.userId,
          email: req.session.user.email,
          role: req.session.user.role,
          department: req.session.user.department,
          permissions,
          mfaVerified: req.session.user.mfaVerified ?? false
        });
      }
      return next(
        new AppError(
          401,
          'Authentication required to access this resource.',
          ErrorCode.AUTHENTICATION_REQUIRED
        )
      );
    }
    const userDto = user.toJSON();
    (userDto as any).permissions = user.getEffectivePermissions();
    (userDto as any).mfaVerified = req.session.user?.mfaVerified ?? false;

    return sendSuccess(req, res, userDto);
  }
);

/**
 * POST /api/v1/auth/mfa/setup
 * Initiates MFA enrollment by generating secret and QR code.
 */
authRouter.post(
  '/mfa/setup',
  requireAuth,
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.currentUser;
      const setup = await generateMfaSetup(user.email);

      // Stash candidate secret temporarily in session for confirmation
      (req.session as any).candidateMfaSecret = setup.secret;

      await AuditService.recordEvent({
        actorId: user._id.toString(),
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.AUTH_MFA_ENROLL_INITIATED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'mfa-setup'
      });

      return sendSuccess(req, res, {
        qrCodeDataUrl: setup.qrCodeDataUrl,
        otpauthUri: setup.otpauthUri,
        manualEntryKey: setup.secret
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/auth/mfa/confirm
 * Confirms MFA enrollment with valid TOTP and issues recovery codes.
 */
authRouter.post(
  '/mfa/confirm',
  requireAuth,
  requireEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = MfaConfirmEnrollSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { totpCode } = parseResult.data;
      const candidateSecret = (req.session as any).candidateMfaSecret;

      if (!candidateSecret) {
        return next(
          new AppError(
            400,
            'MFA setup session missing. Initiate setup first.',
            ErrorCode.VALIDATION_FAILED
          )
        );
      }

      if (!verifyTotpCode(totpCode, candidateSecret)) {
        return next(
          new AppError(
            400,
            'Invalid TOTP code. Enrollment not confirmed.',
            ErrorCode.VALIDATION_FAILED
          )
        );
      }

      const user = req.currentUser;
      const encryptedSecret = encryptAesGcm(candidateSecret);
      const recoveryCodes = generateRecoveryCodes(8);
      const hashedCodes = recoveryCodes.map(hashRecoveryCode);

      user.mfaEnabled = true;
      user.mfaSecretEncrypted = encryptedSecret;
      user.mfaRecoveryCodesHashed = hashedCodes;
      await user.save();

      delete (req.session as any).candidateMfaSecret;
      if (req.session.user) {
        req.session.user.mfaVerified = true;
      }

      await AuditService.recordEvent({
        actorId: user._id.toString(),
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.AUTH_MFA_ENROLLED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'mfa-confirmed',
        details: { recoveryCodesGeneratedCount: recoveryCodes.length }
      });

      return sendSuccess(req, res, {
        message: 'MFA enrolled successfully. Save your recovery codes in a secure location.',
        recoveryCodes
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/password-reset/request
 * Initiates single-use account recovery token.
 */
authRouter.post(
  '/password-reset/request',
  passwordResetRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = PasswordResetRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { email } = parseResult.data;
      const user = await User.findOne({ email });

      if (user && user.isActive) {
        // Invalidate existing unused tokens for this user
        await PasswordResetToken.updateMany({ userId: user._id, used: false }, { used: true });

        const rawToken = generateRandomToken(32);
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await PasswordResetToken.create({
          userId: user._id,
          tokenHash,
          expiresAt,
          used: false
        });

        // Capture in development/test store
        if (config.NODE_ENV !== 'production') {
          devTestTokens.lastPasswordResetToken = rawToken;
        }

        await AuditService.recordEvent({
          actorId: user._id.toString(),
          actorType: ActorType.EMPLOYEE,
          action: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
          outcome: AuditOutcome.SUCCESS,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'pwd-reset-req'
        });
      }

      // Generic anti-enumeration response
      return sendSuccess(req, res, {
        message: 'If an account matches that email, a password recovery link has been dispatched.'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/password-reset/confirm
 * Verifies recovery token, updates password, and revokes all active sessions.
 */
authRouter.post(
  '/password-reset/confirm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = PasswordResetConfirmSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const { token, newPassword } = parseResult.data;
      const tokenHash = hashToken(token);

      const resetRecord = await PasswordResetToken.findOne({
        tokenHash,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!resetRecord) {
        return next(
          new AppError(
            400,
            'Password recovery token is invalid or has expired.',
            ErrorCode.VALIDATION_FAILED
          )
        );
      }

      const user = await User.findById(resetRecord.userId);
      if (!user || !user.isActive) {
        return next(
          new AppError(
            400,
            'Account associated with token is not active.',
            ErrorCode.VALIDATION_FAILED
          )
        );
      }

      // Update password and increment sessionVersion for instant global session revocation
      user.passwordHash = await hashPassword(newPassword);
      user.sessionVersion += 1;
      await user.save();

      // Mark token as used
      resetRecord.used = true;
      resetRecord.usedAt = new Date();
      await resetRecord.save();

      await AuditService.recordEvent({
        actorId: user._id.toString(),
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.AUTH_PASSWORD_RESET_COMPLETED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'pwd-reset-complete',
        details: { newSessionVersion: user.sessionVersion }
      });

      return sendSuccess(req, res, {
        message:
          'Password reset successfully. All previous sessions have been invalidated. Please log in.'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/users/:id/deactivate
 * Deactivates an employee and revokes all their active sessions.
 */
authRouter.post(
  '/users/:id/deactivate',
  requireAuth,
  requireEmployee,
  requirePermission('user:deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id;
      const user = await User.findById(targetUserId);

      if (!user) {
        return next(AppError.notFound('Employee not found'));
      }

      user.isActive = false;
      user.sessionVersion += 1; // Instantly invalidates all sessions
      await user.save();

      await AuditService.recordEvent({
        actorId: req.session.user?.userId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.USER_DEACTIVATED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'deactivate-emp',
        targetEntity: 'User',
        targetId: user._id.toString(),
        details: { employeeCode: user.employeeCode, email: user.email }
      });

      return sendSuccess(req, res, {
        message: `Employee ${user.employeeCode} has been deactivated and all sessions revoked.`
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/auth/users/:id/privileges
 * Updates an employee's role, department, or custom permissions (Superadmin only).
 */
authRouter.patch(
  '/users/:id/privileges',
  requireAuth,
  requireEmployee,
  requireRole([UserRole.SUPERADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = UpdateUserPrivilegesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const targetUserId = req.params.id;
      const user = await User.findById(targetUserId);

      if (!user) {
        return next(AppError.notFound('Employee not found'));
      }

      const { role, department, permissions } = parseResult.data;
      if (role) user.role = role;
      if (department) user.department = department;
      if (permissions) user.permissions = permissions;

      user.sessionVersion += 1; // Invalidate session so new privileges are evaluated fresh
      await user.save();

      await AuditService.recordEvent({
        actorId: req.session.user?.userId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.USER_ROLES_MODIFIED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId || 'update-privileges',
        targetEntity: 'User',
        targetId: user._id.toString(),
        details: { newRole: user.role, newDepartment: user.department }
      });

      const userDto = user.toJSON();
      (userDto as any).permissions = user.getEffectivePermissions();

      return sendSuccess(req, res, {
        message: 'Privileges updated successfully.',
        user: userDto
      });
    } catch (err) {
      next(err);
    }
  }
);
