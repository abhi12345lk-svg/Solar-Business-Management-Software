/**
 * INS Solar Business Management Software — Shared CRM & Site Survey Schemas
 *
 * Implements validation rules, DTOs, and lifecycle primitives for:
 * - Lead Management (Sequential leadCode, contact info, solar requirement, status)
 * - Lead Activity & Follow-ups (Interactions, scheduled follow-ups, sentiment)
 * - Lead Assignment (RBAC-aware employee assignment)
 * - Duplicate Phone Search (Non-destructive warning/review workflow)
 * - Lead-to-Customer Conversion (Explicit, idempotent, historical preservation)
 * - Site Survey (Physical roof & electrical measurements, shadow notes, photo metadata)
 */

import { z } from 'zod';
import {
  LeadStatus,
  LeadSource,
  LeadPriority,
  SolarRequirement,
  ActivityType,
  ActivityStatus,
  ActivitySentiment,
  SurveyStatus,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory,
  CustomerType
} from '../types/enums.js';
import { PhoneSchema, EmailSchema, PaginationQuerySchema } from './common.js';
import { AddressSchema, GstinSchema, PanSchema } from './domain.js';

// ===========================================================================
// Identifiers & Primitives
// ===========================================================================

export const LeadCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^LEAD-\d{4}-\d{5}$/, 'Lead code must match format LEAD-YYYY-NNNNN.');

export const SurveyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^SRV-\d{4}-\d{5}$/, 'Survey code must match format SRV-YYYY-NNNNN.');

export const LeadLocationSchema = z.object({
  street: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2, 'City is required.').max(80),
  district: z.string().trim().max(80).optional(),
  state: z.string().trim().min(2, 'State is required.').max(80),
  pinCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Indian PIN code must be a 6-digit number not starting with 0.')
    .optional(),
  geoCoordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    })
    .optional()
});

export type LeadLocationDto = z.infer<typeof LeadLocationSchema>;

// ===========================================================================
// Lead Schemas
// ===========================================================================

export const CreateLeadInputSchema = z.object({
  prospectName: z.string().trim().min(2, 'Prospect name must have at least 2 characters.').max(120),
  prospectPhone: PhoneSchema,
  prospectEmail: EmailSchema.optional(),
  companyName: z.string().trim().max(120).optional(),
  location: LeadLocationSchema,
  source: z.nativeEnum(LeadSource).default(LeadSource.OTHER),
  solarRequirement: z.nativeEnum(SolarRequirement).default(SolarRequirement.RESIDENTIAL),
  estimatedCapacityKw: z
    .number({ invalid_type_error: 'Estimated capacity must be a number.' })
    .positive('Estimated capacity must be greater than zero.')
    .max(50000, 'Estimated capacity exceeds maximum allowable plant size.')
    .optional(),
  assignedToEmployeeId: z.string().trim().optional(),
  priority: z.nativeEnum(LeadPriority).default(LeadPriority.MEDIUM),
  notes: z.string().trim().max(2000).optional(),
  nextFollowUpDate: z.string().datetime().or(z.date()).optional()
});

export type CreateLeadInput = z.infer<typeof CreateLeadInputSchema>;

export const UpdateLeadInputSchema = z.object({
  prospectName: z.string().trim().min(2).max(120).optional(),
  prospectPhone: PhoneSchema.optional(),
  prospectEmail: EmailSchema.optional(),
  companyName: z.string().trim().max(120).optional(),
  location: LeadLocationSchema.optional(),
  source: z.nativeEnum(LeadSource).optional(),
  solarRequirement: z.nativeEnum(SolarRequirement).optional(),
  estimatedCapacityKw: z.number().positive().max(50000).optional().nullable(),
  priority: z.nativeEnum(LeadPriority).optional(),
  notes: z.string().trim().max(2000).optional(),
  nextFollowUpDate: z.string().datetime().or(z.date()).optional().nullable(),
  isActive: z.boolean().optional()
});

export type UpdateLeadInput = z.infer<typeof UpdateLeadInputSchema>;

export const UpdateLeadStatusInputSchema = z
  .object({
    status: z.nativeEnum(LeadStatus),
    lostReason: z.string().trim().max(500).optional()
  })
  .refine(
    data => {
      if (data.status === LeadStatus.LOST) {
        return Boolean(data.lostReason && data.lostReason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'A reason is required when marking a lead as LOST.',
      path: ['lostReason']
    }
  );

export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusInputSchema>;

export const AssignLeadInputSchema = z.object({
  assignedToEmployeeId: z.string().trim().min(1, 'Assigned employee ID is required.'),
  remarks: z.string().trim().max(500).optional()
});

export type AssignLeadInput = z.infer<typeof AssignLeadInputSchema>;

export const ConvertLeadInputSchema = z.object({
  customerType: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  companyName: z.string().trim().max(120).optional(),
  gstin: GstinSchema.optional(),
  pan: PanSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  existingCustomerId: z.string().trim().optional()
});

export type ConvertLeadInput = z.infer<typeof ConvertLeadInputSchema>;

export const LeadFilterSchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  assignedToEmployeeId: z.string().trim().optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  isActive: z.coerce.boolean().optional()
});

