/**
 * INS Solar Business Management Software — Phase 7B Service, Warranty, AMC & Service Visits Schemas
 */

import { z } from 'zod';
import {
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintSource,
  ProjectPriority,
  WarrantyStatus,
  WarrantyType,
  WarrantyClaimStatus,
  WarrantyClaimResolution,
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  AmcBillingCadence,
  AmcPaymentStatus,
  ServiceVisitType,
  ServiceVisitStatus
} from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// -----------------------------------------------------------------------------
// Service Complaint Schemas
// -----------------------------------------------------------------------------

export const createServiceComplaintSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Valid Customer ID required').optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Valid Project ID required'),
  orderId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Order ID').optional(),
  productId: z.string().regex(OBJECT_ID_REGEX, 'Invalid Product ID').optional(),
  serialNumber: z.string().trim().max(100).optional(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(3000),
  category: z.nativeEnum(ComplaintCategory).default(ComplaintCategory.OTHER),
  priority: z.nativeEnum(ProjectPriority).default(ProjectPriority.MEDIUM),
  severity: z.nativeEnum(ComplaintSeverity).default(ComplaintSeverity.MINOR),
  reportedDate: z.coerce.date().default(() => new Date()),
  preferredVisitTime: z.string().trim().max(100).optional(),
  contactPreference: z.enum(['PHONE', 'WHATSAPP', 'EMAIL']).default('PHONE'),
  source: z.nativeEnum(ComplaintSource).default(ComplaintSource.INTERNAL_STAFF),
  internalNotes: z.string().trim().max(2000).optional()
});

export const updateServiceComplaintSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(3000).optional(),
  category: z.nativeEnum(ComplaintCategory).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  severity: z.nativeEnum(ComplaintSeverity).optional(),
  preferredVisitTime: z.string().trim().max(100).optional(),
  contactPreference: z.enum(['PHONE', 'WHATSAPP', 'EMAIL']).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  customerNotes: z.string().trim().max(2000).optional()
});

export const complaintStatusTransitionSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  notes: z.string().trim().max(2000).optional(),
  resolutionSummary: z.string().trim().min(5, 'Resolution summary is required to resolve/close').max(3000).optional()
});

export const assignComplaintSchema = z.object({
  assignedTechnicianId: z.string().regex(OBJECT_ID_REGEX, 'Valid Technician User ID required'),
  notes: z.string().trim().max(1000).optional()
});

export const reopenComplaintSchema = z.object({
  reason: z.string().trim().min(5, 'Reason for reopening must be provided').max(2000)
});

export const complaintFilterSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  assignedTechnicianId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(ComplaintStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  category: z.nativeEnum(ComplaintCategory).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// -----------------------------------------------------------------------------
// Warranty & Claim Schemas
// -----------------------------------------------------------------------------

export const updateWarrantyRecordSchema = z.object({
  serialNumber: z.string().trim().min(1).max(100),
  warrantyStartDate: z.coerce.date(),
  warrantyEndDate: z.coerce.date(),
  warrantyTerms: z.string().trim().max(2000).optional(),
  supplierWarrantyReference: z.string().trim().max(100).optional(),
  commissioningDate: z.coerce.date().optional(),
  warrantyStatus: z.nativeEnum(WarrantyStatus).optional()
});

export const createWarrantyClaimSchema = z.object({
  serialNumber: z.string().trim().min(1, 'Serial number is required').max(100),
  productId: z.string().regex(OBJECT_ID_REGEX, 'Valid Product ID required'),
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Valid Customer ID required').optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Valid Project ID required'),
  complaintId: z.string().regex(OBJECT_ID_REGEX).optional(),
  manufacturerName: z.string().trim().min(2).max(100),
  supplierWarrantyReference: z.string().trim().max(100).optional(),
  warrantyType: z.nativeEnum(WarrantyType).default(WarrantyType.MANUFACTURER_STANDARD),
  issueDescription: z.string().trim().min(10, 'Detailed issue description required').max(3000),
  claimDate: z.coerce.date().default(() => new Date())
});

