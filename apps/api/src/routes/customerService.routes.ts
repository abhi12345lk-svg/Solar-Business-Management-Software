/**
 * INS Solar Business Management Software — Customer Portal Service Routes
 *
 * Dedicated customer-facing endpoints with strict tenant isolation:
 * - Customers can ONLY view and submit requests for their own projects and equipment.
 * - Internal employee notes and diagnostic technical notes are strictly stripped.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createServiceComplaintSchema,
  complaintFilterSchema,
  warrantyFilterSchema,
  amcFilterSchema,
  serviceVisitFilterSchema
} from '@ins-solar/shared';
import { ServiceComplaintService } from '../services/serviceComplaintService.js';
import { WarrantyService } from '../services/warrantyService.js';
import { AmcService } from '../services/amcService.js';
import { ServiceVisitService } from '../services/serviceVisitService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerServiceRouter = Router();

// Customer portal session boundary enforcement
customerServiceRouter.use(requireAuth);
customerServiceRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.session?.customer?.customerId) {
    return next(
      AppError.permissionDenied('Customer portal session required to access this resource.')
    );
  }
  next();
});

/**
 * GET /api/v1/customer-portal/service/complaints
 * List complaints belonging strictly to the logged-in customer.
 */
customerServiceRouter.get('/complaints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = complaintFilterSchema.safeParse(req.query);
    const filterData = parseResult.success ? parseResult.data : {};

    const result = await ServiceComplaintService.getComplaints(filterData, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/customer-portal/service/complaints
 * Submit a service defect or breakdown complaint from the customer portal.
 */
customerServiceRouter.post('/complaints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = createServiceComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return next(AppError.validation(parseResult.error));
    }

    const complaint = await ServiceComplaintService.createComplaint(
      {
        ...parseResult.data,
        customerId
      },
      {
        isCustomer: true,
        customerId
      }
    );

    return sendSuccess(req, res, complaint, 201);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/service/complaints/:id
 * Retrieve customer complaint details.
 */
customerServiceRouter.get('/complaints/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const complaint = await ServiceComplaintService.getComplaintById(req.params.id as string, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, complaint);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/service/warranties
 * List warranties for equipment installed at customer's sites.
 */
customerServiceRouter.get('/warranties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = warrantyFilterSchema.safeParse(req.query);
    const filterData = parseResult.success ? parseResult.data : {};

    const result = await WarrantyService.getWarrantyRecords(filterData, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/service/amc
 * List Annual Maintenance Contracts belonging to the customer.
 */
customerServiceRouter.get('/amc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = amcFilterSchema.safeParse(req.query);
    const filterData = parseResult.success ? parseResult.data : {};

    const result = await AmcService.getAmcs(filterData, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/service/visits
 * List service visits for the customer's solar plants.
 */
customerServiceRouter.get('/visits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const parseResult = serviceVisitFilterSchema.safeParse(req.query);
    const filterData = parseResult.success ? parseResult.data : {};

    const result = await ServiceVisitService.getVisits(filterData, {
      isCustomer: true,
      customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});
