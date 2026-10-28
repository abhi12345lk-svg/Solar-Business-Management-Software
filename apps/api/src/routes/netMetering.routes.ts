/**
 * INS Solar Business Management Software — Net Metering Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createNetMeteringSchema,
  updateNetMeteringSchema,
  updateNetMeteringStatusSchema,
  scheduleInspectionSchema,
  recordInspectionOutcomeSchema,
  recordMeterInstallationSchema,
  updateFeasibilityDemandNoteSchema,
  uploadApplicationDocumentSchema,
  reviewApplicationDocumentSchema,
  netMeteringFilterSchema
} from '@ins-solar/shared';
import { NetMeteringService } from '../services/netMeteringService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const netMeteringRouter = Router();

netMeteringRouter.use(requireAuth);
netMeteringRouter.use(requireEmployee);

/**
 * GET /api/v1/net-metering
 * List Net Metering applications with bounded filtering, pagination, and sorting.
 */
netMeteringRouter.get(
  '/',
  requirePermission('net_metering:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = netMeteringFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await NetMeteringService.listApplications(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/net-metering
 * Create a new Net Metering application with atomic sequence number.
 */
netMeteringRouter.post(
  '/',
  requirePermission('net_metering:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createNetMeteringSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.createApplication(
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/net-metering/:id
 * Retrieve a specific Net Metering application by ID.
 */
netMeteringRouter.get(
  '/:id',
  requirePermission('net_metering:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const application = await NetMeteringService.getApplicationById(req.params.id as string);
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/net-metering/:id
 * Update details of a Net Metering application.
 */
netMeteringRouter.patch(
  '/:id',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateNetMeteringSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.updateApplication(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/net-metering/:id/status
 * Perform validated status transition with required document verification gate.
 */
netMeteringRouter.patch(
  '/:id/status',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateNetMeteringStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.transitionStatus(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/net-metering/:id/schedule-inspection
 * Schedule or reschedule DISCOM field inspection.
 */
netMeteringRouter.post(
  '/:id/schedule-inspection',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = scheduleInspectionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.scheduleInspection(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/net-metering/:id/inspection-outcome
 * Record outcome of DISCOM field inspection (PASSED / FAILED).
 */
netMeteringRouter.post(
  '/:id/inspection-outcome',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = recordInspectionOutcomeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.recordInspectionOutcome(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/net-metering/:id/meter-installation
 * Record bi-directional meter installation and initial readings.
 */
netMeteringRouter.post(
  '/:id/meter-installation',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = recordMeterInstallationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await NetMeteringService.recordMeterInstallation(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/net-metering/:id/feasibility-demand-note
 * Update technical feasibility and demand note payment status.
 */
netMeteringRouter.patch(
  '/:id/feasibility-demand-note',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateFeasibilityDemandNoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const application = await NetMeteringService.updateFeasibilityDemandNote(
        req.params.id as string,
        parseResult.data,
        user
      );
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/net-metering/:id/documents
 * Attach document evidence with private storageKey boundary.
 */
netMeteringRouter.post(
  '/:id/documents',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = uploadApplicationDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const doc = await NetMeteringService.uploadDocument(
        req.params.id as string,
        parseResult.data,
        user
      );
      return sendSuccess(req, res, doc, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/net-metering/:id/documents/:docId/review
 * Review application document (ACCEPT / REJECT / RESUBMISSION_REQUIRED).
 */
netMeteringRouter.patch(
  '/:id/documents/:docId/review',
  requirePermission('net_metering:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reviewApplicationDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const doc = await NetMeteringService.reviewDocument(
        req.params.id as string,
        req.params.docId as string,
        parseResult.data,
        user
      );
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/net-metering/:id/documents/:docId/access
 * Retrieve short-lived authorized access URL for private document evidence.
 */
netMeteringRouter.get(
  '/:id/documents/:docId/access',
  requirePermission('net_metering:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const access = await NetMeteringService.getAuthorizedDocumentAccess(
        req.params.id as string,
        req.params.docId as string,
        { userId: user.userId }
      );
      return sendSuccess(req, res, access);
    } catch (err) {
      return next(err);
    }
  }
);
