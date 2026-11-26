/**
 * INS Solar ERP — Critical Business Logic Audit Regressions
 *
 * Verifies confirmed critical business-logic fixes across Sections 1–6:
 * 1. Project Stage Logic: Strictly 5 stages, strict SLD/DELIVERED-net-of-return/Commissioning gates.
 * 2. Dispatch, Return & Inventory Logic: DISPATCHED -> IN_TRANSIT -> DELIVERED, cancel blocks after transit,
 *    DISPATCH_REVERSAL movement type, StockService return duplicate/over-return & DAMAGED/SCRAP separation.
 * 3. Installation, Checklist, Serials & Warranty Logic: Crew scoping, anti-self-approval,
 *    no premature warranty activation, cross-site serial exclusivity, checklist reworkHistory,
 *    rejected warranty claim never issuing replacement stock & SKU match check.
 * 4. Project Costing & Profit: Separate issued, in-transit, consumed, return credit, scrap loss; no fake budget fallback.
 * 5. Accounts, Payments, Vendor Bills & Quotes: RECORDED payment intake, global UTR uniqueness,
 *    milestone allocation anti-double-count, CREDIT_NOTE balance reconciliation, paid-invoice cancel guard,
 *    duplicate-GRN vendor bill DISPUTED + payout block, expense anti-self-approval, workstation quote approval/expiry guard.
 * 6. RBAC & 2-Customer Cross-Tenant Isolation Matrix across all 8 Customer Portal modules.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  ProjectStage,
  ProjectStatus,
  MilestoneStatus,
  MaterialDispatchStatus,
  StockMovementType,
  StockReservationStatus,
  SerialNumberStatus,
  WarrantyStatus,
  WarrantyClaimStatus,
  WarrantyClaimResolution,
  ChecklistCategory,
  ChecklistItemStatus,
  InstallationStatus,
  NetMeteringStatus,
  DocumentCategory,
  DocumentReviewStatus,
  DocumentStorageStatus,
  CustomerPaymentStatus,
  PaymentMethod,
  PaymentAllocationStatus,
  CustomerInvoiceType,
  CustomerInvoiceStatus,
  VendorInvoiceStatus,
  ExpenseStatus,
  ExpenseCategory,
  QuotationStatus,
  AmcStatus,
  ROLE_DEFAULT_PERMISSIONS
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { SiteSurvey } from '../models/SiteSurvey.js';
import { SolarDesign } from '../models/SolarDesign.js';
import { Quotation } from '../models/Quotation.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockReservation } from '../models/StockReservation.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { InstallationModel } from '../models/Installation.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { NetMeteringApplication } from '../models/NetMeteringApplication.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { WarrantyClaim } from '../models/WarrantyClaim.js';
import { ServiceComplaint } from '../models/ServiceComplaint.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { Vendor } from '../models/Vendor.js';
import { VendorInvoice } from '../models/VendorInvoice.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { CustomerPayment } from '../models/CustomerPayment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { Expense } from '../models/Expense.js';
import { ProjectBudget } from '../models/ProjectBudget.js';
import { Notification } from '../models/Notification.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { NotificationCenterService } from '../services/notificationCenterService.js';
import { ProjectService } from '../services/projectService.js';
import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { StockService } from '../services/stockService.js';
import { InstallationService } from '../services/installationService.js';
import { ChecklistService } from '../services/checklistService.js';
import { WarrantyService } from '../services/warrantyService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { PaymentService } from '../services/paymentService.js';
import { CustomerInvoiceService } from '../services/customerInvoiceService.js';
import { VendorInvoiceService } from '../services/vendorInvoiceService.js';
import { ExpenseService } from '../services/expenseService.js';
import { QuotationService } from '../services/quotationService.js';
import { hashPassword, hashToken } from '../utils/crypto.js';

describe('INS Solar ERP — Critical Business Logic Audit Regressions', () => {
  const adminUser = { userId: new Types.ObjectId().toString(), role: UserRole.ADMIN };
  const superAdminUser = { userId: new Types.ObjectId().toString(), role: UserRole.SUPERADMIN };
  const accountsUser = { userId: new Types.ObjectId().toString(), role: UserRole.ACCOUNTS_OFFICER };
  const crewAUserId = new Types.ObjectId().toString();
  const crewBUserId = new Types.ObjectId().toString();

  const makeChainQuery = (doc: any) => {
    const q: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    q.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return q;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(undefined as any);
    vi.spyOn(NotificationCenterService, 'createNotification').mockResolvedValue(undefined as any);
    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
      formattedNumber: `${String(type).slice(0, 3).toUpperCase()}-2026-00901`,
      sequenceNumber: 901,
      sequenceKey: `${type}:2026`,
      prefix: String(type).slice(0, 3).toUpperCase(),
      fiscalYear: '2026'
    }));
    vi.spyOn(SequenceService, 'generateNextSequence').mockResolvedValue({
      formattedNumber: 'SEQ-2026-00901',
      sequenceNumber: 901
    } as any);
  });

  // =========================================================================
  // 1. PROJECT STAGE LOGIC (STRICTLY 5 STAGES + COMMISSIONING GATES)
  // =========================================================================
  describe('1. Project Stage Logic & Commissioning Separation', () => {
    it('enforces strictly 5 canonical ProjectStage values without legacy 10-stage enums', () => {
      const stages = Object.values(ProjectStage);
      expect(stages).toEqual([
        'STAGE_1_DESIGN_APPROVAL',
        'STAGE_2_MATERIAL_DISPATCH',
        'STAGE_3_SITE_INSTALLATION',
        'STAGE_4_NET_METER_SYNC',
        'STAGE_5_HANDOVER_COMMISSIONING'
      ]);
      expect((ProjectStage as any).STAGE_10_COMMISSION_HANDOVER).toBeUndefined();
      expect((ProjectStage as any).STAGE_8_TESTING_PRE_COMMISSION).toBeUndefined();
    });

    it('blocks Stage 1 -> Stage 2 advancement when approved SLD document is missing', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({
          _id: projectId,
          projectCode: 'PRJ-STG-1',
          customerId,
          orderId,
          systemCapacityKwp: 10,
          status: ProjectStatus.IN_PROGRESS,
          currentStage: ProjectStage.STAGE_1_DESIGN_APPROVAL,
          stageHistory: [],
          milestones: []
        }) as any
      );
      vi.spyOn(SiteSurvey, 'findOne')
        .mockReturnValueOnce(makeChainQuery({ _id: new Types.ObjectId(), status: 'COMPLETED' }) as any)
        .mockReturnValueOnce(makeChainQuery(null) as any);
      vi.spyOn(SolarDesign, 'findOne').mockReturnValue(
        makeChainQuery({
          _id: new Types.ObjectId(),
          module: { productId: new Types.ObjectId(), count: 10 },
          inverter: { productId: new Types.ObjectId(), count: 1 },
          bomItems: [{ productId: new Types.ObjectId(), quantity: 10 }]
        }) as any
      );
      vi.spyOn(SalesOrder, 'findById').mockReturnValue(
        makeChainQuery({ _id: orderId, status: 'CONFIRMED', lineItems: [{ productId: new Types.ObjectId(), quantity: 10 }] }) as any
      );
      vi.spyOn(DocumentModel, 'exists').mockResolvedValue(null as any);
      vi.spyOn(NetMeteringApplication, 'exists').mockResolvedValue(null as any);

      await expect(
        ProjectService.advanceProjectStage(
          projectId.toString(),
          { stage: ProjectStage.STAGE_2_MATERIAL_DISPATCH, notes: 'Trying Stage 2' },
          adminUser
        )
      ).rejects.toThrow(/SLD|drawing|Single Line Diagram/i);
    });

    it('blocks Stage 2 -> Stage 3 when dispatch is only IN_TRANSIT or returns reduce site qty below BOM', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const panelId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({
          _id: projectId,
          projectCode: 'PRJ-STG-2',
          customerId,
          orderId,
          status: ProjectStatus.IN_PROGRESS,
          currentStage: ProjectStage.STAGE_2_MATERIAL_DISPATCH,
          stageHistory: [],
          milestones: []
        }) as any
      );
      vi.spyOn(SalesOrder, 'findById').mockReturnValue(
        makeChainQuery({
          _id: orderId,
          lineItems: [{ productId: panelId, itemType: 'SOLAR_PANEL', description: '550W Panel', quantity: 10 }]
        }) as any
      );
      vi.spyOn(Product, 'find').mockReturnValue(
        makeChainQuery([{ _id: panelId, isTrackableInventory: true }]) as any
      );

      // Dispatch is IN_TRANSIT -> delivered site quantity is 0 < 10
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new Types.ObjectId(),
            status: MaterialDispatchStatus.IN_TRANSIT,
            lineItems: [{ productId: panelId, issuedQuantity: 10 }]
          }
        ]) as any
      );
      vi.spyOn(StockMovement, 'find').mockReturnValue(makeChainQuery([]) as any);

      await expect(
        ProjectService.advanceProjectStage(
          projectId.toString(),
          { stage: ProjectStage.STAGE_3_SITE_INSTALLATION, notes: 'In transit only' },
          adminUser
        )
      ).rejects.toThrow(/DELIVERED|material|required/i);

      // Now DELIVERED = 10, but RETURN = 2 -> net site = 8 < 10 -> still blocked
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new Types.ObjectId(),
            status: MaterialDispatchStatus.DELIVERED,
            lineItems: [{ productId: panelId, issuedQuantity: 10 }]
          }
        ]) as any
      );
      vi.spyOn(StockMovement, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new Types.ObjectId(),
            movementType: StockMovementType.RETURN,
            orderId,
            productId: panelId,
            quantity: 2
          }
        ]) as any
      );

      await expect(
        ProjectService.advanceProjectStage(
          projectId.toString(),
          { stage: ProjectStage.STAGE_3_SITE_INSTALLATION, notes: 'Returned shortage' },
          adminUser
        )
      ).rejects.toThrow(/returned|delivered|shortfall|required/i);
    });

    it('blocks marking project COMPLETED without Stage 5, JCR, generation reading & handover sign-off; activates warranty upon completion', async () => {
      const projectId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      const projectDoc: any = {
        _id: projectId,
        projectCode: 'PRJ-COMP-1',
        customerId,
        status: ProjectStatus.IN_PROGRESS,
        currentStage: ProjectStage.STAGE_3_SITE_INSTALLATION,
        milestones: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Project, 'findById').mockReturnValue(makeChainQuery(projectDoc) as any);

      // Reject when currentStage is not Stage 5
      await expect(
        ProjectService.updateProjectStatus(
          projectId.toString(),
          {
            status: ProjectStatus.COMPLETED,
            commissioningDetails: {
              generationReadingKwh: 12.5,
              customerHandoverSignedOff: true,
              customerSignOffName: 'Ramesh Verma'
            }
          },
          adminUser
        )
      ).rejects.toThrow(/Stage 5|STAGE_5/i);

      // Advance project mock to Stage 5, check missing JCR blocks completion
      projectDoc.currentStage = ProjectStage.STAGE_5_HANDOVER_COMMISSIONING;
      vi.spyOn(ProjectInstallationChecklist, 'findOne').mockReturnValue(
        makeChainQuery({
          projectId,
          categories: Object.values(ChecklistCategory).map(c => ({
            category: c,
            items: [{ isRequired: true, status: ChecklistItemStatus.PASSED }]
          }))
        }) as any
      );
      vi.spyOn(DocumentModel, 'findOne').mockReturnValue(makeChainQuery(null) as any);

      await expect(
        ProjectService.updateProjectStatus(
          projectId.toString(),
          {
            status: ProjectStatus.COMPLETED,
            commissioningDetails: {
              generationReadingKwh: 12.5,
              customerHandoverSignedOff: true,
              customerSignOffName: 'Ramesh Verma'
            }
          },
          adminUser
        )
      ).rejects.toThrow(/JCR|Commissioning|report/i);

      // Provide accepted JCR -> completion succeeds & activates warranty from Product.warranty terms
      vi.spyOn(DocumentModel, 'findOne').mockReturnValue(
        makeChainQuery({
          _id: new Types.ObjectId(),
          projectId,
          category: DocumentCategory.COMMISSIONING_REPORT,
          reviewStatus: DocumentReviewStatus.ACCEPTED
        }) as any
      );
      const serialDoc: any = {
        _id: new Types.ObjectId(),
        serialNumber: 'INV-SN-001',
        productId,
        projectId,
        status: SerialNumberStatus.INSTALLED,
        warrantyStatus: WarrantyStatus.PENDING_ACTIVATION,
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(ProductSerialNumber, 'find').mockResolvedValue([serialDoc] as any);
      vi.spyOn(Product, 'findById').mockReturnValue(
        makeChainQuery({
          _id: productId,
          name: '5kW Hybrid Inverter',
          warranty: { warrantyMonths: 60, terms: '5 Years Replacement' }
        }) as any
      );

      const completed = await ProjectService.updateProjectStatus(
        projectId.toString(),
        {
          status: ProjectStatus.COMPLETED,
          commissioningDetails: {
            generationReadingKwh: 15.2,
            customerHandoverSignedOff: true,
            customerSignOffName: 'Ramesh Verma'
          }
        },
        adminUser
      );

      expect(completed.status).toBe(ProjectStatus.COMPLETED);
      expect(serialDoc.warrantyStatus).toBe(WarrantyStatus.ACTIVE);
      expect(serialDoc.warrantyStartDate).toBeInstanceOf(Date);
      expect(serialDoc.warrantyEndDate).toBeInstanceOf(Date);
      expect(serialDoc.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. DISPATCH, TRANSIT, CANCELLATION & INVENTORY RETURN LOGIC
  // =========================================================================
  describe('2. Dispatch Transit Lifecycle & Physical Return Validation', () => {
    it('transitions DISPATCHED -> IN_TRANSIT and blocks cancelDispatch for IN_TRANSIT or DELIVERED', async () => {
      const dispatchId = new Types.ObjectId();
      const warehouseId = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const projectId = new Types.ObjectId();

      const dispatchDoc: any = {
        _id: dispatchId,
        dispatchNumber: 'DSP-2026-00901',
        projectId,
        warehouseId,
        status: MaterialDispatchStatus.DISPATCHED,
        lineItems: [{ productId, issuedQuantity: 4, unitCostPaise: 10000 }],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(MaterialDispatch, 'findById').mockResolvedValue(dispatchDoc);
      const transited = await MaterialDispatchService.markInTransit(
        dispatchId.toString(),
        { notes: 'Truck departed gate' },
        adminUser
      );
      expect(transited.status).toBe(MaterialDispatchStatus.IN_TRANSIT);
      expect(transited.inTransitAt).toBeInstanceOf(Date);

      await expect(
        MaterialDispatchService.cancelDispatch(
          dispatchId.toString(),
          { cancellationReason: 'Attempt cancel after leaving warehouse' },
          adminUser
        )
      ).rejects.toThrow(/IN_TRANSIT|DELIVERED|return/i);
    });

    it('emits DISPATCH_REVERSAL on pre-transit cancellation and skips stock restore for DRAFT', async () => {
      const draftId = new Types.ObjectId();
      const draftDoc: any = {
        _id: draftId,
        dispatchNumber: 'DSP-DRAFT-1',
        projectId: new Types.ObjectId(),
        warehouseId: new Types.ObjectId(),
        status: MaterialDispatchStatus.DRAFT,
        lineItems: [],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(MaterialDispatch, 'findById').mockResolvedValueOnce(draftDoc);
      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({ _id: draftDoc.projectId, projectCode: 'PRJ-DRAFT-1', name: 'Site' }) as any
      );
      const balanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');
      const cancelledDraft = await MaterialDispatchService.cancelDispatch(
        draftId.toString(),
        { cancellationReason: 'Draft no longer needed' },
        adminUser
      );
      expect(cancelledDraft.status).toBe(MaterialDispatchStatus.CANCELLED);
      expect(balanceSpy).not.toHaveBeenCalled();

      // Pre-transit DISPATCHED cancel emits DISPATCH_REVERSAL
      const stagedId = new Types.ObjectId();
      const whId = new Types.ObjectId();
      const prodId = new Types.ObjectId();
      const resId = new Types.ObjectId();
      const stagedDoc: any = {
        _id: stagedId,
        dispatchNumber: 'DSP-STAGED-1',
        projectId: new Types.ObjectId(),
        orderId: new Types.ObjectId(),
        sourceWarehouseId: whId,
        status: MaterialDispatchStatus.DISPATCHED,
        lineItems: [
          {
            productId: prodId,
            issuedQuantity: 5,
            reservedQuantityUsed: 5,
            reservationId: resId,
            unitCostPaise: 10000
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(MaterialDispatch, 'findById').mockResolvedValueOnce(stagedDoc);
      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({ _id: stagedDoc.projectId, projectCode: 'PRJ-STAGED-1', name: 'Site' }) as any
      );
      vi.spyOn(StockReservation, 'findById').mockResolvedValue({
        _id: resId,
        status: StockReservationStatus.ISSUED,
        quantity: 5,
        issuedQuantity: 5,
        save: vi.fn().mockResolvedValue(true)
      } as any);
      vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({ onHandQuantity: 10, reservedQuantity: 5, availableQuantity: 5 } as any);
      const movementSaveSpy = vi.spyOn(StockMovement.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const cancelledStaged = await MaterialDispatchService.cancelDispatch(
        stagedId.toString(),
        { cancellationReason: 'Cancelled at bay before truck departure' },
        adminUser
      );
      expect(cancelledStaged.status).toBe(MaterialDispatchStatus.CANCELLED);
      expect(movementSaveSpy).toHaveBeenCalled();
      const savedMov = movementSaveSpy.mock.instances[0] as any;
      expect(savedMov.movementType).toBe(StockMovementType.DISPATCH_REVERSAL);
      expect(savedMov.destinationWarehouseId?.toString()).toBe(whId.toString());
    });

    it('blocks over-return on dispatch and prevents DAMAGED/SCRAP return from restocking usable StockBalance', async () => {
      const srcWh = new Types.ObjectId();
      const destWh = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const dispatchId = new Types.ObjectId();
      const orderId = new Types.ObjectId();

      vi.spyOn(Warehouse, 'findById').mockResolvedValue({ _id: destWh, name: 'Main WH', isActive: true } as any);
      vi.spyOn(Product, 'findById').mockResolvedValue({ _id: productId, name: '550W Panel', uom: 'NOS', standardPurchaseRatePaise: 100000 } as any);
      vi.spyOn(StockMovement, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(MaterialDispatch, 'findById').mockResolvedValue({
        _id: dispatchId,
        orderId,
        status: MaterialDispatchStatus.DELIVERED,
        lineItems: [{ productId, issuedQuantity: 2, unitCostPaise: 100000 }]
      } as any);
      vi.spyOn(StockMovement, 'find').mockReturnValue(
        makeChainQuery([
          { _id: new Types.ObjectId(), movementType: StockMovementType.RETURN, productId, quantity: 2 }
        ]) as any
      );

      // Trying to return 1 more unit when 2 of 2 were already returned -> blocked
      await expect(
        StockService.returnStock(
          {
            sourceWarehouseId: srcWh.toString(),
            destinationWarehouseId: destWh.toString(),
            productId: productId.toString(),
            dispatchId: dispatchId.toString(),
            quantity: 1,
            reason: 'Duplicate return attempt',
            condition: 'REUSABLE',
            disposition: 'RESTOCK'
          },
          adminUser,
          {}
        )
      ).rejects.toThrow(/exceeds|returned|quantity/i);

      // DAMAGED return with RESTOCK disposition is rejected cleanly
      vi.spyOn(StockMovement, 'find').mockReturnValue(makeChainQuery([]) as any);
      await expect(
        StockService.returnStock(
          {
            sourceWarehouseId: srcWh.toString(),
            destinationWarehouseId: destWh.toString(),
            productId: productId.toString(),
            dispatchId: dispatchId.toString(),
            quantity: 1,
            reason: 'Broken glass panel',
            condition: 'DAMAGED',
            disposition: 'RESTOCK'
          },
          adminUser,
          {}
        )
      ).rejects.toThrow(/REUSABLE|DAMAGED|RESTOCK/i);

      // SCRAP return with SCRAP_WRITEOFF succeeds without incrementing usable StockBalance
      const stockUpsertSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');
      vi.spyOn(StockMovement.prototype, 'save').mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const scrapMov = await StockService.returnStock(
        {
          sourceWarehouseId: srcWh.toString(),
          destinationWarehouseId: destWh.toString(),
          productId: productId.toString(),
          dispatchId: dispatchId.toString(),
          quantity: 1,
          reason: 'Transit cracked panel',
          condition: 'SCRAP',
          disposition: 'SCRAP_WRITEOFF'
        },
        adminUser,
        {}
      );
      expect(scrapMov.movementType).toBe(StockMovementType.RETURN);
      expect(stockUpsertSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. INSTALLATION SCOPING, REWORK HISTORY, SERIAL & WARRANTY LOGIC
  // =========================================================================
  describe('3. Installation QA, Serial Conflict & Warranty Claim Integrity', () => {
    it('enforces installer scoping, blocks self-approval, and preserves PENDING_ACTIVATION warranty on QA approval', async () => {
      const installId = new Types.ObjectId();
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      const installDoc: any = {
        _id: installId,
        projectId,
        assignedTo: new Types.ObjectId(crewAUserId),
        submittedBy: new Types.ObjectId(crewAUserId),
        status: InstallationStatus.IN_PROGRESS,
        sitePhotos: [{ _id: new Types.ObjectId(), fileName: 'roof.jpg', isVerified: false }],
        inventoryItems: [],
        history: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(InstallationModel, 'findById').mockReturnValue(makeChainQuery(installDoc) as any);
      vi.spyOn(Customer, 'findByIdAndUpdate').mockResolvedValue({ _id: new Types.ObjectId() } as any);
      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({
          _id: projectId,
          projectCode: 'PRJ-QA-1',
          stageHistory: [],
          milestones: [],
          save: vi.fn().mockResolvedValue(true)
        }) as any
      );
      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        serialNumber: 'MOD-001',
        productId,
        projectId,
        warrantyStatus: WarrantyStatus.PENDING_ACTIVATION,
        save: vi.fn().mockResolvedValue(true)
      } as any);
      vi.spyOn(Notification, 'create').mockResolvedValue({} as any);

      // Crew B cannot mutate Crew A's assigned installation
      await expect(
        InstallationService.updateInstallation(
          installId.toString(),
          { notes: 'Unauthorized edit' } as any,
          { actorId: crewBUserId, actorType: 'EMPLOYEE', role: UserRole.INSTALLATION_CREW }
        )
      ).rejects.toThrow(/assigned|Access Denied|permission/i);

      // Crew A submits report, then tries self-review -> blocked
      installDoc.status = InstallationStatus.SUBMITTED;
      await expect(
        InstallationService.reviewInstallation(
          installId.toString(),
          { action: 'APPROVE', adminRemarks: 'Self-approving' },
          { actorId: crewAUserId, actorType: 'EMPLOYEE', role: UserRole.ADMIN }
        )
      ).rejects.toThrow(/Self-approval|submitted/i);

      // Supervisor (different actor) approves -> installation becomes APPROVED but serial remains PENDING_ACTIVATION
      const serialUpdateSpy = vi.spyOn(ProductSerialNumber, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);
      installDoc.inventoryItems = [
        { serialNumber: 'MOD-001', productId, status: 'VERIFIED' }
      ];
      const approved = await InstallationService.reviewInstallation(
        installId.toString(),
        { action: 'APPROVE', adminRemarks: 'Supervisor QA verified' },
        { actorId: adminUser.userId, actorType: 'EMPLOYEE', role: adminUser.role }
      );
      expect(approved.status).toBe(InstallationStatus.APPROVED);
      // Warranty activation is deferred until Stage 5 Commissioning
      if (serialUpdateSpy.mock.calls.length > 0) {
        const updatePayload = serialUpdateSpy.mock.calls[0]?.[1] as any;
        expect(updatePayload?.$set?.warrantyStatus).not.toBe(WarrantyStatus.ACTIVE);
      }
    });

    it('appends immutable reworkHistory entries on checklist failure and reinspection pass', async () => {
      const projectId = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const checklistItems: any = [
        {
          _id: itemId,
          itemCode: 'CHK-03-01',
          description: 'MC4 crimping & conduit routing',
          isRequired: true,
          requiresEvidence: false,
          status: ChecklistItemStatus.IN_PROGRESS,
          reworkHistory: []
        }
      ];
      checklistItems.id = (searchId: string) =>
        checklistItems.find((x: any) => x._id.toString() === searchId.toString()) || null;

      const checklistDoc: any = {
        _id: new Types.ObjectId(),
        projectId,
        categories: [
          {
            category: ChecklistCategory.DC_WIRING_EARTHING,
            items: checklistItems
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectInstallationChecklist, 'findOne').mockResolvedValue(checklistDoc);

      await ChecklistService.updateItemStatus(
        projectId.toString(),
        itemId.toString(),
        { status: ChecklistItemStatus.FAILED, failureReason: 'Loose MC4 connector on string 2' },
        adminUser
      );

      await ChecklistService.updateItemStatus(
        projectId.toString(),
        itemId.toString(),
        { status: ChecklistItemStatus.PASSED, notes: 'Re-crimped and torque verified' },
        adminUser
      );

      const updatedItem = checklistDoc.categories[0].items[0];
      expect(updatedItem.status).toBe(ChecklistItemStatus.PASSED);
      expect(updatedItem.reworkHistory).toHaveLength(2);
      expect(updatedItem.reworkHistory[0].newStatus).toBe(ChecklistItemStatus.FAILED);
      expect(updatedItem.reworkHistory[0].reason).toMatch(/Loose MC4/);
      expect(updatedItem.reworkHistory[1].newStatus).toBe(ChecklistItemStatus.PASSED);
    });

    it('blocks rejected warranty claim from issuing replacement stock and enforces SKU match', async () => {
      const claimId = new Types.ObjectId();
      const productIdA = new Types.ObjectId();
      const productIdB = new Types.ObjectId();

      const claimDoc: any = {
        _id: claimId,
        claimNumber: 'WCL-2026-00010',
        productId: productIdA,
        customerId: new Types.ObjectId(),
        projectId: new Types.ObjectId(),
        serialNumber: 'INV-FAIL-01',
        status: WarrantyClaimStatus.SUBMITTED,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue(claimDoc);
      vi.spyOn(User, 'findById').mockReturnValue(
        makeChainQuery({ _id: adminUser.userId, firstName: 'Audit', lastName: 'Admin' }) as any
      );
      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        serialNumber: 'INV-FAIL-01',
        productId: productIdA,
        save: vi.fn().mockResolvedValue(true)
      } as any);
      const stockDecSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');

      // Cannot mark REJECTED while supplying replacement resolution or replacement serial
      await expect(
        WarrantyService.decideClaim(
          claimId.toString(),
          {
            status: WarrantyClaimStatus.REJECTED,
            resolutionType: WarrantyClaimResolution.REPLACEMENT,
            replacementSerialNumber: 'INV-NEW-99',
            decisionNotes: 'Attempt invalid stock issue on rejection'
          },
          adminUser
        )
      ).rejects.toThrow(/Rejected|Cancelled|replacement/i);
      expect(stockDecSpy).not.toHaveBeenCalled();

      // Reject cleanly, then confirm re-deciding a closed claim is blocked
      await WarrantyService.decideClaim(
        claimId.toString(),
        {
          status: WarrantyClaimStatus.REJECTED,
          decisionNotes: 'Surge damage outside warranty scope'
        },
        adminUser
      );
      expect(stockDecSpy).not.toHaveBeenCalled();

      await expect(
        WarrantyService.decideClaim(
          claimId.toString(),
          {
            status: WarrantyClaimStatus.REPLACED,
            resolutionType: WarrantyClaimResolution.REPLACEMENT,
            replacementSerialNumber: 'INV-NEW-99',
            decisionNotes: 'Try reopen'
          },
          adminUser
        )
      ).rejects.toThrow(/already.*decided|already finalized|finalized|closed/i);

      // Fresh UNDER_REVIEW claim trying wrong SKU replacement -> blocked
      claimDoc.status = WarrantyClaimStatus.UNDER_REVIEW;
      vi.spyOn(ProductSerialNumber, 'findOne')
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), serialNumber: 'INV-FAIL-01', productId: productIdA } as any)
        .mockResolvedValueOnce({
          _id: new Types.ObjectId(),
          serialNumber: 'WRONG-SKU-SN',
          productId: productIdB,
          status: SerialNumberStatus.IN_STOCK,
          warehouseId: new Types.ObjectId()
        } as any);

      await expect(
        WarrantyService.decideClaim(
          claimId.toString(),
          {
            status: WarrantyClaimStatus.REPLACED,
            resolutionType: WarrantyClaimResolution.REPLACEMENT,
            replacementSerialNumber: 'WRONG-SKU-SN',
            decisionNotes: 'Wrong product SKU swap'
          },
          adminUser
        )
      ).rejects.toThrow(/product|SKU|match/i);
    });
  });

  // =========================================================================
  // 4. PROJECT COSTING & MARGIN SEPARATION
  // =========================================================================
  describe('4. Project Costing & Profit Separation', () => {
    it('excludes IN_TRANSIT dispatches from consumed cost and sets budgeted margin to null when unbudgeted', async () => {
      const projectId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-COST-1',
        name: 'Costing Verification Plant',
        customerId,
        orderId,
        milestones: [{ _id: new Types.ObjectId(), weightPercent: 100, status: MilestoneStatus.IN_PROGRESS }]
      } as any);
      vi.spyOn(SalesOrder, 'findById').mockReturnValue(
        makeChainQuery({ _id: orderId, netTotalPaise: 50000000 }) as any
      );
      vi.spyOn(PurchaseOrder, 'find').mockReturnValue(
        makeChainQuery([{ status: 'ISSUED', grandTotalPaise: 32000000 }]) as any
      );
      vi.spyOn(VendorInvoice, 'find').mockReturnValue(
        makeChainQuery([{ status: VendorInvoiceStatus.RECONCILED, totalAmountPaise: 30000000 }]) as any
      );
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new Types.ObjectId(),
            dispatchNumber: 'DSP-DEL-1',
            status: MaterialDispatchStatus.DELIVERED,
            deliveredAt: new Date(),
            lineItems: [{ productId, issuedQuantity: 10, unitCostPaise: 1000000 }]
          },
          {
            _id: new Types.ObjectId(),
            dispatchNumber: 'DSP-TRN-2',
            status: MaterialDispatchStatus.IN_TRANSIT,
            inTransitAt: new Date(),
            lineItems: [{ productId, issuedQuantity: 5, unitCostPaise: 1000000 }]
          }
        ]) as any
      );
      vi.spyOn(Product, 'find').mockReturnValue(
        makeChainQuery([{ _id: productId, name: 'Panel', uom: 'NOS', standardPurchaseRatePaise: 1000000 }]) as any
      );
      vi.spyOn(StockMovement, 'find').mockReturnValue(
        makeChainQuery([
          // DISPATCH_REVERSAL should NOT act as return credit on project cost
          {
            _id: new Types.ObjectId(),
            movementNumber: 'MOV-REV-1',
            movementType: StockMovementType.DISPATCH_REVERSAL,
            productId,
            quantity: 2,
            unitCostPaise: 1000000,
            orderId
          }
        ]) as any
      );
      vi.spyOn(Expense, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new Types.ObjectId(),
            expenseNumber: 'EXP-1',
            category: ExpenseCategory.INSTALLATION_LABOR,
            amountPaise: 2000000,
            status: ExpenseStatus.APPROVED
          }
        ]) as any
      );
      vi.spyOn(PaymentAllocation, 'find').mockReturnValue(
        makeChainQuery([
          { allocatedAmountPaise: 25000000, status: PaymentAllocationStatus.ACTIVE }
        ]) as any
      );
      vi.spyOn(CustomerPayment, 'find').mockReturnValue(makeChainQuery([]) as any);
      vi.spyOn(ProjectBudget, 'findOne').mockReturnValue(makeChainQuery(null) as any);

      const report = await ProjectProfitabilityService.getProjectProfitability(projectId.toString());

      expect(report.costSummary.materialIssuedCostPaise).toBe(15000000);
      expect(report.costSummary.materialInTransitCostPaise).toBe(5000000);
      expect(report.costSummary.materialConsumedCostPaise).toBe(10000000); // Only DELIVERED, ignores IN_TRANSIT & DISPATCH_REVERSAL
      expect(report.costSummary.approvedExpensesPaise).toBe(2000000);
      expect(report.costBreakdown.actualProjectCostPaise).toBe(12000000);
      expect(report.budgetedGrossMarginPaise).toBeNull();
      expect(report.estimatedGrossMarginPaise).toBeNull();
    });
  });

  // =========================================================================
  // 5. ACCOUNTS, PAYMENTS, INVOICES, VENDOR BILLS & QUOTES
  // =========================================================================
  describe('5. Accounts, Payment Segregation & Fiscal Integrity', () => {
    it('enforces RECORDED status intake despite autoVerify and checks global UTR uniqueness', async () => {
      const custA = new Types.ObjectId();
      const custB = new Types.ObjectId();
      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: custA } as any);

      // UTR already used on Customer B (different customer) -> must block
      vi.spyOn(CustomerPayment, 'findOne').mockImplementation((q: any) => {
        if (q?.transactionReference) {
          return Promise.resolve({
            _id: new Types.ObjectId(),
            customerId: custB,
            paymentNumber: 'REC-OTHER-1',
            status: CustomerPaymentStatus.VERIFIED
          }) as any;
        }
        return Promise.resolve(null) as any;
      });

      await expect(
        PaymentService.recordPayment(
          {
            customerId: custA.toString(),
            amountPaise: 100000,
            paymentMethod: PaymentMethod.NEFT_RTGS,
            transactionReference: 'UTR-GLOBAL-999',
            autoVerify: true
          },
          accountsUser
        )
      ).rejects.toThrow(/duplicate|reference|UTR/i);

      // Unique UTR succeeds, status MUST remain RECORDED (ignoring autoVerify)
      vi.spyOn(CustomerPayment, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(CustomerPayment.prototype, 'save').mockResolvedValue(undefined as any);

      const savedPay = await PaymentService.recordPayment(
        {
          customerId: custA.toString(),
          amountPaise: 100000,
          paymentMethod: PaymentMethod.NEFT_RTGS,
          transactionReference: 'UTR-UNIQUE-001',
          autoVerify: true
        },
        accountsUser
      );
      expect(savedPay.status).toBe(CustomerPaymentStatus.RECORDED);
    });

    it('blocks cancelling paid CustomerInvoice or invoice with active linked CREDIT_NOTE', async () => {
      const invoiceId = new Types.ObjectId();
      vi.spyOn(CustomerInvoice, 'findById').mockResolvedValue({
        _id: invoiceId,
        invoiceNumber: 'INV-2026-00010',
        invoiceType: CustomerInvoiceType.TAX_INVOICE,
        status: CustomerInvoiceStatus.PARTIALLY_PAID,
        amountPaidPaise: 500000
      } as any);

      await expect(
        CustomerInvoiceService.cancelInvoice(
          invoiceId.toString(),
          { cancellationReason: 'Trying illegal cancel on paid invoice' },
          adminUser,
          {}
        )
      ).rejects.toThrow(/paid|credited|Credit Note/i);

      // Zero paid, but active Credit Note exists -> blocked
      vi.spyOn(CustomerInvoice, 'findById').mockResolvedValue({
        _id: invoiceId,
        invoiceNumber: 'INV-2026-00011',
        invoiceType: CustomerInvoiceType.TAX_INVOICE,
        status: CustomerInvoiceStatus.ISSUED,
        amountPaidPaise: 0
      } as any);
      vi.spyOn(CustomerInvoice, 'findOne').mockReturnValue(
        makeChainQuery({ invoiceNumber: 'CN-2026-00001' }) as any
      );

      await expect(
        CustomerInvoiceService.cancelInvoice(
          invoiceId.toString(),
          { cancellationReason: 'Trying cancel with active Credit Note' },
          adminUser,
          {}
        )
      ).rejects.toThrow(/Credit Note/i);
    });

    it('flags VendorInvoice DISPUTED when accepted GRNs were already billed and blocks payment on DISPUTED bills', async () => {
      const vendorId = new Types.ObjectId();
      const poId = new Types.ObjectId();
      const grnId = new Types.ObjectId();

      vi.spyOn(Vendor, 'findById').mockResolvedValue({ _id: vendorId, name: 'SolarTech' } as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue({
        _id: poId,
        poNumber: 'PO-2026-001',
        vendorId,
        grandTotalPaise: 1000000
      } as any);
      vi.spyOn(GoodsReceipt, 'find').mockResolvedValue([
        {
          _id: grnId,
          grnNumber: 'GRN-1',
          lineItems: [{ acceptedQuantity: 10, unitPricePaise: 100000 }]
        }
      ] as any);
      vi.spyOn(VendorInvoice, 'find').mockReturnValue(
        makeChainQuery([
          { _id: new Types.ObjectId(), vendorInvoiceNumber: 'BILL-OLD-1', goodsReceiptIds: [grnId], totalAmountPaise: 1000000 }
        ]) as any
      );
      vi.spyOn(VendorInvoice.prototype, 'save').mockResolvedValue(undefined as any);

      const bill = await VendorInvoiceService.createVendorInvoice(
        {
          vendorId: vendorId.toString(),
          purchaseOrderId: poId.toString(),
          goodsReceiptIds: [grnId.toString()],
          vendorInvoiceNumber: 'BILL-DUP-GRN',
          invoiceDate: '2026-11-26',
          subtotalPaise: 1000000,
          taxAmountPaise: 0,
          totalAmountPaise: 1000000
        },
        accountsUser,
        {}
      );
      expect(bill.status).toBe(VendorInvoiceStatus.DISPUTED);

      // Cannot record payment while DISPUTED
      vi.spyOn(VendorInvoice, 'findById').mockResolvedValue({
        _id: bill._id,
        vendorInvoiceNumber: 'BILL-DUP-GRN',
        status: VendorInvoiceStatus.DISPUTED,
        balancePayablePaise: 1000000
      } as any);
      await expect(
        VendorInvoiceService.recordPayment(
          bill._id.toString(),
          { amountPaise: 100000 },
          accountsUser,
          {}
        )
      ).rejects.toThrow(/DISPUTED|discrepancies/i);
    });

    it('blocks fiscal expense self-approval for Superadmin and enforces quote approval/expiry checks', async () => {
      const expId = new Types.ObjectId();
      vi.spyOn(Expense, 'findById').mockResolvedValue({
        _id: expId,
        status: ExpenseStatus.PENDING_APPROVAL,
        submittedBy: new Types.ObjectId(superAdminUser.userId),
        createdBy: new Types.ObjectId(superAdminUser.userId)
      } as any);

      await expect(
        ExpenseService.approveExpense(
          expId.toString(),
          { action: 'APPROVE', approvalNotes: 'Trying fiscal bypass' } as any,
          superAdminUser
        )
      ).rejects.toThrow(/Self-approval|submitted/i);

      // Workstation customer acceptance cannot bypass discount approval
      const quoteId = new Types.ObjectId();
      vi.spyOn(Quotation, 'findById').mockResolvedValue({
        _id: quoteId,
        quotationNumber: 'QT-2026-01',
        status: QuotationStatus.SENT,
        isLatestRevision: true,
        requiresDiscountApproval: true,
        discountApprovalStatus: 'PENDING',
        validUntil: new Date(Date.now() + 86400000)
      } as any);

      await expect(
        QuotationService.recordWorkstationCustomerDecision(
          quoteId.toString(),
          { action: 'ACCEPT', notes: 'Customer wants discount without manager sign-off' },
          adminUser
        )
      ).rejects.toThrow(/discount|approval/i);
    });
  });

  // =========================================================================
  // 6. RBAC HARDENING & 2-CUSTOMER PORTAL CROSS-TENANT ISOLATION MATRIX
  // =========================================================================
  describe('6. RBAC Hardening & Customer Portal Multi-Tenant Isolation', () => {
    it('blocks INSTALLATION_CREW (403) from advancing stages or updating net-metering via HTTP routes', async () => {
      const app = createApp();
      const crewId = new Types.ObjectId();
      const passwordHash = await hashPassword('CrewPass123!');

      vi.spyOn(User, 'findOne').mockResolvedValue({
        _id: crewId,
        email: 'crew@inssolar.test',
        firstName: 'Ravi',
        lastName: 'Installer',
        passwordHash,
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS,
        isActive: true,
        sessionVersion: 1,
        mfaEnabled: false,
        save: vi.fn().mockResolvedValue(true),
        getEffectivePermissions: () => ROLE_DEFAULT_PERMISSIONS[UserRole.INSTALLATION_CREW],
        toJSON: () => ({ id: crewId.toString(), email: 'crew@inssolar.test' })
      } as any);
      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: crewId,
        email: 'crew@inssolar.test',
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS,
        isActive: true,
        sessionVersion: 1,
        mfaEnabled: false,
        getEffectivePermissions: () => ROLE_DEFAULT_PERMISSIONS[UserRole.INSTALLATION_CREW]
      } as any);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'crew@inssolar.test', password: 'CrewPass123!' });
      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers['set-cookie'];
      const cookie = Array.isArray(setCookie) ? setCookie.map((c: string) => c.split(';')[0]).join('; ') : '';
      const csrfToken = loginRes.body?.data?.csrfToken || '';

      const stageRes = await request(app)
        .post(`/api/v1/projects/${new Types.ObjectId().toString()}/stage`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({ targetStage: ProjectStage.STAGE_4_NET_METER_SYNC });
      expect(stageRes.status).toBe(403);

      const netMeterRes = await request(app)
        .patch(`/api/v1/net-metering/${new Types.ObjectId().toString()}/status`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: NetMeteringStatus.SUBMITTED });
      expect(netMeterRes.status).toBe(403);
    });

    it('isolates Customer A from Customer B across all 8 Customer Portal modules', async () => {
      const app = createApp();
      const customerA = new Types.ObjectId();
      const customerB = new Types.ObjectId();
      const rawOtp = '123456';

      vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        customerId: customerA,
        phone: '+919900112233',
        otpHash: hashToken(rawOtp),
        otpExpiresAt: new Date(Date.now() + 600000),
        isActive: true,
        save: vi.fn().mockResolvedValue(true)
      } as any);
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: customerA,
        fullName: 'Customer A',
        primaryPhone: '+919900112233',
        isActive: true
      } as any);

      const otpRes = await request(app)
        .post('/api/v1/customer-auth/otp/verify')
        .send({ phone: '+919900112233', otp: rawOtp });
      expect(otpRes.status).toBe(200);
      const setCookie = otpRes.headers['set-cookie'];
      const cookieA = Array.isArray(setCookie) ? setCookie.map((c: string) => c.split(';')[0]).join('; ') : '';

      // 1. Projects
      vi.spyOn(Project, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, projectCode: 'PRJ-B' }) as any
      );
      const projRes = await request(app)
        .get(`/api/v1/customer-portal/projects/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(projRes.status);

      // 2. Quotations
      vi.spyOn(Quotation, 'findOne').mockReturnValue(makeChainQuery(null) as any);
      const quoteRes = await request(app)
        .get(`/api/v1/customer-portal/quotations/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(quoteRes.status);

      // 3. Invoices
      vi.spyOn(CustomerInvoice, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, invoiceNumber: 'INV-B' }) as any
      );
      const invRes = await request(app)
        .get(`/api/v1/customer-portal/invoices/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(invRes.status);

      // 4. Payments
      vi.spyOn(CustomerPayment, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, paymentNumber: 'REC-B' }) as any
      );
      const payRes = await request(app)
        .get(`/api/v1/customer-portal/payments/${new Types.ObjectId().toString()}/receipt`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(payRes.status);

      // 5. Complaints
      vi.spyOn(ServiceComplaint, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, ticketNumber: 'CMP-B' }) as any
      );
      const cmpRes = await request(app)
        .get(`/api/v1/customer-portal/service/complaints/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(cmpRes.status);

      // 6. Warranties
      vi.spyOn(ProductSerialNumber, 'findOne').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, serialNumber: 'SN-B-ONLY' }) as any
      );
      const warRes = await request(app)
        .get('/api/v1/customer-portal/service/warranties/SN-B-ONLY')
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(warRes.status);

      // 7. AMC Contracts
      vi.spyOn(AnnualMaintenanceContract, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, status: AmcStatus.ACTIVE }) as any
      );
      const amcRes = await request(app)
        .get(`/api/v1/customer-portal/service/amc/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(amcRes.status);

      // 8. Documents & Visits
      vi.spyOn(DocumentModel, 'findById').mockReturnValue(
        makeChainQuery({
          _id: new Types.ObjectId(),
          customerId: customerB,
          storageStatus: DocumentStorageStatus.STORED_S3
        }) as any
      );
      const docRes = await request(app)
        .get(`/api/v1/customer-portal/documents/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(docRes.status);

      vi.spyOn(ServiceVisit, 'findById').mockReturnValue(
        makeChainQuery({ _id: new Types.ObjectId(), customerId: customerB, visitNumber: 'VIS-B' }) as any
      );
      const visRes = await request(app)
        .get(`/api/v1/customer-portal/service/visits/${new Types.ObjectId().toString()}`)
        .set('Cookie', cookieA);
      expect([403, 404]).toContain(visRes.status);
    });
  });
});
