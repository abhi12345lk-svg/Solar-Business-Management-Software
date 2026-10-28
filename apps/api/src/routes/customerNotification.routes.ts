/**
 * INS Solar Business Management Software — Customer Notification Routes
 *
 * Provides customer-scoped notification endpoints mounted at /api/v1/customer-portal/notifications:
 * - GET /: list persistent notifications for the authenticated customer
 * - GET /unread-count: fetch count of unread notifications
 * - PATCH /:id/read: mark a single notification as read
 * - POST /mark-all-read: mark all eligible notifications as read
 * - GET /preferences: get customer multi-channel & category delivery preferences
 * - PUT /preferences: update customer notification preferences
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  notificationFilterSchema,
  updateNotificationPreferencesSchema,
  NotificationRecipientType,
  NotificationCategory
} from '@ins-solar/shared';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerNotificationRouter = Router();

// Customer portal session boundary enforcement
customerNotificationRouter.use(requireAuth);
customerNotificationRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.session?.customer?.customerId) {
    return next(
      AppError.permissionDenied('Customer portal session required to access this resource.')
    );
  }
  next();
});

/**
 * GET /api/v1/customer-portal/notifications
 * List persistent notifications for authenticated customer with filters and pagination.
 */
customerNotificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = notificationFilterSchema.safeParse(req.query);
    const filter = parseResult.success ? parseResult.data : { page: 1, limit: 20 };

    const result = await NotificationCenterService.getNotifications(
      customerId,
      NotificationRecipientType.CUSTOMER,
      filter
    );

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/notifications/unread-count
 * Returns the unread notification count for authenticated customer.
 */
customerNotificationRouter.get(
  '/unread-count',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const count = await NotificationCenterService.getUnreadCount(
        customerId,
        NotificationRecipientType.CUSTOMER
      );

      return sendSuccess(req, res, { unreadCount: count });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/customer-portal/notifications/:id/read
 * Mark a single notification as read with ownership validation.
 */
customerNotificationRouter.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const notificationId = req.params.id as string;

      const updated = await NotificationCenterService.markAsRead(
        notificationId,
        customerId,
        NotificationRecipientType.CUSTOMER,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: req.headers['x-correlation-id'] as string
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/customer-portal/notifications/mark-all-read
 * Mark all unread notifications as read for authenticated customer.
 */
customerNotificationRouter.post(
  '/mark-all-read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const category = req.body?.category ? (req.body.category as NotificationCategory) : undefined;

      const result = await NotificationCenterService.markAllAsRead(
        customerId,
        NotificationRecipientType.CUSTOMER,
        category,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: req.headers['x-correlation-id'] as string
        }
      );

      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/customer-portal/notifications/preferences
 * Fetch notification channel & category preferences for authenticated customer.
 */
customerNotificationRouter.get(
  '/preferences',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const preferences = await NotificationCenterService.getPreferences(
        customerId,
        NotificationRecipientType.CUSTOMER
      );

      return sendSuccess(req, res, preferences);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/customer-portal/notifications/preferences
 * Update notification channel & category preferences for authenticated customer.
 */
customerNotificationRouter.put(
  '/preferences',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const parseResult = updateNotificationPreferencesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await NotificationCenterService.updatePreferences(
        customerId,
        NotificationRecipientType.CUSTOMER,
        parseResult.data,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          correlationId: req.headers['x-correlation-id'] as string
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);
