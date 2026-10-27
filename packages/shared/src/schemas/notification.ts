/**
 * INS Solar Business Management Software — Notification Schemas
 * Zod validation schemas for persistent notifications, inboxes, and user preferences.
 */

import { z } from 'zod';
import {
  NotificationRecipientType,
  NotificationCategory,
  NotificationChannel
} from '../types/enums.js';

export const notificationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.nativeEnum(NotificationCategory).optional(),
  isRead: z
    .preprocess(val => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

export const createNotificationSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  recipientType: z.nativeEnum(NotificationRecipientType),
  category: z.nativeEnum(NotificationCategory),
  eventType: z.string().min(1, 'Event type is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
  message: z.string().min(5, 'Message must be at least 5 characters').max(1000, 'Message cannot exceed 1000 characters'),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  linkUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  deliveryChannels: z.array(z.nativeEnum(NotificationChannel)).optional(),
  scheduledFor: z.coerce.date().optional(),
  dedupKey: z.string().optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const updateNotificationPreferencesSchema = z.object({
  channels: z
    .object({
      inApp: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional()
    })
    .optional(),
  categories: z
    .object({
      quotations: z.boolean().optional(),
      projectMilestones: z.boolean().optional(),
      payments: z.boolean().optional(),
      serviceAndWarranty: z.boolean().optional(),
      reminders: z.boolean().optional()
    })
    .optional()
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
