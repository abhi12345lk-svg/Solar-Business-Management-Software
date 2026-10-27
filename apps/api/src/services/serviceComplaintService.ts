/**
 * INS Solar Business Management Software — Service Complaint Service
 *
 * Implements ticket creation, atomic sequence numbering, RBAC validation,
 * state machine transitions, technician dispatch, and resolution lifecycles.
 */

import mongoose from 'mongoose';
import {
  ServiceComplaint,
  IServiceComplaintDocument,
  IComplaintNote,
  Project,
  ProductSerialNumber,
  AnnualMaintenanceContract,
  User
} from '../models/index.js';
import {
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintSource,
  ProjectPriority,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  WarrantyStatus,
  AmcStatus
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
}

export interface CreateComplaintInput {
  customerId?: string;
  projectId: string;
  orderId?: string;
  productId?: string;
  serialNumber?: string;
  title: string;
  description: string;
  category?: ComplaintCategory;
  priority?: ProjectPriority;
  severity?: ComplaintSeverity;
  reportedDate?: Date;
  preferredVisitTime?: string;
  contactPreference?: 'PHONE' | 'WHATSAPP' | 'EMAIL';
  source?: ComplaintSource;
  internalNotes?: string;
}

export interface UpdateComplaintInput {
  title?: string;
  description?: string;
  category?: ComplaintCategory;
  priority?: ProjectPriority;
  severity?: ComplaintSeverity;
  preferredVisitTime?: string;
  contactPreference?: 'PHONE' | 'WHATSAPP' | 'EMAIL';
  internalNotes?: string;
  customerNotes?: string;
}

