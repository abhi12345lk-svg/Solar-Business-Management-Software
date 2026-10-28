import { z } from 'zod';
import { UnitOfMeasurement, PurchaseOrderStatus, VendorInvoiceStatus } from '../types/enums.js';
import { PaginationQuerySchema } from './common.js';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * 1. Vendor Schemas
 */
export const createVendorSchema = z.object({
  name: z.string().min(2, 'Vendor name must be at least 2 characters').max(150),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z
    .object({
      addressLine1: z.string().min(1, 'Address Line 1 is required'),
      addressLine2: z.string().optional(),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
      country: z.string().default('India')
    })
    .optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Invalid 15-character GSTIN format')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'Invalid 10-character PAN format')
    .optional()
    .or(z.literal('')),
  suppliedCategoryIds: z.array(z.string()).optional(),
  suppliedProductIds: z.array(z.string()).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional().default(30),
  bankDetails: z
    .object({
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifscCode: z.string().optional(),
      bankName: z.string().optional()
    })
    .optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional()
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const vendorFilterSchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  categoryId: z.string().optional()
});

/**
 * 2. Purchase Order Schemas
 */
export const poLineItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  orderedQuantity: z.number().positive('Quantity must be greater than zero'),
  unitPurchaseRatePaise: z
    .number()
    .int()
    .min(0, 'Purchase rate must be non-negative integer paise'),
  discountPaise: z
    .number()
    .int()
    .min(0, 'Discount must be non-negative integer paise')
    .optional()
    .default(0),
  gstRate: z.number().min(0).max(100).optional().default(12),
  uom: z.nativeEnum(UnitOfMeasurement).optional(),
  notes: z.string().max(500).optional()
});

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  destinationWarehouseId: z.string().min(1, 'Destination warehouse ID is required'),
  orderDate: z.string().or(z.date()).optional(),
  expectedDeliveryDate: z.string().or(z.date()).optional(),
  lineItems: z.array(poLineItemInputSchema).min(1, 'At least one line item is required'),
  termsAndConditions: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  isInterState: z.boolean().default(false)
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

export const approvePurchaseOrderSchema = z.object({
  reason: z.string().max(500).optional(),
  isMfaVerified: z.boolean().optional()
});

export const rejectPurchaseOrderSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required (min 3 chars)').max(500)
});

export const poFilterSchema = PaginationQuerySchema.extend({
  vendorId: z.string().optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  destinationWarehouseId: z.string().optional(),
  search: z.string().optional()
});

/**
 * 3. Goods Receipt Note (GRN) Schemas
 */
export const grnLineItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  deliveredQuantity: z.number().min(0, 'Delivered quantity cannot be negative'),
  acceptedQuantity: z.number().min(0, 'Accepted quantity cannot be negative'),
  rejectedQuantity: z.number().min(0, 'Rejected quantity cannot be negative').optional().default(0),
  rejectionReason: z.string().max(500).optional(),
  serialNumbers: z.array(z.string().trim()).optional()
});

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order ID is required'),
  destinationWarehouseId: z.string().optional(),
  receiptDate: z.string().or(z.date()).optional(),
  deliveryChallanNumber: z.string().max(100).optional(),
  vehicleNumber: z.string().max(50).optional(),
  inspectionRemarks: z.string().max(1000).optional(),
  lineItems: z.array(grnLineItemInputSchema).min(1, 'At least one GRN line item is required'),
  idempotencyKey: z.string().max(100).optional()
});

export const grnFilterSchema = PaginationQuerySchema.extend({
  purchaseOrderId: z.string().optional(),
  vendorId: z.string().optional(),
  destinationWarehouseId: z.string().optional()
});

/**
 * 4. Vendor Invoice Schemas
 */
export const createVendorInvoiceSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  purchaseOrderId: z.string().optional(),
  goodsReceiptIds: z.array(z.string()).optional(),
  vendorInvoiceNumber: z.string().min(1, 'Vendor invoice number is required').max(100),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional(),
  subtotalPaise: z.number().int().min(0, 'Subtotal must be non-negative integer paise'),
  taxAmountPaise: z.number().int().min(0, 'Tax amount must be non-negative integer paise'),
  totalAmountPaise: z
    .number()
    .int()
    .min(0, 'Total invoice amount must be non-negative integer paise'),
  notes: z.string().max(1000).optional(),
  documentUrl: z.string().url('Invalid document URL').optional().or(z.literal(''))
});

export const reconcileVendorInvoiceSchema = z.object({
  status: z.nativeEnum(VendorInvoiceStatus),
  reconciliationNotes: z.string().max(1000).optional()
});

export const vendorInvoiceFilterSchema = PaginationQuerySchema.extend({
  vendorId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  status: z.nativeEnum(VendorInvoiceStatus).optional(),
  search: z.string().optional()
});

export type CreateVendorInput = z.input<typeof createVendorSchema>;
export type UpdateVendorInput = z.input<typeof updateVendorSchema>;
export type VendorFilter = z.infer<typeof vendorFilterSchema>;

export type POLineItemInput = z.input<typeof poLineItemInputSchema>;
export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.input<typeof updatePurchaseOrderSchema>;
export type ApprovePurchaseOrderInput = z.infer<typeof approvePurchaseOrderSchema>;
export type RejectPurchaseOrderInput = z.infer<typeof rejectPurchaseOrderSchema>;
export type PurchaseOrderFilter = z.infer<typeof poFilterSchema>;

export type GRNLineItemInput = z.input<typeof grnLineItemInputSchema>;
export type CreateGoodsReceiptInput = z.input<typeof createGoodsReceiptSchema>;
export type GoodsReceiptFilter = z.infer<typeof grnFilterSchema>;

export type CreateVendorInvoiceInput = z.input<typeof createVendorInvoiceSchema>;
export type ReconcileVendorInvoiceInput = z.infer<typeof reconcileVendorInvoiceSchema>;
export type VendorInvoiceFilter = z.infer<typeof vendorInvoiceFilterSchema>;
