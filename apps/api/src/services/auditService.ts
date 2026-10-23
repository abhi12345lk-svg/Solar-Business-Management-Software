import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { SecurityAuditLog, ISecurityAuditLogDocument } from '../models/SecurityAuditLog.js';
import { ActorType, AuditAction, AuditOutcome } from '@ins-solar/shared';
import { logger } from '../utils/logger.js';

export interface LogSecurityEventParams {
  actorId?: string;
  actorType: ActorType;
  action: AuditAction | string;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  targetEntity?: string;
  targetId?: string;
  details?: Record<string, any>;
}

const REDACTED_KEYS = new Set([
  'password',
  'newPassword',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'totpCode',
  'recoveryCode',
  'otp',
  'otpHash',
  'challengeToken',
  'mfaSecretEncrypted',
  'mfaRecoveryCodesHashed'
]);

/**
 * Recursively redacts sensitive security fields from audit metadata.
 */
function sanitizeAuditDetails(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeAuditDetails);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeAuditDetails(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class AuditService {
  /**
   * Appends an immutable security audit event record.
   */
  public static async recordEvent(
    params: LogSecurityEventParams
  ): Promise<ISecurityAuditLogDocument | null> {
    const eventId = crypto.randomUUID();
    const cleanDetails = params.details ? sanitizeAuditDetails(params.details) : undefined;

    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    try {
      const doc = await SecurityAuditLog.create({
        eventId,
        timestamp: new Date(),
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        outcome: params.outcome,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        correlationId: params.correlationId,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        details: cleanDetails
      });

      return doc;
    } catch (err: any) {
      // Do not crash the caller if database audit logging fails, but log a high-priority operational error
      logger.error(
        {
          err: err?.message,
          eventId,
          action: params.action,
          correlationId: params.correlationId
        },
        'Failed to record security audit log event.'
      );
      return null;
    }
  }
}
