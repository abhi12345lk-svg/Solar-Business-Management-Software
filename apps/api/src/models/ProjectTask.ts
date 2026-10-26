import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ProjectPriority, ProjectTaskStatus } from '@ins-solar/shared';

export interface IProjectTaskDocument extends Document {
  _id: Types.ObjectId;
  taskCode: string;
  projectId: Types.ObjectId;
  milestoneId?: Types.ObjectId;
  title: string;
  description?: string;
  assignedUserId?: Types.ObjectId;
  priority: ProjectPriority;
  status: ProjectTaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectTaskSchema = new Schema<IProjectTaskDocument>(
  {
    taskCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      default: ProjectPriority.MEDIUM,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ProjectTaskStatus),
      default: ProjectTaskStatus.TODO,
      required: true,
      index: true
    },
    dueDate: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

ProjectTaskSchema.index({ projectId: 1, status: 1 });
ProjectTaskSchema.index({ assignedUserId: 1, dueDate: 1 });
ProjectTaskSchema.index({ dueDate: 1, status: 1 });
ProjectTaskSchema.index({ createdAt: -1 });

export const ProjectTask: Model<IProjectTaskDocument> = mongoose.model<IProjectTaskDocument>(
  'ProjectTask',
  ProjectTaskSchema
);
