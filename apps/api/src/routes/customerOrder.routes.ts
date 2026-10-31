import { ensureCustomerPortalSession } from '../middleware/customerPortalGuard.js';
/**
 * INS Solar Business Management Software — Customer Portal Order Routes
 *
 * Provides customer-scoped REST endpoints mounted at /api/v1/customer-portal/orders:
 * - GET /: list sales orders for the authenticated customer
 * - GET /:id: view order details and delivery readiness
 *
 * Strict record-level customer isolation is enforced; customerId is taken
 * exclusively from req.session.customer.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SalesOrder } from '../models/SalesOrder.js';
import { OrderService } from '../services/orderService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';

export const customerOrderRouter = Router();

// Customer portal authentication middleware
customerOrderRouter.use(requireAuth);
customerOrderRouter.use(ensureCustomerPortalSession);

/**
 * GET /api/v1/customer-portal/orders
 * List orders belonging strictly to the logged-in customer.
 */
customerOrderRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;

    const orders = await SalesOrder.find({ customerId })
      .select(
        'orderNumber orderDate status systemCapacityKwp commercialSnapshot paymentMilestones createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(req, res, { items: orders, total: orders.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/orders/:id
 * Retrieve a specific order belonging to the logged-in customer.
 */
customerOrderRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const order = await OrderService.getOrderById(req.params.id as string, customerId);

    // Sanitize internal references before returning to customer portal
    const sanitized = {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      status: order.status,
      systemCapacityKwp: order.systemCapacityKwp,
      grossSubtotalPaise: order.grossSubtotalPaise,
      totalDiscountPaise: order.totalDiscountPaise,
      taxableAmountPaise: order.taxableAmountPaise,
      totalTaxPaise: order.totalTaxPaise,
      netTotalPaise: order.netTotalPaise,
      paymentMilestones: order.paymentMilestones,
      lineItems: order.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit
      })),
      createdAt: order.createdAt
    };

    return sendSuccess(req, res, sanitized);
  } catch (err) {
    return next(err);
  }
});
