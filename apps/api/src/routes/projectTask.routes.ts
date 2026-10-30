import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import {
  projectTaskFilterSchema,
  unifiedTaskFilterSchema,
  updateProjectTaskSchema,
  createUnifiedTaskSchema,
  reassignTaskSchema,
  updateTaskStatusSchema,
  Permission,
  UserRole,
  ROLE_DEFAULT_PERMISSIONS,
  ErrorCode
} from '@ins-solar/shared';
import { ProjectTaskService } from '../services/projectTaskService.js';
import { requireAuth, requireEmployee } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const projectTaskRouter = Router();

projectTaskRouter.use(requireAuth);
projectTaskRouter.use(requireEmployee);

function requireAnyPermission(permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.session?.user;
    if (!user) {
      return next(new AppError(401, 'Authentication required.', ErrorCode.AUTHENTICATION_REQUIRED));
    }
    if (user.role === UserRole.SUPERADMIN) {
      return next();
    }
    const effectivePermissions: Permission[] = req.currentUser
      ? req.currentUser.getEffectivePermissions()
      : [
          ...(ROLE_DEFAULT_PERMISSIONS[user.role] || []),
          ...(((user as any).permissions as Permission[]) || [])
        ];

    const hasAny = permissions.some(p => effectivePermissions.includes(p));
    if (hasAny) {
      return next();
    }

    return next(
      new AppError(
        403,
        `Missing required permission: one of [${permissions.join(', ')}] required.`,
        ErrorCode.PERMISSION_DENIED
      )
    );
  };
}

/**
 * GET /api/v1/tasks
 * Unified task list across projects, service visits, checklist follow-ups with filters.
 */
projectTaskRouter.get(
  '/',
  requireAnyPermission(['task:read', 'project:read']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = unifiedTaskFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        // Fall back to legacy filter schema if unified has unexpected format
        const legacyResult = projectTaskFilterSchema.safeParse(req.query);
        if (!legacyResult.success) {
          return next(AppError.validation(parseResult.error));
        }
        const result = await ProjectTaskService.getTasks(legacyResult.data);
        return sendSuccess(req, res, result);
      }

      const result = await ProjectTaskService.getTasks(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/tasks
 * Create a unified task linked to project, service visit, checklist, or general task.
 */
projectTaskRouter.post(
  '/',
  requireAnyPermission(['task:create', 'project:update', 'project:task_manage']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createUnifiedTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const task = await ProjectTaskService.createUnifiedTask(parseResult.data, user, context);
      return sendSuccess(req, res, task, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/tasks/:id
 * Get single task by ID with linked entities and status/reassignment history.
 */
projectTaskRouter.get(
  '/:id',
  requireAnyPermission(['task:read', 'project:read']),
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
 * POST /api/v1/tasks/:id/reassign
 * Reassign task to a different employee or team with audit reason.
 */
projectTaskRouter.post(
  '/:id/reassign',
  requireAnyPermission(['task:assign', 'project:update', 'project:task_manage']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reassignTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const task = await ProjectTaskService.reassignTask(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, task);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/tasks/:id/status
 * Update task status with optional completion notes or blocker reason.
 */
projectTaskRouter.post(
  '/:id/status',
  requireAnyPermission(['task:update', 'project:update', 'project:task_manage']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateTaskStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const task = await ProjectTaskService.updateTaskStatus(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
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
  requireAnyPermission(['task:update', 'project:update']),
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

      const task = await ProjectTaskService.updateTask(
        req.params.id as string,
        parseResult.data,
        user,
        context
      );
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
  requireAnyPermission(['task:delete', 'project:update']),
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
