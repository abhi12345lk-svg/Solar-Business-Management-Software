/**
 * INS Solar Business Management Software — Annual Maintenance Contract (AMC) Model
 *
 * Tracks recurring maintenance agreements, covered hardware assets, periodic service
 * cadences, included vs consumed visits, and lifecycle renewals.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  AmcBillingCadence,
  AmcPaymentStatus
} from '@ins-solar/shared';

export interface IAmcCoveredEquipment {
  productId?: Types.ObjectId | string;
  serialNumber?: string;
  description: string;
}

export interface IAmcStatusTransition {
  status: AmcStatus;
  transitionedAt: Date;
  transitionedBy: Types.ObjectId;
  transitionedByName: string;
  notes?: string;
  reason?: string;
}

export interface IAnnualMaintenanceContractDocument extends Document {
  amcNumber: string;
  customerId: Types.ObjectId;
  projectId: Types.ObjectId;
  planType: AmcPlanType;
  capacityKwp: number;
  startDate: Date;
  endDate: Date;
  contractAmountPaise: number;
  billingCadence: AmcBillingCadence;
  paymentStatus: AmcPaymentStatus;
  visitCadence: AmcVisitCadence;
  includedVisits: number;
  consumedVisits: number;
  chargeableVisits: number;
  coveredEquipment: IAmcCoveredEquipment[];
  scopeOfWork?: string;
  exclusions?: string;
  slaCommitments?: string;
  status: AmcStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  cancellationReason?: string;
  renewalNoticeSentAt?: Date;
  previousAmcId?: Types.ObjectId;
  successorAmcId?: Types.ObjectId;
  notes?: string;
  statusHistory: IAmcStatusTransition[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AmcCoveredEquipmentSchema = new Schema<IAmcCoveredEquipment>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    serialNumber: { type: String, trim: true, uppercase: true },
    description: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const AmcStatusTransitionSchema = new Schema<IAmcStatusTransition>(
  {
    status: { type: String, enum: Object.values(AmcStatus), required: true },
    transitionedAt: { type: Date, default: Date.now },
    transitionedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transitionedByName: { type: String, required: true },
    notes: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const AnnualMaintenanceContractSchema = new Schema<IAnnualMaintenanceContractDocument>(
  {
    amcNumber: {
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
    planType: {
      type: String,
      enum: Object.values(AmcPlanType),
      default: AmcPlanType.COMPREHENSIVE,
      index: true
    },
    capacityKwp: {
      type: Number,
      required: true,
      min: 0.1
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    contractAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    billingCadence: {
      type: String,
      enum: Object.values(AmcBillingCadence),
      default: AmcBillingCadence.ANNUAL
    },
    paymentStatus: {
      type: String,
      enum: Object.values(AmcPaymentStatus),
      default: AmcPaymentStatus.PENDING,
      index: true
    },
    visitCadence: {
      type: String,
      enum: Object.values(AmcVisitCadence),
      default: AmcVisitCadence.QUARTERLY
    },
    includedVisits: {
      type: Number,
      required: true,
      min: 1,
      default: 4
    },
    consumedVisits: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    chargeableVisits: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    coveredEquipment: [AmcCoveredEquipmentSchema],
    scopeOfWork: {
      type: String,
      trim: true
    },
    exclusions: {
      type: String,
      trim: true
    },
    slaCommitments: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(AmcStatus),
      default: AmcStatus.DRAFT,
      index: true
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    renewalNoticeSentAt: {
      type: Date,
      default: null
    },
    previousAmcId: {
      type: Schema.Types.ObjectId,
      ref: 'AnnualMaintenanceContract',
      default: null
    },
    successorAmcId: {
      type: Schema.Types.ObjectId,
      ref: 'AnnualMaintenanceContract',
      default: null
    },
    notes: {
      type: String,
      trim: true
    },
    statusHistory: [AmcStatusTransitionSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'annual_maintenance_contracts'
  }
);

AnnualMaintenanceContractSchema.index({ customerId: 1, status: 1 });
AnnualMaintenanceContractSchema.index({ projectId: 1, status: 1 });
AnnualMaintenanceContractSchema.index({ status: 1, endDate: 1 });

export const AnnualMaintenanceContract = mongoose.model<IAnnualMaintenanceContractDocument>(
  'AnnualMaintenanceContract',
  AnnualMaintenanceContractSchema
);
