/**
 * INS Solar Business Management Software — Customer Payment & Receivables Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  recordPaymentSchema,
  verifyPaymentSchema,
  allocatePaymentSchema,
  reverseAllocationSchema,
  reversePaymentSchema,
  refundPaymentSchema,
  paymentFilterSchema
} from '@ins-solar/shared';
import { PaymentService } from '../services/paymentService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const paymentRouter = Router();

paymentRouter.use(requireAuth);
paymentRouter.use(requireEmployee);

/**
 * GET /api/v1/payments
 * List customer payments with pagination, status, and method filters.
 */
paymentRouter.get(
  '/',
  requirePermission('payment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = paymentFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await PaymentService.getPayments(parseResult.data, {
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
 * POST /api/v1/payments
 * Record a new customer payment with atomic receipt numbering.
 */
paymentRouter.post(
  '/',
  requirePermission('payment:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = recordPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const payment = await PaymentService.recordPayment(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, payment, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/payments/receivables/orders/:orderId
 * Get receivables, allocated payments, and outstanding balance for a specific Sales Order.
 */
paymentRouter.get(
  '/receivables/orders/:orderId',
  requirePermission('payment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = String(req.params.orderId || '');
      const result = await PaymentService.getOrderReceivables(orderId, {
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
 * GET /api/v1/payments/receivables/customers/:customerId
 * Get comprehensive customer receivables, unallocated credit, and aging statement.
 */
paymentRouter.get(
  '/receivables/customers/:customerId',
  requirePermission('payment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = String(req.params.customerId || '');
      const result = await PaymentService.getCustomerReceivables(customerId, {
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
 * GET /api/v1/payments/:id
 * Get single payment details with populated allocations.
 */
paymentRouter.get(
  '/:id',
  requirePermission('payment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paymentId = String(req.params.id || '');
      const payment = await PaymentService.getPaymentById(paymentId, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, payment);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/payments/:id/verify
 * Confirm/verify a recorded customer payment.
 */
paymentRouter.patch(
  '/:id/verify',
  requirePermission('payment:verify'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = verifyPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const paymentId = String(req.params.id || '');
      const payment = await PaymentService.verifyPayment(paymentId, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, payment);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/payments/:id/allocate
 * Allocate verified payment funds to an eligible Sales Order of the same customer.
 */
paymentRouter.post(
  '/:id/allocate',
  requirePermission('payment:allocate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = allocatePaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const paymentId = String(req.params.id || '');
      const result = await PaymentService.allocatePayment(paymentId, parseResult.data, {
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
 * POST /api/v1/payments/allocations/:allocationId/reverse
 * Reverse an active payment allocation.
 */
paymentRouter.post(
  '/allocations/:allocationId/reverse',
  requirePermission('payment:reverse'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reverseAllocationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const allocationId = String(req.params.allocationId || '');
      const allocation = await PaymentService.reverseAllocation(
        allocationId,
        parseResult.data,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, allocation);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/payments/:id/reverse
 * Reverse a payment and cascade-reverse any active allocations.
 */
paymentRouter.post(
  '/:id/reverse',
  requirePermission('payment:reverse'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reversePaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const paymentId = String(req.params.id || '');
      const payment = await PaymentService.reversePayment(paymentId, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, payment);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/payments/:id/refund
 * Record a customer refund from unallocated payment funds.
 */
paymentRouter.post(
  '/:id/refund',
  requirePermission('payment:reverse'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = refundPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const paymentId = String(req.params.id || '');
      const payment = await PaymentService.refundPayment(paymentId, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, payment);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/payments/:id/receipt
 * Get printable operational payment receipt data.
 */
paymentRouter.get(
  '/:id/receipt',
  requirePermission('payment:receipt_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paymentId = String(req.params.id || '');
      const receipt = await PaymentService.getReceiptDocument(paymentId, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, receipt);
    } catch (err) {
      return next(err);
    }
  }
);
