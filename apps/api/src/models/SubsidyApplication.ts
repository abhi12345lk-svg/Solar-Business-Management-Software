/**
 * INS Solar Business Management Software — SubsidyApplication Model
 *
 * Tracks central and state solar subsidy schemes (e.g. PM Surya Ghar Muft Bijli Yojana),
 * eligibility verification, claim submission, sanctions, and partial/full disbursements.
 * Enforces integer paise, monotonic disbursements, and idempotency guarantees.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  SubsidyStatus,
  DisbursementMode,
  ApplicationDocumentType,
  ApplicationDocumentStatus
} from '@ins-solar/shared';
import { IApplicationDocument } from './NetMeteringApplication.js';

export interface IDisbursementRecord {
  disbursementId: string;
  disbursementReference: string;
  amountPaise: number;
  disbursedAt: Date;
  paymentMode: DisbursementMode;
  recipientAccount: string;
  idempotencyKey: string;
  recordedBy: Types.ObjectId;
  notes?: string;
}

export interface ISubsidyStatusHistory {
  status: SubsidyStatus;
  changedAt: Date;
  changedBy: Types.ObjectId;
  notes?: string;
  reason?: string;
}

export interface ISubsidyApplicationDocument extends Document {
  _id: Types.ObjectId;
  applicationNumber: string;
  projectId: Types.ObjectId;
  customerId: Types.ObjectId;
  netMeteringApplicationId?: Types.ObjectId;
  schemeName: string;
  schemeVersion?: string;
  effectivePeriod?: string;
  portalApplicationNumber?: string;
  submissionDate?: Date;
  systemCapacityKw: number;
  estimatedAmountPaise: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  disbursedAmountPaise: number;
  status: SubsidyStatus;
  sanctionReference?: string;
  sanctionDate?: Date;
  rejectionReason?: string;
  rejectionDate?: Date;
  eligibilityVerified: boolean;
  eligibilityNotes?: string;
  assignedUserId?: Types.ObjectId;
  documents: IApplicationDocument[];
  disbursements: IDisbursementRecord[];
  statusHistory: ISubsidyStatusHistory[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationDocumentSubSchema = new Schema<IApplicationDocument>(
  {
    id: { type: String, required: true },
    documentType: {
      type: String,
      enum: Object.values(ApplicationDocumentType),
      required: true
    },
    title: { type: String, required: true, trim: true },
    isRequired: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(ApplicationDocumentStatus),
      default: ApplicationDocumentStatus.REQUIRED
    },
    storageKey: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    expiryDate: { type: Date }
  },
  { _id: false }
);

const DisbursementRecordSubSchema = new Schema<IDisbursementRecord>(
  {
    disbursementId: { type: String, required: true },
    disbursementReference: { type: String, required: true, trim: true },
    amountPaise: { type: Number, required: true, min: 1 },
    disbursedAt: { type: Date, required: true },
    paymentMode: {
      type: String,
      enum: Object.values(DisbursementMode),
      default: DisbursementMode.DIRECT_BENEFIT_TRANSFER
    },
    recipientAccount: { type: String, required: true, trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const SubsidyStatusHistorySubSchema = new Schema<ISubsidyStatusHistory>(
  {
    status: {
      type: String,
      enum: Object.values(SubsidyStatus),
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const SubsidyApplicationSchema = new Schema<ISubsidyApplicationDocument>(
  {
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
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
    netMeteringApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'NetMeteringApplication'
    },
    schemeName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    schemeVersion: { type: String, trim: true },
    effectivePeriod: { type: String, trim: true },
    portalApplicationNumber: { type: String, trim: true, index: true },
    submissionDate: { type: Date },
    systemCapacityKw: { type: Number, required: true, min: 0.1 },
    estimatedAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'estimatedAmountPaise must be an integer'
      }
    },
    requestedAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'requestedAmountPaise must be an integer'
      }
    },
    approvedAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'approvedAmountPaise must be an integer'
      }
    },
    disbursedAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'disbursedAmountPaise must be an integer'
      }
    },
    status: {
      type: String,
      enum: Object.values(SubsidyStatus),
      default: SubsidyStatus.ELIGIBLE,
      index: true
    },
    sanctionReference: { type: String, trim: true },
    sanctionDate: { type: Date },
    rejectionReason: { type: String, trim: true },
    rejectionDate: { type: Date },
    eligibilityVerified: { type: Boolean, default: false },
    eligibilityNotes: { type: String, trim: true },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    documents: {
      type: [ApplicationDocumentSubSchema],
      default: []
    },
    disbursements: {
      type: [DisbursementRecordSubSchema],
      default: []
    },
    statusHistory: {
      type: [SubsidyStatusHistorySubSchema],
      default: []
    },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

SubsidyApplicationSchema.index({ projectId: 1, status: 1 });
SubsidyApplicationSchema.index({ customerId: 1, status: 1 });
SubsidyApplicationSchema.index({ 'disbursements.idempotencyKey': 1 });
SubsidyApplicationSchema.index({ 'disbursements.disbursementReference': 1 });

export const SubsidyApplication =
  (mongoose.models.SubsidyApplication as mongoose.Model<ISubsidyApplicationDocument>) ||
  mongoose.model<ISubsidyApplicationDocument>('SubsidyApplication', SubsidyApplicationSchema);
