/**
 * INS Solar Business Management Software — Installation & Installer Panel Schemas
 */

import { z } from 'zod';
import {
  InstallationStatus,
  SitePhotoCategory,
  InstallationEquipmentType,
  TechnicalManualCategory
} from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const sitePhotoItemSchema = z.object({
  category: z.nativeEnum(SitePhotoCategory),
  title: z.string().trim().min(1).max(200),
  storageKey: z.string().trim().optional(),
  fileUrl: z.string().trim().min(1),
  originalFilename: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(100),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  uploadedAt: z.union([z.string(), z.date()]).optional(),
  timestamp: z.union([z.string(), z.date()]).optional(),
  gpsLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().min(0).optional()
    })
    .optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const equipmentItemDetailSchema = z.object({
  name: z.string().trim().min(1).max(200),
  equipmentType: z.nativeEnum(InstallationEquipmentType).optional(),
  brand: z.string().trim().max(200).default(''),
  modelNumber: z.string().trim().max(200).default(''),
  serialNumber: z.string().trim().max(200).default(''),
  barcode: z.string().trim().max(200).default(''),
  rating: z.string().trim().max(200).default(''),
  photoUrl: z.string().trim().optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const panelDetailsSchema = z.object({
  totalPanels: z.number().int().min(0).default(0),
  manufacturer: z.string().trim().max(200).default(''),
  model: z.string().trim().max(200).default(''),
  wattagePerPanel: z.number().min(0).default(0),
  calculatedTotalCapacityKw: z.number().min(0).default(0),
  panelSerialNumbers: z.array(z.string().trim()).default([]),
  panelBarcodes: z.array(z.string().trim()).default([]),
  remarks: z.string().trim().max(1000).optional()
});

export const inventoryRowSchema = z.object({
  itemNumber: z.number().int().positive(),
  equipmentName: z.string().trim().min(1).max(200),
  barcode: z.string().trim().max(200).default(''),
  serialNumber: z.string().trim().max(200).default(''),
  model: z.string().trim().max(200).default(''),
  quantity: z.number().int().positive().default(1),
  status: z.enum(['VERIFIED', 'PENDING', 'DEFECTIVE', 'INSTALLED']).default('VERIFIED'),
  scannedAt: z.union([z.string(), z.date()]).optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const gpsLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).default(0),
  capturedAt: z.union([z.string(), z.date()]).optional(),
  isVerified: z.boolean().default(false),
  googleMapsUrl: z.string().trim().optional()
});

export const technicalManualItemSchema = z.object({
  category: z.nativeEnum(TechnicalManualCategory),
  title: z.string().trim().min(1).max(200),
  storageKey: z.string().trim().optional(),
  fileUrl: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(300),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().trim().min(1).max(100),
  uploadedAt: z.union([z.string(), z.date()]).optional()
});

export const createInstallationSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Valid Customer ID is required'),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  systemCapacityKw: z.number().positive().optional(),
  assignedInstallerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  installationDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().max(2000).optional(),
  isDraft: z.boolean().default(true)
});

export const updateInstallationSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  systemCapacityKw: z.number().positive().optional(),
  assignedInstallerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  installationDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().max(2000).optional(),

  // Equipment Sections
  earthingSystem: equipmentItemDetailSchema.optional(),
  solarStructure: equipmentItemDetailSchema.optional(),
  solarPanels: equipmentItemDetailSchema.optional(),
  lightningProtection: equipmentItemDetailSchema.optional(),
  inverter: equipmentItemDetailSchema.optional(),
  netMeter: equipmentItemDetailSchema.optional(),

  // Solar Panels Quantities
  panelDetails: panelDetailsSchema.optional(),

  // Equipment Inventory Table
  inventoryItems: z.array(inventoryRowSchema).optional(),

  // Max 10 Site Photos
  photos: z.array(sitePhotoItemSchema).max(10, 'Maximum 10 site photographs allowed').optional(),

  // Verified GPS Location
  location: gpsLocationSchema.optional(),

  // Technical Manuals
  manuals: z.array(technicalManualItemSchema).optional(),

  currentStep: z.number().int().min(1).max(12).optional(),
  isDraft: z.boolean().optional(),
  status: z.nativeEnum(InstallationStatus).optional()
});

export const reviewInstallationSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    rejectionReason: z.string().trim().max(2000).optional(),
    adminRemarks: z.string().trim().max(2000).optional()
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REJECT' && (!data.rejectionReason || !data.rejectionReason.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'Rejection reason is mandatory when rejecting an installation report.'
      });
    }
  });

export const assignInstallationSchema = z.object({
  assignedInstallerId: z.string().regex(OBJECT_ID_REGEX, 'Valid Installer user ID is required'),
  installationDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const installationFilterSchema = z.object({
  status: z.nativeEnum(InstallationStatus).optional(),
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  installerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type SitePhotoItem = z.infer<typeof sitePhotoItemSchema>;
export type EquipmentItemDetail = z.infer<typeof equipmentItemDetailSchema>;
export type PanelDetails = z.infer<typeof panelDetailsSchema>;
export type InventoryRow = z.infer<typeof inventoryRowSchema>;
export type GpsLocation = z.infer<typeof gpsLocationSchema>;
export type TechnicalManualItem = z.infer<typeof technicalManualItemSchema>;
export type CreateInstallationInput = z.infer<typeof createInstallationSchema>;
export type UpdateInstallationInput = z.infer<typeof updateInstallationSchema>;
export type ReviewInstallationInput = z.infer<typeof reviewInstallationSchema>;
export type AssignInstallationInput = z.infer<typeof assignInstallationSchema>;
export type InstallationFilterInput = z.infer<typeof installationFilterSchema>;
