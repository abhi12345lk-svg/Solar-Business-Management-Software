import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ProjectPriority, ProjectTaskStatus, TaskCategory } from '@ins-solar/shared';

export interface ITaskStatusHistory {
  fromStatus: string;
  toStatus: string;
  changedAt: Date;
  changedBy: Types.ObjectId;
  reason?: string;
}

export interface ITaskReassignmentHistory {
  fromUserId?: Types.ObjectId;
  toUserId: Types.ObjectId;
  reassignedAt: Date;
  reassignedBy: Types.ObjectId;
  reason: string;
}

export interface IProjectTaskDocument extends Document {
  _id: Types.ObjectId;
  taskCode: string;
  projectId?: Types.ObjectId;
  milestoneId?: Types.ObjectId;
  category: TaskCategory;
  teamId?: Types.ObjectId;
  relatedEntityType?: string;
  relatedEntityId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  title: string;
  description?: string;
  assignedUserId?: Types.ObjectId;
  priority: ProjectPriority;
  status: ProjectTaskStatus;
  dueDate?: Date;
  followUpDate?: Date;
  blockerReason?: string;
  completionNotes?: string;
  statusHistory: ITaskStatusHistory[];
  reassignmentHistory: ITaskReassignmentHistory[];
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
      default: null,
      index: true
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    category: {
      type: String,
      enum: Object.values(TaskCategory),
      default: TaskCategory.PROJECT,
      required: true,
      index: true
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
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
      type: Date,
      index: true
    },
    followUpDate: {
      type: Date
    },
    blockerReason: {
      type: String,
      maxlength: 1000
    },
    completionNotes: {
      type: String,
      maxlength: 1000
    },
    statusHistory: [
      {
        fromStatus: { type: String, required: true },
        toStatus: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String }
      }
    ],
    reassignmentHistory: [
      {
        fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reassignedAt: { type: Date, default: Date.now },
        reassignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true }
      }
    ],
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
    timestamps: true,
    collection: 'project_tasks',
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

ProjectTaskSchema.virtual('taskNumber').get(function (this: any) {
  return this.taskCode;
});

ProjectTaskSchema.index({ projectId: 1, status: 1 });
ProjectTaskSchema.index({ assignedUserId: 1, dueDate: 1 });
ProjectTaskSchema.index({ teamId: 1, status: 1 });
ProjectTaskSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
ProjectTaskSchema.index({ customerId: 1, status: 1 });
ProjectTaskSchema.index({ dueDate: 1, status: 1 });
ProjectTaskSchema.index({ createdAt: -1 });

export const ProjectTask: Model<IProjectTaskDocument> =
  mongoose.models.ProjectTask ||
  mongoose.model<IProjectTaskDocument>('ProjectTask', ProjectTaskSchema);
