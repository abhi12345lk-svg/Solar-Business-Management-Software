/**
 * INS Solar Business Management Software — Customer Portal Payment Routes
 *
 * Provides customer-scoped payment history, receipts, and receivables statements.
 * Strictly enforces tenant boundary and redacts internal accounts notes.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { paymentFilterSchema } from '@ins-solar/shared';
import { PaymentService } from '../services/paymentService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerPaymentRouter = Router();

// Boundary guard: requires authenticated customer portal session
customerPaymentRouter.use(requireAuth);
customerPaymentRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.session?.customer?.customerId) {
    return next(
      AppError.permissionDenied('Customer portal session required to access this resource.')
    );
  }
  next();
});

/**
 * GET /api/v1/customer-portal/payments
 * List payments made by the authenticated customer.
 */
customerPaymentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = paymentFilterSchema.safeParse(req.query);
    const filters = parseResult.success ? parseResult.data : { page: 1, limit: 20 };

    const result = await PaymentService.getPayments(filters, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/payments/receivables
 * Get authenticated customer's orders, payments summary, and outstanding balance.
 */
customerPaymentRouter.get('/receivables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const result = await PaymentService.getCustomerReceivables(customerId, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/payments/:id/receipt
 * Get printable operational payment receipt for customer.
 */
customerPaymentRouter.get('/:id/receipt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const paymentId = String(req.params.id || '');
    const receipt = await PaymentService.getReceiptDocument(paymentId, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, receipt);
  } catch (err) {
    return next(err);
  }
});
