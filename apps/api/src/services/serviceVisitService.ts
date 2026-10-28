/**
 * INS Solar Business Management Software — Service Visit Service
 *
 * Implements physical technician dispatch scheduling, execution checklists,
 * field observations, spare parts consumption recording, revisit tracking,
 * and seamless AMC visit counter integration.
 */

import mongoose from 'mongoose';
import {
  ServiceVisit,
  IServiceVisitDocument,
  IVisitChecklistItem,
  IVisitPartUsed,
  ServiceComplaint,
  AnnualMaintenanceContract,
  Customer,
  Project,
  User
} from '../models/index.js';
import {
  ServiceVisitType,
  ServiceVisitStatus,
  ComplaintStatus,
  AmcStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { NotificationReminderService } from './notificationReminderService.js';
import { AmcService } from './amcService.js';
import { AppError } from '../errors/AppError.js';
import { UserContext } from './serviceComplaintService.js';

export interface ScheduleVisitInput {
  visitType: ServiceVisitType;
  complaintId?: string;
  amcId?: string;
  projectId: string;
  customerId?: string;
  assignedTechnicianId: string;
  scheduledDate: Date;
  scheduledTimeSlot?: string;
  purpose: string;
  checklist?: IVisitChecklistItem[];
  technicianNotes?: string;
  revisitRequired?: boolean;
  parentVisitId?: string;
}

export interface UpdateVisitInput {
  assignedTechnicianId?: string;
  scheduledDate?: Date;
  scheduledTimeSlot?: string;
  purpose?: string;
  checklist?: IVisitChecklistItem[];
  technicianNotes?: string;
}

export interface CompleteVisitInput {
  workPerformed: string;
  observations?: string;
  meterReadingKwh?: number;
  instantaneousKw?: number;
  soilingCondition?: 'CLEAN' | 'MODERATE' | 'HEAVY';
  inverterStatus?: 'NORMAL' | 'FAULT' | 'OFFLINE';
  checklist?: IVisitChecklistItem[];
  partsRequiredOrUsed?: IVisitPartUsed[];
  customerFeedback?: string;
  revisitRequired?: boolean;
  technicianNotes?: string;
}

export interface VisitFilterQuery {
  customerId?: string;
  projectId?: string;
  complaintId?: string;
  amcId?: string;
  assignedTechnicianId?: string;
  status?: ServiceVisitStatus;
  visitType?: ServiceVisitType;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export class ServiceVisitService {
  /**
   * Schedules a new technician field visit.
   */
  public static async scheduleVisit(
    input: ScheduleVisitInput,
    actor: UserContext
  ): Promise<IServiceVisitDocument> {
    // 1. Verify Project
    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${input.projectId} not found.`);
    }

    // 2. Resolve Customer
    const customerId = input.customerId || project.customerId.toString();
    if (project.customerId.toString() !== customerId) {
      throw AppError.badRequest('Project customer does not match provided customer ID.');
    }

    // 3. Verify Technician
    const tech = await User.findById(input.assignedTechnicianId);
    if (!tech || !tech.isActive) {
      throw AppError.badRequest('Assigned service technician does not exist or is inactive.');
    }

    // 4. Validate Complaint reference if present
    let complaintDoc: any = null;
    if (input.complaintId) {
      complaintDoc = await ServiceComplaint.findById(input.complaintId);
      if (!complaintDoc) {
        throw AppError.notFound(`Linked Service Complaint ${input.complaintId} not found.`);
      }
      if (complaintDoc.projectId.toString() !== project._id.toString()) {
        throw AppError.badRequest('Linked complaint does not belong to the specified project.');
      }
    }

    // 5. Validate AMC reference if present
    let amcDoc: any = null;
    if (input.amcId) {
      amcDoc = await AnnualMaintenanceContract.findById(input.amcId);
      if (!amcDoc) {
        throw AppError.notFound(`Linked AMC Contract ${input.amcId} not found.`);
      }
      if (amcDoc.projectId.toString() !== project._id.toString()) {
        throw AppError.badRequest('Linked AMC contract does not belong to the specified project.');
      }
      if (amcDoc.status !== AmcStatus.ACTIVE) {
        throw AppError.badRequest(
          `Linked AMC contract is in '${amcDoc.status}' status (must be ACTIVE).`
        );
      }
    }

    // 6. Generate atomic visit number (VIS-YYYY-XXXXX)
    const seq = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.SERVICE_VISIT,
      customPrefix: 'VIS'
    });

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    const defaultChecklist: IVisitChecklistItem[] =
      input.checklist && input.checklist.length > 0
        ? input.checklist
        : [
            {
              item: 'Inspect solar PV modules for soiling, hotspots & frame damage',
              status: 'NOT_APPLICABLE'
            },
            {
              item: 'Inspect inverter DC/AC connections, heatsink & error logs',
              status: 'NOT_APPLICABLE'
            },
            {
              item: 'Check ACDB / DCDB surge protectors and isolator switches',
              status: 'NOT_APPLICABLE'
            },
            {
              item: 'Verify earthing pit resistance and lightning arrester',
              status: 'NOT_APPLICABLE'
            },
            {
              item: 'Record instantaneous kW generation and cumulative kWh meter reading',
              status: 'NOT_APPLICABLE'
            }
          ];

    const visit = new ServiceVisit({
      visitNumber: seq.formattedNumber,
      visitType: input.visitType,
      complaintId: input.complaintId ? new mongoose.Types.ObjectId(input.complaintId) : undefined,
      amcId: input.amcId ? new mongoose.Types.ObjectId(input.amcId) : undefined,
      projectId: project._id,
      customerId: new mongoose.Types.ObjectId(customerId),
      assignedTechnicianId: tech._id,
      scheduledDate: input.scheduledDate,
      scheduledTimeSlot: input.scheduledTimeSlot || '10:00 - 13:00',
      status: ServiceVisitStatus.SCHEDULED,
      purpose: input.purpose.trim(),
      checklist: defaultChecklist,
      partsRequiredOrUsed: [],
      technicianNotes: input.technicianNotes?.trim(),
      evidencePhotos: [],
      revisitRequired: Boolean(input.revisitRequired),
      parentVisitId: input.parentVisitId
        ? new mongoose.Types.ObjectId(input.parentVisitId)
        : undefined,
      isAmcIncluded: Boolean(input.amcId),
      isChargeable: false,
      statusHistory: [
        {
          status: ServiceVisitStatus.SCHEDULED,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: `Visit scheduled for ${new Date(input.scheduledDate).toISOString().split('T')[0]} assigned to ${tech.firstName} ${tech.lastName}.`
        }
      ],
      createdBy: new mongoose.Types.ObjectId(actorId)
    });
    await visit.save();

    // If scheduled as follow-up to a parent visit, link it back
    if (input.parentVisitId) {
      const parentVisit = await ServiceVisit.findById(input.parentVisitId);
      if (parentVisit) {
        parentVisit.followUpVisitId = visit._id;
        parentVisit.revisitRequired = true;
        await parentVisit.save();
      }
    }

    // If linked to complaint, link and update status
    if (complaintDoc) {
      complaintDoc.linkedVisitIds.push(visit._id);
      if (
        complaintDoc.status === ComplaintStatus.OPEN ||
        complaintDoc.status === ComplaintStatus.TRIAGED ||
        complaintDoc.status === ComplaintStatus.ASSIGNED
      ) {
        complaintDoc.status = ComplaintStatus.VISIT_SCHEDULED;
        complaintDoc.statusHistory.push({
          status: ComplaintStatus.VISIT_SCHEDULED,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: `Service visit ${visit.visitNumber} scheduled.`
        });
      }
      await complaintDoc.save();
    }

    // Schedule notification reminder
    const customer = await Customer.findById(customerId);
    if (customer) {
      await NotificationReminderService.scheduleOrSendReminder({
        reminderType: 'UPCOMING_SERVICE_VISIT',
        entityType: 'ServiceVisit',
        entityId: visit._id.toString(),
        recipientName: customer.name,
        recipientEmail: customer.email,
        recipientPhone: customer.primaryPhone,
        subject: `Upcoming Service Visit: ${visit.visitNumber}`,
        message: `INS Solar technician ${tech.firstName} ${tech.lastName} is scheduled to visit on ${new Date(input.scheduledDate).toISOString().split('T')[0]} (${visit.scheduledTimeSlot}).`,
        scheduledFor: input.scheduledDate,
        metadata: { visitNumber: visit.visitNumber, purpose: visit.purpose }
      });
    }

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SERVICE_VISIT_SCHEDULED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `visit-schedule-${visit._id.toString()}`,
      targetEntity: 'ServiceVisit',
      targetId: visit._id.toString(),
      details: {
        visitNumber: visit.visitNumber,
        visitType: visit.visitType,
        assignedTechnicianId: tech._id.toString(),
        scheduledDate: visit.scheduledDate
      }
    });

    return visit;
  }

  /**
   * Retrieves visits with filtering, search, pagination, and customer isolation.
   */
  public static async getVisits(
    filters: VisitFilterQuery,
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
    if (filters.complaintId) {
      query.complaintId = new mongoose.Types.ObjectId(filters.complaintId);
    }
    if (filters.amcId) {
      query.amcId = new mongoose.Types.ObjectId(filters.amcId);
    }
    if (filters.assignedTechnicianId) {
      query.assignedTechnicianId = new mongoose.Types.ObjectId(filters.assignedTechnicianId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.visitType) {
      query.visitType = filters.visitType;
    }
    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) query.scheduledDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.scheduledDate.$lte = new Date(filters.endDate);
    }
    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { visitNumber: searchRegex },
        { purpose: searchRegex },
        { workPerformed: searchRegex }
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ServiceVisit.find(query)
        .populate('customerId', 'name primaryPhone email')
        .populate('projectId', 'projectCode name currentStage')
        .populate('assignedTechnicianId', 'firstName lastName email phone employeeCode')
        .populate('complaintId', 'complaintNumber title status')
        .populate('amcId', 'amcNumber planType')
        .sort({ scheduledDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ServiceVisit.countDocuments(query)
    ]);

    // Strip internal technician notes for customer portal
    const sanitized = items.map(v => {
      if (userContext.isCustomer) {
        const { technicianNotes: _technicianNotes, ...safe } = v as any;
        return safe;
      }
      return v;
    });

    return { items: sanitized, total, page, limit };
  }

  /**
   * Retrieves single visit by ID with customer boundary check.
   */
  public static async getVisitById(id: string, userContext: UserContext): Promise<any> {
    const visit = await ServiceVisit.findById(id)
      .populate('customerId', 'name primaryPhone email billingAddress')
      .populate('projectId', 'projectCode name systemCapacityKwp currentStage siteAddress')
      .populate('assignedTechnicianId', 'firstName lastName email phone employeeCode')
      .populate('complaintId', 'complaintNumber title description status category priority')
      .populate('amcId', 'amcNumber planType includedVisits consumedVisits')
      .populate('completedBy', 'firstName lastName email')
      .populate('followUpVisitId', 'visitNumber scheduledDate status')
      .lean();

    if (!visit) {
      throw AppError.notFound(`Service visit ${id} not found.`);
    }

    if (userContext.isCustomer) {
      const custId = (visit.customerId as any)?._id?.toString() || visit.customerId?.toString();
      if (custId !== userContext.customerId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's service visit."
        );
      }
      const { technicianNotes: _technicianNotes, ...safe } = visit as any;
      return safe;
    }

    return visit;
  }

  /**
   * Reschedules a visit.
   */
  public static async rescheduleVisit(
    id: string,
    newDate: Date,
    newTimeSlot: string | undefined,
    reason: string,
    actor: UserContext
  ): Promise<IServiceVisitDocument> {
    const visit = await ServiceVisit.findById(id);
    if (!visit) {
      throw AppError.notFound(`Service visit ${id} not found.`);
    }

    if (
      visit.status === ServiceVisitStatus.COMPLETED ||
      visit.status === ServiceVisitStatus.CANCELLED
    ) {
      throw AppError.badRequest(`Cannot reschedule visit in '${visit.status}' status.`);
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    visit.scheduledDate = newDate;
    if (newTimeSlot) visit.scheduledTimeSlot = newTimeSlot;
    visit.rescheduleReason = reason.trim();
    visit.status = ServiceVisitStatus.RESCHEDULED;

    visit.statusHistory.push({
      status: ServiceVisitStatus.RESCHEDULED,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      reason: reason.trim(),
      notes: `Rescheduled to ${new Date(newDate).toISOString().split('T')[0]} (${visit.scheduledTimeSlot}).`
    });

    await visit.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SERVICE_VISIT_RESCHEDULED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `visit-reschedule-${visit._id.toString()}`,
      targetEntity: 'ServiceVisit',
      targetId: visit._id.toString(),
      details: {
        visitNumber: visit.visitNumber,
        newDate,
        reason: reason.trim()
      }
    });

    return visit;
  }

  /**
   * Cancels a visit.
   */
  public static async cancelVisit(
    id: string,
    reason: string,
    actor: UserContext
  ): Promise<IServiceVisitDocument> {
    const visit = await ServiceVisit.findById(id);
    if (!visit) {
      throw AppError.notFound(`Service visit ${id} not found.`);
    }

    if (visit.status === ServiceVisitStatus.COMPLETED) {
      throw AppError.badRequest('Cannot cancel a completed service visit.');
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Staff';

    visit.status = ServiceVisitStatus.CANCELLED;
    visit.cancellationReason = reason.trim();

    visit.statusHistory.push({
      status: ServiceVisitStatus.CANCELLED,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      reason: reason.trim(),
      notes: 'Service visit cancelled.'
    });

    await visit.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SERVICE_VISIT_CANCELLED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `visit-cancel-${visit._id.toString()}`,
      targetEntity: 'ServiceVisit',
      targetId: visit._id.toString(),
      details: {
        visitNumber: visit.visitNumber,
        reason: reason.trim()
      }
    });

    return visit;
  }

  /**
   * Completes a visit: logs work done, readings, parts, updates AMC counters atomically.
   */
  public static async completeVisit(
    id: string,
    input: CompleteVisitInput,
    actor: UserContext
  ): Promise<IServiceVisitDocument> {
    const visit = await ServiceVisit.findById(id);
    if (!visit) {
      throw AppError.notFound(`Service visit ${id} not found.`);
    }

    if (visit.status === ServiceVisitStatus.COMPLETED) {
      throw AppError.badRequest(`Service visit ${visit.visitNumber} has already been completed.`);
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Technician';

    // 1. If visit is linked to an AMC, atomically consume a visit!
    if (visit.amcId) {
      const consumption = await AmcService.consumeVisit(visit.amcId.toString(), actor);
      visit.isAmcIncluded = !consumption.isChargeable;
      visit.isChargeable = consumption.isChargeable;
    }

    // 2. Update completion details
    visit.workPerformed = input.workPerformed.trim();
    if (input.observations) visit.observations = input.observations.trim();
    if (input.meterReadingKwh !== undefined) visit.meterReadingKwh = input.meterReadingKwh;
    if (input.instantaneousKw !== undefined) visit.instantaneousKw = input.instantaneousKw;
    if (input.soilingCondition) visit.soilingCondition = input.soilingCondition;
    if (input.inverterStatus) visit.inverterStatus = input.inverterStatus;
    if (input.checklist && input.checklist.length > 0) visit.checklist = input.checklist;
    if (input.partsRequiredOrUsed && input.partsRequiredOrUsed.length > 0) {
      visit.partsRequiredOrUsed = input.partsRequiredOrUsed;
    }
    if (input.customerFeedback) visit.customerFeedback = input.customerFeedback.trim();
    if (input.technicianNotes) visit.technicianNotes = input.technicianNotes.trim();
    visit.revisitRequired = Boolean(input.revisitRequired);

    visit.status = ServiceVisitStatus.COMPLETED;
    visit.completedAt = new Date();
    visit.completedBy = actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined;

    visit.statusHistory.push({
      status: ServiceVisitStatus.COMPLETED,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: 'Field execution verified and visit completed.'
    });

    await visit.save();

    // 3. If linked to complaint and revisit is not required, update complaint progress
    if (visit.complaintId && !visit.revisitRequired) {
      const complaint = await ServiceComplaint.findById(visit.complaintId);
      if (complaint && complaint.status === ComplaintStatus.VISIT_SCHEDULED) {
        complaint.status = ComplaintStatus.IN_PROGRESS;
        complaint.statusHistory.push({
          status: ComplaintStatus.IN_PROGRESS,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: `Site visit ${visit.visitNumber} completed. Investigation work in progress.`
        });
        await complaint.save();
      }
    }

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SERVICE_VISIT_COMPLETED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `visit-complete-${visit._id.toString()}`,
      targetEntity: 'ServiceVisit',
      targetId: visit._id.toString(),
      details: {
        visitNumber: visit.visitNumber,
        revisitRequired: visit.revisitRequired,
        isChargeable: visit.isChargeable
      }
    });

    return visit;
  }

  /**
   * Scans for overdue service visits and dispatches alerts.
   */
  public static async checkOverdueVisits(): Promise<number> {
    const now = new Date();
    const overdue = await ServiceVisit.find({
      status: ServiceVisitStatus.SCHEDULED,
      scheduledDate: { $lt: now }
    }).populate('assignedTechnicianId', 'firstName lastName email phone');

    let count = 0;
    for (const v of overdue) {
      const tech = v.assignedTechnicianId as any;
      await NotificationReminderService.scheduleOrSendReminder({
        reminderType: 'OVERDUE_SERVICE_VISIT',
        entityType: 'ServiceVisit',
        entityId: v._id.toString(),
        recipientName: tech ? `${tech.firstName} ${tech.lastName}` : 'Lead Technician',
        recipientEmail: tech?.email,
        recipientPhone: tech?.phone,
        subject: `OVERDUE Service Visit: ${v.visitNumber}`,
        message: `Service visit ${v.visitNumber} scheduled for ${v.scheduledDate.toISOString().split('T')[0]} has passed its scheduled date without completion.`,
        scheduledFor: now,
        metadata: { visitNumber: v.visitNumber, scheduledDate: v.scheduledDate }
      });
      count++;
    }

    return count;
  }
}
