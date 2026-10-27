/**
 * INS Solar Business Management Software — CustomerPayment Model
 *
 * Tracks customer monetary inflows, atomic receipt numbers, payment verification,
 * unallocated credit balances, and audited reversal/refund lifecycles.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { PaymentMethod, CustomerPaymentStatus } from '@ins-solar/shared';

export interface IPaymentStatusTransition {
  fromStatus: string;
  toStatus: string;
  changedAt: Date;
  changedBy: Types.ObjectId;
  notes?: string;
}

export interface ICustomerPaymentDocument extends Document {
  receiptNumber: string;
  customerId: Types.ObjectId;
  amountPaise: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  status: CustomerPaymentStatus;
  allocatedAmountPaise: number;
  unallocatedAmountPaise: number;
  evidenceKey?: string;
  notes?: string;
  internalNotes?: string;
  idempotencyKey?: string;
  recordedBy: Types.ObjectId;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  verificationNotes?: string;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalReason?: string;
  refundReference?: string;
  refundedAt?: Date;
  refundedBy?: Types.ObjectId;
  refundReason?: string;
  refundAmountPaise?: number;
  statusHistory: IPaymentStatusTransition[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentStatusTransitionSchema = new Schema<IPaymentStatusTransition>(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const CustomerPaymentSchema = new Schema<ICustomerPaymentDocument>(
  {
    receiptNumber: {
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
    amountPaise: {
      type: Number,
      required: true,
      min: 1
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
      index: true
    },
    transactionReference: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(CustomerPaymentStatus),
      default: CustomerPaymentStatus.RECORDED,
      required: true,
      index: true
    },
    allocatedAmountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    unallocatedAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    evidenceKey: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    internalNotes: {
      type: String,
      trim: true
    },
    idempotencyKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: {
      type: Date
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reversedAt: {
      type: Date
    },
    reversalReason: {
      type: String,
      trim: true
    },
    refundReference: {
      type: String,
      trim: true
    },
    refundedAt: {
      type: Date
    },
    refundedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    refundReason: {
      type: String,
      trim: true
    },
    refundAmountPaise: {
      type: Number,
      min: 1
    },
    statusHistory: [PaymentStatusTransitionSchema]
  },
  {
    timestamps: true,
    collection: 'customer_payments'
  }
);

CustomerPaymentSchema.index({ customerId: 1, status: 1 });
CustomerPaymentSchema.index({ paymentDate: -1, status: 1 });
CustomerPaymentSchema.index({ transactionReference: 1, customerId: 1 }, { sparse: true });

export const CustomerPayment = mongoose.model<ICustomerPaymentDocument>(
  'CustomerPayment',
  CustomerPaymentSchema
);
