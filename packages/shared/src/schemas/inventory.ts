/**
 * INS Solar Business Management Software — Inventory & Stock Ledger Schemas
 *
 * Provides typed, validated Zod schemas for multi-location inventory projections,
 * append-oriented stock movements, stock receipts, issues, transfers, returns,
 * and serial number registration.
 */

import { z } from 'zod';
import { StockMovementType } from '../types/enums.js';

export const StockBalanceFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  warehouseId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  search: z.string().trim().optional()
});

export type StockBalanceFilter = z.infer<typeof StockBalanceFilterSchema>;

export const StockMovementFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  warehouseId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  orderId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  movementType: z.nativeEnum(StockMovementType).optional()
});

export type StockMovementFilter = z.infer<typeof StockMovementFilterSchema>;

export const StockReceiptInputSchema = z.object({
  warehouseId: z
    .string({ required_error: 'Receiving warehouse ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid warehouse ObjectId format.'),
  productId: z
    .string({ required_error: 'Product ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
  quantity: z
    .number({ invalid_type_error: 'Received quantity must be a number.' })
    .positive('Received quantity must be strictly greater than 0.')
    .max(1000000, 'Single receipt quantity cannot exceed 1,000,000 units.'),
  reference: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(250).optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional()
});

export type StockReceiptInput = z.input<typeof StockReceiptInputSchema>;

export const StockIssueInputSchema = z.object({
  warehouseId: z
    .string({ required_error: 'Issuing warehouse ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid warehouse ObjectId format.'),
  productId: z
    .string({ required_error: 'Product ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
  quantity: z
    .number({ invalid_type_error: 'Issued quantity must be a number.' })
    .positive('Issued quantity must be strictly greater than 0.'),
  orderId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  reservationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  reason: z.string().trim().max(250).optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional()
});

export type StockIssueInput = z.input<typeof StockIssueInputSchema>;

export const StockTransferInputSchema = z
  .object({
    sourceWarehouseId: z
      .string({ required_error: 'Source warehouse ID is required.' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid source warehouse ObjectId format.'),
    destinationWarehouseId: z
      .string({ required_error: 'Destination warehouse ID is required.' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid destination warehouse ObjectId format.'),
    productId: z
      .string({ required_error: 'Product ID is required.' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
    quantity: z
      .number({ invalid_type_error: 'Transfer quantity must be a number.' })
      .positive('Transfer quantity must be strictly greater than 0.'),
    reason: z.string().trim().max(250).optional(),
    idempotencyKey: z.string().trim().min(1).max(64).optional()
  })
  .refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: 'Source and destination warehouses must be different.',
    path: ['destinationWarehouseId']
  });

export type StockTransferInput = z.input<typeof StockTransferInputSchema>;

export const StockReturnInputSchema = z.object({
  sourceWarehouseId: z
    .string({ required_error: 'Return origin warehouse/location ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid origin warehouse ObjectId format.'),
  destinationWarehouseId: z
    .string({ required_error: 'Return destination warehouse ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid destination warehouse ObjectId format.'),
  productId: z
    .string({ required_error: 'Product ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
  quantity: z
    .number({ invalid_type_error: 'Return quantity must be a number.' })
    .positive('Return quantity must be strictly greater than 0.'),
  reason: z
    .string({ required_error: 'Return reason must be documented.' })
    .trim()
    .min(3, 'Return reason must be at least 3 characters.')
    .max(250),
  originalMovementId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional()
});

export type StockReturnInput = z.input<typeof StockReturnInputSchema>;

export const OpeningBalanceInputSchema = z.object({
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid warehouse ObjectId format.'),
  productId: z
    .string({ required_error: 'Product ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
  quantity: z
    .number({ invalid_type_error: 'Opening balance quantity must be a number.' })
    .positive('Opening balance quantity must be strictly greater than 0.'),
  reason: z
    .string({ required_error: 'Audit justification reason is required for opening stock.' })
    .trim()
    .min(5, 'Opening balance reason must be at least 5 characters.')
    .max(250)
});

export type OpeningBalanceInput = z.input<typeof OpeningBalanceInputSchema>;

export const RegisterSerialNumberInputSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ObjectId format.'),
  warehouseId: z
    .string({ required_error: 'Warehouse location ID is required.' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid warehouse ObjectId format.'),
  serialNumbers: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Serial number cannot be empty.')
        .max(80, 'Serial number exceeds maximum length.')
    )
    .min(1, 'At least one serial number must be provided.')
    .max(1000, 'Cannot register more than 1,000 serial numbers in a single operation.')
});

export type RegisterSerialNumberInput = z.input<typeof RegisterSerialNumberInputSchema>;
