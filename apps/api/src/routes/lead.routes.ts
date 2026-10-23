import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateLeadInputSchema,
  UpdateLeadInputSchema,
  UpdateLeadStatusInputSchema,
  AssignLeadInputSchema,
  ConvertLeadInputSchema,
  LeadFilterSchema,
  CreateLeadActivityInputSchema,
  CompleteFollowUpInputSchema,
  FollowUpFilterSchema
} from '@ins-solar/shared';
import { LeadService } from '../services/leadService.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { AppError } from '../errors/AppError.js';

export const leadRouter = Router();

// ===========================================================================
// Duplicate Check & Follow-Up Listing (Prior to /:id param route)
// ===========================================================================

leadRouter.get(
  '/check-duplicate',
  requireAuth,
  requireEmployee,
  requirePermission('lead:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
      if (!phone) {
        throw AppError.validationFailed(
          'Phone query parameter is required for duplicate checking.'
        );
      }
      const excludeLeadId =
        typeof req.query.excludeLeadId === 'string' ? req.query.excludeLeadId : undefined;
      const result = await LeadService.checkDuplicatePhone(phone, excludeLeadId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.get(
  '/follow-ups',
  requireAuth,
  requireEmployee,
  requirePermission('lead:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = FollowUpFilterSchema.parse(req.query);
      const user = req.session!.user!;
      const result = await LeadService.listFollowUps(filter, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, result.data, 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.patch(
  '/activities/:activityId/complete',
  requireAuth,
  requireEmployee,
  requirePermission('lead:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CompleteFollowUpInputSchema.parse(req.body);
      const user = req.session!.user!;
      const result = await LeadService.completeFollowUp(req.params.activityId as string, input, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ===========================================================================
// Core Lead CRUD
// ===========================================================================

leadRouter.get(
  '/',
  requireAuth,
  requireEmployee,
  requirePermission('lead:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = LeadFilterSchema.parse(req.query);
      const user = req.session!.user!;
      const result = await LeadService.listLeads(filter, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, result.data, 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.post(
  '/',
  requireAuth,
  requireEmployee,
  requirePermission('lead:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateLeadInputSchema.parse(req.body);
      const user = req.session!.user!;
      const lead = await LeadService.createLead(
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, lead, 201);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.get(
  '/:id',
  requireAuth,
  requireEmployee,
  requirePermission('lead:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session!.user!;
      const lead = await LeadService.getLeadById(req.params.id as string, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, lead);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.put(
  '/:id',
  requireAuth,
  requireEmployee,
  requirePermission('lead:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateLeadInputSchema.parse(req.body);
      const user = req.session!.user!;
      const lead = await LeadService.updateLead(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, lead);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.patch(
  '/:id/status',
  requireAuth,
  requireEmployee,
  requirePermission('lead:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateLeadStatusInputSchema.parse(req.body);
      const user = req.session!.user!;
      const lead = await LeadService.updateStatus(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, lead);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.post(
  '/:id/assign',
  requireAuth,
  requireEmployee,
  requirePermission('lead:assign'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AssignLeadInputSchema.parse(req.body);
      const user = req.session!.user!;
      const lead = await LeadService.assignLead(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, lead);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.post(
  '/:id/convert',
  requireAuth,
  requireEmployee,
  requirePermission('lead:convert'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = ConvertLeadInputSchema.parse(req.body);
      const user = req.session!.user!;
      const result = await LeadService.convertLead(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ===========================================================================
// Lead Activity & Timeline Routes
// ===========================================================================

leadRouter.get(
  '/:id/activities',
  requireAuth,
  requireEmployee,
  requirePermission('lead:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session!.user!;
      const activities = await LeadService.listActivities(req.params.id as string, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, activities);
    } catch (err) {
      next(err);
    }
  }
);

leadRouter.post(
  '/:id/activities',
  requireAuth,
  requireEmployee,
  requirePermission('lead:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateLeadActivityInputSchema.parse(req.body);
      const user = req.session!.user!;
      const activity = await LeadService.addActivity(req.params.id as string, input, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, activity, 201);
    } catch (err) {
      next(err);
    }
  }
);
