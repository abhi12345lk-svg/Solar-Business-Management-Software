/**
 * INS Solar Business Management Software — Net Metering Service
 *
 * Implements enterprise utility grid-interconnection lifecycle, document validation gates,
 * DISCOM inspection scheduling, bi-directional meter recording, and customer isolation.
 */

import { Types } from 'mongoose';
import {
  SequenceEntityType,
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  ApplicationDocumentType,
  ApplicationDocumentStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  CreateNetMeteringInput,
  UpdateNetMeteringInput,
  UpdateNetMeteringStatusInput,
  ScheduleInspectionInput,
  RecordInspectionOutcomeInput,
  RecordMeterInstallationInput,
  UpdateFeasibilityDemandNoteInput,
  UploadApplicationDocumentInput,
  ReviewApplicationDocumentInput,
  NetMeteringFilterInput
} from '@ins-solar/shared';
import {
  NetMeteringApplication,
  INetMeteringApplicationDocument,
  IApplicationDocument
} from '../models/NetMeteringApplication.js';
import { Project } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { NotificationReminderService } from './notificationReminderService.js';
import { AppError } from '../errors/AppError.js';

export class NetMeteringService {
  /**
   * 1. Create a new Net Metering application with atomic sequence number.
   */
  public static async createApplication(
    input: CreateNetMeteringInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(input.projectId)) {
      throw AppError.validation(`Invalid project ID '${input.projectId}'.`);
    }

    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project '${input.projectId}' not found.`);
    }

    // Resolve or validate customer
    let customerId = project.customerId.toString();
    if (input.customerId) {
      if (input.customerId !== customerId) {
        throw AppError.businessRule(
          `Customer ID '${input.customerId}' does not match the project's customer '${customerId}'. Cross-project references are forbidden.`
        );
      }
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw AppError.notFound(`Customer '${customerId}' not found.`);
    }

    // Generate atomic sequence reference
    const seq = await SequenceService.generateNumber(SequenceEntityType.NET_METERING);
    const applicationNumber = seq.formattedNumber;

    // Initial default required document slots
    const defaultDocuments: IApplicationDocument[] = [
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.ELECTRICITY_BILL,
        title: 'Latest Electricity Bill with Consumer / CA Number',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.PROPERTY_TAX_RECEIPT,
        title: 'Property Tax Receipt / Ownership Proof',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.CONSUMER_AADHAAR,
        title: 'Consumer Identity Proof (Aadhaar / ID)',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.SOLAR_SLD,
        title: 'Solar Single Line Diagram (SLD)',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.TEST_CERTIFICATE,
        title: 'Inverter & Module Factory Test Certificates',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      }
    ];

    const application = new NetMeteringApplication({
      applicationNumber,
      projectId: project._id,
      customerId: customer._id,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined,
      discomName: input.discomName.trim(),
      division: input.division?.trim(),
      subdivision: input.subdivision?.trim(),
      section: input.section?.trim(),
      consumerNumber: input.consumerNumber.trim(),
      sanctionedLoadKw: input.sanctionedLoadKw,
      proposedCapacityKw: input.proposedCapacityKw || project.systemCapacityKwp,
      discomApplicationNumber: input.discomApplicationNumber?.trim(),
      submissionDate: input.submissionDate ? new Date(input.submissionDate) : undefined,
      status: NetMeteringStatus.DRAFT,
      inspectionSchedule: {
        outcome: NetMeteringInspectionOutcome.PENDING
      },
      meterInstallation: {
        meterInstalled: false,
        initialImportReadingKwh: 0,
        initialExportReadingKwh: 0
      },
      feasibility: {
        demandNotePaid: false
      },
      assignedUserId: input.assignedUserId ? new Types.ObjectId(input.assignedUserId) : undefined,
      documents: defaultDocuments,
      statusHistory: [
        {
          status: NetMeteringStatus.DRAFT,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          notes: input.notes || 'Application draft created'
        }
      ],
      notes: input.notes?.trim()
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-create',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber,
        projectId: project._id.toString(),
        customerId: customer._id.toString(),
        discomName: input.discomName,
        consumerNumber: input.consumerNumber
      }
    });

    return application;
  }

  /**
   * 2. Update Net Metering application details.
   */
  public static async updateApplication(
    id: string,
    input: UpdateNetMeteringInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    if (input.discomName !== undefined) application.discomName = input.discomName.trim();
    if (input.division !== undefined) application.division = input.division?.trim();
    if (input.subdivision !== undefined) application.subdivision = input.subdivision?.trim();
    if (input.section !== undefined) application.section = input.section?.trim();
    if (input.consumerNumber !== undefined)
      application.consumerNumber = input.consumerNumber.trim();
    if (input.sanctionedLoadKw !== undefined) application.sanctionedLoadKw = input.sanctionedLoadKw;
    if (input.proposedCapacityKw !== undefined)
      application.proposedCapacityKw = input.proposedCapacityKw;
    if (input.discomApplicationNumber !== undefined)
      application.discomApplicationNumber = input.discomApplicationNumber?.trim();
    if (input.submissionDate !== undefined)
      application.submissionDate = input.submissionDate
        ? new Date(input.submissionDate)
        : undefined;
    if (input.assignedUserId !== undefined) {
      application.assignedUserId = input.assignedUserId
        ? new Types.ObjectId(input.assignedUserId)
        : undefined;
    }
    if (input.notes !== undefined) application.notes = input.notes?.trim();

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-update',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: { applicationNumber: application.applicationNumber }
    });

    return application;
  }

  /**
   * 3. Validated state transition with required document verification gate.
   */
  public static async transitionStatus(
    id: string,
    input: UpdateNetMeteringStatusInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    const currentStatus = application.status;
    const newStatus = input.status;

    if (currentStatus === newStatus) {
      return application;
    }

    // Permitted state transitions validation
    const validTransitions: Record<NetMeteringStatus, NetMeteringStatus[]> = {
      [NetMeteringStatus.DRAFT]: [
        NetMeteringStatus.DOCUMENTS_PENDING,
        NetMeteringStatus.READY_TO_SUBMIT,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.DOCUMENTS_PENDING]: [
        NetMeteringStatus.READY_TO_SUBMIT,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.READY_TO_SUBMIT]: [
        NetMeteringStatus.SUBMITTED,
        NetMeteringStatus.DOCUMENTS_PENDING,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.SUBMITTED]: [
        NetMeteringStatus.UNDER_REVIEW,
        NetMeteringStatus.INSPECTION_SCHEDULED,
        NetMeteringStatus.REJECTED,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.UNDER_REVIEW]: [
        NetMeteringStatus.INSPECTION_SCHEDULED,
        NetMeteringStatus.APPROVED,
        NetMeteringStatus.REJECTED,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.INSPECTION_SCHEDULED]: [
        NetMeteringStatus.APPROVED,
        NetMeteringStatus.REJECTED,
        NetMeteringStatus.UNDER_REVIEW
      ],
      [NetMeteringStatus.APPROVED]: [NetMeteringStatus.CANCELLED],
      [NetMeteringStatus.REJECTED]: [
        // Allow permitted resubmission/corrections
        NetMeteringStatus.DOCUMENTS_PENDING,
        NetMeteringStatus.READY_TO_SUBMIT,
        NetMeteringStatus.UNDER_REVIEW,
        NetMeteringStatus.CANCELLED
      ],
      [NetMeteringStatus.CANCELLED]: []
    };

    const allowed = (validTransitions as Record<string, NetMeteringStatus[]>)[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw AppError.businessRule(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. Permitted targets: [${allowed.join(', ')}].`
      );
    }

    // DOCUMENT VERIFICATION GATE:
    // If transitioning to READY_TO_SUBMIT or SUBMITTED, verify all required documents are uploaded & not rejected/expired
    if (
      newStatus === NetMeteringStatus.READY_TO_SUBMIT ||
      newStatus === NetMeteringStatus.SUBMITTED
    ) {
      const blockingDocs = application.documents.filter((doc: IApplicationDocument) => {
        if (!doc.isRequired) return false;
        const isNotUploaded = doc.status === ApplicationDocumentStatus.REQUIRED || !doc.storageKey;
        const isRejected =
          doc.status === ApplicationDocumentStatus.REJECTED ||
          doc.status === ApplicationDocumentStatus.RESUBMISSION_REQUIRED;
        const isExpired = doc.status === ApplicationDocumentStatus.EXPIRED;
        return isNotUploaded || isRejected || isExpired;
      });

      if (blockingDocs.length > 0) {
        const issues = blockingDocs
          .map((d: IApplicationDocument) => `${d.title} (${d.status})`)
          .join('; ');
        throw AppError.businessRule(
          `Cannot transition application to '${newStatus}'. Required documents are missing or rejected: [${issues}].`
        );
      }
    }

    application.status = newStatus;
    if (newStatus === NetMeteringStatus.APPROVED) {
      application.approvalDate = new Date();
    } else if (newStatus === NetMeteringStatus.REJECTED) {
      application.rejectionDate = new Date();
      if (input.reason) application.rejectionReason = input.reason;
    }

    application.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      notes: input.notes,
      reason: input.reason
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-status-change',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        previousStatus: currentStatus,
        newStatus,
        reason: input.reason
      }
    });

    return application;
  }

  /**
   * 4. Schedule or reschedule DISCOM field inspection.
   */
  public static async scheduleInspection(
    id: string,
    input: ScheduleInspectionInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    const scheduledDate = new Date(input.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      throw AppError.validation('Invalid inspection date format.');
    }

    application.inspectionSchedule = {
      scheduledDate,
      outcome: NetMeteringInspectionOutcome.PENDING,
      officerName: input.officerName?.trim(),
      officerContact: input.officerContact?.trim(),
      notes: input.notes?.trim(),
      rescheduleReason: input.rescheduleReason?.trim()
    };

    // Transition to INSPECTION_SCHEDULED if currently submitted or under review
    if (
      application.status === NetMeteringStatus.SUBMITTED ||
      application.status === NetMeteringStatus.UNDER_REVIEW
    ) {
      application.status = NetMeteringStatus.INSPECTION_SCHEDULED;
      application.statusHistory.push({
        status: NetMeteringStatus.INSPECTION_SCHEDULED,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(user.userId),
        notes: `Inspection scheduled for ${scheduledDate.toISOString().split('T')[0]}`
      });
    }

    await application.save();

    // Trigger deduplicated inspection reminder
    await NotificationReminderService.scheduleOrSendReminder({
      reminderType: 'UPCOMING_INSPECTION',
      entityType: 'NetMeteringApplication',
      entityId: application._id.toString(),
      recipientName: input.officerName || 'Site Engineer',
      subject: `DISCOM Inspection Scheduled: Application ${application.applicationNumber}`,
      message: `DISCOM field inspection is scheduled for ${scheduledDate.toDateString()} at Consumer Connection ${application.consumerNumber}.`,
      scheduledFor: scheduledDate
    });

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_INSPECTION_SCHEDULED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-inspection-schedule',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        scheduledDate,
        officerName: input.officerName
      }
    });

    return application;
  }

  /**
   * 5. Record inspection outcome (PASSED / FAILED).
   */
  public static async recordInspectionOutcome(
    id: string,
    input: RecordInspectionOutcomeInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    application.inspectionSchedule.outcome = input.outcome;
    application.inspectionSchedule.inspectedDate = input.inspectedDate
      ? new Date(input.inspectedDate)
      : new Date();
    if (input.officerName) application.inspectionSchedule.officerName = input.officerName.trim();
    if (input.notes) application.inspectionSchedule.notes = input.notes.trim();

    if (input.outcome === NetMeteringInspectionOutcome.PASSED) {
      application.status = NetMeteringStatus.APPROVED;
      application.approvalDate = new Date();
      application.statusHistory.push({
        status: NetMeteringStatus.APPROVED,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(user.userId),
        notes: `Inspection PASSED: ${input.notes || 'Grid compliance verified'}`
      });
    } else {
      application.status = NetMeteringStatus.REJECTED;
      application.rejectionDate = new Date();
      application.rejectionReason = input.notes || 'Inspection failed grid compliance check';
      application.statusHistory.push({
        status: NetMeteringStatus.REJECTED,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(user.userId),
        notes: `Inspection FAILED: ${input.notes || 'Compliance issues detected'}`
      });
    }

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_INSPECTION_COMPLETED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-inspection-outcome',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        outcome: input.outcome,
        notes: input.notes
      }
    });

    return application;
  }

  /**
   * 6. Record bi-directional meter installation and initial readings.
   */
  public static async recordMeterInstallation(
    id: string,
    input: RecordMeterInstallationInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    // Prerequisite: Application must be approved or inspection passed
    const inspectionPassed =
      application.inspectionSchedule.outcome === NetMeteringInspectionOutcome.PASSED;
    const isApproved = application.status === NetMeteringStatus.APPROVED;

    if (!inspectionPassed && !isApproved) {
      throw AppError.businessRule(
        'Cannot record bi-directional meter installation before inspection has PASSED and application is APPROVED.'
      );
    }

    const installationDate = new Date(input.installationDate);
    if (isNaN(installationDate.getTime())) {
      throw AppError.validation('Invalid installation date.');
    }

    application.meterInstallation = {
      meterInstalled: true,
      meterNumber: input.meterNumber.trim(),
      installationDate,
      initialImportReadingKwh: input.initialImportReadingKwh || 0,
      initialExportReadingKwh: input.initialExportReadingKwh || 0,
      testedBy: input.testedBy?.trim(),
      notes: input.notes?.trim()
    };

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.NET_METERING_METER_INSTALLED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'nma-meter-installed',
      targetEntity: 'NetMeteringApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        meterNumber: input.meterNumber,
        installationDate,
        initialImportReadingKwh: input.initialImportReadingKwh,
        initialExportReadingKwh: input.initialExportReadingKwh
      }
    });

    return application;
  }

  /**
   * 7. Update feasibility and demand note details.
   */
  public static async updateFeasibilityDemandNote(
    id: string,
    input: UpdateFeasibilityDemandNoteInput,
    _user: { userId: string }
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    if (input.isFeasible !== undefined) application.feasibility.isFeasible = input.isFeasible;
    if (input.feasibilityReference !== undefined)
      application.feasibility.feasibilityReference = input.feasibilityReference?.trim();
    if (input.feasibilityDate !== undefined)
      application.feasibility.feasibilityDate = input.feasibilityDate
        ? new Date(input.feasibilityDate)
        : undefined;
    if (input.demandNoteAmountPaise !== undefined) {
      if (input.demandNoteAmountPaise < 0 || !Number.isInteger(input.demandNoteAmountPaise)) {
        throw AppError.validation('demandNoteAmountPaise must be a non-negative integer in paise.');
      }
      application.feasibility.demandNoteAmountPaise = input.demandNoteAmountPaise;
    }
    if (input.demandNotePaid !== undefined)
      application.feasibility.demandNotePaid = input.demandNotePaid;
    if (input.demandNotePaidDate !== undefined)
      application.feasibility.demandNotePaidDate = input.demandNotePaidDate
        ? new Date(input.demandNotePaidDate)
        : undefined;
    if (input.demandNoteReceiptNumber !== undefined)
      application.feasibility.demandNoteReceiptNumber = input.demandNoteReceiptNumber?.trim();

    await application.save();
    return application;
  }

  /**
   * 8. Attach private document evidence with safe storageKey boundary.
   */
  public static async uploadDocument(
    id: string,
    input: UploadApplicationDocumentInput,
    user: { userId: string }
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    // Find existing doc slot by type or create new
    let doc = application.documents.find(
      (d: IApplicationDocument) => d.documentType === input.documentType
    );
    if (!doc) {
      doc = {
        id: new Types.ObjectId().toString(),
        documentType: input.documentType,
        title: input.title || input.documentType.replace(/_/g, ' '),
        isRequired: false,
        status: ApplicationDocumentStatus.UPLOADED
      };
      application.documents.push(doc);
    }

    doc.storageKey = input.storageKey;
    doc.fileName = input.fileName;
    doc.fileSize = input.fileSize;
    doc.mimeType = input.mimeType;
    doc.uploadedBy = new Types.ObjectId(user.userId);
    doc.uploadedAt = new Date();
    doc.status = ApplicationDocumentStatus.UPLOADED;
    if (input.expiryDate) doc.expiryDate = new Date(input.expiryDate);

    // If application was DOCUMENTS_PENDING and all required docs are now uploaded, notify or allow progression
    await application.save();
    return doc;
  }

  /**
   * 9. Review document (ACCEPT / REJECT / RESUBMISSION_REQUIRED).
   */
  public static async reviewDocument(
    id: string,
    documentId: string,
    input: ReviewApplicationDocumentInput,
    user: { userId: string }
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    const doc = application.documents.find((d: IApplicationDocument) => d.id === documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found on this application.`);
    }

    doc.status = input.status;
    doc.reviewedBy = new Types.ObjectId(user.userId);
    doc.reviewedAt = new Date();
    doc.reviewNotes = input.reviewNotes?.trim();
    if (
      input.status === ApplicationDocumentStatus.REJECTED ||
      input.status === ApplicationDocumentStatus.RESUBMISSION_REQUIRED
    ) {
      doc.rejectionReason = input.rejectionReason?.trim() || input.reviewNotes?.trim();
    }

    await application.save();
    return doc;
  }

  /**
   * 10. Generate short-lived authorized view/download URL for private evidence.
   */
  public static async getAuthorizedDocumentAccess(
    id: string,
    documentId: string,
    userOrCustomer: { userId?: string; customerId?: string }
  ): Promise<{
    storageKey: string;
    fileName: string;
    mimeType: string;
    downloadUrl: string;
    expiresInSeconds: number;
  }> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    // Customer portal isolation
    if (userOrCustomer.customerId) {
      if (application.customerId.toString() !== userOrCustomer.customerId) {
        throw AppError.forbidden(
          'Access denied: You may only access documents for your own applications.'
        );
      }
    }

    const doc = application.documents.find((d: IApplicationDocument) => d.id === documentId);
    if (!doc || !doc.storageKey) {
      throw AppError.notFound(`Document '${documentId}' does not have uploaded content.`);
    }

    return {
      storageKey: doc.storageKey,
      fileName: doc.fileName || `${doc.documentType}.pdf`,
      mimeType: doc.mimeType || 'application/pdf',
      downloadUrl: `/api/v1/net-metering/${id}/documents/${documentId}/content`,
      expiresInSeconds: 300
    };
  }

  /**
   * 11. Bounded filter and list applications with customer isolation.
   */
  public static async listApplications(
    filter: NetMeteringFilterInput,
    customerId?: string
  ): Promise<{
    applications: INetMeteringApplicationDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: Record<string, any> = {};

    if (customerId) {
      query.customerId = new Types.ObjectId(customerId);
    } else if (filter.customerId) {
      query.customerId = new Types.ObjectId(filter.customerId);
    }

    if (filter.projectId) {
      query.projectId = new Types.ObjectId(filter.projectId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.discomName) {
      query.discomName = { $regex: filter.discomName, $options: 'i' };
    }

    if (filter.search) {
      query.$or = [
        { applicationNumber: { $regex: filter.search, $options: 'i' } },
        { consumerNumber: { $regex: filter.search, $options: 'i' } },
        { discomApplicationNumber: { $regex: filter.search, $options: 'i' } }
      ];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const sortOption: Record<string, 1 | -1> = {
      [filter.sortBy || 'createdAt']: filter.sortOrder === 'asc' ? 1 : -1
    };

    const [applications, total] = await Promise.all([
      NetMeteringApplication.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('projectId', 'projectCode name capacityKw systemCapacityKw status stage')
        .populate('customerId', 'customerCode name phone email')
        .populate('assignedUserId', 'firstName lastName email department'),
      NetMeteringApplication.countDocuments(query)
    ]);

    return { applications, total, page, limit };
  }

  /**
   * 12. Get single Net Metering application with customer isolation check.
   */
  public static async getApplicationById(
    id: string,
    customerId?: string
  ): Promise<INetMeteringApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await NetMeteringApplication.findById(id)
      .populate(
        'projectId',
        'projectCode name capacityKw systemCapacityKw status stage destinationSiteAddress'
      )
      .populate('customerId', 'customerCode name phone email')
      .populate('assignedUserId', 'firstName lastName email department');

    if (!application) {
      throw AppError.notFound(`Net Metering Application '${id}' not found.`);
    }

    if (
      customerId &&
      application.customerId._id?.toString() !== customerId &&
      application.customerId.toString() !== customerId
    ) {
      throw AppError.forbidden(
        'Access denied: You cannot view applications belonging to other customers.'
      );
    }

    return application;
  }
}
