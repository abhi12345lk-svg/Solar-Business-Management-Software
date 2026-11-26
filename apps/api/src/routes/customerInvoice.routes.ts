/**
 * INS Solar Business Management Software — Customer GST Tax Invoice Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createCustomerInvoiceSchema,
  cancelCustomerInvoiceSchema,
  customerInvoiceFilterSchema
} from '@ins-solar/shared';
import { CustomerInvoiceService } from '../services/customerInvoiceService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { ensureCustomerPortalSession } from '../middleware/customerPortalGuard.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerInvoiceRouter = Router();
export const customerPortalInvoiceRouter = Router();

customerInvoiceRouter.use(requireAuth);
customerInvoiceRouter.use(requireEmployee);

/**
 * POST /api/v1/customer-invoices
 * Generate a new statutory GST Tax Invoice from a confirmed Sales Order.
 */
customerInvoiceRouter.post(
  '/',
  requirePermission('account:invoice_create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createCustomerInvoiceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
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
 * GET /api/v1/customer-invoices
 * List all customer GST tax invoices with pagination, status filters, and search.
 */
customerInvoiceRouter.get(
  '/',
  requirePermission('account:invoice_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = customerInvoiceFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await CustomerInvoiceService.listInvoices(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/customer-invoices/:id
 * Retrieve full GST Tax Invoice details including line items, HSN codes, and tax breakdown.
 */
customerInvoiceRouter.get(
  '/:id',
  requirePermission('account:invoice_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await CustomerInvoiceService.getInvoiceById(req.params.id as string);
      return sendSuccess(req, res, invoice);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/customer-invoices/:id/cancel
 * Cancel a statutory GST Tax Invoice with mandatory audit reason (Authorized for Admin/Head).
 */
customerInvoiceRouter.post(
  '/:id/cancel',
  requirePermission('account:invoice_create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = cancelCustomerInvoiceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const invoice = await CustomerInvoiceService.cancelInvoice(
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

// =============================================================================
// Customer Portal Scoped Invoices Router (/api/v1/customer-portal/invoices)
// =============================================================================
customerPortalInvoiceRouter.use(requireAuth);
customerPortalInvoiceRouter.use(ensureCustomerPortalSession);

customerPortalInvoiceRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const parseResult = customerInvoiceFilterSchema.safeParse(req.query);
      const filterData = parseResult.success
        ? parseResult.data
        : { page: 1, limit: 20, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
      const result = await CustomerInvoiceService.listInvoices(filterData, customerId);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

customerPortalInvoiceRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.session.customer!.customerId;
      const invoice = await CustomerInvoiceService.getInvoiceById(
        req.params.id as string,
        customerId
      );
      return sendSuccess(req, res, invoice);
    } catch (err) {
      return next(err);
    }
  }
);
