import { RequestHandler, Request } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import {
  ErrorCode,
  UserRole,
  Permission,
  PRIVILEGED_ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { AuditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

// Extend Express Request with loaded user document if needed
declare global {
  namespace Express {
    interface Request {
      currentUser?: any;
    }
  }
}

/**
 * 1. Require Authentication:
 * Validates that an active session exists (either employee or customer).
 * For employees, checks the database to verify the account has not been deactivated
 * and the sessionVersion matches (instant global revocation on password reset or deactivation).
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const sessionUser = req.session?.user;
  const sessionCustomer = req.session?.customer;

  if (!sessionUser && !sessionCustomer) {
    return next(
      new AppError(
        401,
        'Authentication required to access this resource.',
        ErrorCode.AUTHENTICATION_REQUIRED
      )
    );
  }

  // If employee session, verify active status in database
  if (sessionUser) {
    if (process.env.NODE_ENV !== 'test' && mongoose.connection.readyState !== 1) {
      // Standalone preview mode: trust valid session user when database is unconfigured
      return next();
    }
    try {
      const user = await User.findById(sessionUser.userId);
      if (!user) {
        req.session.destroy(() => {});
        return next(
          new AppError(
            401,
            'Account no longer exists. Session terminated.',
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      if (!user.isActive) {
        req.session.destroy(() => {});
        await AuditService.recordEvent({
          actorId: sessionUser.userId,
          actorType: ActorType.EMPLOYEE,
          action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
          outcome: AuditOutcome.DENIED,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: (req as any).correlationId || 'auth-check',
          details: { reason: 'Deactivated employee attempted access' }
        });
        return next(
          new AppError(
            401,
            'Account is deactivated. Access revoked.',
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      // Check session version to support instant global revocation
      if (user.sessionVersion !== sessionUser.sessionVersion) {
        req.session.destroy(() => {});
        return next(
          new AppError(
            401,
            'Session has been revoked due to security changes. Please log in again.',
            ErrorCode.AUTHENTICATION_REQUIRED
          )
        );
      }

      req.currentUser = user;
    } catch (err) {
      logger.error({ err }, 'Error checking user active status in requireAuth');
      return next(
        new AppError(
          500,
          'Error validating authentication session.',
          ErrorCode.INTERNAL_SERVER_ERROR
        )
      );
    }
  }

  next();
};

/**
 * 2. Require Employee:
 * Ensures the session belongs to an internal employee (not an external customer).
 */
export const requireEmployee: RequestHandler = (req, _res, next) => {
  if (!req.session?.user) {
    return next(
      new AppError(
        403,
        'Access restricted to internal employees only.',
        ErrorCode.PERMISSION_DENIED
      )
    );
  }
  next();
};

/**
 * 3. Require Customer:
 * Ensures the session belongs to a customer portal user.
 */
export const requireCustomer: RequestHandler = (req, _res, next) => {
  if (!req.session?.customer) {
    return next(
      new AppError(
        403,
        'Access restricted to customer portal users only.',
        ErrorCode.PERMISSION_DENIED
      )
    );
  }
  next();
};

/**
 * 4. Require MFA:
 * If an employee belongs to a privileged role (or has mfaEnabled),
 * enforces that req.session.user.mfaVerified is true.
 */
export const requireMfa: RequestHandler = (req, _res, next) => {
  const user = req.session?.user;
  if (!user) {
    return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
  }

  const isPrivileged = PRIVILEGED_ROLES.includes(user.role);
  if (isPrivileged || req.currentUser?.mfaEnabled) {
    if (!user.mfaVerified) {
      return next(
        new AppError(
          403,
          'Multi-Factor Authentication (MFA) verification required for this privileged action.',
          ErrorCode.PERMISSION_DENIED
        )
      );
    }
  }

  next();
};

/**
 * 5. Require Role:
 * Restricts access to one or more specific roles.
 */
export function requireRole(allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
    }

    if (user.role === UserRole.SUPERADMIN || allowedRoles.includes(user.role)) {
      return next();
    }

    return next(
      new AppError(
        403,
        `Role '${user.role}' is not authorized to perform this action.`,
        ErrorCode.PERMISSION_DENIED
      )
    );
  };
}

