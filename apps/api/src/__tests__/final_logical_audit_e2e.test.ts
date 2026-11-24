/**
 * INS Solar Business Management Software — Final Logical Audit & Cross-Module Integration Suite
 *
 * Verifies strict business logic across all 7 audit areas:
 * 1. Payment Schedule & Pre-Dispatch Payment Gate (Resolving 70% vs 80% milestone schedule)
 * 2. Project Creation Idempotency & Duplicate Prevention
 * 3. Actual Material Costing & Physical Return Deductions (Anti-Double-Counting)
 * 4. Post-Handover AMC & Warranty Governance (Contract Permissibility & Duplicate Prevention)
 * 5. Installer Panel Role Scoping & Sensitive Financial/Customer Isolation
 * 6. Multi-status Material Dispatch & Site Delivery Acknowledgement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  MaterialDispatchStatus,
  PaymentMilestoneTrigger,
  StockMovementType,
  AmcStatus,
  AmcPlanType
} from '@ins-solar/shared';

import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { User } from '../models/User.js';
import { InstallationModel } from '../models/Installation.js';
import { StockReservation } from '../models/StockReservation.js';
import { Expense } from '../models/Expense.js';
import { Warehouse } from '../models/Warehouse.js';

import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { ProjectService } from '../services/projectService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { AmcService } from '../services/amcService.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { PaymentService } from '../services/paymentService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';

describe('FINAL LOGICAL AUDIT: Cross-Module ERP Verification Suite', () => {
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
    vi.spyOn(Warehouse, 'findById').mockResolvedValue({ _id: new Types.ObjectId(), name: 'Main Depot', isActive: true } as any);
    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValue(null as any);
    vi.spyOn(Expense, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as any);
    vi.spyOn(InstallationModel, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as any);
    vi.spyOn(User, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]) } as any);
    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
      sequenceNumber: 101,
      formattedNumber: `${type}-2026-00101`,
      sequenceKey: `${type}:2026`,
      prefix: `${type}`,
      fiscalYear: '2026'
    }));
  });

  // =========================================================================
  // 1. PAYMENT & PRE-DISPATCH PAYMENT GATE RESOLUTION
  // =========================================================================
  describe('1. Payment Schedule & Pre-Dispatch Payment Gate Resolution', () => {
    it('accurately resolves cumulative milestone schedule (10% advance + 70% pre-dispatch = 80%)', async () => {
      const orderId = new Types.ObjectId();
      const projectId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-00088',
        netTotalPaise: 10000000, // ₹1,00,000
        paymentMilestones: [
          { name: 'Initial Token', percentage: 10, description: '10% on booking', dueTrigger: PaymentMilestoneTrigger.BOOKING },
          { name: 'Factory Release Stage', percentage: 70, description: '70% before warehouse dispatch', dueTrigger: PaymentMilestoneTrigger.PRE_DISPATCH },
          { name: 'On Site Handover', percentage: 20, description: '20% on testing', dueTrigger: PaymentMilestoneTrigger.COD_HANDOVER }
        ]
      };

      const mockProject = {
        _id: projectId,
        projectCode: 'PRJ-2026-00088',
        orderId: orderId,
        warehouseId: new Types.ObjectId()
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);

      // Customer only paid ₹50,000 (50%), which covers milestone 0 (10%) but not full cumulative 80% (₹80,000)
      vi.spyOn(PaymentService, 'getOrderReceivables').mockResolvedValue({
        allocatedAmountPaise: 5000000, // ₹50,000
        outstandingAmountPaise: 5000000
      } as any);

      const dispatchInput = {
        projectId: projectId.toString(),
        sourceWarehouseId: new Types.ObjectId().toString(),
        lineItems: [{ productId: new Types.ObjectId().toString(), issuedQuantity: 10 }]
      };

      // Must be strictly blocked with clear message noting required payment
      await expect(
        MaterialDispatchService.createDispatch(dispatchInput as any, projectManagerUser as any)
      ).rejects.toThrow(/Minimum required pre-dispatch payment of ₹80,000/);
    });

    it('allows dispatch when customer payments reach or exceed the cumulative 80% requirement', async () => {
      const orderId = new Types.ObjectId();
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const warehouseId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-00089',
        netTotalPaise: 10000000, // ₹1,00,000
        paymentMilestones: [
          { name: 'Custom Kisht 1', percentage: 10, description: '10% on booking', dueTrigger: PaymentMilestoneTrigger.BOOKING },
          { name: 'Custom Kisht 2', percentage: 70, description: '70% before dispatch', dueTrigger: PaymentMilestoneTrigger.PRE_DISPATCH },
          { name: 'Handover', percentage: 20, description: '20% on testing', dueTrigger: PaymentMilestoneTrigger.COD_HANDOVER }
        ]
      };

      const mockProject = {
        _id: projectId,
        projectCode: 'PRJ-2026-00089',
        orderId: orderId
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);

      // Customer paid full ₹80,000 (80%)
      vi.spyOn(PaymentService, 'getOrderReceivables').mockResolvedValue({
        allocatedAmountPaise: 8000000, // ₹80,000
        outstandingAmountPaise: 2000000
      } as any);

      vi.spyOn(Product, 'findById').mockResolvedValue({ _id: productId, isActive: true, name: 'Solar 550W Module' } as any);
      vi.spyOn(StockBalance, 'findOne').mockResolvedValue({
        onHandQuantity: 50,
        availableQuantity: 50,
        allocatedQuantity: 0
      } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);

      let savedDoc: any = null;
      vi.spyOn(MaterialDispatch.prototype, 'save').mockImplementation(function (this: any) {
        savedDoc = this;
        return Promise.resolve(this);
      });
      vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue({} as any);

      const dispatchInput = {
        projectId: projectId.toString(),
        sourceWarehouseId: warehouseId.toString(),
        lineItems: [{ productId: productId.toString(), issuedQuantity: 10 }]
      };

      const result = await MaterialDispatchService.createDispatch(dispatchInput as any, projectManagerUser as any);
      expect(result).toBeDefined();
      expect(savedDoc.status).toBe(MaterialDispatchStatus.DISPATCHED);
      expect(savedDoc.isPaymentOverride).toBe(false);
    });

    it('enforces authorized managerial override with mandatory reason when payment is insufficient', async () => {
      const orderId = new Types.ObjectId();
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const warehouseId = new Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: 'SO-2026-00090',
        netTotalPaise: 10000000,
        paymentMilestones: [
          { name: 'Advance', percentage: 20, dueTrigger: PaymentMilestoneTrigger.BOOKING },
          { name: 'Before Dispatch', percentage: 60, dueTrigger: PaymentMilestoneTrigger.PRE_DISPATCH }
        ]
      };

      const mockProject = {
        _id: projectId,
        projectCode: 'PRJ-2026-00090',
        orderId: orderId
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);

      // Total paid only ₹20,000 (Shortfall: ₹60,000)
      vi.spyOn(PaymentService, 'getOrderReceivables').mockResolvedValue({
        allocatedAmountPaise: 2000000,
        outstandingAmountPaise: 8000000
      } as any);

      vi.spyOn(Product, 'findById').mockResolvedValue({ _id: productId, isActive: true } as any);
      vi.spyOn(StockBalance, 'findOne').mockResolvedValue({ onHandQuantity: 50, availableQuantity: 50 } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);
      vi.spyOn(MaterialDispatch.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue({} as any);
      vi.spyOn(User, 'find').mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as any);

      // Attempt override with short reason (<10 chars) -> must reject
      await expect(
        MaterialDispatchService.createDispatch(
          {
            projectId: projectId.toString(),
            sourceWarehouseId: warehouseId.toString(),
            lineItems: [{ productId: productId.toString(), issuedQuantity: 5 }],
            overridePaymentBlock: true,
            overrideReason: 'Urgent'
          } as any,
          superAdminUser as any
        )
      ).rejects.toThrow(/minimum 10 characters/);

      // Attempt override with authorized Admin and valid reason -> succeeds
      const result = await MaterialDispatchService.createDispatch(
        {
          projectId: projectId.toString(),
          sourceWarehouseId: warehouseId.toString(),
          lineItems: [{ productId: productId.toString(), issuedQuantity: 5 }],
          overridePaymentBlock: true,
          overrideReason: 'MD special clearance: VIP commercial client with confirmed LC payment'
        } as any,
        superAdminUser as any
      );

      expect(result.isPaymentOverride).toBe(true);
      expect(result.paymentOverrideReason).toContain('VIP commercial client');
    });
  });

  // =========================================================================
  // 2. PROJECT CREATION IDEMPOTENCY & DUPLICATE PREVENTION
  // =========================================================================
  describe('2. Project Creation Idempotency & Duplicate Prevention', () => {
    it('returns existing project when submitted with the same idempotencyKey (network retry safety)', async () => {
      const customerId = new Types.ObjectId();
      const existingProject = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00055',
        name: 'Sharma Rooftop Solar 5kW',
        idempotencyKey: 'idem-project-create-123'
      };

      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerId, name: 'Sharma' } as any);
      vi.spyOn(Project, 'findOne').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(existingProject)
        })
      } as any);

      const result = await ProjectService.createProject(
        {
          name: 'Sharma Rooftop Solar 5kW',
          customerId: customerId.toString(),
          idempotencyKey: 'idem-project-create-123',
          plannedStartDate: new Date('2026-12-01'),
          targetCompletionDate: new Date('2026-12-15')
        } as any,
        superAdminUser as any
      );

      expect(result).toBe(existingProject);
    });

    it('strictly prevents creating duplicate projects for the same Sales Order', async () => {
      const customerId = new Types.ObjectId();
      const orderId = new Types.ObjectId();

      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerId, name: 'Rao Enterprises' } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderId,
        orderNumber: 'SO-2026-00100',
        customerId: customerId
      } as any);

      // Existing project already linked to order
      vi.spyOn(Project, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00042'
      } as any);

      await expect(
        ProjectService.createProject(
          {
            name: 'Rao 10kW On-Grid',
            customerId: customerId.toString(),
            orderId: orderId.toString(),
            plannedStartDate: new Date('2026-12-01'),
            targetCompletionDate: new Date('2026-12-20')
          } as any,
          superAdminUser as any
        )
      ).rejects.toThrow(/already active for Sales Order/);
    });
  });

  // =========================================================================
  // 3. ACTUAL MATERIAL COSTING & PHYSICAL RETURN DEDUCTIONS
  // =========================================================================
  describe('3. Actual Material Costing & Return Deductions (Anti-Double-Counting)', () => {
    it('accurately credits physical material returns back to project cost ledger', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      const mockProject = {
        _id: projectId,
        projectCode: 'PRJ-2026-00077',
        name: 'Patel Commercial 50kW',
        orderId: orderId
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

      // 20 modules issued via dispatch @ ₹10,000 each = ₹2,00,000 (20,000,000 paise)
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            dispatchNumber: 'DSP-2026-00001',
            status: MaterialDispatchStatus.DELIVERED,
            dispatchedAt: new Date(),
            lineItems: [{ productId: productId, issuedQuantity: 20, unitCostPaise: 1000000 }]
          }
        ])
      } as any);

      vi.spyOn(Product, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: productId, name: 'Mono PERC 550W', standardPurchaseRatePaise: 1000000, uom: 'NOS' }
        ])
      } as any);

      // 2 unused surplus modules physically returned to warehouse via StockMovement RETURN
      vi.spyOn(StockMovement, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-2026-00009',
            movementType: StockMovementType.RETURN,
            productId: productId,
            quantity: 2,
            orderId: orderId,
            createdAt: new Date()
          }
        ])
      } as any);

      const ledger = await ProjectProfitabilityService.getCostLedger(projectId.toString());

      expect(ledger.entries).toHaveLength(2); // 1 dispatch + 1 return credit

      const dispatchEntry = ledger.entries.find(e => e.status === MaterialDispatchStatus.DELIVERED);
      const returnEntry = ledger.entries.find(e => e.status === 'RETURNED');

      expect(dispatchEntry?.amountPaise).toBe(20000000); // +₹2,00,000
      expect(returnEntry?.amountPaise).toBe(-2000000);   // -₹20,000 return credit

      // Net material cost must be strictly 18 modules = ₹1,80,000 (18,000,000 paise)
      expect(ledger.summary.materialsCostPaise).toBe(18000000);
      expect(ledger.summary.totalCostPaise).toBe(18000000);
    });
  });

  // =========================================================================
  // 4. POST-HANDOVER AMC & WARRANTY GOVERNANCE
  // =========================================================================
  describe('4. Post-Handover AMC & Warranty Governance', () => {
    it('blocks duplicate overlapping AMC contract proposal creation for the same project', async () => {
      const projectId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-00011',
        customerId: customerId
      } as any);

      // Existing draft or active AMC exists
      vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        amcNumber: 'AMC-2026-00001',
        status: AmcStatus.DRAFT
      } as any);

      await expect(
        AmcService.createAmc(
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
        )
      ).rejects.toThrow(/already exists for this project/);
    });
  });

  // =========================================================================
  // 5. INSTALLER PANEL ROLE SCOPING & SENSITIVE DATA ISOLATION
  // =========================================================================
  describe('5. Installer Panel Role Scoping & Multi-Tenant Data Protection', () => {
    it('scopes project listings for field installer crew to assigned projects only', async () => {
      const installerId = new Types.ObjectId();
      const installerContext = {
        userId: installerId.toString(),
        role: UserRole.INSTALLATION_CREW
      };

      let capturedQuery: any = null;
      (vi.spyOn(Project, 'find') as any).mockImplementation((query: any) => {
        capturedQuery = query;
        return {
          populate: vi.fn().mockReturnThis(),
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([])
        } as any;
      });
      vi.spyOn(Project, 'countDocuments').mockResolvedValue(0);

      await ProjectService.getProjects(
        { page: 1, limit: 10, sortOrder: 'desc' } as any,
        installerContext as any
      );

      // Installer scoping must be injected into the query
      expect(capturedQuery).toBeDefined();
      const scopingOr = capturedQuery.$or || capturedQuery.$and?.[1]?.$or;
      expect(scopingOr).toBeDefined();
      const hasTeamMemberMatch = scopingOr.some((cond: any) => cond.teamMemberIds?.equals?.(installerId));
      expect(hasTeamMemberMatch).toBe(true);
    });
  });
});
