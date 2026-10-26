import { Types } from 'mongoose';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ApprovePurchaseOrderInput,
  RejectPurchaseOrderInput,
  PurchaseOrderFilter,
  PurchaseOrderStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { PurchaseOrder, IPurchaseOrderDocument, IPurchaseOrderLineItem } from '../models/PurchaseOrder.js';
import { Vendor } from '../models/Vendor.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class PurchaseOrderService {
  /**
   * Helper: compute line item taxes and totals in integer paise.
   */
  private static calculateLineItem(
    item: {
      productId: string;
      orderedQuantity: number;
      unitPurchaseRatePaise: number;
      discountPaise?: number;
      gstRate?: number;
      notes?: string;
    },
    product: { sku: string; name: string; uom?: any },
    isInterState: boolean
  ): IPurchaseOrderLineItem {
    const discount = item.discountPaise ?? 0;
    const baseSubtotal = Math.round(item.orderedQuantity * item.unitPurchaseRatePaise);
    const taxableAmountPaise = Math.max(0, baseSubtotal - discount);
    const gstRate = item.gstRate ?? 12;

    let cgstAmountPaise = 0;
    let sgstAmountPaise = 0;
    let igstAmountPaise = 0;

    if (isInterState) {
      igstAmountPaise = Math.round((taxableAmountPaise * gstRate) / 100);
    } else {
      const halfRate = gstRate / 2;
      cgstAmountPaise = Math.round((taxableAmountPaise * halfRate) / 100);
      sgstAmountPaise = Math.round((taxableAmountPaise * halfRate) / 100);
    }

    const totalTaxPaise = cgstAmountPaise + sgstAmountPaise + igstAmountPaise;
    const totalAmountPaise = taxableAmountPaise + totalTaxPaise;

    return {
      productId: new Types.ObjectId(item.productId),
      sku: product.sku,
      productName: product.name,
      orderedQuantity: item.orderedQuantity,
      uom: product.uom || 'NOS',
      unitPurchaseRatePaise: item.unitPurchaseRatePaise,
      discountPaise: discount,
      taxableAmountPaise,
      gstRate,
      cgstAmountPaise,
      sgstAmountPaise,
      igstAmountPaise,
      totalTaxPaise,
      totalAmountPaise,
      receivedQuantity: 0,
      rejectedQuantity: 0,
      outstandingQuantity: item.orderedQuantity,
      notes: item.notes?.trim()
    };
  }

  /**
   * Helper: Get threshold from CompanySettings (default ₹25,000 = 2,500,000 paise).
   */
  private static async getApprovalThresholdPaise(): Promise<number> {
    const settings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' });
    return settings?.poApprovalThresholdPaise ?? 2500000;
  }

  /**
   * 1. Create a draft Purchase Order.
   */
  public static async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const vendor = await Vendor.findById(input.vendorId);
    if (!vendor || !vendor.isActive) {
      throw AppError.businessRule('Target vendor is inactive or not found.');
    }

    const warehouse = await Warehouse.findById(input.destinationWarehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Destination warehouse is inactive or not found.');
    }

    if (!input.lineItems || input.lineItems.length === 0) {
      throw AppError.validation('At least one line item is required.');
    }

    const computedLineItems: IPurchaseOrderLineItem[] = [];
    let subtotalPaise = 0;
    let totalDiscountPaise = 0;
    let totalTaxPaise = 0;
    let totalAmountPaise = 0;

    for (const item of input.lineItems) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        throw AppError.businessRule(`Product ${item.productId} is inactive or not found.`);
      }

      const line = this.calculateLineItem(item, product, !!input.isInterState);
      computedLineItems.push(line);

      subtotalPaise += line.taxableAmountPaise;
      totalDiscountPaise += line.discountPaise;
      totalTaxPaise += line.totalTaxPaise;
      totalAmountPaise += line.totalAmountPaise;
    }

    const thresholdPaise = await this.getApprovalThresholdPaise();
    const requiresApproval = totalAmountPaise >= thresholdPaise;

    const poSeq = await SequenceService.generateNumber(SequenceEntityType.PURCHASE_ORDER);

    const po = new PurchaseOrder({
      poNumber: poSeq.formattedNumber,
      vendorId: vendor._id,
      destinationWarehouseId: warehouse._id,
      orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      lineItems: computedLineItems,
      isInterState: !!input.isInterState,
      subtotalPaise,
      totalDiscountPaise,
      totalTaxPaise,
      totalAmountPaise,
      status: PurchaseOrderStatus.DRAFT,
      approval: {
        requiresApproval,
        approvalThresholdPaise: thresholdPaise
      },
      revision: 1,
      termsAndConditions: input.termsAndConditions?.trim(),
      notes: input.notes?.trim(),
      createdBy: new Types.ObjectId(user.userId)
    });

    await po.save();

    // Mark vendor as having purchase history
    if (!vendor.hasPurchaseHistory) {
      vendor.hasPurchaseHistory = true;
      await vendor.save();
    }

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-create',
      details: {
        poNumber: po.poNumber,
        vendorCode: vendor.vendorCode,
        totalAmountPaise: po.totalAmountPaise,
        requiresApproval
      }
    });

    return po;
  }

  /**
   * 2. Submit Purchase Order for approval (or auto-approve if under threshold).
   */
  public static async submitForApproval(
    id: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const po = await this.getPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.DRAFT && po.status !== PurchaseOrderStatus.REJECTED) {
      throw AppError.invalidStateTransition(
        `Cannot submit purchase order in status '${po.status}'. Must be DRAFT or REJECTED.`
      );
    }

    const thresholdPaise = await this.getApprovalThresholdPaise();
    po.approval.approvalThresholdPaise = thresholdPaise;

    if (po.totalAmountPaise < thresholdPaise) {
      // Auto-approve if below approval threshold
      po.status = PurchaseOrderStatus.APPROVED;
      po.approval.requiresApproval = false;
      po.approval.approvedBy = new Types.ObjectId(user.userId);
      po.approval.approvedAt = new Date();
    } else {
      po.status = PurchaseOrderStatus.PENDING_APPROVAL;
      po.approval.requiresApproval = true;
    }

    po.updatedBy = new Types.ObjectId(user.userId);
    await po.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_SUBMITTED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-submit',
      details: {
        poNumber: po.poNumber,
        status: po.status,
        requiresApproval: po.approval.requiresApproval
      }
    });

    return po;
  }

  /**
   * 3. Approve Purchase Order with anti-self-approval enforcement.
   */
  public static async approvePurchaseOrder(
    id: string,
    input: ApprovePurchaseOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const po = await this.getPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw AppError.invalidStateTransition(
        `Cannot approve purchase order in status '${po.status}'. Must be PENDING_APPROVAL.`
      );
    }

    // Anti-Self-Approval Enforcement: Creator cannot approve their own PO!
    if (po.createdBy.toString() === user.userId) {
      throw AppError.permissionDenied(
        'Anti-Self-Approval Violation: Requesters cannot approve their own purchase orders.'
      );
    }

    // Section 5: Recalculate and revalidate totals at approval time
    let recalculatedSubtotal = 0;
    let recalculatedDiscount = 0;
    let recalculatedTax = 0;
    let recalculatedTotal = 0;

    for (const line of po.lineItems) {
      const taxable = Math.max(0, Math.round(line.orderedQuantity * line.unitPurchaseRatePaise) - line.discountPaise);
      let tax = 0;
      if (po.isInterState) {
        tax = Math.round((taxable * line.gstRate) / 100);
      } else {
        const halfRate = line.gstRate / 2;
        tax = Math.round((taxable * halfRate) / 100) * 2;
      }
      line.taxableAmountPaise = taxable;
      line.totalTaxPaise = tax;
      line.totalAmountPaise = taxable + tax;

      recalculatedSubtotal += taxable;
      recalculatedDiscount += line.discountPaise;
      recalculatedTax += tax;
      recalculatedTotal += line.totalAmountPaise;
    }

    po.subtotalPaise = recalculatedSubtotal;
    po.totalDiscountPaise = recalculatedDiscount;
    po.totalTaxPaise = recalculatedTax;
    po.totalAmountPaise = recalculatedTotal;

    po.status = PurchaseOrderStatus.APPROVED;
    po.approval.approvedBy = new Types.ObjectId(user.userId);
    po.approval.approvedAt = new Date();
    po.approval.rejectionReason = undefined;
    po.approval.rejectedBy = undefined;
    po.approval.rejectedAt = undefined;
    po.updatedBy = new Types.ObjectId(user.userId);

    await po.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_APPROVED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-approve',
      details: {
        poNumber: po.poNumber,
        approvedTotalPaise: po.totalAmountPaise,
        reason: input.reason
      }
    });

    return po;
  }

  /**
   * 4. Reject Purchase Order.
   */
  public static async rejectPurchaseOrder(
    id: string,
    input: RejectPurchaseOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const po = await this.getPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw AppError.invalidStateTransition(
        `Cannot reject purchase order in status '${po.status}'. Must be PENDING_APPROVAL.`
      );
    }

    po.status = PurchaseOrderStatus.REJECTED;
    po.approval.rejectionReason = input.reason.trim();
    po.approval.rejectedBy = new Types.ObjectId(user.userId);
    po.approval.rejectedAt = new Date();
    po.updatedBy = new Types.ObjectId(user.userId);

    await po.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_REJECTED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-reject',
      details: {
        poNumber: po.poNumber,
        reason: input.reason
      }
    });

    return po;
  }

  /**
   * 5. Cancel Purchase Order.
   */
  public static async cancelPurchaseOrder(
    id: string,
    reason: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const po = await this.getPurchaseOrderById(id);

    if (
      po.status !== PurchaseOrderStatus.DRAFT &&
      po.status !== PurchaseOrderStatus.PENDING_APPROVAL &&
      po.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw AppError.invalidStateTransition(
        `Cannot cancel purchase order in status '${po.status}'. Only DRAFT, PENDING_APPROVAL, or APPROVED POs with zero receipts can be cancelled.`
      );
    }

    // Check if any goods have been received
    const totalReceived = po.lineItems.reduce((acc, l) => acc + l.receivedQuantity, 0);
    if (totalReceived > 0) {
      throw AppError.businessRule(
        `Cannot cancel purchase order: ${totalReceived} units have already been received. Use formal material return workflows instead.`
      );
    }

    po.status = PurchaseOrderStatus.CANCELLED;
    po.cancellationReason = reason.trim();
    po.cancelledBy = new Types.ObjectId(user.userId);
    po.cancelledAt = new Date();
    po.updatedBy = new Types.ObjectId(user.userId);

    await po.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_CANCELLED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-cancel',
      details: {
        poNumber: po.poNumber,
        reason
      }
    });

    return po;
  }

  /**
   * 6. Update draft Purchase Order (increments revision, resets approval).
   */
  public static async updatePurchaseOrder(
    id: string,
    input: UpdatePurchaseOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IPurchaseOrderDocument> {
    const po = await this.getPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.DRAFT && po.status !== PurchaseOrderStatus.REJECTED) {
      throw AppError.invalidStateTransition(
        `Cannot edit purchase order in status '${po.status}'. Approved orders require a formal revision.`
      );
    }

    if (input.vendorId && input.vendorId !== po.vendorId.toString()) {
      const vendor = await Vendor.findById(input.vendorId);
      if (!vendor || !vendor.isActive) {
        throw AppError.businessRule('Target vendor is inactive or not found.');
      }
      po.vendorId = vendor._id;
    }

    if (input.destinationWarehouseId && input.destinationWarehouseId !== po.destinationWarehouseId.toString()) {
      const wh = await Warehouse.findById(input.destinationWarehouseId);
      if (!wh || !wh.isActive) {
        throw AppError.businessRule('Destination warehouse is inactive or not found.');
      }
      po.destinationWarehouseId = wh._id;
    }

    if (input.isInterState !== undefined) {
      po.isInterState = input.isInterState;
    }

    if (input.lineItems && input.lineItems.length > 0) {
      const computedLineItems: IPurchaseOrderLineItem[] = [];
      let subtotalPaise = 0;
      let totalDiscountPaise = 0;
      let totalTaxPaise = 0;
      let totalAmountPaise = 0;

      for (const item of input.lineItems) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          throw AppError.businessRule(`Product ${item.productId} is inactive or not found.`);
        }
        const line = this.calculateLineItem(item, product, po.isInterState);
        computedLineItems.push(line);

        subtotalPaise += line.taxableAmountPaise;
        totalDiscountPaise += line.discountPaise;
        totalTaxPaise += line.totalTaxPaise;
        totalAmountPaise += line.totalAmountPaise;
      }

      po.lineItems = computedLineItems;
      po.subtotalPaise = subtotalPaise;
      po.totalDiscountPaise = totalDiscountPaise;
      po.totalTaxPaise = totalTaxPaise;
      po.totalAmountPaise = totalAmountPaise;

      const threshold = await this.getApprovalThresholdPaise();
      po.approval.approvalThresholdPaise = threshold;
      po.approval.requiresApproval = po.totalAmountPaise >= threshold;
    }

    if (input.orderDate) po.orderDate = new Date(input.orderDate);
    if (input.expectedDeliveryDate) po.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    if (input.termsAndConditions !== undefined) po.termsAndConditions = input.termsAndConditions.trim();
    if (input.notes !== undefined) po.notes = input.notes.trim();

    po.revision += 1;
    po.updatedBy = new Types.ObjectId(user.userId);
    await po.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PO_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'po-update',
      details: {
        poNumber: po.poNumber,
        revision: po.revision,
        totalAmountPaise: po.totalAmountPaise
      }
    });

    return po;
  }

  /**
   * 7. Query purchase orders with pagination and filters.
   */
  public static async getPurchaseOrders(filter: PurchaseOrderFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.vendorId) {
      query.vendorId = new Types.ObjectId(filter.vendorId);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.destinationWarehouseId) {
      query.destinationWarehouseId = new Types.ObjectId(filter.destinationWarehouseId);
    }
    if (filter.search && filter.search.trim()) {
      query.poNumber = { $regex: filter.search.trim(), $options: 'i' };
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      PurchaseOrder.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('vendorId', 'name vendorCode gstin phone')
        .populate('destinationWarehouseId', 'name code city')
        .populate('createdBy', 'firstName lastName email')
        .populate('approval.approvedBy', 'firstName lastName email'),
      PurchaseOrder.countDocuments(query)
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
   * 8. Get Purchase Order by ID.
   */
  public static async getPurchaseOrderById(id: string): Promise<IPurchaseOrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Purchase Order ID.');
    }
    const po = await PurchaseOrder.findById(id)
      .populate('vendorId')
      .populate('destinationWarehouseId')
      .populate('createdBy', 'firstName lastName email')
      .populate('approval.approvedBy', 'firstName lastName email');
    if (!po) {
      throw AppError.notFound('Purchase Order not found.');
    }
    return po;
  }
}
