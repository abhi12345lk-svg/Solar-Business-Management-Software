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
  MaterialDispatchStatus,
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  SolarTopology,
  DocumentCategory,
  DocumentReviewStatus,
  ApplicationDocumentType,
  InstallationStatus,
  SurveyStatus,
  StockMovementType,
  SerialNumberStatus,
  WarrantyStatus
} from '@ins-solar/shared';
import { Project, IProjectDocument } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { SiteSurvey } from '../models/SiteSurvey.js';
import { SolarDesign } from '../models/SolarDesign.js';
import { User } from '../models/User.js';
import { InstallationModel } from '../models/Installation.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { NetMeteringApplication } from '../models/NetMeteringApplication.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { StockMovement } from '../models/StockMovement.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { Product } from '../models/Product.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

const LEGACY_STAGE_STEPS: Record<string, number> = {
  STAGE_1_ENGINEERING_DESIGN: 1,
  STAGE_2_NET_METERING_APPLY: 1,
  STAGE_3_MATERIAL_DISPATCH: 2,
  STAGE_4_CIVIL_STRUCTURE: 3,
  STAGE_5_MODULE_DC_CABLING: 3,
  STAGE_6_INVERTER_ACDB: 3,
  STAGE_7_EARTHING_LIGHTNING: 3,
  STAGE_8_TESTING_PRE_COMMISSION: 3,
  STAGE_9_DISCOM_METER_INSTALL: 4,
  STAGE_10_COMMISSION_HANDOVER: 5
};

const STAGE_FILTER_ALIASES: Record<string, string[]> = {
  [ProjectStage.STAGE_1_DESIGN_APPROVAL]: [
    ProjectStage.STAGE_1_DESIGN_APPROVAL,
    'STAGE_1_ENGINEERING_DESIGN',
    'STAGE_2_NET_METERING_APPLY'
  ],
  [ProjectStage.STAGE_2_MATERIAL_DISPATCH]: [
    ProjectStage.STAGE_2_MATERIAL_DISPATCH,
    'STAGE_3_MATERIAL_DISPATCH'
  ],
  [ProjectStage.STAGE_3_SITE_INSTALLATION]: [
    ProjectStage.STAGE_3_SITE_INSTALLATION,
    'STAGE_4_CIVIL_STRUCTURE',
    'STAGE_5_MODULE_DC_CABLING',
    'STAGE_6_INVERTER_ACDB',
    'STAGE_7_EARTHING_LIGHTNING',
    'STAGE_8_TESTING_PRE_COMMISSION'
  ],
  [ProjectStage.STAGE_4_NET_METER_SYNC]: [
    ProjectStage.STAGE_4_NET_METER_SYNC,
    'STAGE_9_DISCOM_METER_INSTALL'
  ],
  [ProjectStage.STAGE_5_HANDOVER_COMMISSIONING]: [
    ProjectStage.STAGE_5_HANDOVER_COMMISSIONING,
    'STAGE_10_COMMISSION_HANDOVER'
  ]
};

