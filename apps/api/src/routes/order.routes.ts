/**
 * INS Solar Business Management Software — Sales Order Routes
 *
 * Provides versioned REST endpoints mounted at /api/v1/orders:
 * - POST /: create new sales order from accepted quotation revision
 * - GET /: list sales orders with filtering and pagination
 * - GET /:id: view order details and commercial snapshot
 * - POST /:id/cancel: cancel order with reservation release coordination
 * - POST /:id/reserve-stock: reserve stock allocation for order line items
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateOrderFromQuotationInputSchema,
  CancelOrderInputSchema,
  ReserveStockForOrderInputSchema,
  OrderFilterSchema
} from '@ins-solar/shared';
import { OrderService } from '../services/orderService.js';
import { StockService } from '../services/stockService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const orderRouter = Router();

// Internal employee routes require authentication
orderRouter.use(requireAuth);
orderRouter.use(requireEmployee);

/**
 * POST /api/v1/orders
 * Create sales order from an accepted quotation revision.
 */
orderRouter.post(
  '/',
  requirePermission('order:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CreateOrderFromQuotationInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const order = await OrderService.createOrderFromQuotation(parseResult.data, user, context);
      return sendSuccess(req, res, order, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/orders
 * List sales orders with status/reservation filters and pagination.
 */
orderRouter.get(
  '/',
  requirePermission('order:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = OrderFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await OrderService.listOrders(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/orders/:id
 * Retrieve sales order details with commercial snapshots and items.
 */
orderRouter.get(
  '/:id',
  requirePermission('order:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await OrderService.getOrderById(req.params.id as string);
      return sendSuccess(req, res, order);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/orders/:id/cancel
 * Cancel order with automated stock reservation release.
 */
orderRouter.post(
  '/:id/cancel',
  requirePermission('order:cancel'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CancelOrderInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const order = await OrderService.cancelOrder(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, order);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/orders/:id/reserve-stock
 * Reserve inventory stock for the order line items.
 */
orderRouter.post(
  '/:id/reserve-stock',
  requirePermission('inv:reserve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = ReserveStockForOrderInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const reservations = await StockService.reserveStockForOrder(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, reservations, 201);
    } catch (err) {
      return next(err);
    }
  }
);
