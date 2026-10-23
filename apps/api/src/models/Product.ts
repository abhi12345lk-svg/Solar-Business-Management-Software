/**
 * INS Solar Business Management Software — Product Master Catalog Model
 *
 * Authoritative master data for solar hardware components (panels, inverters, structures, etc.).
 *
 * CRITICAL ARCHITECTURAL CONVENTIONS:
 * 1. Rates are stored strictly in integer paise (1 INR = 100 paise) to prevent floating-point drift.
 * 2. Case-insensitive SKU uniqueness is enforced via normalized uppercase indexing (`skuNormalized`).
 * 3. NO authoritative stock balances are stored directly on this master document.
 *    Inventory balances and movement transactions belong strictly to separate ledger collections.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { UnitOfMeasurement } from '@ins-solar/shared';

export interface IProductWarrantySubdocument {
  warrantyYears?: number;
  warrantyType?: string;
  terms?: string;
}

export interface IProductDocument extends Omit<Document, 'model'> {
  _id: Types.ObjectId;
  productCode: string;
  sku: string;
  skuNormalized: string;
  name: string;
  description?: string;
  categoryId: Types.ObjectId;
  brand: string;
  model: any;
  productType: string;
  technicalSpecifications?: Record<string, any>;
  uom: UnitOfMeasurement;
  hsnSacCode?: string;
  standardPurchaseRatePaise: number;
  standardSellingRatePaise: number;
  taxProfileCode: string;
  minimumStockThreshold: number;
  isActive: boolean;
  warranty?: IProductWarrantySubdocument;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductWarrantySchema = new Schema<IProductWarrantySubdocument>(
  {
    warrantyYears: {
      type: Number,
      min: 0,
      max: 50
    },
    warrantyType: {
      type: String,
      trim: true,
      maxlength: 100
    },
    terms: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  { _id: false }
);

const ProductSchema = new Schema<any>(
  {
    productCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    skuNormalized: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductCategory',
      required: true,
      index: true
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    productType: {
      type: String,
      required: true,
      trim: true,
      default: 'OTHER',
      index: true
    },
    technicalSpecifications: {
      type: Schema.Types.Mixed,
      default: {}
    },
    uom: {
      type: String,
      enum: Object.values(UnitOfMeasurement),
      default: UnitOfMeasurement.NOS
    },
    hsnSacCode: {
      type: String,
      trim: true,
      index: true
    },
    standardPurchaseRatePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'standardPurchaseRatePaise must be an exact integer paise value.'
      }
    },
    standardSellingRatePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'standardSellingRatePaise must be an exact integer paise value.'
      }
    },
    taxProfileCode: {
      type: String,
      required: true,
      trim: true,
      default: 'TAX_SOLAR_STANDARD'
    },
    minimumStockThreshold: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'minimumStockThreshold must be an integer.'
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    warranty: {
      type: ProductWarrantySchema
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
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

// Indexes
ProductSchema.index({ categoryId: 1, isActive: 1 });
ProductSchema.index({ brand: 1, productType: 1, isActive: 1 });
ProductSchema.index({ name: 'text', model: 'text', brand: 'text', sku: 'text' });

export const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);
