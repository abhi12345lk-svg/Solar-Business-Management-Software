/**
 * INS Solar Business Management Software — Service Complaint Model
 *
 * Tracks post-commissioning break-fix tickets, customer complaints, warranty
 * coverage assessments, and resolution lifecycle.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintSource,
  ProjectPriority
} from '@ins-solar/shared';

export interface IComplaintNote {
  note: string;
  authorId?: Types.ObjectId;
  authorName: string;
  createdAt: Date;
}

export interface IComplaintAttachment {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId;
}

export interface IComplaintStatusTransition {
  status: ComplaintStatus;
  transitionedAt: Date;
  transitionedBy: Types.ObjectId;
  transitionedByName: string;
  notes?: string;
  reason?: string;
}

export interface IServiceComplaintDocument extends Document {
  complaintNumber: string;
  customerId: Types.ObjectId;
  projectId: Types.ObjectId;
  orderId?: Types.ObjectId;
  productId?: Types.ObjectId;
  serialNumber?: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ProjectPriority;
  severity: ComplaintSeverity;
  reportedDate: Date;
  preferredVisitTime?: string;
  contactPreference: 'PHONE' | 'WHATSAPP' | 'EMAIL';
  source: ComplaintSource;
  status: ComplaintStatus;
  assignedTechnicianId?: Types.ObjectId;
  isWarrantyCovered: boolean;
  linkedAmcId?: Types.ObjectId;
  linkedVisitIds: Types.ObjectId[];
  resolutionSummary?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  closedAt?: Date;
  reopenReason?: string;
  reopenedAt?: Date;
  internalNotes: IComplaintNote[];
  customerNotes: IComplaintNote[];
  attachments: IComplaintAttachment[];
  statusHistory: IComplaintStatusTransition[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintNoteSchema = new Schema<IComplaintNote>(
  {
    note: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ComplaintAttachmentSchema = new Schema<IComplaintAttachment>(
  {
    storageKey: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const ComplaintStatusTransitionSchema = new Schema<IComplaintStatusTransition>(
  {
    status: { type: String, enum: Object.values(ComplaintStatus), required: true },
    transitionedAt: { type: Date, default: Date.now },
    transitionedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transitionedByName: { type: String, required: true },
    notes: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const ServiceComplaintSchema = new Schema<IServiceComplaintDocument>(
  {
    complaintNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: Object.values(ComplaintCategory),
      default: ComplaintCategory.OTHER,
      index: true
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      default: ProjectPriority.MEDIUM,
      index: true
    },
    severity: {
      type: String,
      enum: Object.values(ComplaintSeverity),
      default: ComplaintSeverity.MINOR
    },
    reportedDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    preferredVisitTime: {
      type: String,
      trim: true
    },
    contactPreference: {
      type: String,
      enum: ['PHONE', 'WHATSAPP', 'EMAIL'],
      default: 'PHONE'
    },
    source: {
      type: String,
      enum: Object.values(ComplaintSource),
      default: ComplaintSource.INTERNAL_STAFF,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ComplaintStatus),
      default: ComplaintStatus.OPEN,
      index: true
    },
    assignedTechnicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    isWarrantyCovered: {
      type: Boolean,
      default: false
    },
    linkedAmcId: {
      type: Schema.Types.ObjectId,
      ref: 'AnnualMaintenanceContract',
      default: null,
      index: true
    },
    linkedVisitIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ServiceVisit'
      }
    ],
    resolutionSummary: {
      type: String,
      trim: true
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    reopenReason: {
      type: String,
      trim: true
    },
    reopenedAt: {
      type: Date,
      default: null
    },
    internalNotes: [ComplaintNoteSchema],
    customerNotes: [ComplaintNoteSchema],
    attachments: [ComplaintAttachmentSchema],
    statusHistory: [ComplaintStatusTransitionSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'service_complaints'
  }
);

ServiceComplaintSchema.index({ customerId: 1, status: 1 });
ServiceComplaintSchema.index({ projectId: 1, status: 1 });
ServiceComplaintSchema.index({ assignedTechnicianId: 1, status: 1 });

export const ServiceComplaint = mongoose.model<IServiceComplaintDocument>(
  'ServiceComplaint',
  ServiceComplaintSchema
);
