import { Router, Request, Response, NextFunction } from 'express';
import {
  projectTaskFilterSchema,
  updateProjectTaskSchema
} from '@ins-solar/shared';
import { ProjectTaskService } from '../services/projectTaskService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const projectTaskRouter = Router();

projectTaskRouter.use(requireAuth);
projectTaskRouter.use(requireEmployee);

/**
 * GET /api/v1/tasks
 * Global list of tasks across projects with filtering (assignee, status, overdue).
 */
projectTaskRouter.get(
  '/',
  requirePermission('project:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = projectTaskFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await ProjectTaskService.getTasks(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/tasks/:id
 * Get single task by ID.
 */
projectTaskRouter.get(
  '/:id',
  requirePermission('project:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await ProjectTaskService.getTaskById(req.params.id as string);
      return sendSuccess(req, res, task);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/tasks/:id
 * Update task attributes or status.
 */
projectTaskRouter.put(
  '/:id',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateProjectTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const task = await ProjectTaskService.updateTask(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, task);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/tasks/:id
 * Remove task.
 */
projectTaskRouter.delete(
  '/:id',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      await ProjectTaskService.deleteTask(req.params.id as string, user, context);
      return sendSuccess(req, res, { deleted: true });
    } catch (err) {
      return next(err);
    }
  }
);
