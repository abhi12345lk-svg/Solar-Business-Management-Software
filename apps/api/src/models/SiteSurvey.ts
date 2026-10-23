import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  SurveyStatus,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory,
  AddressType
} from '@ins-solar/shared';
import { IAddressSubdocument } from './Customer.js';

export interface ISurveyPhotoSubdocument {
  _id?: Types.ObjectId;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  category: SurveyPhotoCategory;
  caption?: string;
  geoCoordinates?: {
    latitude: number;
    longitude: number;
  };
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
}

export interface ISiteSurveyDocument extends Document {
  _id: Types.ObjectId;
  surveyNumber: string;
  leadId: Types.ObjectId;
  customerId?: Types.ObjectId;
  siteAddress: IAddressSubdocument;
  roofType: RoofType;
  usableRoofAreaSqFt: number;
  grossRoofAreaSqFt?: number;
  monthlyUnitsKwh?: number;
  averageMonthlyBillPaise?: number;
  sanctionedLoadKw: number;
  connectionPhase: ConnectionPhase;
  shadowAnalysisNotes?: string;
  orientationAzimuth?: string;
  proposedCapacityKw?: number;
  surveyorEmployeeId?: Types.ObjectId;
  status: SurveyStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  observations?: string;
  constraints?: string;
  recommendations?: string;
  photos: ISurveyPhotoSubdocument[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SurveyAddressSubSchema = new Schema<IAddressSubdocument>(
  {
    type: {
      type: String,
      enum: Object.values(AddressType),
      default: AddressType.SITE_INSTALLATION
    },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    stateCode: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },
    geoCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  { _id: false }
);

const SurveyPhotoSubSchema = new Schema<ISurveyPhotoSubdocument>(
  {
    storageKey: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, required: true },
    mimeType: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: Object.values(SurveyPhotoCategory),
      default: SurveyPhotoCategory.OTHER
    },
    caption: { type: String, trim: true },
    geoCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const SiteSurveySchema = new Schema<ISiteSurveyDocument>(
  {
    surveyNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true
    },
    siteAddress: {
      type: SurveyAddressSubSchema,
      required: true
    },
    roofType: {
      type: String,
      enum: Object.values(RoofType),
      required: true
    },
    usableRoofAreaSqFt: {
      type: Number,
      required: true,
      min: 0
    },
    grossRoofAreaSqFt: {
      type: Number,
      min: 0
    },
    monthlyUnitsKwh: {
      type: Number,
      min: 0
    },
    averageMonthlyBillPaise: {
      type: Number,
      min: 0
    },
    sanctionedLoadKw: {
      type: Number,
      required: true,
      min: 0.1
    },
    connectionPhase: {
      type: String,
      enum: Object.values(ConnectionPhase),
      default: ConnectionPhase.SINGLE
    },
    shadowAnalysisNotes: {
      type: String,
      trim: true
    },
    orientationAzimuth: {
      type: String,
      trim: true
    },
    proposedCapacityKw: {
      type: Number,
      min: 0.1
    },
    surveyorEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    status: {
      type: String,
      enum: Object.values(SurveyStatus),
      default: SurveyStatus.DRAFT,
      index: true
    },
    scheduledDate: {
      type: Date
    },
    completedDate: {
      type: Date
    },
    observations: {
      type: String,
      trim: true
    },
    constraints: {
      type: String,
      trim: true
    },
    recommendations: {
      type: String,
      trim: true
    },
    photos: {
      type: [SurveyPhotoSubSchema],
      default: []
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
    collection: 'site_surveys'
  }
);

SiteSurveySchema.index({ leadId: 1, createdAt: -1 });
SiteSurveySchema.index({ status: 1, createdAt: -1 });
SiteSurveySchema.index({ surveyorEmployeeId: 1, status: 1 });

export const SiteSurvey: Model<ISiteSurveyDocument> =
  (mongoose.models.SiteSurvey as Model<ISiteSurveyDocument>) ||
  mongoose.model<ISiteSurveyDocument>('SiteSurvey', SiteSurveySchema);
