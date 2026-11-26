/**
 * INS Solar Business Management Software — Customer GST Tax Invoice Schemas
 */

import { z } from 'zod';
import { CustomerInvoiceType, CustomerInvoiceStatus } from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const createCustomerInvoiceSchema = z.object({
  orderId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Sales Order ID'),
  invoiceType: z.nativeEnum(CustomerInvoiceType).default(CustomerInvoiceType.TAX_INVOICE),
  milestoneIndex: z.number().int().min(0).optional(),
  originalInvoiceId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Original Invoice ID').optional(),
  creditAmountPaise: z.number().int().positive('Credit note amount must be positive').optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().max(100).optional()
});

export const cancelCustomerInvoiceSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(1000, 'Cancellation reason cannot exceed 1000 characters')
});

export const customerInvoiceFilterSchema = z.object({
  orderId: z.string().regex(OBJECT_ID_REGEX).optional(),
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(CustomerInvoiceStatus).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'invoiceNumber', 'status', 'netTotalPaise']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type CreateCustomerInvoiceInput = z.infer<typeof createCustomerInvoiceSchema>;
export type CancelCustomerInvoiceInput = z.infer<typeof cancelCustomerInvoiceSchema>;
export type CustomerInvoiceFilterInput = z.infer<typeof customerInvoiceFilterSchema>;
