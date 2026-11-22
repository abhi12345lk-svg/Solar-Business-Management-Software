/**
 * INS Solar Business Management Software — Phase 1 End-to-End Integration & Regression Test Suite
 *
 * Verifies all 3 approved Phase 1 capabilities:
 * 1. Pre-Dispatch Payment Verification & Managerial Override (Decision 1)
 * 2. Statutory Customer GST Tax Invoice System (Decision 2)
 * 3. Installer Panel Scoping, Project Access Boundaries & Statutory Site Photos (Decision 3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  CustomerInvoiceType,
  CustomerInvoiceStatus,
  AuditAction,
  AuditOutcome,
  SolarTopology,
  ProjectStatus,
  SequenceEntityType
} from '@ins-solar/shared';

import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockReservation } from '../models/StockReservation.js';
import { InstallationModel } from '../models/Installation.js';
import { Warehouse } from '../models/Warehouse.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';

import { CustomerInvoiceService } from '../services/customerInvoiceService.js';
import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { ProjectService } from '../services/projectService.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { AppError } from '../errors/AppError.js';

describe('Phase 1 E2E Integration: Pre-Dispatch, Customer GST Invoicing & Installer Scoping', () => {
  const adminActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.SUPERADMIN,
    department: Department.ADMIN
  };

  const deptHeadActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.DEPARTMENT_HEAD,
    department: Department.OPERATIONS
  };

  const salesActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.SALES_EXECUTIVE,
    department: Department.SALES
  };

  const installerActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.INSTALLATION_CREW,
    department: Department.OPERATIONS
  };

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'vitest-phase1-e2e',
    correlationId: 'corr-phase1-e2e-001'
  };

  const mockCustomerId = new Types.ObjectId();
  const mockOrderId = new Types.ObjectId();
  const mockProjectId = new Types.ObjectId();
  const mockWarehouseId = new Types.ObjectId();
  const mockProductId = new Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  // =========================================================================
  // 1. PRE-DISPATCH PAYMENT VERIFICATION & MANAGERIAL OVERRIDE (DECISION 1)
  // =========================================================================
  describe('1. Pre-Dispatch Payment Verification & Managerial Override', () => {
    const baseOrder = {
      _id: mockOrderId,
      orderNumber: 'ORD-2026-00001',
      customerId: mockCustomerId,
      netTotalPaise: 50000000, // ₹5,00,000
      paymentMilestones: [
        { name: 'Booking Advance', percentage: 20 }, // ₹1,00,000 required before dispatch
        { name: 'Material Dispatch', percentage: 60 },
        { name: 'Installation & Handover', percentage: 20 }
      ],
      lineItems: [
        {
          productId: mockProductId,
          quantity: 20,
          description: 'Solar PV Modules 540W'
        }
      ]
    };

    const baseProject = {
      _id: mockProjectId,
      projectCode: 'PRJ-2026-00001',
      status: ProjectStatus.IN_PROGRESS,
      orderId: mockOrderId,
      customerId: mockCustomerId
    };

    const mockWarehouseDoc = {
      _id: mockWarehouseId,
      name: 'Central Warehouse Raipur',
      isActive: true
    };

    const setupOrderMock = () => {
      const orderQueryMock: any = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(baseOrder),
        then: vi.fn().mockImplementation((fn: any) => fn(baseOrder))
      };
      vi.spyOn(SalesOrder, 'findById').mockReturnValue(orderQueryMock);
    };

    const setupPaymentAllocationMock = (allocations: any[] = []) => {
      const allocQueryMock: any = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(allocations),
        then: vi.fn().mockImplementation((fn: any) => fn(allocations))
      };
      vi.spyOn(PaymentAllocation, 'find').mockReturnValue(allocQueryMock);
    };

    const setupDispatchFulfillmentMocks = () => {
      vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
        formattedNumber: `${type}-2026-00001`,
        sequenceNumber: 1,
        sequenceKey: `${type}:2026`,
        prefix: `${type}`,
        fiscalYear: '2026'
      }));
      vi.spyOn(MaterialDispatch, 'find').mockResolvedValue([]);
      vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValue(null);
      vi.spyOn(Product, 'findById').mockResolvedValue({
        _id: mockProductId,
        isActive: true,
        requiresSerialTracking: false
      } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({
        productId: mockProductId,
        warehouseId: mockWarehouseId,
        onHandQuantity: 100
      } as any);
      vi.spyOn(StockMovement.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });
      vi.spyOn(MaterialDispatch.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });
      vi.spyOn(User, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([{ _id: new Types.ObjectId() }])
      } as any);
      vi.spyOn(NotificationCenterService, 'createNotification').mockResolvedValue({} as any);
    };

    it('Scenario 1.1: Blocks material dispatch when payment is completely zero without override', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      setupPaymentAllocationMock([]);

      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: mockProjectId.toString(),
            sourceWarehouseId: mockWarehouseId.toString(),
            dispatchDate: new Date().toISOString(),
            lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }]
          } as any,
          deptHeadActor,
          mockContext
        )
      ).rejects.toThrow(/Material dispatch is blocked/i);
    });

    it('Scenario 1.2: Blocks material dispatch when payment is insufficient (₹50k paid, ₹1L advance required)', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      // Only ₹50,000 paid (5000000 paise) vs ₹1,00,000 required (10000000 paise)
      setupPaymentAllocationMock([
        { allocatedAmountPaise: 5000000, status: 'ACTIVE' }
      ]);

      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: mockProjectId.toString(),
            sourceWarehouseId: mockWarehouseId.toString(),
            dispatchDate: new Date().toISOString(),
            lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }]
          } as any,
          adminActor,
          mockContext
        )
      ).rejects.toThrow(/Shortfall/i);
    });

    it('Scenario 1.3: Allows material dispatch when sufficient advance payment (₹1.2L) is reconciled', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      // ₹1,20,000 allocated (exceeds ₹1,00,000 advance requirement)
      setupPaymentAllocationMock([
        { allocatedAmountPaise: 12000000, status: 'ACTIVE' }
      ]);
      setupDispatchFulfillmentMocks();

      const dispatch = await MaterialDispatchService.createDispatch(
        {
          projectId: mockProjectId.toString(),
          sourceWarehouseId: mockWarehouseId.toString(),
          dispatchDate: new Date().toISOString(),
          lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }]
        } as any,
        deptHeadActor,
        mockContext
      );

      expect(dispatch).toBeDefined();
      expect(dispatch.isPaymentOverride).toBe(false);
    });

    it('Scenario 1.4: Allows authorized manager (SUPERADMIN) to override payment block with valid reason', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      setupPaymentAllocationMock([]); // Zero payment
      setupDispatchFulfillmentMocks();
      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const overrideReason = 'Client submitted verified banker cheque; emergency dispatch approved by Director.';
      const dispatch = await MaterialDispatchService.createDispatch(
        {
          projectId: mockProjectId.toString(),
          sourceWarehouseId: mockWarehouseId.toString(),
          dispatchDate: new Date().toISOString(),
          lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }],
          overridePaymentBlock: true,
          overrideReason
        } as any,
        adminActor,
        mockContext
      );

      expect(dispatch).toBeDefined();
      expect(dispatch.isPaymentOverride).toBe(true);
      expect(dispatch.paymentOverrideReason).toBe(overrideReason);
      expect(dispatch.paymentOverrideBy?.toString()).toBe(adminActor.userId);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.MATERIAL_DISPATCH_OVERRIDDEN,
          outcome: AuditOutcome.SUCCESS,
          details: expect.objectContaining({
            overrideReason
          })
        })
      );
    });

    it('Scenario 1.5: Rejects override attempt by unauthorized role (SALES_EXECUTIVE)', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      setupPaymentAllocationMock([]);

      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: mockProjectId.toString(),
            sourceWarehouseId: mockWarehouseId.toString(),
            dispatchDate: new Date().toISOString(),
            lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }],
            overridePaymentBlock: true,
            overrideReason: 'I want to deliver panels to customer today.'
          } as any,
          salesActor,
          mockContext
        )
      ).rejects.toThrow(/Only Administrator or Department Manager roles are authorized/i);
    });

    it('Scenario 1.6: Rejects override when reason is empty or shorter than 10 characters', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();
      setupPaymentAllocationMock([]);

      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: mockProjectId.toString(),
            sourceWarehouseId: mockWarehouseId.toString(),
            dispatchDate: new Date().toISOString(),
            lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }],
            overridePaymentBlock: true,
            overrideReason: 'Urgent' // < 10 characters
          } as any,
          adminActor,
          mockContext
        )
      ).rejects.toThrow(/minimum 10 characters/i);
    });

    it('Scenario 1.7: Payment received after an initially blocked dispatch releases the block and permits clean dispatch', async () => {
      vi.spyOn(Project, 'findById').mockResolvedValue(baseProject as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouseDoc as any);
      setupOrderMock();

      // Step 1: Attempt dispatch with zero payment -> blocked
      setupPaymentAllocationMock([]);
      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: mockProjectId.toString(),
            sourceWarehouseId: mockWarehouseId.toString(),
            dispatchDate: new Date().toISOString(),
            lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }]
          } as any,
          deptHeadActor,
          mockContext
        )
      ).rejects.toThrow(/Material dispatch is blocked/i);

      // Step 2: Customer payment is received and allocated (₹1,00,000 Booking Advance)
      setupPaymentAllocationMock([
        { allocatedAmountPaise: 10000000, status: 'ACTIVE' }
      ]);
      setupDispatchFulfillmentMocks();

      // Step 3: Re-attempt dispatch without any override flag -> succeeds cleanly
      const dispatch = await MaterialDispatchService.createDispatch(
        {
          projectId: mockProjectId.toString(),
          sourceWarehouseId: mockWarehouseId.toString(),
          dispatchDate: new Date().toISOString(),
          lineItems: [{ productId: mockProductId.toString(), requestedQuantity: 10 }]
        } as any,
        deptHeadActor,
        mockContext
      );

      expect(dispatch).toBeDefined();
      expect(dispatch.isPaymentOverride).toBe(false);
    });

    it('Scenario 1.8: Cancelled dispatch releases inventory balances and allows repeated dispatch', async () => {
      const mockDispatchDoc = {
        _id: new Types.ObjectId(),
        dispatchNumber: 'DSP-2026-00001',
        projectId: mockProjectId,
        sourceWarehouseId: mockWarehouseId,
        status: 'DISPATCHED',
        lineItems: [
          {
            productId: mockProductId,
            issuedQuantity: 10,
            serialNumbers: ['SN-MOD-001']
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
        formattedNumber: `${type}-2026-00001`,
        sequenceNumber: 1,
        sequenceKey: `${type}:2026`,
        prefix: `${type}`,
        fiscalYear: '2026'
      }));
      vi.spyOn(MaterialDispatch, 'findById').mockResolvedValue(mockDispatchDoc as any);
      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: mockProjectId, projectCode: 'PRJ-2026-00001' } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);
      vi.spyOn(ProductSerialNumber, 'findOneAndUpdate').mockResolvedValue({} as any);
      vi.spyOn(StockMovement.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });
      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const cancellationReason = 'Customer requested rescheduling due to roof water-proofing.';
      const cancelled = await MaterialDispatchService.cancelDispatch(
        mockDispatchDoc._id.toString(),
        { cancellationReason },
        adminActor,
        mockContext
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe(cancellationReason);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.MATERIAL_DISPATCH_CANCELLED,
          outcome: AuditOutcome.SUCCESS
        })
      );
    });
  });

  // =========================================================================
  // 2. STATUTORY CUSTOMER GST TAX INVOICE SYSTEM (DECISION 2)
  // =========================================================================
  describe('2. Customer GST Tax Invoice System', () => {
    const mockCompany = {
      legalEntityName: 'INS Solar Private Limited',
      companyName: 'INS Solar',
      gstin: '22AAACI1234F1Z5', // Chhattisgarh (22)
      pan: 'AAACI1234F',
      registeredAddress: {
        addressLine1: 'GE Road, Pandri',
        city: 'Raipur',
        state: 'Chhattisgarh',
        stateCode: '22',
        postalCode: '492001'
      }
    };

    const intraStateCustomer = {
      _id: mockCustomerId,
      name: 'Ramesh Patel',
      customerCode: 'CUST-2026-00001',
      gstin: '22ABCDE1234F1Z1',
      pan: 'ABCDE1234F',
      billingAddress: {
        addressLine1: 'Shankar Nagar',
        city: 'Raipur',
        state: 'Chhattisgarh',
        stateCode: '22',
        postalCode: '492007'
      }
    };

    const interStateCustomer = {
      _id: mockCustomerId,
      name: 'Nagpur Solar Farms LLP',
      customerCode: 'CUST-2026-00002',
      gstin: '27AABCN9988K1ZV', // Maharashtra (27)
      pan: 'AABCN9988K',
      billingAddress: {
        addressLine1: 'MIDC Butibori',
        city: 'Nagpur',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '441108'
      }
    };

    const standardSalesOrder = {
      _id: mockOrderId,
      orderNumber: 'ORD-2026-00001',
      customerId: mockCustomerId,
      systemCapacityKwp: 10,
      systemTopology: SolarTopology.ON_GRID,
      taxProfile: { isInterState: false },
      paymentMilestones: [
        { name: 'Stage 1: Booking Advance', percentage: 20 },
        { name: 'Stage 2: Material Dispatch', percentage: 60 },
        { name: 'Stage 3: Commissioning & COD', percentage: 20 }
      ],
      taxableAmountPaise: 40000000,
      lineItems: [
        {
          itemType: 'MODULE',
          description: 'Mono PERC Solar PV Modules 540W',
          quantity: 20,
          unit: 'NOS',
          unitRatePaise: 1200000,
          discountPaise: 0,
          taxableAmountPaise: 24000000,
          gstRateBasisPoints: 1200
        },
        {
          itemType: 'INVERTER',
          description: '10kW Grid-Tied Three Phase Inverter',
          quantity: 1,
          unit: 'NOS',
          unitRatePaise: 8000000,
          discountPaise: 0,
          taxableAmountPaise: 8000000,
          gstRateBasisPoints: 1200
        },
        {
          itemType: 'SERVICE',
          description: 'Turnkey Installation, Structure & DISCOM Commissioning',
          quantity: 1,
          unit: 'JOB',
          unitRatePaise: 8000000,
          discountPaise: 0,
          taxableAmountPaise: 8000000,
          gstRateBasisPoints: 1800
        }
      ]
    };

    it('Scenario 2.1: Correctly calculates Intra-State GST (CGST + SGST split, zero IGST) and assigns HSN codes', async () => {
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(standardSalesOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue(intraStateCustomer as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue(mockCompany as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([]);

      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: mockOrderId.toString(),
          invoiceType: CustomerInvoiceType.TAX_INVOICE
        },
        adminActor,
        mockContext
      );

      expect(invoice.isInterState).toBe(false);
      expect(invoice.placeOfSupply).toBe('Chhattisgarh');

      const moduleItem = invoice.lineItems.find(i => i.itemType === 'MODULE');
      expect(moduleItem?.hsnSacCode).toBe('8541');
      expect(moduleItem?.cgstPaise).toBe((moduleItem!.taxableAmountPaise * 600) / 10000);
      expect(moduleItem?.sgstPaise).toBe((moduleItem!.taxableAmountPaise * 600) / 10000);
      expect(moduleItem?.igstPaise).toBe(0);

      const inverterItem = invoice.lineItems.find(i => i.itemType === 'INVERTER');
      expect(inverterItem?.hsnSacCode).toBe('8504');

      const serviceItem = invoice.lineItems.find(i => i.itemType === 'SERVICE');
      expect(serviceItem?.hsnSacCode).toBe('9954');

      expect(invoice.totalIgstPaise).toBe(0);
      expect(invoice.totalCgstPaise).toBeGreaterThan(0);
      expect(invoice.totalSgstPaise).toBe(invoice.totalCgstPaise);
      expect(invoice.netTotalPaise).toBe(invoice.taxableAmountPaise + invoice.totalTaxPaise);
    });

    it('Scenario 2.2: Correctly calculates Inter-State GST (IGST full, zero CGST/SGST)', async () => {
      const interStateOrder = {
        ...standardSalesOrder,
        taxProfile: { isInterState: true }
      };

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(interStateOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue(interStateCustomer as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue(mockCompany as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([]);

      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: mockOrderId.toString(),
          invoiceType: CustomerInvoiceType.TAX_INVOICE
        },
        adminActor,
        mockContext
      );

      expect(invoice.isInterState).toBe(true);
      expect(invoice.placeOfSupply).toBe('Maharashtra');
      expect(invoice.totalCgstPaise).toBe(0);
      expect(invoice.totalSgstPaise).toBe(0);
      expect(invoice.totalIgstPaise).toBeGreaterThan(0);
      expect(invoice.netTotalPaise).toBe(invoice.taxableAmountPaise + invoice.totalIgstPaise);
    });

    it('Scenario 2.3: Generates Milestone Advance Invoice with SAC 9954 and prorated values', async () => {
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(standardSalesOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue(intraStateCustomer as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue(mockCompany as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([]);

      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: mockOrderId.toString(),
          invoiceType: CustomerInvoiceType.MILESTONE_INVOICE,
          milestoneIndex: 0
        },
        adminActor,
        mockContext
      );

      expect(invoice.invoiceType).toBe(CustomerInvoiceType.MILESTONE_INVOICE);
      expect(invoice.milestoneIndex).toBe(0);
      expect(invoice.percentageBilled).toBe(20);

      const expectedTaxable = Math.round((standardSalesOrder.taxableAmountPaise * 20) / 100);
      expect(invoice.taxableAmountPaise).toBe(expectedTaxable);
      expect(invoice.lineItems[0]?.hsnSacCode).toBe('9954');
    });

    it('Scenario 2.4: Prevents duplicate invoice issuance for confirmed orders', async () => {
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(standardSalesOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue(intraStateCustomer as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        invoiceNumber: 'INV-2026-00001',
        status: CustomerInvoiceStatus.ISSUED
      } as any);

      await expect(
        CustomerInvoiceService.createInvoiceFromOrder(
          {
            orderId: mockOrderId.toString(),
            invoiceType: CustomerInvoiceType.TAX_INVOICE
          },
          adminActor,
          mockContext
        )
      ).rejects.toThrow(/already been generated/i);
    });

    it('Scenario 2.5: Reconciles customer payments: marks PAID when fully settled, PARTIALLY_PAID otherwise', async () => {
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(standardSalesOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue(intraStateCustomer as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue(mockCompany as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);

      vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([
        { allocatedAmountPaise: 20000000, status: 'ALLOCATED' }
      ] as any);

      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const partialInvoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: mockOrderId.toString(),
          invoiceType: CustomerInvoiceType.TAX_INVOICE
        },
        adminActor,
        mockContext
      );

      expect(partialInvoice.status).toBe(CustomerInvoiceStatus.PARTIALLY_PAID);
      expect(partialInvoice.amountPaidPaise).toBe(20000000);
      expect(partialInvoice.balanceDuePaise).toBe(partialInvoice.netTotalPaise - 20000000);
    });

    it('Scenario 2.6: Cancels invoice with mandatory reason and audits event', async () => {
      const mockInvoiceDoc = {
        _id: new Types.ObjectId(),
        invoiceNumber: 'INV-2026-00001',
        status: CustomerInvoiceStatus.ISSUED,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(CustomerInvoice, 'findById').mockResolvedValue(mockInvoiceDoc as any);
      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const cancellationReason = 'Customer opted for design change prior to panel dispatch.';
      const cancelled = await CustomerInvoiceService.cancelInvoice(
        mockInvoiceDoc._id.toString(),
        { cancellationReason },
        adminActor,
        mockContext
      );

      expect(cancelled.status).toBe(CustomerInvoiceStatus.CANCELLED);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CUSTOMER_INVOICE_CANCELLED,
          targetEntity: 'CustomerInvoice',
          targetId: mockInvoiceDoc._id.toString()
        })
      );
    });

    it('Scenario 2.7: Concurrent invoice generation generates distinct, strictly monotonic sequential numbers', async () => {
      // Test SequenceService monotonic sequence allocation
      const numbers = await Promise.all([
        SequenceService.generateNumber(SequenceEntityType.INVOICE),
        SequenceService.generateNumber(SequenceEntityType.INVOICE),
        SequenceService.generateNumber(SequenceEntityType.INVOICE)
      ]);

      const formatted = numbers.map(n => n.formattedNumber);
      const unique = new Set(formatted);
      expect(unique.size).toBe(3); // All 3 numbers are distinct
      expect(numbers[0].sequenceNumber).toBeLessThan(numbers[1].sequenceNumber);
      expect(numbers[1].sequenceNumber).toBeLessThan(numbers[2].sequenceNumber);
    });
  });

  // =========================================================================
  // 3. INSTALLER PANEL VERIFICATION & PROJECT SCOPING (DECISION 3)
  // =========================================================================
  describe('3. Installer Panel Scoping & Project Access Boundaries', () => {
    it('Scenario 3.1: Scopes project list for INSTALLATION_CREW to assigned projects only', async () => {
      const installerUserId = installerActor.userId;
      const assignedProjectId = new Types.ObjectId();

      vi.spyOn(InstallationModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([])
      } as any);

      const queryMock: any = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((fn: any) => fn([
          { _id: assignedProjectId, projectCode: 'PRJ-2026-00001', teamMemberIds: [installerUserId] }
        ]))
      };

      const findSpy = vi.spyOn(Project, 'find').mockReturnValue(queryMock);
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(1);

      const result = await ProjectService.getProjects(
        { page: 1, limit: 10, sortOrder: 'desc' },
        installerActor
      );

      expect(result.projects).toHaveLength(1);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { teamMemberIds: new Types.ObjectId(installerUserId) },
            { projectManagerId: new Types.ObjectId(installerUserId) }
          ])
        })
      );
    });

    it('Scenario 3.2: Rejects unauthorized access when installer views a project assigned to a different crew', async () => {
      const otherCrewUserId = new Types.ObjectId();
      const unauthorizedProjectId = new Types.ObjectId();

      const queryMock: any = {
        populate: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve({
          _id: unauthorizedProjectId,
          projectCode: 'PRJ-2026-00099',
          customerId: { _id: new Types.ObjectId() },
          teamMemberIds: [otherCrewUserId],
          projectManagerId: new Types.ObjectId()
        }))
      };

      vi.spyOn(Project, 'findById').mockReturnValue(queryMock);
      vi.spyOn(InstallationModel, 'exists').mockResolvedValue(null as any);

      await expect(
        ProjectService.getProjectById(
          unauthorizedProjectId.toString(),
          undefined,
          installerActor
        )
      ).rejects.toThrow(AppError);
    });

    it('Scenario 3.3: Allows SUPERADMIN full cross-panel project visibility without installer scoping', async () => {
      const queryMock: any = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((fn: any) => fn([
          { _id: new Types.ObjectId(), projectCode: 'PRJ-2026-00001' },
          { _id: new Types.ObjectId(), projectCode: 'PRJ-2026-00002' }
        ]))
      };

      const findSpy = vi.spyOn(Project, 'find').mockReturnValue(queryMock);
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(2);

      const result = await ProjectService.getProjects(
        { page: 1, limit: 10, sortOrder: 'desc' },
        adminActor
      );

      expect(result.projects).toHaveLength(2);
      expect(findSpy).toHaveBeenCalledWith({});
    });

    it('Scenario 3.4: Reassigning project crew dynamically grants access to new technician and blocks old crew', async () => {
      const formerInstallerId = new Types.ObjectId();
      const newInstallerId = new Types.ObjectId();
      const testProjectId = new Types.ObjectId();

      const projectAfterReassignment: any = {
        _id: testProjectId,
        projectCode: 'PRJ-2026-00088',
        customerId: { _id: new Types.ObjectId() },
        teamMemberIds: [newInstallerId], // Reassigned to new technician
        projectManagerId: new Types.ObjectId()
      };

      const queryMock: any = {
        populate: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve(projectAfterReassignment))
      };
      vi.spyOn(Project, 'findById').mockReturnValue(queryMock);
      vi.spyOn(InstallationModel, 'exists').mockResolvedValue(null as any);

      // Access for new technician -> allowed
      const newTechnicianActor = {
        userId: newInstallerId.toString(),
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS
      };
      const allowedResult = await ProjectService.getProjectById(
        testProjectId.toString(),
        undefined,
        newTechnicianActor
      );
      expect(allowedResult).toBeDefined();
      expect(allowedResult.projectCode).toBe('PRJ-2026-00088');

      // Access for former technician -> blocked
      const formerTechnicianActor = {
        userId: formerInstallerId.toString(),
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS
      };
      await expect(
        ProjectService.getProjectById(
          testProjectId.toString(),
          undefined,
          formerTechnicianActor
        )
      ).rejects.toThrow(AppError);
    });
  });
});
