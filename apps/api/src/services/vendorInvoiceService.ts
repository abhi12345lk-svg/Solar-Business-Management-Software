import { Types } from 'mongoose';
import {
  CreateVendorInvoiceInput,
  ReconcileVendorInvoiceInput,
  VendorInvoiceStatus,
  GoodsReceiptStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { VendorInvoice, IVendorInvoiceDocument } from '../models/VendorInvoice.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
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
    let vendor: any = null;
    if (Types.ObjectId.isValid(input.vendorId)) {
      vendor = await Vendor.findById(input.vendorId);
    } else {
      vendor = await Vendor.findOne({
        $or: [
          { name: new RegExp(`^${input.vendorId.trim()}$`, 'i') },
          { vendorCode: input.vendorId.trim() }
        ]
      });
    }

    if (!vendor) {
      throw AppError.notFound(`Vendor '${input.vendorId}' not found. Please select an existing vendor or create a new one.`);
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
    let grnIds: Types.ObjectId[] = input.goodsReceiptIds?.map(id => new Types.ObjectId(id)) || [];

    if (po) {
      // 3-Way Match Check: Inspect physical Goods Receipt Notes (GRN)
      const goodsReceipts = await GoodsReceipt.find({
        purchaseOrderId: po._id,
        status: GoodsReceiptStatus.COMPLETED
      });

      if (goodsReceipts.length > 0) {
        grnIds = goodsReceipts.map(g => g._id);

        let totalAcceptedSubtotalPaise = 0;
        for (const poLine of po.lineItems || []) {
          const acceptedQty = goodsReceipts.reduce((sum, grn) => {
            const grnLine = grn.lineItems.find(
              l => l.productId.toString() === poLine.productId.toString()
            );
            return sum + (grnLine?.acceptedQuantity || 0);
          }, 0);
          totalAcceptedSubtotalPaise += acceptedQty * (poLine.unitPricePaise || 0);
        }

        const poSubtotal = po.subtotalPaise || 1;
        const acceptedRatio = Math.min(1, totalAcceptedSubtotalPaise / poSubtotal);
        const expectedTaxPaise = Math.round((po.totalTaxPaise || 0) * acceptedRatio);
        const expectedAcceptedTotalPaise = totalAcceptedSubtotalPaise + expectedTaxPaise;

        const difference = input.totalAmountPaise - expectedAcceptedTotalPaise;

        if (difference > 100) {
          status = VendorInvoiceStatus.DISPUTED;
          discrepancyAmountPaise = difference;
          reconciliationNotes = `3-Way Match Discrepancy: Invoiced amount (₹${(input.totalAmountPaise / 100).toFixed(2)}) exceeds accepted warehouse receipts value (₹${(expectedAcceptedTotalPaise / 100).toFixed(2)}) by ₹${(discrepancyAmountPaise / 100).toFixed(2)}. Flagged for accountant review.`;
        } else {
          status = VendorInvoiceStatus.RECONCILED;
          reconciliationNotes =
            '3-Way Match successful: Invoice totals match physical warehouse GRN accepted receipts and approved PO terms.';
        }
      } else {
        // No goods receipts recorded yet for this PO
        status = VendorInvoiceStatus.DISPUTED;
        discrepancyAmountPaise = input.totalAmountPaise;
        reconciliationNotes = `3-Way Match Pending: No Goods Receipt Notes (GRN) recorded for PO ${po.poNumber}. Supplier bill cannot be reconciled until physical delivery is verified in warehouse.`;
      }
    }

    const invoice = new VendorInvoice({
      vendorInvoiceNumber: input.vendorInvoiceNumber.trim(),
      vendorId: vendor._id,
      purchaseOrderId: po?._id,
      projectId: po?.projectId || (input as any).projectId || undefined,
      goodsReceiptIds: grnIds,
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
  public static async getVendorInvoices(filter: any) {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.vendorId) {
      if (Types.ObjectId.isValid(filter.vendorId)) {
        query.vendorId = new Types.ObjectId(filter.vendorId);
      } else {
        const matched = await Vendor.find({
          $or: [
            { name: new RegExp(filter.vendorId.trim(), 'i') },
            { vendorCode: filter.vendorId.trim() }
          ]
        }).select('_id').lean();
        const ids = matched.map(v => v._id);
        query.vendorId = { $in: ids };
      }
    }
    if (filter.purchaseOrderId) {
      query.purchaseOrderId = new Types.ObjectId(filter.purchaseOrderId);
    }

    // Flexible status filtering (by audit status or payment status)
    if (filter.status && filter.status !== 'ALL') {
      if (filter.status === 'UNPAID') {
        query.balancePayablePaise = { $gt: 0 };
      } else if (filter.status === 'PAID') {
        query.balancePayablePaise = 0;
      } else {
        query.status = filter.status;
      }
    }

    if (filter.paymentStatus) {
      if (filter.paymentStatus === 'UNPAID') {
        query.balancePayablePaise = { $gt: 0 };
      } else if (filter.paymentStatus === 'PAID') {
        query.balancePayablePaise = 0;
      }
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      const matchedVendors = await Vendor.find({ name: searchRegex }).select('_id').lean();
      const vendorIds = matchedVendors.map(v => v._id);

      query.$or = [
        { vendorInvoiceNumber: searchRegex },
        { vendorId: { $in: vendorIds } },
        { notes: searchRegex }
      ];
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
   * Delete or void a Vendor Invoice (only if no payments disbursed).
   */
  public static async deleteVendorInvoice(
    id: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Vendor Invoice ID.');
    }
    const invoice = await VendorInvoice.findById(id);
    if (!invoice) {
      throw AppError.notFound('Vendor Invoice not found.');
    }
    if ((invoice.paidAmountPaise || 0) > 0) {
      throw AppError.validation('Cannot delete an invoice with recorded payment disbursements.');
    }

    await VendorInvoice.findByIdAndDelete(id);

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.VENDOR_INVOICE_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vinv-delete',
      details: {
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        action: 'DELETED'
      }
    });
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

  /**
   * Record payment disbursement against a vendor invoice.
   */
  public static async recordPayment(
    id: string,
    input: { amountPaise: number; paymentMethod?: string; paymentReference?: string; notes?: string },
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

    if (invoice.balancePayablePaise <= 0) {
      throw AppError.validation('Invoice has no outstanding balance payable.');
    }

    if (input.amountPaise > invoice.balancePayablePaise) {
      throw AppError.validation(
        `Disbursement amount (₹${(input.amountPaise / 100).toFixed(2)}) exceeds remaining balance payable (₹${(invoice.balancePayablePaise / 100).toFixed(2)}).`
      );
    }

    const payAmt = input.amountPaise;

    invoice.paidAmountPaise += payAmt;
    invoice.balancePayablePaise = Math.max(0, invoice.totalAmountPaise - invoice.paidAmountPaise);
    if (invoice.balancePayablePaise === 0 && invoice.status !== VendorInvoiceStatus.DISPUTED) {
      invoice.status = VendorInvoiceStatus.RECONCILED;
    }
    const payNote = `Payment of ₹${(payAmt / 100).toFixed(2)} disbursed (${input.paymentMethod || 'Bank Transfer'}${input.paymentReference ? ` Ref: ${input.paymentReference}` : ''}).`;
    invoice.reconciliationNotes = invoice.reconciliationNotes
      ? `${invoice.reconciliationNotes} | ${payNote}`
      : payNote;

    await invoice.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PAYMENT_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'vinv-pay',
      details: {
        vendorInvoiceId: invoice._id.toString(),
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        paidAmountPaise: payAmt,
        paymentReference: input.paymentReference,
        newBalancePayablePaise: invoice.balancePayablePaise
      }
    });

    return invoice;
  }
}
