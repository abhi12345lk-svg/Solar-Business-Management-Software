import { Router, Request, Response, NextFunction } from 'express';
import { createVendorSchema, updateVendorSchema, vendorFilterSchema } from '@ins-solar/shared';
import { VendorService } from '../services/vendorService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const vendorRouter = Router();

vendorRouter.use(requireAuth);
vendorRouter.use(requireEmployee);

/**
 * POST /api/v1/vendors
 * Register a new Vendor.
 */
vendorRouter.post(
  '/',
  requirePermission('vendor:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createVendorSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const vendor = await VendorService.createVendor(parseResult.data, user, context);
      return sendSuccess(req, res, vendor, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/vendors
 * List vendors with pagination and filtering.
 */
vendorRouter.get(
  '/',
  requirePermission('vendor:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = vendorFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await VendorService.getVendors(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/vendors/:id
 * Get vendor details by ID.
 */
vendorRouter.get(
  '/:id',
  requirePermission('vendor:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendor = await VendorService.getVendorById(req.params.id as string);
      return sendSuccess(req, res, vendor);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/vendors/:id
 * Update vendor profile.
 */
vendorRouter.put(
  '/:id',
  requirePermission('vendor:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateVendorSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const vendor = await VendorService.updateVendor(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, vendor);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/vendors/:id/deactivate
 * Soft deactivate vendor (preserves historical purchase records).
 */
vendorRouter.post(
  '/:id/deactivate',
  requirePermission('vendor:deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const vendor = await VendorService.deactivateVendor(req.params.id as string, user, context);
      return sendSuccess(req, res, vendor);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/vendors/:id
 * Hard delete vendor if no historical purchases exist.
 */
vendorRouter.delete(
  '/:id',
  requirePermission('vendor:deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await VendorService.deleteVendor(req.params.id as string);
      return sendSuccess(req, res, { message: 'Vendor deleted successfully.' });
    } catch (err) {
      return next(err);
    }
  }
);
