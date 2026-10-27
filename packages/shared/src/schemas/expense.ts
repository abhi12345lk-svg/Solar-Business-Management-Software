/**
 * INS Solar Business Management Software — Expense Validation Schemas
 *
 * Enforces integer-paise financial validation, expense categories, approval workflows,
 * payment recording, cancellation reasons, and query filters.
 */

import { z } from 'zod';
import { PositiveMoneyPaiseSchema, MoneyPaiseSchema } from './money.js';
import {
  ExpenseCategory,
  ExpenseStatus,
  ExpensePaymentStatus,
  PaymentMethod
} from '../types/enums.js';

export const createExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory, {
    errorMap: () => ({ message: 'A valid expense category is required.' })
  }),
  description: z.string().trim().min(3, 'Description must be at least 3 characters.').max(500),
  amountPaise: PositiveMoneyPaiseSchema,
  taxAmountPaise: MoneyPaiseSchema.optional().default(0),
  expenseDate: z.coerce.date().optional().default(() => new Date()),
  vendorId: z.string().trim().optional(),
  payeeName: z.string().trim().max(120).optional(),
  projectId: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  evidenceKey: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional()
});

export const updateExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  description: z.string().trim().min(3).max(500).optional(),
  amountPaise: PositiveMoneyPaiseSchema.optional(),
  taxAmountPaise: MoneyPaiseSchema.optional(),
  expenseDate: z.coerce.date().optional(),
  vendorId: z.string().trim().optional(),
  payeeName: z.string().trim().max(120).optional(),
  projectId: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  evidenceKey: z.string().trim().optional()
});

export const approveExpenseSchema = z.object({
  approvalNotes: z.string().trim().max(500).optional()
});

export const rejectExpenseSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'A valid rejection reason is required.').max(500)
});

export const payExpenseSchema = z.object({
  paymentMode: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'A valid payment mode is required.' })
  }),
  paymentReference: z.string().trim().min(2, 'Payment reference or UTR is required.').max(100),
  paymentDate: z.coerce.date().optional().default(() => new Date()),
  paidAmountPaise: PositiveMoneyPaiseSchema.optional(),
  notes: z.string().trim().max(500).optional()
});

export const cancelExpenseSchema = z.object({
  cancellationReason: z.string().trim().min(3, 'A valid cancellation reason is required.').max(500)
});

export const expenseFilterSchema = z.object({
  projectId: z.string().optional(),
  orderId: z.string().optional(),
  vendorId: z.string().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  paymentStatus: z.nativeEnum(ExpensePaymentStatus).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type ApproveExpenseInput = z.input<typeof approveExpenseSchema>;
export type RejectExpenseInput = z.input<typeof rejectExpenseSchema>;
export type PayExpenseInput = z.input<typeof payExpenseSchema>;
export type CancelExpenseInput = z.input<typeof cancelExpenseSchema>;
export type ExpenseFilterInput = z.input<typeof expenseFilterSchema>;
