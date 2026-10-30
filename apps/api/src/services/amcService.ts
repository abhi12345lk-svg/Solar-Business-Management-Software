/**
 * INS Solar Business Management Software — Annual Maintenance Contract (AMC) Service
 *
 * Implements recurring contract onboarding, approval workflows, atomic visit consumption,
 * over-consumption prevention, renewal chaining, and proactive expiry alerts.
 */

import mongoose from 'mongoose';
import {
  AnnualMaintenanceContract,
  IAnnualMaintenanceContractDocument,
  IAmcCoveredEquipment,
  Project,
  User
} from '../models/index.js';
import {
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  AmcBillingCadence,
  AmcPaymentStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { NotificationReminderService } from './notificationReminderService.js';
import { AppError } from '../errors/AppError.js';
import { UserContext } from './serviceComplaintService.js';

export interface CreateAmcInput {
  customerId: string;
  projectId: string;
  planType?: AmcPlanType;
  capacityKwp: number;
  startDate: Date;
  endDate: Date;
  contractAmountPaise: number;
  billingCadence?: AmcBillingCadence;
  visitCadence?: AmcVisitCadence;
  includedVisits?: number;
  scopeOfWork?: string;
  exclusions?: string;
  slaCommitments?: string;
  coveredEquipment?: IAmcCoveredEquipment[];
  notes?: string;
}

export interface UpdateAmcInput {
  planType?: AmcPlanType;
  capacityKwp?: number;
  contractAmountPaise?: number;
  billingCadence?: AmcBillingCadence;
  visitCadence?: AmcVisitCadence;
  includedVisits?: number;
  scopeOfWork?: string;
  exclusions?: string;
  slaCommitments?: string;
  paymentStatus?: AmcPaymentStatus;
  notes?: string;
}

export interface RenewAmcInput {
  startDate: Date;
  endDate: Date;
  contractAmountPaise: number;
  includedVisits?: number;
  billingCadence?: AmcBillingCadence;
  visitCadence?: AmcVisitCadence;
  notes?: string;
}

export interface AmcFilterQuery {
  customerId?: string;
  projectId?: string;
  status?: AmcStatus;
  planType?: AmcPlanType;
  expiringInDays?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class AmcService {
  /**
   * Valid status transition map.
   */
  private static readonly VALID_TRANSITIONS: Record<AmcStatus, AmcStatus[]> = {
    [AmcStatus.DRAFT]: [AmcStatus.PENDING_APPROVAL, AmcStatus.ACTIVE, AmcStatus.CANCELLED],
    [AmcStatus.PENDING_APPROVAL]: [AmcStatus.ACTIVE, AmcStatus.DRAFT, AmcStatus.CANCELLED],
    [AmcStatus.ACTIVE]: [
      AmcStatus.ON_HOLD,
      AmcStatus.EXPIRED,
      AmcStatus.CANCELLED,
      AmcStatus.RENEWED
    ],
    [AmcStatus.ON_HOLD]: [AmcStatus.ACTIVE, AmcStatus.CANCELLED],
    [AmcStatus.EXPIRED]: [AmcStatus.RENEWED, AmcStatus.CANCELLED],
    [AmcStatus.CANCELLED]: [AmcStatus.DRAFT],
    [AmcStatus.RENEWED]: []
  };

  /**
   * Creates a new AMC contract proposal in DRAFT status.
   */
  public static async createAmc(
    input: CreateAmcInput,
    actor: UserContext
  ): Promise<IAnnualMaintenanceContractDocument> {
    // 1. Verify Project
    let project: any = null;
    const cleanProjId = input.projectId.trim();
    if (mongoose.Types.ObjectId.isValid(cleanProjId)) {
      project = await Project.findById(cleanProjId);
    }
    if (!project) {
      project = await Project.findOne({ projectCode: cleanProjId.toUpperCase() });
    }
    if (!project) {
      throw AppError.notFound(`Project '${cleanProjId}' not found.`);
    }

    // 2. Verify Customer
    const customerId = input.customerId || project.customerId.toString();
    if (project.customerId.toString() !== customerId) {
      throw AppError.badRequest('Project customer does not match the provided customer ID.');
    }

    // 3. Date range validation
    if (new Date(input.startDate) >= new Date(input.endDate)) {
      throw AppError.badRequest('Contract start date must be strictly before contract end date.');
    }

    // 4. Exclusivity check: prevent overlapping active AMC on same project
    const overlappingActive = await AnnualMaintenanceContract.findOne({
      projectId: project._id,
      status: AmcStatus.ACTIVE,
      startDate: { $lte: new Date(input.endDate) },
      endDate: { $gte: new Date(input.startDate) }
    });
    if (overlappingActive) {
      throw AppError.badRequest(
        `An active AMC contract (${overlappingActive.amcNumber}) already covers this project for the requested date window.`
      );
    }

    // 5. Generate atomic AMC number (AMC-YYYY-XXXXX)
    const seq = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      customPrefix: 'AMC'
    });

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    const amc = new AnnualMaintenanceContract({
      amcNumber: seq.formattedNumber,
      customerId: project.customerId,
      projectId: project._id,
      planType: input.planType || AmcPlanType.COMPREHENSIVE,
      capacityKwp: input.capacityKwp,
      startDate: input.startDate,
      endDate: input.endDate,
      contractAmountPaise: input.contractAmountPaise,
      billingCadence: input.billingCadence || AmcBillingCadence.ANNUAL,
      paymentStatus: AmcPaymentStatus.PENDING,
      visitCadence: input.visitCadence || AmcVisitCadence.QUARTERLY,
      includedVisits: input.includedVisits || 4,
      consumedVisits: 0,
      chargeableVisits: 0,
      coveredEquipment: input.coveredEquipment || [],
      scopeOfWork: input.scopeOfWork?.trim(),
      exclusions: input.exclusions?.trim(),
      slaCommitments: input.slaCommitments?.trim(),
      status: AmcStatus.DRAFT,
      notes: input.notes?.trim(),
      statusHistory: [
        {
          status: AmcStatus.DRAFT,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: 'Contract proposal created in draft.'
        }
      ],
      createdBy: new mongoose.Types.ObjectId(actorId)
    });
    await amc.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_CREATED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `amc-create-${amc._id.toString()}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: amc._id.toString(),
      details: {
        amcNumber: amc.amcNumber,
        projectId: amc.projectId.toString(),
        contractAmountPaise: amc.contractAmountPaise,
        includedVisits: amc.includedVisits
      }
    });

    return amc;
  }

  /**
   * Retrieves AMCs with customer portal isolation.
   */
  public static async getAmcs(
    filters: AmcFilterQuery,
    userContext: UserContext
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, any> = {};

    if (userContext.isCustomer) {
      query.customerId = new mongoose.Types.ObjectId(userContext.customerId);
    } else if (filters.customerId) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (filters.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filters.projectId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.planType) {
      query.planType = filters.planType;
    }
    if (filters.expiringInDays) {
      const now = new Date();
      const future = new Date(now.getTime() + filters.expiringInDays * 24 * 60 * 60 * 1000);
      query.endDate = { $gte: now, $lte: future };
    }
    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { amcNumber: searchRegex },
        { scopeOfWork: searchRegex },
        { notes: searchRegex }
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AnnualMaintenanceContract.find(query)
        .populate('customerId', 'name primaryPhone email')
        .populate('projectId', 'projectCode name currentStage')
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AnnualMaintenanceContract.countDocuments(query)
    ]);

    return { items, total, page, limit };
  }

  /**
   * Retrieves single AMC contract by ID.
   */
  public static async getAmcById(id: string, userContext: UserContext): Promise<any> {
    const amc = await AnnualMaintenanceContract.findById(id)
      .populate('customerId', 'name primaryPhone email billingAddress')
      .populate('projectId', 'projectCode name systemCapacityKwp currentStage')
      .populate('approvedBy', 'firstName lastName email')
      .populate('previousAmcId', 'amcNumber startDate endDate')
      .populate('successorAmcId', 'amcNumber startDate endDate')
      .lean();

    if (!amc) {
      throw AppError.notFound(`AMC Contract ${id} not found.`);
    }

    if (userContext.isCustomer) {
      const custId = (amc.customerId as any)?._id?.toString() || amc.customerId?.toString();
      if (custId !== userContext.customerId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's AMC contract."
        );
      }
    }

    return amc;
  }

  /**
   * Approves and activates an AMC contract.
   */
  public static async approveAmc(
    id: string,
    notesOrActor?: string | UserContext,
    maybeActor?: UserContext
  ): Promise<IAnnualMaintenanceContractDocument> {
    const notes = typeof notesOrActor === 'string' ? notesOrActor : undefined;
    const actor: UserContext =
      (typeof notesOrActor === 'object' && notesOrActor !== null ? notesOrActor : maybeActor) || {};

    const amc = await AnnualMaintenanceContract.findById(id);
    if (!amc) {
      throw AppError.notFound(`AMC Contract ${id} not found.`);
    }

    if (amc.status !== AmcStatus.DRAFT && amc.status !== AmcStatus.PENDING_APPROVAL) {
      throw AppError.badRequest(
        `Cannot approve contract in '${amc.status}' status. Only DRAFT or PENDING_APPROVAL contracts can be approved.`
      );
    }

    // Check again for overlapping active AMC on same project
    const overlappingActive = await AnnualMaintenanceContract.findOne({
      _id: { $ne: amc._id },
      projectId: amc.projectId,
      status: AmcStatus.ACTIVE,
      startDate: { $lte: amc.endDate },
      endDate: { $gte: amc.startDate }
    });
    if (overlappingActive) {
      throw AppError.badRequest(
        `Another contract (${overlappingActive.amcNumber}) is currently ACTIVE for this project during the same period.`
      );
    }

    const actorId = actor.userId || 'system';
    const actorObjId = mongoose.Types.ObjectId.isValid(actorId)
      ? new mongoose.Types.ObjectId(actorId)
      : new mongoose.Types.ObjectId();
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Approver';

    amc.status = AmcStatus.ACTIVE;
    amc.approvedBy =
      actor.userId && mongoose.Types.ObjectId.isValid(actor.userId)
        ? new mongoose.Types.ObjectId(actor.userId)
        : undefined;
    amc.approvedAt = new Date();

    amc.statusHistory.push({
      status: AmcStatus.ACTIVE,
      transitionedAt: new Date(),
      transitionedBy: actorObjId,
      transitionedByName: actorName,
      notes: notes || 'Contract approved and activated.'
    });

    await amc.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_APPROVED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `amc-approve-${amc._id.toString()}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: amc._id.toString(),
      details: {
        amcNumber: amc.amcNumber,
        status: amc.status
      }
    });

    return amc;
  }

  /**
   * Updates contract status with lifecycle transition validation.
   */
  public static async updateStatus(
    id: string,
    targetStatus: AmcStatus,
    reason: string | undefined,
    notes: string | undefined,
    actor: UserContext
  ): Promise<IAnnualMaintenanceContractDocument> {
    const amc = await AnnualMaintenanceContract.findById(id);
    if (!amc) {
      throw AppError.notFound(`AMC Contract ${id} not found.`);
    }

    const currentStatus = amc.status;
    const allowed = this.VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Permitted transitions: ${allowed.join(', ') || 'None'}`
      );
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    amc.status = targetStatus;
    if (targetStatus === AmcStatus.CANCELLED && reason?.trim()) {
      amc.cancellationReason = reason.trim();
    }

    amc.statusHistory.push({
      status: targetStatus,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: notes?.trim(),
      reason: reason?.trim()
    });

    await amc.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `amc-status-${amc._id.toString()}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: amc._id.toString(),
      details: {
        amcNumber: amc.amcNumber,
        from: currentStatus,
        to: targetStatus
      }
    });

    return amc;
  }

  /**
   * Concurrency-safe atomic visit consumption.
   * Increments consumedVisits if within includedVisits limit; otherwise increments chargeableVisits.
   */
  public static async consumeVisit(
    amcId: string,
    actor?: UserContext
  ): Promise<{ isChargeable: boolean; consumedVisits: number; chargeableVisits: number }> {
    const amc = await AnnualMaintenanceContract.findById(amcId);
    if (!amc) {
      throw AppError.notFound(`AMC Contract ${amcId} not found.`);
    }

    if (amc.status !== AmcStatus.ACTIVE) {
      throw AppError.badRequest(
        `Cannot consume visit against AMC in '${amc.status}' status. Contract must be ACTIVE.`
      );
    }

    // Atomic conditional increment where consumedVisits < includedVisits
    const updatedIncluded = await AnnualMaintenanceContract.findOneAndUpdate(
      {
        _id: amc._id,
        status: AmcStatus.ACTIVE,
        $expr: { $lt: ['$consumedVisits', '$includedVisits'] }
      },
      {
        $inc: { consumedVisits: 1 }
      },
      { new: true }
    );

    let isChargeable = false;
    let finalConsumed = amc.consumedVisits;
    let finalChargeable = amc.chargeableVisits;

    if (updatedIncluded) {
      finalConsumed = updatedIncluded.consumedVisits;
      finalChargeable = updatedIncluded.chargeableVisits;
      isChargeable = false;
    } else {
      // Over included visits quota: atomically increment chargeableVisits
      const updatedChargeable = await AnnualMaintenanceContract.findOneAndUpdate(
        {
          _id: amc._id,
          status: AmcStatus.ACTIVE
        },
        {
          $inc: { chargeableVisits: 1 }
        },
        { new: true }
      );

      if (!updatedChargeable) {
        throw AppError.badRequest('Failed to record AMC visit consumption.');
      }

      finalConsumed = updatedChargeable.consumedVisits;
      finalChargeable = updatedChargeable.chargeableVisits;
      isChargeable = true;
    }

    await AuditService.recordEvent({
      actorId: actor?.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_VISIT_CONSUMED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `amc-consume-${amc._id.toString()}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: amc._id.toString(),
      details: {
        amcNumber: amc.amcNumber,
        isChargeable,
        consumedVisits: finalConsumed,
        chargeableVisits: finalChargeable
      }
    });

    return {
      isChargeable,
      consumedVisits: finalConsumed,
      chargeableVisits: finalChargeable
    };
  }

  /**
   * Renews an existing contract by creating a linked successor contract.
   */
  public static async renewAmc(
    amcId: string,
    input: RenewAmcInput,
    actor: UserContext
  ): Promise<IAnnualMaintenanceContractDocument> {
    const oldAmc = await AnnualMaintenanceContract.findById(amcId);
    if (!oldAmc) {
      throw AppError.notFound(`AMC Contract ${amcId} not found.`);
    }

    if (oldAmc.status === AmcStatus.RENEWED) {
      throw AppError.badRequest(`Contract ${oldAmc.amcNumber} has already been renewed.`);
    }

    if (new Date(input.startDate) >= new Date(input.endDate)) {
      throw AppError.badRequest('Renewal start date must be strictly before renewal end date.');
    }

    // Generate successor AMC number
    const seq = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      customPrefix: 'AMC'
    });

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    // Create successor AMC
    const newAmc = new AnnualMaintenanceContract({
      amcNumber: seq.formattedNumber,
      customerId: oldAmc.customerId,
      projectId: oldAmc.projectId,
      planType: oldAmc.planType,
      capacityKwp: oldAmc.capacityKwp,
      startDate: input.startDate,
      endDate: input.endDate,
      contractAmountPaise: input.contractAmountPaise,
      billingCadence: input.billingCadence || oldAmc.billingCadence,
      paymentStatus: AmcPaymentStatus.PENDING,
      visitCadence: input.visitCadence || oldAmc.visitCadence,
      includedVisits: input.includedVisits || oldAmc.includedVisits,
      consumedVisits: 0,
      chargeableVisits: 0,
      coveredEquipment: oldAmc.coveredEquipment,
      scopeOfWork: oldAmc.scopeOfWork,
      exclusions: oldAmc.exclusions,
      slaCommitments: oldAmc.slaCommitments,
      status: AmcStatus.DRAFT,
      previousAmcId: oldAmc._id,
      notes: input.notes?.trim() || `Renewal successor of ${oldAmc.amcNumber}`,
      statusHistory: [
        {
          status: AmcStatus.DRAFT,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: `Successor contract created renewing ${oldAmc.amcNumber}.`
        }
      ],
      createdBy: new mongoose.Types.ObjectId(actorId)
    });
    await newAmc.save();

    // Mark previous AMC as RENEWED and link successor
    oldAmc.status = AmcStatus.RENEWED;
    oldAmc.successorAmcId = newAmc._id;
    oldAmc.statusHistory.push({
      status: AmcStatus.RENEWED,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: `Contract renewed. Successor contract ID: ${newAmc.amcNumber}.`
    });
    await oldAmc.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_RENEWED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `amc-renew-${newAmc._id.toString()}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: newAmc._id.toString(),
      details: {
        oldAmcNumber: oldAmc.amcNumber,
        newAmcNumber: newAmc.amcNumber
      }
    });

    return newAmc;
  }

  /**
   * Scans active AMCs expiring within N days and dispatches renewal notifications.
   */
  public static async checkExpiringAmcs(withinDays: number = 30): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const expiring = await AnnualMaintenanceContract.find({
      status: AmcStatus.ACTIVE,
      endDate: { $gte: now, $lte: horizon }
    }).populate('customerId', 'name primaryPhone email');

    let count = 0;
    for (const amc of expiring) {
      const cust = amc.customerId as any;
      await NotificationReminderService.scheduleOrSendReminder({
        reminderType: 'AMC_RENEWAL',
        entityType: 'AnnualMaintenanceContract',
        entityId: amc._id.toString(),
        recipientName: cust?.name,
        recipientEmail: cust?.email,
        recipientPhone: cust?.primaryPhone,
        subject: `AMC Contract Expiring Soon: ${amc.amcNumber}`,
        message: `Maintenance Contract ${amc.amcNumber} expires on ${amc.endDate.toISOString().split('T')[0]}. Contact customer for renewal terms.`,
        scheduledFor: amc.endDate,
        metadata: { amcNumber: amc.amcNumber, capacityKwp: amc.capacityKwp, withinDays }
      });
      amc.renewalNoticeSentAt = now;
      await amc.save();
      count++;
    }

    return count;
  }
}
