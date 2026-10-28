/**
 * INS Solar Business Management Software — Material Dispatch Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createMaterialDispatchSchema,
  cancelMaterialDispatchSchema,
  dispatchFilterSchema
} from '@ins-solar/shared';
import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const materialDispatchRouter = Router();

materialDispatchRouter.use(requireAuth);
materialDispatchRouter.use(requireEmployee);

/**
 * POST /api/v1/dispatches
 * Create and execute physical material dispatch to a project site.
 */
materialDispatchRouter.post(
  '/',
  requirePermission('dispatch:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createMaterialDispatchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const dispatch = await MaterialDispatchService.createDispatch(
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, dispatch, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/dispatches
 * List material dispatches with filters and pagination.
 */
materialDispatchRouter.get(
  '/',
  requirePermission('dispatch:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = dispatchFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await MaterialDispatchService.getDispatches(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/dispatches/:id
 * Get single dispatch details.
 */
materialDispatchRouter.get(
  '/:id',
  requirePermission('dispatch:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispatch = await MaterialDispatchService.getDispatchById(req.params.id as string);
      return sendSuccess(req, res, dispatch);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/dispatches/:id/cancel
 * Cancel and reverse an issued dispatch slip with compensating stock movements.
 */
materialDispatchRouter.post(
  '/:id/cancel',
  requirePermission('dispatch:cancel'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = cancelMaterialDispatchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const dispatch = await MaterialDispatchService.cancelDispatch(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, dispatch);
    } catch (err) {
      return next(err);
    }
  }
);
