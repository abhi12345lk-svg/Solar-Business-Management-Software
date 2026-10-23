import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  PasswordResetConfirmSchema,
  MfaLoginChallengeSchema,
  CustomerMagicLinkRequestSchema,
  CustomerOtpVerifySchema
} from '../schemas/auth.js';
import { ROLE_DEFAULT_PERMISSIONS, PRIVILEGED_ROLES } from '../types/auth.js';
import { UserRole } from '../types/enums.js';

describe('Shared Auth Schemas & Role Policies', () => {
  describe('LoginSchema', () => {
    it('accepts valid credentials with lowercase normalized email', () => {
      const parsed = LoginSchema.parse({
        email: 'Admin@inssolar.com',
        password: 'SecurePassword123!'
      });
      expect(parsed.email).toBe('admin@inssolar.com');
      expect(parsed.password).toBe('SecurePassword123!');
    });

    it('rejects short passwords (< 8 characters)', () => {
      expect(() =>
        LoginSchema.parse({
          email: 'admin@inssolar.com',
          password: 'short'
        })
      ).toThrow();
    });

    it('accepts optional 6-digit TOTP code and 10-char recovery code', () => {
      const withTotp = LoginSchema.parse({
        email: 'admin@inssolar.com',
        password: 'SecurePassword123!',
        totpCode: '123456'
      });
      expect(withTotp.totpCode).toBe('123456');

      const withRecovery = LoginSchema.parse({
        email: 'admin@inssolar.com',
        password: 'SecurePassword123!',
        recoveryCode: 'AB12CD34EF'
      });
      expect(withRecovery.recoveryCode).toBe('AB12CD34EF');
    });
  });

  describe('PasswordResetConfirmSchema', () => {
    it('validates robust password complexity', () => {
      const valid = PasswordResetConfirmSchema.parse({
        token: 'a'.repeat(32),
        newPassword: 'StrongPassword1!'
      });
      expect(valid.newPassword).toBe('StrongPassword1!');
    });

    it('rejects passwords missing digits or special chars', () => {
      expect(() =>
        PasswordResetConfirmSchema.parse({
          token: 'a'.repeat(32),
          newPassword: 'NoSpecialOrDigit'
        })
      ).toThrow();
    });
  });

  describe('MfaLoginChallengeSchema', () => {
    it('requires either totpCode or recoveryCode', () => {
      expect(() =>
        MfaLoginChallengeSchema.parse({
          userId: 'user-123',
          challengeToken: 'tok-1234567890123456'
        })
      ).toThrow();

      const validTotp = MfaLoginChallengeSchema.parse({
        userId: 'user-123',
        challengeToken: 'tok-1234567890123456',
        totpCode: '654321'
      });
      expect(validTotp.totpCode).toBe('654321');
    });
  });

  describe('Customer Auth Schemas', () => {
    it('accepts customer magic link request with identifier', () => {
      const parsed = CustomerMagicLinkRequestSchema.parse({
        identifier: 'customer@example.com'
      });
      expect(parsed.identifier).toBe('customer@example.com');
    });

    it('validates customer OTP format and E.164 phone', () => {
      const parsed = CustomerOtpVerifySchema.parse({
        phone: '+919876543210',
        otp: '654321'
      });
      expect(parsed.phone).toBe('+919876543210');
      expect(parsed.otp).toBe('654321');
    });
  });

  describe('Role-Based Default Permissions & Privileged Roles', () => {
    it('assigns Superadmin all permissions', () => {
      expect(ROLE_DEFAULT_PERMISSIONS[UserRole.SUPERADMIN].length).toBeGreaterThan(20);
    });

    it('marks Superadmin, Admin, and Accounts Officer as privileged roles requiring MFA', () => {
      expect(PRIVILEGED_ROLES).toContain(UserRole.SUPERADMIN);
      expect(PRIVILEGED_ROLES).toContain(UserRole.ADMIN);
      expect(PRIVILEGED_ROLES).toContain(UserRole.ACCOUNTS_OFFICER);
      expect(PRIVILEGED_ROLES).not.toContain(UserRole.CUSTOMER);
    });
  });
});
