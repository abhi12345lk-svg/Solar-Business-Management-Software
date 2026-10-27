/**
 * INS Solar Business Management Software — Notification Model
 *
 * Persistent notification inbox for customers and employees.
 * Supports atomic sequence numbering (NTF-YYYY-NNNNN), multi-channel status tracking,
 * category classifications, read/unread states, and deduplication keys.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  NotificationRecipientType,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus
} from '@ins-solar/shared';

export interface INotificationDocument extends Document {
  _id: Types.ObjectId;
  notificationNumber: string;
  recipientId: Types.ObjectId;
  recipientType: NotificationRecipientType;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  linkUrl?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  deliveryChannels: NotificationChannel[];
  deliveryStatus: NotificationDeliveryStatus;
  deliveryNotes?: string;
  dedupKey?: string;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    notificationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    recipientType: {
      type: String,
      enum: Object.values(NotificationRecipientType),
      required: true
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategory),
      required: true,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    entityType: {
      type: String,
      trim: true
    },
    entityId: {
      type: Schema.Types.ObjectId
    },
    linkUrl: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    },
    deliveryChannels: {
      type: [String],
      enum: Object.values(NotificationChannel),
      default: [NotificationChannel.IN_APP]
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(NotificationDeliveryStatus),
      default: NotificationDeliveryStatus.SIMULATED_LOG_ONLY
    },
    deliveryNotes: {
      type: String,
      trim: true
    },
    dedupKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    scheduledFor: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// High performance compound indexes for recipient inboxes
NotificationSchema.index(
  { recipientId: 1, recipientType: 1, isRead: 1, createdAt: -1 },
  { name: 'recipient_inbox_idx' }
);
NotificationSchema.index({ category: 1, createdAt: -1 });

export const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
