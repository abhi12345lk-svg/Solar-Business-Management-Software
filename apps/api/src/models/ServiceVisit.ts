/**
 * INS Solar Business Management Software — Service Visit Model
 *
 * Tracks physical technician field visits for break-fix complaints, scheduled AMC
 * preventive servicing, warranty inspections, and technical commissioning checks.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  ServiceVisitType,
  ServiceVisitStatus
} from '@ins-solar/shared';

export interface IVisitChecklistItem {
  item: string;
  status: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE';
  notes?: string;
}

export interface IVisitPartUsed {
  productId?: Types.ObjectId | string;
  productCode?: string;
  name: string;
  quantity: number;
  isWarrantyCovered: boolean;
  serialNumber?: string;
}

export interface IVisitEvidence {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface IVisitStatusTransition {
  status: ServiceVisitStatus;
  transitionedAt: Date;
  transitionedBy: Types.ObjectId;
  transitionedByName: string;
  notes?: string;
  reason?: string;
}

export interface IServiceVisitDocument extends Document {
  visitNumber: string;
  visitType: ServiceVisitType;
  complaintId?: Types.ObjectId;
  amcId?: Types.ObjectId;
  projectId: Types.ObjectId;
  customerId: Types.ObjectId;
  assignedTechnicianId: Types.ObjectId;
  scheduledDate: Date;
  scheduledTimeSlot: string;
  status: ServiceVisitStatus;
  purpose: string;
  checklist: IVisitChecklistItem[];
  meterReadingKwh?: number;
  instantaneousKw?: number;
  soilingCondition?: 'CLEAN' | 'MODERATE' | 'HEAVY';
  inverterStatus?: 'NORMAL' | 'FAULT' | 'OFFLINE';
  workPerformed?: string;
  observations?: string;
  partsRequiredOrUsed: IVisitPartUsed[];
  technicianNotes?: string;
  customerFeedback?: string;
  customerSignatureUrl?: string;
  revisitRequired: boolean;
  followUpVisitId?: Types.ObjectId;
  parentVisitId?: Types.ObjectId;
  evidencePhotos: IVisitEvidence[];
  rescheduleReason?: string;
  cancellationReason?: string;
  isAmcIncluded: boolean;
  isChargeable: boolean;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  statusHistory: IVisitStatusTransition[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VisitChecklistItemSchema = new Schema<IVisitChecklistItem>(
  {
    item: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PASSED', 'FAILED', 'NOT_APPLICABLE'], default: 'NOT_APPLICABLE' },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const VisitPartUsedSchema = new Schema<IVisitPartUsed>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    productCode: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    isWarrantyCovered: { type: Boolean, default: false },
    serialNumber: { type: String, trim: true, uppercase: true }
  },
  { _id: false }
);

const VisitEvidenceSchema = new Schema<IVisitEvidence>(
  {
    storageKey: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const VisitStatusTransitionSchema = new Schema<IVisitStatusTransition>(
  {
    status: { type: String, enum: Object.values(ServiceVisitStatus), required: true },
    transitionedAt: { type: Date, default: Date.now },
    transitionedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transitionedByName: { type: String, required: true },
    notes: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const ServiceVisitSchema = new Schema<IServiceVisitDocument>(
  {
    visitNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    visitType: {
      type: String,
      enum: Object.values(ServiceVisitType),
      required: true,
      index: true
    },
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceComplaint',
      default: null,
      index: true
    },
    amcId: {
      type: Schema.Types.ObjectId,
      ref: 'AnnualMaintenanceContract',
      default: null,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    assignedTechnicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true
    },
    scheduledTimeSlot: {
      type: String,
      default: '10:00 - 13:00'
    },
    status: {
      type: String,
      enum: Object.values(ServiceVisitStatus),
      default: ServiceVisitStatus.SCHEDULED,
      index: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true
    },
    checklist: [VisitChecklistItemSchema],
    meterReadingKwh: {
      type: Number,
      min: 0
    },
    instantaneousKw: {
      type: Number,
      min: 0
    },
    soilingCondition: {
      type: String,
      enum: ['CLEAN', 'MODERATE', 'HEAVY']
    },
    inverterStatus: {
      type: String,
      enum: ['NORMAL', 'FAULT', 'OFFLINE']
    },
    workPerformed: {
      type: String,
      trim: true
    },
    observations: {
      type: String,
      trim: true
    },
    partsRequiredOrUsed: [VisitPartUsedSchema],
    technicianNotes: {
      type: String,
      trim: true
    },
    customerFeedback: {
      type: String,
      trim: true
    },
    customerSignatureUrl: {
      type: String,
      trim: true
    },
    revisitRequired: {
      type: Boolean,
      default: false
    },
    followUpVisitId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceVisit',
      default: null
    },
    parentVisitId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceVisit',
      default: null
    },
    evidencePhotos: [VisitEvidenceSchema],
    rescheduleReason: {
      type: String,
      trim: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    isAmcIncluded: {
      type: Boolean,
      default: false
    },
    isChargeable: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    statusHistory: [VisitStatusTransitionSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'service_visits'
  }
);

ServiceVisitSchema.index({ customerId: 1, status: 1 });
ServiceVisitSchema.index({ projectId: 1, status: 1 });
ServiceVisitSchema.index({ assignedTechnicianId: 1, scheduledDate: 1 });
ServiceVisitSchema.index({ status: 1, scheduledDate: 1 });

export const ServiceVisit = mongoose.model<IServiceVisitDocument>(
  'ServiceVisit',
  ServiceVisitSchema
);
