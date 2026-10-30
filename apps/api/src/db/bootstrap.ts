import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { UserRole, Department } from '@ins-solar/shared';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures initial default workstation users exist in MongoDB upon fresh connection.
 * Idempotent and concurrency-safe.
 */
export async function bootstrapDefaultUsers(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const adminExists = await User.exists({ email: 'admin@inssolar.com' });
    if (!adminExists) {
      const adminPassHash = await hashPassword('SolarAdmin2026!');
      await User.create({
        employeeCode: 'EMP-0001',
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@inssolar.com',
        phone: '+919876500000',
        passwordHash: adminPassHash,
        department: Department.ADMIN,
        role: UserRole.SUPERADMIN,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Initialized default Super Administrator (admin@inssolar.com).');
    }

    const salesExists = await User.exists({ email: 'sales@inssolar.com' });
    if (!salesExists) {
      const salesPassHash = await hashPassword('SolarSales2026!');
      await User.create({
        employeeCode: 'EMP-0002',
        firstName: 'Rajesh',
        lastName: 'Sharma',
        email: 'sales@inssolar.com',
        phone: '+919876500001',
        passwordHash: salesPassHash,
        department: Department.SALES,
        role: UserRole.SALES_EXECUTIVE,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Initialized default Sales Executive (sales@inssolar.com).');
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Non-fatal notice during initial user bootstrap.');
  }
}
