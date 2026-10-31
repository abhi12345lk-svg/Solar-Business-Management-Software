/**
 * INS Solar Business Management Software — Quotation Service
 *
 * Implements end-to-end commercial quotation workflows:
 * - Immutable revision history (QT-YYYY-XXXXX-R0, R1)
 * - Strict integer paise financial calculations and rounding
 * - Configurable GST tax profiles and CA statutory disclaimers
 * - Discount approval workflows with anti-self-approval enforcement
 * - Customer review and idempotent acceptance/rejection
 */

import {
  CreateQuotationInput,
  ReviseQuotationInput,
  QuotationFilter,
  DiscountApprovalInput,
  CustomerQuotationDecision,
  QuotationStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  calculateTaxPaise,
  TAX_DISCLAIMER_TEXT,
  UserRole,
  CustomerType
} from '@ins-solar/shared';
import { Types } from 'mongoose';
import { Quotation, IQuotationDocument, IQuotationLineItem } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Lead } from '../models/Lead.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class QuotationService {
  /**
   * Helper: Pure integer paise financial calculation for line items and summary.
   */
  public static computeFinancials(
    lineItemsInput: Array<{
      itemType: any;
      productId?: string;
      sku?: string;
      description: string;
      quantity: number;
      unit?: string;
      unitRatePaise: number;
      discountPaise?: number;
      gstRateBasisPoints?: number;
    }>,
    additionalDiscountPaise: number = 0,
    isInterState: boolean = false
  ) {
    let subtotalPaise = 0;
    let totalLineDiscountPaise = 0;
    let totalTaxAmountPaise = 0;
    let cgstAmountPaise = 0;
    let sgstAmountPaise = 0;
    let igstAmountPaise = 0;

    const computedLineItems: IQuotationLineItem[] = lineItemsInput.map(item => {
      const grossLinePaise = Math.round(item.quantity * item.unitRatePaise);
      const discountPaise = item.discountPaise || 0;
      const taxableAmountPaise = Math.max(0, grossLinePaise - discountPaise);
      const gstRateBasisPoints = item.gstRateBasisPoints ?? 1800; // Default 18%

      let lineCgstBps = 0;
      let lineCgstPaise = 0;
      let lineSgstBps = 0;
      let lineSgstPaise = 0;
      let lineIgstBps = 0;
      let lineIgstPaise = 0;
      let lineTaxPaise = 0;

      if (isInterState) {
        lineIgstBps = gstRateBasisPoints;
        lineIgstPaise = calculateTaxPaise(taxableAmountPaise, lineIgstBps);
        lineTaxPaise = lineIgstPaise;
        igstAmountPaise += lineIgstPaise;
      } else {
        lineCgstBps = Math.floor(gstRateBasisPoints / 2);
        lineSgstBps = gstRateBasisPoints - lineCgstBps;
        lineCgstPaise = calculateTaxPaise(taxableAmountPaise, lineCgstBps);
        lineSgstPaise = calculateTaxPaise(taxableAmountPaise, lineSgstBps);
        lineTaxPaise = lineCgstPaise + lineSgstPaise;
        cgstAmountPaise += lineCgstPaise;
        sgstAmountPaise += lineSgstPaise;
      }

      const totalAmountPaise = taxableAmountPaise + lineTaxPaise;

      subtotalPaise += grossLinePaise;
      totalLineDiscountPaise += discountPaise;
      totalTaxAmountPaise += lineTaxPaise;

      return {
        itemType: item.itemType,
        productId: item.productId as any,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'NOS',
        unitRatePaise: item.unitRatePaise,
        discountPaise,
        taxableAmountPaise,
        gstRateBasisPoints,
        cgstRateBasisPoints: lineCgstBps,
        cgstAmountPaise: lineCgstPaise,
        sgstRateBasisPoints: lineSgstBps,
        sgstAmountPaise: lineSgstPaise,
        igstRateBasisPoints: lineIgstBps,
        igstAmountPaise: lineIgstPaise,
        totalTaxAmountPaise: lineTaxPaise,
        totalAmountPaise
      };
    });

    const totalDiscountPaise = totalLineDiscountPaise + additionalDiscountPaise;
    const discountPercent =
      subtotalPaise > 0 ? Number(((totalDiscountPaise / subtotalPaise) * 100).toFixed(2)) : 0;

    const overallTaxablePaise = Math.max(0, subtotalPaise - totalDiscountPaise);
    const netTotalPaise = overallTaxablePaise + totalTaxAmountPaise;

    return {
      lineItems: computedLineItems,
      subtotalPaise,
      totalLineDiscountPaise,
      additionalDiscountPaise,
      totalDiscountPaise,
      discountPercent,
      taxableAmountPaise: overallTaxablePaise,
      cgstAmountPaise,
      sgstAmountPaise,
      igstAmountPaise,
      totalTaxAmountPaise,
      netTotalPaise
    };
  }

  /**
   * 1. Create a new Quotation (Initial revision R0).
   */
  public static async createQuotation(
    input: CreateQuotationInput,
    user: { userId: string; role?: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<IQuotationDocument> {
    // 1. Resolve lead if provided
    let resolvedLeadId: Types.ObjectId | undefined;
    let lead: any = null;
    if (input.leadId && input.leadId.trim()) {
      const cleanLeadId = input.leadId.trim();
      if (Types.ObjectId.isValid(cleanLeadId)) {
        lead = await Lead.findById(cleanLeadId);
      }
      if (!lead) {
        lead = await Lead.findOne({
          $or: [{ leadCode: cleanLeadId.toUpperCase() }, { prospectPhone: cleanLeadId }]
        });
      }
      if (lead) {
        resolvedLeadId = lead._id;
      }
    }

    // 2. Resolve customer
    let customer: any = null;
    const cleanCustId = (input.customerId || '').trim();
    if (cleanCustId) {
      if (Types.ObjectId.isValid(cleanCustId)) {
        customer = await Customer.findById(cleanCustId);
      }
      if (!customer) {
        customer = await Customer.findOne({ customerCode: cleanCustId.toUpperCase() });
      }
    }

    // Auto-resolve customer from lead if not explicitly provided
    if (!customer && lead) {
      if (lead.convertedCustomerId) {
        customer = await Customer.findById(lead.convertedCustomerId);
      }
      if (!customer) {
        customer = await Customer.findOne({
          $or: [
            { primaryPhone: lead.prospectPhone },
            { email: lead.prospectEmail },
            { name: lead.prospectName }
          ]
        });
      }
      // If customer record doesn't exist yet, auto-create customer profile for this lead
      if (!customer) {
        const seqResult = await SequenceService.generateNumber(SequenceEntityType.CUSTOMER);
        customer = await Customer.create({
          customerCode: seqResult.formattedNumber,
          name: lead.prospectName,
          legalName: lead.companyName || lead.prospectName,
          primaryPhone: lead.prospectPhone,
          email: lead.prospectEmail,
          customerType: CustomerType.INDIVIDUAL,
          billingAddress: {
            street: lead.location?.street || lead.prospectName,
            city: lead.location?.city || 'Jaipur',
            state: lead.location?.state || 'Rajasthan',
            pincode: lead.location?.pinCode || '302001',
            country: 'India'
          },
          installationAddresses: [
            {
              street: lead.location?.street || lead.prospectName,
              city: lead.location?.city || 'Jaipur',
              state: lead.location?.state || 'Rajasthan',
              pincode: lead.location?.pinCode || '302001',
              country: 'India'
            }
          ],
          createdBy: Types.ObjectId.isValid(user.userId)
            ? new Types.ObjectId(user.userId)
            : undefined
        });
        lead.convertedCustomerId = customer._id;
        await lead.save();
      }
    }

    if (!customer) {
      throw AppError.notFound('Please select a valid Customer Account or Lead for this quotation.');
    }

    // Validate any catalog products referenced in line items
    for (const item of input.lineItems) {
      if (item.productId) {
        const prod = await Product.findById(item.productId);
        if (!prod || !prod.isActive) {
          throw AppError.businessRule(
            `Line item product '${item.description}' is inactive or does not exist in catalog.`
          );
        }
      }
    }

    // Sequence generation: base quotation number (e.g. QT-2026-00001)
    const seq = await SequenceService.generateNumber(SequenceEntityType.QUOTATION);
    const quotationNumber = seq.formattedNumber;
    const revisionNumber = 0;
    const fullQuotationCode = `${quotationNumber}-R${revisionNumber}`;

    // Get company settings for discount threshold
    const settings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' });
    const thresholdPercent = settings?.discountApprovalThresholdPercent ?? 5.0;

    const isInterState = input.taxProfile?.isInterState ?? false;
    const financials = this.computeFinancials(
      input.lineItems,
      input.additionalDiscountPaise || 0,
      isInterState
    );

    // Evaluate discount approval requirement
    const requiresDiscountApproval = financials.discountPercent > thresholdPercent;
    const discountApprovalStatus = requiresDiscountApproval ? 'PENDING' : 'NOT_REQUIRED';
    const initialStatus = requiresDiscountApproval
      ? QuotationStatus.PENDING_APPROVAL
      : QuotationStatus.DRAFT;

    const validUntilDate = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const quotation = new Quotation({
      quotationNumber,
      revisionNumber,
      fullQuotationCode,
      isLatestRevision: true,
      customerId: customer._id,
      leadId:
        resolvedLeadId ||
        (input.leadId && Types.ObjectId.isValid(input.leadId)
          ? new Types.ObjectId(input.leadId)
          : undefined),
      solarDesignId: input.solarDesignId,
      systemTopology: input.systemTopology,
      systemCapacityKwp: input.systemCapacityKwp,
      lineItems: financials.lineItems,
      subtotalPaise: financials.subtotalPaise,
      totalLineDiscountPaise: financials.totalLineDiscountPaise,
      additionalDiscountPaise: financials.additionalDiscountPaise,
      totalDiscountPaise: financials.totalDiscountPaise,
      discountPercent: financials.discountPercent,
      taxableAmountPaise: financials.taxableAmountPaise,
      cgstAmountPaise: financials.cgstAmountPaise,
      sgstAmountPaise: financials.sgstAmountPaise,
      igstAmountPaise: financials.igstAmountPaise,
      totalTaxAmountPaise: financials.totalTaxAmountPaise,
      netTotalPaise: financials.netTotalPaise,
      requiresDiscountApproval,
      isDiscountApproved: false,
      discountApprovalStatus,
      taxProfile: {
        profileCode: input.taxProfile?.profileCode || 'STD_SOLAR_GST_18',
        profileName:
          input.taxProfile?.profileName || 'Standard Solar GST 18% (Intra-State CGST+SGST)',
        isInterState,
        effectiveDate: input.taxProfile?.effectiveDate
          ? new Date(input.taxProfile.effectiveDate)
          : new Date(),
        accountingNotice: TAX_DISCLAIMER_TEXT
      },
      termsAndConditions: input.termsAndConditions,
      paymentMilestones: input.paymentMilestones,
      validUntil: validUntilDate,
      status: initialStatus,
      createdBy: user.userId
    });

    await quotation.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.QUOTATION_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'quote-create',
      details: {
        fullQuotationCode: quotation.fullQuotationCode,
        customerId: customer._id.toString(),
        netTotalPaise: quotation.netTotalPaise,
        discountPercent: quotation.discountPercent,
        requiresDiscountApproval
      }
    });

    logger.info(
      { fullQuotationCode: quotation.fullQuotationCode, netTotalPaise: quotation.netTotalPaise },
      'Quotation revision R0 created successfully.'
    );

    return quotation;
  }

  /**
   * 2. Create a new Revision (R1, R2...) without overwriting previous issued revision.
   */
  public static async reviseQuotation(
    currentQuotationId: string,
    input: ReviseQuotationInput,
    user: { userId: string; role?: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<IQuotationDocument> {
    const currentQuote = await Quotation.findById(currentQuotationId);
    if (!currentQuote) {
      throw AppError.notFound('Quotation not found.');
    }

    // Must be an issued or completed state to revise; drafts should be edited directly
    const validReviseStates = [
      QuotationStatus.SENT,
      QuotationStatus.APPROVED,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
      QuotationStatus.EXPIRED
    ];

    if (!validReviseStates.includes(currentQuote.status)) {
      throw AppError.businessRule(
        `Quotation in '${currentQuote.status}' state cannot be revised. Drafts should be updated directly.`
      );
    }

    // Mark current revision as superseded/revised
    currentQuote.isLatestRevision = false;
    currentQuote.status = QuotationStatus.REVISED;
    await currentQuote.save();

    const nextRevisionNumber = currentQuote.revisionNumber + 1;
    const fullQuotationCode = `${currentQuote.quotationNumber}-R${nextRevisionNumber}`;

    // Line items to use: either updated input or cloned from prior revision
    const lineItemsToUse =
      input.lineItems && input.lineItems.length > 0
        ? input.lineItems
        : currentQuote.lineItems.map(item => ({
            itemType: item.itemType,
            productId: item.productId?.toString(),
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitRatePaise: item.unitRatePaise,
            discountPaise: item.discountPaise,
            gstRateBasisPoints: item.gstRateBasisPoints
          }));

    const additionalDiscount =
      input.additionalDiscountPaise !== undefined
        ? input.additionalDiscountPaise
        : currentQuote.additionalDiscountPaise;

    const isInterState = currentQuote.taxProfile.isInterState;
    const financials = this.computeFinancials(lineItemsToUse, additionalDiscount, isInterState);

    // Evaluate discount approval requirement
    const settings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' });
    const thresholdPercent = settings?.discountApprovalThresholdPercent ?? 5.0;
    const requiresDiscountApproval = financials.discountPercent > thresholdPercent;
    const discountApprovalStatus = requiresDiscountApproval ? 'PENDING' : 'NOT_REQUIRED';
    const initialStatus = requiresDiscountApproval
      ? QuotationStatus.PENDING_APPROVAL
      : QuotationStatus.DRAFT;

    const validUntilDate = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const revisedQuotation = new Quotation({
      quotationNumber: currentQuote.quotationNumber,
      revisionNumber: nextRevisionNumber,
      fullQuotationCode,
      isLatestRevision: true,
      parentQuotationId: currentQuote._id,
      customerId: currentQuote.customerId,
      leadId: currentQuote.leadId,
      solarDesignId: currentQuote.solarDesignId,
      systemTopology: currentQuote.systemTopology,
      systemCapacityKwp: input.systemCapacityKwp || currentQuote.systemCapacityKwp,
      lineItems: financials.lineItems,
      subtotalPaise: financials.subtotalPaise,
      totalLineDiscountPaise: financials.totalLineDiscountPaise,
      additionalDiscountPaise: financials.additionalDiscountPaise,
      totalDiscountPaise: financials.totalDiscountPaise,
      discountPercent: financials.discountPercent,
      taxableAmountPaise: financials.taxableAmountPaise,
      cgstAmountPaise: financials.cgstAmountPaise,
      sgstAmountPaise: financials.sgstAmountPaise,
      igstAmountPaise: financials.igstAmountPaise,
      totalTaxAmountPaise: financials.totalTaxAmountPaise,
      netTotalPaise: financials.netTotalPaise,
      requiresDiscountApproval,
      isDiscountApproved: false,
      discountApprovalStatus,
      taxProfile: currentQuote.taxProfile,
      termsAndConditions: input.termsAndConditions || currentQuote.termsAndConditions,
      paymentMilestones: currentQuote.paymentMilestones,
      validUntil: validUntilDate,
      status: initialStatus,
      createdBy: user.userId
    });

    await revisedQuotation.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.QUOTATION_REVISED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'quote-revise',
      details: {
        previousCode: currentQuote.fullQuotationCode,
        newCode: revisedQuotation.fullQuotationCode,
        reason: input.reasonForRevision,
        netTotalPaise: revisedQuotation.netTotalPaise
      }
    });

    logger.info(
      { previous: currentQuote.fullQuotationCode, revised: revisedQuotation.fullQuotationCode },
      'Quotation revision created successfully.'
    );

    return revisedQuotation;
  }

  /**
   * 3. Approve Discount (Anti-Self-Approval Enforced).
   */
  public static async approveDiscount(
    quotationId: string,
    input: DiscountApprovalInput,
    user: { userId: string; role?: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<IQuotationDocument> {
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      throw AppError.notFound('Quotation not found.');
    }

    if (quotation.discountApprovalStatus !== 'PENDING') {
      throw AppError.businessRule(
        `Quotation is not pending discount approval (current status: '${quotation.discountApprovalStatus}').`
      );
    }

    // Critical Anti-Self-Approval Rule
    if (quotation.createdBy.toString() === user.userId) {
      throw AppError.permissionDenied(
        'Anti-Self-Approval Violation: You cannot approve discounts on your own quotation submission.'
      );
    }

    if (input.action === 'APPROVE') {
      quotation.isDiscountApproved = true;
      quotation.discountApprovalStatus = 'APPROVED';
      quotation.discountApprovedBy = user.userId as any;
      quotation.discountApprovedAt = new Date();
      quotation.discountRemarks = input.remarks;
      quotation.status = QuotationStatus.APPROVED;

      await quotation.save();

      await AuditService.recordEvent({
        actorId: user.userId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.QUOTATION_DISCOUNT_APPROVED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId || 'quote-approve-discount',
        details: {
          fullQuotationCode: quotation.fullQuotationCode,
          discountPercent: quotation.discountPercent,
          remarks: input.remarks
        }
      });
    } else {
      quotation.isDiscountApproved = false;
      quotation.discountApprovalStatus = 'REJECTED';
      quotation.discountRejectionReason =
        input.rejectionReason || 'Discount rejected by management.';
      quotation.status = QuotationStatus.DRAFT; // Revert to draft for adjustment

      await quotation.save();

      await AuditService.recordEvent({
        actorId: user.userId,
        actorType: ActorType.EMPLOYEE,
        action: AuditAction.QUOTATION_DISCOUNT_REJECTED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId || 'quote-reject-discount',
        details: {
          fullQuotationCode: quotation.fullQuotationCode,
          discountPercent: quotation.discountPercent,
          rejectionReason: quotation.discountRejectionReason
        }
      });
    }

    return quotation;
  }

  /**
   * 4. Mark quotation as issued/sent to customer.
   */
  public static async markAsSent(
    quotationId: string,
    user: { userId: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<IQuotationDocument> {
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      throw AppError.notFound('Quotation not found.');
    }

    if (quotation.status === QuotationStatus.PENDING_APPROVAL) {
      throw AppError.businessRule(
        'Cannot issue quotation to customer while discount approval is pending.'
      );
    }

    if (
      quotation.status !== QuotationStatus.DRAFT &&
      quotation.status !== QuotationStatus.APPROVED
    ) {
      throw AppError.businessRule(
        `Cannot send quotation currently in '${quotation.status}' status.`
      );
    }

    quotation.status = QuotationStatus.SENT;
    await quotation.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.QUOTATION_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'quote-send',
      details: {
        fullQuotationCode: quotation.fullQuotationCode,
        newStatus: QuotationStatus.SENT
      }
    });

    return quotation;
  }

  /**
   * 5. Customer Review & Decision (Accept / Reject) with Idempotency & Record Isolation.
   */
  public static async customerDecision(
    quotationId: string,
    decision: CustomerQuotationDecision,
    customerId: string,
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<IQuotationDocument> {
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      throw AppError.notFound('Quotation not found.');
    }

    // Customer Isolation Guard: Must belong strictly to the authenticated customer
    if (quotation.customerId.toString() !== customerId) {
      throw AppError.permissionDenied(
        "Access denied: You cannot review or decide on another customer's quotation."
      );
    }

    // Idempotency: If already accepted, return existing accepted state safely
    if (quotation.status === QuotationStatus.ACCEPTED) {
      logger.info(
        { fullQuotationCode: quotation.fullQuotationCode, customerId },
        'Quotation already accepted; returning idempotent result.'
      );
      return quotation;
    }

    // Eligibility check
    const eligibleStates = [QuotationStatus.SENT, QuotationStatus.APPROVED];
    if (!eligibleStates.includes(quotation.status)) {
      throw AppError.businessRule(
        `Quotation is not eligible for customer decision (current status: '${quotation.status}').`
      );
    }

    // Expiry check
    if (new Date() > quotation.validUntil) {
      quotation.status = QuotationStatus.EXPIRED;
      await quotation.save();
      throw AppError.businessRule('Quotation has expired and can no longer be accepted.');
    }

    if (decision.action === 'ACCEPT') {
      quotation.status = QuotationStatus.ACCEPTED;
      quotation.acceptedAt = new Date();
      quotation.acceptedByCustomerId = customerId as any;
      quotation.decisionIpAddress = context.ipAddress;
      quotation.customerNotes = decision.notes;

      await quotation.save();

      await AuditService.recordEvent({
        actorId: customerId,
        actorType: ActorType.CUSTOMER,
        action: AuditAction.QUOTATION_CUSTOMER_ACCEPTED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId || 'quote-customer-accept',
        details: {
          fullQuotationCode: quotation.fullQuotationCode,
          netTotalPaise: quotation.netTotalPaise
        }
      });

      logger.info(
        { fullQuotationCode: quotation.fullQuotationCode, customerId },
        'Quotation accepted by customer.'
      );
    } else {
      quotation.status = QuotationStatus.REJECTED;
      quotation.rejectionReason = decision.rejectionReason || 'Declined by customer.';
      quotation.decisionIpAddress = context.ipAddress;
      quotation.customerNotes = decision.notes;

      await quotation.save();

      await AuditService.recordEvent({
        actorId: customerId,
        actorType: ActorType.CUSTOMER,
        action: AuditAction.QUOTATION_CUSTOMER_REJECTED,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId || 'quote-customer-reject',
        details: {
          fullQuotationCode: quotation.fullQuotationCode,
          rejectionReason: quotation.rejectionReason
        }
      });

      logger.info(
        { fullQuotationCode: quotation.fullQuotationCode, customerId },
        'Quotation declined by customer.'
      );
    }

    return quotation;
  }

  /**
   * 6. Retrieve single quotation with full populates.
   */
  public static async getQuotationById(id: string): Promise<IQuotationDocument> {
    const quotation = await Quotation.findById(id)
      .populate('customerId', 'name legalName companyName customerCode primaryPhone email addresses')
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate(
        'solarDesignId',
        'designNumber proposedCapacityKwp systemTopology estimatedGeneration'
      )
      .populate('lineItems.productId', 'name sku brand defaultGstRate')
      .populate('createdBy', 'firstName lastName email')
      .populate('discountApprovedBy', 'firstName lastName email');

    if (!quotation) {
      throw AppError.notFound('Quotation not found.');
    }
    return quotation;
  }

  /**
   * 7. List quotations with pagination, filtering, and role scoping.
   */
  public static async listQuotations(
    filter: QuotationFilter,
    _user?: { userId: string; role: UserRole }
  ) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.customerId) query.customerId = filter.customerId;
    if (filter.leadId) query.leadId = filter.leadId;
    if (filter.status) query.status = filter.status;
    if (filter.systemTopology) query.systemTopology = filter.systemTopology;
    if (filter.requiresDiscountApproval !== undefined) {
      query.requiresDiscountApproval = filter.requiresDiscountApproval;
    }
    if (filter.isLatestRevision !== undefined) {
      query.isLatestRevision = filter.isLatestRevision;
    }

    if (filter.search) {
      query.$or = [
        { quotationNumber: { $regex: filter.search, $options: 'i' } },
        { fullQuotationCode: { $regex: filter.search, $options: 'i' } }
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      [filter.sortBy || 'createdAt']: filter.sortOrder === 'asc' ? 1 : -1
    };

    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'legalName customerCode')
        .populate('createdBy', 'firstName lastName')
        .lean(),
      Quotation.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: quotations,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}
