/**
 * INS Solar Business Management Software — Staff Notification Routes
 *
 * Provides internal employee notification endpoints mounted at /api/v1/notifications:
 * - GET /: list persistent notifications for the authenticated employee
 * - GET /unread-count: fetch unread count
 * - PATCH /:id/read: mark notification as read
 * - POST /mark-all-read: mark all notifications as read
 * - GET /preferences: get employee notification preferences
 * - PUT /preferences: update employee notification preferences
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  notificationFilterSchema,
  updateNotificationPreferencesSchema,
  NotificationRecipientType,
  NotificationCategory
} from '@ins-solar/shared';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);
notificationRouter.use(requireEmployee);

/**
 * GET /api/v1/notifications
 * List persistent notifications for authenticated employee.
 */
notificationRouter.get(
  '/',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const parseResult = notificationFilterSchema.safeParse(req.query);
      const filter = parseResult.success ? parseResult.data : { page: 1, limit: 20 };

      const result = await NotificationCenterService.getNotifications(
        userId,
        NotificationRecipientType.EMPLOYEE,
        filter
      );

      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/notifications/unread-count
 * Returns unread notification count for authenticated employee.
 */
notificationRouter.get(
  '/unread-count',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const count = await NotificationCenterService.getUnreadCount(
        userId,
        NotificationRecipientType.EMPLOYEE
      );

      return sendSuccess(req, res, { unreadCount: count });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark notification as read.
 */
notificationRouter.patch(
  '/:id/read',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const notificationId = req.params.id as string;

      const updated = await NotificationCenterService.markAsRead(
        notificationId,
        userId,
        NotificationRecipientType.EMPLOYEE,
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
 * POST /api/v1/notifications/mark-all-read
 * Mark all unread notifications as read.
 */
notificationRouter.post(
  '/mark-all-read',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const category = req.body?.category ? (req.body.category as NotificationCategory) : undefined;

      const result = await NotificationCenterService.markAllAsRead(
        userId,
        NotificationRecipientType.EMPLOYEE,
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
 * GET /api/v1/notifications/preferences
 * Fetch notification preferences for authenticated employee.
 */
notificationRouter.get(
  '/preferences',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const preferences = await NotificationCenterService.getPreferences(
        userId,
        NotificationRecipientType.EMPLOYEE
      );

      return sendSuccess(req, res, preferences);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/notifications/preferences
 * Update notification preferences for authenticated employee.
 */
notificationRouter.put(
  '/preferences',
  requirePermission('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user!.userId;
      const parseResult = updateNotificationPreferencesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await NotificationCenterService.updatePreferences(
        userId,
        NotificationRecipientType.EMPLOYEE,
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
