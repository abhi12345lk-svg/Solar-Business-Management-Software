/**
 * INS Solar Business Management Software — Customer GST Tax Invoice Service
 *
 * Implements generation, sequential numbering, HSN/SAC classification,
 * dual GST calculations (CGST+SGST vs IGST), duplicate prevention, payment reconciliation,
 * and audited lifecycle for customer tax invoices.
 */

import { Types } from 'mongoose';
import {
  CreateCustomerInvoiceInput,
  CancelCustomerInvoiceInput,
  CustomerInvoiceFilterInput,
  CustomerInvoiceType,
  CustomerInvoiceStatus,
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

    // 4. Duplicate Check
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

    if (input.invoiceType === CustomerInvoiceType.MILESTONE_INVOICE && input.milestoneIndex !== undefined) {
      const milestone = order.paymentMilestones?.[input.milestoneIndex];
      if (!milestone) {
        throw AppError.badRequest(`Milestone #${input.milestoneIndex + 1} does not exist on Sales Order '${order.orderNumber}'.`);
      }

      const milestonePercentage = milestone.percentage;
      const milestoneTaxablePaise = Math.round((order.taxableAmountPaise * milestonePercentage) / 100);
      const gstRateBps = 1800; // Standard 18% SAC 9954 for milestone advance EPC services

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
        description: `Milestone Advance: ${milestone.name || `Stage ${input.milestoneIndex + 1}`} (${milestonePercentage}% of Solar EPC Order ${order.orderNumber})`,
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

    // 7. Aggregate Totals
    const grossSubtotalPaise = lineItems.reduce((acc, item) => acc + (item.unitRatePaise * item.quantity), 0);
    const totalDiscountPaise = lineItems.reduce((acc, item) => acc + item.discountPaise, 0);
    const taxableAmountPaise = lineItems.reduce((acc, item) => acc + item.taxableAmountPaise, 0);
    const totalCgstPaise = lineItems.reduce((acc, item) => acc + item.cgstPaise, 0);
    const totalSgstPaise = lineItems.reduce((acc, item) => acc + item.sgstPaise, 0);
    const totalIgstPaise = lineItems.reduce((acc, item) => acc + item.igstPaise, 0);
    const totalTaxPaise = totalCgstPaise + totalSgstPaise + totalIgstPaise;
    const netTotalPaise = taxableAmountPaise + totalTaxPaise;

    // 8. Reconcile Customer Payments against this Order
    const allocations = await PaymentAllocation.find({
      salesOrderId: order._id,
      status: 'ALLOCATED'
    });
    const totalAllocatedPaise = allocations.reduce((sum, a) => sum + (a.allocatedAmountPaise || 0), 0);
    const amountPaidPaise = Math.min(netTotalPaise, totalAllocatedPaise);
    const balanceDuePaise = Math.max(0, netTotalPaise - amountPaidPaise);

    let status = CustomerInvoiceStatus.ISSUED;
    if (balanceDuePaise === 0 && netTotalPaise > 0) {
      status = CustomerInvoiceStatus.PAID;
    } else if (amountPaidPaise > 0) {
      status = CustomerInvoiceStatus.PARTIALLY_PAID;
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

    // 11. Security Audit Logging
    await AuditService.recordEvent({
      action: AuditAction.CUSTOMER_INVOICE_CREATED,
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

    const query: any = { _id: new Types.ObjectId(id) };
    if (customerScopeId) {
      query.customerId = new Types.ObjectId(customerScopeId);
    }

    const invoice = await CustomerInvoice.findOne(query)
      .populate('orderId', 'orderNumber status systemCapacityKwp systemTopology')
      .populate('customerId', 'name customerCode primaryPhone email');

    if (!invoice) {
      throw AppError.notFound(`Customer Invoice not found.`);
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
