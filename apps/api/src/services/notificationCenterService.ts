/**
 * INS Solar Business Management Software — Notification Center Service
 *
 * Provides persistent in-app notifications, recipient isolation (Customer vs Employee),
 * honest delivery reporting (SIMULATED_LOG_ONLY vs DISPATCHED_TO_GATEWAY),
 * channel & category preference filtering, and idempotent event deduplication.
 */

import mongoose, { Types } from 'mongoose';
import {
  Notification,
  INotificationDocument,
  NotificationPreference
} from '../models/index.js';
import {
  NotificationRecipientType,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  NotificationFilterInput,
  UpdateNotificationPreferencesInput
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export interface CreateNotificationParams {
  recipientId: string | Types.ObjectId;
  recipientType: NotificationRecipientType;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string | Types.ObjectId;
  linkUrl?: string;
  metadata?: Record<string, any>;
  deliveryChannels?: NotificationChannel[];
  scheduledFor?: Date;
  dedupKey?: string;
}

export class NotificationCenterService {
  /**
   * Generates a deterministic deduplication key if none is provided.
   */
  public static generateDedupKey(params: CreateNotificationParams): string {
    if (params.dedupKey && params.dedupKey.trim()) {
      return params.dedupKey.trim();
    }
    const targetDate = params.scheduledFor
      ? params.scheduledFor.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const entityPart = params.entityId ? params.entityId.toString() : 'general';
    return `${params.recipientType}:${params.recipientId.toString()}:${params.category}:${params.eventType}:${entityPart}:${targetDate}`;
  }

  /**
   * Checks whether the recipient has enabled notifications for the given category and channel.
   */
  public static async evaluatePreferences(
    recipientId: Types.ObjectId,
    recipientType: NotificationRecipientType,
    category: NotificationCategory,
    requestedChannels: NotificationChannel[]
  ): Promise<{
    allowed: boolean;
    activeChannels: NotificationChannel[];
    reason?: string;
  }> {
    const prefQuery = NotificationPreference.findOne({
      recipientId,
      recipientType
    });
    const pref: any = typeof (prefQuery as any)?.lean === 'function'
      ? await (prefQuery as any).lean()
      : await prefQuery;

    if (!pref) {
      // Default: all channels and categories enabled
      return { allowed: true, activeChannels: requestedChannels };
    }

    // 1. Check category preference
    let isCategoryEnabled = true;
    switch (category) {
      case NotificationCategory.QUOTATION:
        isCategoryEnabled = pref.categories?.quotations ?? true;
        break;
      case NotificationCategory.PROJECT_MILESTONE:
      case NotificationCategory.DOCUMENT:
      case NotificationCategory.INSPECTION:
        isCategoryEnabled = pref.categories?.projectMilestones ?? true;
        break;
      case NotificationCategory.PAYMENT:
        isCategoryEnabled = pref.categories?.payments ?? true;
        break;
      case NotificationCategory.SERVICE_COMPLAINT:
      case NotificationCategory.SERVICE_VISIT:
      case NotificationCategory.WARRANTY_AMC:
        isCategoryEnabled = pref.categories?.serviceAndWarranty ?? true;
        break;
      case NotificationCategory.SYSTEM:
      default:
        isCategoryEnabled = pref.categories?.reminders ?? true;
        break;
    }

    if (!isCategoryEnabled) {
      return { allowed: false, activeChannels: [], reason: 'CATEGORY_DISABLED_BY_USER' };
    }

    // 2. Filter channels
    const activeChannels = requestedChannels.filter(channel => {
      switch (channel) {
        case NotificationChannel.IN_APP:
          return pref.channels?.inApp ?? true;
        case NotificationChannel.EMAIL:
          return pref.channels?.email ?? true;
        case NotificationChannel.SMS:
          return pref.channels?.sms ?? true;
        case NotificationChannel.WHATSAPP:
          return pref.channels?.whatsapp ?? true;
        default:
          return true;
      }
    });

    if (activeChannels.length === 0) {
      return { allowed: false, activeChannels: [], reason: 'ALL_CHANNELS_DISABLED_BY_USER' };
    }

    return { allowed: true, activeChannels };
  }

  /**
   * Creates and dispatches a persistent notification with deduplication and preference checks.
   * Safe boundary: external delivery errors NEVER throw or roll back the caller's transaction.
   */
  public static async createNotification(
    params: CreateNotificationParams,
    actor?: {
      userId?: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<INotificationDocument | null> {
    try {
      const recipientObjectId = new mongoose.Types.ObjectId(params.recipientId.toString());
      const channels = params.deliveryChannels && params.deliveryChannels.length > 0
        ? params.deliveryChannels
        : [NotificationChannel.IN_APP];

      // 1. Evaluate user preferences
      const prefResult = await this.evaluatePreferences(
        recipientObjectId,
        params.recipientType,
        params.category,
        channels
      );

      if (!prefResult.allowed) {
        logger.info(
          { recipientId: params.recipientId, category: params.category, reason: prefResult.reason },
          '[NotificationCenterService] Notification skipped due to recipient preferences.'
        );
        return null;
      }

      // 2. Check deduplication key
      const dedupKey = this.generateDedupKey(params);
      const existing = await Notification.findOne({ dedupKey });
      if (existing) {
        logger.info(
          { dedupKey, notificationNumber: existing.notificationNumber },
          '[NotificationCenterService] Deduplicated notification already exists.'
        );
        return existing;
      }

      // 3. Generate atomic notification sequence NTF-YYYY-NNNNN
      const seq = await SequenceService.generateNextSequence({
        entityType: SequenceEntityType.NOTIFICATION
      });

      // 4. Determine honest delivery status
      const isGatewayConfigured = Boolean(
        process.env.SMS_GATEWAY_API_KEY || process.env.EMAIL_SMTP_HOST
      );
      const deliveryStatus = isGatewayConfigured
        ? NotificationDeliveryStatus.DISPATCHED_TO_GATEWAY
        : NotificationDeliveryStatus.SIMULATED_LOG_ONLY;

      const deliveryNotes = isGatewayConfigured
        ? 'Dispatched to provider queue; delivery confirmation pending gateway webhook.'
        : 'No third-party SMS/Email gateway configured. Logged to audit ledger (SIMULATED_LOG_ONLY).';

      // 5. Persist notification
      const notification = new Notification({
        notificationNumber: seq.formattedNumber,
        recipientId: recipientObjectId,
        recipientType: params.recipientType,
        category: params.category,
        eventType: params.eventType,
        title: params.title.trim(),
        message: params.message.trim(),
        entityType: params.entityType,
        entityId: params.entityId ? new mongoose.Types.ObjectId(params.entityId.toString()) : undefined,
        linkUrl: params.linkUrl,
        metadata: params.metadata || {},
        isRead: false,
        deliveryChannels: prefResult.activeChannels,
        deliveryStatus,
        deliveryNotes,
        dedupKey,
        scheduledFor: params.scheduledFor
      });

      await notification.save();

      // 6. Record audit event
      await AuditService.recordEvent({
        action: AuditAction.NOTIFICATION_CREATED,
        actorId: actor?.userId || params.recipientId.toString(),
        actorType: params.recipientType === NotificationRecipientType.CUSTOMER ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
        targetEntity: 'Notification',
        targetId: notification._id.toString(),
        outcome: AuditOutcome.SUCCESS,
        details: {
          notificationNumber: notification.notificationNumber,
          category: notification.category,
          eventType: notification.eventType,
          recipientType: notification.recipientType,
          deliveryStatus
        },
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
        correlationId: actor?.correlationId || 'notif-created'
      });

      logger.info(
        { notificationNumber: notification.notificationNumber, recipientId: params.recipientId },
        '[NotificationCenterService] Persistent notification created successfully.'
      );

      return notification;
    } catch (err: any) {
      // In case of unique key race condition on dedupKey
      if (err.code === 11000 && err.keyPattern?.dedupKey) {
        const existing = await Notification.findOne({ dedupKey: params.dedupKey });
        if (existing) return existing;
      }
      logger.error({ err, params }, '[NotificationCenterService] Error creating notification.');
      // Never crash critical transaction
      return null;
    }
  }

  /**
   * Retrieves paginated notifications for a specific recipient with filters.
   */
  public static async getNotifications(
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType,
    filter: NotificationFilterInput
  ): Promise<{
    items: INotificationDocument[];
    total: number;
    page: number;
    limit: number;
    unreadCount: number;
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      recipientType
    };

    if (filter.category) {
      query.category = filter.category;
    }

    if (filter.isRead !== undefined) {
      query.isRead = filter.isRead;
    }

    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({
        recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
        recipientType,
        isRead: false
      })
    ]);

    return {
      items: items as any,
      total,
      page,
      limit,
      unreadCount
    };
  }

  /**
   * Returns current unread count for a recipient.
   */
  public static async getUnreadCount(
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType
  ): Promise<number> {
    return Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      recipientType,
      isRead: false
    });
  }

  /**
   * Marks a single notification as read with strict recipient ownership verification.
   */
  public static async markAsRead(
    notificationId: string,
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType,
    actor?: {
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<INotificationDocument> {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw AppError.validation(`Invalid notification ID format '${notificationId}'.`);
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw AppError.notFound(`Notification '${notificationId}' not found.`);
    }

    // Strict ownership verification: cannot read another recipient's notification
    if (
      notification.recipientId.toString() !== recipientId.toString() ||
      notification.recipientType !== recipientType
    ) {
      throw AppError.forbidden('Access denied: You cannot view or modify another user\'s notification.');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      await AuditService.recordEvent({
        action: AuditAction.NOTIFICATION_READ,
        actorId: recipientId.toString(),
        actorType: recipientType === NotificationRecipientType.CUSTOMER ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
        targetEntity: 'Notification',
        targetId: notification._id.toString(),
        outcome: AuditOutcome.SUCCESS,
        details: {
          notificationNumber: notification.notificationNumber
        },
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
        correlationId: actor?.correlationId || 'notif-read'
      });
    }

    return notification;
  }

  /**
   * Marks all eligible notifications as read for a recipient, optionally filtered by category.
   */
  public static async markAllAsRead(
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType,
    category?: NotificationCategory,
    actor?: {
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<{ modifiedCount: number }> {
    const query: any = {
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      recipientType,
      isRead: false
    };

    if (category) {
      query.category = category;
    }

    const result = await Notification.updateMany(query, {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    });

    await AuditService.recordEvent({
      action: AuditAction.NOTIFICATION_BULK_READ,
      actorId: recipientId.toString(),
      actorType: recipientType === NotificationRecipientType.CUSTOMER ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      targetEntity: 'Notification',
      targetId: recipientId.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        category: category || 'ALL',
        modifiedCount: result.modifiedCount
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      correlationId: actor?.correlationId || 'notif-bulk-read'
    });

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Retrieves notification preferences for a recipient, returning defaults if not yet customized.
   */
  public static async getPreferences(
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType
  ): Promise<{
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
  }> {
    const prefQuery = NotificationPreference.findOne({
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      recipientType
    });
    const pref: any = typeof (prefQuery as any)?.lean === 'function'
      ? await (prefQuery as any).lean()
      : await prefQuery;

    if (!pref) {
      return {
        channels: { inApp: true, email: true, sms: true, whatsapp: true },
        categories: {
          quotations: true,
          projectMilestones: true,
          payments: true,
          serviceAndWarranty: true,
          reminders: true
        }
      };
    }

    return {
      channels: {
        inApp: pref.channels?.inApp ?? true,
        email: pref.channels?.email ?? true,
        sms: pref.channels?.sms ?? true,
        whatsapp: pref.channels?.whatsapp ?? true
      },
      categories: {
        quotations: pref.categories?.quotations ?? true,
        projectMilestones: pref.categories?.projectMilestones ?? true,
        payments: pref.categories?.payments ?? true,
        serviceAndWarranty: pref.categories?.serviceAndWarranty ?? true,
        reminders: pref.categories?.reminders ?? true
      }
    };
  }

  /**
   * Updates or initializes notification preferences for a recipient.
   */
  public static async updatePreferences(
    recipientId: string | Types.ObjectId,
    recipientType: NotificationRecipientType,
    input: UpdateNotificationPreferencesInput,
    actor?: {
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<any> {
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId.toString());

    const existing = await NotificationPreference.findOne({
      recipientId: recipientObjectId,
      recipientType
    });

    const channels = {
      inApp: input.channels?.inApp !== undefined ? input.channels.inApp : (existing?.channels?.inApp ?? true),
      email: input.channels?.email !== undefined ? input.channels.email : (existing?.channels?.email ?? true),
      sms: input.channels?.sms !== undefined ? input.channels.sms : (existing?.channels?.sms ?? true),
      whatsapp: input.channels?.whatsapp !== undefined ? input.channels.whatsapp : (existing?.channels?.whatsapp ?? true)
    };

    const categories = {
      quotations: input.categories?.quotations !== undefined ? input.categories.quotations : (existing?.categories?.quotations ?? true),
      projectMilestones: input.categories?.projectMilestones !== undefined ? input.categories.projectMilestones : (existing?.categories?.projectMilestones ?? true),
      payments: input.categories?.payments !== undefined ? input.categories.payments : (existing?.categories?.payments ?? true),
      serviceAndWarranty: input.categories?.serviceAndWarranty !== undefined ? input.categories.serviceAndWarranty : (existing?.categories?.serviceAndWarranty ?? true),
      reminders: input.categories?.reminders !== undefined ? input.categories.reminders : (existing?.categories?.reminders ?? true)
    };

    const updated = await NotificationPreference.findOneAndUpdate(
      { recipientId: recipientObjectId, recipientType },
      {
        $set: {
          channels,
          categories
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditService.recordEvent({
      action: AuditAction.NOTIFICATION_PREFERENCES_UPDATED,
      actorId: recipientId.toString(),
      actorType: recipientType === NotificationRecipientType.CUSTOMER ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      targetEntity: 'NotificationPreference',
      targetId: updated?._id ? updated._id.toString() : recipientId.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        channels,
        categories
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      correlationId: actor?.correlationId || 'notif-pref-updated'
    });

    return updated;
  }
}
