/**
 * INS Solar Business Management Software — Expense Service
 *
 * Implements operational expense management, atomic numbering (EXP-YYYY-NNNNN),
 * anti-self-approval enforcement, company approval threshold checks,
 * payment recording metadata, and cancellation audit history.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  Expense,
  IExpenseDocument,
  Project,
  SalesOrder,
  Vendor,
  CompanySettings
} from '../models/index.js';
import {
  ExpenseStatus,
  ExpensePaymentStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  CreateExpenseInput,
  ApproveExpenseInput,
  RejectExpenseInput,
  PayExpenseInput,
  CancelExpenseInput,
  ExpenseFilterInput
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

export class ExpenseService {
  /**
   * Records a new operational or project expense.
   */
  public static async createExpense(
    input: CreateExpenseInput,
    actor: UserContext
  ): Promise<IExpenseDocument> {
    // 1. Idempotency replay check
    if (input.idempotencyKey?.trim()) {
      const existing = await Expense.findOne({
        idempotencyKey: input.idempotencyKey.trim()
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Validate references
    if (input.projectId?.trim()) {
      const project = await Project.findById(input.projectId);
      if (!project) {
        throw AppError.notFound(`Project with ID ${input.projectId} not found.`);
      }
    }

    if (input.orderId?.trim()) {
      const order = await SalesOrder.findById(input.orderId);
      if (!order) {
        throw AppError.notFound(`Sales order with ID ${input.orderId} not found.`);
      }
    }

    if (input.vendorId?.trim()) {
      const vendor = await Vendor.findById(input.vendorId);
      if (!vendor) {
        throw AppError.notFound(`Vendor with ID ${input.vendorId} not found.`);
      }
    }

    // 3. Generate unique atomic expense number
    const seqResult = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.EXPENSE
    });
    const expenseNumber = seqResult.formattedNumber;

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    // 4. Threshold & Approval rules
    const companySettings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' });
    const thresholdPaise = companySettings?.expenseApprovalThresholdPaise ?? 500000; // default ₹5,000

    const requiresApproval = input.amountPaise > thresholdPaise;
    const initialStatus = requiresApproval
      ? ExpenseStatus.PENDING_APPROVAL
      : ExpenseStatus.APPROVED;

    const taxPaise = input.taxAmountPaise ?? 0;
    const totalAmountPaise = input.amountPaise + taxPaise;

    const initialHistory = [
      {
        fromStatus: 'NONE',
        toStatus: initialStatus,
        changedAt: new Date(),
        changedBy: actorId,
        notes: requiresApproval
          ? `Submitted for approval (amount exceeds ₹${(thresholdPaise / 100).toFixed(2)} threshold)`
          : 'Auto-approved below company approval threshold'
      }
    ];

    const expense = new Expense({
      expenseNumber,
      expenseDate: input.expenseDate || new Date(),
      category: input.category,
      vendorId: input.vendorId ? new mongoose.Types.ObjectId(input.vendorId) : undefined,
      payeeName: input.payeeName?.trim(),
      projectId: input.projectId ? new mongoose.Types.ObjectId(input.projectId) : undefined,
      orderId: input.orderId ? new mongoose.Types.ObjectId(input.orderId) : undefined,
      description: input.description.trim(),
      amountPaise: input.amountPaise,
      taxAmountPaise: taxPaise,
      totalAmountPaise,
      paymentStatus: ExpensePaymentStatus.UNPAID,
      paidAmountPaise: 0,
      evidenceKey: input.evidenceKey?.trim(),
      notes: input.notes?.trim(),
      status: initialStatus,
      requiresApproval,
      submittedBy: actorId,
      approvedBy: requiresApproval ? undefined : actorId,
      approvedAt: requiresApproval ? undefined : new Date(),
      approvalNotes: requiresApproval ? undefined : 'Auto-approved below company approval threshold',
      idempotencyKey: input.idempotencyKey?.trim() || undefined,
      statusHistory: initialHistory
    });

    await expense.save();

    // 5. Audit Logging
    await AuditService.recordEvent({
      action: AuditAction.EXPENSE_CREATED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Expense',
      targetId: expense._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        category: expense.category,
        amountPaise: expense.amountPaise,
        taxAmountPaise: expense.taxAmountPaise,
        totalAmountPaise: expense.totalAmountPaise,
        projectId: expense.projectId?.toString(),
        status: expense.status,
        requiresApproval
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return expense;
  }

  /**
   * Retrieves paginated expenses with bounded filtering.
   */
  public static async getExpenses(filters: ExpenseFilterInput) {
    const query: Record<string, any> = {};

    if (filters.projectId?.trim()) {
      query.projectId = new mongoose.Types.ObjectId(filters.projectId.trim());
    }
    if (filters.orderId?.trim()) {
      query.orderId = new mongoose.Types.ObjectId(filters.orderId.trim());
    }
    if (filters.vendorId?.trim()) {
      query.vendorId = new mongoose.Types.ObjectId(filters.vendorId.trim());
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }
    if (filters.fromDate || filters.toDate) {
      query.expenseDate = {};
      if (filters.fromDate) {
        query.expenseDate.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        query.expenseDate.$lte = new Date(filters.toDate);
      }
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query.$or = [
        { expenseNumber: { $regex: term, $options: 'i' } },
        { payeeName: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } }
      ];
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Expense.find(query)
        .populate('projectId', 'projectCode name')
        .populate('vendorId', 'companyName')
        .populate('submittedBy', 'firstName lastName employeeCode')
        .populate('approvedBy', 'firstName lastName employeeCode')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(query)
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves single expense by ID with populated references.
   */
  public static async getExpenseById(id: string): Promise<IExpenseDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid expense ID format.');
    }

    const expense = await Expense.findById(id)
      .populate('projectId', 'projectCode name systemCapacityKwp currentStage customerId')
      .populate('orderId', 'orderNumber netTotalPaise status')
      .populate('vendorId', 'companyName gstin contactPerson')
      .populate('submittedBy', 'firstName lastName employeeCode email')
      .populate('approvedBy', 'firstName lastName employeeCode email')
      .populate('cancelledBy', 'firstName lastName employeeCode');

    if (!expense) {
      throw AppError.notFound(`Expense with ID ${id} not found.`);
    }

    return expense;
  }

  /**
   * Approves a pending expense with anti-self-approval enforcement.
   */
  public static async approveExpense(
    id: string,
    input: ApproveExpenseInput,
    actor: UserContext
  ): Promise<IExpenseDocument> {
    const expense = await Expense.findById(id);
    if (!expense) {
      throw AppError.notFound(`Expense with ID ${id} not found.`);
    }

    // Anti-self-approval enforcement
    if (actor.userId && expense.submittedBy.toString() === actor.userId.toString()) {
      throw AppError.forbidden(
        'Anti-self-approval violation: An employee cannot approve their own expense submission.'
      );
    }

    if (expense.status !== ExpenseStatus.PENDING_APPROVAL && expense.status !== ExpenseStatus.DRAFT) {
      throw AppError.badRequest(
        `Cannot approve expense in ${expense.status} status. Only PENDING_APPROVAL or DRAFT expenses can be approved.`
      );
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const previousStatus = expense.status;
    expense.status = ExpenseStatus.APPROVED;
    expense.approvedBy = actorId;
    expense.approvedAt = new Date();
    expense.approvalNotes = input.approvalNotes?.trim();

    expense.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: ExpenseStatus.APPROVED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: input.approvalNotes?.trim() || 'Expense approved by manager'
    });

    await expense.save();

    await AuditService.recordEvent({
      action: AuditAction.EXPENSE_APPROVED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Expense',
      targetId: expense._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        previousStatus,
        newStatus: ExpenseStatus.APPROVED,
        approvalNotes: input.approvalNotes
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return expense;
  }

  /**
   * Rejects a pending expense with mandatory reason.
   */
  public static async rejectExpense(
    id: string,
    input: RejectExpenseInput,
    actor: UserContext
  ): Promise<IExpenseDocument> {
    const expense = await Expense.findById(id);
    if (!expense) {
      throw AppError.notFound(`Expense with ID ${id} not found.`);
    }

    if (expense.status === ExpenseStatus.PAID || expense.status === ExpenseStatus.CANCELLED) {
      throw AppError.badRequest(
        `Cannot reject expense in ${expense.status} status.`
      );
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const previousStatus = expense.status;
    expense.status = ExpenseStatus.REJECTED;
    expense.rejectionReason = input.rejectionReason.trim();

    expense.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: ExpenseStatus.REJECTED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: input.rejectionReason.trim()
    });

    await expense.save();

    await AuditService.recordEvent({
      action: AuditAction.EXPENSE_REJECTED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Expense',
      targetId: expense._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        previousStatus,
        newStatus: ExpenseStatus.REJECTED,
        rejectionReason: input.rejectionReason
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return expense;
  }

  /**
   * Records disbursement/payment against an approved expense.
   */
  public static async recordPayment(
    id: string,
    input: PayExpenseInput,
    actor: UserContext
  ): Promise<IExpenseDocument> {
    const expense = await Expense.findById(id);
    if (!expense) {
      throw AppError.notFound(`Expense with ID ${id} not found.`);
    }

    if (
      expense.status !== ExpenseStatus.APPROVED &&
      expense.paymentStatus !== ExpensePaymentStatus.PARTIALLY_PAID
    ) {
      throw AppError.badRequest(
        `Cannot pay expense in '${expense.status}' status. Only APPROVED expenses can be paid.`
      );
    }

    const paymentAmount = input.paidAmountPaise ?? expense.totalAmountPaise;
    const newPaidTotal = expense.paidAmountPaise + paymentAmount;

    if (newPaidTotal > expense.totalAmountPaise) {
      throw AppError.badRequest(
        `Paid amount (₹${(newPaidTotal / 100).toFixed(2)}) cannot exceed total expense amount (₹${(expense.totalAmountPaise / 100).toFixed(2)}).`
      );
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const isFullyPaid = newPaidTotal >= expense.totalAmountPaise;
    const previousStatus = expense.status;
    const newStatus = isFullyPaid ? ExpenseStatus.PAID : ExpenseStatus.APPROVED;
    const newPaymentStatus = isFullyPaid
      ? ExpensePaymentStatus.PAID
      : ExpensePaymentStatus.PARTIALLY_PAID;

    expense.paidAmountPaise = newPaidTotal;
    expense.paymentStatus = newPaymentStatus;
    expense.status = newStatus;
    expense.paymentMode = input.paymentMode;
    expense.paymentReference = input.paymentReference.trim();
    expense.paymentDate = input.paymentDate || new Date();

    expense.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: newStatus,
      changedAt: new Date(),
      changedBy: actorId,
      notes: `Disbursement recorded: ₹${(paymentAmount / 100).toFixed(2)} via ${input.paymentMode} (${input.paymentReference}). Notes: ${input.notes || 'None'}`
    });

    await expense.save();

    await AuditService.recordEvent({
      action: AuditAction.EXPENSE_PAID,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Expense',
      targetId: expense._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        paidAmountPaise: paymentAmount,
        totalPaidPaise: newPaidTotal,
        paymentMode: input.paymentMode,
        paymentReference: input.paymentReference,
        paymentStatus: newPaymentStatus,
        status: newStatus
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return expense;
  }

  /**
   * Cancels an expense with documented reason.
   */
  public static async cancelExpense(
    id: string,
    input: CancelExpenseInput,
    actor: UserContext
  ): Promise<IExpenseDocument> {
    const expense = await Expense.findById(id);
    if (!expense) {
      throw AppError.notFound(`Expense with ID ${id} not found.`);
    }

    if (expense.status === ExpenseStatus.PAID || expense.paymentStatus === ExpensePaymentStatus.PAID) {
      throw AppError.badRequest(
        'Cannot cancel an expense that has already been paid. A payment reversal or credit adjustment is required.'
      );
    }

    if (expense.status === ExpenseStatus.CANCELLED) {
      throw AppError.badRequest('Expense is already cancelled.');
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const previousStatus = expense.status;
    expense.status = ExpenseStatus.CANCELLED;
    expense.cancelledBy = actorId;
    expense.cancelledAt = new Date();
    expense.cancellationReason = input.cancellationReason.trim();

    expense.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: ExpenseStatus.CANCELLED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: `Expense cancelled: ${input.cancellationReason.trim()}`
    });

    await expense.save();

    await AuditService.recordEvent({
      action: AuditAction.EXPENSE_CANCELLED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Expense',
      targetId: expense._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        previousStatus,
        newStatus: ExpenseStatus.CANCELLED,
        cancellationReason: input.cancellationReason
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return expense;
  }
}
