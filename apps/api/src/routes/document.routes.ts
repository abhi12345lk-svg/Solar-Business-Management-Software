import { Router, Request, Response, NextFunction } from 'express';
import {
  uploadDocumentMetadataSchema,
  reviewDocumentSchema,
  createDocumentVersionSchema,
  documentFilterSchema
} from '@ins-solar/shared';
import { DocumentService } from '../services/documentService.js';
import { requireAuth, requireEmployee, requirePermission } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const documentRouter = Router();

// Notice: download route uses HMAC token for authorization, so it shouldn't strictly require session cookie if accessed via direct browser download link with valid signature
/**
 * GET /api/v1/documents/:id/download
 * Secure download endpoint verifying short-lived cryptographic HMAC signature.
 */
documentRouter.get(
  '/:id/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = req.params.id as string;
      const { token, expires } = req.query;

      if (!token || !expires) {
        return next(
          AppError.forbidden('Missing required signed authorization token or expiry timestamp.')
        );
      }

      const expiresNum = parseInt(expires as string, 10);
      if (isNaN(expiresNum)) {
        return next(AppError.validation('Invalid expiry timestamp.'));
      }

      const doc = await DocumentService.verifySignedDownloadToken(
        documentId,
        token as string,
        expiresNum
      );

      // Set download headers
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`
      );
      res.setHeader('X-Document-Vault-Number', doc.documentNumber);
      res.setHeader('X-Document-Storage-Status', doc.storageStatus);

      // Since actual object storage is configured as SIMULATED_STORAGE_ONLY or local, stream safe metadata payload or buffer
      const content = Buffer.from(
        `%INS-SOLAR-SECURE-VAULT-CONTENT%\nDocument-Number: ${doc.documentNumber}\nOriginal-Filename: ${doc.originalFilename}\nStorage-Key: ${doc.storageKey}\nStorage-Status: ${doc.storageStatus}\nMIME: ${doc.mimeType}\nSize: ${doc.fileSizeBytes} bytes\nVersion: ${doc.version}\n`
      );

      return res.status(200).send(content);
    } catch (err) {
      return next(err);
    }
  }
);

// All subsequent routes require staff session and employee status
documentRouter.use(requireAuth);
documentRouter.use(requireEmployee);

/**
 * GET /api/v1/documents
 * List documents with category, reviewStatus, entity, and classification filters.
 */
documentRouter.get(
  '/',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = documentFilterSchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(AppError.validation(parseResult.error));
      }

      const user = req.session.user!;
      const result = await DocumentService.listDocuments(parseResult.data, {
        userId: user.userId,
        role: user.role
      });

      return sendSuccess(req, res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents
 * Register and upload document metadata into private vault.
 */
documentRouter.post(
  '/',
  requirePermission('document:upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = uploadDocumentMetadataSchema.safeParse(req.body);
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

      const doc = await DocumentService.registerDocument(parseResult.data, actorContext);
      return sendSuccess(req, res, doc, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/documents/:id
 * Get single document metadata.
 */
documentRouter.get(
  '/:id',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const doc = await DocumentService.getDocumentById(req.params.id as string, {
        userId: user.userId,
        role: user.role
      });
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/documents/:id/access-url
 * Generate short-lived signed access URL for downloading document.
 */
documentRouter.get(
  '/:id/access-url',
  requirePermission('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.session.user!;
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 900;
      const urlInfo = await DocumentService.generateSignedAccessUrl(
        req.params.id as string,
        { userId: user.userId, role: user.role },
        expiresIn
      );
      return sendSuccess(req, res, urlInfo);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents/:id/review
 * Review document (Accept, Reject, Resubmission Required).
 */
documentRouter.post(
  '/:id/review',
  requirePermission('document:review'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = reviewDocumentSchema.safeParse(req.body);
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

      const doc = await DocumentService.reviewDocument(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/documents/:id/new-version
 * Upload a new version for an existing document.
 */
documentRouter.post(
  '/:id/new-version',
  requirePermission('document:upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = createDocumentVersionSchema.safeParse(req.body);
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

      const newVersion = await DocumentService.createDocumentVersion(
        req.params.id as string,
        parseResult.data,
        actorContext
      );
      return sendSuccess(req, res, newVersion, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/documents/:id/archive
 * Archive document.
 */
documentRouter.patch(
  '/:id/archive',
  requirePermission('document:archive'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body || {};
      const user = req.session.user!;
      const actorContext = {
        actorId: user.userId,
        actorType: 'EMPLOYEE' as const,
        role: user.role,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        correlationId: (req as any).correlationId
      };

      const doc = await DocumentService.archiveDocument(
        req.params.id as string,
        reason,
        actorContext
      );
      return sendSuccess(req, res, doc);
    } catch (err) {
      return next(err);
    }
  }
);
