import { dbManager } from '../db/connection.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/crypto.js';
import { Department, UserRole, ActorType, AuditAction, AuditOutcome } from '@ins-solar/shared';
import { AuditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

interface BootstrapConfig {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export async function bootstrapAdmin(
  params?: BootstrapConfig
): Promise<{ success: boolean; message: string }> {
  await dbManager.connect();

  try {
    // 1. One-time check: Ensure no SUPERADMIN exists
    const existingSuperadmin = await User.findOne({ role: UserRole.SUPERADMIN, isActive: true });
    if (existingSuperadmin) {
      const msg = 'Bootstrap aborted: An active Superadmin already exists in the system.';
      logger.warn(msg);
      return { success: false, message: msg };
    }

    // 2. Resolve credentials from parameters or environment
    const email = (params?.email || process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = params?.password || process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    const firstName = (
      params?.firstName ||
      process.env.BOOTSTRAP_ADMIN_FIRSTNAME ||
      'System'
    ).trim();
    const lastName = (
      params?.lastName ||
      process.env.BOOTSTRAP_ADMIN_LASTNAME ||
      'Administrator'
    ).trim();
    const phone = (params?.phone || process.env.BOOTSTRAP_ADMIN_PHONE || '+919876500000').trim();

    if (!email || !password) {
      throw new Error(
        'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be provided via environment variables or CLI parameters.'
      );
    }

    // 3. Enforce strict password complexity
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      throw new Error(
        'Password complexity requirement failed: Must be at least 12 characters and contain uppercase, lowercase, digit, and special symbol.'
      );
    }

    // 4. Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // 5. Create the first Superadmin record
    const adminUser = await User.create({
      employeeCode: 'EMP-0001',
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      department: Department.ADMIN,
      role: UserRole.SUPERADMIN,
      permissions: [],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1
    });

    // 6. Record security audit log
    await AuditService.recordEvent({
      actorId: adminUser._id.toString(),
      actorType: ActorType.SYSTEM,
      action: AuditAction.USER_CREATED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: 'bootstrap-initialization',
      targetEntity: 'User',
      targetId: adminUser._id.toString(),
      details: {
        operation: 'FIRST_ADMINISTRATOR_BOOTSTRAP',
        employeeCode: adminUser.employeeCode,
        role: adminUser.role
      }
    });

    const successMsg = `Bootstrap success: Superadmin ${adminUser.employeeCode} (${email}) initialized. Log in and enroll MFA immediately.`;
    logger.info(successMsg);
    return { success: true, message: successMsg };
  } finally {
    // Only disconnect if running directly as a script
    if (process.argv[1]?.includes('bootstrap-admin')) {
      await dbManager.disconnect();
    }
  }
}

// Auto-run if executed directly via node/tsx
if (process.argv[1]?.includes('bootstrap-admin')) {
  bootstrapAdmin()
    .then(result => {
      console.info(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Bootstrap failed:', err.message);
      process.exit(1);
    });
}
