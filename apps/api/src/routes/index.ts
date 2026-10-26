import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter, devTestTokens } from './auth.routes.js';
import { customerAuthRouter, devCustomerTokens } from './customer-auth.routes.js';
import { catalogRouter } from './catalog.routes.js';
import { warehouseRouter } from './warehouse.routes.js';
import { leadRouter } from './lead.routes.js';
import { surveyRouter } from './survey.routes.js';
import { solarDesignRouter } from './solarDesign.routes.js';
import { quotationRouter } from './quotation.routes.js';
import { customerQuotationRouter } from './customerQuotation.routes.js';
import { orderRouter } from './order.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { customerOrderRouter } from './customerOrder.routes.js';
import { vendorRouter } from './vendor.routes.js';
import { purchaseOrderRouter } from './purchaseOrder.routes.js';
import { goodsReceiptRouter } from './goodsReceipt.routes.js';
import { vendorInvoiceRouter } from './vendorInvoice.routes.js';
import { config } from '../config/env.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import {
  requireAuth,
  requireEmployee,
  requireCustomer,
  requirePermission,
  requireMfa,
  requireDepartmentScope,
  checkAntiSelfApproval,
  requireCustomerOwnership
} from '../middleware/authorize.js';

export const apiRouter = Router();

// Mount Subrouters
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customer-auth', customerAuthRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/warehouses', warehouseRouter);
apiRouter.use('/leads', leadRouter);
apiRouter.use('/surveys', surveyRouter);
apiRouter.use('/solar-designs', solarDesignRouter);
apiRouter.use('/quotations', quotationRouter);
apiRouter.use('/customer-portal/quotations', customerQuotationRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/customer-portal/orders', customerOrderRouter);
apiRouter.use('/vendors', vendorRouter);
apiRouter.use('/purchase-orders', purchaseOrderRouter);
apiRouter.use('/goods-receipts', goodsReceiptRouter);
apiRouter.use('/vendor-invoices', vendorInvoiceRouter);

// Development/Test only tokens route (strictly unavailable in production)
if (config.NODE_ENV !== 'production') {
  apiRouter.get('/dev/last-tokens', (req, res) => {
    sendSuccess(req, res, {
      lastPasswordResetToken: devTestTokens.lastPasswordResetToken,
      lastMagicLinkToken: devCustomerTokens.lastMagicLinkToken,
      lastOtp: devCustomerTokens.lastOtp
    });
  });
}

// Test-only authorization guard test harnesses
if (config.NODE_ENV === 'test') {
  const testGuardRouter = Router();

  testGuardRouter.post(
    '/department-scoped',
    requireAuth,
    requireEmployee,
    requireDepartmentScope(req => req.body.targetDepartment),
    (req, res) => sendSuccess(req, res, { authorized: true })
  );

  testGuardRouter.post(
    '/anti-self-approval',
    requireAuth,
    requireEmployee,
    checkAntiSelfApproval(req => req.body.ownerUserId),
    (req, res) => sendSuccess(req, res, { approved: true })
  );

  testGuardRouter.post(
    '/customer-resource',
    requireAuth,
    requireCustomer,
    requireCustomerOwnership(req => req.body.resourceCustomerId),
    (req, res) => sendSuccess(req, res, { customerData: 'confidential' })
  );

  testGuardRouter.get('/privileged-mfa', requireAuth, requireEmployee, requireMfa, (req, res) =>
    sendSuccess(req, res, { mfaProtected: true })
  );

  testGuardRouter.get(
    '/permission-guarded',
    requireAuth,
    requireEmployee,
    requirePermission('quote:discount_approve'),
    (req, res) => sendSuccess(req, res, { permissionApproved: true })
  );

  apiRouter.use('/test-guard', testGuardRouter);
}
