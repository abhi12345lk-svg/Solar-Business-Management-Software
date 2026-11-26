/**
 * INS Solar Business Management Software — Customer GST Tax Invoice Service
 *
 * Implements generation, sequential numbering, HSN/SAC classification,
 * dual GST calculations (CGST+SGST vs IGST), duplicate prevention, payment reconciliation,
 * and audited lifecycle for customer tax invoices.
 */

import mongoose, { Types } from 'mongoose';
import {
  CreateCustomerInvoiceInput,
  CancelCustomerInvoiceInput,
  CustomerInvoiceFilterInput,
  CustomerInvoiceType,
  CustomerInvoiceStatus,
  PaymentAllocationStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { CustomerInvoice, ICustomerInvoiceDocument, IInvoiceLineItem } from '../models/CustomerInvoice.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class CustomerInvoiceService {
  /**
   * Determine standard HSN/SAC code based on line item classification.
   * Standard Indian GST Tariff:
   * - 8541: Solar Photovoltaic Cells and Modules (assembled into panels)
   * - 8504: Solar Inverters, PCUs, and Static Converters
   * - 8471 / 7308: Module Mounting Structures & BOS
   * - 9954: Construction / EPC Turnkey Installation & Commissioning Services
   */
  private static resolveHsnSac(itemType: string, description: string): string {
    const desc = (description || '').toUpperCase();
    const type = (itemType || '').toUpperCase();

    // Check EPC / Turnkey / Labour / Installation service first
    if (type.includes('SERVICE') || type.includes('LABOUR') || type.includes('INSTALL') || desc.includes('TURNKEY') || desc.includes('INSTALL') || desc.includes('COMMISSION') || desc.includes('LABOUR')) {
      return '9954';
    }
    if (desc.includes('PANEL') || desc.includes('MODULE') || desc.includes('PV') || type.includes('MODULE')) {
      return '8541';
    }
    if (desc.includes('INVERTER') || desc.includes('PCU') || type.includes('INVERTER')) {
      return '8504';
    }
    if (desc.includes('STRUCTURE') || desc.includes('MOUNT') || desc.includes('BOS') || type.includes('STRUCTURE')) {
      return '7308';
    }
    if (desc.includes('INSTALL') || desc.includes('LABOUR') || desc.includes('EPC') || desc.includes('SERVICE') || type.includes('SERVICE')) {
      return '9954';
    }
    return '8541'; // Standard default solar equipment tariff
  }

  /**
   * Generates a new Customer GST Tax Invoice from a confirmed Sales Order.
   */
  public static async createInvoiceFromOrder(
    input: CreateCustomerInvoiceInput,
    user: { userId: string; role?: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ICustomerInvoiceDocument> {
    // 1. Idempotency Check
    if (input.idempotencyKey?.trim()) {
      const existing = await CustomerInvoice.findOne({
        idempotencyKey: input.idempotencyKey.trim()
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Fetch Sales Order
    if (!Types.ObjectId.isValid(input.orderId)) {
      throw AppError.badRequest('Invalid Sales Order ID format.');
    }

    const order = await SalesOrder.findById(input.orderId);
    if (!order) {
      throw AppError.notFound(`Sales Order with ID '${input.orderId}' not found.`);
    }

    // 3. Fetch Customer
    const customer = await Customer.findById(order.customerId);
    if (!customer) {
      throw AppError.notFound(`Customer linked to order '${order.orderNumber}' not found.`);
    }

    // 4. Duplicate & Credit Note Validation
    let originalInvoice: ICustomerInvoiceDocument | null = null;
    if (input.invoiceType === CustomerInvoiceType.TAX_INVOICE) {
      const existingTaxInvoice = await CustomerInvoice.findOne({
        orderId: order._id,
        invoiceType: CustomerInvoiceType.TAX_INVOICE,
        status: { $ne: CustomerInvoiceStatus.CANCELLED }
      });
      if (existingTaxInvoice) {
        throw AppError.duplicateResource(
          `A final GST Tax Invoice (${existingTaxInvoice.invoiceNumber}) has already been generated for Sales Order '${order.orderNumber}'.`
        );
      }
    } else if (input.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE) {
      if (input.milestoneIndex === undefined || input.milestoneIndex < 0) {
        throw AppError.badRequest('Milestone index is required for Milestone Advance Invoices.');
      }
      const existingMilestoneInvoice = await CustomerInvoice.findOne({
        orderId: order._id,
        invoiceType: CustomerInvoiceType.MILESTONE_INVOICE,
        milestoneIndex: input.milestoneIndex,
        status: { $ne: CustomerInvoiceStatus.CANCELLED }
      });
      if (existingMilestoneInvoice) {
        throw AppError.duplicateResource(
          `A Milestone Invoice (${existingMilestoneInvoice.invoiceNumber}) has already been generated for milestone #${input.milestoneIndex + 1} of order '${order.orderNumber}'.`
        );
      }
    } else if (input.invoiceType === CustomerInvoiceType.CREDIT_NOTE) {
      if (!input.originalInvoiceId || !Types.ObjectId.isValid(input.originalInvoiceId)) {
        throw AppError.badRequest('A valid originalInvoiceId is required when issuing a Credit Note.');
      }
      originalInvoice = await CustomerInvoice.findById(input.originalInvoiceId);
      if (
        !originalInvoice ||
        originalInvoice.orderId.toString() !== order._id.toString() ||
        originalInvoice.status === CustomerInvoiceStatus.CANCELLED ||
        originalInvoice.invoiceType === CustomerInvoiceType.CREDIT_NOTE
      ) {
        throw AppError.businessRule(
          'Original customer invoice is invalid, cancelled, or does not belong to this Sales Order.'
        );
      }
    }

    // 5. Fetch Company Settings (Registered Address, GSTIN, State)
    const companySettings = await CompanySettings.findOne({ key: 'COMPANY_SETTINGS' });
    const companyName = companySettings?.legalEntityName || companySettings?.companyName || 'INS Solar Private Limited';
    const companyGstin = companySettings?.gstin || '';
    const companyPan = companySettings?.pan || '';
    const companyState = companySettings?.registeredAddress?.state || 'Chhattisgarh';
    const companyStateCode = companySettings?.registeredAddress?.stateCode || (companyGstin ? companyGstin.substring(0, 2) : '22');

    // Customer Location Details
    const customerBilling = customer.billingAddress;
    const customerInstallation = customer.installationAddress;
    const customerState = customerBilling?.state || customerInstallation?.state || companyState;
    const customerStateCode = customerBilling?.stateCode || (customer.gstin ? customer.gstin.substring(0, 2) : companyStateCode);

    // Interstate Check: If interstate flag explicitly configured on order, or company state differs from customer place of supply
    const isInterState = order.taxProfile?.isInterState !== undefined
      ? order.taxProfile.isInterState
      : companyStateCode !== customerStateCode;

    // 6. Calculate Line Items & GST
    const lineItems: IInvoiceLineItem[] = [];

    if (input.invoiceType === CustomerInvoiceType.CREDIT_NOTE && originalInvoice) {
      const priorCreditNotes = await CustomerInvoice.find({
        originalInvoiceId: originalInvoice._id,
        invoiceType: CustomerInvoiceType.CREDIT_NOTE,
        status: { $ne: CustomerInvoiceStatus.CANCELLED }
      }).lean();
      const priorCreditedPaise = priorCreditNotes.reduce(
        (sum, cn) => sum + (cn.netTotalPaise || 0),
        0
      );
      const remainingCreditablePaise = Math.max(
        0,
        (originalInvoice.netTotalPaise || 0) - priorCreditedPaise
      );
      const creditGrossTotalPaise = input.creditAmountPaise ?? remainingCreditablePaise;
      if (creditGrossTotalPaise <= 0 || creditGrossTotalPaise > remainingCreditablePaise) {
        throw AppError.businessRule(
          `Credit Note amount (₹${(creditGrossTotalPaise / 100).toFixed(2)}) exceeds remaining creditable balance (₹${(remainingCreditablePaise / 100).toFixed(2)}) on ${originalInvoice.invoiceNumber}.`
        );
      }

      const ratio =
        originalInvoice.netTotalPaise > 0
          ? creditGrossTotalPaise / originalInvoice.netTotalPaise
          : 1;
      const creditTaxable = Math.round((originalInvoice.taxableAmountPaise || 0) * ratio);
      const creditCgst = Math.round((originalInvoice.totalCgstPaise || 0) * ratio);
      const creditSgst = Math.round((originalInvoice.totalSgstPaise || 0) * ratio);
      const creditIgst = Math.round((originalInvoice.totalIgstPaise || 0) * ratio);
      const creditGstRateBps = originalInvoice.lineItems?.[0]?.gstRateBasisPoints ?? 1200;

      lineItems.push({
        itemType: 'CREDIT_ADJUSTMENT',
        description: `Credit Note adjustment against ${originalInvoice.invoiceNumber}${input.notes ? ` (${input.notes.trim()})` : ''}`,
        hsnSacCode: originalInvoice.lineItems?.[0]?.hsnSacCode || '9954',
        quantity: 1,
        unit: 'NOS',
        unitRatePaise: creditTaxable,
        discountPaise: 0,
        taxableAmountPaise: creditTaxable,
        gstRateBasisPoints: creditGstRateBps,
        cgstPaise: creditCgst,
        sgstPaise: creditSgst,
        igstPaise: creditIgst,
        itemTotalPaise: creditTaxable + creditCgst + creditSgst + creditIgst
      });
    } else if (input.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE && input.milestoneIndex !== undefined) {
      const milestone = order.paymentMilestones?.[input.milestoneIndex];
      if (!milestone) {
        throw AppError.badRequest(`Milestone #${input.milestoneIndex + 1} does not exist on Sales Order '${order.orderNumber}'.`);
      }

      const milestonePercentage = milestone.percentage || 0;
      const milestoneTaxablePaise =
        milestone.amountPaise !== undefined && milestone.amountPaise > 0
          ? milestone.amountPaise
          : Math.round((order.taxableAmountPaise * milestonePercentage) / 100);

      // Configurable GST Treatment:
      // Priority 1: Explicit milestone-level rate
      // Priority 2: Order-level tax profile default rate
      // Priority 3: 70:30 Deemed Valuation Rule for Composite EPC (13.8% = 1380 bps)
      // Priority 4: Standard SAC 9954 Service Rate (18% = 1800 bps)
      const is7030 = Boolean(
        (order.taxProfile as any)?.useDeemedValuation7030 ||
        (order as any)?.isSolarEpcComposite
      );
      const gstRateBps =
        (milestone as any)?.gstRateBasisPoints !== undefined
          ? (milestone as any).gstRateBasisPoints
          : (order.taxProfile as any)?.defaultGstRateBps !== undefined
          ? (order.taxProfile as any).defaultGstRateBps
          : is7030
          ? 1380
          : 1800;

      let cgstPaise = 0;
      let sgstPaise = 0;
      let igstPaise = 0;

      if (isInterState) {
        igstPaise = Math.round((milestoneTaxablePaise * gstRateBps) / 10000);
      } else {
        const halfBps = Math.floor(gstRateBps / 2);
        cgstPaise = Math.round((milestoneTaxablePaise * halfBps) / 10000);
        sgstPaise = Math.round((milestoneTaxablePaise * halfBps) / 10000);
      }

      const itemTotalPaise = milestoneTaxablePaise + cgstPaise + sgstPaise + igstPaise;

      lineItems.push({
        itemType: 'SERVICE',
        description: `Milestone Advance: ${milestone.name || `Stage ${input.milestoneIndex + 1}`} (${milestonePercentage}% of Solar EPC Order ${order.orderNumber})${is7030 ? ' [70:30 Deemed Valuation Scheme Applied]' : ''}`,
        hsnSacCode: '9954',
        quantity: 1,
        unit: 'STAGE',
        unitRatePaise: milestoneTaxablePaise,
        discountPaise: 0,
        taxableAmountPaise: milestoneTaxablePaise,
        gstRateBasisPoints: gstRateBps,
        cgstPaise,
        sgstPaise,
        igstPaise,
        itemTotalPaise
      });
    } else {
      // Full Tax Invoice from order line items
      for (const item of order.lineItems) {
        const hsnSacCode = CustomerInvoiceService.resolveHsnSac(item.itemType, item.description);
        const taxablePaise = item.taxableAmountPaise;
        const gstRateBps = item.gstRateBasisPoints || 1200; // Default 12% solar equipment

        let cgstPaise = 0;
        let sgstPaise = 0;
        let igstPaise = 0;

        if (isInterState) {
          igstPaise = Math.round((taxablePaise * gstRateBps) / 10000);
        } else {
          const halfBps = Math.floor(gstRateBps / 2);
          cgstPaise = Math.round((taxablePaise * halfBps) / 10000);
          sgstPaise = Math.round((taxablePaise * halfBps) / 10000);
        }

        const itemTotalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise;

        lineItems.push({
          itemType: item.itemType,
          description: item.description,
          hsnSacCode,
          quantity: item.quantity,
          unit: item.unit || 'NOS',
          unitRatePaise: item.unitRatePaise,
          discountPaise: item.discountPaise || 0,
          taxableAmountPaise: taxablePaise,
          gstRateBasisPoints: gstRateBps,
          cgstPaise,
          sgstPaise,
          igstPaise,
          itemTotalPaise
        });
      }
    }

    // 7. Aggregate Totals & Reconcile with Order Contract Net Total & Previous Advances
    const grossSubtotalPaise = lineItems.reduce((acc, item) => acc + (item.unitRatePaise * item.quantity), 0);
    const lineDiscountPaise = lineItems.reduce((acc, item) => acc + item.discountPaise, 0);
    const rawTaxablePaise = lineItems.reduce((acc, item) => acc + item.taxableAmountPaise, 0);
    let totalCgstPaise = lineItems.reduce((acc, item) => acc + item.cgstPaise, 0);
    let totalSgstPaise = lineItems.reduce((acc, item) => acc + item.sgstPaise, 0);
    let totalIgstPaise = lineItems.reduce((acc, item) => acc + item.igstPaise, 0);

    let totalDiscountPaise = lineDiscountPaise;
    let taxableAmountPaise = rawTaxablePaise;

    if (
      input.invoiceType === CustomerInvoiceType.TAX_INVOICE &&
      (order.additionalDiscountPaise || 0) > 0 &&
      rawTaxablePaise > 0
    ) {
      const addlDisc = Math.min(rawTaxablePaise, order.additionalDiscountPaise || 0);
      totalDiscountPaise = lineDiscountPaise + addlDisc;
      taxableAmountPaise = Math.max(0, rawTaxablePaise - addlDisc);
      const scale = taxableAmountPaise / rawTaxablePaise;
      totalCgstPaise = Math.round(totalCgstPaise * scale);
      totalSgstPaise = Math.round(totalSgstPaise * scale);
      totalIgstPaise = Math.round(totalIgstPaise * scale);
    }

    const totalTaxPaise = totalCgstPaise + totalSgstPaise + totalIgstPaise;
    const netTotalPaise = taxableAmountPaise + totalTaxPaise;

    let advancesAdjustedPaise = 0;
    let priorMilestonesPaidPaise = 0;

    if (
      (input.invoiceType === CustomerInvoiceType.TAX_INVOICE ||
        input.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE) &&
      (mongoose.connection.readyState === 1 || (CustomerInvoice.find as any)?.mock)
    ) {
      const orderDocs = await CustomerInvoice.find({
        orderId: order._id,
        invoiceType: {
          $in: [CustomerInvoiceType.MILESTONE_INVOICE, CustomerInvoiceType.CREDIT_NOTE]
        },
        status: { $ne: CustomerInvoiceStatus.CANCELLED }
      });

      const priorMilestones = orderDocs.filter(
        inv => !inv.invoiceType || inv.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE
      );
      if (input.invoiceType === CustomerInvoiceType.TAX_INVOICE) {
        const milestoneIds = new Set(
          priorMilestones.map(m => m._id?.toString()).filter(Boolean)
        );
        const rawMilestonesBilledPaise = priorMilestones.reduce(
          (sum, inv) => sum + (inv.netTotalPaise || 0),
          0
        );
        // Credit Notes against prior Milestone Invoices reduce the billed milestone advance credit
        const milestoneCreditNotesPaise = orderDocs
          .filter(
            cn =>
              cn.invoiceType === CustomerInvoiceType.CREDIT_NOTE &&
              cn.originalInvoiceId &&
              milestoneIds.has(cn.originalInvoiceId.toString())
          )
          .reduce((sum, cn) => sum + (cn.netTotalPaise || 0), 0);

        advancesAdjustedPaise = Math.max(0, rawMilestonesBilledPaise - milestoneCreditNotesPaise);
      }
      priorMilestonesPaidPaise = priorMilestones.reduce(
        (sum, inv) => sum + (inv.amountPaidPaise || 0),
        0
      );
    }

    // 8. Reconcile Customer Payments without double-counting allocations across multiple Milestone Invoices
    let amountPaidPaise = 0;
    let balanceDuePaise = 0;
    let status = CustomerInvoiceStatus.ISSUED;

    if (input.invoiceType === CustomerInvoiceType.CREDIT_NOTE) {
      amountPaidPaise = netTotalPaise;
      balanceDuePaise = 0;
      status = CustomerInvoiceStatus.PAID;
    } else {
      const allocations = await PaymentAllocation.find({
        salesOrderId: order._id,
        status: PaymentAllocationStatus.ACTIVE
      });
      const totalAllocatedPaise = allocations.reduce(
        (sum, a) => sum + (a.allocatedAmountPaise || 0),
        0
      );
      const remainingAvailableAllocations = Math.max(
        0,
        totalAllocatedPaise - priorMilestonesPaidPaise
      );
      const netPayablePaise = Math.max(0, netTotalPaise - advancesAdjustedPaise);
      amountPaidPaise = Math.min(netPayablePaise, remainingAvailableAllocations);
      balanceDuePaise = Math.max(0, netPayablePaise - amountPaidPaise);

      if (balanceDuePaise === 0 && netTotalPaise > 0) {
        status = CustomerInvoiceStatus.PAID;
      } else if (amountPaidPaise > 0) {
        status = CustomerInvoiceStatus.PARTIALLY_PAID;
      }
    }

    // 9. Generate Strictly Monotonic Sequential Invoice Number
    const seq = await SequenceService.generateNumber(SequenceEntityType.INVOICE);
    const invoiceNumber = seq.formattedNumber;

    // 10. Persist Customer Invoice
    const invoice = new CustomerInvoice({
      invoiceNumber,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerId: customer._id,
      customerCode: customer.customerCode,
      customerName: customer.name,
      customerGstin: customer.gstin,
      customerPan: customer.pan,
      customerBillingAddress: customerBilling ? {
        addressLine1: customerBilling.addressLine1,
        city: customerBilling.city,
        state: customerBilling.state,
        postalCode: customerBilling.postalCode,
        stateCode: customerStateCode
      } : undefined,
      customerInstallationAddress: customerInstallation ? {
        addressLine1: customerInstallation.addressLine1,
        city: customerInstallation.city,
        state: customerInstallation.state,
        postalCode: customerInstallation.postalCode
      } : undefined,
      companyName,
      companyGstin,
      companyPan,
      companyAddress: companySettings?.registeredAddress ? {
        addressLine1: companySettings.registeredAddress.addressLine1,
        city: companySettings.registeredAddress.city,
        state: companySettings.registeredAddress.state,
        postalCode: companySettings.registeredAddress.postalCode,
        stateCode: companyStateCode
      } : undefined,
      placeOfSupply: customerState,
      stateCode: customerStateCode,
      isInterState,
      systemCapacityKwp: order.systemCapacityKwp,
      systemTopology: order.systemTopology,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      invoiceType: input.invoiceType,
      originalInvoiceId: originalInvoice?._id,
      milestoneIndex: input.milestoneIndex,
      milestoneName: input.milestoneIndex !== undefined ? order.paymentMilestones?.[input.milestoneIndex]?.name : undefined,
      percentageBilled: input.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE && input.milestoneIndex !== undefined
        ? order.paymentMilestones?.[input.milestoneIndex]?.percentage
        : 100,
      lineItems,
      grossSubtotalPaise,
      totalDiscountPaise,
      taxableAmountPaise,
      totalCgstPaise,
      totalSgstPaise,
      totalIgstPaise,
      totalTaxPaise,
      netTotalPaise,
      amountPaidPaise,
      balanceDuePaise,
      status,
      termsAndConditions: order.termsAndConditions || [
        '1. Goods once sold will not be taken back without prior authorization.',
        '2. System equipment warranties are subject to manufacturer terms and conditions.',
        '3. Payment terms as agreed per the approved Sales Contract.'
      ],
      notes: input.notes?.trim() || order.notes,
      idempotencyKey: input.idempotencyKey?.trim(),
      issuedBy: new Types.ObjectId(user.userId)
    });

    await invoice.save();

    if (input.invoiceType === CustomerInvoiceType.CREDIT_NOTE && originalInvoice) {
      originalInvoice.balanceDuePaise = Math.max(
        0,
        (originalInvoice.balanceDuePaise || 0) - netTotalPaise
      );
      if (originalInvoice.balanceDuePaise === 0 && originalInvoice.amountPaidPaise > 0) {
        originalInvoice.status = CustomerInvoiceStatus.PAID;
      }
      await originalInvoice.save();
    }

    // 11. Security Audit Logging
    await AuditService.recordEvent({
      action:
        input.invoiceType === CustomerInvoiceType.CREDIT_NOTE
          ? AuditAction.CUSTOMER_CREDIT_NOTE_CREATED
          : AuditAction.CUSTOMER_INVOICE_CREATED,
      actorType: ActorType.EMPLOYEE,
      actorId: user.userId,
      targetEntity: 'CustomerInvoice',
      targetId: invoice._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'N/A',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        originalInvoiceNumber: originalInvoice?.invoiceNumber,
        orderNumber: order.orderNumber,
        customerName: customer.name,
        netTotalPaise,
        status: invoice.status,
        isInterState
      }
    });

    return invoice;
  }

  /**
   * Fetch invoice by ID with authorization and customer portal boundary check.
   */
  public static async getInvoiceById(
    id: string,
    customerScopeId?: string
  ): Promise<ICustomerInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Invoice ID format.');
    }

    const invoice = await CustomerInvoice.findById(id)
      .populate('orderId', 'orderNumber status systemCapacityKwp systemTopology')
      .populate('customerId', 'name customerCode primaryPhone email');

    if (!invoice) {
      throw AppError.notFound(`Customer Invoice not found.`);
    }

    if (customerScopeId) {
      const ownerId =
        (invoice.customerId as any)?._id?.toString() || invoice.customerId?.toString();
      if (ownerId !== customerScopeId) {
        throw AppError.permissionDenied(
          "Access denied: You cannot view another customer's tax invoice."
        );
      }
    }

    return invoice;
  }

  /**
   * Lists customer invoices with filtering and pagination.
   */
  public static async listInvoices(
    filter: CustomerInvoiceFilterInput,
    customerScopeId?: string
  ): Promise<{ invoices: ICustomerInvoiceDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const query: any = {};

    if (customerScopeId) {
      query.customerId = new Types.ObjectId(customerScopeId);
    } else if (filter.customerId) {
      query.customerId = new Types.ObjectId(filter.customerId);
    }

    if (filter.orderId) {
      query.orderId = new Types.ObjectId(filter.orderId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      query.invoiceDate = {};
      if (filter.startDate) query.invoiceDate.$gte = new Date(filter.startDate);
      if (filter.endDate) query.invoiceDate.$lte = new Date(filter.endDate);
    }

    if (filter.search?.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { orderNumber: searchRegex },
        { customerName: searchRegex },
        { customerCode: searchRegex }
      ];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;

    const [invoices, total] = await Promise.all([
      CustomerInvoice.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomerInvoice.countDocuments(query)
    ]);

    return {
      invoices: invoices as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Cancels a Customer Tax Invoice (Authorized for SUPERADMIN, ADMIN, DEPARTMENT_HEAD).
   */
  public static async cancelInvoice(
    id: string,
    input: CancelCustomerInvoiceInput,
    user: { userId: string; role: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<ICustomerInvoiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid Invoice ID format.');
    }

    // Role verification
    const allowedRoles = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_HEAD];
    if (!allowedRoles.includes(user.role as UserRole)) {
      throw AppError.forbidden('Only Administrator or Accounts Head can cancel a statutory GST Tax Invoice.');
    }

    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      throw AppError.notFound(`Customer Invoice not found.`);
    }

    if (invoice.status === CustomerInvoiceStatus.CANCELLED) {
      throw AppError.badRequest(`Invoice ${invoice.invoiceNumber} is already cancelled.`);
    }

    if (
      invoice.invoiceType !== CustomerInvoiceType.CREDIT_NOTE &&
      (invoice.amountPaidPaise || 0) > 0
    ) {
      throw AppError.badRequest(
        `Cannot cancel invoice ${invoice.invoiceNumber} because ₹${((invoice.amountPaidPaise || 0) / 100).toLocaleString('en-IN')} has already been paid or credited. Reverse allocations or issue a Credit Note instead.`
      );
    }

    if (mongoose.connection.readyState === 1 || (CustomerInvoice.findOne as any)?.mock) {
      const activeCreditNote = await CustomerInvoice.findOne({
        originalInvoiceId: invoice._id,
        invoiceType: CustomerInvoiceType.CREDIT_NOTE,
        status: { $ne: CustomerInvoiceStatus.CANCELLED },
        isDeleted: { $ne: true }
      })
        .select('invoiceNumber')
        .lean();
      if (activeCreditNote) {
        throw AppError.badRequest(
          `Cannot cancel invoice ${invoice.invoiceNumber} while linked Credit Note ${activeCreditNote.invoiceNumber} is active.`
        );
      }
    }

    invoice.status = CustomerInvoiceStatus.CANCELLED;
    invoice.cancellationReason = input.cancellationReason.trim();
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = new Types.ObjectId(user.userId);

    await invoice.save();

    // Security Audit Log
    await AuditService.recordEvent({
      action: AuditAction.CUSTOMER_INVOICE_CANCELLED,
      actorType: ActorType.EMPLOYEE,
      actorId: user.userId,
      targetEntity: 'CustomerInvoice',
      targetId: invoice._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'N/A',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        cancellationReason: input.cancellationReason.trim()
      }
    });

    return invoice;
  }
}
