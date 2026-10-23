import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { LeadStatus, LeadSource, LeadPriority, SolarRequirement } from '@ins-solar/shared';

export interface ILeadLocation {
  street?: string;
  city: string;
  district?: string;
  state: string;
  pinCode?: string;
  geoCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ILeadDocument extends Document {
  _id: Types.ObjectId;
  leadCode: string;
  prospectName: string;
  prospectPhone: string;
  prospectEmail?: string;
  companyName?: string;
  location: ILeadLocation;
  source: LeadSource;
  solarRequirement: SolarRequirement;
  estimatedCapacityKw?: number;
  assignedToEmployeeId?: Types.ObjectId;
  status: LeadStatus;
  lostReason?: string;
  priority: LeadPriority;
  notes?: string;
  nextFollowUpDate?: Date;
  isActive: boolean;
  convertedCustomerId?: Types.ObjectId;
  convertedAt?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadLocationSchema = new Schema<ILeadLocation>(
  {
    street: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    pinCode: { type: String, trim: true },
    geoCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  { _id: false }
);

const LeadSchema = new Schema<ILeadDocument>(
  {
    leadCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    prospectName: {
      type: String,
      required: true,
      trim: true
    },
    prospectPhone: {
      type: String,
      required: true,
      trim: true,
      index: true // Explicit non-unique index for fast duplicate checks without rejecting legitimate shared numbers
    },
    prospectEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    companyName: {
      type: String,
      trim: true
    },
    location: {
      type: LeadLocationSchema,
      required: true
    },
    source: {
      type: String,
      enum: Object.values(LeadSource),
      default: LeadSource.OTHER
    },
    solarRequirement: {
      type: String,
      enum: Object.values(SolarRequirement),
      default: SolarRequirement.RESIDENTIAL
    },
    estimatedCapacityKw: {
      type: Number,
      min: 0.1
    },
    assignedToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
      index: true
    },
    lostReason: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: Object.values(LeadPriority),
      default: LeadPriority.MEDIUM
    },
    notes: {
      type: String,
      trim: true
    },
    nextFollowUpDate: {
      type: Date,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    convertedCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true
    },
    convertedAt: {
      type: Date
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
    collection: 'leads'
  }
);

// Compound indexes for CRM queries and pipeline dashboards
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ assignedToEmployeeId: 1, status: 1 });
LeadSchema.index({ isActive: 1, createdAt: -1 });

export const Lead: Model<ILeadDocument> =
  (mongoose.models.Lead as Model<ILeadDocument>) ||
  mongoose.model<ILeadDocument>('Lead', LeadSchema);
