/**
 * INS Solar Business Management Software — Quotation Routes
 *
 * Provides versioned REST endpoints mounted at /api/v1/quotations:
 * - POST /: create new quotation (R0)
 * - GET /: list quotations with filtering and pagination
 * - GET /:id: get quotation details and revision history
 * - POST /:id/revisions: create new revision (R1, R2...)
 * - POST /:id/approve-discount: approve discount (anti-self-approval enforced)
 * - POST /:id/reject-discount: reject discount
 * - POST /:id/send: mark quotation as issued/sent to customer
 * - GET /:id/pdf: view/download proposal document
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateQuotationInputSchema,
  ReviseQuotationInputSchema,
  DiscountApprovalInputSchema,
  QuotationFilterSchema
} from '@ins-solar/shared';
import { QuotationService } from '../services/quotationService.js';
import { ProposalCompilerService } from '../services/proposalCompilerService.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const quotationRouter = Router();

// Internal staff routes require authentication
quotationRouter.use(requireAuth);

/**
 * POST /api/v1/quotations
 * Create initial quotation (R0).
 */
quotationRouter.post(
  '/',
  requirePermission('quote:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CreateQuotationInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const quotation = await QuotationService.createQuotation(parseResult.data, user, context);
      return sendSuccess(req, res, quotation, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/quotations
 * List quotations with status, customer, and approval filters.
 */
quotationRouter.get(
  '/',
  requirePermission('quote:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = QuotationFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user;
      const result = await QuotationService.listQuotations(parseResult.data, user as any);
      return sendSuccess(req, res, result.items, 200, result.pagination);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/quotations/:id
 * Retrieve quotation details with populates.
 */
quotationRouter.get(
  '/:id',
  requirePermission('quote:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const quotation = await QuotationService.getQuotationById(id);
      return sendSuccess(req, res, quotation, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/quotations/:id/revisions
 * Create a new revision (R1, R2...) without modifying historical issued revision.
 */
quotationRouter.post(
  '/:id/revisions',
  requirePermission('quote:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const parseResult = ReviseQuotationInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const revised = await QuotationService.reviseQuotation(id, parseResult.data, user, context);
      return sendSuccess(req, res, revised, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/quotations/:id/approve-discount
 * Authorized manager approves discount (anti-self-approval enforced).
 */
quotationRouter.post(
  '/:id/approve-discount',
  requirePermission('quote:discount_approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const parseResult = DiscountApprovalInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const result = await QuotationService.approveDiscount(id, parseResult.data, user, context);
      return sendSuccess(req, res, result, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/quotations/:id/reject-discount
 * Authorized manager rejects discount.
 */
quotationRouter.post(
  '/:id/reject-discount',
  requirePermission('quote:discount_approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const parseResult = DiscountApprovalInputSchema.safeParse({
        ...req.body,
        action: 'REJECT'
      });
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const result = await QuotationService.approveDiscount(id, parseResult.data, user, context);
      return sendSuccess(req, res, result, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/quotations/:id/send
 * Mark quotation as issued/sent to customer.
 */
quotationRouter.post(
  '/:id/send',
  requirePermission('quote:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const quotation = await QuotationService.markAsSent(id, user, context);
      return sendSuccess(req, res, quotation, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/quotations/:id/pdf
 * View/download compiled proposal document.
 */
/**
 * POST /api/v1/quotations/:id/customer-decision
 * Record customer acceptance or rejection from employee workstation.
 */
quotationRouter.post(
  '/:id/customer-decision',
  requirePermission('quote:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const { decision, notes, rejectionReason } = req.body;
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const result = await QuotationService.recordWorkstationCustomerDecision(
        id,
        {
          action: decision === 'ACCEPT' ? 'ACCEPT' : 'REJECT',
          notes,
          rejectionReason
        },
        user,
        context
      );

      return sendSuccess(req, res, result, 200);
    } catch (err) {
      return next(err);
    }
  }
);

quotationRouter.get(
  '/:id/pdf',
  requirePermission('quote:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const html = await ProposalCompilerService.compileProposalHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (err) {
      return next(err);
    }
  }
);
