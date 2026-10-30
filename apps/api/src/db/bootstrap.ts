import mongoose from 'mongoose';
import { User, Lead } from '../models/index.js';
import {
  UserRole,
  Department,
  LeadStatus,
  LeadSource,
  LeadPriority,
  SolarRequirement,
  SequenceEntityType
} from '@ins-solar/shared';
import { SequenceService } from '../services/sequenceService.js';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures initial default workstation users and sample records exist in MongoDB upon fresh connection.
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

    // Seed initial operational leads if database collection is brand new
    const leadCount = await Lead.countDocuments();
    if (leadCount === 0) {
      await Lead.create([
        {
          leadCode: 'LEAD-2026-00001',
          prospectName: 'Amit Verma',
          prospectPhone: '+919829111222',
          prospectEmail: 'amit.verma@example.com',
          location: {
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302020',
            street: '12, Malviya Nagar'
          },
          source: LeadSource.WEBSITE,
          solarRequirement: SolarRequirement.RESIDENTIAL,
          estimatedCapacityKw: 5,
          status: LeadStatus.SURVEY_SCHEDULED,
          priority: LeadPriority.HIGH,
          notes: 'Interested in 5kW rooftop solar under PM Surya Ghar Yojana.',
          isActive: true
        },
        {
          leadCode: 'LEAD-2026-00002',
          prospectName: 'SunTech Garments Pvt Ltd',
          prospectPhone: '+919829333444',
          prospectEmail: 'procurement@suntechgarments.com',
          companyName: 'SunTech Garments Pvt Ltd',
          location: {
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302013',
            street: 'Sitapura Industrial Area'
          },
          source: LeadSource.COLD_CALL,
          solarRequirement: SolarRequirement.COMMERCIAL,
          estimatedCapacityKw: 25,
          status: LeadStatus.CONTACTED,
          priority: LeadPriority.HIGH,
          notes: 'Factory rooftop solar setup (25 kWp grid-tied).',
          isActive: true
        },
        {
          leadCode: 'LEAD-2026-00003',
          prospectName: 'Dr. Sunita Rao',
          prospectPhone: '+919829555666',
          prospectEmail: 'dr.sunita@example.com',
          location: {
            city: 'Jaipur',
            state: 'Rajasthan',
            pinCode: '302004',
            street: 'Raja Park'
          },
          source: LeadSource.REFERRAL,
          solarRequirement: SolarRequirement.RESIDENTIAL,
          estimatedCapacityKw: 3,
          status: LeadStatus.NEW,
          priority: LeadPriority.MEDIUM,
          notes: 'Residential solar inquiry for 3 kWp system.',
          isActive: true
        },
        {
          leadCode: 'LEAD-2026-00004',
          prospectName: 'Raju Thakur',
          prospectPhone: '+916263316835',
          prospectEmail: 'abhi12345lk@gmail.com',
          location: {
            city: 'dhamtari',
            state: 'Rajasthan',
            pinCode: '493773'
          },
          source: LeadSource.WEBSITE,
          solarRequirement: SolarRequirement.INDUSTRIAL,
          estimatedCapacityKw: 5,
          status: LeadStatus.CONTACTED,
          priority: LeadPriority.MEDIUM,
          notes: 'Industrial solar inquiry.',
          isActive: true
        }
      ]);

      await SequenceService.ensureCounterAtLeast(SequenceEntityType.LEAD, 4);
      logger.info('Initialized initial enterprise leads into new database.');
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Non-fatal notice during initial database bootstrap.');
  }
}
