/**
 * INS Solar Business Management Software — InstallationChecklistTemplate Model
 *
 * Defines standardized, versioned installation inspection checklist templates across
 * the 5 mandatory solar installation quality categories.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { ChecklistCategory } from '@ins-solar/shared';

export interface IChecklistTemplateItem {
  itemCode: string;
  description: string;
  isRequired: boolean;
  requiresEvidence: boolean;
}

export interface IChecklistTemplateCategory {
  category: ChecklistCategory;
  title: string;
  items: IChecklistTemplateItem[];
}

export interface IInstallationChecklistTemplateDocument extends Document {
  _id: Types.ObjectId;
  templateCode: string;
  title: string;
  version: number;
  isActive: boolean;
  categories: IChecklistTemplateCategory[];
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistTemplateItemSchema = new Schema<IChecklistTemplateItem>(
  {
    itemCode: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    isRequired: { type: Boolean, default: true },
    requiresEvidence: { type: Boolean, default: false }
  },
  { _id: true }
);

const ChecklistTemplateCategorySchema = new Schema<IChecklistTemplateCategory>(
  {
    category: {
      type: String,
      enum: Object.values(ChecklistCategory),
      required: true
    },
    title: { type: String, required: true, trim: true },
    items: {
      type: [ChecklistTemplateItemSchema],
      required: true,
      validate: [(val: any[]) => val && val.length > 0, 'Category must have items']
    }
  },
  { _id: true }
);

const InstallationChecklistTemplateSchema = new Schema<IInstallationChecklistTemplateDocument>(
  {
    templateCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    version: {
      type: Number,
      required: true,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    categories: {
      type: [ChecklistTemplateCategorySchema],
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const InstallationChecklistTemplate = mongoose.model<IInstallationChecklistTemplateDocument>(
  'InstallationChecklistTemplate',
  InstallationChecklistTemplateSchema
);
