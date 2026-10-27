import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Department } from '@ins-solar/shared';

export interface ITeamDocument extends Document {
  _id: Types.ObjectId;
  teamCode: string;
  name: string;
  department: Department;
  purpose: string;
  teamLeadId: Types.ObjectId;
  memberUserIds: Types.ObjectId[];
  skills: string[];
  eligibility: {
    projectTasks: boolean;
    serviceVisits: boolean;
  };
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeamDocument>(
  {
    teamCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: true,
      index: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    teamLeadId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    memberUserIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true
    },
    skills: {
      type: [String],
      default: []
    },
    eligibility: {
      projectTasks: { type: Boolean, default: true },
      serviceVisits: { type: Boolean, default: true }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
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
    collection: 'teams'
  }
);

TeamSchema.index({ department: 1, isActive: 1 });
TeamSchema.index({ name: 1, department: 1 });

export const Team: Model<ITeamDocument> =
  mongoose.models.Team || mongoose.model<ITeamDocument>('Team', TeamSchema);
