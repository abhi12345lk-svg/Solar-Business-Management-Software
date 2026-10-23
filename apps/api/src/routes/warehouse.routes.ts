import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateWarehouseInputSchema,
  UpdateWarehouseInputSchema,
  WarehouseFilterSchema
} from '@ins-solar/shared';
import { WarehouseService } from '../services/warehouseService.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';

export const warehouseRouter = Router();

warehouseRouter.get(
  '/',
  requireAuth,
  requirePermission('warehouse:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = WarehouseFilterSchema.parse(req.query);
      const result = await WarehouseService.listWarehouses(filter);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }
);

warehouseRouter.get(
  '/:id',
  requireAuth,
  requirePermission('warehouse:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const warehouse = await WarehouseService.getWarehouseById(req.params.id as string);
      sendSuccess(req, res, warehouse);
    } catch (err) {
      next(err);
    }
  }
);

warehouseRouter.post(
  '/',
  requireAuth,
  requireEmployee,
  requirePermission('warehouse:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateWarehouseInputSchema.parse(req.body);
      const warehouse = await WarehouseService.createWarehouse(input, req.session?.user?.userId);
      sendSuccess(req, res, warehouse, 201);
    } catch (err) {
      next(err);
    }
  }
);

warehouseRouter.put(
  '/:id',
  requireAuth,
  requireEmployee,
  requirePermission('warehouse:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateWarehouseInputSchema.parse(req.body);
      const warehouse = await WarehouseService.updateWarehouse(
        req.params.id as string,
        input,
        req.session?.user?.userId
      );
      sendSuccess(req, res, warehouse);
    } catch (err) {
      next(err);
    }
  }
);

warehouseRouter.post(
  '/:id/deactivate',
  requireAuth,
  requireEmployee,
  requirePermission('warehouse:manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const warehouse = await WarehouseService.deactivateWarehouse(
        req.params.id as string,
        req.session?.user?.userId
      );
      sendSuccess(req, res, warehouse);
    } catch (err) {
      next(err);
    }
  }
);
