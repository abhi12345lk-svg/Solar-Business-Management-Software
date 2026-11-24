/**
 * INS Solar Business Management Software — Deep Concurrency & Financial Audit Suite
 *
 * Verifies the 6 remaining critical business domains:
 * 1. Structured Milestone Triggers & Fixed-Amount Schedules (No text-matching)
 * 2. Atomic Database Concurrency & Idempotency Collisions (MongoDB E11000 safe resolution)
 * 3. Inventory Physical Return Valuation, Conditions & Profitability Reversals
 * 4. AMC State Machine (DRAFT vs ACTIVE) & Service Visit Booking Gate
 * 5. Statutory GST Invoicing & Milestone Tax Calculations
 * 6. Role-Based Access Scoping & Financial Ledger Isolation
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
  CustomerInvoiceType
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

import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { ProjectService } from '../services/projectService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { AmcService } from '../services/amcService.js';
import { CustomerInvoiceService } from '../services/customerInvoiceService.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { PaymentService } from '../services/paymentService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';

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

      // Custom renamed milestones with fixed rupee amounts:
      // ₹50,000 on booking + ₹1,50,000 before dispatch = ₹2,00,000 (20,000,000 paise) required
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
        lineItems: [{ productId: productId.toString(), issuedQuantity: 10 }]
      };

      // Must be blocked with explicit rupee amount requirement: ₹2,00,000
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
        orderId
      };

      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerId } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({ _id: orderId, customerId } as any);

      // First check passes (race window)
      vi.spyOn(Project, 'findOne')
        .mockResolvedValueOnce(null) // Pre-save duplicate check passes
        .mockReturnValueOnce({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue(existingProjectDoc)
          })
        } as any); // Collision recovery findOne returns the winning project

      // Simulate MongoDB driver throwing duplicate key error code 11000 on unique index
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
  });

  // =========================================================================
  // 3. PHYSICAL RETURN VALUATION & CONDITION TAGGING
  // =========================================================================
  describe('3. Return Valuation & Condition Tagging in Project Profitability', () => {
    it('reverses material cost using exact original issue valuation and tags condition', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-RET-01',
        orderId
      } as any);

      // 10 items dispatched @ custom issued rate of ₹12,500 each (1,250,000 paise)
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

      // 2 damaged items returned from site with explicit unitCostPaise recorded: 1,250,000 paise
      vi.spyOn(StockMovement, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-2026-RET-01',
            movementType: StockMovementType.RETURN,
            productId,
            quantity: 2,
            unitCostPaise: 1250000, // Original issue valuation
            condition: 'DAMAGED_TRANSIT',
            orderId,
            createdAt: new Date()
          }
        ])
      } as any);

      const ledger = await ProjectProfitabilityService.getCostLedger(projectId.toString());

      const returnEntry = ledger.entries.find(e => e.status === 'RETURNED');
      expect(returnEntry).toBeDefined();
      expect(returnEntry?.description).toContain('[DAMAGED_TRANSIT]');
      // Reversal amount must be strictly 2 * ₹12,500 = ₹25,000 (2,500,000 paise)
      expect(returnEntry?.amountPaise).toBe(-2500000);

      // Net material cost = (10 * 12,500) - (2 * 12,500) = 8 * 12,500 = ₹1,00,000 (10,000,000 paise)
      expect(ledger.summary.materialsCostPaise).toBe(10000000);
    });
  });

  // =========================================================================
  // 4. AMC STATE MACHINE & ACTIVE APPROVAL REQUIREMENT
  // =========================================================================
  describe('4. AMC Proposal State Machine & Approval Requirement', () => {
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

      // 1. Create AMC proposal -> status must be DRAFT
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

      // 2. Approve AMC contract -> status transitions to ACTIVE
      vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(savedAmc);

      const approvedContract = await AmcService.approveAmc(amcId.toString(), 'Approved by Commercial Head', superAdminUser as any);
      expect(approvedContract.status).toBe(AmcStatus.ACTIVE);
      expect(approvedContract.approvedBy).toBeDefined();
    });
  });

  // =========================================================================
  // 5. STATUTORY GST INVOICING & SAC PRORATION
  // =========================================================================
  describe('5. Statutory GST Invoicing & Duplicate Prevention', () => {
    it('calculates Intra-State GST (CGST + SGST split) on milestone advance invoices', async () => {
      const orderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-GST-01',
        customerId,
        taxableAmountPaise: 10000000, // ₹1,00,000 taxable base
        netTotalPaise: 11800000,
        paymentMilestones: [
          { name: 'Advance Milestone', percentage: 20 }
        ]
      };

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: customerId,
        name: 'Goyal Enterprises',
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
      // 18% GST split into 9% CGST (₹1,800) and 9% SGST (₹1,800)
      expect(invoice.totalCgstPaise).toBe(180000);
      expect(invoice.totalSgstPaise).toBe(180000);
      expect(invoice.totalIgstPaise).toBe(0);
      expect(invoice.netTotalPaise).toBe(2360000); // ₹23,600 total
    });
  });

  // =========================================================================
  // 6. ROLE-BASED ACCESS SCOPING & FINANCIAL LEDGER ISOLATION
  // =========================================================================
  describe('6. Role-Based Access Scoping & Financial Ledger Isolation', () => {
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
  });
});
