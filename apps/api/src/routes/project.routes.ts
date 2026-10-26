import { Router, Request, Response, NextFunction } from 'express';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  updateProjectStageSchema,
  projectFilterSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  updateMilestoneStatusSchema,
  createProjectTaskSchema,
  projectTaskFilterSchema
} from '@ins-solar/shared';
import { ProjectService } from '../services/projectService.js';
import { ProjectTaskService } from '../services/projectTaskService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const projectRouter = Router();

projectRouter.use(requireAuth);
projectRouter.use(requireEmployee);

/**
 * POST /api/v1/projects
 * Create a new Project.
 */
projectRouter.post(
  '/',
  requirePermission('project:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createProjectSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.createProject(parseResult.data, user, context);
      return sendSuccess(req, res, project, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects
 * List projects with filters and pagination.
 */
projectRouter.get(
  '/',
  requirePermission('project:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = projectFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await ProjectService.getProjects(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:id
 * Get single project detail by ID.
 */
projectRouter.get(
  '/:id',
  requirePermission('project:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await ProjectService.getProjectById(req.params.id as string);
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/projects/:id
 * Update project metadata.
 */
projectRouter.put(
  '/:id',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateProjectSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.updateProject(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/status
 * Transition project status.
 */
projectRouter.post(
  '/:id/status',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateProjectStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.updateProjectStatus(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/stage
 * Advance project stage.
 */
projectRouter.post(
  '/:id/stage',
  requirePermission('project:stage_advance'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateProjectStageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.advanceProjectStage(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/milestones
 * Add milestone to project.
 */
projectRouter.post(
  '/:id/milestones',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createMilestoneSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.addMilestone(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, project, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/projects/:id/milestones/:milestoneId
 * Update milestone details.
 */
projectRouter.put(
  '/:id/milestones/:milestoneId',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateMilestoneSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.updateMilestone(
        req.params.id as string,
        req.params.milestoneId as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/milestones/:milestoneId/status
 * Transition milestone status.
 */
projectRouter.post(
  '/:id/milestones/:milestoneId/status',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateMilestoneStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const project = await ProjectService.updateMilestoneStatus(
        req.params.id as string,
        req.params.milestoneId as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, project);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:id/tasks
 * List tasks for a specific project.
 */
projectRouter.get(
  '/:id/tasks',
  requirePermission('project:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = projectTaskFilterSchema.safeParse({
        ...req.query,
        projectId: req.params.id
      });
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
 * POST /api/v1/projects/:id/tasks
 * Create task inside a specific project.
 */
projectRouter.post(
  '/:id/tasks',
  requirePermission('project:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createProjectTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const task = await ProjectTaskService.createTask(req.params.id as string, parseResult.data, user, context);
      return sendSuccess(req, res, task, 201);
    } catch (err) {
      return next(err);
    }
  }
);
