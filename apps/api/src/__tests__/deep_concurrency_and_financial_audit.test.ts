/**
 * INS Solar Business Management Software — Deep Concurrency & Financial Audit Suite
 *
 * Verifies the 6 remaining critical business domains:
 * 1. Structured Milestone Triggers & Fixed-Amount Schedules (No text-matching)
 * 2. Atomic Database Concurrency & Idempotency Collisions (MongoDB E11000 safe resolution & conflict rejection)
 * 3. Inventory Physical Return Valuation, Conditions & Profitability Reversals (Reusable vs Damaged/Scrap)
 * 4. AMC State Machine, Role Authorization, Service Visit Gates & Serial Warranty Tracking
 * 5. Statutory GST Invoicing, 70:30 Deemed Valuation & Anti-Double-Taxation Advance Adjustments
 * 6. Role-Based Access Scoping, Sensitive Data Masking & AES-256-GCM Encryption
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  MaterialDispatchStatus,
  StockMovementType,
  AmcStatus,
  AmcPlanType,
  PaymentMilestoneTrigger,
  CustomerInvoiceType,
  ServiceVisitType,
  WarrantyStatus
} from '@ins-solar/shared';

import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockReservation } from '../models/StockReservation.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { Warehouse } from '../models/Warehouse.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { Expense } from '../models/Expense.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { User } from '../models/User.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { WarrantyClaim } from '../models/WarrantyClaim.js';

import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { ProjectService } from '../services/projectService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { AmcService } from '../services/amcService.js';
import { ServiceVisitService } from '../services/serviceVisitService.js';
import { WarrantyService } from '../services/warrantyService.js';
import { CustomerInvoiceService } from '../services/customerInvoiceService.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { PaymentService } from '../services/paymentService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  maskCredentials,
  encryptSensitiveField,
  decryptSensitiveField
} from '../utils/crypto.js';

describe('DEEP CONCURRENCY & FINANCIAL AUDIT SUITE', () => {
  const superAdminUser = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.SUPERADMIN,
    department: Department.ADMIN
  };

  const projectManagerUser = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.DEPARTMENT_HEAD,
    department: Department.OPERATIONS
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(undefined as any);
    vi.spyOn(NotificationCenterService, 'createNotification').mockResolvedValue(undefined as any);
    vi.spyOn(MaterialDispatch, 'find').mockResolvedValue([] as any);
    vi.spyOn(Warehouse, 'findById').mockResolvedValue({ _id: new Types.ObjectId(), name: 'Main Hub', isActive: true } as any);
    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValue(null as any);
    vi.spyOn(Expense, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as any);
    vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([] as any);
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(),
      firstName: 'Super',
      lastName: 'Admin'
    } as any);
    vi.spyOn(SequenceService, 'generateNextSequence').mockResolvedValue({
      sequenceNumber: 201,
      formattedNumber: 'AMC-2026-00201',
      sequenceKey: 'AMC:2026',
      prefix: 'AMC',
      fiscalYear: '2026'
    } as any);
    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
      sequenceNumber: 201,
      formattedNumber: `${type}-2026-00201`,
      sequenceKey: `${type}:2026`,
      prefix: `${type}`,
      fiscalYear: '2026'
    }));
  });

  // =========================================================================
  // 1. STRUCTURED TRIGGERS & FIXED-AMOUNT PAYMENT SCHEDULES
  // =========================================================================
  describe('1. Milestone Triggers & Fixed-Amount Payment Schedules', () => {
    it('accurately computes pre-dispatch requirement from fixed rupee amounts regardless of milestone names', async () => {
      const orderId = new Types.ObjectId();
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-FIXED-01',
        netTotalPaise: 30000000, // ₹3,00,000 total contract
        paymentMilestones: [
          {
            name: 'Pehli Rakam (Token)',
            amountPaise: 5000000, // ₹50,000
            dueTrigger: PaymentMilestoneTrigger.BOOKING
          },
          {
            name: 'Doosri Kisht (Godaam Ravaangi)',
            amountPaise: 15000000, // ₹1,50,000
            dueTrigger: PaymentMilestoneTrigger.PRE_DISPATCH
          },
          {
            name: 'Aakhri Hisaab (Chalu Hone Par)',
            amountPaise: 10000000, // ₹1,00,000
            dueTrigger: PaymentMilestoneTrigger.COD_HANDOVER
          }
        ]
      };

      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, orderId } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);

      // Customer has only paid ₹1,00,000 (Shortfall: ₹1,00,000)
      vi.spyOn(PaymentService, 'getOrderReceivables').mockResolvedValue({
        allocatedAmountPaise: 10000000,
        outstandingAmountPaise: 20000000
      } as any);

      const dispatchInput = {
        projectId: projectId.toString(),
        sourceWarehouseId: new Types.ObjectId().toString(),
        lineItems: [{ productId: productId.toString(), issuedQuantity: 5 }]
      };

      await expect(
        MaterialDispatchService.createDispatch(dispatchInput as any, projectManagerUser as any)
      ).rejects.toThrow(/Minimum required pre-dispatch payment of ₹2,00,000/);
    });

    it('releases dispatch when fixed-amount pre-dispatch milestone (₹2,00,000) is fully met', async () => {
      const orderId = new Types.ObjectId();
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-FIXED-02',
        netTotalPaise: 30000000,
        paymentMilestones: [
          { name: 'Token', amountPaise: 5000000, dueTrigger: PaymentMilestoneTrigger.BOOKING },
          { name: 'Dispatch Installment', amountPaise: 15000000, dueTrigger: PaymentMilestoneTrigger.PRE_DISPATCH }
        ]
      };

      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, orderId } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);

      // Customer paid full ₹2,00,000
      vi.spyOn(PaymentService, 'getOrderReceivables').mockResolvedValue({
        allocatedAmountPaise: 20000000,
        outstandingAmountPaise: 10000000
      } as any);

      vi.spyOn(Product, 'findById').mockResolvedValue({ _id: productId, isActive: true } as any);
      vi.spyOn(StockBalance, 'findOne').mockResolvedValue({ onHandQuantity: 50, availableQuantity: 50 } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);
      vi.spyOn(MaterialDispatch.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue({} as any);

      const result = await MaterialDispatchService.createDispatch(
        {
          projectId: projectId.toString(),
          sourceWarehouseId: new Types.ObjectId().toString(),
          lineItems: [{ productId: productId.toString(), issuedQuantity: 5 }]
        } as any,
        projectManagerUser as any
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(MaterialDispatchStatus.DISPATCHED);
      expect(result.isPaymentOverride).toBe(false);
    });
  });

  // =========================================================================
  // 2. ATOMIC DATABASE CONCURRENCY & UNIQUE INDEX PROTECTION
  // =========================================================================
  describe('2. Project Concurrency & Duplicate Key Collision Recovery', () => {
    it('safely recovers and returns existing project when concurrent simultaneous requests trigger MongoDB E11000', async () => {
      const customerId = new Types.ObjectId();
      const orderId = new Types.ObjectId();

      const existingProjectDoc = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-CONCUR-01',
        name: 'Simultaneous Project Creation',
        customerId,
        orderId
      };

      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerId } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({ _id: orderId, customerId } as any);

      vi.spyOn(Project, 'findOne')
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue(existingProjectDoc)
          })
        } as any);

      vi.spyOn(Project.prototype, 'save').mockRejectedValueOnce({
        code: 11000,
        keyPattern: { orderId: 1 },
        message: 'E11000 duplicate key error collection: projects index: orderId_1 dup key'
      });

      const result = await ProjectService.createProject(
        {
          name: 'Simultaneous Project Creation',
          customerId: customerId.toString(),
          orderId: orderId.toString(),
          plannedStartDate: new Date('2026-12-01'),
          targetCompletionDate: new Date('2026-12-20')
        } as any,
        superAdminUser as any
      );

      expect(result).toBeDefined();
      expect(result.projectCode).toBe('PRJ-2026-CONCUR-01');
    });

    it('rejects with conflict (409) when concurrency collision occurs with incompatible customer payload', async () => {
      const customerIdA = new Types.ObjectId();
      const customerIdB = new Types.ObjectId();
      const orderId = new Types.ObjectId();

      const existingProjectDoc = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-CONCUR-02',
        name: 'First Project for Customer A',
        customerId: customerIdA,
        orderId
      };

      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerIdB } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({ _id: orderId, customerId: customerIdB } as any);

      vi.spyOn(Project, 'findOne')
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue(existingProjectDoc)
          })
        } as any);

      vi.spyOn(Project.prototype, 'save').mockRejectedValueOnce({
        code: 11000,
        keyPattern: { orderId: 1 },
        message: 'E11000 duplicate key error'
      });

      await expect(
        ProjectService.createProject(
          {
            name: 'Conflicting Project for Customer B',
            customerId: customerIdB.toString(),
            orderId: orderId.toString(),
            plannedStartDate: new Date('2026-12-01'),
            targetCompletionDate: new Date('2026-12-20')
          } as any,
          superAdminUser as any
        )
      ).rejects.toThrow(/Concurrency collision: Project for this key or order belongs to a different customer/);
    });
  });

  // =========================================================================
  // 3. PHYSICAL RETURN VALUATION & CONDITION TAGGING
  // =========================================================================
  describe('3. Return Valuation & Condition Tagging in Project Profitability', () => {
    it('credits 100% of material cost for REUSABLE returns, but retains uncredited loss on DAMAGED returns', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-RET-01',
        orderId
      } as any);

      // 10 items dispatched @ custom issued rate of ₹12,500 each = ₹1,25,000 (12,500,000 paise)
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            dispatchNumber: 'DSP-2026-00055',
            status: MaterialDispatchStatus.DELIVERED,
            dispatchedAt: new Date(),
            lineItems: [{ productId, issuedQuantity: 10, unitCostPaise: 1250000 }]
          }
        ])
      } as any);

      vi.spyOn(Product, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: productId, name: 'Bifacial 550W Module', standardPurchaseRatePaise: 1000000, uom: 'NOS' }
        ])
      } as any);

      // Mixed returns:
      // - 2 REUSABLE units: 100% cost reversal = 2 * ₹12,500 = -₹25,000 (-2,500,000 paise)
      // - 1 DAMAGED unit with salvage recovery: ₹5,000 recovery credit (-500,000 paise)
      // - 1 DAMAGED unit without recovery: 0 credit (loss preserved on project)
      vi.spyOn(StockMovement, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-2026-RET-REUSABLE',
            movementType: StockMovementType.RETURN,
            productId,
            quantity: 2,
            unitCostPaise: 1250000,
            condition: 'REUSABLE',
            orderId,
            createdAt: new Date()
          },
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-2026-RET-DAMAGED-INSURED',
            movementType: StockMovementType.RETURN,
            productId,
            quantity: 1,
            unitCostPaise: 1250000,
            condition: 'DAMAGED',
            disposition: 'INSURANCE_CLAIM',
            salvageCreditPaise: 500000, // ₹5,000 recovery
            orderId,
            createdAt: new Date()
          },
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-2026-RET-DAMAGED-SCRAP',
            movementType: StockMovementType.RETURN,
            productId,
            quantity: 1,
            unitCostPaise: 1250000,
            condition: 'DAMAGED',
            disposition: 'SCRAP_WRITEOFF',
            salvageCreditPaise: 0, // Uncredited loss
            orderId,
            createdAt: new Date()
          }
        ])
      } as any);

      const ledger = await ProjectProfitabilityService.getCostLedger(projectId.toString());

      // Total material issued: ₹1,25,000
      // Less reusable return: -₹25,000
      // Less salvage recovery: -₹5,000
      // Net material cost must be strictly ₹95,000 (9,500,000 paise)
      expect(ledger.summary.materialsCostPaise).toBe(9500000);

      const reusableEntry = ledger.entries.find(e => e.sourceNumber === 'MOV-2026-RET-REUSABLE');
      expect(reusableEntry?.amountPaise).toBe(-2500000);
      expect(reusableEntry?.status).toBe('RETURNED');

      const scrapEntry = ledger.entries.find(e => e.sourceNumber === 'MOV-2026-RET-DAMAGED-SCRAP');
      expect(scrapEntry?.amountPaise).toBe(0);
      expect(scrapEntry?.status).toBe('DAMAGED_WRITE_OFF');
    });
  });

  // =========================================================================
  // 4. AMC STATE MACHINE, ROLE AUTHORIZATION & SERVICE VISIT GATES
  // =========================================================================
  describe('4. AMC Proposal State Machine & Service Scheduling Gate', () => {
    it('creates contract in DRAFT status and requires explicit approval to become ACTIVE', async () => {
      const projectId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const amcId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-AMC-01',
        customerId
      } as any);

      vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null);

      let savedAmc: any = null;
      vi.spyOn(AnnualMaintenanceContract.prototype, 'save').mockImplementation(function (this: any) {
        savedAmc = this;
        return Promise.resolve(this);
      });

      const contract = await AmcService.createAmc(
        {
          customerId: customerId.toString(),
          projectId: projectId.toString(),
          capacityKwp: 10,
          startDate: new Date('2027-01-01'),
          endDate: new Date('2028-01-01'),
          contractAmountPaise: 2500000,
          planType: AmcPlanType.COMPREHENSIVE
        },
        superAdminUser as any
      );

      expect(contract.status).toBe(AmcStatus.DRAFT);

      vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(savedAmc);

      const approvedContract = await AmcService.approveAmc(amcId.toString(), 'Approved by Commercial Head', superAdminUser as any);
      expect(approvedContract.status).toBe(AmcStatus.ACTIVE);
      expect(approvedContract.approvedBy).toBeDefined();
    });

    it('blocks unauthorized field installation crew from approving AMC contracts', async () => {
      const amcId = new Types.ObjectId();
      const installerActor = {
        userId: new Types.ObjectId().toString(),
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS
      };

      vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue({
        _id: amcId,
        status: AmcStatus.DRAFT
      } as any);

      await expect(
        AmcService.approveAmc(amcId.toString(), 'Unauthorized attempt', installerActor as any)
      ).rejects.toThrow(/Only Administrator or Commercial Head can approve and activate an AMC contract/);
    });

    it('blocks field service visits against expired AMC contracts', async () => {
      const projectId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const amcId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, customerId } as any);
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: new Types.ObjectId(), isActive: true } as any);

      // Contract ended in past
      vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue({
        _id: amcId,
        amcNumber: 'AMC-2025-00001',
        projectId,
        status: AmcStatus.ACTIVE,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-01-01') // Expired
      } as any);

      await expect(
        ServiceVisitService.scheduleVisit(
          {
            visitType: ServiceVisitType.AMC_PREVENTIVE,
            projectId: projectId.toString(),
            customerId: customerId.toString(),
            amcId: amcId.toString(),
            assignedTechnicianId: new Types.ObjectId().toString(),
            scheduledDate: new Date('2026-06-01'),
            purpose: 'Quarterly Routine Maintenance'
          },
          superAdminUser as any
        )
      ).rejects.toThrow(/Cannot schedule visit against expired AMC contract/);
    });

    it('blocks warranty claim submission for component assigned to a different project', async () => {
      const projectA = new Types.ObjectId();
      const projectB = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      vi.spyOn(WarrantyClaim, 'findOne').mockResolvedValue(null);

      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue({
        serialNumber: 'SN-INV-2026-099',
        projectId: projectA, // Belongs to Project A
        customerId,
        warrantyStatus: WarrantyStatus.ACTIVE,
        warrantyEndDate: new Date('2030-01-01')
      } as any);

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectB, // User attempts claim for Project B
        customerId
      } as any);

      await expect(
        WarrantyService.submitClaim(
          {
            serialNumber: 'SN-INV-2026-099',
            productId: new Types.ObjectId().toString(),
            projectId: projectB.toString(),
            manufacturerName: 'Sungrow',
            issueDescription: 'Defective inverter unit'
          },
          superAdminUser as any
        )
      ).rejects.toThrow(/belongs to a different project/);
    });
  });

  // =========================================================================
  // 5. STATUTORY GST INVOICING & 70:30 DEEMED VALUATION
  // =========================================================================
  describe('5. Statutory GST Invoicing & Anti-Double-Taxation', () => {
    it('calculates 70:30 Deemed Valuation rate (13.8% = 1380 bps) on composite solar EPC milestone advance invoices', async () => {
      const orderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-EPC-7030',
        customerId,
        taxableAmountPaise: 10000000, // ₹1,00,000 taxable base
        netTotalPaise: 11380000,
        taxProfile: {
          useDeemedValuation7030: true
        },
        paymentMilestones: [
          { name: 'Advance Milestone', percentage: 20 }
        ]
      };

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: customerId,
        name: 'Sharma Industries',
        billingAddress: { state: 'Chhattisgarh' }
      } as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
        legalEntityName: 'INS Solar Pvt Ltd',
        gstin: '22AAAAA0000A1Z5',
        registeredAddress: { state: 'Chhattisgarh' }
      } as any);

      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: orderId.toString(),
          invoiceType: CustomerInvoiceType.MILESTONE_INVOICE,
          milestoneIndex: 0
        } as any,
        superAdminUser,
        {}
      );

      expect(invoice).toBeDefined();
      expect(invoice.isInterState).toBe(false);
      // Prorated 20% of ₹1,00,000 = ₹20,000 taxable
      expect(invoice.taxableAmountPaise).toBe(2000000);
      // 13.8% composite rate: 6.9% CGST (₹1,380) and 6.9% SGST (₹1,380)
      expect(invoice.totalCgstPaise).toBe(138000);
      expect(invoice.totalSgstPaise).toBe(138000);
      expect(invoice.netTotalPaise).toBe(2276000); // ₹22,760 total
    });

    it('adjusts prior milestone advances on final tax invoice to prevent double taxation', async () => {
      const orderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-EPC-FINAL',
        customerId,
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Solar PV Modules (HSN 8541)',
            quantity: 1,
            unitRatePaise: 10000000,
            taxableAmountPaise: 10000000,
            gstRateBasisPoints: 1200 // 12% GST = ₹12,000
          }
        ]
      };

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: customerId,
        name: 'Goyal Mills',
        billingAddress: { state: 'Chhattisgarh' }
      } as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
        legalEntityName: 'INS Solar Pvt Ltd',
        gstin: '22AAAAA0000A1Z5',
        registeredAddress: { state: 'Chhattisgarh' }
      } as any);

      vi.spyOn(CustomerInvoice, 'findOne').mockResolvedValue(null);

      // Prior milestone advance already invoiced for ₹25,000 (2,500,000 paise)
      vi.spyOn(CustomerInvoice, 'find').mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          invoiceNumber: 'INV-2026-ADV-001',
          invoiceType: CustomerInvoiceType.MILESTONE_INVOICE,
          netTotalPaise: 2500000
        }
      ] as any);

      vi.spyOn(CustomerInvoice.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const invoice = await CustomerInvoiceService.createInvoiceFromOrder(
        {
          orderId: orderId.toString(),
          invoiceType: CustomerInvoiceType.TAX_INVOICE
        } as any,
        superAdminUser,
        {}
      );

      expect(invoice).toBeDefined();
      // Gross contract value: ₹1,00,000 + 12% GST (₹12,000) = ₹1,12,000 (11,200,000 paise)
      expect(invoice.netTotalPaise).toBe(11200000);
      // Balance due adjusted for ₹25,000 prior advance = ₹1,12,000 - ₹25,000 = ₹87,000 (8,700,000 paise)
      expect(invoice.balanceDuePaise).toBe(8700000);
    });
  });

  // =========================================================================
  // 6. ROLE-BASED ACCESS SCOPING & SENSITIVE DATA SECURITY
  // =========================================================================
  describe('6. Role-Based Access Scoping & Sensitive Data Security', () => {
    it('blocks field installer crew from modifying or cancelling statutory GST invoices', async () => {
      const installerUser = {
        userId: new Types.ObjectId().toString(),
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS
      };

      await expect(
        CustomerInvoiceService.cancelInvoice(
          new Types.ObjectId().toString(),
          { cancellationReason: 'Field request to cancel invoice' },
          installerUser as any,
          {}
        )
      ).rejects.toThrow(/Only Administrator or Accounts Head can cancel a statutory GST Tax Invoice/);
    });

    it('masks Aadhaar, PAN, and Bank details according to statutory privacy rules', () => {
      expect(maskAadhaar('123456789012')).toBe('XXXX-XXXX-9012');
      expect(maskAadhaar('1234-5678-9012')).toBe('XXXX-XXXX-9012');

      expect(maskPan('ABCDE1234F')).toBe('ABXXXXXX4F');

      expect(maskBankAccount('987654321098')).toBe('XXXXXXXX1098');

      expect(maskCredentials('DISCOM_PASSWORD_123')).toBe('********');
    });

    it('encrypts and decrypts sensitive credentials at rest using AES-256-GCM', () => {
      const secret = 'DISCOM_CONSUMER_PORTAL_KEY_#2026';
      const ciphertext = encryptSensitiveField(secret);

      expect(ciphertext).not.toBe(secret);
      expect(ciphertext).toContain(':'); // <iv>:<tag>:<encrypted> format

      const decrypted = decryptSensitiveField(ciphertext);
      expect(decrypted).toBe(secret);
    });
  });
});
