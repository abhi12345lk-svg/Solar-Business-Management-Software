/**
 * INS Solar Business Management Software — Net Metering Schemas
 */

import { z } from 'zod';
import {
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  ApplicationDocumentType,
  ApplicationDocumentStatus
} from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const applicationDocumentSchema = z.object({
  id: z.string().trim().min(1),
  documentType: z.nativeEnum(ApplicationDocumentType),
  title: z.string().trim().min(1).max(200),
  isRequired: z.boolean().default(true),
  status: z.nativeEnum(ApplicationDocumentStatus).default(ApplicationDocumentStatus.REQUIRED),
  storageKey: z.string().trim().optional(),
  fileName: z.string().trim().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().trim().optional(),
  uploadedBy: z.string().regex(OBJECT_ID_REGEX).optional(),
  uploadedAt: z.coerce.date().optional(),
  reviewedBy: z.string().regex(OBJECT_ID_REGEX).optional(),
  reviewedAt: z.coerce.date().optional(),
  reviewNotes: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
  expiryDate: z.coerce.date().optional()
});

export const createNetMeteringSchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Project ID'),
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Customer ID').optional(),
  orderId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Order ID').optional(),
  discomName: z.string().trim().min(2, 'DISCOM name must be at least 2 characters').max(100),
  division: z.string().trim().max(100).optional(),
  subdivision: z.string().trim().max(100).optional(),
  section: z.string().trim().max(100).optional(),
  consumerNumber: z.string().trim().min(2, 'Consumer / CA number is required').max(50),
  sanctionedLoadKw: z.number().positive().max(10000).optional(),
  proposedCapacityKw: z.number().positive().max(10000).optional(),
  discomApplicationNumber: z.string().trim().max(100).optional(),
  submissionDate: z.coerce.date().optional(),
  assignedUserId: z.string().regex(OBJECT_ID_REGEX).optional(),
  notes: z.string().trim().max(2000).optional()
});

export const updateNetMeteringSchema = z.object({
  discomName: z.string().trim().min(2).max(100).optional(),
  division: z.string().trim().max(100).optional(),
  subdivision: z.string().trim().max(100).optional(),
  section: z.string().trim().max(100).optional(),
  consumerNumber: z.string().trim().min(2).max(50).optional(),
  sanctionedLoadKw: z.number().positive().max(10000).optional(),
  proposedCapacityKw: z.number().positive().max(10000).optional(),
  discomApplicationNumber: z.string().trim().max(100).optional(),
  submissionDate: z.coerce.date().optional(),
  assignedUserId: z.string().regex(OBJECT_ID_REGEX).optional().nullable(),
  notes: z.string().trim().max(2000).optional()
});

export const updateNetMeteringStatusSchema = z.object({
  status: z.nativeEnum(NetMeteringStatus),
  notes: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(1000).optional()
});

export const scheduleInspectionSchema = z.object({
  scheduledDate: z.coerce.date(),
  officerName: z.string().trim().max(100).optional(),
  officerContact: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
  rescheduleReason: z.string().trim().max(1000).optional()
});

export const recordInspectionOutcomeSchema = z.object({
  outcome: z.enum([NetMeteringInspectionOutcome.PASSED, NetMeteringInspectionOutcome.FAILED]),
  inspectedDate: z.coerce.date().optional(),
  officerName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const recordMeterInstallationSchema = z.object({
  meterNumber: z.string().trim().min(2, 'Meter number is required').max(50),
  installationDate: z.coerce.date(),
  initialImportReadingKwh: z.number().nonnegative().default(0),
  initialExportReadingKwh: z.number().nonnegative().default(0),
  testedBy: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const updateFeasibilityDemandNoteSchema = z.object({
  isFeasible: z.boolean().optional(),
  feasibilityReference: z.string().trim().max(100).optional(),
  feasibilityDate: z.coerce.date().optional(),
  demandNoteAmountPaise: z
    .number()
    .int()
    .nonnegative('Demand note amount must be non-negative integer paise')
    .optional(),
  demandNotePaid: z.boolean().optional(),
  demandNotePaidDate: z.coerce.date().optional(),
  demandNoteReceiptNumber: z.string().trim().max(100).optional()
});

export const uploadApplicationDocumentSchema = z.object({
  documentType: z.nativeEnum(ApplicationDocumentType),
  title: z.string().trim().min(1).max(200).optional(),
  storageKey: z.string().trim().min(3).max(500),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024, 'File size cannot exceed 25MB'),
  mimeType: z.string().trim().min(3).max(100),
  expiryDate: z.coerce.date().optional()
});

export const reviewApplicationDocumentSchema = z.object({
  status: z.enum([
    ApplicationDocumentStatus.ACCEPTED,
    ApplicationDocumentStatus.REJECTED,
    ApplicationDocumentStatus.RESUBMISSION_REQUIRED
  ]),
  reviewNotes: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional()
});

export const netMeteringFilterSchema = z.object({
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(NetMeteringStatus).optional(),
  discomName: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'applicationNumber', 'submissionDate', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type ApplicationDocumentInput = z.input<typeof applicationDocumentSchema>;
export type ApplicationDocumentParsed = z.infer<typeof applicationDocumentSchema>;

export type CreateNetMeteringInput = z.input<typeof createNetMeteringSchema>;
export type CreateNetMeteringParsed = z.infer<typeof createNetMeteringSchema>;

export type UpdateNetMeteringInput = z.input<typeof updateNetMeteringSchema>;
export type UpdateNetMeteringParsed = z.infer<typeof updateNetMeteringSchema>;

export type UpdateNetMeteringStatusInput = z.input<typeof updateNetMeteringStatusSchema>;
export type UpdateNetMeteringStatusParsed = z.infer<typeof updateNetMeteringStatusSchema>;

export type ScheduleInspectionInput = z.input<typeof scheduleInspectionSchema>;
export type ScheduleInspectionParsed = z.infer<typeof scheduleInspectionSchema>;

export type RecordInspectionOutcomeInput = z.input<typeof recordInspectionOutcomeSchema>;
export type RecordInspectionOutcomeParsed = z.infer<typeof recordInspectionOutcomeSchema>;

export type RecordMeterInstallationInput = z.input<typeof recordMeterInstallationSchema>;
export type RecordMeterInstallationParsed = z.infer<typeof recordMeterInstallationSchema>;

export type UpdateFeasibilityDemandNoteInput = z.input<typeof updateFeasibilityDemandNoteSchema>;
export type UpdateFeasibilityDemandNoteParsed = z.infer<typeof updateFeasibilityDemandNoteSchema>;

export type UploadApplicationDocumentInput = z.input<typeof uploadApplicationDocumentSchema>;
export type UploadApplicationDocumentParsed = z.infer<typeof uploadApplicationDocumentSchema>;

export type ReviewApplicationDocumentInput = z.input<typeof reviewApplicationDocumentSchema>;
export type ReviewApplicationDocumentParsed = z.infer<typeof reviewApplicationDocumentSchema>;

export type NetMeteringFilterInput = z.input<typeof netMeteringFilterSchema>;
export type NetMeteringFilterParsed = z.infer<typeof netMeteringFilterSchema>;
