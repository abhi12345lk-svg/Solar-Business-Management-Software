/**
 * INS Solar Business Management Software — ProductSerialNumber Model
 *
 * Tracks individual high-value serialized hardware assets (solar modules, inverters, batteries).
 * Preserves current custody/warehouse location, status, order allocation, and complete movement history.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { SerialNumberStatus, WarrantyStatus } from '@ins-solar/shared';

export interface IProductSerialNumberDocument extends Document {
  serialNumber: string;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  status: SerialNumberStatus;
  orderId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  movementHistory: Types.ObjectId[];
  registeredBy: Types.ObjectId;
  notes?: string;
  // Warranty & Commissioning Tracking (Phase 7B)
  warrantyStartDate?: Date;
  warrantyEndDate?: Date;
  warrantyTerms?: string;
  supplierWarrantyReference?: string;
  commissioningDate?: Date;
  warrantyStatus?: WarrantyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSerialNumberSchema = new Schema<IProductSerialNumberDocument>(
  {
    serialNumber: {
      type: String,
      required: true,
      unique: true,
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(SerialNumberStatus),
      required: true,
      default: SerialNumberStatus.IN_STOCK,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true
    },
    movementHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: 'StockMovement'
      }
    ],
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      trim: true
    },
    warrantyStartDate: {
      type: Date,
      default: null
    },
    warrantyEndDate: {
      type: Date,
      default: null,
      index: true
    },
    warrantyTerms: {
      type: String,
      trim: true
    },
    supplierWarrantyReference: {
      type: String,
      trim: true
    },
    commissioningDate: {
      type: Date,
      default: null
    },
    warrantyStatus: {
      type: String,
      enum: Object.values(WarrantyStatus),
      default: WarrantyStatus.ACTIVE,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'product_serial_numbers'
  }
);

ProductSerialNumberSchema.index({ productId: 1, warehouseId: 1, status: 1 });
ProductSerialNumberSchema.index({ customerId: 1, warrantyStatus: 1 });
ProductSerialNumberSchema.index({ projectId: 1, warrantyStatus: 1 });

export const ProductSerialNumber = mongoose.model<IProductSerialNumberDocument>(
  'ProductSerialNumber',
  ProductSerialNumberSchema
);
