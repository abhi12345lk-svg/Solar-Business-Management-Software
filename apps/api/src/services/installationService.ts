/**
 * INS Solar Business Management Software — Installation Service
 *
 * Core business logic and operations for the Field Installer Panel & Installation Management Module.
 */

import { Types } from 'mongoose';
import {
  InstallationStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  SitePhotoCategory,
  TechnicalManualCategory,
  CreateInstallationInput,
  UpdateInstallationInput,
  ReviewInstallationInput,
  AssignInstallationInput,
  InstallationFilterInput,
  ProjectStage,
  ProjectStatus,
  MilestoneStatus,
  DocumentCategory,
  DocumentAccessClassification,
  DocumentReviewStatus,
  DocumentStorageStatus,
  SerialNumberStatus,
  WarrantyStatus
} from '@ins-solar/shared';
import { InstallationModel, IInstallationDocument, ISitePhoto, ITechnicalManual } from '../models/Installation.js';
import { Customer } from '../models/Customer.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { getStorageAdapter } from './storage/index.js';
import { AppError } from '../errors/AppError.js';
import { Notification } from '../models/Notification.js';
import { config } from '../config/env.js';

export interface InstallationActorContext {
  actorId: string;
  actorType: 'EMPLOYEE' | 'CUSTOMER' | 'SYSTEM';
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class InstallationService {
  /**
   * 1. Create a new Installation (Draft or Assigned)
   */
  public static async createInstallation(
    input: CreateInstallationInput,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(input.customerId)) {
      throw AppError.validation(`Invalid customer ID: ${input.customerId}`);
    }

    const customer = await Customer.findById(input.customerId);
    if (!customer) {
      throw AppError.notFound(`Customer with ID '${input.customerId}' not found.`);
    }

    let project: any = null;
    if (input.projectId) {
      if (!Types.ObjectId.isValid(input.projectId)) {
        throw AppError.validation(`Invalid project ID: ${input.projectId}`);
      }
      project = await Project.findById(input.projectId);
    } else {
      // Auto-associate active EPC project for this customer
      project = await Project.findOne({
        customerId: customer._id,
        status: { $ne: ProjectStatus.CANCELLED }
      }).sort({ createdAt: -1 });
    }

    let installerName: string | undefined;
    if (input.assignedInstallerId) {
      if (!Types.ObjectId.isValid(input.assignedInstallerId)) {
        throw AppError.validation(`Invalid installer ID: ${input.assignedInstallerId}`);
      }
      const installer = await User.findById(input.assignedInstallerId);
      if (installer) {
        installerName = `${installer.firstName} ${installer.lastName}`.trim() || installer.email;
      }
    }

    const sequenceResult = await SequenceService.generateNumber(
      SequenceEntityType.INSTALLATION,
      'INST'
    );

    const siteAddr = customer.installationAddress || customer.billingAddress;
    const initialStatus = input.assignedInstallerId
      ? InstallationStatus.ASSIGNED
      : InstallationStatus.PENDING;

    const installation = new InstallationModel({
      installationNumber: sequenceResult.formattedNumber,
      customerId: customer._id,
      customerCode: customer.customerCode,
      customerName: customer.name,
      customerPhone: customer.primaryPhone,
      projectId: project?._id,
      projectCode: project?.projectCode,
      projectName: project?.name,
      siteAddress: {
        addressLine1: siteAddr?.addressLine1 || '',
        addressLine2: siteAddr?.addressLine2 || '',
        city: siteAddr?.city || '',
        district: siteAddr?.district || '',
        state: siteAddr?.state || '',
        postalCode: siteAddr?.postalCode || ''
      },
      systemCapacityKw: input.systemCapacityKw || project?.systemCapacityKwp || 0,
      assignedInstallerId: input.assignedInstallerId
        ? new Types.ObjectId(input.assignedInstallerId)
        : undefined,
      assignedInstallerName: installerName,
      assignedBy: new Types.ObjectId(actorContext.actorId),
      installationDate: input.installationDate ? new Date(input.installationDate) : undefined,
      status: initialStatus,
      isDraft: input.isDraft ?? true,
      currentStep: 1,
      earthingSystem: { name: 'Earthing System' },
      solarStructure: { name: 'Solar Mounting Structure' },
      solarPanels: { name: 'Solar PV Modules' },
      lightningProtection: { name: 'Lightning Protection Rod' },
      inverter: { name: 'Solar Inverter' },
      netMeter: { name: 'Bi-directional Net Meter' },
      panelDetails: {
        totalPanels: 0,
        manufacturer: '',
        model: '',
        wattagePerPanel: 0,
        calculatedTotalCapacityKw: 0,
        panelSerialNumbers: [],
        panelBarcodes: []
      },
      inventoryItems: [],
      photos: [],
      manuals: [],
      history: [
        {
          action: 'INSTALLATION_CREATED',
          performedBy: new Types.ObjectId(actorContext.actorId),
          performedByName: actorContext.role || 'Staff',
          timestamp: new Date(),
          notes: input.notes || 'Installation workflow initialized'
        }
      ]
    });

    await installation.save();

    // 1. Synchronize Customer lifecycle status
    try {
      if (customer.status !== 'Completed / Active') {
        customer.status = 'Site Work in Progress';
        await customer.save();
      }
    } catch (custErr) {
      console.warn('Customer status sync warning:', custErr);
    }

    // 2. Synchronize linked EPC Project status & stage
    if (project) {
      try {
        project.status = ProjectStatus.IN_PROGRESS;
        const earlyStages: ProjectStage[] = [
          ProjectStage.STAGE_1_ENGINEERING_DESIGN,
          ProjectStage.STAGE_2_NET_METERING_APPLY,
          ProjectStage.STAGE_3_MATERIAL_DISPATCH
        ];
        if (earlyStages.includes(project.currentStage)) {
          project.currentStage = ProjectStage.STAGE_4_CIVIL_STRUCTURE;
          project.stageHistory.push({
            stage: ProjectStage.STAGE_4_CIVIL_STRUCTURE,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(actorContext.actorId),
            notes: `Field Installation ${installation.installationNumber} initialized`
          });
        }
        await project.save();
      } catch (projErr) {
        console.warn('Project stage sync warning:', projErr);
      }
    }

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.INSTALLATION_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'inst-create',
      targetEntity: 'Installation',
      targetId: installation._id.toString(),
      details: {
        installationNumber: installation.installationNumber,
        customerCode: installation.customerCode
      }
    });

    return installation;
  }

  /**
   * 2. Update Installation Details / Steps
   */
  public static async updateInstallation(
    id: string,
    input: UpdateInstallationInput,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    // Role check: field installers can only edit if assigned to them or if privileged admin
    const isPrivileged = ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(
      actorContext.role || ''
    );
    if (
      !isPrivileged &&
      inst.assignedInstallerId &&
      inst.assignedInstallerId.toString() !== actorContext.actorId
    ) {
      throw AppError.forbidden('Access denied: You can only edit installations assigned to you.');
    }

    // Update basic fields if provided
    if (input.customerId && input.customerId !== inst.customerId.toString()) {
      const cust = await Customer.findById(input.customerId);
      if (cust) {
        inst.customerId = cust._id;
        inst.customerCode = cust.customerCode;
        inst.customerName = cust.name;
        inst.customerPhone = cust.primaryPhone;
        const siteAddr = cust.installationAddress || cust.billingAddress;
        if (siteAddr) {
          inst.siteAddress = {
            addressLine1: siteAddr.addressLine1 || '',
            addressLine2: siteAddr.addressLine2 || '',
            city: siteAddr.city || '',
            district: siteAddr.district || '',
            state: siteAddr.state || '',
            postalCode: siteAddr.postalCode || ''
          };
        }
      }
    }

    if (input.projectId) {
      const proj = await Project.findById(input.projectId);
      if (proj) {
        inst.projectId = proj._id;
        inst.projectCode = proj.projectCode;
        inst.projectName = proj.name;
        if (!input.systemCapacityKw && proj.systemCapacityKwp) {
          inst.systemCapacityKw = proj.systemCapacityKwp;
        }
      }
    }

    if (input.systemCapacityKw !== undefined) {
      inst.systemCapacityKw = input.systemCapacityKw;
    }

    if (input.installationDate) {
      inst.installationDate = new Date(input.installationDate);
    }

    if (input.currentStep) {
      inst.currentStep = input.currentStep;
    }

    if (input.isDraft !== undefined) {
      inst.isDraft = input.isDraft;
    }

    // Component updates
    if (input.earthingSystem) {
      inst.earthingSystem = { ...inst.earthingSystem, ...input.earthingSystem };
    }
    if (input.solarStructure) {
      inst.solarStructure = { ...inst.solarStructure, ...input.solarStructure };
    }
    if (input.solarPanels) {
      inst.solarPanels = { ...inst.solarPanels, ...input.solarPanels };
    }
    if (input.lightningProtection) {
      inst.lightningProtection = { ...inst.lightningProtection, ...input.lightningProtection };
    }
    if (input.inverter) {
      inst.inverter = { ...inst.inverter, ...input.inverter };
    }
    if (input.netMeter) {
      inst.netMeter = { ...inst.netMeter, ...input.netMeter };
    }

    // Panel Details with automatic capacity calculation
    if (input.panelDetails) {
      const totalPanels = input.panelDetails.totalPanels ?? inst.panelDetails.totalPanels;
      const wattage = input.panelDetails.wattagePerPanel ?? inst.panelDetails.wattagePerPanel;
      const calculatedKw = Number(((totalPanels * wattage) / 1000).toFixed(2));

      inst.panelDetails = {
        ...inst.panelDetails,
        ...input.panelDetails,
        calculatedTotalCapacityKw: calculatedKw
      };

      if (!inst.systemCapacityKw || inst.systemCapacityKw === 0) {
        inst.systemCapacityKw = calculatedKw;
      }
    }

    // Dynamic Inventory Barcodes
    if (input.inventoryItems) {
      inst.inventoryItems = input.inventoryItems.map(item => ({
        ...item,
        scannedAt: item.scannedAt ? new Date(item.scannedAt) : new Date()
      })) as any;
    }

    // Site Photos (Max 10)
    if (input.photos) {
      if (input.photos.length > 10) {
        throw AppError.validation('Maximum 10 site photographs are permitted per installation.');
      }
      inst.photos = input.photos.map(p => ({
        ...p,
        uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : new Date(),
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
      })) as any;
    }

    // Live GPS Location
    if (input.location) {
      const gUrl = `https://www.google.com/maps/search/?api=1&query=${input.location.latitude},${input.location.longitude}`;
      inst.location = {
        ...input.location,
        capturedAt: input.location.capturedAt ? new Date(input.location.capturedAt) : new Date(),
        isVerified: true,
        googleMapsUrl: gUrl
      };

      // Synchronize verified rooftop GPS coordinates to Customer profile
      try {
        await Customer.findByIdAndUpdate(inst.customerId, {
          'installationAddress.geoCoordinates': {
            latitude: input.location.latitude,
            longitude: input.location.longitude
          }
        });
      } catch (custGpsErr) {
        console.warn('Customer GPS coordinate sync warning:', custGpsErr);
      }
    }

    // Manuals
    if (input.manuals) {
      inst.manuals = input.manuals.map(m => ({
        ...m,
        uploadedAt: m.uploadedAt ? new Date(m.uploadedAt) : new Date()
      })) as any;
    }

    // Advance linked EPC Project stage based on current installation progress
    if (inst.projectId) {
      try {
        const proj = await Project.findById(inst.projectId);
        if (proj && proj.status !== ProjectStatus.CANCELLED) {
          let targetStage = proj.currentStage;
          if (
            (inst.currentStep >= 5 || (input.currentStep && input.currentStep >= 5)) &&
            [
              ProjectStage.STAGE_1_ENGINEERING_DESIGN,
              ProjectStage.STAGE_2_NET_METERING_APPLY,
              ProjectStage.STAGE_3_MATERIAL_DISPATCH,
              ProjectStage.STAGE_4_CIVIL_STRUCTURE
            ].includes(proj.currentStage)
          ) {
            targetStage = ProjectStage.STAGE_5_MODULE_DC_CABLING;
          }
          if (
            (inst.currentStep >= 7 || (input.currentStep && input.currentStep >= 7)) &&
            [
              ProjectStage.STAGE_4_CIVIL_STRUCTURE,
              ProjectStage.STAGE_5_MODULE_DC_CABLING,
              ProjectStage.STAGE_6_INVERTER_ACDB
            ].includes(proj.currentStage)
          ) {
            targetStage = ProjectStage.STAGE_7_EARTHING_LIGHTNING;
          }
          if (targetStage !== proj.currentStage) {
            proj.currentStage = targetStage;
            proj.status = ProjectStatus.IN_PROGRESS;
            proj.stageHistory.push({
              stage: targetStage,
              changedAt: new Date(),
              changedBy: new Types.ObjectId(actorContext.actorId),
              notes: `Progressed during installation ${inst.installationNumber} (Step ${inst.currentStep})`
            });
            await proj.save();
          }
        }
      } catch (projErr) {
        console.warn('Project stage progress sync warning:', projErr);
      }
    }

    // If status is transitioning from ASSIGNED to IN_PROGRESS
    if (input.status) {
      inst.status = input.status;
    } else if (inst.status === InstallationStatus.ASSIGNED && !inst.isDraft) {
      inst.status = InstallationStatus.IN_PROGRESS;
    }

    inst.history.push({
      action: 'INSTALLATION_UPDATED',
      performedBy: new Types.ObjectId(actorContext.actorId),
      performedByName: actorContext.role || 'Staff',
      timestamp: new Date(),
      notes: input.notes || `Step ${inst.currentStep} updated`
    });

    await inst.save();

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.INSTALLATION_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'inst-update',
      targetEntity: 'Installation',
      targetId: inst._id.toString(),
      details: {
        installationNumber: inst.installationNumber,
        currentStep: inst.currentStep,
        status: inst.status
      }
    });

    return inst;
  }

  /**
   * 3. Submit Installation Report for Admin Review
   */
  public static async submitInstallation(
    id: string,
    notes: string | undefined,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    // Verification before submission
    if (!inst.photos || inst.photos.length === 0) {
      throw AppError.validation('At least 1 site photograph is required before submitting the installation report.');
    }

    inst.status = InstallationStatus.SUBMITTED;
    inst.isDraft = false;
    inst.completedDate = new Date();
    inst.currentStep = 11;

    inst.history.push({
      action: 'INSTALLATION_SUBMITTED',
      performedBy: new Types.ObjectId(actorContext.actorId),
      performedByName: actorContext.role || 'Field Installer',
      timestamp: new Date(),
      notes: notes || 'Installation report submitted for administrative review & approval'
    });

    await inst.save();

    // Advance linked EPC project to Stage 8 (Testing & Pre-Commissioning)
    if (inst.projectId) {
      try {
        const proj = await Project.findById(inst.projectId);
        if (proj && proj.status !== ProjectStatus.CANCELLED) {
          proj.currentStage = ProjectStage.STAGE_8_TESTING_PRE_COMMISSION;
          proj.status = ProjectStatus.IN_PROGRESS;
          proj.stageHistory.push({
            stage: ProjectStage.STAGE_8_TESTING_PRE_COMMISSION,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(actorContext.actorId),
            notes: `Field installation submitted (${inst.installationNumber}) - Pre-commissioning testing ready`
          });
          await proj.save();
        }
      } catch (projErr) {
        console.warn('Project stage submit sync warning:', projErr);
      }
    }

    // Notify Superadmins / Admins
    try {
      const admins = await User.find({ role: { $in: ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] } });
      for (const admin of admins) {
        await Notification.create({
          notificationNumber: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          recipientId: admin._id,
          recipientType: 'EMPLOYEE',
          category: 'DOCUMENT',
          channel: 'IN_APP',
          title: `Installation Submitted: ${inst.installationNumber}`,
          body: `Field installer submitted solar installation report for ${inst.customerName} (${inst.installationNumber}). Please verify and approve.`,
          deliveryStatus: 'DELIVERED',
          actionUrl: `/installations/${inst._id}`
        });
      }
    } catch (notifErr) {
      console.warn('Failed to dispatch notification:', notifErr);
    }

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.INSTALLATION_SUBMITTED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'inst-submit',
      targetEntity: 'Installation',
      targetId: inst._id.toString(),
      details: {
        installationNumber: inst.installationNumber,
        photosCount: inst.photos.length,
        panelsCount: inst.panelDetails.totalPanels
      }
    });

    return inst;
  }

  /**
   * 4. Admin Review: Approve or Reject Installation
   */
  public static async reviewInstallation(
    id: string,
    input: ReviewInstallationInput,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    const isPrivileged = ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(
      actorContext.role || ''
    );
    if (!isPrivileged) {
      throw AppError.forbidden('Only administrative roles can approve or reject installation reports.');
    }

    inst.reviewedBy = new Types.ObjectId(actorContext.actorId);
    inst.reviewedAt = new Date();
    inst.adminRemarks = input.adminRemarks?.trim() || '';

    if (input.action === 'APPROVE') {
      inst.status = InstallationStatus.APPROVED;
      inst.rejectionReason = undefined;

      inst.history.push({
        action: 'INSTALLATION_APPROVED',
        performedBy: new Types.ObjectId(actorContext.actorId),
        performedByName: actorContext.role || 'Admin',
        timestamp: new Date(),
        notes: input.adminRemarks || 'Installation report approved by QA / Admin'
      });

      // 1. Synchronize Customer status to Completed / Active
      try {
        await Customer.findByIdAndUpdate(inst.customerId, {
          status: 'Completed / Active'
        });
      } catch (custErr) {
        console.warn('Customer status completion warning:', custErr);
      }

      // 2. Synchronize linked EPC Project to Stage 10 Handover and mark Completed
      if (inst.projectId) {
        try {
          const proj = await Project.findById(inst.projectId);
          if (proj) {
            proj.status = ProjectStatus.COMPLETED;
            proj.currentStage = ProjectStage.STAGE_10_COMMISSION_HANDOVER;
            proj.actualCompletionDate = new Date();
            proj.stageHistory.push({
              stage: ProjectStage.STAGE_10_COMMISSION_HANDOVER,
              changedAt: new Date(),
              changedBy: new Types.ObjectId(actorContext.actorId),
              notes: `Installation report approved (${inst.installationNumber}). Plant successfully commissioned.`
            });
            // Complete all installation and commissioning milestones
            if (proj.milestones && proj.milestones.length > 0) {
              for (const m of proj.milestones) {
                const mNameLower = (m.name || '').toLowerCase();
                if (
                  mNameLower.includes('install') ||
                  mNameLower.includes('commission') ||
                  mNameLower.includes('cabling') ||
                  mNameLower.includes('structure') ||
                  mNameLower.includes('wiring') ||
                  mNameLower.includes('civil')
                ) {
                  m.status = MilestoneStatus.COMPLETED;
                  m.actualCompletionDate = new Date();
                  m.completedBy = new Types.ObjectId(actorContext.actorId);
                  m.completedAt = new Date();
                }
              }
            }
            await proj.save();
          }
        } catch (projErr) {
          console.warn('Project completion sync warning:', projErr);
        }
      }

      // 3. Synchronize all installed hardware serial numbers in asset database
      const serialNumbersToSync = new Set<string>();
      if (inst.inverter?.serialNumber) serialNumbersToSync.add(inst.inverter.serialNumber.trim().toUpperCase());
      if (inst.netMeter?.serialNumber) serialNumbersToSync.add(inst.netMeter.serialNumber.trim().toUpperCase());
      if (inst.solarStructure?.serialNumber) serialNumbersToSync.add(inst.solarStructure.serialNumber.trim().toUpperCase());
      if (inst.lightningProtection?.serialNumber) serialNumbersToSync.add(inst.lightningProtection.serialNumber.trim().toUpperCase());
      if (inst.panelDetails?.panelSerialNumbers) {
        for (const sn of inst.panelDetails.panelSerialNumbers) {
          if (sn && sn.trim()) serialNumbersToSync.add(sn.trim().toUpperCase());
        }
      }
      if (inst.inventoryItems) {
        for (const it of inst.inventoryItems) {
          if (it.serialNumber && it.serialNumber.trim()) serialNumbersToSync.add(it.serialNumber.trim().toUpperCase());
        }
      }

      for (const sn of serialNumbersToSync) {
        try {
          await ProductSerialNumber.findOneAndUpdate(
            { serialNumber: sn },
            {
              $set: {
                status: SerialNumberStatus.INSTALLED,
                customerId: inst.customerId,
                projectId: inst.projectId || undefined,
                commissioningDate: new Date(),
                warrantyStartDate: new Date(),
                warrantyStatus: WarrantyStatus.ACTIVE,
                notes: `Installed via report ${inst.installationNumber}`
              }
            }
          );
        } catch (snErr) {
          console.warn(`Serial number sync notice for ${sn}:`, snErr);
        }
      }

      // 4. Dispatch in-app notification to assigned installer crew
      if (inst.assignedInstallerId) {
        try {
          await Notification.create({
            notificationNumber: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            recipientId: inst.assignedInstallerId,
            recipientType: 'EMPLOYEE',
            category: 'DOCUMENT',
            channel: 'IN_APP',
            title: `Installation Approved: ${inst.installationNumber}`,
            body: `Solar installation for ${inst.customerName} has been approved by admin and marked commissioned!`,
            deliveryStatus: 'DELIVERED',
            actionUrl: `/installations/${inst._id}`
          });
        } catch (notifErr) {
          console.warn('Installer approval notification warning:', notifErr);
        }
      }

      await AuditService.recordEvent({
        actorId: actorContext.actorId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.INSTALLATION_APPROVED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: actorContext.ipAddress,
        userAgent: actorContext.userAgent,
        correlationId: actorContext.correlationId || 'inst-approve',
        targetEntity: 'Installation',
        targetId: inst._id.toString(),
        details: { installationNumber: inst.installationNumber }
      });
    } else {
      inst.status = InstallationStatus.REJECTED;
      inst.rejectionReason = input.rejectionReason?.trim() || 'Corrections required.';

      inst.history.push({
        action: 'INSTALLATION_REJECTED',
        performedBy: new Types.ObjectId(actorContext.actorId),
        performedByName: actorContext.role || 'Admin',
        timestamp: new Date(),
        notes: `Rejected: ${inst.rejectionReason}`
      });

      // Notify installer
      if (inst.assignedInstallerId) {
        try {
          await Notification.create({
            notificationNumber: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            recipientId: inst.assignedInstallerId,
            recipientType: 'EMPLOYEE',
            category: 'DOCUMENT',
            channel: 'IN_APP',
            title: `Installation Report Rejected: ${inst.installationNumber}`,
            body: `Admin returned installation for ${inst.customerName}. Reason: ${inst.rejectionReason}. Please correct and resubmit.`,
            deliveryStatus: 'DELIVERED',
            actionUrl: `/installations/${inst._id}/edit`
          });
        } catch {
          // ignore
        }
      }

      await AuditService.recordEvent({
        actorId: actorContext.actorId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.INSTALLATION_REJECTED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: actorContext.ipAddress,
        userAgent: actorContext.userAgent,
        correlationId: actorContext.correlationId || 'inst-reject',
        targetEntity: 'Installation',
        targetId: inst._id.toString(),
        details: {
          installationNumber: inst.installationNumber,
          rejectionReason: inst.rejectionReason
        }
      });
    }

    await inst.save();
    return inst;
  }

  /**
   * 5. Assign Installation to Installer
   */
  public static async assignInstallation(
    id: string,
    input: AssignInstallationInput,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(input.assignedInstallerId)) {
      throw AppError.validation('Invalid installation or installer ID.');
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    const installer = await User.findById(input.assignedInstallerId);
    if (!installer) {
      throw AppError.notFound(`Installer with ID '${input.assignedInstallerId}' not found.`);
    }

    inst.assignedInstallerId = installer._id;
    inst.assignedInstallerName = installer.firstName
      ? `${installer.firstName} ${installer.lastName || ''}`.trim()
      : (installer.email || 'Installer');
    inst.assignedBy = new Types.ObjectId(actorContext.actorId);
    if (input.installationDate) {
      inst.installationDate = new Date(input.installationDate);
    }
    if (inst.status === InstallationStatus.PENDING) {
      inst.status = InstallationStatus.ASSIGNED;
    }

    inst.history.push({
      action: 'INSTALLATION_ASSIGNED',
      performedBy: new Types.ObjectId(actorContext.actorId),
      performedByName: actorContext.role || 'Admin',
      timestamp: new Date(),
      notes: `Assigned to ${inst.assignedInstallerName}. ${input.notes || ''}`
    });

    await inst.save();

    // Notify installer
    try {
      await Notification.create({
        notificationNumber: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        recipientId: installer._id,
        recipientType: 'EMPLOYEE',
        category: 'DOCUMENT',
        channel: 'IN_APP',
        title: `New Installation Assigned: ${inst.installationNumber}`,
        body: `You have been assigned to solar installation for ${inst.customerName} (${inst.siteAddress.city || 'Site'}).`,
        deliveryStatus: 'DELIVERED',
        actionUrl: `/installations/${inst._id}`
      });
    } catch {
      // ignore
    }

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.INSTALLATION_ASSIGNED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'inst-assign',
      targetEntity: 'Installation',
      targetId: inst._id.toString(),
      details: {
        installationNumber: inst.installationNumber,
        installerId: installer._id.toString()
      }
    });

    return inst;
  }

  /**
   * 6. Get Installation by ID
   */
  public static async getInstallationById(
    id: string,
    actorContext: InstallationActorContext
  ): Promise<IInstallationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id)
      .populate('customerId', 'name customerCode primaryPhone email installationAddress billingAddress')
      .populate('projectId', 'projectCode name systemCapacityKwp status currentStage')
      .populate('assignedInstallerId', 'fullName displayName email phone role');

    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    // Role check: field installers can only view their own installations
    const isPrivileged = ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(
      actorContext.role || ''
    );
    if (
      !isPrivileged &&
      inst.assignedInstallerId &&
      (inst.assignedInstallerId as any)._id?.toString() !== actorContext.actorId &&
      inst.assignedInstallerId.toString() !== actorContext.actorId
    ) {
      throw AppError.forbidden('Access denied: You do not have permission to view this installation.');
    }

    return inst;
  }

  /**
   * 7. List Installations with Filters & Pagination
   */
  public static async listInstallations(
    filter: InstallationFilterInput,
    actorContext: InstallationActorContext
  ): Promise<{
    installations: IInstallationDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: any = {};

    // Scope check: if installer, only show assigned installations
    const isPrivileged = ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(
      actorContext.role || ''
    );
    if (!isPrivileged) {
      query.assignedInstallerId = new Types.ObjectId(actorContext.actorId);
    } else if (filter.installerId) {
      query.assignedInstallerId = new Types.ObjectId(filter.installerId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.customerId) {
      query.customerId = new Types.ObjectId(filter.customerId);
    }

    if (filter.search && filter.search.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { installationNumber: regex },
        { customerName: regex },
        { customerCode: regex },
        { projectCode: regex },
        { 'siteAddress.city': regex },
        { assignedInstallerName: regex }
      ];
    }

    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [installations, total] = await Promise.all([
      InstallationModel.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name customerCode primaryPhone')
        .populate('assignedInstallerId', 'fullName displayName phone'),
      InstallationModel.countDocuments(query)
    ]);

    return {
      installations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 8. Summary Dashboard Statistics
   */
  public static async getDashboardStats(
    actorContext: InstallationActorContext
  ): Promise<{
    totalAssigned: number;
    pending: number;
    inProgress: number;
    completed: number;
    pendingApproval: number;
    rejected: number;
  }> {
    const query: any = {};
    const isPrivileged = ['SUPERADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(
      actorContext.role || ''
    );
    if (!isPrivileged) {
      query.assignedInstallerId = new Types.ObjectId(actorContext.actorId);
    }

    const [total, pending, inProgress, approved, completed, submitted, underReview, rejected] =
      await Promise.all([
        InstallationModel.countDocuments(query),
        InstallationModel.countDocuments({
          ...query,
          status: { $in: [InstallationStatus.ASSIGNED, InstallationStatus.PENDING] }
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.IN_PROGRESS
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.APPROVED
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.COMPLETED
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.SUBMITTED
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.UNDER_REVIEW
        }),
        InstallationModel.countDocuments({
          ...query,
          status: InstallationStatus.REJECTED
        })
      ]);

    return {
      totalAssigned: total,
      pending,
      inProgress,
      completed: approved + completed,
      pendingApproval: submitted + underReview,
      rejected
    };
  }

  /**
   * 9. Upload & Attach Site Photograph
   */
  public static async uploadSitePhoto(
    id: string,
    fileBuffer: Buffer,
    meta: {
      category: SitePhotoCategory;
      title: string;
      originalFilename: string;
      mimeType: string;
      gpsLocation?: { latitude: number; longitude: number; accuracyMeters?: number };
      remarks?: string;
    },
    actorContext: InstallationActorContext
  ): Promise<ISitePhoto> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    if (inst.photos.length >= 10) {
      throw AppError.validation('Maximum limit of 10 photographs already reached for this installation.');
    }

    const storageAdapter = getStorageAdapter();
    const sanitizedFilename = meta.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `installations/${inst._id}/photos/${Date.now()}_${sanitizedFilename}`;

    await storageAdapter.uploadObject(storageKey, fileBuffer, {
      contentType: meta.mimeType,
      contentLength: fileBuffer.length,
      metadata: {
        installationNumber: inst.installationNumber,
        category: meta.category
      }
    });

    const fileUrl = `/api/v1/installations/${inst._id}/photos-raw?key=${encodeURIComponent(storageKey)}`;

    // Remove any existing photo with the exact same category if user is replacing
    inst.photos = inst.photos.filter(p => p.category !== meta.category);

    const newPhoto: ISitePhoto = {
      category: meta.category,
      title: meta.title || meta.category.replace(/_/g, ' '),
      storageKey,
      fileUrl,
      originalFilename: meta.originalFilename,
      mimeType: meta.mimeType,
      fileSizeBytes: fileBuffer.length,
      uploadedAt: new Date(),
      timestamp: new Date(),
      gpsLocation: meta.gpsLocation,
      remarks: meta.remarks
    };

    inst.photos.push(newPhoto);

    inst.history.push({
      action: 'PHOTO_UPLOADED',
      performedBy: new Types.ObjectId(actorContext.actorId),
      performedByName: actorContext.role || 'Installer',
      timestamp: new Date(),
      notes: `Uploaded photograph: ${newPhoto.title}`
    });

    await inst.save();

    // Synchronize photo into Private Document Vault
    try {
      const docSeq = await SequenceService.generateNumber(SequenceEntityType.DOCUMENT, 'DOC');
      await DocumentModel.create({
        documentNumber: docSeq.formattedNumber,
        originalFilename: meta.originalFilename,
        safeDisplayName: `${meta.title || meta.category.replace(/_/g, ' ')} - ${inst.customerName}`,
        category: DocumentCategory.SITE_PHOTOS,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        reviewStatus: DocumentReviewStatus.ACCEPTED,
        storageKey,
        storageStatus:
          config.STORAGE_PROVIDER === 's3'
            ? DocumentStorageStatus.STORED_S3
            : DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
        mimeType: meta.mimeType || 'image/jpeg',
        fileSizeBytes: fileBuffer.length,
        version: 1,
        isLatestVersion: true,
        customerId: inst.customerId,
        projectId: inst.projectId || undefined,
        relatedEntityType: 'Installation',
        relatedEntityId: inst._id,
        uploadedBy: new Types.ObjectId(actorContext.actorId),
        uploadedByType: 'EMPLOYEE',
        isArchived: false,
        metadata: {
          installationNumber: inst.installationNumber,
          category: meta.category,
          gpsLocation: meta.gpsLocation
        }
      });
    } catch (vaultErr) {
      console.warn('Document Vault photo sync notice:', vaultErr);
    }

    return newPhoto;
  }

  /**
   * 10. Upload & Attach Technical Manual
   */
  public static async uploadManual(
    id: string,
    fileBuffer: Buffer,
    meta: {
      category: TechnicalManualCategory;
      title: string;
      originalFilename: string;
      mimeType: string;
    },
    actorContext: InstallationActorContext
  ): Promise<ITechnicalManual> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid installation ID: ${id}`);
    }

    const inst = await InstallationModel.findById(id);
    if (!inst) {
      throw AppError.notFound(`Installation with ID '${id}' not found.`);
    }

    const storageAdapter = getStorageAdapter();
    const sanitizedFilename = meta.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `installations/${inst._id}/manuals/${Date.now()}_${sanitizedFilename}`;

    await storageAdapter.uploadObject(storageKey, fileBuffer, {
      contentType: meta.mimeType,
      contentLength: fileBuffer.length,
      metadata: {
        installationNumber: inst.installationNumber,
        category: meta.category
      }
    });

    const fileUrl = `/api/v1/installations/${inst._id}/manuals-raw?key=${encodeURIComponent(storageKey)}`;

    const newManual: ITechnicalManual = {
      category: meta.category,
      title: meta.title,
      storageKey,
      fileUrl,
      fileName: meta.originalFilename,
      fileSizeBytes: fileBuffer.length,
      mimeType: meta.mimeType,
      uploadedAt: new Date(),
      uploadedBy: new Types.ObjectId(actorContext.actorId)
    };

    inst.manuals.push(newManual);
    await inst.save();

    // Synchronize manual into Private Document Vault
    try {
      const docSeq = await SequenceService.generateNumber(SequenceEntityType.DOCUMENT, 'DOC');
      await DocumentModel.create({
        documentNumber: docSeq.formattedNumber,
        originalFilename: meta.originalFilename,
        safeDisplayName: `${meta.title} - ${inst.customerName}`,
        category: DocumentCategory.COMMISSIONING_REPORT,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        reviewStatus: DocumentReviewStatus.ACCEPTED,
        storageKey,
        storageStatus:
          config.STORAGE_PROVIDER === 's3'
            ? DocumentStorageStatus.STORED_S3
            : DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
        mimeType: meta.mimeType || 'application/pdf',
        fileSizeBytes: fileBuffer.length,
        version: 1,
        isLatestVersion: true,
        customerId: inst.customerId,
        projectId: inst.projectId || undefined,
        relatedEntityType: 'Installation',
        relatedEntityId: inst._id,
        uploadedBy: new Types.ObjectId(actorContext.actorId),
        uploadedByType: 'EMPLOYEE',
        isArchived: false,
        metadata: {
          installationNumber: inst.installationNumber,
          category: meta.category
        }
      });
    } catch (vaultErr) {
      console.warn('Document Vault manual sync notice:', vaultErr);
    }

    return newManual;
  }
}
