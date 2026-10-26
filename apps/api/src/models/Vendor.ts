import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IVendorDocument extends Document {
  _id: Types.ObjectId;
  vendorCode: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  gstin?: string;
  pan?: string;
  suppliedCategoryIds: Types.ObjectId[];
  suppliedProductIds: Types.ObjectId[];
  paymentTermsDays: number;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  leadTimeDays?: number;
  notes?: string;
  isActive: boolean;
  hasPurchaseHistory: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendorDocument>(
  {
    vendorCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    contactPerson: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, default: 'India', trim: true }
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      index: true
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true
    },
    suppliedCategoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory'
      }
    ],
    suppliedProductIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    paymentTermsDays: {
      type: Number,
      default: 30,
      min: 0
    },
    bankDetails: {
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true }
    },
    leadTimeDays: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    hasPurchaseHistory: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

VendorSchema.index({ name: 'text', contactPerson: 'text', gstin: 'text' });

export const Vendor: Model<IVendorDocument> =
  mongoose.models.Vendor || mongoose.model<IVendorDocument>('Vendor', VendorSchema);
