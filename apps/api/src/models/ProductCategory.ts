/**
 * INS Solar Business Management Software — Product Category Model
 *
 * Supports multi-level product categorization (e.g. Solar Panels -> Monocrystalline -> TOPCon).
 * Enforces unique category codes, indexed parent hierarchies, and safe serialization.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IProductCategoryDocument extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  parentId?: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductCategorySchema = new Schema<IProductCategoryDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      minlength: 2,
      maxlength: 30
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null,
      index: true
    },
    ancestors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
        index: true
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true
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
ProductCategorySchema.index({ parentId: 1, isActive: 1 });
ProductCategorySchema.index({ isActive: 1, name: 1 });

export const ProductCategory: Model<IProductCategoryDocument> =
  mongoose.models.ProductCategory ||
  mongoose.model<IProductCategoryDocument>('ProductCategory', ProductCategorySchema);
