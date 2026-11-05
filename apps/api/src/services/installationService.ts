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
  InstallationFilterInput
} from '@ins-solar/shared';
import { InstallationModel, IInstallationDocument, ISitePhoto, ITechnicalManual } from '../models/Installation.js';
import { Customer } from '../models/Customer.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { getStorageAdapter } from './storage/index.js';
import { AppError } from '../errors/AppError.js';
import { Notification } from '../models/Notification.js';

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
    }

    // Manuals
    if (input.manuals) {
      inst.manuals = input.manuals.map(m => ({
        ...m,
        uploadedAt: m.uploadedAt ? new Date(m.uploadedAt) : new Date()
      })) as any;
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

      // Synchronize Project stage if linked
      if (inst.projectId) {
        try {
          const proj = await Project.findById(inst.projectId);
          if (proj) {
            proj.status = 'IN_PROGRESS' as any;
            await proj.save();
          }
        } catch {
          // ignore
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

    const fileUrl = `/api/v1/installations/${inst._id}/photos/${encodeURIComponent(storageKey)}`;

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

    const fileUrl = `/api/v1/installations/${inst._id}/manuals/${encodeURIComponent(storageKey)}`;

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

    return newManual;
  }
}
