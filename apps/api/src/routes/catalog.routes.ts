import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateProductCategoryInputSchema,
  UpdateProductCategoryInputSchema,
  CreateProductInputSchema,
  UpdateProductInputSchema,
  ProductFilterSchema
} from '@ins-solar/shared';
import { CatalogService } from '../services/catalogService.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';

export const catalogRouter = Router();

// ===========================================================================
// Product Category Routes
// ===========================================================================

catalogRouter.get(
  '/categories',
  requireAuth,
  requirePermission('catalog:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
      const categories = await CatalogService.listCategories({ isActive, parentId });
      sendSuccess(req, res, categories);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/categories',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateProductCategoryInputSchema.parse(req.body);
      const category = await CatalogService.createCategory(input, req.session?.user?.userId);
      sendSuccess(req, res, category, 201);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/categories/:id',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateProductCategoryInputSchema.parse(req.body);
      const category = await CatalogService.updateCategory(
        req.params.id as string,
        input,
        req.session?.user?.userId
      );
      sendSuccess(req, res, category);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/categories/:id/deactivate',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await CatalogService.deactivateCategory(
        req.params.id as string,
        req.session?.user?.userId
      );
      sendSuccess(req, res, category);
    } catch (err) {
      next(err);
    }
  }
);

// ===========================================================================
// Product Catalog Routes
// ===========================================================================

catalogRouter.get(
  '/products',
  requireAuth,
  requirePermission('catalog:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = ProductFilterSchema.parse(req.query);
      const result = await CatalogService.listProducts(filter);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.get(
  '/products/:id',
  requireAuth,
  requirePermission('catalog:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await CatalogService.getProductById(req.params.id as string);
      sendSuccess(req, res, product);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/products',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateProductInputSchema.parse(req.body);
      const product = await CatalogService.createProduct(input, req.session?.user?.userId);
      sendSuccess(req, res, product, 201);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.put(
  '/products/:id',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateProductInputSchema.parse(req.body);
      const product = await CatalogService.updateProduct(
        req.params.id as string,
        input,
        req.session?.user?.userId
      );
      sendSuccess(req, res, product);
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/products/:id/deactivate',
  requireAuth,
  requireEmployee,
  requirePermission('catalog:deactivate'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await CatalogService.deactivateProduct(
        req.params.id as string,
        req.session?.user?.userId
      );
      sendSuccess(req, res, product);
    } catch (err) {
      next(err);
    }
  }
);