export const decideWarrantyClaimSchema = z.object({
  status: z.enum([
    WarrantyClaimStatus.APPROVED,
    WarrantyClaimStatus.REJECTED,
    WarrantyClaimStatus.REPLACED,
    WarrantyClaimStatus.REPAIRED,
    WarrantyClaimStatus.SETTLED,
    WarrantyClaimStatus.CANCELLED
  ]),
  resolutionType: z.nativeEnum(WarrantyClaimResolution).optional(),
  decisionNotes: z.string().trim().min(5, 'Decision notes are required').max(2000),
  replacementSerialNumber: z.string().trim().max(100).optional()
});

export const warrantyFilterSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  productId: z.string().regex(OBJECT_ID_REGEX).optional(),
  serialNumber: z.string().trim().optional(),
  status: z.nativeEnum(WarrantyStatus).optional(),
  expiringInDays: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const warrantyClaimFilterSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  serialNumber: z.string().trim().optional(),
  status: z.nativeEnum(WarrantyClaimStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// -----------------------------------------------------------------------------
// AMC (Annual Maintenance Contract) Schemas
// -----------------------------------------------------------------------------

export const createAmcSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX, 'Valid Customer ID required'),
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Valid Project ID required'),
  planType: z.nativeEnum(AmcPlanType).default(AmcPlanType.COMPREHENSIVE),
  capacityKwp: z.number().positive('Capacity in kWp must be positive'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  contractAmountPaise: z.number().int().nonnegative('Contract amount must be a positive integer in paise'),
  billingCadence: z.nativeEnum(AmcBillingCadence).default(AmcBillingCadence.ANNUAL),
  visitCadence: z.nativeEnum(AmcVisitCadence).default(AmcVisitCadence.QUARTERLY),
  includedVisits: z.number().int().positive('Included visits must be at least 1').default(4),
  scopeOfWork: z.string().trim().max(3000).optional(),
  exclusions: z.string().trim().max(3000).optional(),
  slaCommitments: z.string().trim().max(2000).optional(),
  coveredEquipment: z
    .array(
      z.object({
        productId: z.string().regex(OBJECT_ID_REGEX).optional(),
        serialNumber: z.string().trim().optional(),
        description: z.string().trim().max(200)
      })
    )
    .optional()
    .default([]),
  notes: z.string().trim().max(2000).optional()
});

export const updateAmcSchema = z.object({
  planType: z.nativeEnum(AmcPlanType).optional(),
  capacityKwp: z.number().positive().optional(),
  contractAmountPaise: z.number().int().nonnegative().optional(),
  billingCadence: z.nativeEnum(AmcBillingCadence).optional(),
  visitCadence: z.nativeEnum(AmcVisitCadence).optional(),
  includedVisits: z.number().int().positive().optional(),
  scopeOfWork: z.string().trim().max(3000).optional(),
  exclusions: z.string().trim().max(3000).optional(),
  slaCommitments: z.string().trim().max(2000).optional(),
  paymentStatus: z.nativeEnum(AmcPaymentStatus).optional(),
  notes: z.string().trim().max(2000).optional()
});

export const amcStatusTransitionSchema = z.object({
  status: z.nativeEnum(AmcStatus),
  reason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const renewAmcSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  contractAmountPaise: z.number().int().nonnegative('Contract amount in paise required'),
  includedVisits: z.number().int().positive().default(4),
  billingCadence: z.nativeEnum(AmcBillingCadence).optional(),
  visitCadence: z.nativeEnum(AmcVisitCadence).optional(),
  notes: z.string().trim().max(1000).optional()
});

export const amcFilterSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(AmcStatus).optional(),
  planType: z.nativeEnum(AmcPlanType).optional(),
  expiringInDays: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// -----------------------------------------------------------------------------
