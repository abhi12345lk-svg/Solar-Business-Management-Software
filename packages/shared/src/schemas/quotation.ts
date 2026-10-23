/**
 * INS Solar Business Management Software — Quotation & Proposal Schemas
 *
 * Implements strict integer paise financial calculations, multi-revision tracking,
 * configurable GST tax profiles, and discount approval validation.
 */

import { z } from 'zod';
import { QuotationStatus, QuotationItemType, SolarTopology } from '../types/enums.js';
import { MoneyPaiseSchema } from './money.js';

export const TAX_DISCLAIMER_TEXT =
  'Commercial quotation estimate only. This document is not a tax invoice under Section 31 of the CGST Act. Applicable GST classifications and split treatment must be formally verified by Company CA prior to final project invoicing.';

// ----------------------------------------------------------------------------
// Line Item Schemas
// ----------------------------------------------------------------------------

export const QuotationLineItemInputSchema = z.object({
  itemType: z.nativeEnum(QuotationItemType),
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format.')
    .optional(),
  sku: z.string().trim().max(50).optional(),
  description: z
    .string({ required_error: 'Item description is required.' })
    .trim()
    .min(2, 'Description must be at least 2 characters.')
    .max(250, 'Description cannot exceed 250 characters.'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a positive number.' })
    .positive('Quantity must be greater than zero.')
    .max(100000, 'Quantity exceeds permitted upper threshold.'),
  unit: z
    .string({ required_error: 'Unit of measurement is required.' })
    .trim()
    .min(1)
    .max(20)
    .default('NOS'),
  unitRatePaise: MoneyPaiseSchema,
  discountPaise: MoneyPaiseSchema.default(0),
  gstRateBasisPoints: z
    .number({ invalid_type_error: 'GST rate basis points must be an integer.' })
    .int('GST rate basis points must be an integer.')
    .min(0, 'GST rate cannot be negative.')
    .max(4000, 'GST rate cannot exceed 40% (4000 basis points).')
    .default(1800) // Default 18% GST (1800 bps)
});

export type QuotationLineItemInput = z.infer<typeof QuotationLineItemInputSchema>;

export const QuotationLineItemComputedSchema = QuotationLineItemInputSchema.extend({
  taxableAmountPaise: MoneyPaiseSchema,
  cgstRateBasisPoints: z.number().int().min(0).default(0),
  cgstAmountPaise: MoneyPaiseSchema.default(0),
  sgstRateBasisPoints: z.number().int().min(0).default(0),
  sgstAmountPaise: MoneyPaiseSchema.default(0),
  igstRateBasisPoints: z.number().int().min(0).default(0),
  igstAmountPaise: MoneyPaiseSchema.default(0),
  totalTaxAmountPaise: MoneyPaiseSchema,
  totalAmountPaise: MoneyPaiseSchema
});

export type QuotationLineItemComputed = z.infer<typeof QuotationLineItemComputedSchema>;

// ----------------------------------------------------------------------------
// Tax Profile & Milestone Schemas
// ----------------------------------------------------------------------------

export const TaxProfileSnapshotSchema = z.object({
  profileCode: z.string().trim().min(2).max(50).default('STD_SOLAR_GST_18'),
  profileName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .default('Standard Solar GST 18% (Intra-State CGST+SGST)'),
  isInterState: z.boolean().default(false),
  effectiveDate: z.string().default(() => new Date().toISOString()),
  accountingNotice: z.string().default(TAX_DISCLAIMER_TEXT)
});

export type TaxProfileSnapshot = z.infer<typeof TaxProfileSnapshotSchema>;

export const PaymentMilestoneSchema = z.object({
  milestoneName: z.string().trim().min(2).max(100),
  percentage: z.number().min(0).max(100),
  dueTrigger: z.string().trim().max(200).optional()
});

export type PaymentMilestone = z.infer<typeof PaymentMilestoneSchema>;

// ----------------------------------------------------------------------------
// Quotation Creation & Modification DTOs
// ----------------------------------------------------------------------------

export const CreateQuotationInputSchema = z.object({
  customerId: z
    .string({ required_error: 'Target customer ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Customer ID format.'),
  leadId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Lead ID format.')
    .optional(),
  solarDesignId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Solar Design ID format.')
    .optional(),
  systemTopology: z.nativeEnum(SolarTopology),
  systemCapacityKwp: z
    .number({ invalid_type_error: 'System capacity must be a number in kWp.' })
    .positive('System capacity must be greater than 0 kWp.')
    .max(10000),
  validUntil: z.string().datetime({ offset: true }).or(z.date()).optional(),
  taxProfile: TaxProfileSnapshotSchema.default({}),
  lineItems: z
    .array(QuotationLineItemInputSchema)
    .min(1, 'Quotation must contain at least one line item.'),
  additionalDiscountPaise: MoneyPaiseSchema.default(0),
  termsAndConditions: z
    .array(z.string().trim().min(1).max(500))
    .min(1, 'At least one commercial term is required.')
    .default([
      'Prices are inclusive of standard supply, installation, and commissioning.',
      'Net metering approval timeline depends on DISCOM grid feasibility and inspection.',
      'Quotation valid for 30 calendar days from the date of issuance.',
      'Payment terms: 20% advance upon confirmation, 70% before dispatch, 10% after commissioning.'
    ]),
  paymentMilestones: z.array(PaymentMilestoneSchema).default([
    { milestoneName: 'Booking Advance', percentage: 20, dueTrigger: 'Order confirmation' },
    { milestoneName: 'Material Dispatch', percentage: 70, dueTrigger: 'Before factory dispatch' },
    {
      milestoneName: 'Commissioning & Handover',
      percentage: 10,
      dueTrigger: 'DISCOM testing sign-off'
    }
  ]),
  notes: z.string().trim().max(1000).optional()
});

export type CreateQuotationInput = z.input<typeof CreateQuotationInputSchema>;

export const UpdateQuotationInputSchema = CreateQuotationInputSchema.partial();
export type UpdateQuotationInput = z.infer<typeof UpdateQuotationInputSchema>;

export const ReviseQuotationInputSchema = z.object({
  reasonForRevision: z
    .string({ required_error: 'Reason for creating revision is required.' })
    .trim()
    .min(5, 'Revision reason must be at least 5 characters.')
    .max(300),
  lineItems: z.array(QuotationLineItemInputSchema).min(1).optional(),
  additionalDiscountPaise: MoneyPaiseSchema.optional(),
  systemCapacityKwp: z.number().positive().optional(),
  validUntil: z.string().datetime({ offset: true }).or(z.date()).optional(),
  termsAndConditions: z.array(z.string().trim()).optional(),
  notes: z.string().trim().max(1000).optional()
});

export type ReviseQuotationInput = z.infer<typeof ReviseQuotationInputSchema>;

// ----------------------------------------------------------------------------
// Approval & Customer Decision DTOs
// ----------------------------------------------------------------------------

export const DiscountApprovalInputSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT'], {
    required_error: 'Decision action must be either APPROVE or REJECT.'
  }),
  remarks: z.string().trim().max(500).optional(),
  rejectionReason: z.string().trim().min(3).max(500).optional()
});

export type DiscountApprovalInput = z.infer<typeof DiscountApprovalInputSchema>;

export const CustomerQuotationDecisionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT'], {
    required_error: 'Decision action must be either ACCEPT or REJECT.'
  }),
  rejectionReason: z
    .string()
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters.')
    .max(500)
    .optional(),
  notes: z.string().trim().max(500).optional()
});

export type CustomerQuotationDecision = z.infer<typeof CustomerQuotationDecisionSchema>;

// ----------------------------------------------------------------------------
// Filter & Query DTO
// ----------------------------------------------------------------------------

export const QuotationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  customerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  leadId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  status: z.nativeEnum(QuotationStatus).optional(),
  systemTopology: z.nativeEnum(SolarTopology).optional(),
  requiresDiscountApproval: z.coerce.boolean().optional(),
  isLatestRevision: z.coerce.boolean().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type QuotationFilter = z.infer<typeof QuotationFilterSchema>;
