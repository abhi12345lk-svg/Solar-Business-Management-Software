import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { AuditAction, AuditOutcome, ActorType } from '@ins-solar/shared';

export interface ISecurityAuditLogDocument extends Document {
  _id: Types.ObjectId;
  eventId: string;
  timestamp: Date;
  actorId?: string;
  actorType: ActorType;
  action: AuditAction | string;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  targetEntity?: string;
  targetId?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const SecurityAuditLogSchema = new Schema<ISecurityAuditLogDocument>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    actorId: {
      type: String,
      index: true
    },
    actorType: {
      type: String,
      enum: Object.values(ActorType),
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    outcome: {
      type: String,
      enum: Object.values(AuditOutcome),
      required: true,
      index: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    correlationId: {
      type: String,
      required: true,
      index: true
    },
    targetEntity: {
      type: String
    },
    targetId: {
      type: String
    },
    details: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

// Append-only guards: Block all update and delete queries at the ODM level
const blockMutation = function (this: any) {
  throw new Error('Security audit logs are append-only and cannot be modified or deleted.');
};

SecurityAuditLogSchema.pre('updateOne', blockMutation);
SecurityAuditLogSchema.pre('updateMany', blockMutation);
SecurityAuditLogSchema.pre('findOneAndUpdate', blockMutation);
SecurityAuditLogSchema.pre('deleteOne', blockMutation);
SecurityAuditLogSchema.pre('deleteMany', blockMutation);
SecurityAuditLogSchema.pre('findOneAndDelete', blockMutation);

export const SecurityAuditLog: Model<ISecurityAuditLogDocument> =
  mongoose.models.SecurityAuditLog ||
  mongoose.model<ISecurityAuditLogDocument>('SecurityAuditLog', SecurityAuditLogSchema);
