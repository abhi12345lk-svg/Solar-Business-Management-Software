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
  ActorType,
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  AmcBillingCadence,
  AmcPaymentStatus,
  MaterialDispatchStatus
} from '@ins-solar/shared';
import { Project, IProjectDocument } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { User } from '../models/User.js';
import { InstallationModel } from '../models/Installation.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export const DEFAULT_PROJECT_MILESTONES = [
  {
    name: 'Site Readiness & Physical Survey Verification',
    description:
      'Verify rooftop shadow clearance, access pathways, and customer meter room readiness.',
    displayOrder: 1
  },
  {
    name: 'Engineering & Structural Design Sign-off',
    description:
      'Finalize PV layout, string sizing, cable routing diagrams, and structural weight load sign-off.',
    displayOrder: 2
  },
  {
    name: 'Net Metering & DISCOM Application Submission',
    description:
      'Submit net metering feasibility application and requisite documentation to regional DISCOM portal.',
    displayOrder: 3
  },
  {
    name: 'Procurement & BOM Dispatch Readiness',
    description:
      'Allocate solar modules, inverter, structure, and BOS from warehouse custody for site dispatch.',
    displayOrder: 4
  },
  {
    name: 'Civil Structure & Roof Rail Mounting',
    description:
      'Erect galvanized steel mounting structures with civil anchors, torque tightening, and pull-out verification.',
    displayOrder: 5
  },
  {
    name: 'Module Placement & DC String Cabling',
    description:
      'Mount solar PV modules with UV-resistant MC4 connectors, string cabling, and conduit dressing.',
    displayOrder: 6
  },
  {
    name: 'Inverter & Switchgear (ACDB/DCDB) Installation',
    description:
      'Install solar string inverter, DC isolator switch, AC distribution box with SPDs and circuit breakers.',
    displayOrder: 7
  },
  {
    name: 'Earthing Pit & Lightning Arrester Termination',
    description:
      'Drill dedicated earthing pits for AC, DC, and LA with chemical compound and low-resistance bonding.',
    displayOrder: 8
  },
  {
    name: 'Testing, Inverter Synchronization & Pre-Commissioning',
    description:
      'Perform Voc/Isc continuity tests, earth loop impedance check, insulation resistance, and inverter power-on test.',
    displayOrder: 9
  },
  {
    name: 'DISCOM Bi-directional Meter Install & Customer Handover',
    description:
      'Joint inspection with DISCOM engineer, bi-directional net meter sync, customer portal onboarding, and warranty handover.',
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
    // 0. Idempotency Check
    if (input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await Project.findOne({ idempotencyKey: input.idempotencyKey.trim() })
        .populate('customerId', 'customerCode name phone email')
        .populate('orderId', 'orderNumber status netTotalPaise');
      if (existing) {
        // Validate payload compatibility before returning idempotent record
        const existingCustId = (existing.customerId as any)?._id?.toString() || existing.customerId?.toString();
        if (existingCustId && existingCustId !== input.customerId) {
          throw AppError.conflict(
            `Idempotency key conflict: Key '${input.idempotencyKey}' was already used for a different customer.`
          );
        }
        if (input.orderId && input.orderId.trim()) {
          const existingOrdId = (existing.orderId as any)?._id?.toString() || existing.orderId?.toString();
          if (existingOrdId && existingOrdId !== input.orderId.trim()) {
            throw AppError.conflict(
              `Idempotency key conflict: Key '${input.idempotencyKey}' was already used for a different sales order.`
            );
          }
        }
        return existing;
      }
    }

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
        throw AppError.validation(
          `Project Manager with ID '${input.projectManagerId}' not found or inactive.`
        );
      }
      projectManagerId = pmUser._id;
    }

    // 4. Validate Team Members if provided
    const teamMemberIds: Types.ObjectId[] = [];
    if (input.teamMemberIds && input.teamMemberIds.length > 0) {
      for (const memberId of input.teamMemberIds) {
        const teamUser = await User.findById(memberId);
        if (!teamUser || !teamUser.isActive) {
          throw AppError.validation(
            `Team member user with ID '${memberId}' not found or inactive.`
          );
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
      idempotencyKey: input.idempotencyKey?.trim() || undefined,
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

    try {
      await project.save();
    } catch (saveErr: any) {
      if (saveErr?.code === 11000) {
        // Concurrency collision on unique index (orderId or idempotencyKey):
        // Safely recover using idempotencyKey first, then orderId as fallback
        let collisionMatch: any = null;
        if (input.idempotencyKey && input.idempotencyKey.trim()) {
          collisionMatch = await Project.findOne({ idempotencyKey: input.idempotencyKey.trim() })
            .populate('customerId', 'customerCode name phone email')
            .populate('orderId', 'orderNumber status netTotalPaise');
        }
        if (!collisionMatch && orderId) {
          collisionMatch = await Project.findOne({ orderId })
            .populate('customerId', 'customerCode name phone email')
            .populate('orderId', 'orderNumber status netTotalPaise');
        }
        if (collisionMatch) {
          // Validate that the incoming payload matches the existing project's customer and order
          const matchCustId =
            (collisionMatch.customerId as any)?._id?.toString() ||
            collisionMatch.customerId?.toString();
          if (matchCustId && matchCustId !== input.customerId) {
            throw AppError.conflict(
              `Concurrency collision: Project for this key or order belongs to a different customer.`
            );
          }
          if (input.orderId && input.orderId.trim()) {
            const matchOrdId =
              (collisionMatch.orderId as any)?._id?.toString() ||
              collisionMatch.orderId?.toString();
            if (matchOrdId && matchOrdId !== input.orderId.trim()) {
              throw AppError.conflict(
                `Concurrency collision: Project for this key belongs to a different sales order.`
              );
            }
          }
          return collisionMatch;
        }
      }
      throw saveErr;
    }

    if (orderId) {
      await SalesOrder.findByIdAndUpdate(orderId, {
        $set: { projectId: project._id }
      });
    }

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
  public static async getProjects(
    filter: ProjectFilterInput,
    userContext?: { userId?: string; role?: string }
  ): Promise<{
    projects: IProjectDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.status) query.status = filter.status;
    if (filter.currentStage) {
      const stageStr = String(filter.currentStage);
      if (
        stageStr === ProjectStage.STAGE_1_DESIGN_APPROVAL ||
        stageStr === 'STAGE_1_DESIGN_APPROVAL'
      ) {
        query.currentStage = {
          $in: [
            ProjectStage.STAGE_1_DESIGN_APPROVAL,
            ProjectStage.STAGE_1_ENGINEERING_DESIGN,
            ProjectStage.STAGE_2_NET_METERING_APPLY
          ]
        };
      } else if (
        stageStr === ProjectStage.STAGE_2_MATERIAL_DISPATCH ||
        stageStr === 'STAGE_2_MATERIAL_DISPATCH'
      ) {
        query.currentStage = {
          $in: [
            ProjectStage.STAGE_2_MATERIAL_DISPATCH,
            ProjectStage.STAGE_3_MATERIAL_DISPATCH
          ]
        };
      } else if (
        stageStr === ProjectStage.STAGE_3_SITE_INSTALLATION ||
        stageStr === 'STAGE_3_SITE_INSTALLATION'
      ) {
        query.currentStage = {
          $in: [
            ProjectStage.STAGE_3_SITE_INSTALLATION,
            ProjectStage.STAGE_4_CIVIL_STRUCTURE,
            ProjectStage.STAGE_5_MODULE_DC_CABLING,
            ProjectStage.STAGE_6_INVERTER_ACDB,
            ProjectStage.STAGE_7_EARTHING_LIGHTNING,
            ProjectStage.STAGE_8_TESTING_PRE_COMMISSION
          ]
        };
      } else if (
        stageStr === ProjectStage.STAGE_4_NET_METER_SYNC ||
        stageStr === 'STAGE_4_NET_METER_SYNC'
      ) {
        query.currentStage = {
          $in: [
            ProjectStage.STAGE_4_NET_METER_SYNC,
            ProjectStage.STAGE_9_DISCOM_METER_INSTALL
          ]
        };
      } else if (
        stageStr === ProjectStage.STAGE_5_HANDOVER_COMMISSIONING ||
        stageStr === 'STAGE_5_HANDOVER_COMMISSIONING'
      ) {
        query.currentStage = {
          $in: [
            ProjectStage.STAGE_5_HANDOVER_COMMISSIONING,
            ProjectStage.STAGE_10_COMMISSION_HANDOVER
          ]
        };
      } else {
        query.currentStage = filter.currentStage;
      }
    }
    if (filter.priority) query.priority = filter.priority;
    if (filter.systemTopology) query.systemTopology = filter.systemTopology;
    if (filter.customerId) query.customerId = new Types.ObjectId(filter.customerId);
    if (filter.projectManagerId)
      query.projectManagerId = new Types.ObjectId(filter.projectManagerId);

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { projectCode: searchRegex }];
    }

    if (
      userContext?.userId &&
      (userContext.role === UserRole.INSTALLATION_CREW ||
        userContext.role === UserRole.TECHNICIAN)
    ) {
      const userObjId = new Types.ObjectId(userContext.userId);
      const installationsForUser = await InstallationModel.find({
        assignedInstallerId: userObjId
      }).select('projectId');
      const linkedProjectIds = installationsForUser
        .map(i => i.projectId)
        .filter(Boolean);

      const installerScopeConditions: any[] = [
        { teamMemberIds: userObjId },
        { projectManagerId: userObjId }
      ];
      if (linkedProjectIds.length > 0) {
        installerScopeConditions.push({ _id: { $in: linkedProjectIds } });
      }

      installerScopeConditions.push({
        teamMemberIds: { $size: 0 },
        currentStage: {
          $in: [
            ProjectStage.STAGE_3_SITE_INSTALLATION,
            ProjectStage.STAGE_4_CIVIL_STRUCTURE,
            ProjectStage.STAGE_5_MODULE_DC_CABLING,
            ProjectStage.STAGE_6_INVERTER_ACDB,
            ProjectStage.STAGE_7_EARTHING_LIGHTNING,
            ProjectStage.STAGE_8_TESTING_PRE_COMMISSION
          ]
        }
      });

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: installerScopeConditions }];
        delete query.$or;
      } else {
        query.$or = installerScopeConditions;
      }
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
    customerScopeId?: string,
    userContext?: { userId?: string; role?: string }
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

    // Installer Field Scoping Check
    if (
      userContext?.userId &&
      (userContext.role === UserRole.INSTALLATION_CREW ||
        userContext.role === UserRole.TECHNICIAN)
    ) {
      const userObjId = new Types.ObjectId(userContext.userId);
      const isTeamMember = project.teamMemberIds?.some(
        (m: any) => (m._id || m).toString() === userContext.userId
      );
      const isPM = (project.projectManagerId as any)?._id?.toString() === userContext.userId;

      if (!isTeamMember && !isPM) {
        const hasLinkedInstallation = await InstallationModel.exists({
          projectId: project._id,
          assignedInstallerId: userObjId
        });
        const isUnassignedFieldStage =
          (!project.teamMemberIds || project.teamMemberIds.length === 0) &&
          [
            ProjectStage.STAGE_3_SITE_INSTALLATION,
            ProjectStage.STAGE_4_CIVIL_STRUCTURE,
            ProjectStage.STAGE_5_MODULE_DC_CABLING,
            ProjectStage.STAGE_6_INVERTER_ACDB,
            ProjectStage.STAGE_7_EARTHING_LIGHTNING,
            ProjectStage.STAGE_8_TESTING_PRE_COMMISSION
          ].includes(project.currentStage as any);

        if (!hasLinkedInstallation && !isUnassignedFieldStage) {
          throw AppError.permissionDenied(
            'Access denied: You are not assigned to this field installation project.'
          );
        }
      }
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
          throw AppError.validation(
            `Project Manager with ID '${input.projectManagerId}' not found or inactive.`
          );
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
    if (input.targetCompletionDate !== undefined)
      project.targetCompletionDate = input.targetCompletionDate;
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
      throw AppError.businessRule(
        'Project in PLANNING cannot directly transition to COMPLETED without being IN_PROGRESS.'
      );
    }
    if (oldStatus === ProjectStatus.ON_HOLD && newStatus === ProjectStatus.COMPLETED) {
      throw AppError.businessRule(
        'Project ON_HOLD must be resumed to IN_PROGRESS before marking COMPLETED.'
      );
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
      if (
        mongoose.connection.readyState === 1 ||
        (ProjectInstallationChecklist.findOne as any)?.mock
      ) {
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

    // Stage 1 -> Stage 2 (Material Dispatch Gate):
    // Requires system capacity and engineering specifications
    if (
      (input.stage === ProjectStage.STAGE_2_MATERIAL_DISPATCH ||
        input.stage === ProjectStage.STAGE_3_MATERIAL_DISPATCH) &&
      (!project.systemCapacityKwp || project.systemCapacityKwp <= 0)
    ) {
      throw AppError.businessRule(
        'Cannot advance to Material Dispatch: System capacity (kWp) and engineering design specifications must be defined.'
      );
    }

    // Stage 2 -> Stage 3 (Site Installation Gate):
    // Requires material to be dispatched from warehouse to the project site
    if (
      input.stage === ProjectStage.STAGE_3_SITE_INSTALLATION ||
      input.stage === ProjectStage.STAGE_4_CIVIL_STRUCTURE
    ) {
      if (project.systemCapacityKwp && project.systemCapacityKwp > 0) {
        const dispatches = await MaterialDispatch.find({
          projectId: project._id,
          status: { $in: [MaterialDispatchStatus.DISPATCHED, MaterialDispatchStatus.DELIVERED] }
        });
        if (dispatches.length === 0) {
          throw AppError.businessRule(
            'Cannot advance to Site Installation: Bill of Materials (BOM) must be dispatched or delivered to site from the warehouse.'
          );
        }
      }
    }

    // Commissioning stage gates check: verify mandatory checklist items are PASSED
    if (
      input.stage === ProjectStage.STAGE_5_HANDOVER_COMMISSIONING ||
      input.stage === ProjectStage.STAGE_8_TESTING_PRE_COMMISSION ||
      input.stage === ProjectStage.STAGE_10_COMMISSION_HANDOVER
    ) {
      if (
        mongoose.connection.readyState === 1 ||
        (ProjectInstallationChecklist.findOne as any)?.mock
      ) {
        const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
        if (checklist) {
          const incompleteItems: string[] = [];
          for (const cat of checklist.categories) {
            if (
              (input.stage === ProjectStage.STAGE_8_TESTING_PRE_COMMISSION ||
                input.stage === ProjectStage.STAGE_5_HANDOVER_COMMISSIONING) &&
              cat.category === ChecklistCategory.TESTING_COMMISSIONING_HANDOVER
            ) {
              continue; // Handover testing items can be performed during Stage 5
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
      throw AppError.notFound(
        `Milestone '${milestoneId}' not found in project ${project.projectCode}.`
      );
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
          throw AppError.validation(
            `Assigned user '${input.assignedUserId}' not found or inactive.`
          );
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
      throw AppError.notFound(
        `Milestone '${milestoneId}' not found in project ${project.projectCode}.`
      );
    }

    const oldStatus = milestone.status;
    const newStatus = input.status;

    if (newStatus === MilestoneStatus.BLOCKED) {
      if (!input.blockerReason || input.blockerReason.trim().length === 0) {
        throw AppError.validation(
          'Blocker reason is strictly required when setting status to BLOCKED.'
        );
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

  /**
   * Initializes complimentary 1st-Year Comprehensive Annual Maintenance Contract (AMC)
   * upon EPC project handover & commissioning.
   */
  public static async initializeFirstYearAmc(
    projectId: string,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project '${projectId}' not found.`);
    }

    // Check if active or pending AMC already exists for this project
    const existing = await AnnualMaintenanceContract.findOne({
      projectId: project._id,
      status: { $ne: AmcStatus.CANCELLED }
    });
    if (existing) {
      return existing;
    }

    // Derive covered hardware serial numbers from confirmed dispatches
    const dispatches = await MaterialDispatch.find({
      projectId: project._id,
      status: { $in: [MaterialDispatchStatus.DISPATCHED, MaterialDispatchStatus.DELIVERED] }
    }).lean();

    const coveredEquipment: Array<{ productId?: any; serialNumber?: string; description: string }> = [];
    for (const d of dispatches) {
      for (const item of d.lineItems || []) {
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          for (const sn of item.serialNumbers) {
            coveredEquipment.push({
              productId: item.productId,
              serialNumber: sn,
              description: `Installed Asset (S/N: ${sn})`
            });
          }
        }
      }
    }

    if (coveredEquipment.length === 0) {
      coveredEquipment.push({
        description: `${project.systemCapacityKwp || 5} kWp Rooftop Solar System & MMS Structure`
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const seq = await SequenceService.generateNumber(SequenceEntityType.AMC_CONTRACT);

    const amc = new AnnualMaintenanceContract({
      amcNumber: seq.formattedNumber,
      customerId: project.customerId,
      projectId: project._id,
      planType: AmcPlanType.COMPREHENSIVE,
      capacityKwp: project.systemCapacityKwp || 5,
      startDate,
      endDate,
      contractAmountPaise: 0, // Complimentary 1st year O&M
      billingCadence: AmcBillingCadence.ANNUAL,
      paymentStatus: AmcPaymentStatus.PAID,
      visitCadence: AmcVisitCadence.QUARTERLY,
      includedVisits: 4,
      consumedVisits: 0,
      chargeableVisits: 0,
      coveredEquipment,
      scopeOfWork:
        'Complimentary 1st-Year Comprehensive O&M: 4 quarterly preventive inspections, module cleaning guidelines, electrical health check, inverter diagnostics, and priority breakdown response.',
      slaCommitments: '24-48 business hours breakdown response; zero service visit labor charges.',
      status: AmcStatus.ACTIVE,
      approvedBy: new Types.ObjectId(user.userId),
      approvedAt: new Date(),
      statusHistory: [
        {
          status: AmcStatus.ACTIVE,
          transitionedAt: new Date(),
          transitionedBy: new Types.ObjectId(user.userId),
          transitionedByName: 'System Auto-Commissioning',
          notes: `Complimentary 1st-Year Comprehensive AMC initialized upon Project Handover (${project.projectCode}).`
        }
      ],
      createdBy: new Types.ObjectId(user.userId)
    });

    await amc.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AMC_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || `proj-amc-${projectId}`,
      targetEntity: 'AnnualMaintenanceContract',
      targetId: amc._id.toString(),
      details: {
        amcNumber: amc.amcNumber,
        projectCode: project.projectCode,
        capacityKwp: amc.capacityKwp,
        includedVisits: amc.includedVisits,
        status: amc.status
      }
    });

    return amc;
  }
}
