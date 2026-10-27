import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  DocumentCategory,
  DocumentAccessClassification,
  DocumentReviewStatus,
  DocumentStorageStatus
} from '@ins-solar/shared';

export interface IDocumentRecord extends Document {
  _id: Types.ObjectId;
  documentNumber: string;
  originalFilename: string;
  safeDisplayName: string;
  category: DocumentCategory;
  accessClassification: DocumentAccessClassification;
  reviewStatus: DocumentReviewStatus;
  reviewNotes?: string;
  rejectionReason?: string;
  reviewActorId?: Types.ObjectId;
  reviewedAt?: Date;
  storageKey: string;
  storageStatus: DocumentStorageStatus;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256?: string;
  version: number;
  previousVersionId?: Types.ObjectId;
  isLatestVersion: boolean;
  customerId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  relatedEntityType?: string;
  relatedEntityId?: Types.ObjectId;
  expiryDate?: Date;
  uploadedBy: Types.ObjectId;
  uploadedByType: 'EMPLOYEE' | 'CUSTOMER';
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentRecord>(
  {
    documentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    safeDisplayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      index: true
    },
    category: {
      type: String,
      enum: Object.values(DocumentCategory),
      required: true,
      index: true
    },
    accessClassification: {
      type: String,
      enum: Object.values(DocumentAccessClassification),
      default: DocumentAccessClassification.INTERNAL_ONLY,
      required: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: Object.values(DocumentReviewStatus),
      default: DocumentReviewStatus.PENDING_REVIEW,
      required: true,
      index: true
    },
    reviewNotes: {
      type: String,
      maxlength: 1000
    },
    rejectionReason: {
      type: String,
      maxlength: 1000
    },
    reviewActorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    storageStatus: {
      type: String,
      enum: Object.values(DocumentStorageStatus),
      default: DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
      required: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    fileSizeBytes: {
      type: Number,
      required: true,
      min: 1
    },
    checksumSha256: {
      type: String,
      trim: true
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
      required: true
    },
    previousVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentRecord',
      default: null
    },
    isLatestVersion: {
      type: Boolean,
      default: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    relatedEntityType: {
      type: String,
      default: null,
      index: true
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    expiryDate: {
      type: Date
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      required: true
    },
    uploadedByType: {
      type: String,
      enum: ['EMPLOYEE', 'CUSTOMER'],
      default: 'EMPLOYEE',
      required: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    archivedAt: {
      type: Date
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'documents'
  }
);

DocumentSchema.index({ customerId: 1, accessClassification: 1, isArchived: 1 });
DocumentSchema.index({ projectId: 1, accessClassification: 1, isArchived: 1 });
DocumentSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
DocumentSchema.index({ category: 1, reviewStatus: 1 });
DocumentSchema.index({ createdAt: -1 });

export const DocumentModel: Model<IDocumentRecord> =
  mongoose.models.DocumentRecord ||
  mongoose.model<IDocumentRecord>('DocumentRecord', DocumentSchema);
