import { Router, Request, Response, NextFunction } from 'express';
import { Project } from '../models/Project.js';
import { ProjectService } from '../services/projectService.js';
import { requireAuth } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerProjectRouter = Router();

// Customer portal authentication middleware
customerProjectRouter.use(requireAuth);
customerProjectRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.session?.customer?.customerId) {
    return next(
      AppError.permissionDenied('Customer portal session required to access this resource.')
    );
  }
  next();
});

/**
 * GET /api/v1/customer-portal/projects
 * List projects belonging strictly to the logged-in customer.
 */
customerProjectRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;

    const projects = await Project.find({ customerId })
      .select('projectCode name status currentStage systemCapacityKwp systemTopology plannedStartDate targetCompletionDate createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(req, res, { items: projects, total: projects.length });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customer-portal/projects/:id
 * Retrieve a specific project belonging to the logged-in customer.
 */
customerProjectRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.session.customer!.customerId;
    const project = await ProjectService.getProjectById(req.params.id as string, customerId);
    return sendSuccess(req, res, project);
  } catch (err) {
    return next(err);
  }
});
