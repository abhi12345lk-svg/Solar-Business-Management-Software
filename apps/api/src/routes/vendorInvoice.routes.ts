import { Router, Request, Response, NextFunction } from 'express';
import {
  createVendorInvoiceSchema,
  reconcileVendorInvoiceSchema,
  vendorInvoiceFilterSchema
} from '@ins-solar/shared';
import { VendorInvoiceService } from '../services/vendorInvoiceService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const vendorInvoiceRouter = Router();

vendorInvoiceRouter.use(requireAuth);
vendorInvoiceRouter.use(requireEmployee);

/**
 * POST /api/v1/vendor-invoices
 * Register a new Vendor Invoice (detects duplicate and calculates 3-way match).
 */
vendorInvoiceRouter.post(
  '/',
  requirePermission('vendor_invoice:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createVendorInvoiceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const invoice = await VendorInvoiceService.createVendorInvoice(
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, invoice, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/vendor-invoices
 * List vendor invoices with filtering and pagination.
 */
vendorInvoiceRouter.get(
  '/',
  requirePermission('vendor_invoice:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = vendorInvoiceFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await VendorInvoiceService.getVendorInvoices(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/vendor-invoices/:id
 * Get vendor invoice details by ID.
 */
vendorInvoiceRouter.get(
  '/:id',
  requirePermission('vendor_invoice:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await VendorInvoiceService.getVendorInvoiceById(req.params.id as string);
      return sendSuccess(req, res, invoice);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/vendor-invoices/:id/reconcile
 * Adjust reconciliation status (accountant review).
 */
vendorInvoiceRouter.post(
  '/:id/reconcile',
  requirePermission('vendor_invoice:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reconcileVendorInvoiceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const invoice = await VendorInvoiceService.reconcileInvoice(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, invoice);
    } catch (err) {
      return next(err);
    }
  }
);
