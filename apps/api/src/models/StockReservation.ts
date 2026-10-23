/**
 * INS Solar Business Management Software — StockReservation Model
 *
 * Tracks atomic stock allocations locked against confirmed sales orders.
 * Reserving stock increases reservedQuantity on StockBalance without altering physical on-hand quantity.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { StockReservationStatus } from '@ins-solar/shared';

export interface IStockReservationDocument extends Document {
  reservationNumber: string;
  orderId: Types.ObjectId;
  orderLineId?: string;
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quantity: number;
  status: StockReservationStatus;
  reservedAt: Date;
  reservedBy: Types.ObjectId;
  releasedAt?: Date;
  releasedBy?: Types.ObjectId;
  issuedAt?: Date;
  issuedBy?: Types.ObjectId;
  idempotencyKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockReservationSchema = new Schema<IStockReservationDocument>(
  {
    reservationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    orderLineId: {
      type: String,
      trim: true
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
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Reserved quantity must be strictly greater than 0.']
    },
    status: {
      type: String,
      enum: Object.values(StockReservationStatus),
      required: true,
      default: StockReservationStatus.ACTIVE,
      index: true
    },
    reservedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    reservedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    releasedAt: {
      type: Date,
      default: null
    },
    releasedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    issuedAt: {
      type: Date,
      default: null
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: 'stock_reservations'
  }
);

StockReservationSchema.index({ orderId: 1, status: 1 });
StockReservationSchema.index({ productId: 1, warehouseId: 1, status: 1 });

export const StockReservation = mongoose.model<IStockReservationDocument>(
  'StockReservation',
  StockReservationSchema
);
