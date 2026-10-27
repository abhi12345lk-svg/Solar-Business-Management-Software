/**
 * INS Solar Business Management Software — Expense Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createExpenseSchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  payExpenseSchema,
  cancelExpenseSchema,
  expenseFilterSchema
} from '@ins-solar/shared';
import { ExpenseService } from '../services/expenseService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const expenseRouter = Router();

expenseRouter.use(requireAuth);
expenseRouter.use(requireEmployee);

/**
 * GET /api/v1/expenses
 * List expenses with pagination and multi-criteria filters.
 */
expenseRouter.get(
  '/',
  requirePermission('expense:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = expenseFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await ExpenseService.getExpenses(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/expenses
 * Record a new operational or project expense.
 */
expenseRouter.post(
  '/',
  requirePermission('expense:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createExpenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const expense = await ExpenseService.createExpense(parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.headers['x-correlation-id'] as string
      });

      return sendSuccess(req, res, expense, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/expenses/:id
 * Retrieve single expense details with full populated references.
 */
expenseRouter.get(
  '/:id',
  requirePermission('expense:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await ExpenseService.getExpenseById(req.params.id as string);
      return sendSuccess(req, res, expense);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/expenses/:id/approve
 * Manager approval for pending expense (anti-self-approval enforced).
 */
expenseRouter.post(
  '/:id/approve',
  requirePermission('expense:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = approveExpenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const expense = await ExpenseService.approveExpense(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.headers['x-correlation-id'] as string
      });

      return sendSuccess(req, res, expense);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/expenses/:id/reject
 * Reject a pending expense with reason.
 */
expenseRouter.post(
  '/:id/reject',
  requirePermission('expense:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = rejectExpenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const expense = await ExpenseService.rejectExpense(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.headers['x-correlation-id'] as string
      });

      return sendSuccess(req, res, expense);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/expenses/:id/pay
 * Record disbursement against an approved expense.
 */
expenseRouter.post(
  '/:id/pay',
  requirePermission('expense:pay'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = payExpenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const expense = await ExpenseService.recordPayment(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.headers['x-correlation-id'] as string
      });

      return sendSuccess(req, res, expense);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/expenses/:id/cancel
 * Cancel an unpaid expense with documented reason.
 */
expenseRouter.post(
  '/:id/cancel',
  requirePermission('expense:cancel'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = cancelExpenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const expense = await ExpenseService.cancelExpense(req.params.id as string, parseResult.data, {
        userId: req.session.user?.userId,
        role: req.session.user?.role,
        department: req.session.user?.department,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.headers['x-correlation-id'] as string
      });

      return sendSuccess(req, res, expense);
    } catch (err) {
      return next(err);
    }
  }
);
