/**
 * INS Solar Business Management Software — Sales Order Service
 *
 * Handles order creation from an accepted, approved quotation revision,
 * snapshotting of agreed line-item scope, pricing and financials, order lifecycle transitions,
 * cancellation controls, and reservation release coordination.
 */

import { Types } from 'mongoose';
import {
  CreateOrderFromQuotationParsed,
  CancelOrderInput,
  OrderFilter,
  OrderStatus,
  OrderReservationStatus,
  QuotationStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole,
  SequenceEntityType
} from '@ins-solar/shared';
import { SalesOrder, ISalesOrderDocument } from '../models/SalesOrder.js';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockService } from './stockService.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class OrderService {
  /**
   * 1. Create a Sales Order from an eligible, accepted Quotation Revision.
   */
  public static async createOrderFromQuotation(
    input: CreateOrderFromQuotationParsed,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISalesOrderDocument> {
    // 1. Idempotency protection check
    if (input.idempotencyKey) {
      const existingByIdem = await SalesOrder.findOne({ idempotencyKey: input.idempotencyKey });
      if (existingByIdem) {
        logger.info(
          { idempotencyKey: input.idempotencyKey, orderNumber: existingByIdem.orderNumber },
          'Returning existing Sales Order for duplicate idempotency key.'
        );
        return existingByIdem;
      }
    }

    // 2. Enforce 1:1 binding per quotation revision
    const existingForRevision = await SalesOrder.findOne({
      quotationRevisionId: input.quotationRevisionId
    });
    if (existingForRevision) {
      if (input.idempotencyKey && existingForRevision.idempotencyKey === input.idempotencyKey) {
        return existingForRevision;
      }
      throw AppError.conflict(
        `A sales order (${existingForRevision.orderNumber}) has already been generated from this accepted quotation revision.`
      );
    }

    // 3. Retrieve and validate originating quotation revision
    const quotation = await Quotation.findById(input.quotationRevisionId);
    if (!quotation) {
      throw AppError.notFound('Quotation revision not found.');
    }

    // Must belong to the provided parent quotation ID if specified
    if (
      quotation._id.toString() !== input.quotationId &&
      quotation.parentQuotationId?.toString() !== input.quotationId
    ) {
      throw AppError.businessRule(
        'Quotation revision does not match the parent quotation reference.'
      );
    }

    // Must be genuinely accepted by the customer
    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw AppError.businessRule(
        'Only an accepted quotation revision can be converted into a sales order.'
      );
    }

    // Must have approved commercial discounts if discount approval was required
    if (quotation.requiresDiscountApproval && quotation.discountApprovalStatus !== 'APPROVED') {
      throw AppError.businessRule(
        'Quotation contains commercial discounts awaiting managerial approval and cannot be converted.'
      );
    }

    // Must not be superseded or expired
    if (!quotation.isLatestRevision) {
      throw AppError.businessRule(
        'Quotation revision has been superseded by a newer revision and cannot be converted.'
      );
    }

    if (new Date(quotation.validUntil).getTime() < Date.now()) {
      throw AppError.businessRule(
        'Quotation validity has expired. A refreshed revision is required before order confirmation.'
      );
    }

    // 4. Validate customer record
    const customer = await Customer.findById(quotation.customerId);
    if (!customer || !customer.isActive) {
      throw AppError.businessRule('Associated customer profile is inactive or not found.');
    }

    // 5. Generate Atomic Order Number (ORD-YYYY-NNNNN)
    const seqResult = await SequenceService.generateNumber(SequenceEntityType.ORDER);

    // 6. Snapshot agreed commercial line items and financials from the quotation revision
    const orderLineItems = quotation.lineItems.map(item => ({
      itemType: item.itemType,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitRatePaise: item.unitRatePaise,
      discountPaise: item.discountPaise,
      taxableAmountPaise: item.taxableAmountPaise,
      gstRateBasisPoints: item.gstRateBasisPoints,
      taxPaise: item.totalTaxAmountPaise,
      itemTotalPaise: item.totalAmountPaise
    }));

    const order = new SalesOrder({
      orderNumber: seqResult.formattedNumber,
      customerId: quotation.customerId,
      quotationId: quotation._id,
      quotationRevisionId: quotation._id,
      solarDesignId: quotation.solarDesignId,
      orderDate: new Date(),
      status: OrderStatus.CONFIRMED,
      systemTopology: quotation.systemTopology,
      systemCapacityKwp: quotation.systemCapacityKwp,
      lineItems: orderLineItems,
      grossSubtotalPaise: quotation.subtotalPaise,
      additionalDiscountPaise: quotation.additionalDiscountPaise || 0,
      totalDiscountPaise: quotation.totalDiscountPaise || 0,
      taxableAmountPaise: quotation.taxableAmountPaise,
      totalTaxPaise: quotation.totalTaxAmountPaise,
      netTotalPaise: quotation.netTotalPaise,
      taxProfile: {
        profileName: quotation.taxProfile.profileName,
        profileCode: quotation.taxProfile.profileCode,
        effectiveDate:
          quotation.taxProfile.effectiveDate instanceof Date
            ? quotation.taxProfile.effectiveDate.toISOString()
            : String(quotation.taxProfile.effectiveDate),
        isInterState: quotation.taxProfile.isInterState,
        accountingNotice: quotation.taxProfile.accountingNotice
      },
      paymentMilestones: quotation.paymentMilestones,
      termsAndConditions: quotation.termsAndConditions,
      reservationStatus: OrderReservationStatus.NONE,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      createdBy: new Types.ObjectId(user.userId)
    });

    try {
      await order.save();
    } catch (err: any) {
      if (err.code === 11000) {
        // Concurrent collision on quotationRevisionId or idempotencyKey
        const existing = await SalesOrder.findOne({
          quotationRevisionId: input.quotationRevisionId
        });
        if (existing) return existing;
      }
      throw err;
    }

    // 7. Audit Event
    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.ORDER_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'order-create',
      details: {
        orderNumber: order.orderNumber,
        quotationCode: quotation.fullQuotationCode,
        netTotalPaise: order.netTotalPaise,
        capacityKwp: order.systemCapacityKwp
      }
    });

    logger.info(
      { orderNumber: order.orderNumber, quotationCode: quotation.fullQuotationCode },
      'Sales Order created successfully from accepted quotation revision.'
    );

    return order;
  }

  /**
   * 2. Retrieve single Sales Order with security isolation.
   */
  public static async getOrderById(
    orderId: string,
    scopedCustomerId?: string
  ): Promise<ISalesOrderDocument> {
    const order = await SalesOrder.findById(orderId)
      .populate('customerId', 'legalName customerCode primaryPhone email addresses')
      .populate('quotationRevisionId', 'fullQuotationCode revisionNumber validUntil')
      .populate('solarDesignId', 'designNumber proposedCapacityKwp systemTopology')
      .populate('lineItems.productId', 'name sku brand productType')
      .populate('createdBy', 'firstName lastName email')
      .populate('cancelledBy', 'firstName lastName email');

    if (!order) {
      throw AppError.notFound('Sales Order not found.');
    }

    if (scopedCustomerId && order.customerId._id.toString() !== scopedCustomerId) {
      throw AppError.permissionDenied("Access denied: You cannot view another customer's order.");
    }

    return order;
  }

  /**
   * 3. List Sales Orders with pagination and filters.
   */
  public static async listOrders(filter: OrderFilter, scopedCustomerId?: string) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (scopedCustomerId) {
      query.customerId = scopedCustomerId;
    } else if (filter.customerId) {
      query.customerId = filter.customerId;
    }

    if (filter.status) query.status = filter.status;
    if (filter.reservationStatus) query.reservationStatus = filter.reservationStatus;
    if (filter.search) {
      query.orderNumber = { $regex: filter.search, $options: 'i' };
    }

    const sortOptions: Record<string, 1 | -1> = {
      [filter.sortBy || 'createdAt']: filter.sortOrder === 'asc' ? 1 : -1
    };

    const [orders, total] = await Promise.all([
      SalesOrder.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'legalName customerCode')
        .populate('createdBy', 'firstName lastName')
        .lean(),
      SalesOrder.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: orders,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * 4. Cancel Sales Order with reservation release coordination.
   */
  public static async cancelOrder(
    orderId: string,
    input: CancelOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISalesOrderDocument> {
    const order = await SalesOrder.findById(orderId);
    if (!order) {
      throw AppError.notFound('Sales Order not found.');
    }

    // Idempotent return if already cancelled
    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw AppError.businessRule('Completed sales orders cannot be cancelled.');
    }

    // Check if physical material issue has already occurred
    const physicalIssueCount = await StockMovement.countDocuments({
      orderId: order._id,
      movementType: 'ISSUE'
    });

    if (physicalIssueCount > 0) {
      throw AppError.businessRule(
        'Material has already been physically dispatched/issued for this order. Direct cancellation is forbidden; formal return/reversal movements must be executed first.'
      );
    }

    // If stock was reserved, atomically release all active reservations
    if (
      order.reservationStatus === OrderReservationStatus.PARTIALLY_RESERVED ||
      order.reservationStatus === OrderReservationStatus.FULLY_RESERVED
    ) {
      await StockService.releaseOrderReservations(order._id.toString(), user, context);
      order.reservationStatus = OrderReservationStatus.RELEASED;
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = input.cancellationReason;
    order.cancelledAt = new Date();
    order.cancelledBy = new Types.ObjectId(user.userId);
    order.updatedBy = new Types.ObjectId(user.userId);

    await order.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.ORDER_CANCELLED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'order-cancel',
      details: {
        orderNumber: order.orderNumber,
        cancellationReason: input.cancellationReason,
        previousStatus: OrderStatus.CONFIRMED
      }
    });

    logger.info(
      { orderNumber: order.orderNumber, reason: input.cancellationReason },
      'Sales Order cancelled and reservations released.'
    );

    return order;
  }
}
