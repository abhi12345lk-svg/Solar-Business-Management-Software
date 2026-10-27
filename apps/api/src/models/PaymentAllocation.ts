/**
 * INS Solar Business Management Software — PaymentAllocation Model
 *
 * Implements the operational ledger allocating verified customer receipts
 * to confirmed sales orders with concurrency safety, tenant boundary validation,
 * and reversible allocation history.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { PaymentAllocationStatus } from '@ins-solar/shared';

export interface IPaymentAllocationDocument extends Document {
  allocationNumber: string;
  paymentId: Types.ObjectId;
  salesOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  allocatedAmountPaise: number;
  allocationDate: Date;
  status: PaymentAllocationStatus;
  allocatedBy: Types.ObjectId;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalReason?: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocationDocument>(
  {
    allocationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerPayment',
      required: true,
      index: true
    },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    allocatedAmountPaise: {
      type: Number,
      required: true,
      min: 1
    },
    allocationDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: Object.values(PaymentAllocationStatus),
      default: PaymentAllocationStatus.ACTIVE,
      required: true,
      index: true
    },
    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
    notes: {
      type: String,
      trim: true
    },
    idempotencyKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true,
    collection: 'payment_allocations'
  }
);

PaymentAllocationSchema.index({ paymentId: 1, status: 1 });
PaymentAllocationSchema.index({ salesOrderId: 1, status: 1 });
PaymentAllocationSchema.index({ customerId: 1, status: 1 });

export const PaymentAllocation = mongoose.model<IPaymentAllocationDocument>(
  'PaymentAllocation',
  PaymentAllocationSchema
);
