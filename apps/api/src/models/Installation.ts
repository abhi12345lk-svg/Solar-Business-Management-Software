/**
 * INS Solar Business Management Software — Installation Model
 *
 * Persists end-to-end solar system installation lifecycle records conducted
 * by field crews and installers at customer sites.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  InstallationStatus,
  SitePhotoCategory,
  TechnicalManualCategory
} from '@ins-solar/shared';

export interface ISitePhoto {
  _id?: Types.ObjectId;
  category: SitePhotoCategory;
  title: string;
  storageKey?: string;
  fileUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes?: number;
  uploadedAt: Date;
  timestamp: Date;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  remarks?: string;
}

export interface IEquipmentItemDetail {
  name: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  barcode: string;
  rating: string;
  photoUrl?: string;
  remarks?: string;
}

export interface IPanelDetails {
  totalPanels: number;
  manufacturer: string;
  model: string;
  wattagePerPanel: number;
  calculatedTotalCapacityKw: number;
  panelSerialNumbers: string[];
  panelBarcodes: string[];
  remarks?: string;
}

export interface IInventoryRow {
  _id?: Types.ObjectId;
  itemNumber: number;
  equipmentName: string;
  barcode: string;
  serialNumber: string;
  model: string;
  quantity: number;
  status: 'VERIFIED' | 'PENDING' | 'DEFECTIVE' | 'INSTALLED';
  scannedAt?: Date;
  remarks?: string;
}

export interface IGpsLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: Date;
  isVerified: boolean;
  googleMapsUrl?: string;
}

export interface ITechnicalManual {
  _id?: Types.ObjectId;
  category: TechnicalManualCategory;
  title: string;
  storageKey?: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId;
}

export interface IInstallationHistory {
  action: string;
  performedBy: Types.ObjectId;
  performedByName: string;
  timestamp: Date;
  notes?: string;
}

export interface IInstallationDocument extends Document {
  _id: Types.ObjectId;
  installationNumber: string;
  customerId: Types.ObjectId;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  projectId?: Types.ObjectId;
  projectCode?: string;
  projectName?: string;
  siteAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    district?: string;
    state: string;
    postalCode: string;
  };
  systemCapacityKw: number;
  assignedInstallerId?: Types.ObjectId;
  assignedInstallerName?: string;
  assignedBy?: Types.ObjectId;
  installationDate?: Date;
  completedDate?: Date;
  status: InstallationStatus;
  rejectionReason?: string;
  adminRemarks?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  currentStep: number;
  isDraft: boolean;

  // Equipment Components (Sections A to F)
  earthingSystem: IEquipmentItemDetail;
  solarStructure: IEquipmentItemDetail;
  solarPanels: IEquipmentItemDetail;
  lightningProtection: IEquipmentItemDetail;
  inverter: IEquipmentItemDetail;
  netMeter: IEquipmentItemDetail;

  // Solar Panel Quantity Management
  panelDetails: IPanelDetails;

  // Equipment Inventory Table with Barcode Scanner
  inventoryItems: IInventoryRow[];

  // Max 10 Site Photographs
  photos: ISitePhoto[];

  // Verified GPS Live Location
  location?: IGpsLocation;

  // Technical Manuals & Compliance Documents
  manuals: ITechnicalManual[];

  // Audit / Action History
  history: IInstallationHistory[];

  createdAt: Date;
  updatedAt: Date;
}

const SitePhotoSchema = new Schema<ISitePhoto>(
  {
    category: {
      type: String,
      enum: Object.values(SitePhotoCategory),
      required: true
    },
    title: { type: String, required: true, trim: true },
    storageKey: { type: String, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    timestamp: { type: Date, default: Date.now },
    gpsLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracyMeters: { type: Number }
    },
    remarks: { type: String, trim: true }
  },
  { _id: true }
);

const EquipmentItemDetailSchema = new Schema<IEquipmentItemDetail>(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    modelNumber: { type: String, default: '', trim: true },
    serialNumber: { type: String, default: '', trim: true },
    barcode: { type: String, default: '', trim: true },
    rating: { type: String, default: '', trim: true },
    photoUrl: { type: String, trim: true },
    remarks: { type: String, trim: true }
  },
  { _id: false }
);

const PanelDetailsSchema = new Schema<IPanelDetails>(
  {
    totalPanels: { type: Number, default: 0, min: 0 },
    manufacturer: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    wattagePerPanel: { type: Number, default: 0, min: 0 },
    calculatedTotalCapacityKw: { type: Number, default: 0, min: 0 },
    panelSerialNumbers: { type: [String], default: [] },
    panelBarcodes: { type: [String], default: [] },
    remarks: { type: String, trim: true }
  },
  { _id: false }
);

const InventoryRowSchema = new Schema<IInventoryRow>(
  {
    itemNumber: { type: Number, required: true },
    equipmentName: { type: String, required: true, trim: true },
    barcode: { type: String, default: '', trim: true },
    serialNumber: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'DEFECTIVE', 'INSTALLED'],
      default: 'VERIFIED'
    },
    scannedAt: { type: Date },
    remarks: { type: String, trim: true }
  },
  { _id: true }
);

const GpsLocationSchema = new Schema<IGpsLocation>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracyMeters: { type: Number, default: 0 },
    capturedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    googleMapsUrl: { type: String, trim: true }
  },
  { _id: false }
);

const TechnicalManualSchema = new Schema<ITechnicalManual>(
  {
    category: {
      type: String,
      enum: Object.values(TechnicalManualCategory),
      required: true
    },
    title: { type: String, required: true, trim: true },
    storageKey: { type: String, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: true }
);

const InstallationHistorySchema = new Schema<IInstallationHistory>(
  {
    action: { type: String, required: true, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const InstallationSchema = new Schema<IInstallationDocument>(
  {
    installationNumber: {
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
    customerCode: { type: String, required: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true, index: true },
    customerPhone: { type: String, required: true, trim: true },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true
    },
    projectCode: { type: String, trim: true },
    projectName: { type: String, trim: true },
    siteAddress: {
      addressLine1: { type: String, default: '', trim: true },
      addressLine2: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      district: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      postalCode: { type: String, default: '', trim: true }
    },
    systemCapacityKw: { type: Number, default: 0, min: 0 },
    assignedInstallerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedInstallerName: { type: String, trim: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    installationDate: { type: Date },
    completedDate: { type: Date },
    status: {
      type: String,
      enum: Object.values(InstallationStatus),
      default: InstallationStatus.ASSIGNED,
      index: true
    },
    rejectionReason: { type: String, trim: true },
    adminRemarks: { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    currentStep: { type: Number, default: 1, min: 1, max: 12 },
    isDraft: { type: Boolean, default: true, index: true },

    // Equipment Details
    earthingSystem: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Earthing System' })
    },
    solarStructure: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Solar Mounting Structure' })
    },
    solarPanels: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Solar PV Modules' })
    },
    lightningProtection: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Lightning Protection Rod' })
    },
    inverter: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Solar Inverter' })
    },
    netMeter: {
      type: EquipmentItemDetailSchema,
      default: () => ({ name: 'Bi-directional Net Meter' })
    },

    // Panel Quantities
    panelDetails: {
      type: PanelDetailsSchema,
      default: () => ({
        totalPanels: 0,
        manufacturer: '',
        model: '',
        wattagePerPanel: 0,
        calculatedTotalCapacityKw: 0,
        panelSerialNumbers: [],
        panelBarcodes: []
      })
    },

    // Dynamic Inventory Barcode Table
    inventoryItems: {
      type: [InventoryRowSchema],
      default: []
    },

    // Max 10 Site Photos
    photos: {
      type: [SitePhotoSchema],
      default: []
    },

    // Live GPS Location
    location: {
      type: GpsLocationSchema
    },

    // Manuals
    manuals: {
      type: [TechnicalManualSchema],
      default: []
    },

    // History
    history: {
      type: [InstallationHistorySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for searching and filtering
InstallationSchema.index({ customerId: 1, status: 1 });
InstallationSchema.index({ assignedInstallerId: 1, status: 1 });
InstallationSchema.index({ status: 1, createdAt: -1 });

export const InstallationModel: Model<IInstallationDocument> =
  mongoose.models.Installation ||
  mongoose.model<IInstallationDocument>('Installation', InstallationSchema);
