import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  ProjectStatus,
  ProjectStage,
  MilestoneStatus,
  ProjectPriority,
  SolarTopology
} from '@ins-solar/shared';

export interface IProjectMilestone {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  displayOrder: number;
  plannedStartDate?: Date;
  dueDate?: Date;
  actualCompletionDate?: Date;
  status: MilestoneStatus;
  assignedUserId?: Types.ObjectId;
  blockerReason?: string;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectDocument extends Document {
  _id: Types.ObjectId;
  projectCode: string;
  name: string;
  customerId: Types.ObjectId;
  orderId?: Types.ObjectId;
  quotationId?: Types.ObjectId;
  solarDesignId?: Types.ObjectId;
  siteAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  systemCapacityKwp?: number;
  systemTopology?: SolarTopology;
  projectManagerId?: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  status: ProjectStatus;
  currentStage: ProjectStage;
  stageHistory: Array<{
    stage: ProjectStage;
    changedAt: Date;
    changedBy: Types.ObjectId;
    notes?: string;
  }>;
  plannedStartDate: Date;
  targetCompletionDate: Date;
  actualCompletionDate?: Date;
  priority: ProjectPriority;
  notes?: string;
  holdReason?: string;
  cancellationReason?: string;
  milestones: Types.DocumentArray<IProjectMilestone & Document>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectMilestoneSchema = new Schema<IProjectMilestone & Document>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 0
    },
    plannedStartDate: {
      type: Date
    },
    dueDate: {
      type: Date
    },
    actualCompletionDate: {
      type: Date
    },
    status: {
      type: String,
      enum: Object.values(MilestoneStatus),
      default: MilestoneStatus.NOT_STARTED,
      required: true
    },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    blockerReason: {
      type: String,
      trim: true
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const ProjectSchema = new Schema<IProjectDocument>(
  {
    projectCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      sparse: true,
      unique: true
    },
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null
    },
    solarDesignId: {
      type: Schema.Types.ObjectId,
      ref: 'SolarDesign',
      default: null
    },
    siteAddress: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' }
    },
    systemCapacityKwp: {
      type: Number,
      min: 0
    },
    systemTopology: {
      type: String,
      enum: Object.values(SolarTopology)
    },
    projectManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    teamMemberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.PLANNING,
      required: true,
      index: true
    },
    currentStage: {
      type: String,
      enum: Object.values(ProjectStage),
      default: ProjectStage.STAGE_1_ENGINEERING_DESIGN,
      required: true,
      index: true
    },
    stageHistory: [
      {
        stage: {
          type: String,
          enum: Object.values(ProjectStage),
          required: true
        },
        changedAt: {
          type: Date,
          required: true,
          default: Date.now
        },
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        notes: {
          type: String,
          trim: true
        }
      }
    ],
    plannedStartDate: {
      type: Date,
      required: true
    },
    targetCompletionDate: {
      type: Date,
      required: true
    },
    actualCompletionDate: {
      type: Date
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      default: ProjectPriority.MEDIUM,
      required: true,
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    holdReason: {
      type: String,
      trim: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    milestones: [ProjectMilestoneSchema],
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

// Compound indexes
ProjectSchema.index({ customerId: 1, status: 1 });
ProjectSchema.index({ projectManagerId: 1, status: 1 });
ProjectSchema.index({ status: 1, currentStage: 1 });
ProjectSchema.index({ createdAt: -1 });

export const Project: Model<IProjectDocument> = mongoose.model<IProjectDocument>(
  'Project',
  ProjectSchema
);
