/**
 * INS Solar Business Management Software — Quotation Model
 *
 * Implements immutable commercial proposal snapshots, revision history (R0, R1),
 * strict integer paise financial summary, GST tax profile snapshots, and discount approval tracking.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { QuotationStatus, QuotationItemType, SolarTopology } from '@ins-solar/shared';

export interface IQuotationLineItem {
  itemType: QuotationItemType;
  productId?: Types.ObjectId;
  sku?: string;
  description: string;
  quantity: number;
  unit: string;
  unitRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstRateBasisPoints: number;
  cgstAmountPaise: number;
  sgstRateBasisPoints: number;
  sgstAmountPaise: number;
  igstRateBasisPoints: number;
  igstAmountPaise: number;
  totalTaxAmountPaise: number;
  totalAmountPaise: number;
}

export interface IQuotationDocument extends Document {
  _id: Types.ObjectId;
  quotationNumber: string; // e.g. "QT-2026-00001" (base sequence key)
  revisionNumber: number; // 0 for R0, 1 for R1, etc.
  fullQuotationCode: string; // e.g. "QT-2026-00001-R0" (unique compound index)
  isLatestRevision: boolean;
  parentQuotationId?: Types.ObjectId; // Reference to prior revision

  customerId: Types.ObjectId;
  leadId?: Types.ObjectId;
  solarDesignId?: Types.ObjectId;
  systemTopology: SolarTopology;
  systemCapacityKwp: number;

  lineItems: IQuotationLineItem[];

  // Financial Summary in Integer Paise
  subtotalPaise: number;
  totalLineDiscountPaise: number;
  additionalDiscountPaise: number;
  totalDiscountPaise: number;
  discountPercent: number;
  taxableAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxAmountPaise: number;
  netTotalPaise: number;

  // Discount Approval Workflow
  requiresDiscountApproval: boolean;
  isDiscountApproved: boolean;
  discountApprovalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  discountApprovedBy?: Types.ObjectId;
  discountApprovedAt?: Date;
  discountRemarks?: string;
  discountRejectionReason?: string;

  // Customer Decision
  acceptedAt?: Date;
  acceptedByCustomerId?: Types.ObjectId;
  rejectionReason?: string;
  decisionIpAddress?: string;
  customerNotes?: string;

  // Tax Profile Snapshot
  taxProfile: {
    profileCode: string;
    profileName: string;
    isInterState: boolean;
    effectiveDate: Date;
    accountingNotice: string;
  };

  termsAndConditions: string[];
  paymentMilestones: Array<{
    milestoneName: string;
    percentage: number;
    dueTrigger?: string;
  }>;

  validUntil: Date;
  status: QuotationStatus;

  documentMetadata?: {
    storageKey?: string;
    generatedAt?: Date;
    fileSizeBytes?: number;
    mimeType?: string;
  };

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationLineItemSchema = new Schema<IQuotationLineItem>(
  {
    itemType: {
      type: String,
      enum: Object.values(QuotationItemType),
      required: true
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 250 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, trim: true, default: 'NOS' },
    unitRatePaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    taxableAmountPaise: { type: Number, required: true, min: 0 },
    gstRateBasisPoints: { type: Number, required: true, min: 0, max: 4000 },
    cgstRateBasisPoints: { type: Number, default: 0 },
    cgstAmountPaise: { type: Number, default: 0 },
    sgstRateBasisPoints: { type: Number, default: 0 },
    sgstAmountPaise: { type: Number, default: 0 },
    igstRateBasisPoints: { type: Number, default: 0 },
    igstAmountPaise: { type: Number, default: 0 },
    totalTaxAmountPaise: { type: Number, required: true, min: 0 },
    totalAmountPaise: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotationDocument>(
  {
    quotationNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    revisionNumber: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    fullQuotationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    isLatestRevision: {
      type: Boolean,
      default: true,
      index: true
    },
    parentQuotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation'
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true
    },
    solarDesignId: {
      type: Schema.Types.ObjectId,
      ref: 'SolarDesign',
      index: true
    },
    systemTopology: {
      type: String,
      enum: Object.values(SolarTopology),
      required: true
    },
    systemCapacityKwp: {
      type: Number,
      required: true,
      min: 0.1
    },
    lineItems: [QuotationLineItemSchema],

    // Integer Paise Financials
    subtotalPaise: { type: Number, required: true, min: 0 },
    totalLineDiscountPaise: { type: Number, required: true, min: 0 },
    additionalDiscountPaise: { type: Number, required: true, min: 0, default: 0 },
    totalDiscountPaise: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, required: true, min: 0, default: 0 },
    taxableAmountPaise: { type: Number, required: true, min: 0 },
    cgstAmountPaise: { type: Number, required: true, min: 0, default: 0 },
    sgstAmountPaise: { type: Number, required: true, min: 0, default: 0 },
    igstAmountPaise: { type: Number, required: true, min: 0, default: 0 },
    totalTaxAmountPaise: { type: Number, required: true, min: 0 },
    netTotalPaise: { type: Number, required: true, min: 0 },

    // Discount Approval
    requiresDiscountApproval: { type: Boolean, default: false, index: true },
    isDiscountApproved: { type: Boolean, default: false },
    discountApprovalStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NOT_REQUIRED',
      index: true
    },
    discountApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    discountApprovedAt: { type: Date },
    discountRemarks: { type: String, trim: true },
    discountRejectionReason: { type: String, trim: true },

    // Customer Decision
    acceptedAt: { type: Date },
    acceptedByCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    rejectionReason: { type: String, trim: true },
    decisionIpAddress: { type: String, trim: true },
    customerNotes: { type: String, trim: true },

    // Tax Profile Snapshot
    taxProfile: {
      profileCode: { type: String, required: true, trim: true },
      profileName: { type: String, required: true, trim: true },
      isInterState: { type: Boolean, required: true, default: false },
      effectiveDate: { type: Date, required: true, default: Date.now },
      accountingNotice: { type: String, required: true }
    },

    termsAndConditions: [{ type: String, trim: true }],
    paymentMilestones: [
      {
        milestoneName: { type: String, required: true, trim: true },
        percentage: { type: Number, required: true },
        dueTrigger: { type: String, trim: true }
      }
    ],

    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(QuotationStatus),
      default: QuotationStatus.DRAFT,
      index: true
    },

    documentMetadata: {
      storageKey: { type: String, trim: true },
      generatedAt: { type: Date },
      fileSizeBytes: { type: Number },
      mimeType: { type: String, trim: true }
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

QuotationSchema.index({ quotationNumber: 1, revisionNumber: -1 });
QuotationSchema.index({ customerId: 1, status: 1, createdAt: -1 });
QuotationSchema.index({ leadId: 1, createdAt: -1 });
QuotationSchema.index({ status: 1, createdAt: -1 });
QuotationSchema.index({ isLatestRevision: 1, status: 1 });

export const Quotation: Model<IQuotationDocument> =
  mongoose.models.Quotation || mongoose.model<IQuotationDocument>('Quotation', QuotationSchema);
