import { Types } from 'mongoose';
import {
  CreateVendorInput,
  UpdateVendorInput,
  VendorFilter,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { Vendor, IVendorDocument } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { ProductCategory } from '../models/ProductCategory.js';
import { Product } from '../models/Product.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class VendorService {
  /**
   * Create a new Vendor with sequential identifier (VEN-YYYY-NNNNN).
   */
  public static async createVendor(
    input: CreateVendorInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IVendorDocument> {
    // Check if an active vendor with exact same name already exists
    const existingName = await Vendor.findOne({
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
      isActive: true
    });
    if (existingName) {
      throw AppError.duplicateResource(`An active vendor named '${input.name}' already exists.`);
    }

    // Check GSTIN uniqueness if provided
    if (input.gstin && input.gstin.trim()) {
      const existingGstin = await Vendor.findOne({ gstin: input.gstin.trim().toUpperCase() });
      if (existingGstin) {
        throw AppError.duplicateResource(
          `A vendor with GSTIN '${input.gstin.toUpperCase()}' already exists.`
        );
      }
    }

    // Validate categories if provided
    if (input.suppliedCategoryIds && input.suppliedCategoryIds.length > 0) {
      const count = await ProductCategory.countDocuments({
        _id: { $in: input.suppliedCategoryIds.map(id => new Types.ObjectId(id)) }
      });
      if (count !== input.suppliedCategoryIds.length) {
        throw AppError.validation('One or more supplied category IDs are invalid.');
      }
    }

    // Validate products if provided
    if (input.suppliedProductIds && input.suppliedProductIds.length > 0) {
      const count = await Product.countDocuments({
        _id: { $in: input.suppliedProductIds.map(id => new Types.ObjectId(id)) }
      });
      if (count !== input.suppliedProductIds.length) {
        throw AppError.validation('One or more supplied product IDs are invalid.');
      }
    }

    const seq = await SequenceService.generateNumber(SequenceEntityType.VENDOR);

    const vendor = new Vendor({
      vendorCode: seq.formattedNumber,
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim(),
      email: input.email?.trim().toLowerCase() || undefined,
      phone: input.phone?.trim() || undefined,
      address: input.address,
      gstin: input.gstin?.trim().toUpperCase() || undefined,
      pan: input.pan?.trim().toUpperCase() || undefined,
      suppliedCategoryIds: input.suppliedCategoryIds?.map(id => new Types.ObjectId(id)) || [],
      suppliedProductIds: input.suppliedProductIds?.map(id => new Types.ObjectId(id)) || [],
      paymentTermsDays: input.paymentTermsDays ?? 30,
      bankDetails: input.bankDetails,
      leadTimeDays: input.leadTimeDays,
      notes: input.notes?.trim(),
      isActive: true,
      hasPurchaseHistory: false,
      createdBy: new Types.ObjectId(user.userId)
    });

    await vendor.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vendor-create',
      details: {
        vendorCode: vendor.vendorCode,
        vendorName: vendor.name,
        gstin: vendor.gstin
      }
    });

    return vendor;
  }

  /**
   * List vendors with search, category filtering, and pagination.
   */
  public static async getVendors(filter: VendorFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { vendorCode: { $regex: s, $options: 'i' } },
        { contactPerson: { $regex: s, $options: 'i' } },
        { gstin: { $regex: s, $options: 'i' } }
      ];
    }

    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }

    if (filter.categoryId) {
      query.suppliedCategoryIds = new Types.ObjectId(filter.categoryId);
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      Vendor.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('suppliedCategoryIds', 'name code')
        .populate('suppliedProductIds', 'sku name category'),
      Vendor.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get vendor by ID.
   */
  public static async getVendorById(id: string): Promise<IVendorDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Vendor ID.');
    }
    const vendor = await Vendor.findById(id)
      .populate('suppliedCategoryIds', 'name code')
      .populate('suppliedProductIds', 'sku name category');
    if (!vendor) {
      throw AppError.notFound('Vendor not found.');
    }
    return vendor;
  }

  /**
   * Update vendor details.
   */
  public static async updateVendor(
    id: string,
    input: UpdateVendorInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IVendorDocument> {
    const vendor = await this.getVendorById(id);

    if (input.name && input.name.trim() !== vendor.name) {
      const existing = await Vendor.findOne({
        _id: { $ne: vendor._id },
        name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
        isActive: true
      });
      if (existing) {
        throw AppError.duplicateResource(`An active vendor named '${input.name}' already exists.`);
      }
      vendor.name = input.name.trim();
    }

    if (input.gstin && input.gstin.trim() !== vendor.gstin) {
      const existingGstin = await Vendor.findOne({
        _id: { $ne: vendor._id },
        gstin: input.gstin.trim().toUpperCase()
      });
      if (existingGstin) {
        throw AppError.duplicateResource(
          `A vendor with GSTIN '${input.gstin.toUpperCase()}' already exists.`
        );
      }
      vendor.gstin = input.gstin.trim().toUpperCase();
    }

    if (input.contactPerson !== undefined) vendor.contactPerson = input.contactPerson.trim();
    if (input.email !== undefined) vendor.email = input.email.trim().toLowerCase() || undefined;
    if (input.phone !== undefined) vendor.phone = input.phone.trim() || undefined;
    if (input.address) {
      vendor.address = {
        addressLine1: input.address.addressLine1 || vendor.address?.addressLine1 || '',
        addressLine2: input.address.addressLine2 ?? vendor.address?.addressLine2,
        city: input.address.city || vendor.address?.city || '',
        state: input.address.state || vendor.address?.state || '',
        postalCode: input.address.postalCode || vendor.address?.postalCode || '',
        country: input.address.country || vendor.address?.country || 'India'
      };
    }
    if (input.pan !== undefined) vendor.pan = input.pan.trim().toUpperCase() || undefined;
    if (input.paymentTermsDays !== undefined) vendor.paymentTermsDays = input.paymentTermsDays;
    if (input.bankDetails) vendor.bankDetails = input.bankDetails;
    if (input.leadTimeDays !== undefined) vendor.leadTimeDays = input.leadTimeDays;
    if (input.notes !== undefined) vendor.notes = input.notes.trim();
    if (input.isActive !== undefined) vendor.isActive = input.isActive;

    if (input.suppliedCategoryIds) {
      vendor.suppliedCategoryIds = input.suppliedCategoryIds.map(cid => new Types.ObjectId(cid));
    }
    if (input.suppliedProductIds) {
      vendor.suppliedProductIds = input.suppliedProductIds.map(pid => new Types.ObjectId(pid));
    }

    vendor.updatedBy = new Types.ObjectId(user.userId);
    await vendor.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vendor-update',
      details: {
        vendorCode: vendor.vendorCode,
        vendorName: vendor.name,
        isActive: vendor.isActive
      }
    });

    return vendor;
  }

  /**
   * Deactivate vendor (preserves historical purchase records).
   */
  public static async deactivateVendor(
    id: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IVendorDocument> {
    const vendor = await this.getVendorById(id);
    vendor.isActive = false;
    vendor.updatedBy = new Types.ObjectId(user.userId);
    await vendor.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_DEACTIVATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vendor-deactivate',
      details: {
        vendorCode: vendor.vendorCode,
        vendorName: vendor.name
      }
    });

    return vendor;
  }

  /**
   * Delete vendor. Blocked if vendor has existing Purchase Orders.
   */
  public static async deleteVendor(id: string): Promise<void> {
    const vendor = await this.getVendorById(id);
    const hasPOs = await PurchaseOrder.exists({ vendorId: vendor._id });
    if (hasPOs) {
      throw AppError.businessRule(
        'Cannot delete vendor with historical purchase orders. Please deactivate the vendor instead.'
      );
    }
    await Vendor.findByIdAndDelete(vendor._id);
  }
}
