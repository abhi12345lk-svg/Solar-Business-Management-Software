import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { CustomerType, CustomerStatus, AddressType } from '@ins-solar/shared';

export interface IAddressSubdocument {
  type: AddressType;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  stateCode?: string;
  postalCode: string;
  country: string;
  geoCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface IContactPersonSubdocument {
  name: string;
  phone: string;
  email?: string;
  designation?: string;
}

export interface ICustomerDocument extends Document {
  _id: Types.ObjectId;
  customerCode: string;
  name: string;
  companyName?: string;
  primaryPhone: string;
  email?: string;
  type: CustomerType | 'INDIVIDUAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'INSTITUTIONAL';
  status: CustomerStatus | 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  isActive: boolean;
  gstin?: string;
  pan?: string;
  billingAddress?: IAddressSubdocument;
  installationAddress?: IAddressSubdocument;
  contactPerson?: IContactPersonSubdocument;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AddressSubSchema = new Schema<IAddressSubdocument>(
  {
    type: {
      type: String,
      enum: Object.values(AddressType),
      default: AddressType.BILLING
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true
    },
    addressLine2: {
      type: String,
      trim: true
    },
    landmark: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    district: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    stateCode: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    geoCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  { _id: false }
);

const ContactPersonSubSchema = new Schema<IContactPersonSubdocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    designation: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

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
    companyName: {
      type: String,
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
      enum: Object.values(CustomerType),
      default: CustomerType.INDIVIDUAL,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(CustomerStatus),
      default: CustomerStatus.ACTIVE,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
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
      uppercase: true,
      sparse: true,
      index: true
    },
    billingAddress: {
      type: AddressSubSchema
    },
    installationAddress: {
      type: AddressSubSchema
    },
    contactPerson: {
      type: ContactPersonSubSchema
    },
    notes: {
      type: String,
      trim: true
    },
    tags: {
      type: [String],
      default: []
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

// Compound query indexes
CustomerSchema.index({ status: 1, type: 1 });
CustomerSchema.index({ name: 'text', companyName: 'text' });

export const Customer: Model<ICustomerDocument> =
  mongoose.models.Customer || mongoose.model<ICustomerDocument>('Customer', CustomerSchema);
