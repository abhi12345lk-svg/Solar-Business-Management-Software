import { ensureCustomerPortalSession } from '../middleware/customerPortalGuard.js';
/**
 * INS Solar Business Management Software — Customer Portal Quotation Routes
 *
 * Provides customer-scoped REST endpoints mounted at /api/v1/customer-portal/quotations:
 * - GET /: list quotations issued to authenticated customer
 * - GET /:id: view quotation details
 * - POST /:id/accept: digital acceptance of quotation revision
 * - POST /:id/reject: decline quotation revision
 * - GET /:id/pdf: download proposal document
 *
 * Strict record-level customer isolation is enforced; customerId is taken
 * exclusively from req.session.customer.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CustomerQuotationDecisionSchema } from '@ins-solar/shared';
import { Quotation } from '../models/Quotation.js';
import { QuotationService } from '../services/quotationService.js';
import { ProposalCompilerService } from '../services/proposalCompilerService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerQuotationRouter = Router();

// Customer portal authentication middleware
customerQuotationRouter.use(requireAuth);
customerQuotationRouter.use(ensureCustomerPortalSession);

/**
 * GET /api/v1/customer-portal/quotations
 * List quotations eligible for review by the logged-in customer.
 */
customerQuotationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;

    const quotations = await Quotation.find({
      customerId,
      status: { $in: ['SENT', 'APPROVED', 'ACCEPTED', 'REJECTED'] }
    })
      .sort({ createdAt: -1 })
      .select(
        'quotationNumber revisionNumber fullQuotationCode systemTopology systemCapacityKwp netTotalPaise validUntil status acceptedAt'
      )
      .lean();

    return sendSuccess(req, res, quotations, 200);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/quotations/:id
 * Retrieve full quotation details for authenticated customer.
 */
customerQuotationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return next(AppError.validationFailed('Invalid Quotation ID format.'));
    }

    const customerId = req.session.customer!.customerId;
    const quotation = await QuotationService.getQuotationById(id);

    // Customer isolation check
    if (quotation.customerId._id.toString() !== customerId) {
      return next(
        AppError.permissionDenied(
          "Access denied: You cannot view or modify another customer's resources."
        )
      );
    }

    return sendSuccess(req, res, quotation, 200);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/customer-portal/quotations/:id/accept
 * Digital acceptance of quotation revision by authenticated customer.
 */
customerQuotationRouter.post(
  '/:id/accept',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const parseResult = CustomerQuotationDecisionSchema.safeParse({
        ...req.body,
        action: 'ACCEPT'
      });
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const customerId = req.session.customer!.customerId;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const accepted = await QuotationService.customerDecision(
        id,
        parseResult.data,
        customerId,
        context
      );
      return sendSuccess(req, res, accepted, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/customer-portal/quotations/:id/reject
 * Customer declines quotation revision with reason.
 */
customerQuotationRouter.post(
  '/:id/reject',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return next(AppError.validationFailed('Invalid Quotation ID format.'));
      }

      const parseResult = CustomerQuotationDecisionSchema.safeParse({
        ...req.body,
        action: 'REJECT'
      });
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const customerId = req.session.customer!.customerId;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const rejected = await QuotationService.customerDecision(
        id,
        parseResult.data,
        customerId,
        context
      );
      return sendSuccess(req, res, rejected, 200);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/customer-portal/quotations/:id/pdf
 * Download compiled proposal document for customer.
 */
customerQuotationRouter.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return next(AppError.validationFailed('Invalid Quotation ID format.'));
    }

    const customerId = req.session.customer!.customerId;
    const quotation = await Quotation.findById(id);

    if (!quotation) {
      return next(AppError.notFound('Quotation not found.'));
    }

    // Customer isolation check
    if (quotation.customerId.toString() !== customerId) {
      return next(
        AppError.permissionDenied(
          "Access denied: You cannot view or modify another customer's resources."
        )
      );
    }

    const html = await ProposalCompilerService.compileProposalHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
});
