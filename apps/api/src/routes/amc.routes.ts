/**
 * INS Solar Business Management Software — Annual Maintenance Contract (AMC) Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createAmcSchema,
  amcStatusTransitionSchema,
  renewAmcSchema,
  amcFilterSchema
} from '@ins-solar/shared';
import { AmcService } from '../services/amcService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const amcRouter = Router();

amcRouter.use(requireAuth);
amcRouter.use(requireEmployee);

/**
 * GET /api/v1/amc
 * List Annual Maintenance Contracts with filtering and pagination.
 */
amcRouter.get(
  '/',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = amcFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await AmcService.getAmcs(parseResult.data, {
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
 * POST /api/v1/amc
 * Create a new AMC contract proposal in draft status.
 */
amcRouter.post(
  '/',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createAmcSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const amc = await AmcService.createAmc(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, amc, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/amc/:id
 * Retrieve details of a specific AMC contract.
 */
amcRouter.get(
  '/:id',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const amc = await AmcService.getAmcById(req.params.id as string, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, amc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/amc/:id/approve
 * Approve and activate an AMC contract.
 */
amcRouter.patch(
  '/:id/approve',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await AmcService.approveAmc(req.params.id as string, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/amc/:id/status
 * Transition AMC status (e.g. ON_HOLD, EXPIRED, CANCELLED).
 */
amcRouter.patch(
  '/:id/status',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = amcStatusTransitionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await AmcService.updateStatus(
        req.params.id as string,
        parseResult.data.status,
        parseResult.data.reason,
        parseResult.data.notes,
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
 * POST /api/v1/amc/:id/renew
 * Renew an AMC contract by generating a successor contract.
 */
amcRouter.post(
  '/:id/renew',
  requirePermission('service:amc_manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = renewAmcSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const newAmc = await AmcService.renewAmc(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, newAmc, 201);
    } catch (err) {
      return next(err);
    }
  }
);
