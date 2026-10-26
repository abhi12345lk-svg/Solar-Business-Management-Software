import mongoose, { Types } from 'mongoose';
import {
  CreateProjectInput,
  UpdateProjectParsed,
  UpdateProjectStatusInput,
  UpdateProjectStageInput,
  ProjectFilterInput,
  CreateMilestoneParsed,
  UpdateMilestoneParsed,
  UpdateMilestoneStatusInput,
  ProjectStatus,
  ProjectStage,
  MilestoneStatus,
  ProjectPriority,
  ChecklistCategory,
  ChecklistItemStatus,
  UserRole,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { Project, IProjectDocument } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { User } from '../models/User.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export const DEFAULT_PROJECT_MILESTONES = [
  {
    name: 'Site Readiness & Physical Survey Verification',
    description: 'Verify rooftop shadow clearance, access pathways, and customer meter room readiness.',
    displayOrder: 1
  },
  {
    name: 'Engineering & Structural Design Sign-off',
    description: 'Finalize PV layout, string sizing, cable routing diagrams, and structural weight load sign-off.',
    displayOrder: 2
  },
  {
    name: 'Net Metering & DISCOM Application Submission',
    description: 'Submit net metering feasibility application and requisite documentation to regional DISCOM portal.',
    displayOrder: 3
  },
  {
    name: 'Procurement & BOM Dispatch Readiness',
    description: 'Allocate solar modules, inverter, structure, and BOS from warehouse custody for site dispatch.',
    displayOrder: 4
  },
  {
    name: 'Civil Structure & Roof Rail Mounting',
    description: 'Erect galvanized steel mounting structures with civil anchors, torque tightening, and pull-out verification.',
    displayOrder: 5
  },
  {
    name: 'Module Placement & DC String Cabling',
    description: 'Mount solar PV modules with UV-resistant MC4 connectors, string cabling, and conduit dressing.',
    displayOrder: 6
  },
  {
    name: 'Inverter & Switchgear (ACDB/DCDB) Installation',
    description: 'Install solar string inverter, DC isolator switch, AC distribution box with SPDs and circuit breakers.',
    displayOrder: 7
  },
  {
    name: 'Earthing Pit & Lightning Arrester Termination',
    description: 'Drill dedicated earthing pits for AC, DC, and LA with chemical compound and low-resistance bonding.',
    displayOrder: 8
  },
  {
    name: 'Testing, Inverter Synchronization & Pre-Commissioning',
    description: 'Perform Voc/Isc continuity tests, earth loop impedance check, insulation resistance, and inverter power-on test.',
    displayOrder: 9
  },
  {
    name: 'DISCOM Bi-directional Meter Install & Customer Handover',
    description: 'Joint inspection with DISCOM engineer, bi-directional net meter sync, customer portal onboarding, and warranty handover.',
    displayOrder: 10
  }
];

