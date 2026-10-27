import { Router, Request, Response, NextFunction } from 'express';
import {
  createEmployeeProfileSchema,
  updateEmployeeProfileSchema,
  employeeFilterSchema
} from '@ins-solar/shared';
import { EmployeeService } from '../services/employeeService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const employeeRouter = Router();

employeeRouter.use(requireAuth);
employeeRouter.use(requireEmployee);

/**
 * GET /api/v1/employees
 * List employee profiles with department, status, availability filters and workload.
 */
employeeRouter.get(
  '/',
  requirePermission('employee:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = employeeFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await EmployeeService.listEmployees(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/employees/:id
 * Get single employee profile with detailed workload summary.
 */
employeeRouter.get(
  '/:id',
  requirePermission('employee:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await EmployeeService.getEmployeeById(req.params.id as string);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/employees
 * Create HR operational profile linked to an existing User.
 */
employeeRouter.post(
  '/',
  requirePermission('employee:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createEmployeeProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const profile = await EmployeeService.createProfile(parseResult.data, {
        userId: user.userId,
        ...context
      });
      return sendSuccess(req, res, profile, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/employees/:id
 * Update employee operational metadata.
 */
employeeRouter.put(
  '/:id',
  requirePermission('employee:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateEmployeeProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const updated = await EmployeeService.updateProfile(
        req.params.id as string,
        parseResult.data,
        {
          userId: user.userId,
          ...context
        }
      );
      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/employees/:id/deactivate
 * Safely deactivate employee without deleting history, optionally reassigning pending tasks/visits.
 */
employeeRouter.patch(
  '/:id/deactivate',
  requirePermission('employee:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reassignToUserId, deactivationReason } = req.body || {};
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const result = await EmployeeService.deactivateEmployee(
        req.params.id as string,
        { reassignToUserId, reassignmentReason: deactivationReason },
        {
          userId: user.userId,
          ...context
        }
      );
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);
