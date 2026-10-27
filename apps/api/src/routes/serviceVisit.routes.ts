/**
 * INS Solar Business Management Software — Service Visit Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createServiceVisitSchema,
  completeServiceVisitSchema,
  rescheduleServiceVisitSchema,
  serviceVisitFilterSchema
} from '@ins-solar/shared';
import { ServiceVisitService } from '../services/serviceVisitService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const serviceVisitRouter = Router();

serviceVisitRouter.use(requireAuth);
serviceVisitRouter.use(requireEmployee);

/**
 * GET /api/v1/service-visits
 * List technician field visits with filters and pagination.
 */
serviceVisitRouter.get(
  '/',
  requirePermission('service:ticket_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = serviceVisitFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await ServiceVisitService.getVisits(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/service-visits
 * Schedule a physical field technician visit.
 */
serviceVisitRouter.post(
  '/',
  requirePermission('service:visit_schedule'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createServiceVisitSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const visit = await ServiceVisitService.scheduleVisit(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, visit, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/service-visits/:id
 * Retrieve details of a specific service visit.
 */
serviceVisitRouter.get(
  '/:id',
  requirePermission('service:ticket_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const visit = await ServiceVisitService.getVisitById(req.params.id as string, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, visit);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/service-visits/:id/reschedule
 * Reschedule a service visit.
 */
serviceVisitRouter.patch(
  '/:id/reschedule',
  requirePermission('service:visit_schedule'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = rescheduleServiceVisitSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await ServiceVisitService.rescheduleVisit(
        req.params.id as string,
        parseResult.data.newDate,
        parseResult.data.newTimeSlot,
        parseResult.data.reason,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/service-visits/:id/cancel
 * Cancel a service visit.
 */
serviceVisitRouter.patch(
  '/:id/cancel',
  requirePermission('service:visit_schedule'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return next(AppError.badRequest('Cancellation reason is required.'));
      }

      const updated = await ServiceVisitService.cancelVisit(
        req.params.id as string,
        reason,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/service-visits/:id/complete
 * Complete a service visit: logs execution checklists, work performed, parts used,
 * and updates AMC visit consumption counters atomically.
 */
serviceVisitRouter.post(
  '/:id/complete',
  requirePermission('service:visit_execute'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = completeServiceVisitSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await ServiceVisitService.completeVisit(
        req.params.id as string,
        parseResult.data,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);