export class ProjectService {
  /**
   * 1. Create a new Project
   */
  public static async createProject(
    input: CreateProjectInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    // 1. Verify customer
    const customer = await Customer.findById(input.customerId);
    if (!customer) {
      throw AppError.notFound(`Customer with ID '${input.customerId}' not found.`);
    }

    let orderId: Types.ObjectId | undefined;
    let quotationId: Types.ObjectId | undefined;
    let solarDesignId: Types.ObjectId | undefined;
    let systemCapacityKwp = input.systemCapacityKwp;
    let systemTopology = input.systemTopology;

    // 2. If orderId is provided, validate SalesOrder and enforce 1:1 duplicate project protection
    if (input.orderId && input.orderId.trim()) {
      const order = await SalesOrder.findById(input.orderId);
      if (!order) {
        throw AppError.notFound(`Sales Order with ID '${input.orderId}' not found.`);
      }

      if (order.customerId.toString() !== customer._id.toString()) {
        throw AppError.validation('Sales Order does not belong to the specified customer.');
      }

      // Duplicate project protection: only 1 project per sales order
      const existingProjectForOrder = await Project.findOne({ orderId: order._id });
      if (existingProjectForOrder) {
        throw AppError.duplicateResource(
          `A project (${existingProjectForOrder.projectCode}) is already active for Sales Order ${order.orderNumber}.`
        );
      }

      orderId = order._id;
      quotationId = order.quotationId;
      solarDesignId = order.solarDesignId;
      if (!systemCapacityKwp && order.systemCapacityKwp) {
        systemCapacityKwp = order.systemCapacityKwp;
      }
      if (!systemTopology && order.systemTopology) {
        systemTopology = order.systemTopology;
      }
    }

    // 3. Validate Project Manager if provided
    let projectManagerId: Types.ObjectId | undefined;
    if (input.projectManagerId && input.projectManagerId.trim()) {
      const pmUser = await User.findById(input.projectManagerId);
      if (!pmUser || !pmUser.isActive) {
        throw AppError.validation(`Project Manager with ID '${input.projectManagerId}' not found or inactive.`);
      }
      projectManagerId = pmUser._id;
    }

    // 4. Validate Team Members if provided
    const teamMemberIds: Types.ObjectId[] = [];
    if (input.teamMemberIds && input.teamMemberIds.length > 0) {
      for (const memberId of input.teamMemberIds) {
        const teamUser = await User.findById(memberId);
        if (!teamUser || !teamUser.isActive) {
          throw AppError.validation(`Team member user with ID '${memberId}' not found or inactive.`);
        }
        teamMemberIds.push(teamUser._id);
      }
    }

    // 5. Generate Atomic Sequential Project Code
    const seq = await SequenceService.generateNumber(SequenceEntityType.PROJECT);
    const projectCode = seq.formattedNumber;

    // 6. Build Initial Milestones
    const initialMilestones: any[] = [];
    if (input.applyDefaultMilestones !== false) {
      for (const tmpl of DEFAULT_PROJECT_MILESTONES) {
        initialMilestones.push({
          name: tmpl.name,
          description: tmpl.description,
          displayOrder: tmpl.displayOrder,
          status: MilestoneStatus.NOT_STARTED
        });
      }
    }

    // 7. Assemble Document
    const project = new Project({
      projectCode,
      name: input.name.trim(),
      customerId: customer._id,
      orderId,
      quotationId,
      solarDesignId,
      siteAddress: input.siteAddress
        ? {
            addressLine1: input.siteAddress.addressLine1.trim(),
            addressLine2: input.siteAddress.addressLine2?.trim(),
            city: input.siteAddress.city.trim(),
            state: input.siteAddress.state.trim(),
            postalCode: input.siteAddress.postalCode.trim(),
            country: input.siteAddress.country || 'India'
          }
        : undefined,
      systemCapacityKwp,
      systemTopology,
      projectManagerId,
      teamMemberIds,
      status: ProjectStatus.PLANNING,
      currentStage: ProjectStage.STAGE_1_ENGINEERING_DESIGN,
      stageHistory: [
        {
          stage: ProjectStage.STAGE_1_ENGINEERING_DESIGN,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          notes: 'Project initialized.'
        }
      ],
      plannedStartDate: new Date(input.plannedStartDate),
      targetCompletionDate: new Date(input.targetCompletionDate),
      priority: input.priority || ProjectPriority.MEDIUM,
      notes: input.notes?.trim(),
      milestones: initialMilestones,
      createdBy: new Types.ObjectId(user.userId)
    });

    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'project-create',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        name: project.name,
        customerId: customer._id.toString(),
        orderId: orderId?.toString()
      }
    });

    return project;
  }

  /**
   * 2. List Projects with Filters & Pagination
   */
  public static async getProjects(filter: ProjectFilterInput): Promise<{
    projects: IProjectDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.status) query.status = filter.status;
    if (filter.currentStage) query.currentStage = filter.currentStage;
    if (filter.priority) query.priority = filter.priority;
    if (filter.customerId) query.customerId = new Types.ObjectId(filter.customerId);
    if (filter.projectManagerId) query.projectManagerId = new Types.ObjectId(filter.projectManagerId);

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { projectCode: searchRegex }];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortField]: sortOrder };

    const [projects, total] = await Promise.all([
      Project.find(query)
        .populate('customerId', 'customerCode name phone email')
        .populate('orderId', 'orderNumber status netTotalPaise')
        .populate('projectManagerId', 'firstName lastName email employeeCode')
        .populate('teamMemberIds', 'firstName lastName email employeeCode')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(query)
    ]);

    return {
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 3. Get Project by ID
   */
  public static async getProjectById(
    id: string,
    customerScopeId?: string
  ): Promise<IProjectDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid project ID '${id}'.`);
    }

    const project = await Project.findById(id)
      .populate('customerId', 'customerCode name phone email billingAddress gstin')
      .populate('orderId', 'orderNumber status netTotalPaise lineItems paymentMilestones')
      .populate('projectManagerId', 'firstName lastName email phone employeeCode')
      .populate('teamMemberIds', 'firstName lastName email phone employeeCode')
      .populate('stageHistory.changedBy', 'firstName lastName employeeCode')
      .populate('milestones.assignedUserId', 'firstName lastName employeeCode')
      .populate('milestones.completedBy', 'firstName lastName employeeCode');

    if (!project) {
      throw AppError.notFound(`Project with ID '${id}' not found.`);
    }

    // Customer Isolation Check
    if (customerScopeId && project.customerId._id.toString() !== customerScopeId) {
      throw AppError.permissionDenied("Access denied: You cannot view another customer's project.");
    }

    return project;
  }

  /**
   * 4. Update Project Editable Metadata
   */
  public static async updateProject(
    id: string,
    input: UpdateProjectParsed,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);

    if (input.name) project.name = input.name.trim();

    if (input.projectManagerId !== undefined) {
      if (input.projectManagerId && input.projectManagerId.trim()) {
        const pm = await User.findById(input.projectManagerId);
        if (!pm || !pm.isActive) {
          throw AppError.validation(`Project Manager with ID '${input.projectManagerId}' not found or inactive.`);
        }
        project.projectManagerId = pm._id;
      } else {
        project.projectManagerId = undefined;
      }
    }

    if (input.teamMemberIds) {
      const validTeam: Types.ObjectId[] = [];
      for (const mId of input.teamMemberIds) {
        const u = await User.findById(mId);
        if (!u || !u.isActive) {
          throw AppError.validation(`Team member user '${mId}' not found or inactive.`);
        }
        validTeam.push(u._id);
      }
      project.teamMemberIds = validTeam;
    }

    if (input.siteAddress) {
      project.siteAddress = {
        addressLine1: input.siteAddress.addressLine1.trim(),
        addressLine2: input.siteAddress.addressLine2?.trim(),
        city: input.siteAddress.city.trim(),
        state: input.siteAddress.state.trim(),
        postalCode: input.siteAddress.postalCode.trim(),
        country: input.siteAddress.country || 'India'
      };
    }

    if (input.systemCapacityKwp !== undefined) project.systemCapacityKwp = input.systemCapacityKwp;
    if (input.systemTopology !== undefined) project.systemTopology = input.systemTopology;
    if (input.plannedStartDate !== undefined) project.plannedStartDate = input.plannedStartDate;
    if (input.targetCompletionDate !== undefined) project.targetCompletionDate = input.targetCompletionDate;
    if (input.priority !== undefined) project.priority = input.priority;
    if (input.notes !== undefined) project.notes = input.notes.trim();

    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'project-update',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: { projectCode: project.projectCode }
    });

    return project;
  }

  /**
   * 5. Update Project Status with Validated State Machine Transitions
   */
  public static async updateProjectStatus(
    id: string,
    input: UpdateProjectStatusInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);
    const oldStatus = project.status;
    const newStatus = input.status;

    if (oldStatus === newStatus) {
      return project;
    }

    // State machine rules:
    // Terminal states cannot transition
    if (oldStatus === ProjectStatus.COMPLETED) {
      throw AppError.businessRule('Completed projects cannot change status.');
    }
    if (oldStatus === ProjectStatus.CANCELLED) {
      throw AppError.businessRule('Cancelled projects cannot change status.');
    }

    // PLANNING -> IN_PROGRESS, ON_HOLD, CANCELLED
    // IN_PROGRESS -> ON_HOLD, COMPLETED, CANCELLED
    // ON_HOLD -> IN_PROGRESS, CANCELLED
    if (oldStatus === ProjectStatus.PLANNING && newStatus === ProjectStatus.COMPLETED) {
      throw AppError.businessRule('Project in PLANNING cannot directly transition to COMPLETED without being IN_PROGRESS.');
    }
    if (oldStatus === ProjectStatus.ON_HOLD && newStatus === ProjectStatus.COMPLETED) {
      throw AppError.businessRule('Project ON_HOLD must be resumed to IN_PROGRESS before marking COMPLETED.');
    }

    // Reason requirement
    if (newStatus === ProjectStatus.ON_HOLD) {
      if (!input.reason || input.reason.trim().length === 0) {
        throw AppError.validation('Reason is required when placing a project on hold.');
      }
      project.holdReason = input.reason.trim();
    } else if (newStatus === ProjectStatus.CANCELLED) {
      if (!input.reason || input.reason.trim().length === 0) {
        throw AppError.validation('Reason is required when cancelling a project.');
      }
      project.cancellationReason = input.reason.trim();
    } else if (newStatus === ProjectStatus.COMPLETED) {
      if (mongoose.connection.readyState === 1 || (ProjectInstallationChecklist.findOne as any)?.mock) {
        const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
        if (checklist) {
          const incompleteItems: string[] = [];
          for (const cat of checklist.categories) {
            for (const item of cat.items) {
              if (item.isRequired && item.status !== ChecklistItemStatus.PASSED) {
                incompleteItems.push(`[${item.itemCode}] ${item.description}`);
              }
            }
          }
          if (incompleteItems.length > 0) {
            throw AppError.businessRule(
              `Cannot complete project: Mandatory installation checklist items remain incomplete or failed (${incompleteItems.length} items pending).`
            );
          }
        }
      }
      project.actualCompletionDate = new Date();
    }

    project.status = newStatus;
    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'project-status-change',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        fromStatus: oldStatus,
        toStatus: newStatus,
        reason: input.reason
      }
    });

    return project;
  }

  /**
   * 6. Advance Project Stage
   */
  public static async advanceProjectStage(
    id: string,
    input: UpdateProjectStageInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);
    const oldStage = project.currentStage;

    if (project.status === ProjectStatus.CANCELLED || project.status === ProjectStatus.COMPLETED) {
      throw AppError.businessRule(`Cannot advance stage on a ${project.status} project.`);
    }

    // Commissioning stage gates check: verify mandatory checklist items are PASSED
    if (
      input.stage === ProjectStage.STAGE_8_TESTING_PRE_COMMISSION ||
      input.stage === ProjectStage.STAGE_10_COMMISSION_HANDOVER
    ) {
      if (mongoose.connection.readyState === 1 || (ProjectInstallationChecklist.findOne as any)?.mock) {
        const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
        if (checklist) {
          const incompleteItems: string[] = [];
          for (const cat of checklist.categories) {
            if (
              input.stage === ProjectStage.STAGE_8_TESTING_PRE_COMMISSION &&
              cat.category === ChecklistCategory.TESTING_COMMISSIONING_HANDOVER
            ) {
              continue; // Testing items can be performed during Stage 8
            }
            for (const item of cat.items) {
              if (item.isRequired && item.status !== ChecklistItemStatus.PASSED) {
                incompleteItems.push(`[${item.itemCode}] ${item.description} (${item.status})`);
              }
            }
          }
          if (incompleteItems.length > 0) {
            throw AppError.businessRule(
              `Cannot advance to ${input.stage}: Mandatory installation checklist items must be PASSED before commissioning gate.\nIncomplete items: ${incompleteItems.join('; ')}`
            );
          }
        }
      }
    }

    project.currentStage = input.stage;
    project.stageHistory.push({
      stage: input.stage,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      notes: input.notes?.trim()
    });

    // Auto-transition to IN_PROGRESS if currently in PLANNING
    if (project.status === ProjectStatus.PLANNING) {
      project.status = ProjectStatus.IN_PROGRESS;
    }

    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_STAGE_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'project-stage-change',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        fromStage: oldStage,
        toStage: input.stage,
        notes: input.notes
      }
    });

    return project;
  }

  /**
   * 7. Add Milestone to Project
   */
  public static async addMilestone(
    id: string,
    input: CreateMilestoneParsed,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);

    let assignedUserId: Types.ObjectId | undefined;
    if (input.assignedUserId && input.assignedUserId.trim()) {
      const assigned = await User.findById(input.assignedUserId);
      if (!assigned || !assigned.isActive) {
        throw AppError.validation(`Assigned user '${input.assignedUserId}' not found or inactive.`);
      }
      assignedUserId = assigned._id;
    }

    const displayOrder = input.displayOrder ?? project.milestones.length + 1;

    project.milestones.push({
      name: input.name.trim(),
      description: input.description?.trim(),
      displayOrder,
      plannedStartDate: input.plannedStartDate,
      dueDate: input.dueDate,
      status: MilestoneStatus.NOT_STARTED,
      assignedUserId
    } as any);

    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.MILESTONE_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'milestone-create',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        milestoneName: input.name
      }
    });

    return project;
  }

  /**
   * 8. Update Milestone Details
   */
  public static async updateMilestone(
    id: string,
    milestoneId: string,
    input: UpdateMilestoneParsed,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);
    const milestone = project.milestones.id(milestoneId);

    if (!milestone) {
      throw AppError.notFound(`Milestone '${milestoneId}' not found in project ${project.projectCode}.`);
    }

    if (input.name) milestone.name = input.name.trim();
    if (input.description !== undefined) milestone.description = input.description?.trim();
    if (input.displayOrder !== undefined) milestone.displayOrder = input.displayOrder;
    if (input.plannedStartDate !== undefined) milestone.plannedStartDate = input.plannedStartDate;
    if (input.dueDate !== undefined) milestone.dueDate = input.dueDate;

    if (input.assignedUserId !== undefined) {
      if (input.assignedUserId && input.assignedUserId.trim()) {
        const u = await User.findById(input.assignedUserId);
        if (!u || !u.isActive) {
          throw AppError.validation(`Assigned user '${input.assignedUserId}' not found or inactive.`);
        }
        milestone.assignedUserId = u._id;
      } else {
        milestone.assignedUserId = undefined;
      }
    }

    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.MILESTONE_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'milestone-update',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        milestoneId
      }
    });

    return project;
  }

  /**
   * 9. Update Milestone Status with Blocker and Completion Audit Metadata
   */
  public static async updateMilestoneStatus(
    id: string,
    milestoneId: string,
    input: UpdateMilestoneStatusInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectDocument> {
    const project = await this.getProjectById(id);
    const milestone = project.milestones.id(milestoneId);

    if (!milestone) {
      throw AppError.notFound(`Milestone '${milestoneId}' not found in project ${project.projectCode}.`);
    }

    const oldStatus = milestone.status;
    const newStatus = input.status;

    if (newStatus === MilestoneStatus.BLOCKED) {
      if (!input.blockerReason || input.blockerReason.trim().length === 0) {
        throw AppError.validation('Blocker reason is strictly required when setting status to BLOCKED.');
      }
      milestone.blockerReason = input.blockerReason.trim();
    } else {
      milestone.blockerReason = undefined;
    }

    if (newStatus === MilestoneStatus.COMPLETED) {
      milestone.completedBy = new Types.ObjectId(user.userId);
      milestone.completedAt = new Date();
      milestone.actualCompletionDate = new Date();
    } else if (oldStatus === MilestoneStatus.COMPLETED) {
      milestone.completedBy = undefined;
      milestone.completedAt = undefined;
      milestone.actualCompletionDate = undefined;
    }

    milestone.status = newStatus;
    project.updatedBy = new Types.ObjectId(user.userId);
    await project.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.MILESTONE_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'milestone-status-change',
      targetEntity: 'Project',
      targetId: project._id.toString(),
      details: {
        projectCode: project.projectCode,
        milestoneId,
        milestoneName: milestone.name,
        fromStatus: oldStatus,
        toStatus: newStatus,
        blockerReason: input.blockerReason
      }
    });

    return project;
  }
}
