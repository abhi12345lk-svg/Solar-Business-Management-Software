/**
 * INS Solar Business Management Software — Subsidy Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createSubsidySchema,
  updateSubsidySchema,
  updateSubsidyStatusSchema,
  recordSanctionSchema,
  recordDisbursementSchema,
  uploadApplicationDocumentSchema,
  reviewApplicationDocumentSchema,
  subsidyFilterSchema
} from '@ins-solar/shared';
import { SubsidyService } from '../services/subsidyService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const subsidyRouter = Router();

subsidyRouter.use(requireAuth);
subsidyRouter.use(requireEmployee);

/**
 * GET /api/v1/subsidies
 * List subsidy applications with bounded filtering, pagination, and sorting.
 */
subsidyRouter.get(
  '/',
  requirePermission('subsidy:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = subsidyFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await SubsidyService.listApplications(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/subsidies
 * Create a new government subsidy application with atomic sequence number.
 */
subsidyRouter.post(
  '/',
  requirePermission('subsidy:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createSubsidySchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await SubsidyService.createApplication(parseResult.data, user, context);
      return sendSuccess(req, res, application, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/subsidies/:id
 * Retrieve a specific subsidy application by ID.
 */
subsidyRouter.get(
  '/:id',
  requirePermission('subsidy:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const application = await SubsidyService.getApplicationById(req.params.id as string);
      return sendSuccess(req, res, application);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/subsidies/:id
 * Update details of a subsidy application.
 */
subsidyRouter.patch(
  '/:id',
  requirePermission('subsidy:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateSubsidySchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await SubsidyService.updateApplication(
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
 * PATCH /api/v1/subsidies/:id/status
 * Perform validated status transition with required document verification gate.
 */
subsidyRouter.patch(
  '/:id/status',
  requirePermission('subsidy:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateSubsidyStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await SubsidyService.transitionStatus(
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
 * POST /api/v1/subsidies/:id/sanction
 * Record official sanction with approved amount invariant verification.
 */
subsidyRouter.post(
  '/:id/sanction',
  requirePermission('subsidy:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = recordSanctionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await SubsidyService.recordSanction(
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
 * POST /api/v1/subsidies/:id/disbursements
 * Record partial or full disbursement with idempotency protection and balance invariant.
 */
subsidyRouter.post(
  '/:id/disbursements',
  requirePermission('subsidy:disburse'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = recordDisbursementSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
      };

      const application = await SubsidyService.recordDisbursement(
        req.params.id as string,
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
 * GET /api/v1/subsidies/:id/disbursements/summary
 * Retrieve balance summary (requested, approved, disbursed, remaining).
 */
subsidyRouter.get(
  '/:id/disbursements/summary',
  requirePermission('subsidy:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await SubsidyService.getDisbursementSummary(req.params.id as string);
      return sendSuccess(req, res, summary);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/subsidies/:id/documents
 * Attach document evidence with private storageKey boundary.
 */
subsidyRouter.post(
  '/:id/documents',
  requirePermission('subsidy:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = uploadApplicationDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const doc = await SubsidyService.uploadDocument(
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
 * PATCH /api/v1/subsidies/:id/documents/:docId/review
 * Review application document (ACCEPT / REJECT / RESUBMISSION_REQUIRED).
 */
subsidyRouter.patch(
  '/:id/documents/:docId/review',
  requirePermission('subsidy:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reviewApplicationDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const doc = await SubsidyService.reviewDocument(
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
 * GET /api/v1/subsidies/:id/documents/:docId/access
 * Retrieve short-lived authorized access URL for private document evidence.
 */
subsidyRouter.get(
  '/:id/documents/:docId/access',
  requirePermission('subsidy:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const access = await SubsidyService.getAuthorizedDocumentAccess(
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
