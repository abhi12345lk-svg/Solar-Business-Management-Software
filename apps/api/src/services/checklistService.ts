/**
 * INS Solar Business Management Software — Installation Checklist Service
 *
 * Implements configurable, versioned 5-category installation inspection checklists,
 * evidence attachment with GPS coordinate validation, and commissioning gate checks.
 */

import { Types } from 'mongoose';
import {
  ChecklistCategory,
  ChecklistItemStatus,
  UpdateChecklistItemStatusInput,
  UploadEvidenceMetadataInput,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import {
  InstallationChecklistTemplate,
  IInstallationChecklistTemplateDocument
} from '../models/InstallationChecklistTemplate.js';
import {
  ProjectInstallationChecklist,
  IProjectInstallationChecklistDocument
} from '../models/ProjectInstallationChecklist.js';
import { Project } from '../models/Project.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export const DEFAULT_TEMPLATE_CODE = 'CKT-STANDARD-ROOFTOP';

export class ChecklistService {
  /**
   * 1. Ensure default 5-category installation checklist template exists.
   */
  public static async getOrCreateDefaultTemplate(): Promise<IInstallationChecklistTemplateDocument> {
    let template = await InstallationChecklistTemplate.findOne({
      templateCode: DEFAULT_TEMPLATE_CODE,
      isActive: true
    });

    if (!template) {
      template = new InstallationChecklistTemplate({
        templateCode: DEFAULT_TEMPLATE_CODE,
        title: 'Standard Solar Rooftop Quality & Safety Inspection Template',
        version: 1,
        isActive: true,
        categories: [
          {
            category: ChecklistCategory.SITE_READINESS_SAFETY,
            title: '1. Site Readiness and Safety',
            items: [
              {
                itemCode: 'CHK-01-01',
                description: 'Roof structural integrity and load-bearing readiness verified',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-01-02',
                description:
                  'Safety lifelines, scaffolding, and personal fall arrest anchor points inspected',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-01-03',
                description: 'Shadow-free array layout confirmed against engineering design',
                isRequired: true,
                requiresEvidence: false
              }
            ]
          },
          {
            category: ChecklistCategory.STRUCTURE_MODULE_MOUNTING,
            title: '2. Mounting Structure and Module Installation',
            items: [
              {
                itemCode: 'CHK-02-01',
                description:
                  'Module mounting structure (MMS) fasteners torqued to specified Nm with anti-seize',
                isRequired: true,
                requiresEvidence: false
              },
              {
                itemCode: 'CHK-02-02',
                description:
                  'Roof penetration chemical anchoring, grouting, and waterproofing membrane sealed',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-02-03',
                description: 'Solar module mounting clamps and tilt/azimuth alignment verified',
                isRequired: true,
                requiresEvidence: true
              }
            ]
          },
          {
            category: ChecklistCategory.DC_WIRING_EARTHING,
            title: '3. DC Wiring, Protection and Earthing',
            items: [
              {
                itemCode: 'CHK-03-01',
                description: 'UV-resistant conduit routing and MC4 crimping pull-tested',
                isRequired: true,
                requiresEvidence: false
              },
              {
                itemCode: 'CHK-03-02',
                description: 'DC Surge Protection Device (SPD) and DC fuse ratings confirmed',
                isRequired: true,
                requiresEvidence: false
              },
              {
                itemCode: 'CHK-03-03',
                description: 'Chemical earthing pits constructed with measured resistance < 5 Ohms',
                isRequired: true,
                requiresEvidence: true
              }
            ]
          },
          {
            category: ChecklistCategory.INVERTER_AC_PROTECTION,
            title: '4. Inverter, AC Wiring and Electrical Protection',
            items: [
              {
                itemCode: 'CHK-04-01',
                description:
                  'Inverter mounted in shaded, ventilated location with IP65 gland seals intact',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-04-02',
                description: 'AC Distribution Board (ACDB) MCB/MCCB and Type-II AC SPD installed',
                isRequired: true,
                requiresEvidence: false
              },
              {
                itemCode: 'CHK-04-03',
                description: 'Grid interconnection cable sized for < 2% voltage drop',
                isRequired: true,
                requiresEvidence: false
              }
            ]
          },
          {
            category: ChecklistCategory.TESTING_COMMISSIONING_HANDOVER,
            title: '5. Testing, Commissioning and Handover Readiness',
            items: [
              {
                itemCode: 'CHK-05-01',
                description:
                  'String open-circuit voltage (Voc) and short-circuit current (Isc) test sign-off',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-05-02',
                description: 'Megger insulation resistance test phase-to-earth (> 1 MOhm) verified',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-05-03',
                description:
                  'DISCOM bi-directional net-meter synchronization and anti-islanding test pass',
                isRequired: true,
                requiresEvidence: true
              },
              {
                itemCode: 'CHK-05-04',
                description:
                  'Customer handover documentation, test certificates, and warranty pack delivered',
                isRequired: true,
                requiresEvidence: false
              }
            ]
          }
        ]
      });

      await template.save();
    }

    return template;
  }

  /**
   * 2. Generate snapshotted installation checklist for a project.
   */
  public static async generateProjectChecklist(
    projectId: string,
    templateCode?: string,
    user?: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectInstallationChecklistDocument> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID '${projectId}' not found.`);
    }

    let template: IInstallationChecklistTemplateDocument | null = null;
    if (templateCode) {
      template = await InstallationChecklistTemplate.findOne({ templateCode, isActive: true });
    }
    if (!template) {
      template = await this.getOrCreateDefaultTemplate();
    }

    // Check for existing checklist with this template version
    const existing = await ProjectInstallationChecklist.findOne({
      projectId: project._id,
      templateVersion: template.version
    });

    if (existing) {
      throw AppError.duplicateResource(
        `Installation checklist for template version ${template.version} already exists for project ${project.projectCode}.`
      );
    }

    // Clone categories and items from template snapshot
    const categoriesSnapshot = template.categories.map(c => ({
      category: c.category,
      title: c.title,
      items: c.items.map(item => ({
        _id: new Types.ObjectId(),
        itemCode: item.itemCode,
        description: item.description,
        isRequired: item.isRequired,
        requiresEvidence: item.requiresEvidence,
        status: ChecklistItemStatus.NOT_STARTED,
        evidence: []
      }))
    }));

    const checklist = new ProjectInstallationChecklist({
      projectId: project._id,
      templateId: template._id,
      templateCode: template.templateCode,
      templateVersion: template.version,
      categories: categoriesSnapshot
    });

    await checklist.save();

    if (user) {
      await AuditService.recordEvent({
        actorId: user.userId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.CHECKLIST_GENERATED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        correlationId: context?.correlationId || 'checklist-gen',
        targetEntity: 'ProjectInstallationChecklist',
        targetId: checklist._id.toString(),
        details: {
          projectCode: project.projectCode,
          templateCode: template.templateCode,
          version: template.version
        }
      });
    }

    return checklist;
  }

  /**
   * 3. Get Project Checklist (or auto-generate default if not yet generated).
   */
  public static async getProjectChecklist(
    projectId: string
  ): Promise<IProjectInstallationChecklistDocument> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    let checklist: IProjectInstallationChecklistDocument | null =
      await ProjectInstallationChecklist.findOne({
        projectId: new Types.ObjectId(projectId)
      });

    if (!checklist) {
      // Auto-generate default checklist for active project
      checklist = await this.generateProjectChecklist(projectId);
    }

    return checklist!;
  }

  /**
   * 4. Update status of a specific checklist item.
   */
  public static async updateItemStatus(
    projectId: string,
    itemId: string,
    input: UpdateChecklistItemStatusInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectInstallationChecklistDocument> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }
    if (!Types.ObjectId.isValid(itemId)) {
      throw AppError.validation(`Invalid checklist item ID '${itemId}'.`);
    }

    const checklist = await this.getProjectChecklist(projectId);

    let targetItem: any = null;
    let targetCategoryTitle = '';

    for (const cat of checklist.categories) {
      const it = (cat.items as any).id(itemId);
      if (it) {
        targetItem = it;
        targetCategoryTitle = cat.title;
        break;
      }
    }

    if (!targetItem) {
      throw AppError.notFound(`Checklist item with ID '${itemId}' not found in project checklist.`);
    }

    // Evidence rule: cannot pass mandatory checklist item if template specifies evidence is required
    if (input.status === ChecklistItemStatus.PASSED) {
      if (
        targetItem.requiresEvidence &&
        (!targetItem.evidence || targetItem.evidence.length === 0)
      ) {
        throw AppError.validation(
          `Cannot mark checklist item '${targetItem.description}' as PASSED without required photo evidence.`
        );
      }
      targetItem.failureReason = undefined;
      targetItem.blockerReason = undefined;
      targetItem.completedBy = new Types.ObjectId(user.userId);
      targetItem.completedAt = new Date();
    } else if (input.status === ChecklistItemStatus.FAILED) {
      if (!input.failureReason || !input.failureReason.trim()) {
        throw AppError.validation(
          'Failure reason is strictly required when setting item status to FAILED.'
        );
      }
      targetItem.failureReason = input.failureReason.trim();
      targetItem.blockerReason = undefined;
      targetItem.completedBy = new Types.ObjectId(user.userId);
      targetItem.completedAt = new Date();
    } else if (input.status === ChecklistItemStatus.BLOCKED) {
      if (!input.blockerReason || !input.blockerReason.trim()) {
        throw AppError.validation(
          'Blocker reason is strictly required when setting item status to BLOCKED.'
        );
      }
      targetItem.blockerReason = input.blockerReason.trim();
      targetItem.failureReason = undefined;
      targetItem.completedBy = new Types.ObjectId(user.userId);
      targetItem.completedAt = new Date();
    } else {
      // NOT_STARTED or IN_PROGRESS
      targetItem.completedBy = undefined;
      targetItem.completedAt = undefined;
      targetItem.failureReason = undefined;
      targetItem.blockerReason = undefined;
    }

    targetItem.status = input.status;
    if (input.notes !== undefined) {
      targetItem.notes = input.notes.trim();
    }

    await checklist.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.CHECKLIST_ITEM_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'checklist-item-update',
      targetEntity: 'ProjectInstallationChecklist',
      targetId: checklist._id.toString(),
      details: {
        itemCode: targetItem.itemCode,
        category: targetCategoryTitle,
        newStatus: input.status,
        hasEvidence: targetItem.evidence?.length > 0
      }
    });

    return checklist;
  }

  /**
   * 5. Attach photo evidence to a checklist item.
   */
  public static async attachEvidence(
    projectId: string,
    itemId: string,
    file: {
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
    },
    metadata: UploadEvidenceMetadataInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<any> {
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType.toLowerCase())) {
      throw AppError.validation(
        `File format '${file.mimeType}' is not allowed. Supported formats: JPEG, PNG, WebP, PDF.`
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.fileSizeBytes > MAX_FILE_SIZE) {
      throw AppError.validation(
        `File size (${(file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB) exceeds maximum 10 MB limit.`
      );
    }

    if (metadata.latitude !== undefined && (metadata.latitude < -90 || metadata.latitude > 90)) {
      throw AppError.validation('Latitude must be between -90 and 90 degrees.');
    }

    if (
      metadata.longitude !== undefined &&
      (metadata.longitude < -180 || metadata.longitude > 180)
    ) {
      throw AppError.validation('Longitude must be between -180 and 180 degrees.');
    }

    const checklist = await this.getProjectChecklist(projectId);

    let targetItem: any = null;
    for (const cat of checklist.categories) {
      const it = (cat.items as any).id(itemId);
      if (it) {
        targetItem = it;
        break;
      }
    }

    if (!targetItem) {
      throw AppError.notFound(`Checklist item with ID '${itemId}' not found in project checklist.`);
    }

    // Persist private storageKey boundary
    const sanitizedName = file.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `projects/${projectId}/checklists/${itemId}/${Date.now()}-${sanitizedName}`;

    const evidenceDoc: any = {
      _id: new Types.ObjectId(),
      storageKey,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      uploadedBy: new Types.ObjectId(user.userId),
      uploadedAt: new Date(),
      caption: metadata.caption?.trim(),
      latitude: metadata.latitude,
      longitude: metadata.longitude
    };

    targetItem.evidence.push(evidenceDoc);
    await checklist.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.EVIDENCE_ATTACHED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'evidence-attach',
      targetEntity: 'ProjectInstallationChecklist',
      targetId: checklist._id.toString(),
      details: {
        itemCode: targetItem.itemCode,
        storageKey,
        fileSizeBytes: file.fileSizeBytes,
        hasCoordinates: metadata.latitude !== undefined && metadata.longitude !== undefined
      }
    });

    return evidenceDoc;
  }

  /**
   * 6. Generate secure, authorized view link for private evidence file.
   */
  public static async getAuthorizedEvidenceAccess(
    projectId: string,
    evidenceId: string,
    userOrCustomer: { userId?: string; customerId?: string }
  ): Promise<{
    storageKey: string;
    fileName: string;
    mimeType: string;
    downloadUrl: string;
    expiresInSeconds: number;
  }> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project '${projectId}' not found.`);
    }

    // If request is from customer portal, verify customer ownership
    if (userOrCustomer.customerId) {
      if (project.customerId.toString() !== userOrCustomer.customerId) {
        throw AppError.forbidden(
          'Access denied: You cannot view evidence for another customer project.'
        );
      }
    }

    const checklist = await ProjectInstallationChecklist.findOne({ projectId: project._id });
    if (!checklist) {
      throw AppError.notFound('No checklist found for this project.');
    }

    let foundEvidence: any = null;
    for (const cat of checklist.categories) {
      for (const item of cat.items) {
        const ev = (item.evidence as any).id(evidenceId);
        if (ev) {
          foundEvidence = ev;
          break;
        }
      }
      if (foundEvidence) break;
    }

    if (!foundEvidence) {
      throw AppError.notFound(`Evidence item with ID '${evidenceId}' not found.`);
    }

    return {
      storageKey: foundEvidence.storageKey,
      fileName: foundEvidence.fileName,
      mimeType: foundEvidence.mimeType,
      downloadUrl: `/api/v1/projects/${projectId}/checklist/evidence/${evidenceId}/content`,
      expiresInSeconds: 300
    };
  }
}
