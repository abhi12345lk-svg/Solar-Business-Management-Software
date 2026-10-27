/**
 * INS Solar Business Management Software — Warranty & Claims Service
 *
 * Implements serialized component warranty verification, lifecycle tracking,
 * claim submissions, replacement recording, and manufacturer decision logging.
 */

import mongoose from 'mongoose';
import {
  ProductSerialNumber,
  IProductSerialNumberDocument,
  WarrantyClaim,
  IWarrantyClaimDocument,
  Project,
  User
} from '../models/index.js';
import {
  WarrantyStatus,
  WarrantyType,
  WarrantyClaimStatus,
  WarrantyClaimResolution,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { NotificationReminderService } from './notificationReminderService.js';
import { AppError } from '../errors/AppError.js';
import { UserContext } from './serviceComplaintService.js';

export interface UpdateWarrantyInput {
  serialNumber: string;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  warrantyTerms?: string;
  supplierWarrantyReference?: string;
  commissioningDate?: Date;
  warrantyStatus?: WarrantyStatus;
}

export interface SubmitClaimInput {
  serialNumber: string;
  productId: string;
  customerId?: string;
  projectId: string;
  complaintId?: string;
  manufacturerName: string;
  supplierWarrantyReference?: string;
  warrantyType?: WarrantyType;
  issueDescription: string;
  claimDate?: Date;
}

export interface DecideClaimInput {
  status: WarrantyClaimStatus;
  resolutionType?: WarrantyClaimResolution;
  decisionNotes: string;
  replacementSerialNumber?: string;
}

export interface WarrantyFilterQuery {
  customerId?: string;
  projectId?: string;
  productId?: string;
  serialNumber?: string;
  status?: WarrantyStatus;
  expiringInDays?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClaimFilterQuery {
  customerId?: string;
  projectId?: string;
  serialNumber?: string;
  status?: WarrantyClaimStatus;
  page?: number;
  limit?: number;
}

export class WarrantyService {
  /**
   * Calculates dynamic warranty status based on record end date.
   */
  public static calculateWarrantyStatus(record: any): WarrantyStatus {
    if (!record?.warrantyEndDate) return WarrantyStatus.ACTIVE;
    const now = new Date();
    if (new Date(record.warrantyEndDate) < now) {
      return WarrantyStatus.EXPIRED;
    }
    return record.warrantyStatus || WarrantyStatus.ACTIVE;
  }

  /**
   * Queries serialized equipment warranty records with customer portal boundary enforcement.
   */
  public static async getWarrantyRecords(
    filters: WarrantyFilterQuery,
    userContext: UserContext
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, any> = {};

    if (userContext.isCustomer) {
      query.customerId = new mongoose.Types.ObjectId(userContext.customerId);
    } else if (filters.customerId) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (filters.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filters.projectId);
    }
    if (filters.productId) {
      query.productId = new mongoose.Types.ObjectId(filters.productId);
    }
    if (filters.serialNumber) {
      query.serialNumber = new RegExp(filters.serialNumber.trim(), 'i');
    }
    if (filters.status) {
      query.warrantyStatus = filters.status;
    }
    if (filters.expiringInDays) {
      const now = new Date();
      const future = new Date(now.getTime() + filters.expiringInDays * 24 * 60 * 60 * 1000);
      query.warrantyEndDate = { $gte: now, $lte: future };
    }
    if (filters.search) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { serialNumber: searchRegex },
        { supplierWarrantyReference: searchRegex }
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ProductSerialNumber.find(query)
        .populate('productId', 'name productCode sku brand model productType uom')
        .populate('customerId', 'name primaryPhone email')
        .populate('projectId', 'projectCode name currentStage')
        .sort({ warrantyEndDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductSerialNumber.countDocuments(query)
    ]);

    // Dynamically update status if expired
    const now = new Date();
    const enriched = items.map(item => {
      let currentStatus = item.warrantyStatus || WarrantyStatus.ACTIVE;
      if (item.warrantyEndDate && new Date(item.warrantyEndDate) < now && currentStatus === WarrantyStatus.ACTIVE) {
        currentStatus = WarrantyStatus.EXPIRED;
      }
      return {
        ...item,
        warrantyStatus: currentStatus,
        isExpired: item.warrantyEndDate ? new Date(item.warrantyEndDate) < now : false
      };
    });

    return { items: enriched, total, page, limit };
  }

  /**
   * Retrieves single warranty record by serial number.
   */
  public static async getWarrantyRecordBySerial(
    serialNumber: string,
    userContext: UserContext
  ): Promise<any> {
    const record = await ProductSerialNumber.findOne({
      serialNumber: serialNumber.trim().toUpperCase()
    })
      .populate('productId', 'name productCode sku brand model warranty technicalSpecifications')
      .populate('customerId', 'name primaryPhone email')
      .populate('projectId', 'projectCode name systemCapacityKwp currentStage')
      .lean();

    if (!record) {
      throw AppError.notFound(`Serialized hardware asset '${serialNumber}' not found.`);
    }

    if (userContext.isCustomer) {
      const custId = (record.customerId as any)?._id?.toString() || record.customerId?.toString();
      if (custId !== userContext.customerId) {
        throw AppError.permissionDenied("Access denied: You cannot view another customer's equipment warranty.");
      }
    }

    const now = new Date();
    const isExpired = record.warrantyEndDate ? new Date(record.warrantyEndDate) < now : false;

    return {
      ...record,
      isExpired,
      warrantyStatus: isExpired && record.warrantyStatus === WarrantyStatus.ACTIVE ? WarrantyStatus.EXPIRED : record.warrantyStatus
    };
  }

  /**
   * Updates warranty dates, terms, or supplier references for a serialized asset.
   */
  public static async updateWarrantyDetails(
    input: UpdateWarrantyInput,
    actor: UserContext
  ): Promise<IProductSerialNumberDocument> {
    const serial = await ProductSerialNumber.findOne({
      serialNumber: input.serialNumber.trim().toUpperCase()
    });

    if (!serial) {
      throw AppError.notFound(`Serialized hardware asset '${input.serialNumber}' not found.`);
    }

    if (input.warrantyStartDate > input.warrantyEndDate) {
      throw AppError.badRequest('Warranty start date cannot be later than warranty end date.');
    }

    serial.warrantyStartDate = input.warrantyStartDate;
    serial.warrantyEndDate = input.warrantyEndDate;
    if (input.warrantyTerms !== undefined) serial.warrantyTerms = input.warrantyTerms;
    if (input.supplierWarrantyReference !== undefined) serial.supplierWarrantyReference = input.supplierWarrantyReference;
    if (input.commissioningDate !== undefined) serial.commissioningDate = input.commissioningDate;
    if (input.warrantyStatus !== undefined) serial.warrantyStatus = input.warrantyStatus;

    await serial.save();

    await AuditService.recordEvent({
      actorId: actor.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.WARRANTY_RECORD_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `warranty-update-${serial._id.toString()}`,
      targetEntity: 'ProductSerialNumber',
      targetId: serial._id.toString(),
      details: {
        serialNumber: serial.serialNumber,
        warrantyEndDate: serial.warrantyEndDate
      }
    });

    return serial;
  }

  /**
   * Submits a component warranty claim.
   */
  public static async submitClaim(
    input: SubmitClaimInput,
    actor: UserContext
  ): Promise<IWarrantyClaimDocument> {
    const normalizedSerial = input.serialNumber.trim().toUpperCase();

    // 1. Check serial number record
    const serialDoc = await ProductSerialNumber.findOne({ serialNumber: normalizedSerial });
    if (!serialDoc) {
      throw AppError.notFound(`Component with serial number '${normalizedSerial}' not found in asset registry.`);
    }

    // 2. Prevent duplicate active claim for same serial number
    const activeClaim = await WarrantyClaim.findOne({
      serialNumber: normalizedSerial,
      status: { $in: [WarrantyClaimStatus.SUBMITTED, WarrantyClaimStatus.UNDER_REVIEW] }
    });
    if (activeClaim) {
      throw AppError.badRequest(
        `An active warranty claim (${activeClaim.claimNumber}) is already in progress for serial number '${normalizedSerial}'.`
      );
    }

    // 3. Verify project
    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${input.projectId} not found.`);
    }

    // 4. Resolve customer
    let customerId = input.customerId || project.customerId.toString();
    if (actor.isCustomer) {
      if (customerId !== actor.customerId) {
        throw AppError.permissionDenied("You cannot submit warranty claims for another customer's equipment.");
      }
    }

    // 5. Check warranty expiration
    const now = new Date();
    const isExpired = serialDoc.warrantyEndDate ? serialDoc.warrantyEndDate < now : false;
    if (isExpired || serialDoc.warrantyStatus === WarrantyStatus.EXPIRED || serialDoc.warrantyStatus === WarrantyStatus.VOID) {
      throw AppError.badRequest(
        `Equipment with serial number '${normalizedSerial}' is out of warranty (expired on ${serialDoc.warrantyEndDate?.toISOString().split('T')[0] || 'N/A'}). Cannot submit an in-warranty claim.`
      );
    }

    // 6. Generate atomic claim number (CLM-YYYY-XXXXX)
    const seq = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.WARRANTY_CLAIM,
      customPrefix: 'CLM'
    });

    const actorId = actor.userId || actor.customerId || 'system';
    const actorName = actor.isCustomer ? 'Customer' : 'Staff';

    const claim = new WarrantyClaim({
      claimNumber: seq.formattedNumber,
      serialNumber: normalizedSerial,
      productId: new mongoose.Types.ObjectId(input.productId),
      customerId: new mongoose.Types.ObjectId(customerId),
      projectId: project._id,
      complaintId: input.complaintId ? new mongoose.Types.ObjectId(input.complaintId) : undefined,
      manufacturerName: input.manufacturerName.trim(),
      supplierWarrantyReference: input.supplierWarrantyReference?.trim() || serialDoc.supplierWarrantyReference,
      warrantyType: input.warrantyType || WarrantyType.MANUFACTURER_STANDARD,
      warrantyStartDate: serialDoc.warrantyStartDate || now,
      warrantyEndDate: serialDoc.warrantyEndDate || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      claimDate: input.claimDate || now,
      issueDescription: input.issueDescription.trim(),
      status: WarrantyClaimStatus.SUBMITTED,
      evidenceFiles: [],
      statusHistory: [
        {
          status: WarrantyClaimStatus.SUBMITTED,
          transitionedAt: new Date(),
          transitionedBy: new mongoose.Types.ObjectId(actorId),
          transitionedByName: actorName,
          notes: 'Warranty claim logged with component defect description.'
        }
      ],
      createdBy: new mongoose.Types.ObjectId(actorId)
    });
    await claim.save();

    // Update serial warranty status to CLAIM_PENDING
    serialDoc.warrantyStatus = WarrantyStatus.CLAIM_PENDING;
    await serialDoc.save();

    await AuditService.recordEvent({
      actorId,
      actorType: actor.isCustomer ? ActorType.CUSTOMER : ActorType.EMPLOYEE,
      action: AuditAction.WARRANTY_CLAIM_SUBMITTED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `warranty-claim-${claim._id.toString()}`,
      targetEntity: 'WarrantyClaim',
      targetId: claim._id.toString(),
      details: {
        claimNumber: claim.claimNumber,
        serialNumber: normalizedSerial,
        manufacturer: claim.manufacturerName
      }
    });

    return claim;
  }

  /**
   * Records manufacturer/warranty decision (Approve, Reject, Replace, Settle).
   */
  public static async decideClaim(
    id: string,
    input: DecideClaimInput,
    actor: UserContext
  ): Promise<IWarrantyClaimDocument> {
    const claim = await WarrantyClaim.findById(id);
    if (!claim) {
      throw AppError.notFound(`Warranty claim ${id} not found.`);
    }

    const actorId = actor.userId || 'system';
    const actorUser = actor.userId ? await User.findById(actor.userId) : null;
    const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Authorized Admin';

    claim.status = input.status;
    claim.decisionDate = new Date();
    claim.decisionNotes = input.decisionNotes.trim();
    claim.decisionBy = actor.userId ? new mongoose.Types.ObjectId(actor.userId) : undefined;
    if (input.resolutionType) claim.resolutionType = input.resolutionType;
    if (input.replacementSerialNumber?.trim()) {
      claim.replacementSerialNumber = input.replacementSerialNumber.trim().toUpperCase();
    }

    claim.statusHistory.push({
      status: input.status,
      transitionedAt: new Date(),
      transitionedBy: new mongoose.Types.ObjectId(actorId),
      transitionedByName: actorName,
      notes: input.decisionNotes.trim()
    });

    await claim.save();

    // Update corresponding serial number warranty status
    const serialDoc = await ProductSerialNumber.findOne({ serialNumber: claim.serialNumber });
    if (serialDoc) {
      if (input.status === WarrantyClaimStatus.APPROVED) {
        serialDoc.warrantyStatus = WarrantyStatus.CLAIM_APPROVED;
      } else if (input.status === WarrantyClaimStatus.REJECTED) {
        serialDoc.warrantyStatus = WarrantyStatus.CLAIM_REJECTED;
      } else if (input.status === WarrantyClaimStatus.REPLACED) {
        serialDoc.warrantyStatus = WarrantyStatus.VOID; // Replaced unit is decommissioned/void
      }
      await serialDoc.save();
    }

    await AuditService.recordEvent({
      actorId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.WARRANTY_CLAIM_DECIDED,
      outcome: AuditOutcome.SUCCESS,
      correlationId: `warranty-decide-${claim._id.toString()}`,
      targetEntity: 'WarrantyClaim',
      targetId: claim._id.toString(),
      details: {
        claimNumber: claim.claimNumber,
        status: input.status,
        resolutionType: input.resolutionType
      }
    });

    return claim;
  }

  /**
   * Queries claims list with customer portal isolation.
   */
  public static async getClaims(
    filters: ClaimFilterQuery,
    userContext: UserContext
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, any> = {};

    if (userContext.isCustomer) {
      query.customerId = new mongoose.Types.ObjectId(userContext.customerId);
    } else if (filters.customerId) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (filters.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filters.projectId);
    }
    if (filters.serialNumber) {
      query.serialNumber = new RegExp(filters.serialNumber.trim(), 'i');
    }
    if (filters.status) {
      query.status = filters.status;
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      WarrantyClaim.find(query)
        .populate('productId', 'name productCode sku brand model')
        .populate('customerId', 'name primaryPhone email')
        .populate('projectId', 'projectCode name')
        .populate('complaintId', 'complaintNumber title')
        .populate('decisionBy', 'firstName lastName email')
        .sort({ claimDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WarrantyClaim.countDocuments(query)
    ]);

    return { items, total, page, limit };
  }

  /**
   * Queries single claim by ID.
   */
  public static async getClaimById(id: string, userContext: UserContext): Promise<any> {
    const claim = await WarrantyClaim.findById(id)
      .populate('productId', 'name productCode sku brand model warranty')
      .populate('customerId', 'name primaryPhone email billingAddress')
      .populate('projectId', 'projectCode name currentStage')
      .populate('complaintId', 'complaintNumber title status')
      .populate('decisionBy', 'firstName lastName email')
      .lean();

    if (!claim) {
      throw AppError.notFound(`Warranty claim ${id} not found.`);
    }

    if (userContext.isCustomer) {
      const custId = (claim.customerId as any)?._id?.toString() || claim.customerId?.toString();
      if (custId !== userContext.customerId) {
        throw AppError.permissionDenied("Access denied: You cannot view another customer's warranty claim.");
      }
    }

    return claim;
  }

  /**
   * Scans for warranties expiring within the specified days and dispatches reminders.
   */
  public static async checkExpiringWarranties(withinDays: number = 30): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const expiring = await ProductSerialNumber.find({
      warrantyStatus: WarrantyStatus.ACTIVE,
      warrantyEndDate: { $gte: now, $lte: horizon }
    }).populate('customerId', 'name primaryPhone email');

    let count = 0;
    for (const item of expiring) {
      const cust = item.customerId as any;
      await NotificationReminderService.scheduleOrSendReminder({
        reminderType: 'WARRANTY_EXPIRY',
        entityType: 'WarrantyRecord',
        entityId: item._id.toString(),
        recipientName: cust?.name,
        recipientEmail: cust?.email,
        recipientPhone: cust?.primaryPhone,
        subject: `Warranty Expiring Soon: Serial ${item.serialNumber}`,
        message: `Hardware asset ${item.serialNumber} warranty expires on ${item.warrantyEndDate?.toISOString().split('T')[0]}. Contact sales for extended coverage or AMC.`,
        scheduledFor: item.warrantyEndDate || now,
        metadata: { serialNumber: item.serialNumber, withinDays }
      });
      count++;
    }

    return count;
  }
}