export type LeadFilterParams = z.infer<typeof LeadFilterSchema>;

export interface LeadDto {
  id: string;
  leadCode: string;
  prospectName: string;
  prospectPhone: string;
  prospectEmail?: string;
  companyName?: string;
  location: LeadLocationDto;
  source: LeadSource;
  solarRequirement: SolarRequirement;
  estimatedCapacityKw?: number;
  assignedToEmployeeId?: string;
  assignedEmployeeName?: string;
  status: LeadStatus;
  lostReason?: string;
  priority: LeadPriority;
  notes?: string;
  nextFollowUpDate?: string;
  isActive: boolean;
  convertedCustomerId?: string;
  convertedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ===========================================================================
// Lead Activity & Follow-up Schemas
// ===========================================================================

export const CreateLeadActivityInputSchema = z.object({
  activityType: z.nativeEnum(ActivityType).default(ActivityType.CALL),
  summary: z.string().trim().min(2, 'Activity summary is required.').max(1000),
  remarks: z.string().trim().max(2000).optional(),
  activityDate: z
    .string()
    .datetime()
    .or(z.date())
    .default(() => new Date().toISOString()),
  nextFollowUpDate: z.string().datetime().or(z.date()).optional().nullable(),
  status: z.nativeEnum(ActivityStatus).default(ActivityStatus.COMPLETED),
  sentiment: z.nativeEnum(ActivitySentiment).optional(),
  assignedEmployeeId: z.string().trim().optional()
});

export type CreateLeadActivityInput = z.infer<typeof CreateLeadActivityInputSchema>;

export const CompleteFollowUpInputSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
  nextFollowUpDate: z.string().datetime().or(z.date()).optional().nullable(),
  sentiment: z.nativeEnum(ActivitySentiment).optional()
});

export type CompleteFollowUpInput = z.infer<typeof CompleteFollowUpInputSchema>;

export const FollowUpFilterSchema = PaginationQuerySchema.extend({
  assignedEmployeeId: z.string().trim().optional(),
  timeframe: z.enum(['all', 'overdue', 'today', 'upcoming']).default('all'),
  status: z.nativeEnum(ActivityStatus).optional()
});

export type FollowUpFilterParams = z.infer<typeof FollowUpFilterSchema>;

export interface LeadActivityDto {
  id: string;
  leadId: string;
  customerId?: string;
  activityType: ActivityType;
  summary: string;
  remarks?: string;
  activityDate: string;
  nextFollowUpDate?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  status: ActivityStatus;
  sentiment?: ActivitySentiment;
  completedAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

// ===========================================================================
// Site Survey Schemas
// ===========================================================================

export const SurveyPhotoMetadataSchema = z.object({
  storageKey: z.string().trim().min(1, 'Storage key is required.').max(500),
  fileName: z.string().trim().min(1, 'File name is required.').max(255),
  mimeType: z
    .string()
    .trim()
    .regex(
      /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/,
      'Only JPEG, PNG, WebP, HEIC and PDF files are supported.'
    ),
  fileSizeBytes: z
    .number()
    .int()
    .positive('File size must be positive.')
    .max(25 * 1024 * 1024, 'File size exceeds 25MB limit.'),
  category: z.nativeEnum(SurveyPhotoCategory).default(SurveyPhotoCategory.OTHER),
  caption: z.string().trim().max(300).optional(),
  dataUrl: z.string().optional(),
  geoCoordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    })
    .optional(),
  uploadedBy: z.string().trim().optional(),
  uploadedAt: z.string().datetime().or(z.date()).optional()
});

export type SurveyPhotoMetadataDto = z.infer<typeof SurveyPhotoMetadataSchema>;

