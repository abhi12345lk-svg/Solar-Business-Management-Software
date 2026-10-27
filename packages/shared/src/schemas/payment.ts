/**
 * INS Solar Business Management Software — Payment & Receivables Validation Schemas
 *
 * Enforces integer-paise financial validation, payment methods, allocation rules,
 * reversal reasons, and query filters.
 */

import { z } from 'zod';
import { PositiveMoneyPaiseSchema } from './money.js';
import {
  PaymentMethod,
  CustomerPaymentStatus
} from '../types/enums.js';

export const recordPaymentSchema = z.object({
  customerId: z.string().min(1, 'Customer reference is required.'),
  amountPaise: PositiveMoneyPaiseSchema,
  paymentDate: z.coerce.date().optional().default(() => new Date()),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method specified.' })
  }),
  transactionReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  evidenceKey: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
  autoVerify: z.boolean().optional().default(false)
});

export const verifyPaymentSchema = z.object({
  verificationNotes: z.string().trim().max(1000).optional(),
  verifiedDate: z.coerce.date().optional().default(() => new Date())
});

export const allocatePaymentSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales Order reference is required.'),
  allocatedAmountPaise: PositiveMoneyPaiseSchema,
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().optional()
});

export const reverseAllocationSchema = z.object({
  reversalReason: z.string().trim().min(3, 'A valid reversal reason is required.').max(500)
});

export const reversePaymentSchema = z.object({
  reversalReason: z.string().trim().min(3, 'A valid reversal reason is required.').max(500)
});

export const refundPaymentSchema = z.object({
  refundAmountPaise: PositiveMoneyPaiseSchema,
  refundReference: z.string().trim().min(1, 'Refund reference or UTR is required.').max(100),
  refundDate: z.coerce.date().optional().default(() => new Date()),
  refundReason: z.string().trim().min(3, 'A valid refund reason is required.').max(500)
});

export const paymentFilterSchema = z.object({
  customerId: z.string().optional(),
  salesOrderId: z.string().optional(),
  status: z.nativeEnum(CustomerPaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const receivablesFilterSchema = z.object({
  customerId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type VerifyPaymentInput = z.input<typeof verifyPaymentSchema>;
export type AllocatePaymentInput = z.input<typeof allocatePaymentSchema>;
export type ReverseAllocationInput = z.input<typeof reverseAllocationSchema>;
export type ReversePaymentInput = z.input<typeof reversePaymentSchema>;
export type RefundPaymentInput = z.input<typeof refundPaymentSchema>;
export type PaymentFilterInput = z.input<typeof paymentFilterSchema>;
export type ReceivablesFilterInput = z.input<typeof receivablesFilterSchema>;
