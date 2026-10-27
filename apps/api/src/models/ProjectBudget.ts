/**
 * INS Solar Business Management Software — ProjectBudget Model
 *
 * Tracks category-level budget baselines and revisions for solar installation projects.
 * Preserves immutable version history, prevents silent historical overwrites,
 * and maintains strict integer-paise financial precision.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ProjectBudgetStatus } from '@ins-solar/shared';

export interface IProjectBudgetStatusHistory {
  fromStatus: string;
  toStatus: string;
  changedAt: Date;
  changedBy: Types.ObjectId;
  notes?: string;
}

export interface IProjectBudgetDocument extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  version: number;
  status: ProjectBudgetStatus;
  materialsBudgetPaise: number;
  laborBudgetPaise: number;
  logisticsBudgetPaise: number;
  civilBudgetPaise: number;
  miscBudgetPaise: number;
  contingencyBudgetPaise: number;
  totalBudgetPaise: number;
  notes?: string;
  revisionReason?: string;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  statusHistory: IProjectBudgetStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectBudgetStatusHistorySchema = new Schema<IProjectBudgetStatusHistory>(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const ProjectBudgetSchema = new Schema<IProjectBudgetDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: Object.values(ProjectBudgetStatus),
      required: true,
      default: ProjectBudgetStatus.DRAFT,
      index: true
    },
    materialsBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    laborBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    logisticsBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    civilBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    miscBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    contingencyBudgetPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    totalBudgetPaise: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    },
    revisionReason: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    statusHistory: {
      type: [ProjectBudgetStatusHistorySchema],
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

ProjectBudgetSchema.index({ projectId: 1, version: -1 }, { unique: true });
ProjectBudgetSchema.index({ projectId: 1, status: 1 });

export const ProjectBudget: Model<IProjectBudgetDocument> =
  mongoose.models.ProjectBudget ||
  mongoose.model<IProjectBudgetDocument>('ProjectBudget', ProjectBudgetSchema);
