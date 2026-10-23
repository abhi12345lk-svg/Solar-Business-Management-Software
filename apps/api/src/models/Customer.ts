import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ICustomerDocument extends Document {
  _id: Types.ObjectId;
  customerCode: string;
  name: string;
  primaryPhone: string;
  email?: string;
  type: 'INDIVIDUAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'INSTITUTIONAL';
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomerDocument>(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    primaryPhone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    type: {
      type: String,
      enum: ['INDIVIDUAL', 'COMMERCIAL', 'INDUSTRIAL', 'INSTITUTIONAL'],
      default: 'INDIVIDUAL'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLACKLISTED'],
      default: 'ACTIVE',
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

export const Customer: Model<ICustomerDocument> =
  mongoose.models.Customer || mongoose.model<ICustomerDocument>('Customer', CustomerSchema);
