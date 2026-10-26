import { Router, Request, Response, NextFunction } from 'express';
import { createGoodsReceiptSchema, grnFilterSchema } from '@ins-solar/shared';
import { GoodsReceiptService } from '../services/goodsReceiptService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const goodsReceiptRouter = Router();

goodsReceiptRouter.use(requireAuth);
goodsReceiptRouter.use(requireEmployee);

/**
 * POST /api/v1/goods-receipts
 * Record goods receipt note against an approved purchase order.
 */
goodsReceiptRouter.post(
  '/',
  requirePermission('grn:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createGoodsReceiptSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const grn = await GoodsReceiptService.createGoodsReceipt(parseResult.data, user, context);
      return sendSuccess(req, res, grn, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/goods-receipts
 * List Goods Receipt Notes with filtering and pagination.
 */
goodsReceiptRouter.get(
  '/',
  requirePermission('grn:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = grnFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const result = await GoodsReceiptService.getGoodsReceipts(parseResult.data);
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/goods-receipts/:id
 * Get Goods Receipt details by ID.
 */
goodsReceiptRouter.get(
  '/:id',
  requirePermission('grn:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const grn = await GoodsReceiptService.getGoodsReceiptById(req.params.id as string);
      return sendSuccess(req, res, grn);
    } catch (err) {
      return next(err);
    }
  }
);
