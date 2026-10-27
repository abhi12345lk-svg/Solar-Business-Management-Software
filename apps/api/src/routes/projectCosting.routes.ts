/**
 * INS Solar Business Management Software — Project Costing & Budget Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createProjectBudgetSchema,
  approveProjectBudgetSchema
} from '@ins-solar/shared';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const projectCostingRouter = Router({ mergeParams: true });

projectCostingRouter.use(requireAuth);
projectCostingRouter.use(requireEmployee);

/**
 * GET /api/v1/projects/:projectId/cost-ledger
 * Line-by-line project cost entries from materials dispatches and direct expenses.
 */
projectCostingRouter.get(
  '/cost-ledger',
  requirePermission('project:cost_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ProjectProfitabilityService.getCostLedger(req.params.projectId as string);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:projectId/profitability
 * Comprehensive profitability report, margin % and budget-vs-actual variance.
 */
projectCostingRouter.get(
  '/profitability',
  requirePermission('project:cost_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ProjectProfitabilityService.getProjectProfitability(req.params.projectId as string);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:projectId/budgets
 * Version history of planned budgets for this project.
 */
projectCostingRouter.get(
  '/budgets',
  requirePermission('project:cost_read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ProjectProfitabilityService.getProjectBudgets(req.params.projectId as string);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:projectId/budgets
 * Create a new budget baseline or next version revision.
 */
projectCostingRouter.post(
  '/budgets',
  requirePermission('project:budget_create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createProjectBudgetSchema.safeParse({
        ...req.body,
        projectId: req.params.projectId
      });
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const budget = await ProjectProfitabilityService.createBudget(
        req.params.projectId as string,
        parseResult.data,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: req.headers['x-correlation-id'] as string
        }
      );

      return sendSuccess(req, res, budget, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:projectId/budgets/:budgetId/approve
 * Manager approval for budget version (supersedes previous approved version).
 */
projectCostingRouter.post(
  '/budgets/:budgetId/approve',
  requirePermission('project:budget_approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = approveProjectBudgetSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const budget = await ProjectProfitabilityService.approveBudget(
        req.params.projectId as string,
        req.params.budgetId as string,
        parseResult.data,
        {
          userId: req.session.user?.userId,
          role: req.session.user?.role,
          department: req.session.user?.department,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: req.headers['x-correlation-id'] as string
        }
      );

      return sendSuccess(req, res, budget);
    } catch (err) {
      return next(err);
    }
  }
);
