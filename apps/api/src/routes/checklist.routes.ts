/**
 * INS Solar Business Management Software — Installation Checklist Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  generateProjectChecklistSchema,
  updateChecklistItemStatusSchema,
  uploadEvidenceMetadataSchema
} from '@ins-solar/shared';
import { ChecklistService } from '../services/checklistService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const checklistTemplateRouter = Router();

checklistTemplateRouter.use(requireAuth);
checklistTemplateRouter.use(requireEmployee);

/**
 * GET /api/v1/checklists/templates
 * Retrieve available standardized checklist inspection templates.
 */
checklistTemplateRouter.get(
  '/templates',
  requirePermission('checklist:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await ChecklistService.getOrCreateDefaultTemplate();
      return sendSuccess(req, res, [template]);
    } catch (err) {
      return next(err);
    }
  }
);

export const projectChecklistRouter = Router();

projectChecklistRouter.use(requireAuth);
projectChecklistRouter.use(requireEmployee);

/**
 * GET /api/v1/projects/:id/checklist
 * Retrieve the active installation checklist for a project.
 */
projectChecklistRouter.get(
  '/:id/checklist',
  requirePermission('checklist:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checklist = await ChecklistService.getProjectChecklist(req.params.id as string);
      return sendSuccess(req, res, checklist);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/checklist/generate
 * Force generation or snapshot initialization of project checklist.
 */
projectChecklistRouter.post(
  '/:id/checklist/generate',
  requirePermission('checklist:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = generateProjectChecklistSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const checklist = await ChecklistService.generateProjectChecklist(
        req.params.id as string,
        parseResult.data.templateCode,
        user,
        context
      );
      return sendSuccess(req, res, checklist, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PUT /api/v1/projects/:id/checklist/items/:itemId
 * Update status of a checklist item (PASSED, FAILED, BLOCKED, etc.).
 */
projectChecklistRouter.put(
  '/:id/checklist/items/:itemId',
  requirePermission('checklist:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateChecklistItemStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const checklist = await ChecklistService.updateItemStatus(
        req.params.id as string,
        req.params.itemId as string,
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, checklist);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/projects/:id/checklist/items/:itemId/evidence
 * Attach photo evidence metadata to a checklist item.
 */
projectChecklistRouter.post(
  '/:id/checklist/items/:itemId/evidence',
  requirePermission('evidence:upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = uploadEvidenceMetadataSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const fileName = (req.body.fileName as string) || `evidence-${Date.now()}.jpg`;
      const mimeType = (req.body.mimeType as string) || 'image/jpeg';
      const fileSizeBytes = Number(req.body.fileSizeBytes) || 1024 * 500; // 500KB fallback default

      const user = req.session.user!;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const evidence = await ChecklistService.attachEvidence(
        req.params.id as string,
        req.params.itemId as string,
        { fileName, mimeType, fileSizeBytes },
        parseResult.data,
        user,
        context
      );
      return sendSuccess(req, res, evidence, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/projects/:id/checklist/evidence/:evidenceId
 * Get authorized access link for private evidence file.
 */
projectChecklistRouter.get(
  '/:id/checklist/evidence/:evidenceId',
  requirePermission('evidence:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const access = await ChecklistService.getAuthorizedEvidenceAccess(
        req.params.id as string,
        req.params.evidenceId as string,
        { userId: user.userId }
      );
      return sendSuccess(req, res, access);
    } catch (err) {
      return next(err);
    }
  }
);

// Backward compatibility export
export const checklistRouter = projectChecklistRouter;
