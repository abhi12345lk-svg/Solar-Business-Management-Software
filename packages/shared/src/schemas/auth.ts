import { z } from 'zod';
import { Department, UserRole } from '../types/enums.js';
import { PhoneSchema, EmailSchema } from './common.js';
import { ALL_PERMISSIONS } from '../types/auth.js';

/**
 * Employee Login Schema
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters'),
  totpCode: z
    .string()
    .regex(/^\d{6}$/, 'TOTP code must be a 6-digit number')
    .optional(),
  recoveryCode: z
    .string()
    .regex(/^[A-Za-z0-9]{10}$/, 'Recovery code must be 10 alphanumeric characters')
    .optional()
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * MFA Challenge Verification Schema (when logging in with MFA)
 */
export const MfaLoginChallengeSchema = z
  .object({
    userId: z.string().min(1, 'User identifier is required'),
    challengeToken: z.string().min(16, 'Invalid MFA challenge token'),
    totpCode: z
      .string()
      .regex(/^\d{6}$/, 'TOTP code must be a 6-digit number')
      .optional(),
    recoveryCode: z
      .string()
      .regex(/^[A-Za-z0-9]{10}$/, 'Recovery code must be 10 alphanumeric characters')
      .optional()
  })
  .refine(data => data.totpCode || data.recoveryCode, {
    message: 'Either totpCode or recoveryCode must be provided',
    path: ['totpCode']
  });

export type MfaLoginChallengeInput = z.infer<typeof MfaLoginChallengeSchema>;

/**
 * MFA Enrollment Confirmation Schema
 */
export const MfaConfirmEnrollSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'TOTP code must be a 6-digit number')
});

export type MfaConfirmEnrollInput = z.infer<typeof MfaConfirmEnrollSchema>;

/**
 * Password Reset Request Schema
 */
export const PasswordResetRequestSchema = z.object({
  email: EmailSchema
});

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

/**
 * Password Reset Confirmation Schema
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(32, 'Invalid or malformed reset token'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
});

export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

/**
 * Customer Magic Link Request Schema
 */
export const CustomerMagicLinkRequestSchema = z.object({
  identifier: z.string().trim().min(3, 'Email or Phone is required').max(100, 'Identifier too long')
});

export type CustomerMagicLinkRequestInput = z.infer<typeof CustomerMagicLinkRequestSchema>;

/**
 * Customer Magic Link Verification Schema
 */
export const CustomerMagicLinkVerifySchema = z.object({
  token: z.string().min(32, 'Invalid or malformed access token')
});

export type CustomerMagicLinkVerifyInput = z.infer<typeof CustomerMagicLinkVerifySchema>;

/**
 * Customer OTP Request Schema
 */
export const CustomerOtpRequestSchema = z.object({
  phone: PhoneSchema
});

export type CustomerOtpRequestInput = z.infer<typeof CustomerOtpRequestSchema>;

/**
 * Customer OTP Verification Schema
 */
export const CustomerOtpVerifySchema = z.object({
  phone: PhoneSchema,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit number')
});

export type CustomerOtpVerifyInput = z.infer<typeof CustomerOtpVerifySchema>;

/**
 * User Creation Schema (for Admin creation of employees)
 */
export const CreateUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: EmailSchema,
  phone: PhoneSchema,
  department: z.nativeEnum(Department),
  role: z.nativeEnum(UserRole),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  password: z.string().min(10, 'Initial password must be at least 10 characters long').max(128)
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * User Role and Permissions Update Schema
 */
export const UpdateUserPrivilegesSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  department: z.nativeEnum(Department).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional()
});

export type UpdateUserPrivilegesInput = z.infer<typeof UpdateUserPrivilegesSchema>;
