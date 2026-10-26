/**
 * INS Solar Business Management Software — NetMeteringApplication Model
 *
 * Tracks utility grid interconnection / net-metering applications, document completeness,
 * DISCOM inspection scheduling, demand notes, and bi-directional meter installation.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  ApplicationDocumentType,
  ApplicationDocumentStatus
} from '@ins-solar/shared';

export interface IApplicationDocument {
  id: string;
  documentType: ApplicationDocumentType;
  title: string;
  isRequired: boolean;
  status: ApplicationDocumentStatus;
  storageKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: Types.ObjectId;
  uploadedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  rejectionReason?: string;
  expiryDate?: Date;
}

export interface INetMeteringStatusHistory {
  status: NetMeteringStatus;
  changedAt: Date;
  changedBy: Types.ObjectId;
  notes?: string;
  reason?: string;
}

export interface IInspectionSchedule {
  scheduledDate?: Date;
  outcome: NetMeteringInspectionOutcome;
  inspectedDate?: Date;
  officerName?: string;
  officerContact?: string;
  notes?: string;
  rescheduleReason?: string;
}

export interface IMeterInstallation {
  meterInstalled: boolean;
  meterNumber?: string;
  installationDate?: Date;
  initialImportReadingKwh?: number;
  initialExportReadingKwh?: number;
  testedBy?: string;
  notes?: string;
}

export interface IFeasibilityDemandNote {
  isFeasible?: boolean;
  feasibilityReference?: string;
  feasibilityDate?: Date;
  demandNoteAmountPaise?: number;
  demandNotePaid?: boolean;
  demandNotePaidDate?: Date;
  demandNoteReceiptNumber?: string;
}

export interface INetMeteringApplicationDocument extends Document {
  _id: Types.ObjectId;
  applicationNumber: string;
  projectId: Types.ObjectId;
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  discomName: string;
  division?: string;
  subdivision?: string;
  section?: string;
  consumerNumber: string;
  sanctionedLoadKw?: number;
  proposedCapacityKw?: number;
  discomApplicationNumber?: string;
  submissionDate?: Date;
  status: NetMeteringStatus;
  inspectionSchedule: IInspectionSchedule;
  meterInstallation: IMeterInstallation;
  feasibility: IFeasibilityDemandNote;
  assignedUserId?: Types.ObjectId;
  documents: IApplicationDocument[];
  statusHistory: INetMeteringStatusHistory[];
  notes?: string;
  rejectionReason?: string;
  approvalDate?: Date;
  rejectionDate?: Date;
  closureNotes?: string;
  closedAt?: Date;
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

const StatusHistorySubSchema = new Schema<INetMeteringStatusHistory>(
  {
    status: {
      type: String,
      enum: Object.values(NetMeteringStatus),
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const NetMeteringApplicationSchema = new Schema<INetMeteringApplicationDocument>(
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
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder'
    },
    discomName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    division: { type: String, trim: true },
    subdivision: { type: String, trim: true },
    section: { type: String, trim: true },
    consumerNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    sanctionedLoadKw: { type: Number, min: 0 },
    proposedCapacityKw: { type: Number, min: 0 },
    discomApplicationNumber: { type: String, trim: true },
    submissionDate: { type: Date },
    status: {
      type: String,
      enum: Object.values(NetMeteringStatus),
      default: NetMeteringStatus.DRAFT,
      index: true
    },
    inspectionSchedule: {
      scheduledDate: { type: Date },
      outcome: {
        type: String,
        enum: Object.values(NetMeteringInspectionOutcome),
        default: NetMeteringInspectionOutcome.PENDING
      },
      inspectedDate: { type: Date },
      officerName: { type: String, trim: true },
      officerContact: { type: String, trim: true },
      notes: { type: String, trim: true },
      rescheduleReason: { type: String, trim: true }
    },
    meterInstallation: {
      meterInstalled: { type: Boolean, default: false },
      meterNumber: { type: String, trim: true },
      installationDate: { type: Date },
      initialImportReadingKwh: { type: Number, min: 0, default: 0 },
      initialExportReadingKwh: { type: Number, min: 0, default: 0 },
      testedBy: { type: String, trim: true },
      notes: { type: String, trim: true }
    },
    feasibility: {
      isFeasible: { type: Boolean },
      feasibilityReference: { type: String, trim: true },
      feasibilityDate: { type: Date },
      demandNoteAmountPaise: { type: Number, min: 0 },
      demandNotePaid: { type: Boolean, default: false },
      demandNotePaidDate: { type: Date },
      demandNoteReceiptNumber: { type: String, trim: true }
    },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    documents: {
      type: [ApplicationDocumentSubSchema],
      default: []
    },
    statusHistory: {
      type: [StatusHistorySubSchema],
      default: []
    },
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    approvalDate: { type: Date },
    rejectionDate: { type: Date },
    closureNotes: { type: String, trim: true },
    closedAt: { type: Date }
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

NetMeteringApplicationSchema.index({ projectId: 1, status: 1 });
NetMeteringApplicationSchema.index({ customerId: 1, status: 1 });
NetMeteringApplicationSchema.index({ discomName: 1, consumerNumber: 1 });

export const NetMeteringApplication =
  (mongoose.models.NetMeteringApplication as mongoose.Model<INetMeteringApplicationDocument>) ||
  mongoose.model<INetMeteringApplicationDocument>('NetMeteringApplication', NetMeteringApplicationSchema);