export interface ComplaintFilterQuery {
  customerId?: string;
  projectId?: string;
  assignedTechnicianId?: string;
  status?: ComplaintStatus;
  priority?: ProjectPriority;
  category?: ComplaintCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export class ServiceComplaintService {
  /**
   * Valid status transition map enforcing business rules.
   */
  private static readonly VALID_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
    [ComplaintStatus.OPEN]: [ComplaintStatus.TRIAGED, ComplaintStatus.ASSIGNED, ComplaintStatus.CANCELLED],
    [ComplaintStatus.TRIAGED]: [ComplaintStatus.ASSIGNED, ComplaintStatus.AWAITING_CUSTOMER, ComplaintStatus.CANCELLED],
    [ComplaintStatus.ASSIGNED]: [
      ComplaintStatus.VISIT_SCHEDULED,
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.AWAITING_CUSTOMER,
      ComplaintStatus.AWAITING_PARTS,
      ComplaintStatus.CANCELLED
    ],
    [ComplaintStatus.VISIT_SCHEDULED]: [
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.AWAITING_CUSTOMER,
      ComplaintStatus.AWAITING_PARTS,
      ComplaintStatus.CANCELLED
    ],
    [ComplaintStatus.IN_PROGRESS]: [
      ComplaintStatus.RESOLVED,
      ComplaintStatus.AWAITING_PARTS,
      ComplaintStatus.AWAITING_CUSTOMER,
      ComplaintStatus.CANCELLED
    ],
    [ComplaintStatus.AWAITING_CUSTOMER]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.TRIAGED, ComplaintStatus.CANCELLED],
    [ComplaintStatus.AWAITING_PARTS]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.VISIT_SCHEDULED, ComplaintStatus.CANCELLED],
    [ComplaintStatus.RESOLVED]: [ComplaintStatus.CLOSED, ComplaintStatus.REOPENED],
    [ComplaintStatus.CLOSED]: [ComplaintStatus.REOPENED],
    [ComplaintStatus.CANCELLED]: [ComplaintStatus.REOPENED],
    [ComplaintStatus.REOPENED]: [ComplaintStatus.TRIAGED, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.CANCELLED]
  };

  /**
   * Creates a new service complaint ticket with atomic sequence numbering.
   */
  public static async createComplaint(
    input: CreateComplaintInput,
    actor: UserContext
  ): Promise<IServiceComplaintDocument> {
    // 1. Verify project
    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${input.projectId} not found.`);
    }

    // 2. Resolve & verify customer
    let customerId = input.customerId;
    if (actor.isCustomer) {
      // Customer portal: enforce logged in customer owns the project
      if (project.customerId.toString() !== actor.customerId) {
        throw AppError.permissionDenied("You cannot register complaints for another customer's project.");
      }
      customerId = actor.customerId;
    } else {
      if (!customerId) {
        customerId = project.customerId.toString();
      } else if (project.customerId.toString() !== customerId) {
        throw AppError.badRequest("Project customer does not match the provided customer ID.");
      }
    }

    // 3. Check serialized hardware & warranty status
    let isWarrantyCovered = false;
    let productId = input.productId ? new mongoose.Types.ObjectId(input.productId) : undefined;

    if (input.serialNumber) {
      const serialDoc = await ProductSerialNumber.findOne({
        serialNumber: input.serialNumber.trim().toUpperCase()
      });

      if (serialDoc) {
        if (!productId) {
          productId = serialDoc.productId;
        }
        const now = new Date();
        if (
          serialDoc.warrantyStatus === WarrantyStatus.ACTIVE &&
          serialDoc.warrantyEndDate &&
          serialDoc.warrantyEndDate >= now
        ) {
          isWarrantyCovered = true;
        }
      }
    }

    // 4. Check for active AMC on this project
    let linkedAmcId: mongoose.Types.ObjectId | undefined;
    const activeAmc = await AnnualMaintenanceContract.findOne({
      projectId: project._id,
      status: AmcStatus.ACTIVE
    });
    if (activeAmc) {
      linkedAmcId = activeAmc._id;
    }

    // 5. Generate atomic complaint number (CMP-YYYY-XXXXX)
    const seq = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.SERVICE_TICKET,
      customPrefix: 'CMP'
    });

    const actorId = actor.userId || actor.customerId || 'system';
    const actorName = actor.isCustomer ? 'Customer' : 'Staff';

    // 6. Build document
    const internalNotes: IComplaintNote[] = [];
    if (input.internalNotes && !actor.isCustomer) {
      internalNotes.push({
        note: input.internalNotes,
        authorId: actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined,
        authorName: actorName,
        createdAt: new Date()
      });
    }

    const complaint = new ServiceComplaint({
      complaintNumber: seq.formattedNumber,
      customerId: new mongoose.Types.ObjectId(customerId),
      projectId: project._id,
      orderId: input.orderId ? new mongoose.Types.ObjectId(input.orderId) : undefined,
      productId,
      serialNumber: input.serialNumber ? input.serialNumber.trim().toUpperCase() : undefined,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category || ComplaintCategory.OTHER,
      priority: input.priority || ProjectPriority.MEDIUM,
      severity: input.severity || ComplaintSeverity.MINOR,
      reportedDate: input.reportedDate || new Date(),
      preferredVisitTime: input.preferredVisitTime?.trim(),
      contactPreference: input.contactPreference || 'PHONE',
      source: actor.isCustomer ? ComplaintSource.CUSTOMER_PORTAL : (input.source || ComplaintSource.INTERNAL_STAFF),
      status: ComplaintStatus.OPEN,
      isWarrantyCovered,
      linkedAmcId,
      linkedVisitIds: [],
      internalNotes,
      customerNotes: [],
      attachments: [],
      statusHistory: [
        {
          status: ComplaintStatus.OPEN,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: 'Complaint logged and open for triage.'
        }
      ],
      createdBy: new mongoose.Types.ObjectId(actorId)
    });
    await complaint.save();

    // 7. Security audit
    await AuditService.recordEvent({
      actorId,
      actorType: actor.isCustomer ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      action: AuditAction.COMPLAINT_CREATED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `complaint-create-${complaint._id.toString()}`,
      targetEntity: 'ServiceComplaint',
      targetId: complaint._id.toString(),
      details: {
        complaintNumber: complaint.complaintNumber,
        projectId: complaint.projectId.toString(),
        customerId: complaint.customerId.toString(),
        priority: complaint.priority,
        isWarrantyCovered
      }
    });

    return complaint;
  }

  /**
   * Retrieves complaints with filtering, search, pagination, and customer isolation.
   */
  public static async getComplaints(
    filters: ComplaintFilterQuery,
    userContext: UserContext
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, any> = {};

    // Customer portal isolation
    if (userContext.isCustomer) {
      query.customerId = new mongoose.Types.ObjectId(userContext.customerId);
    } else if (filters.customerId) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (filters.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filters.projectId);
    }
    if (filters.assignedTechnicianId) {
      query.assignedTechnicianId = new mongoose.Types.ObjectId(filters.assignedTechnicianId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.priority) {
      query.priority = filters.priority;
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { complaintNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { serialNumber: searchRegex }
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ServiceComplaint.find(query)
        .populate('customerId', 'name primaryPhone email')
        .populate('projectId', 'projectCode name currentStage')
        .populate('productId', 'name productCode sku')
        .populate('assignedTechnicianId', 'firstName lastName email phone')
        .sort({ reportedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ServiceComplaint.countDocuments(query)
    ]);

    // Sanitize for customer: strip internal notes
    const sanitized = items.map(c => {
      if (userContext.isCustomer) {
        const { internalNotes, ...safe } = c as any;
        return safe;
      }
      return c;
    });

    return { items: sanitized, total, page, limit };
  }

  /**
   * Retrieves single complaint by ID with customer ownership validation.
   */
  public static async getComplaintById(
    id: string,
    userContext: UserContext
  ): Promise<any> {
    const complaint = await ServiceComplaint.findById(id)
      .populate('customerId', 'name primaryPhone email billingAddress')
      .populate('projectId', 'projectCode name currentStage systemCapacityKwp')
      .populate('productId', 'name productCode sku brand model')
      .populate('assignedTechnicianId', 'firstName lastName email phone employeeCode')
      .populate('resolvedBy', 'firstName lastName email')
      .lean();

    if (!complaint) {
      throw AppError.notFound(`Service Complaint ${id} not found.`);
    }

    if (userContext.isCustomer) {
      const customerId = (complaint.customerId as any)?._id?.toString() || complaint.customerId?.toString();
      if (customerId !== userContext.customerId) {
        throw AppError.permissionDenied("Access denied: You cannot view another customer's complaint.");
      }
      const { internalNotes, ...safe } = complaint as any;
      return safe;
    }

    return complaint;
  }

  /**
   * Transitions complaint status with validated state machine rules.
   */
  public static async updateStatus(
    id: string,
    targetStatus: ComplaintStatus,
    options: { notes?: string; resolutionSummary?: string },
    actor: UserContext
  ): Promise<IServiceComplaintDocument> {
    const complaint = await ServiceComplaint.findById(id);
    if (!complaint) {
      throw AppError.notFound(`Service Complaint ${id} not found.`);
    }

    const currentStatus = complaint.status;
    const allowed = this.VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Permitted transitions: ${allowed.join(', ') || 'None'}`
      );
    }

    // Resolution summary mandatory for RESOLVED or CLOSED
    if (
      (targetStatus === ComplaintStatus.RESOLVED || targetStatus === ComplaintStatus.CLOSED) &&
      !options.resolutionSummary?.trim() &&
      !complaint.resolutionSummary
    ) {
      throw AppError.badRequest('A comprehensive resolution summary is required to resolve or close a complaint.');
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : (actor.isCustomer ? 'Customer' : 'Staff');

    complaint.status = targetStatus;

    if (options.resolutionSummary?.trim()) {
      complaint.resolutionSummary = options.resolutionSummary.trim();
    }

    if (targetStatus === ComplaintStatus.RESOLVED) {
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined;
    } else if (targetStatus === ComplaintStatus.CLOSED) {
      complaint.closedAt = new Date();
      if (!complaint.resolvedAt) {
        complaint.resolvedAt = new Date();
        complaint.resolvedBy = actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined;
      }
    }

    complaint.statusHistory.push({
      status: targetStatus,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: options.notes?.trim()
    });

    await complaint.save();

    await AuditService.recordEvent({
      actorId,
      actorType: actor.isCustomer ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      action: AuditAction.COMPLAINT_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `complaint-status-${complaint._id.toString()}`,
      targetEntity: 'ServiceComplaint',
      targetId: complaint._id.toString(),
      details: {
        from: currentStatus,
        to: targetStatus,
        complaintNumber: complaint.complaintNumber
      }
    });

    return complaint;
  }

  /**
   * Assigns an accountable service technician to the complaint.
   */
  public static async assignTechnician(
    id: string,
    technicianId: string,
    notes: string | undefined,
    actor: UserContext
  ): Promise<IServiceComplaintDocument> {
    const complaint = await ServiceComplaint.findById(id);
    if (!complaint) {
      throw AppError.notFound(`Service Complaint ${id} not found.`);
    }

    const tech = await User.findById(technicianId);
    if (!tech || !tech.isActive) {
      throw AppError.badRequest('The specified service technician does not exist or is inactive.');
    }

    complaint.assignedTechnicianId = tech._id;

    // Automatically transition to ASSIGNED if currently OPEN or TRIAGED
    if (complaint.status === ComplaintStatus.OPEN || complaint.status === ComplaintStatus.TRIAGED) {
      complaint.status = ComplaintStatus.ASSIGNED;
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'System';

    complaint.statusHistory.push({
      status: complaint.status,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: notes?.trim() || `Assigned to technician ${tech.firstName} ${tech.lastName} (${tech.employeeCode})`
    });

    await complaint.save();

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.COMPLAINT_ASSIGNED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `complaint-assign-${complaint._id.toString()}`,
      targetEntity: 'ServiceComplaint',
      targetId: complaint._id.toString(),
      details: {
        assignedTechnicianId: tech._id.toString(),
        technicianName: `${tech.firstName} ${tech.lastName}`,
        complaintNumber: complaint.complaintNumber
      }
    });

    return complaint;
  }

  /**
   * Reopens a closed, resolved, or cancelled complaint.
   */
  public static async reopenComplaint(
    id: string,
    reason: string,
    actor: UserContext
  ): Promise<IServiceComplaintDocument> {
    const complaint = await ServiceComplaint.findById(id);
    if (!complaint) {
      throw AppError.notFound(`Service Complaint ${id} not found.`);
    }

    if (
      complaint.status !== ComplaintStatus.RESOLVED &&
      complaint.status !== ComplaintStatus.CLOSED &&
      complaint.status !== ComplaintStatus.CANCELLED
    ) {
      throw AppError.badRequest(`Cannot reopen complaint in '${complaint.status}' status. Reopening is only allowed for RESOLVED, CLOSED, or CANCELLED tickets.`);
    }

    const actorId = actor.userId || actor.customerId || 'system';
    const actorName = actor.isCustomer ? 'Customer' : 'Staff';

    complaint.status = ComplaintStatus.REOPENED;
    complaint.reopenReason = reason.trim();
    complaint.reopenedAt = new Date();

    complaint.statusHistory.push({
      status: ComplaintStatus.REOPENED,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      reason: reason.trim(),
      notes: 'Complaint reopened with documented reason.'
    });

    await complaint.save();

    await AuditService.recordEvent({
      actorId,
      actorType: actor.isCustomer ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      action: AuditAction.COMPLAINT_REOPENED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `complaint-reopen-${complaint._id.toString()}`,
      targetEntity: 'ServiceComplaint',
      targetId: complaint._id.toString(),
      details: {
        complaintNumber: complaint.complaintNumber,
        reason: reason.trim()
      }
    });

    return complaint;
  }

  /**
   * Adds an internal or customer-visible note.
   */
  public static async addNote(
    id: string,
    noteText: string,
    isInternal: boolean,
    actor: UserContext
  ): Promise<IServiceComplaintDocument> {
    const complaint = await ServiceComplaint.findById(id);
    if (!complaint) {
      throw AppError.notFound(`Service Complaint ${id} not found.`);
    }

    if (actor.isCustomer) {
      const customerId = complaint.customerId.toString();
      if (customerId !== actor.customerId) {
        throw AppError.permissionDenied("Access denied: You cannot add notes to another customer's complaint.");
      }
      isInternal = false; // Customers can NEVER add internal notes
    }

    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const authorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : (actor.isCustomer ? 'Customer' : 'Staff');

    const noteObj: IComplaintNote = {
      note: noteText.trim(),
      authorId: actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined,
      authorName,
      createdAt: new Date()
    };

    if (isInternal) {
      complaint.internalNotes.push(noteObj);
    } else {
      complaint.customerNotes.push(noteObj);
    }

    await complaint.save();
    return complaint;
  }
}
