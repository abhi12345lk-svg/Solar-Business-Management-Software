/**
 * INS Solar Business Management Software — Payment & Receivables Service
 *
 * Implements customer payment tracking, atomic receipt numbering, verification workflows,
 * concurrency-safe order allocations, receivables ledger, and operational receipt generation.
 *
 * Strictly adheres to integer-paise financial arithmetic and anti-cross-customer isolation.
 */

import mongoose from 'mongoose';
import {
  CustomerPayment,
  ICustomerPaymentDocument,
  PaymentAllocation,
  IPaymentAllocationDocument,
  SalesOrder,
  Customer,
  CompanySettings
} from '../models/index.js';
import {
  PaymentMethod,
  CustomerPaymentStatus,
  PaymentAllocationStatus,
  OrderPaymentStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  formatPaiseToInr,
  RecordPaymentInput,
  VerifyPaymentInput,
  AllocatePaymentInput,
  ReverseAllocationInput,
  ReversePaymentInput,
  RefundPaymentInput,
  PaymentFilterInput
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export interface UserContext {
  userId?: string;
  role?: string;
  department?: string;
  isCustomer?: boolean;
  customerId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class PaymentService {
  /**
   * Records a new customer payment with atomic receipt numbering.
   */
  public static async recordPayment(
    input: RecordPaymentInput,
    actor: UserContext
  ): Promise<ICustomerPaymentDocument> {
    // 1. Idempotency replay check
    if (input.idempotencyKey?.trim()) {
      const existing = await CustomerPayment.findOne({
        idempotencyKey: input.idempotencyKey.trim()
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Validate customer existence
    let customer: any = null;
    const cleanCustId = input.customerId.trim();
    if (mongoose.Types.ObjectId.isValid(cleanCustId)) {
      customer = await Customer.findById(cleanCustId);
    }
    if (!customer) {
      customer = await Customer.findOne({ customerCode: cleanCustId.toUpperCase() });
    }
    if (!customer) {
      throw AppError.notFound(`Customer with ID or Code '${cleanCustId}' not found.`);
    }

    // 3. Duplicate transaction reference check for non-cash methods
    if (input.transactionReference?.trim() && input.paymentMethod !== PaymentMethod.CASH) {
      const duplicate = await CustomerPayment.findOne({
        transactionReference: input.transactionReference.trim(),
        customerId: customer._id,
        status: { $ne: CustomerPaymentStatus.REVERSED }
      });
      if (duplicate) {
        throw AppError.badRequest(
          `A payment with transaction reference '${input.transactionReference}' has already been recorded for this customer (${duplicate.receiptNumber}).`
        );
      }
    }

    // 4. Generate unique atomic receipt number
    const seqResult = await SequenceService.generateNumber(SequenceEntityType.PAYMENT_RECEIPT);
    const receiptNumber = seqResult.formattedNumber;

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const isAutoVerified = Boolean(input.autoVerify);
    const status = isAutoVerified ? CustomerPaymentStatus.VERIFIED : CustomerPaymentStatus.RECORDED;

    const initialHistory = [
      {
        fromStatus: 'NONE',
        toStatus: status,
        changedAt: new Date(),
        changedBy: actorId,
        notes: isAutoVerified ? 'Payment recorded and verified on intake' : 'Payment recorded'
      }
    ];

    const payment = new CustomerPayment({
      receiptNumber,
      customerId: customer._id,
      amountPaise: input.amountPaise,
      paymentDate: input.paymentDate || new Date(),
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference?.trim(),
      status,
      allocatedAmountPaise: 0,
      unallocatedAmountPaise: input.amountPaise,
      evidenceKey: input.evidenceKey?.trim(),
      notes: input.notes?.trim(),
      internalNotes: input.internalNotes?.trim(),
      idempotencyKey: input.idempotencyKey?.trim(),
      recordedBy: actorId,
      verifiedBy: isAutoVerified ? actorId : undefined,
      verifiedAt: isAutoVerified ? new Date() : undefined,
      statusHistory: initialHistory
    });

    await payment.save();

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: actor.isCustomer ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-rec',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'CustomerPayment',
      targetId: payment._id.toString(),
      details: {
        receiptNumber,
        customerId: customer._id.toString(),
        amountPaise: input.amountPaise,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        status
      }
    });

    return payment;
  }

  /**
   * Verifies/confirms a recorded payment before order allocation.
   */
  public static async verifyPayment(
    paymentId: string,
    input: VerifyPaymentInput,
    actor: UserContext
  ): Promise<ICustomerPaymentDocument> {
    const payment = await CustomerPayment.findById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${paymentId} not found.`);
    }

    if (payment.status !== CustomerPaymentStatus.RECORDED) {
      throw AppError.badRequest(
        `Only RECORDED payments can be verified. Current status: ${payment.status}.`
      );
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    payment.statusHistory.push({
      fromStatus: payment.status,
      toStatus: CustomerPaymentStatus.VERIFIED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: input.verificationNotes || 'Payment verified by accounts'
    });

    payment.status = CustomerPaymentStatus.VERIFIED;
    payment.verifiedBy = actorId;
    payment.verifiedAt = input.verifiedDate || new Date();
    payment.verificationNotes = input.verificationNotes?.trim();

    await payment.save();

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_VERIFIED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-verify',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'CustomerPayment',
      targetId: payment._id.toString(),
      details: {
        receiptNumber: payment.receiptNumber,
        amountPaise: payment.amountPaise,
        verificationNotes: input.verificationNotes
      }
    });

    return payment;
  }

  /**
   * Allocates an available portion of a verified payment to an eligible sales order.
   * Enforces non-cross-customer bounds, payment quota, and order collectible ceiling.
   */
  public static async allocatePayment(
    paymentId: string,
    input: AllocatePaymentInput,
    actor: UserContext
  ): Promise<{
    allocation: IPaymentAllocationDocument;
    payment: ICustomerPaymentDocument;
    remainingOrderCollectiblePaise: number;
  }> {
    // 1. Idempotency check
    if (input.idempotencyKey?.trim()) {
      const existing = await PaymentAllocation.findOne({
        idempotencyKey: input.idempotencyKey.trim()
      });
      if (existing) {
        const p = await CustomerPayment.findById(paymentId);
        return {
          allocation: existing,
          payment: p!,
          remainingOrderCollectiblePaise: 0
        };
      }
    }

    // 2. Fetch payment and validate status
    const payment = await CustomerPayment.findById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${paymentId} not found.`);
    }

    if (payment.status !== CustomerPaymentStatus.VERIFIED) {
      throw AppError.badRequest(
        `Payment ${payment.receiptNumber} is in status '${payment.status}'. Only VERIFIED payments can be allocated.`
      );
    }

    // 3. Fetch sales order and validate status
    let order: any = null;
    const cleanOrderId = input.salesOrderId.trim();
    if (mongoose.Types.ObjectId.isValid(cleanOrderId)) {
      order = await SalesOrder.findById(cleanOrderId);
    }
    if (!order) {
      order = await SalesOrder.findOne({ orderNumber: cleanOrderId.toUpperCase() });
    }
    if (!order) {
      throw AppError.notFound(`Sales Order with ID or Code '${cleanOrderId}' not found.`);
    }

    if (order.status === 'CANCELLED') {
      throw AppError.badRequest(
        `Cannot allocate payment to cancelled Sales Order ${order.orderNumber}.`
      );
    }

    // 4. Strict anti-cross-customer boundary validation
    if (payment.customerId.toString() !== order.customerId.toString()) {
      throw AppError.badRequest(
        `Cross-customer allocation rejected. Payment customer (${payment.customerId}) does not match Sales Order customer (${order.customerId}).`
      );
    }

    // 5. Atomic concurrency-safe deduction of payment unallocated quota
    const updatedPayment = await CustomerPayment.findOneAndUpdate(
      {
        _id: payment._id,
        status: CustomerPaymentStatus.VERIFIED,
        $expr: {
          $lte: [{ $add: ['$allocatedAmountPaise', input.allocatedAmountPaise] }, '$amountPaise']
        }
      },
      {
        $inc: {
          allocatedAmountPaise: input.allocatedAmountPaise,
          unallocatedAmountPaise: -input.allocatedAmountPaise
        }
      },
      { new: true }
    );

    if (!updatedPayment) {
      throw AppError.badRequest(
        `Allocation amount (₹${input.allocatedAmountPaise / 100}) exceeds available unallocated payment balance (₹${payment.unallocatedAmountPaise / 100}).`
      );
    }

    // 6. Check order collectible ceiling
    const existingAllocations = await PaymentAllocation.aggregate([
      {
        $match: {
          salesOrderId: order._id,
          status: PaymentAllocationStatus.ACTIVE
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$allocatedAmountPaise' }
        }
      }
    ]);

    const currentOrderAllocated = existingAllocations[0]?.total || 0;
    const remainingCollectible = Math.max(0, order.netTotalPaise - currentOrderAllocated);

    if (input.allocatedAmountPaise > remainingCollectible) {
      // Rollback payment quota deduction
      await CustomerPayment.findByIdAndUpdate(payment._id, {
        $inc: {
          allocatedAmountPaise: -input.allocatedAmountPaise,
          unallocatedAmountPaise: input.allocatedAmountPaise
        }
      });

      throw AppError.badRequest(
        `Allocation of ₹${input.allocatedAmountPaise / 100} exceeds order collectible balance of ₹${remainingCollectible / 100} on ${order.orderNumber}.`
      );
    }

    // 7. Generate allocation sequence
    const seqResult = await SequenceService.generateNumber(SequenceEntityType.PAYMENT_ALLOCATION);
    const allocationNumber = seqResult.formattedNumber;

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const allocation = new PaymentAllocation({
      allocationNumber,
      paymentId: payment._id,
      salesOrderId: order._id,
      customerId: order.customerId,
      allocatedAmountPaise: input.allocatedAmountPaise,
      allocationDate: new Date(),
      status: PaymentAllocationStatus.ACTIVE,
      allocatedBy: actorId,
      notes: input.notes?.trim(),
      idempotencyKey: input.idempotencyKey?.trim()
    });

    await allocation.save();

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_ALLOCATED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-alloc',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'PaymentAllocation',
      targetId: allocation._id.toString(),
      details: {
        allocationNumber,
        receiptNumber: payment.receiptNumber,
        orderNumber: order.orderNumber,
        allocatedAmountPaise: input.allocatedAmountPaise
      }
    });

    return {
      allocation,
      payment: updatedPayment,
      remainingOrderCollectiblePaise: remainingCollectible - input.allocatedAmountPaise
    };
  }

  /**
   * Reverses an active payment allocation, restoring the payment's unallocated balance.
   */
  public static async reverseAllocation(
    allocationId: string,
    input: ReverseAllocationInput,
    actor: UserContext
  ): Promise<IPaymentAllocationDocument> {
    const allocation = await PaymentAllocation.findById(allocationId);
    if (!allocation) {
      throw AppError.notFound(`Payment allocation with ID ${allocationId} not found.`);
    }

    if (allocation.status === PaymentAllocationStatus.REVERSED) {
      throw AppError.badRequest('This allocation has already been reversed.');
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    allocation.status = PaymentAllocationStatus.REVERSED;
    allocation.reversedBy = actorId;
    allocation.reversedAt = new Date();
    allocation.reversalReason = input.reversalReason;

    await allocation.save();

    // Restore payment quota atomically
    await CustomerPayment.findByIdAndUpdate(allocation.paymentId, {
      $inc: {
        allocatedAmountPaise: -allocation.allocatedAmountPaise,
        unallocatedAmountPaise: allocation.allocatedAmountPaise
      }
    });

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_ALLOCATION_REVERSED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-alloc-rev',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'PaymentAllocation',
      targetId: allocation._id.toString(),
      details: {
        allocationNumber: allocation.allocationNumber,
        reversalReason: input.reversalReason,
        restoredAmountPaise: allocation.allocatedAmountPaise
      }
    });

    return allocation;
  }

  /**
   * Reverses a payment, automatically reconciling and reversing any active allocations.
   */
  public static async reversePayment(
    paymentId: string,
    input: ReversePaymentInput,
    actor: UserContext
  ): Promise<ICustomerPaymentDocument> {
    const payment = await CustomerPayment.findById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${paymentId} not found.`);
    }

    if (payment.status === CustomerPaymentStatus.REVERSED) {
      throw AppError.badRequest('Payment has already been reversed.');
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    // Cascade reverse active allocations
    const activeAllocations = await PaymentAllocation.find({
      paymentId: payment._id,
      status: PaymentAllocationStatus.ACTIVE
    });

    for (const alloc of activeAllocations) {
      alloc.status = PaymentAllocationStatus.REVERSED;
      alloc.reversedBy = actorId;
      alloc.reversedAt = new Date();
      alloc.reversalReason = `Payment ${payment.receiptNumber} reversed: ${input.reversalReason}`;
      await alloc.save();
    }

    payment.statusHistory.push({
      fromStatus: payment.status,
      toStatus: CustomerPaymentStatus.REVERSED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: input.reversalReason
    });

    payment.status = CustomerPaymentStatus.REVERSED;
    payment.allocatedAmountPaise = 0;
    payment.unallocatedAmountPaise = 0;
    payment.reversedBy = actorId;
    payment.reversedAt = new Date();
    payment.reversalReason = input.reversalReason;

    await payment.save();

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_REVERSED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-rev',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'CustomerPayment',
      targetId: payment._id.toString(),
      details: {
        receiptNumber: payment.receiptNumber,
        reversalReason: input.reversalReason,
        activeAllocationsReversedCount: activeAllocations.length
      }
    });

    return payment;
  }

  /**
   * Records a customer refund from unallocated payment funds.
   */
  public static async refundPayment(
    paymentId: string,
    input: RefundPaymentInput,
    actor: UserContext
  ): Promise<ICustomerPaymentDocument> {
    const payment = await CustomerPayment.findById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${paymentId} not found.`);
    }

    if (payment.status === CustomerPaymentStatus.REVERSED) {
      throw AppError.badRequest('Cannot refund a reversed payment.');
    }

    if (input.refundAmountPaise > payment.unallocatedAmountPaise) {
      throw AppError.badRequest(
        `Refund amount (₹${input.refundAmountPaise / 100}) exceeds unallocated credit (₹${payment.unallocatedAmountPaise / 100}).`
      );
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    payment.unallocatedAmountPaise -= input.refundAmountPaise;
    payment.refundAmountPaise = (payment.refundAmountPaise || 0) + input.refundAmountPaise;
    payment.refundReference = input.refundReference.trim();
    payment.refundedAt = input.refundDate || new Date();
    payment.refundedBy = actorId;
    payment.refundReason = input.refundReason.trim();

    if (payment.unallocatedAmountPaise === 0 && payment.allocatedAmountPaise === 0) {
      payment.status = CustomerPaymentStatus.REFUNDED;
    }

    payment.statusHistory.push({
      fromStatus: payment.status,
      toStatus: payment.status,
      changedAt: new Date(),
      changedBy: actorId,
      notes: `Refund processed: ${input.refundReason} (Ref: ${input.refundReference})`
    });

    await payment.save();

    await AuditService.recordEvent({
      action: AuditAction.PAYMENT_REFUNDED,
      outcome: AuditOutcome.SUCCESS,
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      correlationId: actor.correlationId || 'pay-ref',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      targetEntity: 'CustomerPayment',
      targetId: payment._id.toString(),
      details: {
        receiptNumber: payment.receiptNumber,
        refundAmountPaise: input.refundAmountPaise,
        refundReference: input.refundReference,
        refundReason: input.refundReason
      }
    });

    return payment;
  }

  /**
   * Calculates order-level receivables, allocated amounts, and payment status.
   */
  public static async getOrderReceivables(
    salesOrderId: string,
    userContext: UserContext
  ): Promise<{
    order: any;
    orderTotalPaise: number;
    allocatedAmountPaise: number;
    outstandingBalancePaise: number;
    paymentStatus: OrderPaymentStatus;
    activeAllocations: any[];
    reversedAllocations: any[];
  }> {
    const order = await SalesOrder.findById(salesOrderId)
      .populate('customerId', 'name customerCode primaryPhone email billingAddress')
      .lean();

    if (!order) {
      throw AppError.notFound(`Sales Order with ID ${salesOrderId} not found.`);
    }

    if (userContext.isCustomer) {
      const orderCustomerId =
        (order.customerId as any)?._id?.toString() || order.customerId?.toString();
      if (orderCustomerId !== userContext.customerId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's order receivables."
        );
      }
    }

    const allocations = await PaymentAllocation.find({ salesOrderId: order._id })
      .populate('paymentId', 'receiptNumber paymentDate paymentMethod transactionReference status')
      .sort({ allocationDate: -1 })
      .lean();

    const activeAllocations = allocations.filter(a => a.status === PaymentAllocationStatus.ACTIVE);
    const reversedAllocations = allocations.filter(
      a => a.status === PaymentAllocationStatus.REVERSED
    );

    const allocatedAmountPaise = activeAllocations.reduce(
      (sum, a) => sum + (a.allocatedAmountPaise || 0),
      0
    );

    const orderTotalPaise = order.netTotalPaise || 0;
    const outstandingBalancePaise = Math.max(0, orderTotalPaise - allocatedAmountPaise);

    let paymentStatus: OrderPaymentStatus = OrderPaymentStatus.UNPAID;
    if (allocatedAmountPaise >= orderTotalPaise && orderTotalPaise > 0) {
      paymentStatus = OrderPaymentStatus.PAID;
    } else if (allocatedAmountPaise > 0) {
      paymentStatus = OrderPaymentStatus.PARTIALLY_PAID;
    }

    return {
      order,
      orderTotalPaise,
      allocatedAmountPaise,
      outstandingBalancePaise,
      paymentStatus,
      activeAllocations,
      reversedAllocations
    };
  }

  /**
   * Calculates comprehensive customer receivables, unallocated credits, and aging.
   */
  public static async getCustomerReceivables(
    customerId: string,
    userContext: UserContext = {}
  ): Promise<{
    customer: any;
    totalOrderValuePaise: number;
    totalPaidPaise: number;
    totalAllocatedPaise: number;
    totalUnallocatedCreditPaise: number;
    totalOutstandingPaise: number;
    orders: any[];
    aging: {
      current0To30Paise: number;
      overdue31To60Paise: number;
      overdue61To90Paise: number;
      overdueAbove90Paise: number;
    };
  }> {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      throw AppError.notFound(`Customer with ID ${customerId} not found.`);
    }

    if (userContext?.isCustomer && customerId !== userContext.customerId) {
      throw AppError.permissionDenied(
        "Access denied: You cannot view another customer's receivables."
      );
    }

    // 1. Fetch orders
    const orders = await SalesOrder.find({
      customerId: customer._id,
      status: { $ne: 'CANCELLED' }
    })
      .sort({ orderDate: -1 })
      .lean();

    // 2. Fetch verified payments
    const payments = await CustomerPayment.find({
      customerId: customer._id,
      status: { $in: [CustomerPaymentStatus.VERIFIED, CustomerPaymentStatus.REFUNDED] }
    }).lean();

    // 3. Fetch active allocations
    const allocations = await PaymentAllocation.find({
      customerId: customer._id,
      status: PaymentAllocationStatus.ACTIVE
    }).lean();

    const allocationMap = new Map<string, number>();
    for (const alloc of allocations) {
      const oid = alloc.salesOrderId.toString();
      allocationMap.set(oid, (allocationMap.get(oid) || 0) + alloc.allocatedAmountPaise);
    }

    let totalOrderValuePaise = 0;
    let totalAllocatedPaise = 0;
    const now = Date.now();

    const aging = {
      current0To30Paise: 0,
      overdue31To60Paise: 0,
      overdue61To90Paise: 0,
      overdueAbove90Paise: 0
    };

    const orderSummaries = orders.map(ord => {
      const orderTotal = ord.netTotalPaise || 0;
      const allocated = allocationMap.get(ord._id.toString()) || 0;
      const outstanding = Math.max(0, orderTotal - allocated);

      totalOrderValuePaise += orderTotal;
      totalAllocatedPaise += allocated;

      let paymentStatus: OrderPaymentStatus = OrderPaymentStatus.UNPAID;
      if (allocated >= orderTotal && orderTotal > 0) {
        paymentStatus = OrderPaymentStatus.PAID;
      } else if (allocated > 0) {
        paymentStatus = OrderPaymentStatus.PARTIALLY_PAID;
      }

      // Compute aging bucket based on orderDate
      const ageDays = Math.floor(
        (now - new Date(ord.orderDate || ord.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (outstanding > 0) {
        if (ageDays <= 30) {
          aging.current0To30Paise += outstanding;
        } else if (ageDays <= 60) {
          aging.overdue31To60Paise += outstanding;
        } else if (ageDays <= 90) {
          aging.overdue61To90Paise += outstanding;
        } else {
          aging.overdueAbove90Paise += outstanding;
        }
      }

      return {
        _id: ord._id,
        orderNumber: ord.orderNumber,
        orderDate: ord.orderDate,
        systemCapacityKwp: ord.systemCapacityKwp,
        systemTopology: ord.systemTopology,
        netTotalPaise: orderTotal,
        allocatedAmountPaise: allocated,
        outstandingBalancePaise: outstanding,
        paymentStatus
      };
    });

    const totalPaidPaise = payments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
    const totalUnallocatedCreditPaise = payments.reduce(
      (sum, p) => sum + (p.unallocatedAmountPaise || 0),
      0
    );
    const totalOutstandingPaise = Math.max(0, totalOrderValuePaise - totalAllocatedPaise);

    return {
      customer,
      totalOrderValuePaise,
      totalPaidPaise,
      totalAllocatedPaise,
      totalUnallocatedCreditPaise,
      totalOutstandingPaise,
      orders: orderSummaries,
      aging
    };
  }

  /**
   * Assembles printable operational payment receipt data.
   */
  public static async getReceiptDocument(
    paymentId: string,
    userContext: UserContext
  ): Promise<{
    receiptNumber: string;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    amountPaise: number;
    amountRupees: number;
    formattedAmount: string;
    allocatedAmountPaise: number;
    unallocatedAmountPaise: number;
    status: CustomerPaymentStatus;
    company: any;
    customer: any;
    allocations: any[];
    notes?: string;
    internalNotes?: string;
    disclaimer: string;
  }> {
    const payment = await CustomerPayment.findById(paymentId)
      .populate('customerId', 'name customerCode primaryPhone email billingAddress gstin')
      .populate('recordedBy', 'firstName lastName email')
      .populate('verifiedBy', 'firstName lastName email')
      .lean();

    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${paymentId} not found.`);
    }

    if (userContext.isCustomer) {
      const paymentCustId =
        (payment.customerId as any)?._id?.toString() || payment.customerId?.toString();
      if (paymentCustId !== userContext.customerId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's payment receipt."
        );
      }
    }

    // Company Settings
    const settings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' }).lean();
    const company = {
      companyName: settings?.companyName || 'INS Solar Business Systems',
      legalEntityName: settings?.legalEntityName || 'INS Solar Private Limited',
      gstin: settings?.gstin || '27AAAAA0000A1Z5',
      pan: settings?.pan || 'AAAAA0000A',
      contactPhone: settings?.contactPhone || '+91 99999 00000',
      contactEmail: settings?.contactEmail || 'accounts@inssolar.com',
      website: settings?.website || 'https://inssolar.com',
      address: settings?.registeredAddress || {
        addressLine1: 'Solar Innovation Tower, Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        postalCode: '201309',
        country: 'India'
      }
    };

    // Active allocations
    const allocations = await PaymentAllocation.find({
      paymentId: payment._id,
      status: PaymentAllocationStatus.ACTIVE
    })
      .populate('salesOrderId', 'orderNumber systemCapacityKwp systemTopology netTotalPaise')
      .sort({ allocationDate: 1 })
      .lean();

    const allocationList = allocations.map(a => {
      const so = a.salesOrderId as any;
      return {
        allocationNumber: a.allocationNumber,
        salesOrderId: so?._id,
        orderNumber: so?.orderNumber || 'N/A',
        systemCapacityKwp: so?.systemCapacityKwp,
        allocatedAmountPaise: a.allocatedAmountPaise,
        formattedAllocatedAmount: formatPaiseToInr(a.allocatedAmountPaise)
      };
    });

    const disclaimer =
      'This document is an operational payment receipt confirming realization of customer funds against solar plant installation milestones. It does not constitute a statutory Tax Invoice under GST law.';

    return {
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.transactionReference,
      amountPaise: payment.amountPaise,
      amountRupees: payment.amountPaise / 100,
      formattedAmount: formatPaiseToInr(payment.amountPaise),
      allocatedAmountPaise: payment.allocatedAmountPaise,
      unallocatedAmountPaise: payment.unallocatedAmountPaise,
      status: payment.status,
      company,
      customer: payment.customerId,
      allocations: allocationList,
      notes: payment.notes,
      internalNotes: userContext.isCustomer ? undefined : payment.internalNotes,
      disclaimer
    };
  }

  /**
   * Lists payments with pagination, bounded filtering, and search.
   */
  public static async getPayments(
    filters: PaymentFilterInput,
    userContext: UserContext
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: any = {};

    if (userContext.isCustomer) {
      query.customerId = userContext.customerId;
    } else if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    if (filters.startDate || filters.endDate) {
      query.paymentDate = {};
      if (filters.startDate) query.paymentDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.paymentDate.$lte = new Date(filters.endDate);
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query.$or = [
        { receiptNumber: { $regex: term, $options: 'i' } },
        { transactionReference: { $regex: term, $options: 'i' } },
        { notes: { $regex: term, $options: 'i' } }
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CustomerPayment.find(query)
        .populate('customerId', 'name customerCode primaryPhone email')
        .populate('recordedBy', 'firstName lastName email')
        .populate('verifiedBy', 'firstName lastName email')
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomerPayment.countDocuments(query)
    ]);

    // Strip internalNotes for customer portal users
    const sanitized = items.map(p => {
      if (userContext.isCustomer) {
        const { internalNotes: _internalNotes, ...safe } = p as any;
        return safe;
      }
      return p;
    });

    return { items: sanitized, total, page, limit };
  }

  /**
   * Retrieves single payment details with populated allocations.
   */
  public static async getPaymentById(id: string, userContext: UserContext): Promise<any> {
    const payment = await CustomerPayment.findById(id)
      .populate('customerId', 'name customerCode primaryPhone email billingAddress')
      .populate('recordedBy', 'firstName lastName email')
      .populate('verifiedBy', 'firstName lastName email')
      .populate('reversedBy', 'firstName lastName email')
      .lean();

    if (!payment) {
      throw AppError.notFound(`Customer payment with ID ${id} not found.`);
    }

    if (userContext.isCustomer) {
      const customerId =
        (payment.customerId as any)?._id?.toString() || payment.customerId?.toString();
      if (customerId !== userContext.customerId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's payment."
        );
      }
      const { internalNotes: _internalNotes, ...safe } = payment as any;
      return safe;
    }

    const allocations = await PaymentAllocation.find({ paymentId: payment._id })
      .populate('salesOrderId', 'orderNumber netTotalPaise systemCapacityKwp status')
      .populate('allocatedBy', 'firstName lastName')
      .sort({ allocationDate: -1 })
      .lean();

    return { ...payment, allocations };
  }
}
