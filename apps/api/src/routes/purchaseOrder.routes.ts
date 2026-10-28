import { Router, Request, Response, NextFunction } from 'express';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  approvePurchaseOrderSchema,
  rejectPurchaseOrderSchema,
  poFilterSchema
} from '@ins-solar/shared';
import { PurchaseOrderService } from '../services/purchaseOrderService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const purchaseOrderRouter = Router();

purchaseOrderRouter.use(requireAuth);
purchaseOrderRouter.use(requireEmployee);

/**
 * POST /api/v1/purchase-orders
 * Create a new draft Purchase Order.
 */
purchaseOrderRouter.post(
  '/',
  requirePermission('po:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createPurchaseOrderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.createPurchaseOrder(parseResult.data, user, context);
      return sendSuccess(req, res, po, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/purchase-orders
 * List purchase orders with filtering and pagination.
 */
purchaseOrderRouter.get(
  '/',
  requirePermission('po:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = poFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await PurchaseOrderService.getPurchaseOrders(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/purchase-orders/:id
 * Get purchase order details by ID.
 */
purchaseOrderRouter.get(
  '/:id',
  requirePermission('po:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await PurchaseOrderService.getPurchaseOrderById(req.params.id as string);
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/purchase-orders/:id
 * Update draft purchase order.
 */
purchaseOrderRouter.put(
  '/:id',
  requirePermission('po:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updatePurchaseOrderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.updatePurchaseOrder(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/purchase-orders/:id/submit
 * Submit purchase order for approval.
 */
purchaseOrderRouter.post(
  '/:id/submit',
  requirePermission('po:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.submitForApproval(
        req.params.id as string,
        user,
        context
      );
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/purchase-orders/:id/approve
 * Approve purchase order (with anti-self-approval enforcement).
 */
purchaseOrderRouter.post(
  '/:id/approve',
  requirePermission('po:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = approvePurchaseOrderSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.approvePurchaseOrder(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/purchase-orders/:id/reject
 * Reject purchase order with reason.
 */
purchaseOrderRouter.post(
  '/:id/reject',
  requirePermission('po:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = rejectPurchaseOrderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.rejectPurchaseOrder(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/purchase-orders/:id/cancel
 * Cancel purchase order (if no goods have been received).
 */
purchaseOrderRouter.post(
  '/:id/cancel',
  requirePermission('po:cancel'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reason = req.body.reason || 'Cancelled by purchaser';
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const po = await PurchaseOrderService.cancelPurchaseOrder(
        req.params.id as string,
        reason,
        user,
        context
      );
      return sendSuccess(req, res, po);
    } catch (err) {
      return next(err);
    }
  }
);
