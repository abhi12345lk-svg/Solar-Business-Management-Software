/**
 * INS Solar Business Management Software — Material Dispatch Schemas
 */

import { z } from 'zod';
import { MaterialDispatchStatus } from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const dispatchLineItemSchema = z.object({
  productId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Product ID'),
  requestedQuantity: z.number().int().positive('Requested quantity must be a positive integer'),
  serialNumbers: z.array(z.string().trim().toUpperCase()).optional().default([])
});

export const createMaterialDispatchSchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Project ID'),
  sourceWarehouseId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Warehouse ID'),
  lineItems: z
    .array(dispatchLineItemSchema)
    .min(1, 'At least one line item is required for dispatch'),
  vehicleNumber: z.string().trim().max(50).optional(),
  driverName: z.string().trim().max(100).optional(),
  driverPhone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().max(100).optional()
});

export const cancelMaterialDispatchSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(1000, 'Cancellation reason cannot exceed 1000 characters')
});

export const dispatchFilterSchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(MaterialDispatchStatus).optional(),
  sourceWarehouseId: z.string().regex(OBJECT_ID_REGEX).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'dispatchNumber', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type DispatchLineItemInput = z.input<typeof dispatchLineItemSchema>;
export type DispatchLineItemParsed = z.infer<typeof dispatchLineItemSchema>;

export type CreateMaterialDispatchInput = z.input<typeof createMaterialDispatchSchema>;
export type CreateMaterialDispatchParsed = z.infer<typeof createMaterialDispatchSchema>;

export type CancelMaterialDispatchInput = z.input<typeof cancelMaterialDispatchSchema>;
export type CancelMaterialDispatchParsed = z.infer<typeof cancelMaterialDispatchSchema>;

export type DispatchFilterInput = z.input<typeof dispatchFilterSchema>;
export type DispatchFilterParsed = z.infer<typeof dispatchFilterSchema>;
