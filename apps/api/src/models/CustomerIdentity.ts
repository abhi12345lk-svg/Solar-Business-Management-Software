import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICustomerIdentityDocument extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  customerCode?: string;
  name: string;
  email?: string;
  phone?: string;
  magicLinkTokenHash?: string;
  magicLinkExpiresAt?: Date;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts: number;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerIdentitySchema = new Schema<ICustomerIdentityDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    customerCode: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      index: true
    },
    magicLinkTokenHash: {
      type: String,
      index: true
    },
    magicLinkExpiresAt: {
      type: Date
    },
    otpHash: {
      type: String
    },
    otpExpiresAt: {
      type: Date
    },
    otpAttempts: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id?.toString();
        ret.customerId = ret.customerId?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.magicLinkTokenHash;
        delete ret.otpHash;
        return ret;
      }
    }
  }
);

export const CustomerIdentity: Model<ICustomerIdentityDocument> =
  mongoose.models.CustomerIdentity ||
  mongoose.model<ICustomerIdentityDocument>('CustomerIdentity', CustomerIdentitySchema);
