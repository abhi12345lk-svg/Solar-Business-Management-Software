/**
 * INS Solar Business Management Software — Service Complaint Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createServiceComplaintSchema,
  complaintStatusTransitionSchema,
  assignComplaintSchema,
  reopenComplaintSchema,
  complaintFilterSchema
} from '@ins-solar/shared';
import { ServiceComplaintService } from '../services/serviceComplaintService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const complaintRouter = Router();

complaintRouter.use(requireAuth);
complaintRouter.use(requireEmployee);

/**
 * GET /api/v1/complaints
 * List service complaints with pagination, filtering, and search.
 */
complaintRouter.get(
  '/',
  requirePermission('service:ticket_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = complaintFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await ServiceComplaintService.getComplaints(parseResult.data, {
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
 * POST /api/v1/complaints
 * Create a new service complaint ticket.
 */
complaintRouter.post(
  '/',
  requirePermission('service:ticket_create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createServiceComplaintSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const complaint = await ServiceComplaintService.createComplaint(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, complaint, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/complaints/:id
 * Retrieve details of a specific service complaint.
 */
complaintRouter.get(
  '/:id',
  requirePermission('service:ticket_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const complaint = await ServiceComplaintService.getComplaintById(req.params.id as string, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department
      });

      return sendSuccess(req, res, complaint);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/complaints/:id/status
 * Transition complaint status with validated state machine rules.
 */
complaintRouter.patch(
  '/:id/status',
  requirePermission('service:ticket_resolve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = complaintStatusTransitionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await ServiceComplaintService.updateStatus(
        req.params.id as string,
        parseResult.data.status,
        {
          notes: parseResult.data.notes,
          resolutionSummary: parseResult.data.resolutionSummary
        },
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/complaints/:id/assign
 * Assign an accountable technician to the complaint ticket.
 */
complaintRouter.patch(
  '/:id/assign',
  requirePermission('service:ticket_resolve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = assignComplaintSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await ServiceComplaintService.assignTechnician(
        req.params.id as string,
        parseResult.data.assignedTechnicianId,
        parseResult.data.notes,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/complaints/:id/reopen
 * Reopen a resolved or closed complaint.
 */
complaintRouter.post(
  '/:id/reopen',
  requirePermission('service:ticket_resolve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reopenComplaintSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const updated = await ServiceComplaintService.reopenComplaint(
        req.params.id as string,
        parseResult.data.reason,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/complaints/:id/notes
 * Add an internal or customer-visible progress note.
 */
complaintRouter.post(
  '/:id/notes',
  requirePermission('service:ticket_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { note, isInternal = true } = req.body;
      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return next(AppError.badRequest('Note content cannot be empty.'));
      }

      const updated = await ServiceComplaintService.addNote(
        req.params.id as string,
        note,
        Boolean(isInternal),
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department
        }
      );

      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);
