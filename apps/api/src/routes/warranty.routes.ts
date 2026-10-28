/**
 * INS Solar Business Management Software — Warranty & Claims Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  updateWarrantyRecordSchema,
  createWarrantyClaimSchema,
  decideWarrantyClaimSchema,
  warrantyFilterSchema,
  warrantyClaimFilterSchema
} from '@ins-solar/shared';
import { WarrantyService } from '../services/warrantyService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const warrantyRouter = Router();

warrantyRouter.use(requireAuth);
warrantyRouter.use(requireEmployee);

/**
 * GET /api/v1/warranties
 * List hardware serial numbers and warranty coverage status.
 */
warrantyRouter.get(
  '/',
  requirePermission('warranty:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = warrantyFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await WarrantyService.getWarrantyRecords(parseResult.data, {
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
 * GET /api/v1/warranties/claims
 * List warranty claims.
 */
warrantyRouter.get(
  '/claims',
  requirePermission('warranty:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = warrantyClaimFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await WarrantyService.getClaims(parseResult.data, {
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
 * POST /api/v1/warranties/claims
 * Submit a new warranty claim against an eligible component.
 */
warrantyRouter.post(
  '/claims',
  requirePermission('warranty:claim_create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createWarrantyClaimSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const claim = await WarrantyService.submitClaim(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, claim, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/warranties/claims/:id
 * Retrieve details of a warranty claim.
 */
warrantyRouter.get(
  '/claims/:id',
  requirePermission('warranty:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claim = await WarrantyService.getClaimById(req.params.id as string, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, claim);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/warranties/claims/:id/decide
 * Record manufacturer decision on warranty claim (Approve, Reject, Replace).
 */
warrantyRouter.patch(
  '/claims/:id/decide',
  requirePermission('warranty:claim_decide'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = decideWarrantyClaimSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const claim = await WarrantyService.decideClaim(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, claim);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/warranties/:serialNumber
 * Retrieve warranty coverage details for a specific serialized component.
 */
warrantyRouter.get(
  '/:serialNumber',
  requirePermission('warranty:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await WarrantyService.getWarrantyRecordBySerial(
        req.params.serialNumber as string,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, record);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/warranties/:serialNumber
 * Update warranty dates and terms for a serialized hardware asset.
 */
warrantyRouter.patch(
  '/:serialNumber',
  requirePermission('warranty:claim_decide'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateWarrantyRecordSchema.safeParse({
        ...req.body,
        serialNumber: req.params.serialNumber
      });
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await WarrantyService.updateWarrantyDetails(parseResult.data, {
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
