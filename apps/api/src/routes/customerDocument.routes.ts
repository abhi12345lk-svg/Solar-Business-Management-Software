import { Router, Request, Response, NextFunction } from 'express';
import { documentFilterSchema } from '@ins-solar/shared';
import { DocumentService } from '../services/documentService.js';
import { requireAuth, requireCustomer } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerDocumentRouter = Router();

customerDocumentRouter.use(requireAuth);
customerDocumentRouter.use(requireCustomer);

/**
 * GET /api/v1/customer-portal/documents
 * List customer-visible documents strictly belonging to the authenticated customer.
 */
customerDocumentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = req.session.customer!;
    const parseResult = documentFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      return next(AppError.validation(parseResult.error));
    }

    const result = await DocumentService.listDocuments(parseResult.data, {
      customerId: customer.customerId
    });

    return sendSuccess(req, res, result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/documents/:id
 * Get single customer-visible document by ID.
 */
customerDocumentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = req.session.customer!;
    const doc = await DocumentService.getDocumentById(req.params.id as string, {
      customerId: customer.customerId
    });
    return sendSuccess(req, res, doc);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/documents/:id/access-url
 * Generate short-lived signed access URL for the customer to download their file.
 */
customerDocumentRouter.get(
  '/:id/access-url',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = req.session.customer!;
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 900;
      const urlInfo = await DocumentService.generateSignedAccessUrl(
        req.params.id as string,
        { customerId: customer.customerId },
        expiresIn
      );
      return sendSuccess(req, res, urlInfo);
    } catch (err) {
      return next(err);
    }
  }
);
