import { Router, Request, Response, NextFunction } from 'express';
import { createTeamSchema, updateTeamSchema, teamFilterSchema } from '@ins-solar/shared';
import { TeamService } from '../services/teamService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const teamRouter = Router();

teamRouter.use(requireAuth);
teamRouter.use(requireEmployee);

/**
 * GET /api/v1/teams
 * List operational teams with department and eligibility filters.
 */
teamRouter.get(
  '/',
  requirePermission('team:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = teamFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await TeamService.listTeams(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/teams/:id
 * Get single team with lead, members, and active task workload.
 */
teamRouter.get(
  '/:id',
  requirePermission('team:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const team = await TeamService.getTeamById(req.params.id as string);
      return sendSuccess(req, res, team);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/teams
 * Create a new team with unique code and member assignments.
 */
teamRouter.post(
  '/',
  requirePermission('team:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createTeamSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const team = await TeamService.createTeam(parseResult.data, {
        userId: user.userId,
        ...context
      });
      return sendSuccess(req, res, team, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/teams/:id
 * Update team attributes, purpose, lead, and members.
 */
teamRouter.put(
  '/:id',
  requirePermission('team:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateTeamSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const updated = await TeamService.updateTeam(req.params.id as string, parseResult.data, {
        userId: user.userId,
        ...context
      });
      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/teams/:id/status
 * Toggle active/inactive status of a team.
 */
teamRouter.patch(
  '/:id/status',
  requirePermission('team:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive, reason } = req.body || {};
      if (typeof isActive !== 'boolean') {
        return next(AppError.validation('isActive boolean field is required.'));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const team = await TeamService.toggleTeamStatus(req.params.id as string, isActive, reason, {
        userId: user.userId,
        ...context
      });
      return sendSuccess(req, res, team);
    } catch (err) {
      return next(err);
    }
  }
);
