import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Lead } from '../models/Lead.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { DocumentService } from '../services/documentService.js';
import { SequenceService } from '../services/sequenceService.js';
import {
  SequenceEntityType,
  CustomerStatus,
  CustomerType,
  DocumentCategory,
  DocumentAccessClassification
} from '@ins-solar/shared';
import { requireAuth, requireEmployee } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/responseEnvelope.js';
import { AppError } from '../errors/AppError.js';

export const customerRouter = Router();

customerRouter.use(requireAuth);
customerRouter.use(requireEmployee);

/**
 * GET /api/v1/customers
 * Query registered customers with search, status filtering, and pagination.
 */
customerRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { customerCode: searchRegex },
        { name: searchRegex },
        { legalName: searchRegex },
        { companyName: searchRegex },
        { primaryPhone: searchRegex },
        { email: searchRegex }
      ];
    }

    const [items, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(query)
    ]);

    const customerIds = items.map(c => c._id);
    const docCounts = await DocumentModel.aggregate([
      { $match: { customerId: { $in: customerIds }, isArchived: false } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);
    const docCountMap = new Map(docCounts.map(d => [d._id.toString(), d.count]));

    // Format items with consistent id, legalName fallback, and live documentCount
    const formattedItems = items.map(c => ({
      ...c,
      id: c._id.toString(),
      legalName: c.companyName || c.name,
      documentCount: docCountMap.get(c._id.toString()) || 0
    }));

    const totalPages = Math.ceil(total / limit) || 1;
    return sendSuccess(req, res, formattedItems, 200, {
      page,
      limit,
      totalRecords: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customers/:id
 * Retrieve a single customer record by ObjectId or customerCode.
 */
customerRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idOrCode = String(req.params.id || '').trim();
    let customer: any = null;

    if (Types.ObjectId.isValid(idOrCode)) {
      customer = await Customer.findById(idOrCode).lean();
    }
    if (!customer) {
      customer = await Customer.findOne({ customerCode: idOrCode.toUpperCase() }).lean();
    }

    if (!customer) {
      throw AppError.notFound(`Customer '${idOrCode}' not found.`);
    }

    return sendSuccess(req, res, {
      ...customer,
      id: customer._id.toString(),
      legalName: customer.companyName || customer.name
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/customers
 * Direct customer registration from workstation.
 */
customerRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      legalName,
      companyName,
      primaryPhone,
      email,
      customerType,
      type,
      gstin,
      pan,
      billingAddress,
      installationAddress,
      notes,
      originatingLeadId
    } = req.body;

    if (!name || !name.trim()) {
      throw AppError.validationFailed('Customer name is required.');
    }
    if (!primaryPhone || !primaryPhone.trim()) {
      throw AppError.validationFailed('Customer phone number is required.');
    }

    // Generate atomic sequential code (e.g. CUST-2026-00002)
    const seq = await SequenceService.generateNumber(SequenceEntityType.CUSTOMER);
    const customerCode = seq.formattedNumber;

    const customer = await Customer.create({
      customerCode,
      name: name.trim(),
      companyName: (companyName || legalName || '').trim() || undefined,
      primaryPhone: primaryPhone.trim(),
      email: email ? email.trim() : undefined,
      type: type || customerType || CustomerType.INDIVIDUAL,
      status: CustomerStatus.ACTIVE,
      isActive: true,
      gstin: gstin ? gstin.trim() : undefined,
      pan: pan ? pan.trim() : undefined,
      billingAddress: billingAddress || {
        type: 'BILLING',
        addressLine1: name.trim(),
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'India'
      },
      installationAddress: installationAddress ||
        billingAddress || {
          type: 'SITE_INSTALLATION',
          addressLine1: name.trim(),
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302001',
          country: 'India'
        },
      notes: notes || undefined
    });

    // If an originating lead ID is supplied, link the lead
    if (originatingLeadId && Types.ObjectId.isValid(originatingLeadId)) {
      await Lead.findByIdAndUpdate(originatingLeadId, {
        convertedCustomerId: customer._id,
        status: 'CONVERTED'
      });
    }

    return sendSuccess(
      req,
      res,
      {
        ...customer.toObject(),
        id: customer._id.toString(),
        legalName: customer.companyName || customer.name
      },
      201
    );
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/customers/:id/status
 * Direct status transition for customer lifecycle stages.
 */
customerRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '').trim();
    const { status } = req.body;
    if (!status) {
      throw AppError.validationFailed('Status is required.');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validationFailed('Invalid customer ID format.');
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!customer) {
      throw AppError.notFound(`Customer '${id}' not found.`);
    }

    return sendSuccess(req, res, {
      ...customer.toObject(),
      id: customer._id.toString(),
      legalName: customer.companyName || customer.name
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/customers/:id/documents
 * Fetch all active documents attached to a specific customer's vault.
 */
customerRouter.get('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = String(req.params.id || '').trim();
    if (!Types.ObjectId.isValid(customerId)) {
      throw AppError.validationFailed('Invalid customer ID format.');
    }

    const docs = await DocumentModel.find({ customerId, isArchived: false })
      .populate('uploadedBy', 'firstName lastName email customerCode fullName')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(req, res, docs);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/customers/:id/documents
 * Directly upload or register a document into a customer's document vault.
 */
customerRouter.post('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = String(req.params.id || '').trim();
    if (!Types.ObjectId.isValid(customerId)) {
      throw AppError.validationFailed('Invalid customer ID format.');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw AppError.notFound(`Customer '${customerId}' not found.`);
    }

    const {
      originalFilename,
      safeDisplayName,
      category,
      accessClassification,
      mimeType,
      fileSizeBytes
    } = req.body;

    if (!originalFilename || !safeDisplayName) {
      throw AppError.validationFailed('Filename and display name are required.');
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

    const doc = await DocumentService.registerDocument(
      {
        originalFilename: String(originalFilename).trim(),
        safeDisplayName: String(safeDisplayName).trim(),
        category: category || DocumentCategory.CUSTOMER_KYC,
        accessClassification: accessClassification || DocumentAccessClassification.INTERNAL_ONLY,
        mimeType: mimeType || 'application/pdf',
        fileSizeBytes: Number(fileSizeBytes) || 1024,
        customerId
      },
      actorContext
    );

    return sendSuccess(req, res, doc, 201);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/v1/customers/:id/documents/:docId
 * Archive / delete a document from a customer's document vault.
 */
customerRouter.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docId = String(req.params.docId || '').trim();
    if (!Types.ObjectId.isValid(docId)) {
      throw AppError.validationFailed('Invalid document ID format.');
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

    const archived = await DocumentService.archiveDocument(
      docId,
      'Removed from customer document vault',
      actorContext
    );

    return sendSuccess(req, res, archived);
  } catch (err) {
    return next(err);
  }
});
