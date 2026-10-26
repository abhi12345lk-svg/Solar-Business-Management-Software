/**
 * INS Solar Business Management Software — ProjectInstallationChecklist Model
 *
 * Persists project-specific execution of quality installation checklists with
 * snapshotted template items, inspector sign-offs, blocker/failure justifications,
 * and immutable photo evidence metadata.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { ChecklistCategory, ChecklistItemStatus } from '@ins-solar/shared';

export interface IChecklistEvidence {
  _id: Types.ObjectId;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  caption?: string;
  latitude?: number;
  longitude?: number;
}

export interface IProjectChecklistItem {
  _id: Types.ObjectId;
  itemCode: string;
  description: string;
  isRequired: boolean;
  requiresEvidence: boolean;
  status: ChecklistItemStatus;
  notes?: string;
  failureReason?: string;
  blockerReason?: string;
  assignedUserId?: Types.ObjectId;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  evidence: IChecklistEvidence[];
}

export interface IProjectChecklistCategory {
  category: ChecklistCategory;
  title: string;
  items: IProjectChecklistItem[];
}

export interface IProjectInstallationChecklistDocument extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  templateId: Types.ObjectId;
  templateCode: string;
  templateVersion: number;
  categories: IProjectChecklistCategory[];
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistEvidenceSchema = new Schema<IChecklistEvidence>(
  {
    storageKey: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSizeBytes: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now, required: true },
    caption: { type: String, trim: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  { _id: true }
);

const ProjectChecklistItemSchema = new Schema<IProjectChecklistItem>(
  {
    itemCode: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    isRequired: { type: Boolean, default: true },
    requiresEvidence: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(ChecklistItemStatus),
      default: ChecklistItemStatus.NOT_STARTED,
      required: true
    },
    notes: { type: String, trim: true },
    failureReason: { type: String, trim: true },
    blockerReason: { type: String, trim: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    evidence: { type: [ChecklistEvidenceSchema], default: [] }
  },
  { _id: true }
);

const ProjectChecklistCategorySchema = new Schema<IProjectChecklistCategory>(
  {
    category: {
      type: String,
      enum: Object.values(ChecklistCategory),
      required: true
    },
    title: { type: String, required: true, trim: true },
    items: {
      type: [ProjectChecklistItemSchema],
      required: true
    }
  },
  { _id: true }
);

const ProjectInstallationChecklistSchema = new Schema<IProjectInstallationChecklistDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'InstallationChecklistTemplate',
      required: true
    },
    templateCode: {
      type: String,
      required: true,
      trim: true
    },
    templateVersion: {
      type: Number,
      required: true,
      default: 1
    },
    categories: {
      type: [ProjectChecklistCategorySchema],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate checklist generation for the same project and template version
ProjectInstallationChecklistSchema.index({ projectId: 1, templateVersion: 1 }, { unique: true });

export const ProjectInstallationChecklist = mongoose.model<IProjectInstallationChecklistDocument>(
  'ProjectInstallationChecklist',
  ProjectInstallationChecklistSchema
);
