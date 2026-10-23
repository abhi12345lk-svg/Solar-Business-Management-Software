/**
 * INS Solar Business Management Software — StockMovement Model
 *
 * Append-only immutable ledger of all physical stock movements, receipts,
 * reservations, issues, transfers, and returns.
 * Modifications or deletions are strictly blocked; corrections must be
 * recorded as explicit compensating movements with isReversal: true.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { StockMovementType } from '@ins-solar/shared';

export interface IStockMovementDocument extends Document {
  movementNumber: string;
  productId: Types.ObjectId;
  quantity: number;
  movementType: StockMovementType;
  sourceWarehouseId?: Types.ObjectId;
  destinationWarehouseId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  reservationId?: Types.ObjectId;
  serialNumbers?: string[];
  performedBy: Types.ObjectId;
  reason: string;
  reference?: string;
  idempotencyKey?: string;
  isReversal: boolean;
  reversalOfMovementId?: Types.ObjectId;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovementDocument>(
  {
    movementNumber: {
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
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Movement quantity must be strictly greater than 0.']
    },
    movementType: {
      type: String,
      enum: Object.values(StockMovementType),
      required: true,
      index: true
    },
    sourceWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
      index: true
    },
    destinationWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockReservation',
      default: null
    },
    serialNumbers: {
      type: [String],
      default: []
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    reference: {
      type: String,
      trim: true
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    isReversal: {
      type: Boolean,
      required: true,
      default: false
    },
    reversalOfMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'StockMovement',
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable append-only record
    collection: 'stock_movements'
  }
);

StockMovementSchema.index({ productId: 1, createdAt: -1 });
StockMovementSchema.index({ movementType: 1, createdAt: -1 });

export const StockMovement = mongoose.model<IStockMovementDocument>(
  'StockMovement',
  StockMovementSchema
);
