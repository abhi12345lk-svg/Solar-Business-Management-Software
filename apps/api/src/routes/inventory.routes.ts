/**
 * INS Solar Business Management Software — Inventory & Stock Routes
 *
 * Provides versioned REST endpoints mounted at /api/v1/inventory:
 * - GET /balances: query location-scoped stock projections
 * - GET /movements: query append-only material transaction ledger
 * - POST /receipt: record material stock receipt (GRN)
 * - POST /issue: record physical stock issue against reservation
 * - POST /transfer: execute inter-warehouse transfer
 * - POST /return: record material return
 * - POST /opening-balance: record authorized opening balance
 * - POST /serials: register serialized hardware assets
 * - GET /serials: list serialized assets
 * - GET /serials/:serialNumber: get lifecycle history for serial number
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  StockBalanceFilterSchema,
  StockMovementFilterSchema,
  StockReceiptInputSchema,
  StockIssueInputSchema,
  StockTransferInputSchema,
  StockReturnInputSchema,
  OpeningBalanceInputSchema,
  RegisterSerialNumberInputSchema
} from '@ins-solar/shared';
import { StockService } from '../services/stockService.js';
import { SerialNumberService } from '../services/serialNumberService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const inventoryRouter = Router();

// Internal employee routes require authentication
inventoryRouter.use(requireAuth);
inventoryRouter.use(requireEmployee);

/**
 * GET /api/v1/inventory/balances
 * List stock balances by warehouse and product.
 */
inventoryRouter.get(
  '/balances',
  requirePermission('inv:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockBalanceFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await StockService.listStockBalances(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/inventory/movements
 * List stock movement ledger entries.
 */
inventoryRouter.get(
  '/movements',
  requirePermission('inv:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockMovementFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await StockService.listStockMovements(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/receipt
 * Record stock receipt into warehouse.
 */
inventoryRouter.post(
  '/receipt',
  requirePermission('inv:receive'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockReceiptInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const movement = await StockService.receiveStock(parseResult.data, user, context);
      return sendSuccess(req, res, movement, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/issue
 * Record physical stock issue against reservation.
 */
inventoryRouter.post(
  '/issue',
  requirePermission('inv:issue'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockIssueInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const movement = await StockService.issueStock(parseResult.data, user, context);
      return sendSuccess(req, res, movement, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/transfer
 * Execute inter-warehouse material transfer.
 */
inventoryRouter.post(
  '/transfer',
  requirePermission('inv:transfer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockTransferInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const movement = await StockService.transferStock(parseResult.data, user, context);
      return sendSuccess(req, res, movement, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/return
 * Record material return.
 */
inventoryRouter.post(
  '/return',
  requirePermission('inv:return'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = StockReturnInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const movement = await StockService.returnStock(parseResult.data, user, context);
      return sendSuccess(req, res, movement, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/opening-balance
 * Record authorized opening stock balance.
 */
inventoryRouter.post(
  '/opening-balance',
  requirePermission('inv:adjust'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = OpeningBalanceInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const movement = await StockService.recordOpeningBalance(parseResult.data, user, context);
      return sendSuccess(req, res, movement, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/inventory/serials
 * Register batch of serialized items.
 */
inventoryRouter.post(
  '/serials',
  requirePermission('inv:receive'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = RegisterSerialNumberInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const actor = {
        userId: req.session.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const serials = await SerialNumberService.registerSerialNumbers(parseResult.data, actor);
      return sendSuccess(req, res, serials, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/inventory/serials
 * List serialized items with filters.
 */
inventoryRouter.get(
  '/serials',
  requirePermission('inv:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await SerialNumberService.listSerialNumbers({
        productId: req.query.productId as string,
        warehouseId: req.query.warehouseId as string,
        status: req.query.status as any,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
      });
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/inventory/serials/:serialNumber
 * Query lifecycle history for a serial number.
 */
inventoryRouter.get(
  '/serials/:serialNumber',
  requirePermission('inv:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await SerialNumberService.getSerialHistory(req.params.serialNumber as string);
      return sendSuccess(req, res, history);
    } catch (err) {
      return next(err);
    }
  }
);