// Service Visit Schemas
// -----------------------------------------------------------------------------

export const createServiceVisitSchema = z.object({
  visitType: z.nativeEnum(ServiceVisitType),
  complaintId: z.string().regex(OBJECT_ID_REGEX).optional(),
  amcId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX, 'Valid Project ID required'),
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  assignedTechnicianId: z.string().regex(OBJECT_ID_REGEX, 'Valid Technician User ID required'),
  scheduledDate: z.coerce.date(),
  scheduledTimeSlot: z.string().trim().max(100).default('10:00 - 13:00'),
  purpose: z.string().trim().min(3, 'Visit purpose is required').max(1000),
  checklist: z
    .array(
      z.object({
        item: z.string().trim().min(1).max(200),
        status: z.enum(['PASSED', 'FAILED', 'NOT_APPLICABLE']).default('NOT_APPLICABLE'),
        notes: z.string().trim().max(500).optional()
      })
    )
    .optional()
    .default([]),
  technicianNotes: z.string().trim().max(2000).optional()
});

export const updateServiceVisitSchema = z.object({
  assignedTechnicianId: z.string().regex(OBJECT_ID_REGEX).optional(),
  scheduledDate: z.coerce.date().optional(),
  scheduledTimeSlot: z.string().trim().max(100).optional(),
  purpose: z.string().trim().max(1000).optional(),
  checklist: z
    .array(
      z.object({
        item: z.string().trim().min(1).max(200),
        status: z.enum(['PASSED', 'FAILED', 'NOT_APPLICABLE']),
        notes: z.string().trim().max(500).optional()
      })
    )
    .optional(),
  technicianNotes: z.string().trim().max(2000).optional()
});

export const completeServiceVisitSchema = z.object({
  workPerformed: z.string().trim().min(5, 'Work performed summary is required').max(3000),
  observations: z.string().trim().max(2000).optional(),
  meterReadingKwh: z.number().nonnegative().optional(),
  instantaneousKw: z.number().nonnegative().optional(),
  soilingCondition: z.enum(['CLEAN', 'MODERATE', 'HEAVY']).optional(),
  inverterStatus: z.enum(['NORMAL', 'FAULT', 'OFFLINE']).optional(),
  checklist: z
    .array(
      z.object({
        item: z.string().trim().min(1),
        status: z.enum(['PASSED', 'FAILED', 'NOT_APPLICABLE']),
        notes: z.string().trim().max(500).optional()
      })
    )
    .optional(),
  partsRequiredOrUsed: z
    .array(
      z.object({
        productId: z.string().regex(OBJECT_ID_REGEX).optional(),
        productCode: z.string().trim().optional(),
        name: z.string().trim().min(1),
        quantity: z.number().positive(),
        isWarrantyCovered: z.boolean().default(false),
        serialNumber: z.string().trim().optional()
      })
    )
    .optional()
    .default([]),
  customerFeedback: z.string().trim().max(1000).optional(),
  revisitRequired: z.boolean().default(false),
  technicianNotes: z.string().trim().max(2000).optional()
});

export const rescheduleServiceVisitSchema = z.object({
  newDate: z.coerce.date(),
  newTimeSlot: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(5, 'Rescheduling reason is required').max(1000)
});

export const serviceVisitFilterSchema = z.object({
  customerId: z.string().regex(OBJECT_ID_REGEX).optional(),
  projectId: z.string().regex(OBJECT_ID_REGEX).optional(),
  complaintId: z.string().regex(OBJECT_ID_REGEX).optional(),
  amcId: z.string().regex(OBJECT_ID_REGEX).optional(),
  assignedTechnicianId: z.string().regex(OBJECT_ID_REGEX).optional(),
  status: z.nativeEnum(ServiceVisitStatus).optional(),
  visitType: z.nativeEnum(ServiceVisitType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
