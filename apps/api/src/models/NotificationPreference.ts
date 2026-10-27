/**
 * INS Solar Business Management Software — Notification Preference Model
 *
 * Configurable multi-channel delivery and category notification settings
 * for individual customers and employees.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { NotificationRecipientType } from '@ins-solar/shared';

export interface INotificationPreferenceDocument extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  recipientType: NotificationRecipientType;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  categories: {
    quotations: boolean;
    projectMilestones: boolean;
    payments: boolean;
    serviceAndWarranty: boolean;
    reminders: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreferenceDocument>(
  {
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
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true }
    },
    categories: {
      quotations: { type: Boolean, default: true },
      projectMilestones: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      serviceAndWarranty: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true }
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

// Unique compound index per recipient
NotificationPreferenceSchema.index(
  { recipientId: 1, recipientType: 1 },
  { unique: true, name: 'recipient_preference_uniq' }
);

export const NotificationPreference: Model<INotificationPreferenceDocument> =
  mongoose.models.NotificationPreference ||
  mongoose.model<INotificationPreferenceDocument>(
    'NotificationPreference',
    NotificationPreferenceSchema
  );
