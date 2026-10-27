/**
 * INS Solar Business Management Software — Warranty Claim Model
 *
 * Tracks equipment warranty claims submitted to component manufacturers/suppliers
 * for serialized panels, inverters, and battery systems.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  WarrantyType,
  WarrantyClaimStatus,
  WarrantyClaimResolution
} from '@ins-solar/shared';

export interface IWarrantyClaimEvidence {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface IWarrantyClaimStatusTransition {
  status: WarrantyClaimStatus;
  transitionedAt: Date;
  transitionedBy: Types.ObjectId;
  transitionedByName: string;
  notes?: string;
}

export interface IWarrantyClaimDocument extends Document {
  claimNumber: string;
  serialNumber: string;
  productId: Types.ObjectId;
  customerId: Types.ObjectId;
  projectId: Types.ObjectId;
  complaintId?: Types.ObjectId;
  manufacturerName: string;
  supplierWarrantyReference?: string;
  warrantyType: WarrantyType;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  claimDate: Date;
  issueDescription: string;
  status: WarrantyClaimStatus;
  decisionDate?: Date;
  decisionNotes?: string;
  decisionBy?: Types.ObjectId;
  replacementSerialNumber?: string;
  resolutionType?: WarrantyClaimResolution;
  evidenceFiles: IWarrantyClaimEvidence[];
  statusHistory: IWarrantyClaimStatusTransition[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarrantyClaimEvidenceSchema = new Schema<IWarrantyClaimEvidence>(
  {
    storageKey: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const WarrantyClaimStatusTransitionSchema = new Schema<IWarrantyClaimStatusTransition>(
  {
    status: { type: String, enum: Object.values(WarrantyClaimStatus), required: true },
    transitionedAt: { type: Date, default: Date.now },
    transitionedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transitionedByName: { type: String, required: true },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const WarrantyClaimSchema = new Schema<IWarrantyClaimDocument>(
  {
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    serialNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
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
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceComplaint',
      default: null,
      index: true
    },
    manufacturerName: {
      type: String,
      required: true,
      trim: true
    },
    supplierWarrantyReference: {
      type: String,
      trim: true
    },
    warrantyType: {
      type: String,
      enum: Object.values(WarrantyType),
      default: WarrantyType.MANUFACTURER_STANDARD
    },
    warrantyStartDate: {
      type: Date,
      required: true
    },
    warrantyEndDate: {
      type: Date,
      required: true,
      index: true
    },
    claimDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    issueDescription: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(WarrantyClaimStatus),
      default: WarrantyClaimStatus.SUBMITTED,
      index: true
    },
    decisionDate: {
      type: Date,
      default: null
    },
    decisionNotes: {
      type: String,
      trim: true
    },
    decisionBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    replacementSerialNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    resolutionType: {
      type: String,
      enum: Object.values(WarrantyClaimResolution),
      default: null
    },
    evidenceFiles: [WarrantyClaimEvidenceSchema],
    statusHistory: [WarrantyClaimStatusTransitionSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'warranty_claims'
  }
);

WarrantyClaimSchema.index({ serialNumber: 1, status: 1 });
WarrantyClaimSchema.index({ customerId: 1, status: 1 });
WarrantyClaimSchema.index({ projectId: 1, status: 1 });

export const WarrantyClaim = mongoose.model<IWarrantyClaimDocument>(
  'WarrantyClaim',
  WarrantyClaimSchema
);
