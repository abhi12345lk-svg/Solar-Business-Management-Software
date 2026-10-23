/**
 * INS Solar Business Management Software — SolarDesign Model
 *
 * Persists engineered solar system designs linked to Customer, Lead, and Site Survey.
 * Captures equipment selection, physical topology, sizing metrics, and generation yields.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { SolarTopology, RoofType } from '@ins-solar/shared';

export interface ISolarDesignDocument extends Document {
  _id: Types.ObjectId;
  designNumber: string; // e.g. "DES-2026-00001" (unique, indexed)
  customerId: Types.ObjectId;
  leadId?: Types.ObjectId;
  surveyId?: Types.ObjectId;
  designName: string;
  systemTopology: SolarTopology;
  proposedCapacityKwp: number;

  module: {
    productId: Types.ObjectId;
    name: string;
    sku: string;
    wattageWp: number;
    quantity: number;
    totalDcCapacityKwp: number;
  };

  inverter: {
    productId: Types.ObjectId;
    name: string;
    sku: string;
    ratedCapacityKw: number;
    quantity: number;
    actualDcAcRatio: number;
  };

  battery?: {
    productId?: Types.ObjectId;
    name?: string;
    sku?: string;
    nominalVoltageV?: number;
    capacityAh?: number;
    quantity?: number;
    totalStorageKwh?: number;
    autonomyDays?: number;
  };

  structure: {
    structureType: RoofType;
    tiltDegrees: number;
    azimuthDegrees: number;
    notes?: string;
  };

  estimatedGeneration: {
    dailyGenerationKwh: number;
    monthlyGenerationKwh: number;
    annualGenerationKwh: number;
    specificYieldKwhPerKwp: number;
  };

  assumptions: {
    peakSunHoursPerDay: number;
    performanceRatioPercent: number;
    assumptionsSource: string;
  };

  warnings: string[];
  disclaimer: string;
  engineeringNotes?: string;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SolarDesignSchema = new Schema<ISolarDesignDocument>(
  {
    designNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true
    },
    surveyId: {
      type: Schema.Types.ObjectId,
      ref: 'SiteSurvey',
      index: true
    },
    designName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    systemTopology: {
      type: String,
      enum: Object.values(SolarTopology),
      required: true,
      index: true
    },
    proposedCapacityKwp: {
      type: Number,
      required: true,
      min: 0.1,
      max: 10000
    },
    module: {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true, trim: true },
      sku: { type: String, required: true, trim: true },
      wattageWp: { type: Number, required: true, min: 100, max: 1000 },
      quantity: { type: Number, required: true, min: 1 },
      totalDcCapacityKwp: { type: Number, required: true, min: 0.1 }
    },
    inverter: {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true, trim: true },
      sku: { type: String, required: true, trim: true },
      ratedCapacityKw: { type: Number, required: true, min: 0.1 },
      quantity: { type: Number, required: true, min: 1, default: 1 },
      actualDcAcRatio: { type: Number, required: true }
    },
    battery: {
      productId: { type: Schema.Types.ObjectId, ref: 'Product' },
      name: { type: String, trim: true },
      sku: { type: String, trim: true },
      nominalVoltageV: { type: Number },
      capacityAh: { type: Number },
      quantity: { type: Number },
      totalStorageKwh: { type: Number },
      autonomyDays: { type: Number }
    },
    structure: {
      structureType: {
        type: String,
        enum: Object.values(RoofType),
        required: true
      },
      tiltDegrees: { type: Number, default: 15 },
      azimuthDegrees: { type: Number, default: 0 },
      notes: { type: String, trim: true, maxlength: 500 }
    },
    estimatedGeneration: {
      dailyGenerationKwh: { type: Number, required: true },
      monthlyGenerationKwh: { type: Number, required: true },
      annualGenerationKwh: { type: Number, required: true },
      specificYieldKwhPerKwp: { type: Number, required: true }
    },
    assumptions: {
      peakSunHoursPerDay: { type: Number, required: true },
      performanceRatioPercent: { type: Number, required: true },
      assumptionsSource: { type: String, required: true }
    },
    warnings: [{ type: String, trim: true }],
    disclaimer: { type: String, required: true },
    engineeringNotes: { type: String, trim: true, maxlength: 2000 },
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

SolarDesignSchema.index({ customerId: 1, createdAt: -1 });
SolarDesignSchema.index({ leadId: 1, createdAt: -1 });
SolarDesignSchema.index({ systemTopology: 1, createdAt: -1 });

export const SolarDesign: Model<ISolarDesignDocument> =
  mongoose.models.SolarDesign ||
  mongoose.model<ISolarDesignDocument>('SolarDesign', SolarDesignSchema);
