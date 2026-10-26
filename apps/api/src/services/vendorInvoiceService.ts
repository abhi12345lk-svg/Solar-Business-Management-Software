import { Types } from 'mongoose';
import {
  CreateVendorInvoiceInput,
  ReconcileVendorInvoiceInput,
  VendorInvoiceFilter,
  VendorInvoiceStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { VendorInvoice, IVendorInvoiceDocument } from '../models/VendorInvoice.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class VendorInvoiceService {
  /**
   * Register a new Vendor Invoice with duplicate invoice detection per vendor.
   */
  public static async createVendorInvoice(
    input: CreateVendorInvoiceInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IVendorInvoiceDocument> {
    const vendor = await Vendor.findById(input.vendorId);
    if (!vendor) {
      throw AppError.notFound('Vendor not found.');
    }

    // Check duplicate invoice number for this vendor
    const existing = await VendorInvoice.findOne({
      vendorId: vendor._id,
      vendorInvoiceNumber: input.vendorInvoiceNumber.trim()
    });

    if (existing) {
      throw AppError.duplicateResource(
        `Invoice '${input.vendorInvoiceNumber}' for vendor '${vendor.name}' has already been registered.`
      );
    }

    let po: any = null;
    if (input.purchaseOrderId) {
      po = await PurchaseOrder.findById(input.purchaseOrderId);
      if (!po) {
        throw AppError.notFound('Associated Purchase Order not found.');
      }
    }

    // Automatic 3-Way Match Check if PO is provided
    let status = VendorInvoiceStatus.RECORDED;
    let discrepancyAmountPaise = 0;
    let reconciliationNotes = '';

    if (po) {
      // Calculate expected payable from PO
      const expectedTotalPaise = po.totalAmountPaise;
      const difference = input.totalAmountPaise - expectedTotalPaise;

      if (Math.abs(difference) > 0) {
        status = VendorInvoiceStatus.DISPUTED;
        discrepancyAmountPaise = Math.abs(difference);
        reconciliationNotes = `3-Way Match Discrepancy: Invoice amount (₹${(input.totalAmountPaise / 100).toFixed(2)}) differs from PO amount (₹${(expectedTotalPaise / 100).toFixed(2)}) by ₹${(discrepancyAmountPaise / 100).toFixed(2)}. Flagged for manual accountant review.`;
      } else {
        status = VendorInvoiceStatus.RECONCILED;
        reconciliationNotes = '3-Way Match successful: Invoice totals perfectly match approved Purchase Order commercial terms.';
      }
    }

    const invoice = new VendorInvoice({
      vendorInvoiceNumber: input.vendorInvoiceNumber.trim(),
      vendorId: vendor._id,
      purchaseOrderId: po?._id,
      goodsReceiptIds: input.goodsReceiptIds?.map(id => new Types.ObjectId(id)) || [],
      invoiceDate: new Date(input.invoiceDate),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      subtotalPaise: input.subtotalPaise,
      taxAmountPaise: input.taxAmountPaise,
      totalAmountPaise: input.totalAmountPaise,
      paidAmountPaise: 0,
      balancePayablePaise: input.totalAmountPaise,
      status,
      reconciliationNotes,
      discrepancyAmountPaise,
      documentUrl: input.documentUrl?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdBy: new Types.ObjectId(user.userId)
    });

    await invoice.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_INVOICE_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vinv-record',
      details: {
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        vendorCode: vendor.vendorCode,
        totalAmountPaise: invoice.totalAmountPaise,
        status: invoice.status
      }
    });

    return invoice;
  }

  /**
   * Reconcile or adjust reconciliation status manually.
   */
  public static async reconcileInvoice(
    id: string,
    input: ReconcileVendorInvoiceInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IVendorInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Vendor Invoice ID.');
    }
    const invoice = await VendorInvoice.findById(id);
    if (!invoice) {
      throw AppError.notFound('Vendor Invoice not found.');
    }

    invoice.status = input.status;
    if (input.reconciliationNotes !== undefined) {
      invoice.reconciliationNotes = input.reconciliationNotes.trim();
    }
    await invoice.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_INVOICE_RECONCILED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vinv-reconcile',
      details: {
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        newStatus: invoice.status,
        notes: input.reconciliationNotes
      }
    });

    return invoice;
  }

  /**
   * Query invoices with pagination and filters.
   */
  public static async getVendorInvoices(filter: VendorInvoiceFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.vendorId) {
      query.vendorId = new Types.ObjectId(filter.vendorId);
    }
    if (filter.purchaseOrderId) {
      query.purchaseOrderId = new Types.ObjectId(filter.purchaseOrderId);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.search && filter.search.trim()) {
      query.vendorInvoiceNumber = { $regex: filter.search.trim(), $options: 'i' };
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      VendorInvoice.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('vendorId', 'name vendorCode gstin phone')
        .populate('purchaseOrderId', 'poNumber totalAmountPaise status')
        .populate('createdBy', 'firstName lastName email'),
      VendorInvoice.countDocuments(query)
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
   * Get Vendor Invoice by ID.
   */
  public static async getVendorInvoiceById(id: string): Promise<IVendorInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Vendor Invoice ID.');
    }
    const invoice = await VendorInvoice.findById(id)
      .populate('vendorId')
      .populate('purchaseOrderId')
      .populate('goodsReceiptIds')
      .populate('createdBy', 'firstName lastName email');
    if (!invoice) {
      throw AppError.notFound('Vendor Invoice not found.');
    }
    return invoice;
  }
}
