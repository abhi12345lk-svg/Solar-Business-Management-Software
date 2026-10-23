import { z } from 'zod';
import { UnitOfMeasurement, WarehouseType } from '../types/enums.js';
import { MoneyPaiseSchema } from './money.js';
import { AddressSchema } from './domain.js';

// ---------------------------------------------------------------------------
// 1. Product Category Schemas
// ---------------------------------------------------------------------------

export const ProductCategoryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_-]{2,30}$/,
    'Category code must be 2 to 30 uppercase alphanumeric characters, hyphens or underscores.'
  );

export const CreateProductCategoryInputSchema = z.object({
  code: ProductCategoryCodeSchema,
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  parentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent category ObjectId')
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true)
});

export const UpdateProductCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  parentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent category ObjectId')
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export type CreateProductCategoryInput = z.infer<typeof CreateProductCategoryInputSchema>;
export type UpdateProductCategoryInput = z.infer<typeof UpdateProductCategoryInputSchema>;

// ---------------------------------------------------------------------------
// 2. Product Schemas
// ---------------------------------------------------------------------------

export const SkuSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_\-\.\/]{2,50}$/,
    'SKU must be 2 to 50 alphanumeric characters or standard delimiters (-, _, ., /).'
  );

export const HsnSacCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{2,8}$/, 'HSN/SAC code must be between 2 and 8 numeric digits.')
  .optional();

export const ProductWarrantySchema = z
  .object({
    warrantyYears: z.number().int().min(0).max(50).optional(),
    warrantyType: z.string().trim().max(100).optional(),
    terms: z.string().trim().max(1000).optional()
  })
  .optional();

export const CreateProductInputSchema = z.object({
  productCode: z.string().trim().optional(),
  sku: SkuSchema,
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(150),
  description: z.string().trim().max(2000).optional(),
  categoryId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ObjectId'),
  brand: z.string().trim().min(1, 'Brand is required').max(100),
  model: z.string().trim().min(1, 'Model is required').max(100),
  productType: z.string().trim().min(1).max(50).default('OTHER'),
  technicalSpecifications: z.record(z.any()).optional(),
  uom: z.nativeEnum(UnitOfMeasurement).default(UnitOfMeasurement.NOS),
  hsnSacCode: HsnSacCodeSchema,
  standardPurchaseRatePaise: MoneyPaiseSchema,
  standardSellingRatePaise: MoneyPaiseSchema,
  taxProfileCode: z.string().trim().default('TAX_SOLAR_STANDARD'),
  minimumStockThreshold: z.number().int().min(0).default(0),
  isActive: z.boolean().optional().default(true),
  warranty: ProductWarrantySchema
});

export const UpdateProductInputSchema = z.object({
  sku: SkuSchema.optional(),
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  categoryId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ObjectId')
    .optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  productType: z.string().trim().min(1).max(50).optional(),
  technicalSpecifications: z.record(z.any()).optional(),
  uom: z.nativeEnum(UnitOfMeasurement).optional(),
  hsnSacCode: HsnSacCodeSchema,
  standardPurchaseRatePaise: MoneyPaiseSchema.optional(),
  standardSellingRatePaise: MoneyPaiseSchema.optional(),
  taxProfileCode: z.string().trim().optional(),
  minimumStockThreshold: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  warranty: ProductWarrantySchema
});

export const ProductFilterSchema = z.object({
  categoryId: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  productType: z.string().trim().optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform(val => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  search: z.string().trim().optional(),
  minPricePaise: MoneyPaiseSchema.optional(),
  maxPricePaise: MoneyPaiseSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['name', 'sku', 'brand', 'standardSellingRatePaise', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;
export type ProductFilterInput = z.infer<typeof ProductFilterSchema>;

// ---------------------------------------------------------------------------
// 3. Warehouse Schemas
// ---------------------------------------------------------------------------

export const WarehouseCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_-]{2,30}$/,
    'Warehouse code must be 2 to 30 uppercase alphanumeric characters, hyphens or underscores.'
  );

export const CreateWarehouseInputSchema = z.object({
  code: WarehouseCodeSchema,
  name: z.string().trim().min(2, 'Warehouse name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  type: z.nativeEnum(WarehouseType),
  address: AddressSchema.optional(),
  managerId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager user ObjectId')
    .optional(),
  custodianEmployeeId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid custodian employee ObjectId')
    .optional(),
  projectId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ObjectId')
    .optional(),
  isActive: z.boolean().optional().default(true)
});

export const UpdateWarehouseInputSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  type: z.nativeEnum(WarehouseType).optional(),
  address: AddressSchema.optional(),
  managerId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager user ObjectId')
    .optional()
    .nullable(),
  custodianEmployeeId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid custodian employee ObjectId')
    .optional()
    .nullable(),
  projectId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ObjectId')
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export const WarehouseFilterSchema = z.object({
  type: z.nativeEnum(WarehouseType).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform(val => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateWarehouseInput = z.infer<typeof CreateWarehouseInputSchema>;
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseInputSchema>;
export type WarehouseFilterInput = z.infer<typeof WarehouseFilterSchema>;