/**
 * 6. Require Permission:
 * Evaluates whether the user's role-based and custom permissions contain the required permission token.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
    }

    // Superadmin bypasses permission checks
    if (user.role === UserRole.SUPERADMIN) {
      return next();
    }

    // Get effective permissions from cached user document or session
    const effectivePermissions: Permission[] = req.currentUser
      ? req.currentUser.getEffectivePermissions()
      : [
          ...(ROLE_DEFAULT_PERMISSIONS[user.role] || []),
          ...(((user as any).permissions as Permission[]) || [])
        ];

    if (effectivePermissions.includes(permission)) {
      return next();
    }

    return next(
      new AppError(
        403,
        `Missing required permission: '${permission}'.`,
        ErrorCode.PERMISSION_DENIED
      )
    );
  };
}

/**
 * 7. Require Department Supervisory Scope:
 * Department Heads may only view or authorize records that belong to their department.
 * Superadmin and Admin bypass this check.
 */
export function requireDepartmentScope(
  getDepartmentFromRequest: (req: Request) => string | undefined
): RequestHandler {
  return (req, _res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
    }

    // Superadmin and Admin have global cross-department access
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      return next();
    }

    const targetDepartment = getDepartmentFromRequest(req);
    if (!targetDepartment) {
      return next(
        new AppError(
          400,
          'Unable to determine target department for authorization.',
          ErrorCode.VALIDATION_FAILED
        )
      );
    }

    if (user.role === UserRole.DEPARTMENT_HEAD) {
      if (user.department === targetDepartment) {
        return next();
      }
      return next(
        new AppError(
          403,
          `Supervisory access denied: You are Department Head of ${user.department}, not ${targetDepartment}.`,
          ErrorCode.PERMISSION_DENIED
        )
      );
    }

    return next(
      new AppError(403, 'Supervisory department authority required.', ErrorCode.PERMISSION_DENIED)
    );
  };
}

/**
 * 8. Anti-Self-Approval Enforcement:
 * Prevents employees from approving their own discount requests, expenses, or quotations.
 */
export function checkAntiSelfApproval(
  getRecordOwnerId: (req: Request) => string | undefined
): RequestHandler {
  return (req, _res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
    }

    const recordOwnerId = getRecordOwnerId(req);
    if (!recordOwnerId) {
      return next();
    }

    if (user.userId === recordOwnerId) {
      return next(
        new AppError(
          403,
          'Anti-Self-Approval Violation: You cannot approve your own submission.',
          ErrorCode.PERMISSION_DENIED
        )
      );
    }

    next();
  };
}

/**
 * 9. Customer Ownership Enforcement:
 * Customer portal data isolation: ensures the requested resource matches req.session.customer.customerId.
 * Never trust customerId provided in the request body, headers, or query parameters.
 */
export function requireCustomerOwnership(
  getRecordCustomerId: (req: Request) => string | undefined
): RequestHandler {
  return (req, _res, next) => {
    const customer = req.session?.customer;
    if (!customer) {
      return next(
        new AppError(403, 'Customer authentication required.', ErrorCode.PERMISSION_DENIED)
      );
    }

    const recordCustomerId = getRecordCustomerId(req);
    if (!recordCustomerId) {
      return next(
        new AppError(
          400,
          'Target customer identity cannot be determined.',
          ErrorCode.VALIDATION_FAILED
        )
      );
    }

    if (customer.customerId !== recordCustomerId) {
      return next(
        new AppError(
          403,
          "Access denied: You cannot view or modify another customer's resources.",
          ErrorCode.PERMISSION_DENIED
        )
      );
    }

    next();
  };
}
