/**
 * INS Solar Business Management Software — Sales Order Schemas
 *
 * Provides typed, validated Zod schemas for Sales Order creation from accepted
 * quotations, order status filtering, order cancellation, and stock reservation triggers.
 */

import { z } from 'zod';
import { OrderStatus, OrderReservationStatus } from '../types/enums.js';
import { AddressSchema } from './domain.js';

export const CreateOrderFromQuotationInputSchema = z.object({
  quotationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid quotation ObjectId format.'),
  quotationRevisionId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid quotation revision ObjectId format.'),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
  notes: z.string().trim().max(1000).optional(),
  deliveryAddress: AddressSchema.optional()
});

export type CreateOrderFromQuotationInput = z.input<typeof CreateOrderFromQuotationInputSchema>;
export type CreateOrderFromQuotationParsed = z.infer<typeof CreateOrderFromQuotationInputSchema>;

export const CancelOrderInputSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is required.' })
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters.')
    .max(500, 'Cancellation reason cannot exceed 500 characters.')
});

export type CancelOrderInput = z.input<typeof CancelOrderInputSchema>;

export const ReserveStockForOrderInputSchema = z.object({
  warehouseId: z
    .string({ required_error: 'Fulfillment warehouse ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid warehouse ObjectId format.'),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
        quantity: z
          .number({ invalid_type_error: 'Reserved quantity must be a number.' })
          .positive('Reserved quantity must be strictly positive.')
      })
    )
    .optional()
});

export type ReserveStockForOrderInput = z.input<typeof ReserveStockForOrderInputSchema>;

export const OrderFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  reservationStatus: z.nativeEnum(OrderReservationStatus).optional(),
  search: z.string().trim().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type OrderFilter = z.infer<typeof OrderFilterSchema>;
