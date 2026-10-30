import { dbManager } from '../db/connection.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/crypto.js';
import { Department, UserRole } from '@ins-solar/shared';
import { logger } from '../utils/logger.js';

export async function seedWorkstationUsers(): Promise<void> {
  await dbManager.connect();

  try {
    // 1. Admin / Superadministrator
    const adminExists = await User.findOne({ email: 'admin@inssolar.com' });
    const adminPassHash = await hashPassword('SolarAdmin2026!');
    if (!adminExists) {
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
      logger.info('Created default Super Administrator (admin@inssolar.com).');
    } else {
      adminExists.passwordHash = adminPassHash;
      await adminExists.save();
      logger.info('Verified Super Administrator (admin@inssolar.com).');
    }

    // 2. Sales Executive
    const salesExists = await User.findOne({ email: 'sales@inssolar.com' });
    const salesPassHash = await hashPassword('SolarSales2026!');
    if (!salesExists) {
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
      logger.info('Created default Sales Executive (sales@inssolar.com).');
    } else {
      salesExists.passwordHash = salesPassHash;
      await salesExists.save();
      logger.info('Verified Sales Executive (sales@inssolar.com).');
    }

    // 3. Accounts Officer
    const accountsExists = await User.findOne({ email: 'accounts@inssolar.com' });
    const accountsPassHash = await hashPassword('SolarAccounts2026!');
    if (!accountsExists) {
      await User.create({
        employeeCode: 'EMP-0003',
        firstName: 'Priya',
        lastName: 'Verma',
        email: 'accounts@inssolar.com',
        phone: '+919876500002',
        passwordHash: accountsPassHash,
        department: Department.ACCOUNTS,
        role: UserRole.ACCOUNTS_OFFICER,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Created default Accounts Officer (accounts@inssolar.com).');
    } else {
      accountsExists.passwordHash = accountsPassHash;
      await accountsExists.save();
      logger.info('Verified Accounts Officer (accounts@inssolar.com).');
    }

    logger.info('All 3 Panel Workstation Accounts verified in Atlas MongoDB successfully.');
  } finally {
    await dbManager.disconnect();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed-workstation-users.ts')) {
  seedWorkstationUsers()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err: err?.message }, 'Failed to seed workstation users');
      process.exit(1);
    });
}
