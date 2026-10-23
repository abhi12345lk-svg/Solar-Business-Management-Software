/**
 * INS Solar Business Management Software — Warehouse & Location Model
 *
 * Supports multi-location inventory tracking across central warehouses, transit points,
 * installation project sites, and field employee custody.
 *
 * CRITICAL ARCHITECTURAL CONVENTIONS:
 * 1. Physical deletion of warehouse documents is strictly prohibited to preserve historical stock integrity.
 *    Only soft deactivation (`isActive: false`) is supported.
 * 2. Uniqueness of location codes is enforced at the database layer.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { WarehouseType } from '@ins-solar/shared';

export interface IWarehouseAddressSubdocument {
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

export interface IWarehouseDocument extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  type: WarehouseType;
  address?: IWarehouseAddressSubdocument;
  managerId?: Types.ObjectId;
  custodianEmployeeId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseAddressSchema = new Schema<IWarehouseAddressSubdocument>(
  {
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 150
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 100
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    district: {
      type: String,
      trim: true,
      maxlength: 80
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    stateCode: {
      type: String,
      trim: true,
      match: [/^\d{2}$/, 'State code must be 2 digits']
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      match: [/^[1-9][0-9]{5}$/, 'Indian PIN code must be 6 digits not starting with 0']
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    geoCoordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    }
  },
  { _id: false }
);

const WarehouseSchema = new Schema<IWarehouseDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      minlength: 2,
      maxlength: 30,
      index: true
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
    type: {
      type: String,
      enum: Object.values(WarehouseType),
      required: true,
      index: true
    },
    address: {
      type: WarehouseAddressSchema
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    custodianEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
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
WarehouseSchema.index({ type: 1, isActive: 1 });
WarehouseSchema.index({ name: 'text', code: 'text' });

export const Warehouse: Model<IWarehouseDocument> =
  mongoose.models.Warehouse || mongoose.model<IWarehouseDocument>('Warehouse', WarehouseSchema);
