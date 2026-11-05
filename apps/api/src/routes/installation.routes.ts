/**
 * INS Solar Business Management Software — Installation & Installer Panel Routes
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import {
  createInstallationSchema,
  updateInstallationSchema,
  reviewInstallationSchema,
  assignInstallationSchema,
  installationFilterSchema,
  SitePhotoCategory,
  TechnicalManualCategory
} from '@ins-solar/shared';
import { InstallationService } from '../services/installationService.js';
import { User } from '../models/User.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';
import { getStorageAdapter } from '../services/storage/index.js';

export const installationRouter = Router();

// 1. Download/view raw photo or manual stream (Can be loaded in <img> or <iframe>)
installationRouter.get(
  '/:id/photos/:storageKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storageKey = decodeURIComponent(req.params.storageKey as string);
      const storageAdapter = getStorageAdapter();
      const exists = await storageAdapter.objectExists(storageKey);
      if (!exists) {
        return next(AppError.notFound('Photograph not found in storage.'));
      }
      const obj = await storageAdapter.downloadObject(storageKey);
      res.setHeader('Content-Type', obj.contentType || 'image/jpeg');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return obj.stream.pipe(res);
    } catch (err) {
      return next(err);
    }
  }
);

installationRouter.get(
  '/:id/manuals/:storageKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storageKey = decodeURIComponent(req.params.storageKey as string);
      const storageAdapter = getStorageAdapter();
      const exists = await storageAdapter.objectExists(storageKey);
      if (!exists) {
        return next(AppError.notFound('Technical manual not found in storage.'));
      }
      const obj = await storageAdapter.downloadObject(storageKey);
      res.setHeader('Content-Type', obj.contentType || 'application/pdf');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return obj.stream.pipe(res);
    } catch (err) {
      return next(err);
    }
  }
);

// All subsequent operations require authenticated employee session
installationRouter.use(requireAuth);
installationRouter.use(requireEmployee);

/**
 * GET /api/v1/installations/dashboard-stats
 * Returns summary count cards for installer / admin dashboard.
 */
installationRouter.get(
  '/dashboard-stats',
  requirePermission('installation:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const stats = await InstallationService.getDashboardStats({
        actorId: user.userId,
        actorType: 'EMPLOYEE',
        role: user.role
      });
      return sendSuccess(req, res, stats);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/installations/installers/list
 * Returns available field installers for assignment dropdown.
 */
installationRouter.get(
  '/installers/list',
  requirePermission('installation:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await User.find(
        { isActive: true },
        '_id firstName lastName email role employeeCode'
      ).sort({ firstName: 1 });

      const installers = users.map(u => ({
        id: u._id.toString(),
        name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email,
        email: u.email,
        role: u.role,
        employeeCode: u.employeeCode
      }));

      return sendSuccess(req, res, installers);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/installations
 * List installations with search, status filters, and pagination.
 */
installationRouter.get(
  '/',
  requirePermission('installation:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = installationFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const result = await InstallationService.listInstallations(parseResult.data, {
        actorId: user.userId,
        actorType: 'EMPLOYEE',
        role: user.role
      });
      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/installations/:id
 * Get single installation details.
 */
installationRouter.get(
  '/:id',
  requirePermission('installation:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const inst = await InstallationService.getInstallationById(req.params.id as string, {
        actorId: user.userId,
        actorType: 'EMPLOYEE',
        role: user.role
      });
      return sendSuccess(req, res, inst);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations
 * Create new installation record or draft.
 */
installationRouter.post(
  '/',
  requirePermission('installation:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createInstallationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const inst = await InstallationService.createInstallation(parseResult.data, actorContext);
      return sendSuccess(req, res, inst, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/installations/:id
 * Update installation details, equipment, panels, photos, or GPS location.
 */
installationRouter.patch(
  '/:id',
  requirePermission('installation:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateInstallationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const updated = await InstallationService.updateInstallation(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, updated);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations/:id/submit
 * Submit completed installation report for admin QA approval.
 */
installationRouter.post(
  '/:id/submit',
  requirePermission('installation:submit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const submitted = await InstallationService.submitInstallation(
        req.params.id as string,
        req.body?.notes,
        actorContext
      );
      return sendSuccess(req, res, submitted);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations/:id/review
 * Admin approve or reject installation report.
 */
installationRouter.post(
  '/:id/review',
  requirePermission('installation:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reviewInstallationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const reviewed = await InstallationService.reviewInstallation(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, reviewed);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations/:id/assign
 * Admin assign installation to installer.
 */
installationRouter.post(
  '/:id/assign',
  requirePermission('installation:assign'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = assignInstallationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const assigned = await InstallationService.assignInstallation(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, assigned);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations/:id/photos
 * Stream/upload photo binary for a category.
 */
installationRouter.post(
  '/:id/photos',
  express.raw({ type: '*/*', limit: '25mb' }),
  requirePermission('installation:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = req.body as Buffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return next(AppError.validation('Binary payload is required for photo upload.'));
      }

      const category = (req.query.category as string) || SitePhotoCategory.SITE_OVERVIEW;
      const originalFilename =
        (req.query.filename as string) || `installation_photo_${Date.now()}.jpg`;
      const mimeType = (req.query.mimeType as string) || 'image/jpeg';
      const title = (req.query.title as string) || category.replace(/_/g, ' ');
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const photo = await InstallationService.uploadSitePhoto(
        req.params.id as string,
        buffer,
        {
          category: category as SitePhotoCategory,
          title,
          originalFilename,
          mimeType,
          gpsLocation: lat && lng ? { latitude: lat, longitude: lng } : undefined
        },
        actorContext
      );

      return sendSuccess(req, res, photo, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/installations/:id/manuals
 * Upload technical manual binary.
 */
installationRouter.post(
  '/:id/manuals',
  express.raw({ type: '*/*', limit: '30mb' }),
  requirePermission('installation:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = req.body as Buffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return next(AppError.validation('Binary payload is required for manual upload.'));
      }

      const category = (req.query.category as string) || TechnicalManualCategory.OTHER;
      const originalFilename =
        (req.query.filename as string) || `technical_manual_${Date.now()}.pdf`;
      const mimeType = (req.query.mimeType as string) || 'application/pdf';
      const title = (req.query.title as string) || originalFilename;

      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const manual = await InstallationService.uploadManual(
        req.params.id as string,
        buffer,
        {
          category: category as TechnicalManualCategory,
          title,
          originalFilename,
          mimeType
        },
        actorContext
      );

      return sendSuccess(req, res, manual, 201);
    } catch (err) {
      return next(err);
    }
  }
);
