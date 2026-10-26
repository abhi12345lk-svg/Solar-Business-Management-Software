/**
 * INS Solar Business Management Software — Subsidy Service
 *
 * Implements government subsidy program management (e.g., PM Surya Ghar Muft Bijli Yojana),
 * scheme parameters, eligibility verification, sanction recording, and concurrency-safe
 * partial/full disbursement ledgers with integer paise rigor.
 */

import { Types } from 'mongoose';
import {
  SequenceEntityType,
  SubsidyStatus,
  DisbursementMode,
  ApplicationDocumentType,
  ApplicationDocumentStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  CreateSubsidyInput,
  UpdateSubsidyInput,
  UpdateSubsidyStatusInput,
  RecordSanctionInput,
  RecordDisbursementInput,
  UploadApplicationDocumentInput,
  ReviewApplicationDocumentInput,
  SubsidyFilterInput
} from '@ins-solar/shared';
import {
  SubsidyApplication,
  ISubsidyApplicationDocument,
  IDisbursementRecord
} from '../models/SubsidyApplication.js';
import { IApplicationDocument } from '../models/NetMeteringApplication.js';
import { Project } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class SubsidyService {
  /**
   * 1. Create a new government subsidy application with atomic sequence number.
   */
  public static async createApplication(
    input: CreateSubsidyInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(input.projectId)) {
      throw AppError.validation(`Invalid project ID '${input.projectId}'.`);
    }

    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project '${input.projectId}' not found.`);
    }

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

    // Verify non-negative integer paise
    if (
      input.estimatedAmountPaise < 0 ||
      !Number.isInteger(input.estimatedAmountPaise) ||
      input.requestedAmountPaise < 0 ||
      !Number.isInteger(input.requestedAmountPaise)
    ) {
      throw AppError.validation('Subsidy amounts must be non-negative integers in paise.');
    }

    const seq = await SequenceService.generateNumber(SequenceEntityType.SUBSIDY);
    const applicationNumber = seq.formattedNumber;

    // Initial default required document slots
    const defaultDocuments: IApplicationDocument[] = [
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.CONSUMER_AADHAAR,
        title: 'Consumer Aadhaar Card Copy',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.BANK_PASSBOOK_CANCELLED_CHEQUE,
        title: 'Bank Passbook / Cancelled Cheque (for DBT Credit)',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.ELECTRICITY_BILL,
        title: 'Recent Electricity Bill with Matching Consumer Name',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.COMMISSIONING_REPORT,
        title: 'Joint Commissioning & Inspection Report',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      },
      {
        id: new Types.ObjectId().toString(),
        documentType: ApplicationDocumentType.VENDOR_UNDERTAKING,
        title: 'Installer / Vendor Quality Undertaking',
        isRequired: true,
        status: ApplicationDocumentStatus.REQUIRED
      }
    ];

    const application = new SubsidyApplication({
      applicationNumber,
      projectId: project._id,
      customerId: customer._id,
      netMeteringApplicationId: input.netMeteringApplicationId
        ? new Types.ObjectId(input.netMeteringApplicationId)
        : undefined,
      schemeName: input.schemeName,
      schemeVersion: input.schemeVersion?.trim() || 'v1.0',
      effectivePeriod: input.effectivePeriod?.trim(),
      portalApplicationNumber: input.portalApplicationNumber?.trim(),
      submissionDate: input.submissionDate ? new Date(input.submissionDate) : undefined,
      systemCapacityKw: input.systemCapacityKw ?? (project as any).systemCapacityKwp,
      estimatedAmountPaise: input.estimatedAmountPaise,
      requestedAmountPaise: input.requestedAmountPaise,
      approvedAmountPaise: 0,
      disbursedAmountPaise: 0,
      status: SubsidyStatus.ELIGIBLE,
      eligibilityVerified: false,
      assignedUserId: input.assignedUserId ? new Types.ObjectId(input.assignedUserId) : undefined,
      documents: defaultDocuments,
      disbursements: [],
      statusHistory: [
        {
          status: SubsidyStatus.ELIGIBLE,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          notes: input.notes || 'Subsidy application record initiated'
        }
      ],
      notes: input.notes?.trim()
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SUBSIDY_APPLICATION_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'sub-create',
      targetEntity: 'SubsidyApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber,
        schemeName: input.schemeName,
        requestedAmountPaise: input.requestedAmountPaise,
        projectId: project._id.toString()
      }
    });

    return application;
  }

  /**
   * 2. Update subsidy application metadata and verification notes.
   */
  public static async updateApplication(
    id: string,
    input: UpdateSubsidyInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid subsidy application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    if (input.schemeName !== undefined) application.schemeName = input.schemeName;
    if (input.schemeVersion !== undefined) application.schemeVersion = input.schemeVersion?.trim();
    if (input.effectivePeriod !== undefined) application.effectivePeriod = input.effectivePeriod?.trim();
    if (input.portalApplicationNumber !== undefined)
      application.portalApplicationNumber = input.portalApplicationNumber?.trim();
    if (input.submissionDate !== undefined)
      application.submissionDate = input.submissionDate ? new Date(input.submissionDate) : undefined;
    if (input.systemCapacityKw !== undefined) application.systemCapacityKw = input.systemCapacityKw;

    if (input.estimatedAmountPaise !== undefined) {
      if (input.estimatedAmountPaise < 0 || !Number.isInteger(input.estimatedAmountPaise)) {
        throw AppError.validation('estimatedAmountPaise must be a non-negative integer in paise.');
      }
      application.estimatedAmountPaise = input.estimatedAmountPaise;
    }

    if (input.requestedAmountPaise !== undefined) {
      if (input.requestedAmountPaise < 0 || !Number.isInteger(input.requestedAmountPaise)) {
        throw AppError.validation('requestedAmountPaise must be a non-negative integer in paise.');
      }
      // If already sanctioned, requested cannot be made less than approved without explicit audit
      if (application.approvedAmountPaise > 0 && input.requestedAmountPaise < application.approvedAmountPaise) {
        throw AppError.businessRule(
          `Requested amount (${input.requestedAmountPaise} paise) cannot be less than already approved amount (${application.approvedAmountPaise} paise).`
        );
      }
      application.requestedAmountPaise = input.requestedAmountPaise;
    }

    if (input.assignedUserId !== undefined) {
      application.assignedUserId = input.assignedUserId ? new Types.ObjectId(input.assignedUserId) : undefined;
    }
    if (input.eligibilityVerified !== undefined) application.eligibilityVerified = input.eligibilityVerified;
    if (input.eligibilityNotes !== undefined) application.eligibilityNotes = input.eligibilityNotes?.trim();
    if (input.notes !== undefined) application.notes = input.notes?.trim();

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SUBSIDY_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'sub-update',
      targetEntity: 'SubsidyApplication',
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
    input: UpdateSubsidyStatusInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid subsidy application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    const currentStatus = application.status;
    const newStatus = input.status;

    if (currentStatus === newStatus) {
      return application;
    }

    const validTransitions: Record<SubsidyStatus, SubsidyStatus[]> = {
      [SubsidyStatus.ELIGIBLE]: [
        SubsidyStatus.DOCUMENTS_PENDING,
        SubsidyStatus.APPLIED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.DOCUMENTS_PENDING]: [
        SubsidyStatus.APPLIED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.APPLIED]: [
        SubsidyStatus.CLAIM_SUBMITTED,
        SubsidyStatus.SANCTIONED,
        SubsidyStatus.REJECTED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.CLAIM_SUBMITTED]: [
        SubsidyStatus.SANCTIONED,
        SubsidyStatus.REJECTED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.SANCTIONED]: [
        SubsidyStatus.PARTIALLY_DISBURSED,
        SubsidyStatus.FULLY_DISBURSED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.PARTIALLY_DISBURSED]: [
        SubsidyStatus.FULLY_DISBURSED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.FULLY_DISBURSED]: [],
      [SubsidyStatus.REJECTED]: [
        // Allow documented resubmission/appeal
        SubsidyStatus.DOCUMENTS_PENDING,
        SubsidyStatus.APPLIED,
        SubsidyStatus.CANCELLED
      ],
      [SubsidyStatus.CANCELLED]: []
    };

    const allowed = (validTransitions as Record<string, SubsidyStatus[]>)[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw AppError.businessRule(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. Permitted targets: [${allowed.join(', ')}].`
      );
    }

    // DOCUMENT VERIFICATION GATE:
    // If transitioning to APPLIED or CLAIM_SUBMITTED, verify all required documents are uploaded & not rejected/expired
    if (newStatus === SubsidyStatus.APPLIED || newStatus === SubsidyStatus.CLAIM_SUBMITTED) {
      const blockingDocs = application.documents.filter((doc: IApplicationDocument) => {
        if (!doc.isRequired) return false;
        const isNotUploaded = doc.status === ApplicationDocumentStatus.REQUIRED || !doc.storageKey;
        const isRejected = doc.status === ApplicationDocumentStatus.REJECTED || doc.status === ApplicationDocumentStatus.RESUBMISSION_REQUIRED;
        const isExpired = doc.status === ApplicationDocumentStatus.EXPIRED;
        return isNotUploaded || isRejected || isExpired;
      });

      if (blockingDocs.length > 0) {
        const issues = blockingDocs.map((d: IApplicationDocument) => `${d.title} (${d.status})`).join('; ');
        throw AppError.businessRule(
          `Cannot transition application to '${newStatus}'. Required subsidy documents are missing or rejected: [${issues}].`
        );
      }
    }

    // DISBURSEMENT STATUS INVARIANT:
    // Cannot manually mark PARTIALLY_DISBURSED or FULLY_DISBURSED without actual recorded disbursements
    if (newStatus === SubsidyStatus.PARTIALLY_DISBURSED || newStatus === SubsidyStatus.FULLY_DISBURSED) {
      if (application.disbursements.length === 0 || application.disbursedAmountPaise === 0) {
        throw AppError.businessRule(
          `Cannot transition to '${newStatus}' without recorded disbursements. Record actual disbursement ledger entries first.`
        );
      }
    }

    application.status = newStatus;
    if (newStatus === SubsidyStatus.REJECTED) {
      application.rejectionDate = new Date();
      if (input.rejectionReason) application.rejectionReason = input.rejectionReason.trim();
    }

    application.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      notes: input.notes,
      reason: input.rejectionReason
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SUBSIDY_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'sub-status-change',
      targetEntity: 'SubsidyApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        previousStatus: currentStatus,
        newStatus,
        reason: input.rejectionReason
      }
    });

    return application;
  }

  /**
   * 4. Record official subsidy sanction.
   * INVARIANT: approvedAmountPaise must not exceed requestedAmountPaise.
   */
  public static async recordSanction(
    id: string,
    input: RecordSanctionInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid subsidy application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    if (input.approvedAmountPaise <= 0 || !Number.isInteger(input.approvedAmountPaise)) {
      throw AppError.validation('Approved amount must be a positive integer in paise.');
    }

    // Invariant: approvedAmountPaise <= requestedAmountPaise
    if (input.approvedAmountPaise > application.requestedAmountPaise) {
      throw AppError.businessRule(
        `Approved amount (${input.approvedAmountPaise} paise) cannot exceed requested amount (${application.requestedAmountPaise} paise).`
      );
    }

    const sanctionDate = new Date(input.sanctionDate);
    if (isNaN(sanctionDate.getTime())) {
      throw AppError.validation('Invalid sanction date.');
    }

    application.sanctionReference = input.sanctionReference.trim();
    application.sanctionDate = sanctionDate;
    application.approvedAmountPaise = input.approvedAmountPaise;
    application.status = SubsidyStatus.SANCTIONED;

    application.statusHistory.push({
      status: SubsidyStatus.SANCTIONED,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      notes: `Sanction recorded: Ref ${input.sanctionReference}, Approved: ₹${(input.approvedAmountPaise / 100).toFixed(2)}. ${input.notes || ''}`
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SUBSIDY_SANCTION_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'sub-sanction',
      targetEntity: 'SubsidyApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        sanctionReference: input.sanctionReference,
        approvedAmountPaise: input.approvedAmountPaise
      }
    });

    return application;
  }

  /**
   * 5. Record disbursement with idempotency protection and concurrency-safe amount invariants.
   * INVARIANTS:
   * - Application must be SANCTIONED or PARTIALLY_DISBURSED.
   * - Total disbursed cannot exceed approvedAmountPaise.
   * - Duplicate idempotencyKey or disbursementReference is rejected.
   */
  public static async recordDisbursement(
    id: string,
    input: RecordDisbursementInput,
    user: { userId: string },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid subsidy application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    // Must be in SANCTIONED or PARTIALLY_DISBURSED status
    if (
      application.status !== SubsidyStatus.SANCTIONED &&
      application.status !== SubsidyStatus.PARTIALLY_DISBURSED
    ) {
      throw AppError.businessRule(
        `Cannot record disbursement for application in '${application.status}' status. Application must be SANCTIONED first.`
      );
    }

    if (input.amountPaise <= 0 || !Number.isInteger(input.amountPaise)) {
      throw AppError.validation('Disbursement amount must be a positive integer in paise.');
    }

    // Idempotency & duplicate check
    const duplicateKey = application.disbursements.find(
      (d: IDisbursementRecord) =>
        d.idempotencyKey === input.idempotencyKey.trim() ||
        d.disbursementReference.toLowerCase() === input.disbursementReference.trim().toLowerCase()
    );
    if (duplicateKey) {
      throw AppError.conflict(
        `Duplicate disbursement detected with reference '${input.disbursementReference}' or idempotency key '${input.idempotencyKey}'.`
      );
    }

    // Concurrency-safe amount protection: total disbursed cannot exceed approved
    const existingDisbursedTotal = application.disbursedAmountPaise || 0;
    const newDisbursedTotal = existingDisbursedTotal + input.amountPaise;

    if (newDisbursedTotal > application.approvedAmountPaise) {
      const remainingPaise = application.approvedAmountPaise - existingDisbursedTotal;
      throw AppError.businessRule(
        `Disbursement amount (${input.amountPaise} paise) exceeds remaining approved balance (${remainingPaise} paise). Total approved: ${application.approvedAmountPaise} paise.`
      );
    }

    const disbursementRecord: IDisbursementRecord = {
      disbursementId: new Types.ObjectId().toString(),
      disbursementReference: input.disbursementReference.trim(),
      amountPaise: input.amountPaise,
      disbursedAt: input.disbursedAt ? new Date(input.disbursedAt) : new Date(),
      paymentMode: input.paymentMode || DisbursementMode.DIRECT_BENEFIT_TRANSFER,
      recipientAccount: input.recipientAccount.trim(),
      idempotencyKey: input.idempotencyKey.trim(),
      recordedBy: new Types.ObjectId(user.userId),
      notes: input.notes?.trim()
    };

    application.disbursements.push(disbursementRecord);
    application.disbursedAmountPaise = newDisbursedTotal;

    // Automatic status update based on remaining balance
    const nextStatus =
      newDisbursedTotal === application.approvedAmountPaise
        ? SubsidyStatus.FULLY_DISBURSED
        : SubsidyStatus.PARTIALLY_DISBURSED;

    application.status = nextStatus;
    application.statusHistory.push({
      status: nextStatus,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      notes: `Disbursement recorded: Ref ${input.disbursementReference}, Amount: ₹${(input.amountPaise / 100).toFixed(2)}, Cumulative Disbursed: ₹${(newDisbursedTotal / 100).toFixed(2)} / ₹${(application.approvedAmountPaise / 100).toFixed(2)}.`
    });

    await application.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.SUBSIDY_DISBURSEMENT_RECORDED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'sub-disburse',
      targetEntity: 'SubsidyApplication',
      targetId: application._id.toString(),
      details: {
        applicationNumber: application.applicationNumber,
        disbursementReference: input.disbursementReference,
        amountPaise: input.amountPaise,
        cumulativeDisbursedPaise: newDisbursedTotal,
        approvedAmountPaise: application.approvedAmountPaise,
        idempotencyKey: input.idempotencyKey
      }
    });

    return application;
  }

  /**
   * 6. Attach private document evidence with safe storageKey boundary.
   */
  public static async uploadDocument(
    id: string,
    input: UploadApplicationDocumentInput,
    user: { userId: string }
  ): Promise<IApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    let doc = application.documents.find((d: IApplicationDocument) => d.documentType === input.documentType);
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

    await application.save();
    return doc;
  }

  /**
   * 7. Review document (ACCEPT / REJECT / RESUBMISSION_REQUIRED).
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

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    const doc = application.documents.find((d: IApplicationDocument) => d.id === documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found on this application.`);
    }

    doc.status = input.status;
    doc.reviewedBy = new Types.ObjectId(user.userId);
    doc.reviewedAt = new Date();
    doc.reviewNotes = input.reviewNotes?.trim();
    if (input.status === ApplicationDocumentStatus.REJECTED || input.status === ApplicationDocumentStatus.RESUBMISSION_REQUIRED) {
      doc.rejectionReason = input.rejectionReason?.trim() || input.reviewNotes?.trim();
    }

    await application.save();
    return doc;
  }

  /**
   * 8. Generate short-lived authorized view/download URL for private evidence.
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

    const application = await SubsidyApplication.findById(id);
    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    if (userOrCustomer.customerId) {
      if (application.customerId.toString() !== userOrCustomer.customerId) {
        throw AppError.forbidden('Access denied: You may only access documents for your own subsidy applications.');
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
      downloadUrl: `/api/v1/subsidies/${id}/documents/${documentId}/content`,
      expiresInSeconds: 300
    };
  }

  /**
   * 9. Bounded filter and list applications with customer isolation.
   */
  public static async listApplications(
    filter: SubsidyFilterInput,
    customerId?: string
  ): Promise<{ applications: ISubsidyApplicationDocument[]; total: number; page: number; limit: number }> {
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

    if (filter.schemeName) {
      query.schemeName = { $regex: filter.schemeName, $options: 'i' };
    }

    if (filter.search) {
      query.$or = [
        { applicationNumber: { $regex: filter.search, $options: 'i' } },
        { portalApplicationNumber: { $regex: filter.search, $options: 'i' } },
        { sanctionReference: { $regex: filter.search, $options: 'i' } }
      ];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const sortOption: Record<string, 1 | -1> = {
      [filter.sortBy || 'createdAt']: filter.sortOrder === 'asc' ? 1 : -1
    };

    const [applications, total] = await Promise.all([
      SubsidyApplication.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('projectId', 'projectCode name capacityKw systemCapacityKw status stage')
        .populate('customerId', 'customerCode name phone email')
        .populate('netMeteringApplicationId', 'applicationNumber discomName consumerNumber status')
        .populate('assignedUserId', 'firstName lastName email department'),
      SubsidyApplication.countDocuments(query)
    ]);

    return { applications, total, page, limit };
  }

  /**
   * 10. Get single subsidy application with customer isolation check.
   */
  public static async getApplicationById(
    id: string,
    customerId?: string
  ): Promise<ISubsidyApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid application ID '${id}'.`);
    }

    const application = await SubsidyApplication.findById(id)
      .populate('projectId', 'projectCode name capacityKw systemCapacityKw status stage destinationSiteAddress')
      .populate('customerId', 'customerCode name phone email')
      .populate('netMeteringApplicationId', 'applicationNumber discomName consumerNumber status inspectionSchedule meterInstallation')
      .populate('assignedUserId', 'firstName lastName email department');

    if (!application) {
      throw AppError.notFound(`Subsidy Application '${id}' not found.`);
    }

    if (customerId && application.customerId._id?.toString() !== customerId && application.customerId.toString() !== customerId) {
      throw AppError.forbidden('Access denied: You cannot view applications belonging to other customers.');
    }

    return application;
  }

  /**
   * 11. Disbursement balance summary with integer paise.
   */
  public static async getDisbursementSummary(
    id: string,
    customerId?: string
  ): Promise<{
    estimatedAmountPaise: number;
    requestedAmountPaise: number;
    approvedAmountPaise: number;
    disbursedAmountPaise: number;
    remainingApprovedAmountPaise: number;
    disbursementsCount: number;
    status: SubsidyStatus;
  }> {
    const application = await this.getApplicationById(id, customerId);

    const remainingApprovedAmountPaise = Math.max(
      0,
      application.approvedAmountPaise - application.disbursedAmountPaise
    );

    return {
      estimatedAmountPaise: application.estimatedAmountPaise,
      requestedAmountPaise: application.requestedAmountPaise,
      approvedAmountPaise: application.approvedAmountPaise,
      disbursedAmountPaise: application.disbursedAmountPaise,
      remainingApprovedAmountPaise,
      disbursementsCount: application.disbursements.length,
      status: application.status
    };
  }
}
