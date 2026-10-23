/**
 * INS Solar Business Management Software — StockBalance Model
 *
 * Real-time location-scoped inventory projections.
 * Maintains atomic physical on-hand quantity, reserved quantity, and available quantity.
 * Compound unique index on { productId, warehouseId } guarantees one authoritative
 * projection record per product-location tuple.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStockBalanceDocument extends Document {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const StockBalanceSchema = new Schema<IStockBalanceDocument>(
  {
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
    onHandQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'On-hand quantity cannot be negative.']
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative.']
    },
    availableQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Available quantity cannot be negative.']
    },
    version: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'stock_balances'
  }
);

// Compound unique index ensuring single balance projection per product-location tuple
StockBalanceSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
StockBalanceSchema.index({ warehouseId: 1, availableQuantity: -1 });

export const StockBalance = mongoose.model<IStockBalanceDocument>(
  'StockBalance',
  StockBalanceSchema
);
