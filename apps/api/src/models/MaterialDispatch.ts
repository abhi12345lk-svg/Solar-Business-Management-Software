/**
 * INS Solar Business Management Software — MaterialDispatch Model
 *
 * Tracks physical material issues and site dispatch slips from warehouse inventory
 * to project installation sites. Maintains atomic alignment with StockBalance,
 * ProductSerialNumber, and StockMovement ledgers.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { MaterialDispatchStatus } from '@ins-solar/shared';

export interface IDispatchLineItem {
  productId: Types.ObjectId;
  requestedQuantity: number;
  issuedQuantity: number;
  serialNumbers?: string[];
  stockMovementId?: Types.ObjectId;
}

export interface IMaterialDispatchDocument extends Document {
  _id: Types.ObjectId;
  dispatchNumber: string;
  projectId: Types.ObjectId;
  orderId?: Types.ObjectId;
  sourceWarehouseId: Types.ObjectId;
  destinationSiteAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  lineItems: IDispatchLineItem[];
  status: MaterialDispatchStatus;
  dispatchedBy: Types.ObjectId;
  dispatchedAt: Date;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchLineItemSchema = new Schema<IDispatchLineItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    issuedQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    serialNumbers: {
      type: [String],
      default: []
    },
    stockMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'StockMovement'
    }
  },
  { _id: true }
);

const MaterialDispatchSchema = new Schema<IMaterialDispatchDocument>(
  {
    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      index: true
    },
    sourceWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true
    },
    destinationSiteAddress: {
      addressLine1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true }
    },
    lineItems: {
      type: [DispatchLineItemSchema],
      required: true,
      validate: [(val: any[]) => val && val.length > 0, 'At least one line item is required']
    },
    status: {
      type: String,
      enum: Object.values(MaterialDispatchStatus),
      default: MaterialDispatchStatus.DISPATCHED,
      required: true,
      index: true
    },
    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    dispatchedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    vehicleNumber: { type: String, trim: true },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    notes: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
MaterialDispatchSchema.index({ projectId: 1, status: 1 });
MaterialDispatchSchema.index({ sourceWarehouseId: 1, dispatchedAt: -1 });

export const MaterialDispatch = mongoose.model<IMaterialDispatchDocument>(
  'MaterialDispatch',
  MaterialDispatchSchema
);
