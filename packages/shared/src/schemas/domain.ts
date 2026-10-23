/**
 * INS Solar Business Management Software — Shared Domain Primitives & Schemas
 */

import { z } from 'zod';
import {
  UnitOfMeasurement,
  AddressType,
  CustomerType,
  CustomerStatus,
  SequenceEntityType
} from '../types/enums.js';
import { PhoneSchema, EmailSchema } from './common.js';

/**
 * Physical Address Schema
 */
export const AddressSchema = z.object({
  type: z.nativeEnum(AddressType).default(AddressType.BILLING),
  addressLine1: z
    .string()
    .trim()
    .min(3, 'Address line 1 must have at least 3 characters.')
    .max(150),
  addressLine2: z.string().trim().max(150).optional(),
  landmark: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, 'City is required.').max(80),
  district: z.string().trim().max(80).optional(),
  state: z.string().trim().min(2, 'State is required.').max(80),
  stateCode: z
    .string()
    .trim()
    .regex(/^\d{2}$/, 'Indian State Code must be a 2-digit number (e.g. 07, 09, 24).')
    .optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Indian PIN code must be a 6-digit number not starting with 0.'),
  country: z.string().trim().default('India'),
  geoCoordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    })
    .optional()
});

export type AddressDto = z.infer<typeof AddressSchema>;

/**
 * Individual Contact Person Details
 */
export const ContactPersonSchema = z.object({
  name: z.string().trim().min(2, 'Contact person name is required.').max(80),
  phone: PhoneSchema,
  email: EmailSchema.optional(),
  designation: z.string().trim().max(60).optional()
});

export type ContactPersonDto = z.infer<typeof ContactPersonSchema>;

/**
 * Component / Product Quantity with Unit of Measurement (UOM)
 */
export const QuantitySchema = z.object({
  value: z
    .number({ invalid_type_error: 'Quantity must be a valid number.' })
    .positive('Quantity must be strictly positive.')
    .max(1000000, 'Quantity exceeds maximum allowable limit.'),
  uom: z.nativeEnum(UnitOfMeasurement)
});

export type QuantityDto = z.infer<typeof QuantitySchema>;

/**
 * Indian Goods and Services Tax Identification Number (GSTIN)
 * Format: 2-digit State Code + 10-char PAN + 1 entity code + 'Z' + 1 checksum char (15 characters)
 */
export const GstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid Indian GSTIN format (must be 15 alphanumeric characters, e.g. 07AAAAA0000A1Z5).'
  );

/**
 * Indian Permanent Account Number (PAN)
 * Format: 5 uppercase letters + 4 digits + 1 uppercase letter (10 characters)
 */
export const PanSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    'Invalid Indian PAN format (must be 10 characters, e.g. ABCDE1234F).'
  );

/**
 * Standard Formatted Business Identifiers
 */
export const BusinessNumberRegex = /^[A-Z]{2,6}-\d{4}-\d{4,6}$/;

export const CustomerCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^CUST-\d{4}-\d{5}$/, 'Customer code must match format CUST-YYYY-NNNNN.');

export const GenericBusinessNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    BusinessNumberRegex,
    'Business number must match standard format (e.g. PREFIX-YYYY-NNNNN).'
  );

/**
 * Configurable Tax Profile Schema (Preserving configurable rules without hardcoded statutory rates)
 */
export const TaxProfileSchema = z.object({
  profileName: z.string().trim().min(2).max(60),
  isInterState: z.boolean().default(false),
  cgstRateBasisPoints: z.number().int().min(0).max(5000), // e.g. 900 = 9%
  sgstRateBasisPoints: z.number().int().min(0).max(5000), // e.g. 900 = 9%
  igstRateBasisPoints: z.number().int().min(0).max(5000), // e.g. 1800 = 18%
  hsnSacCode: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'HSN/SAC code must be 4 to 8 digits.')
    .optional(),
  description: z.string().trim().max(200).optional()
});

export type TaxProfileDto = z.infer<typeof TaxProfileSchema>;

/**
 * Foundational Customer Input Schema
 */
export const CreateCustomerSchema = z.object({
  customerCode: CustomerCodeSchema.optional(), // Auto-generated if not provided
  name: z.string().trim().min(2, 'Customer name is required.').max(120),
  companyName: z.string().trim().max(120).optional(),
  primaryPhone: PhoneSchema,
  email: EmailSchema.optional(),
  type: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  status: z.nativeEnum(CustomerStatus).default(CustomerStatus.ACTIVE),
  gstin: GstinSchema.optional(),
  pan: PanSchema.optional(),
  billingAddress: AddressSchema.optional(),
  installationAddress: AddressSchema.optional(),
  contactPerson: ContactPersonSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional()
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

/**
 * Foundational Customer DTO
 */
export interface CustomerDto {
  id: string;
  customerCode: string;
  name: string;
  companyName?: string;
  primaryPhone: string;
  email?: string;
  type: CustomerType;
  status: CustomerStatus;
  gstin?: string;
  pan?: string;
  billingAddress?: AddressDto;
  installationAddress?: AddressDto;
  contactPerson?: ContactPersonDto;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Company / Organization Settings Schema
 */
export const CompanySettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(100).default('INS Solar'),
  legalEntityName: z.string().trim().max(120).optional(),
  gstin: GstinSchema.optional(),
  pan: PanSchema.optional(),
  contactPhone: PhoneSchema.optional(),
  contactEmail: EmailSchema.optional(),
  website: z.string().trim().url().optional(),
  registeredAddress: AddressSchema.optional(),
  defaultCurrency: z.string().trim().default('INR'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(4), // April
  sequencePrefixes: z
    .record(z.nativeEnum(SequenceEntityType), z.string().trim().min(2).max(6).toUpperCase())
    .default({
      [SequenceEntityType.CUSTOMER]: 'CUST',
      [SequenceEntityType.LEAD]: 'LEAD',
      [SequenceEntityType.SITE_SURVEY]: 'SRV',
      [SequenceEntityType.SOLAR_DESIGN]: 'DES',
      [SequenceEntityType.QUOTATION]: 'QT',
      [SequenceEntityType.ORDER]: 'ORD',
      [SequenceEntityType.PROJECT]: 'PRJ',
      [SequenceEntityType.PURCHASE_ORDER]: 'PO',
      [SequenceEntityType.INVOICE]: 'INV',
      [SequenceEntityType.PAYMENT_RECEIPT]: 'REC',
      [SequenceEntityType.SERVICE_TICKET]: 'TKT',
      [SequenceEntityType.AMC_CONTRACT]: 'AMC',
      [SequenceEntityType.STOCK_MOVEMENT]: 'STK'
    })
});

export type CompanySettingsDto = z.infer<typeof CompanySettingsSchema>;
