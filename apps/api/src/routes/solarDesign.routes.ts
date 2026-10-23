/**
 * INS Solar Business Management Software — SolarDesign Routes
 *
 * Provides versioned REST endpoints mounted at /api/v1/solar-designs:
 * - POST /calculate: preview pure sizing calculations
 * - POST /: create persisted solar design linked to catalog and customer
 * - GET /: list designs with filtering and pagination
 * - GET /:id: retrieve design details
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  SizingCalculationInputSchema,
  CreateSolarDesignInputSchema,
  SolarDesignFilterSchema
} from '@ins-solar/shared';
import { SolarDesignService } from '../services/solarDesignService.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const solarDesignRouter = Router();

// All solar design routes require internal employee authentication
solarDesignRouter.use(requireAuth);

/**
 * POST /api/v1/solar-designs/calculate
 * Pure sizing preview calculation without database writes.
 */
solarDesignRouter.post(
  '/calculate',
  requirePermission('design:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = SizingCalculationInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = SolarDesignService.calculatePreview(parseResult.data);
      return sendSuccess(req, res, result, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/solar-designs
 * Create a new persisted SolarDesign linked to Customer and active catalog hardware.
 */
solarDesignRouter.post(
  '/',
  requirePermission('design:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CreateSolarDesignInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const design = await SolarDesignService.createDesign(parseResult.data, user, context);
      return sendSuccess(req, res, design, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/solar-designs
 * List solar designs with pagination and filters.
 */
solarDesignRouter.get(
  '/',
  requirePermission('design:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = SolarDesignFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await SolarDesignService.listDesigns(parseResult.data);
      return sendSuccess(req, res, result.items, 200, result.pagination);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/solar-designs/:id
 * Retrieve a single solar design by ID.
 */
solarDesignRouter.get(
  '/:id',
  requirePermission('design:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid SolarDesign ID format.'));
      }

      const design = await SolarDesignService.getDesignById(id);
      return sendSuccess(req, res, design, 200);
    } catch (err) {
      return next(err);
    }
  }
);
