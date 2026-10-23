import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapAdmin } from '../scripts/bootstrap-admin.js';
import { User } from '../models/User.js';
import { dbManager } from '../db/connection.js';
import { UserRole } from '@ins-solar/shared';
import mongoose from 'mongoose';

describe('Administrator Bootstrap Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbManager, 'connect').mockResolvedValue('unconfigured' as any);
  });

  it('rejects passwords failing complexity rules (<12 chars or missing character classes)', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    // Too short
    await expect(
      bootstrapAdmin({
        email: 'admin@inssolar.com',
        password: 'Short1!'
      })
    ).rejects.toThrow(/Password complexity requirement failed/i);

    // Missing special character
    await expect(
      bootstrapAdmin({
        email: 'admin@inssolar.com',
        password: 'Password1234567'
      })
    ).rejects.toThrow(/Password complexity requirement failed/i);
  });

  it('creates first Superadmin successfully when no active superadmin exists', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(User, 'create').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0001',
      email: 'admin@inssolar.com',
      role: UserRole.SUPERADMIN
    } as any);

    const result = await bootstrapAdmin({
      email: 'admin@inssolar.com',
      password: 'SuperAdminPassword2026!',
      firstName: 'Chief',
      lastName: 'Operator',
      phone: '+919876500000'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('EMP-0001');
    expect(createSpy).toHaveBeenCalledTimes(1);

    const createPayload = createSpy.mock.calls[0]![0] as any;
    expect(createPayload.role).toBe(UserRole.SUPERADMIN);
    expect(createPayload.employeeCode).toBe('EMP-0001');
    // Ensure plaintext password is NEVER stored
    expect(createPayload.password).toBeUndefined();
    expect(createPayload.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('cannot be repeated once an active Superadmin exists', async () => {
    // Existing active Superadmin in database
    vi.spyOn(User, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      role: UserRole.SUPERADMIN,
      isActive: true
    } as any);

    const createSpy = vi.spyOn(User, 'create');

    const result = await bootstrapAdmin({
      email: 'second_admin@inssolar.com',
      password: 'AnotherPassword2026!'
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Bootstrap aborted: An active Superadmin already exists/i);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