export const CreateSiteSurveyInputSchema = z.object({
  leadId: z.string().trim().min(1, 'Lead ID is required.'),
  customerId: z.string().trim().optional(),
  siteAddress: AddressSchema,
  roofType: z.nativeEnum(RoofType),
  usableRoofAreaSqFt: z
    .number({ invalid_type_error: 'Usable roof area must be a number.' })
    .nonnegative('Usable roof area must be non-negative.')
    .max(1000000, 'Usable roof area exceeds maximum limit.'),
  grossRoofAreaSqFt: z
    .number()
    .nonnegative('Gross roof area must be non-negative.')
    .max(1000000)
    .optional(),
  monthlyUnitsKwh: z
    .number()
    .nonnegative('Monthly consumption must be non-negative.')
    .max(500000)
    .optional(),
  averageMonthlyBillPaise: z
    .number()
    .int('Bill amount must be in integer paise.')
    .nonnegative('Bill amount must be non-negative.')
    .max(10000000000) // Up to 10 crore rupees
    .optional(),
  sanctionedLoadKw: z
    .number({ invalid_type_error: 'Sanctioned load must be a number.' })
    .positive('Sanctioned load must be greater than zero.')
    .max(100000, 'Sanctioned load exceeds maximum limit.'),
  connectionPhase: z.nativeEnum(ConnectionPhase).default(ConnectionPhase.SINGLE),
  shadowAnalysisNotes: z.string().trim().max(1500).optional(),
  orientationAzimuth: z.string().trim().max(100).optional(),
  proposedCapacityKw: z
    .number()
    .positive('Proposed capacity must be greater than zero.')
    .max(50000)
    .optional(),
  surveyorEmployeeId: z.string().trim().optional(),
  scheduledDate: z.string().datetime().or(z.date()).optional(),
  observations: z.string().trim().max(3000).optional(),
  constraints: z.string().trim().max(2000).optional(),
  recommendations: z.string().trim().max(2000).optional()
});

export type CreateSiteSurveyInput = z.infer<typeof CreateSiteSurveyInputSchema>;

export const UpdateSiteSurveyInputSchema = z.object({
  siteAddress: AddressSchema.optional(),
  roofType: z.nativeEnum(RoofType).optional(),
  usableRoofAreaSqFt: z.number().nonnegative().max(1000000).optional(),
  grossRoofAreaSqFt: z.number().nonnegative().max(1000000).optional(),
  monthlyUnitsKwh: z.number().nonnegative().max(500000).optional(),
  averageMonthlyBillPaise: z.number().int().nonnegative().max(10000000000).optional(),
  sanctionedLoadKw: z.number().positive().max(100000).optional(),
  connectionPhase: z.nativeEnum(ConnectionPhase).optional(),
  shadowAnalysisNotes: z.string().trim().max(1500).optional(),
  orientationAzimuth: z.string().trim().max(100).optional(),
  proposedCapacityKw: z.number().positive().max(50000).optional(),
  surveyorEmployeeId: z.string().trim().optional(),
  scheduledDate: z.string().datetime().or(z.date()).optional().nullable(),
  completedDate: z.string().datetime().or(z.date()).optional().nullable(),
  observations: z.string().trim().max(3000).optional(),
  constraints: z.string().trim().max(2000).optional(),
  recommendations: z.string().trim().max(2000).optional()
});

export type UpdateSiteSurveyInput = z.infer<typeof UpdateSiteSurveyInputSchema>;

export const UpdateSurveyStatusInputSchema = z.object({
  status: z.nativeEnum(SurveyStatus),
  remarks: z.string().trim().max(500).optional()
});

export type UpdateSurveyStatusInput = z.infer<typeof UpdateSurveyStatusInputSchema>;

export const AttachSurveyPhotosInputSchema = z.object({
  photos: z.array(SurveyPhotoMetadataSchema).min(1, 'At least one photo must be provided.').max(20)
});

export type AttachSurveyPhotosInput = z.infer<typeof AttachSurveyPhotosInputSchema>;

export const SurveyFilterSchema = PaginationQuerySchema.extend({
  leadId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  status: z.nativeEnum(SurveyStatus).optional(),
  surveyorEmployeeId: z.string().trim().optional()
});

export type SurveyFilterParams = z.infer<typeof SurveyFilterSchema>;

export interface SiteSurveyDto {
  id: string;
  surveyNumber: string;
  leadId: string;
  leadCode?: string;
  customerId?: string;
  customerCode?: string;
  prospectName?: string;
  siteAddress: z.infer<typeof AddressSchema>;
  roofType: RoofType;
  usableRoofAreaSqFt: number;
  grossRoofAreaSqFt?: number;
  monthlyUnitsKwh?: number;
  averageMonthlyBillPaise?: number;
  sanctionedLoadKw: number;
  connectionPhase: ConnectionPhase;
  shadowAnalysisNotes?: string;
  orientationAzimuth?: string;
  proposedCapacityKw?: number;
  surveyorEmployeeId?: string;
  surveyorName?: string;
  status: SurveyStatus;
  scheduledDate?: string;
  completedDate?: string;
  observations?: string;
  constraints?: string;
  recommendations?: string;
  photos: SurveyPhotoMetadataDto[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
