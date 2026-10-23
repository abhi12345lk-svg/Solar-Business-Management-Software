import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ActivityType, ActivityStatus, ActivitySentiment } from '@ins-solar/shared';

export interface ILeadActivityDocument extends Document {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  customerId?: Types.ObjectId;
  activityType: ActivityType;
  summary: string;
  remarks?: string;
  activityDate: Date;
  nextFollowUpDate?: Date;
  assignedEmployeeId?: Types.ObjectId;
  status: ActivityStatus;
  sentiment?: ActivitySentiment;
  completedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadActivitySchema = new Schema<ILeadActivityDocument>(
  {
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
    activityType: {
      type: String,
      enum: Object.values(ActivityType),
      default: ActivityType.CALL,
      required: true
    },
    summary: {
      type: String,
      required: true,
      trim: true
    },
    remarks: {
      type: String,
      trim: true
    },
    activityDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    nextFollowUpDate: {
      type: Date,
      index: true
    },
    assignedEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ActivityStatus),
      default: ActivityStatus.COMPLETED,
      index: true
    },
    sentiment: {
      type: String,
      enum: Object.values(ActivitySentiment)
    },
    completedAt: {
      type: Date
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    collection: 'lead_activities'
  }
);

// Compound indexes for fast timeline retrieval and follow-up alerts
LeadActivitySchema.index({ leadId: 1, createdAt: -1 });
LeadActivitySchema.index({ assignedEmployeeId: 1, nextFollowUpDate: 1, status: 1 });
LeadActivitySchema.index({ status: 1, nextFollowUpDate: 1 });

export const LeadActivity: Model<ILeadActivityDocument> =
  (mongoose.models.LeadActivity as Model<ILeadActivityDocument>) ||
  mongoose.model<ILeadActivityDocument>('LeadActivity', LeadActivitySchema);
