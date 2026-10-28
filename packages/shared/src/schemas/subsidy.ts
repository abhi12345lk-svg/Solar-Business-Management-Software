/**
 * INS Solar Business Management Software — Subsidy Tracking Schemas
 */

import { z } from 'zod';
import { SubsidyScheme, SubsidyStatus, DisbursementMode } from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const disbursementSchema = z.object({
  disbursementId: z.string().trim().min(1),
  disbursementReference: z
    .string()
    .trim()
    .min(2, 'Disbursement reference / UTR is required')
    .max(100),
  amountPaise: z.number().int().positive('Disbursement amount must be a positive integer in paise'),
  disbursedAt: z.coerce.date(),
  paymentMode: z.nativeEnum(DisbursementMode).default(DisbursementMode.DIRECT_BENEFIT_TRANSFER),
  recipientAccount: z.string().trim().min(2, 'Recipient account details required').max(100),
  idempotencyKey: z.string().trim().min(3, 'Idempotency key is required').max(100),
  recordedBy: z.string().regex(OBJECT_ID_REGEX),
  notes: z.string().trim().max(1000).optional()
});

export const createSubsidySchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Project ID'),
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Customer ID').optional(),
  netMeteringApplicationId: z
    .string()
    .regex(OBJECT_ID_REGEX, 'Invalid Net Metering Application ID')
    .optional(),
  schemeName: z.union([z.nativeEnum(SubsidyScheme), z.string().trim().min(2).max(100)]),
  schemeVersion: z.string().trim().max(50).optional(),
  effectivePeriod: z.string().trim().max(50).optional(),
  portalApplicationNumber: z.string().trim().max(100).optional(),
  submissionDate: z.coerce.date().optional(),
  systemCapacityKw: z.number().positive('System capacity must be greater than 0').max(10000),
  estimatedAmountPaise: z
    .number()
    .int()
    .nonnegative('Estimated amount must be non-negative integer paise'),
  requestedAmountPaise: z
    .number()
    .int()
    .nonnegative('Requested amount must be non-negative integer paise'),
  assignedUserId: z.string().regex(OBJECT_ID_REGEX).optional(),
  notes: z.string().trim().max(2000).optional()
});

export const updateSubsidySchema = z.object({
  schemeName: z.union([z.nativeEnum(SubsidyScheme), z.string().trim().min(2).max(100)]).optional(),
  schemeVersion: z.string().trim().max(50).optional(),
  effectivePeriod: z.string().trim().max(50).optional(),
  portalApplicationNumber: z.string().trim().max(100).optional(),
  submissionDate: z.coerce.date().optional(),
  systemCapacityKw: z.number().positive().max(10000).optional(),
  estimatedAmountPaise: z.number().int().nonnegative().optional(),
  requestedAmountPaise: z.number().int().nonnegative().optional(),
  assignedUserId: z.string().regex(OBJECT_ID_REGEX).optional().nullable(),
  eligibilityVerified: z.boolean().optional(),
  eligibilityNotes: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional()
});

export const updateSubsidyStatusSchema = z.object({
  status: z.nativeEnum(SubsidyStatus),
  rejectionReason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const recordSanctionSchema = z.object({
  sanctionReference: z.string().trim().min(2, 'Sanction reference is required').max(100),
  sanctionDate: z.coerce.date(),
  approvedAmountPaise: z.number().int().positive('Approved amount must be positive integer paise'),
  notes: z.string().trim().max(1000).optional()
});

export const recordDisbursementSchema = z.object({
  disbursementReference: z
    .string()
    .trim()
    .min(2, 'Disbursement reference / UTR is required')
    .max(100),
  amountPaise: z.number().int().positive('Disbursement amount must be positive integer paise'),
  disbursedAt: z.coerce.date().default(() => new Date()),
  paymentMode: z.nativeEnum(DisbursementMode).default(DisbursementMode.DIRECT_BENEFIT_TRANSFER),
  recipientAccount: z.string().trim().min(2, 'Recipient account details required').max(100),
  idempotencyKey: z
    .string()
    .trim()
    .min(3, 'Idempotency key required for safe disbursement')
    .max(100),
  notes: z.string().trim().max(1000).optional()
});

export const subsidyFilterSchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(SubsidyStatus).optional(),
  schemeName: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'applicationNumber', 'submissionDate', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type DisbursementInput = z.input<typeof disbursementSchema>;
export type DisbursementParsed = z.infer<typeof disbursementSchema>;

export type CreateSubsidyInput = z.input<typeof createSubsidySchema>;
export type CreateSubsidyParsed = z.infer<typeof createSubsidySchema>;

export type UpdateSubsidyInput = z.input<typeof updateSubsidySchema>;
export type UpdateSubsidyParsed = z.infer<typeof updateSubsidySchema>;

export type UpdateSubsidyStatusInput = z.input<typeof updateSubsidyStatusSchema>;
export type UpdateSubsidyStatusParsed = z.infer<typeof updateSubsidyStatusSchema>;

export type RecordSanctionInput = z.input<typeof recordSanctionSchema>;
export type RecordSanctionParsed = z.infer<typeof recordSanctionSchema>;

export type RecordDisbursementInput = z.input<typeof recordDisbursementSchema>;
export type RecordDisbursementParsed = z.infer<typeof recordDisbursementSchema>;

export type SubsidyFilterInput = z.input<typeof subsidyFilterSchema>;
export type SubsidyFilterParsed = z.infer<typeof subsidyFilterSchema>;
