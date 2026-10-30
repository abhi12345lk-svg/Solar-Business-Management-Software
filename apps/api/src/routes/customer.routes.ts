import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Lead } from '../models/Lead.js';
import { SequenceService } from '../services/sequenceService.js';
import { SequenceEntityType, CustomerStatus, CustomerType } from '@ins-solar/shared';
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

    // Format items with consistent id and legalName fallback
    const formattedItems = items.map(c => ({
      ...c,
      id: c._id.toString(),
      legalName: c.companyName || c.name
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