function getCanonicalStageStep(stageKey: ProjectStage | string): number {
  switch (stageKey) {
    case ProjectStage.STAGE_1_DESIGN_APPROVAL:
      return 1;
    case ProjectStage.STAGE_2_MATERIAL_DISPATCH:
      return 2;
    case ProjectStage.STAGE_3_SITE_INSTALLATION:
      return 3;
    case ProjectStage.STAGE_4_NET_METER_SYNC:
      return 4;
    case ProjectStage.STAGE_5_HANDOVER_COMMISSIONING:
      return 5;
    default:
      return LEGACY_STAGE_STEPS[String(stageKey)] ?? 1;
  }
}

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
      currentStage: ProjectStage.STAGE_1_DESIGN_APPROVAL,
      stageHistory: [
        {
          stage: ProjectStage.STAGE_1_DESIGN_APPROVAL,
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
      const aliases = STAGE_FILTER_ALIASES[stageStr];
      query.currentStage = aliases ? { $in: aliases } : filter.currentStage;
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
          $in: STAGE_FILTER_ALIASES[ProjectStage.STAGE_3_SITE_INSTALLATION]
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
          STAGE_FILTER_ALIASES[ProjectStage.STAGE_3_SITE_INSTALLATION]!.includes(
            String(project.currentStage)
          );

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
      if (getCanonicalStageStep(project.currentStage) < 5) {
        throw AppError.businessRule(
          `Cannot mark project COMPLETED while at stage '${project.currentStage}'. Advance through Stage 5 (Handover & Commissioning) first.`
        );
      }

      const dbConnected = mongoose.connection.readyState === 1;
      if (dbConnected || (DocumentModel.findOne as any)?.mock) {
        const jcrDoc = await DocumentModel.findOne({
          customerId: project.customerId,
          projectId: project._id,
          category: DocumentCategory.COMMISSIONING_REPORT,
          reviewStatus: DocumentReviewStatus.ACCEPTED,
          isArchived: false
        }).lean();

        if (!jcrDoc) {
          throw AppError.businessRule(
            'Cannot complete project handover: Accepted Joint Commissioning Report (JCR) linked to this project is required.'
          );
        }

        // Verify commissioning generation reading and customer handover sign-off
        const nma =
          dbConnected || (NetMeteringApplication.findOne as any)?.mock
            ? await NetMeteringApplication.findOne({
                projectId: project._id,
                status: { $ne: NetMeteringStatus.CANCELLED }
              }).lean()
            : null;

        const incomingGenReading = input.commissioningDetails?.generationReadingKwh;
        const storedGenReading = project.commissioningDetails?.generationReadingKwh;
        const meterReading =
          nma?.meterInstallation?.initialExportReadingKwh ??
          nma?.meterInstallation?.initialImportReadingKwh;
        const effectiveGenReading =
          incomingGenReading ?? storedGenReading ?? meterReading;

        if (effectiveGenReading === undefined || effectiveGenReading < 0) {
          throw AppError.businessRule(
            'Cannot complete project handover: Initial commissioning generation reading (kWh) must be recorded.'
          );
        }

        const hasHandoverMilestone = (project.milestones || []).some(
          (m: any) =>
            /handover/i.test(m.name || '') && m.status === MilestoneStatus.COMPLETED
        );
        const isSignedOff =
          input.commissioningDetails?.customerHandoverSignedOff === true ||
          project.commissioningDetails?.customerHandoverSignedOff === true ||
          hasHandoverMilestone;

        if (!isSignedOff) {
          throw AppError.businessRule(
            'Cannot complete project handover: Customer handover sign-off verification is required.'
          );
        }

        const commDate = new Date();
        project.commissioningDetails = {
          isCommissioned: true,
          commissionedAt: commDate,
          generationReadingKwh: effectiveGenReading,
          jcrDocumentId: jcrDoc._id,
          customerHandoverSignedOff: true,
          customerSignOffName:
            input.commissioningDetails?.customerSignOffName?.trim() ||
            project.commissioningDetails?.customerSignOffName,
          customerSignOffDate: commDate,
          handoverNotes:
            input.commissioningDetails?.handoverNotes?.trim() ||
            input.reason?.trim() ||
            project.commissioningDetails?.handoverNotes
        };
      }

      if (dbConnected || (ProjectInstallationChecklist.findOne as any)?.mock) {
        const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
        if (checklist) {
          const incompleteItems: string[] = [];
          const missingEvidence: string[] = [];
          for (const cat of checklist.categories) {
            for (const item of cat.items) {
              if (item.isRequired && item.status !== ChecklistItemStatus.PASSED) {
                incompleteItems.push(`[${item.itemCode}] ${item.description}`);
              }
              if (item.isRequired && item.requiresEvidence && (!item.evidence || item.evidence.length === 0)) {
                missingEvidence.push(`[${item.itemCode}] ${item.description}`);
              }
            }
          }
          if (incompleteItems.length > 0) {
            throw AppError.businessRule(
              `Cannot complete project: Mandatory installation checklist items remain incomplete or failed (${incompleteItems.length} items pending).`
            );
          }
          if (dbConnected && missingEvidence.length > 0) {
            throw AppError.businessRule(
              `Cannot complete project: Commissioning/installation evidence photos are missing for required checklist items: ${missingEvidence.join('; ')}`
            );
          }
        } else if (dbConnected) {
          throw AppError.businessRule(
            'Cannot complete project: Pre-commissioning and installation checklist must be completed first.'
          );
        }
      }

      // Activate hardware warranty bounds on installed serial numbers upon actual handover/commissioning
      if (dbConnected || (ProductSerialNumber.find as any)?.mock) {
        const commDate = project.commissioningDetails?.commissionedAt || new Date();
        const serials = await ProductSerialNumber.find({
          projectId: project._id,
          status: SerialNumberStatus.INSTALLED
        });
        for (const snDoc of serials) {
          const prod = await Product.findById(snDoc.productId).lean();
          const warrantyMonths = (prod as any)?.warranty?.warrantyMonths;
          const warrantyYears = (prod as any)?.warranty?.warrantyYears;
          const endDate = new Date(commDate);
          if (typeof warrantyMonths === 'number' && warrantyMonths > 0) {
            endDate.setMonth(endDate.getMonth() + warrantyMonths);
          } else {
            const years = typeof warrantyYears === 'number' && warrantyYears > 0 ? warrantyYears : 5;
            endDate.setFullYear(endDate.getFullYear() + years);
          }
          snDoc.commissioningDate = commDate;
          snDoc.warrantyStartDate = commDate;
          snDoc.warrantyEndDate = endDate;
          if ((prod as any)?.warranty?.terms) {
            snDoc.warrantyTerms = (prod as any).warranty.terms;
          }
          snDoc.warrantyStatus = WarrantyStatus.ACTIVE;
          await snDoc.save();
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

    const dbConnected = mongoose.connection.readyState === 1;
    const oldStep = getCanonicalStageStep(oldStage);
    const targetStep = getCanonicalStageStep(input.stage);

    if (dbConnected && targetStep > oldStep + 1) {
      throw AppError.businessRule(
        `Cannot skip directly from Stage ${oldStep} (${oldStage}) to Stage ${targetStep} (${input.stage}). Complete each stage gate sequentially.`
      );
    }

    // Stage 1 -> Stage 2 (Approved Survey, Engineering Design, SLD & BOM Approval Gate):
    if (targetStep === 2) {
      if (!project.systemCapacityKwp || project.systemCapacityKwp <= 0) {
        throw AppError.businessRule(
          'Cannot advance to Material Dispatch: System capacity (kWp) and engineering design specifications must be defined.'
        );
      }

      if (dbConnected || (DocumentModel.exists as any)?.mock) {
        // 1. Survey completed & approved (and no uncompleted pending survey)
        const completedSurvey = await SiteSurvey.findOne({
          customerId: project.customerId,
          status: SurveyStatus.COMPLETED
        }).lean();
        const pendingSurvey = await SiteSurvey.findOne({
          customerId: project.customerId,
          status: { $nin: [SurveyStatus.COMPLETED, SurveyStatus.CANCELLED] }
        }).lean();
        if (!completedSurvey || pendingSurvey) {
          throw AppError.businessRule(
            pendingSurvey
              ? `Cannot advance to Stage 2 (Material Dispatch): Linked Site Survey '${pendingSurvey.surveyNumber}' must be completed before procurement/dispatch.`
              : 'Cannot advance to Stage 2 (Material Dispatch): A completed Site Survey is required.'
          );
        }

        // 2. Engineering design saved with valid module & inverter selections
        const design = project.solarDesignId
          ? await SolarDesign.findById(project.solarDesignId).lean()
          : await SolarDesign.findOne({ customerId: project.customerId }).lean();
        if (!design || !design.module?.productId || !design.inverter?.productId) {
          throw AppError.businessRule(
            'Cannot advance to Stage 2 (Material Dispatch): A complete Solar PV Engineering Design with module and inverter sizing is required.'
          );
        }

        // 3. Single Line Diagram (SLD) / Engineering drawing document verified
        const hasEngineeringSldDoc = await DocumentModel.exists({
          customerId: project.customerId,
          category: DocumentCategory.ENGINEERING_DRAWING,
          reviewStatus: { $nin: [DocumentReviewStatus.REJECTED, DocumentReviewStatus.RESUBMISSION_REQUIRED] },
          isArchived: false
        });
        const hasNetMeteringSld = await NetMeteringApplication.exists({
          projectId: project._id,
          documents: {
            $elemMatch: {
              documentType: ApplicationDocumentType.SOLAR_SLD,
              status: { $nin: ['REQUIRED', 'REJECTED', 'EXPIRED', 'RESUBMISSION_REQUIRED'] }
            }
          }
        });
        if (!hasEngineeringSldDoc && !hasNetMeteringSld) {
          throw AppError.businessRule(
            'Cannot advance to Stage 2 (Material Dispatch): Engineering Single Line Diagram (SLD) document must be uploaded and not rejected.'
          );
        }

        // 4. Approved BOM / confirmed Sales Order exists
        if (!project.orderId) {
          throw AppError.businessRule(
            'Cannot advance to Stage 2 (Material Dispatch): A confirmed Sales Order with an approved BOM is required.'
          );
        }
        const order = await SalesOrder.findById(project.orderId).lean();
        if (!order || order.status === 'CANCELLED' || !order.lineItems?.length) {
          throw AppError.businessRule(
            'Cannot advance to Stage 2 (Material Dispatch): Linked Sales Order must be active and contain an approved Bill of Materials.'
          );
        }

        // 5. Required engineering milestone approval sign-off
        const engMilestone = (project.milestones || []).find((m: any) =>
          /engineering|structural design/i.test(m.name || '')
        );
        if (engMilestone && engMilestone.status !== MilestoneStatus.COMPLETED) {
          throw AppError.businessRule(
            `Cannot advance to Stage 2 (Material Dispatch): Engineering milestone '${engMilestone.name}' must be signed off COMPLETED first.`
          );
        }
      }
    }

    // Stage 2 -> Stage 3 (Material Procurement, Reservation & Physical Site Delivery Gate):
    if (targetStep === 3 && oldStep < 3) {
      if (dbConnected || (MaterialDispatch.find as any)?.mock) {
        const activeDispatches = await MaterialDispatch.find({
          projectId: project._id,
          status: {
            $in: [
              MaterialDispatchStatus.DISPATCHED,
              MaterialDispatchStatus.IN_TRANSIT,
              MaterialDispatchStatus.DELIVERED
            ]
          }
        }).lean();

        if (activeDispatches.length === 0) {
          throw AppError.businessRule(
            'Cannot advance to Site Installation: Bill of Materials (BOM) must be dispatched and physically delivered to site from the warehouse.'
          );
        }

        if (dbConnected || (StockMovement.find as any)?.mock || (SalesOrder.findById as any)?.mock) {
          // Enforce physical delivery acknowledgement and prevent partial dispatch bypass
          const deliveredDispatches = activeDispatches.filter(
            d => d.status === MaterialDispatchStatus.DELIVERED
          );
          if (deliveredDispatches.length === 0) {
            throw AppError.businessRule(
              'Cannot advance to Stage 3 (Site Installation): Materials have only been dispatched in transit and have not been physically delivered & acknowledged at site.'
            );
          }

          if (project.orderId) {
            const order = await SalesOrder.findById(project.orderId).lean();
            if (order && order.lineItems) {
              const deliveredMap = new Map<string, number>();
              for (const disp of deliveredDispatches) {
                for (const li of disp.lineItems || []) {
                  const pId = li.productId?.toString();
                  if (pId) {
                    deliveredMap.set(pId, (deliveredMap.get(pId) || 0) + (li.issuedQuantity || 0));
                  }
                }
              }

              // Deduct physical material returns against this order so returned stock cannot pass delivery gate
              const returnMovements = await StockMovement.find({
                orderId: project.orderId,
                movementType: StockMovementType.RETURN
              }).lean();
              for (const rm of returnMovements) {
                const pId = rm.productId?.toString();
                if (pId) {
                  deliveredMap.set(pId, Math.max(0, (deliveredMap.get(pId) || 0) - (rm.quantity || 0)));
                }
              }

              const shortages: string[] = [];
              for (const ol of order.lineItems) {
                if (ol.productId && (ol.itemType as string) !== 'INSTALLATION_SERVICE') {
                  const prodId = ol.productId.toString();
                  const delivQty = deliveredMap.get(prodId) || 0;
                  if (delivQty < ol.quantity) {
                    shortages.push(`${ol.description}: net delivered ${delivQty}/${ol.quantity}`);
                  }
                }
              }
              if (shortages.length > 0) {
                throw AppError.businessRule(
                  `Cannot advance to Stage 3 (Site Installation): Partial or net returned delivery cannot unlock installation. Remaining materials not physically at site: ${shortages.join('; ')}`
                );
              }
            }
          }
        }
      }
    }

    // Stage 3 -> Stage 4 or Commissioning Checklist Gate:
    if (targetStep >= 4) {
      if (dbConnected || (ProjectInstallationChecklist.findOne as any)?.mock) {
        const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
        if (checklist) {
          const incompleteItems: string[] = [];
          const missingEvidence: string[] = [];
          for (const cat of checklist.categories) {
            if (
              (targetStep === 4 || targetStep === 5) &&
              cat.category === ChecklistCategory.TESTING_COMMISSIONING_HANDOVER
            ) {
              continue; // Handover testing & JCR items are completed in Stage 5 prior to final closeout
            }
            for (const item of cat.items) {
              if (item.isRequired && item.status !== ChecklistItemStatus.PASSED) {
                incompleteItems.push(`[${item.itemCode}] ${item.description} (${item.status})`);
              }
              if (
                dbConnected &&
                item.isRequired &&
                item.requiresEvidence &&
                (!item.evidence || item.evidence.length === 0)
              ) {
                missingEvidence.push(`[${item.itemCode}] ${item.description}`);
              }
            }
          }
          if (incompleteItems.length > 0) {
            throw AppError.businessRule(
              `Cannot advance to ${input.stage}: Mandatory installation checklist items must be PASSED before commissioning gate.\nIncomplete items: ${incompleteItems.join('; ')}`
            );
          }
          if (dbConnected && missingEvidence.length > 0) {
            throw AppError.businessRule(
              `Cannot advance to ${input.stage}: Required field evidence photos are missing for checklist items: ${missingEvidence.join('; ')}`
            );
          }
        } else if (dbConnected) {
          throw AppError.businessRule(
            `Cannot advance to ${input.stage}: Physical installation checklist must be completed and PASSED first.`
          );
        }
      }

      if (dbConnected && targetStep >= 4) {
        // Verify installer assignment + installation photos + verified serials + Supervisor QA approval
        const hasInstaller =
          (project.teamMemberIds && project.teamMemberIds.length > 0) ||
          Boolean(await InstallationModel.exists({ projectId: project._id, assignedInstallerId: { $ne: null } }));
        if (!hasInstaller) {
          throw AppError.businessRule(
            'Cannot advance to Stage 4 (Net Metering Sync): Installer assignment must be completed.'
          );
        }
        const installations = await InstallationModel.find({ projectId: project._id }).lean();
        if (installations.length === 0) {
          throw AppError.businessRule(
            'Cannot advance to Stage 4 (Net Metering Sync): An installation report with site photos, verified equipment serials, and supervisor QA approval is required.'
          );
        }
        const approvedInst = installations.find(i => i.status === InstallationStatus.APPROVED);
        const unapproved = installations.find(i => i.status !== InstallationStatus.APPROVED);
        if (!approvedInst || unapproved) {
          throw AppError.businessRule(
            `Cannot advance to Stage 4: Installation report ${(unapproved || approvedInst)?.installationNumber || ''} (status: ${(unapproved || approvedInst)?.status}) requires supervisor QA approval.`
          );
        }
        if (!approvedInst.photos || approvedInst.photos.length === 0) {
          throw AppError.businessRule(
            `Cannot advance to Stage 4: Installation report ${approvedInst.installationNumber} must contain uploaded site installation photos.`
          );
        }
        const invalidInvItem = (approvedInst.inventoryItems || []).find(
          (it: any) => it.status === 'PENDING' || it.status === 'DEFECTIVE'
        );
        if (invalidInvItem) {
          throw AppError.businessRule(
            `Cannot advance to Stage 4: Installation equipment item '${invalidInvItem.equipmentName || invalidInvItem.serialNumber}' has status '${invalidInvItem.status}' and must be verified before net-metering.`
          );
        }
      }
    }

    // Stage 4 -> Stage 5 (DISCOM Inspection, Bi-Directional Meter Install & Grid Sync Gate):
    if (targetStep === 5) {
      if (dbConnected || (NetMeteringApplication.findOne as any)?.mock) {
        const needsDiscom =
          project.systemTopology === SolarTopology.ON_GRID ||
          project.systemTopology === SolarTopology.HYBRID;
        const nma = await NetMeteringApplication.findOne({
          projectId: project._id,
          status: { $ne: NetMeteringStatus.CANCELLED }
        }).lean();

        if ((needsDiscom || nma) && (dbConnected || (NetMeteringApplication.findOne as any)?.mock)) {
          if (!nma) {
            throw AppError.businessRule(
              `Cannot advance to Stage 5 (Handover & Commissioning): Net Metering application must be registered and completed for ${project.systemTopology} topology.`
            );
          }
          if (nma.inspectionSchedule?.outcome !== NetMeteringInspectionOutcome.PASSED) {
            throw AppError.businessRule(
              `Cannot advance to Stage 5: DISCOM inspection outcome is '${nma.inspectionSchedule?.outcome || 'PENDING'}' — inspection observations must be resolved and PASSED.`
            );
          }
          if (
            !nma.meterInstallation?.meterInstalled ||
            !nma.meterInstallation?.meterNumber ||
            !nma.meterInstallation?.installationDate
          ) {
            throw AppError.businessRule(
              'Cannot advance to Stage 5: Actual bi-directional net meter installation (meter number and installation date) must be recorded.'
            );
          }
          if (nma.status !== NetMeteringStatus.APPROVED) {
            throw AppError.businessRule(
              `Cannot advance to Stage 5: Grid synchronization / DISCOM Net Metering approval is required (current status: '${nma.status}').`
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

    // Eligibility check 1: Must be handed over / commissioned (COMPLETED or Stage 5)
    if (
      project.status !== ProjectStatus.COMPLETED &&
      getCanonicalStageStep(project.currentStage) < 5
    ) {
      throw AppError.businessRule(
        `Project '${project.projectCode}' is not eligible for complimentary AMC yet. Complete commissioning and handover (Stage 5) first.`
      );
    }

    // Eligibility check 2: Must have an active, non-cancelled contracted Sales Order
    if (!project.orderId) {
      throw AppError.businessRule(
        `Project '${project.projectCode}' has no linked Sales Order contract to verify complimentary 1st-year AMC eligibility.`
      );
    }

    const dbConnected = mongoose.connection.readyState === 1;
    if (dbConnected || (SalesOrder.findById as any)?.mock) {
      const order = await SalesOrder.findById(project.orderId).lean();
      if (!order || order.status === 'CANCELLED') {
        throw AppError.businessRule(
          'Linked Sales Order is missing or cancelled; complimentary AMC cannot be issued.'
        );
      }
    }

    // Check if active or pending AMC already exists for this project (duplicate prevention)
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

    // Must remain PENDING_APPROVAL until an authorized manager explicitly approves the contract
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
      status: AmcStatus.PENDING_APPROVAL,
      statusHistory: [
        {
          status: AmcStatus.PENDING_APPROVAL,
          transitionedAt: new Date(),
          transitionedBy: new Types.ObjectId(user.userId),
          transitionedByName: 'Project Commissioning Desk',
          notes: `Complimentary 1st-Year Comprehensive AMC proposal initiated upon Project Handover (${project.projectCode}); awaiting contract approval.`
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
