import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateSiteSurveyInputSchema,
  UpdateSiteSurveyInputSchema,
  UpdateSurveyStatusInputSchema,
  AttachSurveyPhotosInputSchema,
  SurveyFilterSchema
} from '@ins-solar/shared';
import { SurveyService } from '../services/surveyService.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';

export const surveyRouter = Router();

// ===========================================================================
// Site Survey Routes
// ===========================================================================

surveyRouter.get(
  '/',
  requireAuth,
  requireEmployee,
  requirePermission('survey:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = SurveyFilterSchema.parse(req.query);
      const user = req.session!.user!;
      const result = await SurveyService.listSurveys(filter, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, result.data, 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }
);

surveyRouter.post(
  '/',
  requireAuth,
  requireEmployee,
  requirePermission('survey:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateSiteSurveyInputSchema.parse(req.body);
      const user = req.session!.user!;
      const survey = await SurveyService.createSurvey(
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, survey, 201);
    } catch (err) {
      next(err);
    }
  }
);

surveyRouter.get(
  '/:id',
  requireAuth,
  requireEmployee,
  requirePermission('survey:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session!.user!;
      const survey = await SurveyService.getSurveyById(req.params.id as string, {
        userId: user.userId,
        role: user.role,
        department: user.department
      });
      sendSuccess(req, res, survey);
    } catch (err) {
      next(err);
    }
  }
);

surveyRouter.put(
  '/:id',
  requireAuth,
  requireEmployee,
  requirePermission('survey:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateSiteSurveyInputSchema.parse(req.body);
      const user = req.session!.user!;
      const survey = await SurveyService.updateSurvey(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, survey);
    } catch (err) {
      next(err);
    }
  }
);

surveyRouter.patch(
  '/:id/status',
  requireAuth,
  requireEmployee,
  requirePermission('survey:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = UpdateSurveyStatusInputSchema.parse(req.body);
      const user = req.session!.user!;
      const survey = await SurveyService.updateStatus(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, survey);
    } catch (err) {
      next(err);
    }
  }
);

surveyRouter.post(
  '/:id/photos',
  requireAuth,
  requireEmployee,
  requirePermission('survey:upload_photos'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AttachSurveyPhotosInputSchema.parse(req.body);
      const user = req.session!.user!;
      const survey = await SurveyService.attachPhotos(
        req.params.id as string,
        input,
        {
          userId: user.userId,
          role: user.role,
          department: user.department
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          correlationId: (req as any).correlationId || 'unknown'
        }
      );
      sendSuccess(req, res, survey);
    } catch (err) {
      next(err);
    }
  }
);
