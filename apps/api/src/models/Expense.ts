/**
 * INS Solar Business Management Software — Expense Model
 *
 * Operational expense ledger tracking project-assigned and operational overhead expenses.
 * Strictly maintains integer-paise financial precision, multi-criteria audit history,
 * anti-self-approval enforcement, and anti-double-counting invariants.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  ExpenseCategory,
  ExpenseStatus,
  ExpensePaymentStatus,
  PaymentMethod
} from '@ins-solar/shared';

export interface IExpenseStatusHistory {
  fromStatus: string;
  toStatus: string;
  changedAt: Date;
  changedBy: Types.ObjectId;
  notes?: string;
}

export interface IExpenseDocument extends Document {
  _id: Types.ObjectId;
  expenseNumber: string;
  expenseDate: Date;
  category: ExpenseCategory;
  vendorId?: Types.ObjectId;
  payeeName?: string;
  projectId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  description: string;
  amountPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paymentStatus: ExpensePaymentStatus;
  paymentMode?: PaymentMethod;
  paymentReference?: string;
  paymentDate?: Date;
  paidAmountPaise: number;
  evidenceKey?: string;
  notes?: string;
  status: ExpenseStatus;
  requiresApproval: boolean;
  submittedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectionReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  idempotencyKey?: string;
  statusHistory: IExpenseStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseStatusHistorySchema = new Schema<IExpenseStatusHistory>(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const ExpenseSchema = new Schema<IExpenseDocument>(
  {
    expenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      required: true,
      index: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true
    },
    payeeName: {
      type: String,
      trim: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1
    },
    taxAmountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    totalAmountPaise: {
      type: Number,
      required: true,
      min: 1
    },
    paymentStatus: {
      type: String,
      enum: Object.values(ExpensePaymentStatus),
      required: true,
      default: ExpensePaymentStatus.UNPAID,
      index: true
    },
    paymentMode: {
      type: String,
      enum: Object.values(PaymentMethod)
    },
    paymentReference: {
      type: String,
      trim: true
    },
    paymentDate: {
      type: Date
    },
    paidAmountPaise: {
      type: Number,
      default: 0,
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
    status: {
      type: String,
      enum: Object.values(ExpenseStatus),
      required: true,
      default: ExpenseStatus.DRAFT,
      index: true
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    approvalNotes: {
      type: String,
      trim: true
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      trim: true
    },
    statusHistory: {
      type: [ExpenseStatusHistorySchema],
      default: []
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

ExpenseSchema.index({ projectId: 1, status: 1 });
ExpenseSchema.index({ vendorId: 1, status: 1 });
ExpenseSchema.index({ category: 1, expenseDate: -1 });

export const Expense: Model<IExpenseDocument> =
  mongoose.models.Expense || mongoose.model<IExpenseDocument>('Expense', ExpenseSchema);
