/**
 * INS Solar Business Management Software — Background Job Model (DEC-03)
 *
 * Implements persistent, atomic MongoDB-backed job queue with lease locking,
 * crash recovery, retry backoff, and idempotent job keys.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { JobStatus, JobQueueName } from '@ins-solar/shared';

export interface IJobDocument extends Document {
  _id: Types.ObjectId;
  jobKey?: string;
  queueName: JobQueueName;
  payload: Record<string, any>;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  lockedUntil?: Date;
  lockedByWorkerId?: string;
  lastError?: string;
  scheduledFor: Date;
  completedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJobDocument>(
  {
    jobKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    queueName: {
      type: String,
      enum: Object.values(JobQueueName),
      required: true,
      index: true
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
      required: true,
      index: true
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      required: true
    },
    lockedUntil: {
      type: Date,
      index: true
    },
    lockedByWorkerId: {
      type: String,
      trim: true
    },
    lastError: {
      type: String
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    completedAt: {
      type: Date
    },
    failedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'jobs'
  }
);

// Compound index for optimal atomic job polling and lease queries
JobSchema.index({ status: 1, scheduledFor: 1, lockedUntil: 1 });
JobSchema.index({ queueName: 1, status: 1, scheduledFor: 1 });

export const JobModel: Model<IJobDocument> =
  mongoose.models.Job || mongoose.model<IJobDocument>('Job', JobSchema);
