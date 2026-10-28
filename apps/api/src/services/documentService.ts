import { Types } from 'mongoose';
import crypto from 'node:crypto';
import {
  DocumentAccessClassification,
  DocumentReviewStatus,
  DocumentStorageStatus,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  UploadDocumentMetadataInput,
  ReviewDocumentInput,
  CreateDocumentVersionInput,
  DocumentFilterInput,
  AuditAction,
  AuditOutcome,
  ActorType,
  SequenceEntityType
} from '@ins-solar/shared';
import { DocumentModel, IDocumentRecord } from '../models/DocumentModel.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Project } from '../models/Project.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

export interface DocumentActorContext {
  actorId: string;
  actorType: 'EMPLOYEE' | 'CUSTOMER';
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class DocumentService {
  /**
   * 1. Register / Upload document metadata into centralized private vault.
   */
  public static async registerDocument(
    input: UploadDocumentMetadataInput,
    actorContext: DocumentActorContext
  ): Promise<IDocumentRecord> {
    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
      throw AppError.validation(
        `Unsupported document format '${input.mimeType}'. Allowed formats: PDF, JPEG, PNG, WEBP, CSV, XLSX, DWG, DXF.`
      );
    }

    // 2. Validate file size
    if (input.fileSizeBytes <= 0 || input.fileSizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw AppError.validation(
        `File size (${(input.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) must be between 1 byte and 25 MB.`
      );
    }

    // 3. Filename sanitation & validation
    const rawFilename = input.originalFilename.trim();
    if (!rawFilename || rawFilename.length > 255) {
      throw AppError.validation('Filename must be between 1 and 255 characters.');
    }
    const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // 4. Validate customer link if provided
    let customerObjectId: Types.ObjectId | undefined;
    if (input.customerId) {
      if (!Types.ObjectId.isValid(input.customerId)) {
        throw AppError.validation(`Invalid customerId '${input.customerId}'.`);
      }
      const customerExists = await CustomerIdentity.findById(input.customerId);
      if (!customerExists) {
        throw AppError.notFound(`Customer with ID '${input.customerId}' not found.`);
      }
      customerObjectId = new Types.ObjectId(input.customerId);
    }

    // 5. Validate project link if provided
    let projectObjectId: Types.ObjectId | undefined;
    if (input.projectId) {
      if (!Types.ObjectId.isValid(input.projectId)) {
        throw AppError.validation(`Invalid projectId '${input.projectId}'.`);
      }
      const project = await Project.findById(input.projectId);
      if (!project) {
        throw AppError.notFound(`Project with ID '${input.projectId}' not found.`);
      }
      projectObjectId = new Types.ObjectId(input.projectId);

      // Verify customer consistency if both provided
      if (customerObjectId && project.customerId.toString() !== customerObjectId.toString()) {
        throw AppError.validation(
          'Cross-customer integrity violation: Project does not belong to the specified customer.'
        );
      }
      // If customer not provided but project exists, infer customer
      if (!customerObjectId) {
        customerObjectId = project.customerId;
      }
    }

    // 6. Generate atomic sequence document number
    const seq = await SequenceService.generateNumber(SequenceEntityType.DOCUMENT);
    const documentNumber = seq.formattedNumber;

    // 7. Generate safe private storage key
    const year = new Date().getFullYear();
    const storageKey = `documents/${input.category.toLowerCase()}/${year}/${documentNumber}_${sanitizedFilename}`;

    // 8. Determine safe storage status
    const storageStatus =
      config.STORAGE_PROVIDER === 's3'
        ? DocumentStorageStatus.STORED_S3
        : DocumentStorageStatus.SIMULATED_STORAGE_ONLY;

    const safeDisplayName = input.safeDisplayName?.trim() || rawFilename;

    const documentDoc = new DocumentModel({
      documentNumber,
      originalFilename: rawFilename,
      safeDisplayName,
      category: input.category,
      accessClassification:
        input.accessClassification || DocumentAccessClassification.INTERNAL_ONLY,
      reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
      storageKey,
      storageStatus,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      checksumSha256: input.checksumSha256,
      version: 1,
      isLatestVersion: true,
      customerId: customerObjectId,
      projectId: projectObjectId,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId
        ? new Types.ObjectId(input.relatedEntityId)
        : undefined,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      uploadedBy: new Types.ObjectId(actorContext.actorId),
      uploadedByType: actorContext.actorType,
      isArchived: false,
      metadata: input.metadata || {}
    });

    await documentDoc.save();

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: actorContext.actorType === 'EMPLOYEE' ? ActorType.EMPLOYEE : ActorType.CUSTOMER,
      action: AuditAction.DOCUMENT_UPLOADED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'document-upload',
      targetEntity: 'DocumentModel',
      targetId: documentDoc._id.toString(),
      details: {
        documentNumber,
        category: input.category,
        accessClassification: input.accessClassification,
        storageKey,
        storageStatus,
        fileSizeBytes: input.fileSizeBytes
      }
    });

    return documentDoc;
  }

  /**
   * 2. Create a new document version, superseding the previous version.
   */
  public static async createDocumentVersion(
    documentId: string,
    input: CreateDocumentVersionInput,
    actorContext: DocumentActorContext
  ): Promise<IDocumentRecord> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    const previousDoc = await DocumentModel.findById(documentId);
    if (!previousDoc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    if (previousDoc.isArchived) {
      throw AppError.badRequest('Cannot create a new version of an archived document.');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
      throw AppError.validation(`Unsupported document format '${input.mimeType}'.`);
    }

    if (input.fileSizeBytes <= 0 || input.fileSizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw AppError.validation(
        `File size (${(input.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) must be between 1 byte and 25 MB.`
      );
    }

    const rawFilename = input.originalFilename.trim();
    const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newVersion = previousDoc.version + 1;
    const year = new Date().getFullYear();
    const storageKey = `documents/${previousDoc.category.toLowerCase()}/${year}/${previousDoc.documentNumber}_v${newVersion}_${sanitizedFilename}`;

    // Mark previous document as not latest
    previousDoc.isLatestVersion = false;
    await previousDoc.save();

    const newDoc = new DocumentModel({
      documentNumber: previousDoc.documentNumber,
      originalFilename: rawFilename,
      safeDisplayName: input.safeDisplayName?.trim() || previousDoc.safeDisplayName,
      category: previousDoc.category,
      accessClassification: previousDoc.accessClassification,
      reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
      storageKey,
      storageStatus:
        config.STORAGE_PROVIDER === 's3'
          ? DocumentStorageStatus.STORED_S3
          : DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      checksumSha256: input.checksumSha256,
      version: newVersion,
      previousVersionId: previousDoc._id,
      isLatestVersion: true,
      customerId: previousDoc.customerId,
      projectId: previousDoc.projectId,
      relatedEntityType: previousDoc.relatedEntityType,
      relatedEntityId: previousDoc.relatedEntityId,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : previousDoc.expiryDate,
      uploadedBy: new Types.ObjectId(actorContext.actorId),
      uploadedByType: actorContext.actorType,
      isArchived: false,
      metadata: {
        ...previousDoc.metadata,
        ...(input.metadata || {})
      }
    });

    await newDoc.save();

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: actorContext.actorType === 'EMPLOYEE' ? ActorType.EMPLOYEE : ActorType.CUSTOMER,
      action: AuditAction.DOCUMENT_VERSION_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'document-version-create',
      targetEntity: 'DocumentModel',
      targetId: newDoc._id.toString(),
      details: {
        documentNumber: previousDoc.documentNumber,
        newVersion,
        previousVersionId: previousDoc._id.toString(),
        storageKey
      }
    });

    return newDoc;
  }

  /**
   * 3. Review document (Accept, Reject, Resubmission Required).
   */
  public static async reviewDocument(
    documentId: string,
    input: ReviewDocumentInput,
    actorContext: DocumentActorContext
  ): Promise<IDocumentRecord> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    if (doc.isArchived) {
      throw AppError.badRequest('Cannot review an archived document.');
    }

    // Require rejectionReason for REJECTED and RESUBMISSION_REQUIRED
    if (
      input.reviewStatus === DocumentReviewStatus.REJECTED ||
      input.reviewStatus === DocumentReviewStatus.RESUBMISSION_REQUIRED
    ) {
      if (!input.rejectionReason || input.rejectionReason.trim().length < 5) {
        throw AppError.validation(
          'A descriptive rejection reason (minimum 5 characters) is required when rejecting or requesting resubmission.'
        );
      }
      doc.rejectionReason = input.rejectionReason.trim();
    } else {
      doc.rejectionReason = undefined;
    }

    doc.reviewStatus = input.reviewStatus;
    doc.reviewNotes = input.reviewNotes?.trim();
    doc.reviewActorId = new Types.ObjectId(actorContext.actorId);
    doc.reviewedAt = new Date();

    await doc.save();

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.DOCUMENT_REVIEWED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'document-review',
      targetEntity: 'DocumentModel',
      targetId: doc._id.toString(),
      details: {
        documentNumber: doc.documentNumber,
        reviewStatus: doc.reviewStatus,
        rejectionReason: doc.rejectionReason,
        reviewNotes: doc.reviewNotes
      }
    });

    return doc;
  }

  /**
   * 4. Generate short-lived signed download access URL.
   */
  public static async generateSignedAccessUrl(
    documentId: string,
    requester: { userId?: string; customerId?: string; role?: string },
    expiresInSeconds = 900 // 15 mins default
  ): Promise<{
    documentId: string;
    documentNumber: string;
    fileName: string;
    safeDisplayName: string;
    mimeType: string;
    fileSizeBytes: number;
    downloadUrl: string;
    expiresInSeconds: number;
    expiresAt: Date;
  }> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    // Authorization Boundary Check
    if (requester.customerId) {
      // Customer requester checks:
      // 1. Must own the document
      if (!doc.customerId || doc.customerId.toString() !== requester.customerId) {
        throw AppError.forbidden(
          'Access denied: You do not have permission to access this document.'
        );
      }
      // 2. Must be classified as CUSTOMER_VISIBLE
      if (doc.accessClassification !== DocumentAccessClassification.CUSTOMER_VISIBLE) {
        throw AppError.forbidden(
          'Access denied: This internal document is not customer-accessible.'
        );
      }
      // 3. Must not be archived
      if (doc.isArchived) {
        throw AppError.forbidden('Access denied: Document has been archived.');
      }
    } else {
      // Staff requester checks:
      if (doc.accessClassification === DocumentAccessClassification.RESTRICTED) {
        const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'];
        if (requester.role && !allowedRoles.includes(requester.role)) {
          throw AppError.forbidden(
            'Access denied: Restricted document requires administrative clearance.'
          );
        }
      }
    }

    const safeTtl = Math.min(Math.max(60, expiresInSeconds), 900); // Max 15 minutes
    const expiresAtMs = Date.now() + safeTtl * 1000;

    // Cryptographic HMAC token: HMAC_SHA256(secret, `${docId}:${expiresAtMs}:${storageKey}`)
    const payload = `${doc._id.toString()}:${expiresAtMs}:${doc.storageKey}`;
    const token = crypto.createHmac('sha256', config.SESSION_SECRET).update(payload).digest('hex');

    const downloadUrl = `/api/v1/documents/${doc._id.toString()}/download?token=${token}&expires=${expiresAtMs}`;

    await AuditService.recordEvent({
      actorId: requester.userId || requester.customerId || 'system',
      actorType: requester.customerId ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      action: AuditAction.DOCUMENT_ACCESSED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: 'document-access',
      targetEntity: 'DocumentModel',
      targetId: doc._id.toString(),
      details: {
        documentNumber: doc.documentNumber,
        expiresInSeconds: safeTtl,
        accessClassification: doc.accessClassification
      }
    });

    return {
      documentId: doc._id.toString(),
      documentNumber: doc.documentNumber,
      fileName: doc.originalFilename,
      safeDisplayName: doc.safeDisplayName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      downloadUrl,
      expiresInSeconds: safeTtl,
      expiresAt: new Date(expiresAtMs)
    };
  }

  /**
   * 5. Verify HMAC signed token for downloading document content.
   */
  public static async verifySignedDownloadToken(
    documentId: string,
    token: string,
    expires: number
  ): Promise<IDocumentRecord> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    if (Date.now() > expires) {
      throw AppError.forbidden(
        'Signed download URL has expired. Please generate a new access link.'
      );
    }

    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    const payload = `${doc._id.toString()}:${expires}:${doc.storageKey}`;
    const expectedToken = crypto
      .createHmac('sha256', config.SESSION_SECRET)
      .update(payload)
      .digest('hex');

    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expectedToken);

    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      throw AppError.forbidden('Invalid download signature or tamper detected.');
    }

    return doc;
  }

  /**
   * 6. Archive document.
   */
  public static async archiveDocument(
    documentId: string,
    reason: string | undefined,
    actorContext: DocumentActorContext
  ): Promise<IDocumentRecord> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    if (doc.isArchived) {
      throw AppError.badRequest('Document is already archived.');
    }

    doc.isArchived = true;
    doc.archivedAt = new Date();
    doc.archivedBy = new Types.ObjectId(actorContext.actorId);
    if (reason) {
      doc.metadata = {
        ...doc.metadata,
        archivalReason: reason.trim()
      };
    }

    await doc.save();

    await AuditService.recordEvent({
      actorId: actorContext.actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.DOCUMENT_ARCHIVED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actorContext.ipAddress,
      userAgent: actorContext.userAgent,
      correlationId: actorContext.correlationId || 'document-archive',
      targetEntity: 'DocumentModel',
      targetId: doc._id.toString(),
      details: {
        documentNumber: doc.documentNumber,
        reason
      }
    });

    return doc;
  }

  /**
   * 7. List documents with access classification and tenant filtering.
   */
  public static async listDocuments(
    filter: DocumentFilterInput,
    requester: { userId?: string; customerId?: string; role?: string }
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    // Customer Isolation Boundary: Customer can only view their own CUSTOMER_VISIBLE active files
    if (requester.customerId) {
      query.customerId = new Types.ObjectId(requester.customerId);
      query.accessClassification = DocumentAccessClassification.CUSTOMER_VISIBLE;
      query.isArchived = false;
    } else {
      // Staff filtering
      if (filter.customerId && Types.ObjectId.isValid(filter.customerId)) {
        query.customerId = new Types.ObjectId(filter.customerId);
      }
      if (filter.accessClassification) {
        query.accessClassification = filter.accessClassification;
      }
      if (filter.isArchived !== undefined) {
        query.isArchived = filter.isArchived;
      }
    }

    if (filter.category) query.category = filter.category;
    if (filter.reviewStatus) query.reviewStatus = filter.reviewStatus;
    if (filter.projectId && Types.ObjectId.isValid(filter.projectId)) {
      query.projectId = new Types.ObjectId(filter.projectId);
    }
    if (filter.relatedEntityType) query.relatedEntityType = filter.relatedEntityType;
    if (filter.relatedEntityId && Types.ObjectId.isValid(filter.relatedEntityId)) {
      query.relatedEntityId = new Types.ObjectId(filter.relatedEntityId);
    }
    if (filter.isLatestVersion !== undefined) {
      query.isLatestVersion = filter.isLatestVersion;
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { documentNumber: searchRegex },
        { originalFilename: searchRegex },
        { safeDisplayName: searchRegex }
      ];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      DocumentModel.find(query)
        .populate('customerId', 'customerCode fullName primaryPhone email')
        .populate('projectId', 'projectNumber title status')
        .populate('reviewActorId', 'firstName lastName email')
        .populate('uploadedBy', 'firstName lastName email customerCode fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DocumentModel.countDocuments(query)
    ]);

    // Sanitize metadata for customer view
    const sanitizedItems = requester.customerId
      ? items.map(doc => {
          const {
            storageKey: _storageKey,
            reviewActorId: _reviewActorId,
            metadata: _metadata,
            ...safeFields
          } = doc as any;
          return safeFields;
        })
      : items;

    return {
      items: sanitizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 8. Get document by ID with strict access validation.
   */
  public static async getDocumentById(
    documentId: string,
    requester: { userId?: string; customerId?: string; role?: string }
  ): Promise<any> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.validation(`Invalid document ID '${documentId}'.`);
    }

    const doc = await DocumentModel.findById(documentId)
      .populate('customerId', 'customerCode fullName primaryPhone email')
      .populate('projectId', 'projectNumber title status')
      .populate('reviewActorId', 'firstName lastName email')
      .populate('previousVersionId', 'documentNumber version originalFilename createdAt')
      .lean();

    if (!doc) {
      throw AppError.notFound(`Document with ID '${documentId}' not found.`);
    }

    if (requester.customerId) {
      const docCustomer = doc.customerId as any;
      const docCustomerIdStr = docCustomer?._id
        ? docCustomer._id.toString()
        : doc.customerId?.toString();
      if (docCustomerIdStr !== requester.customerId) {
        throw AppError.forbidden(
          'Access denied: You do not have permission to view this document.'
        );
      }
      if (doc.accessClassification !== DocumentAccessClassification.CUSTOMER_VISIBLE) {
        throw AppError.forbidden(
          'Access denied: This internal document is not customer-accessible.'
        );
      }
      if (doc.isArchived) {
        throw AppError.forbidden('Access denied: Document has been archived.');
      }

      // Strip sensitive internal fields for customer
      const {
        storageKey: _storageKey,
        reviewActorId: _reviewActorId,
        metadata: _metadata,
        ...safeDoc
      } = doc as any;
      return safeDoc;
    }

    return doc;
  }
}
