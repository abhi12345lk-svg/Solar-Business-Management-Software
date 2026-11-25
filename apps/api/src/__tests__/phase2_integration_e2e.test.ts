/**
 * INS Solar Business Management Software — Phase 2 End-to-End Integration & Regression Test Suite
 *
 * Verifies all approved Phase 2 capabilities:
 * 1. Warranty Claims, Hardware Replacement, Warehouse Stock Decrement & Defective RTV Decommissioning
 * 2. Service & AMC Management, Project COD to 1st-Year AMC Handover, and Atomic Visit Quota Tracking
 * 3. Procurement 3-Way Matching (PO vs GRN vs Vendor Invoice) & Project Costing Disbursements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  WarrantyStatus,
  WarrantyClaimStatus,
  WarrantyClaimResolution,
  SerialNumberStatus,
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  ServiceVisitType,
  ServiceVisitStatus,
  ComplaintStatus,
  GoodsReceiptStatus,
  VendorInvoiceStatus,
  AuditAction,
  AuditOutcome,
  MaterialDispatchStatus,
  ProjectStatus,
  ProjectStage
} from '@ins-solar/shared';

import { WarrantyClaim } from '../models/WarrantyClaim.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { ServiceComplaint } from '../models/ServiceComplaint.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { VendorInvoice } from '../models/VendorInvoice.js';
import { Vendor } from '../models/Vendor.js';
import { User } from '../models/User.js';

import { WarrantyService } from '../services/warrantyService.js';
import { AmcService } from '../services/amcService.js';
import { ServiceVisitService } from '../services/serviceVisitService.js';
import { ProjectService } from '../services/projectService.js';
import { VendorInvoiceService } from '../services/vendorInvoiceService.js';
import { SequenceService } from '../services/sequenceService.js';
import { AuditService } from '../services/auditService.js';
import { AppError } from '../errors/AppError.js';

describe('Phase 2 E2E Integration: Warranty Replacement, Service & AMC, and Procurement 3-Way Match', () => {
  const adminActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.SUPERADMIN,
    department: Department.ADMIN
  };

  const technicianActor = {
    userId: new Types.ObjectId().toString(),
    role: UserRole.INSTALLATION_CREW,
    department: Department.OPERATIONS
  };

  const mockContext = {
    ipAddress: '192.168.1.100',
    userAgent: 'INS-Solar-E2E-Agent/2.0',
    correlationId: 'corr-phase2-test-001'
  };

  const mockCustomerId = new Types.ObjectId();
  const mockProjectId = new Types.ObjectId();
  const mockProductId = new Types.ObjectId();
  const mockWarehouseId = new Types.ObjectId();
  const mockVendorId = new Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default Sequence Service mock
    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (type: any) => ({
      formattedNumber: `${type}-2026-00001`,
      sequenceNumber: 1,
      sequenceKey: `${type}:2026`,
      prefix: `${type}`,
      fiscalYear: '2026'
    }));

    // Default Audit Service mock
    vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

    // Default User lookup mock
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(),
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.SUPERADMIN
    } as any);
  });

  // =========================================================================
  // 1. WARRANTY CLAIMS & HARDWARE REPLACEMENT (CAPABILITY 2)
  // =========================================================================
  describe('1. Warranty Claims & Hardware Replacement Engine', () => {
    it('Scenario 2.1: Rejects replacement when replacement serial number does not exist in inventory', async () => {
      const mockClaimDoc = {
        _id: new Types.ObjectId(),
        claimNumber: 'CLM-2026-00001',
        serialNumber: 'INV-DEFECTIVE-001',
        productId: mockProductId,
        customerId: mockCustomerId,
        projectId: mockProjectId,
        status: WarrantyClaimStatus.UNDER_REVIEW,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue(mockClaimDoc as any);
      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(null);

      await expect(
        WarrantyService.decideClaim(
          mockClaimDoc._id.toString(),
          {
            status: WarrantyClaimStatus.REPLACED,
            resolutionType: WarrantyClaimResolution.REPLACEMENT,
            replacementSerialNumber: 'INV-NONEXISTENT-999',
            decisionNotes: 'Approving manufacturer warranty replacement.'
          },
          adminActor
        )
      ).rejects.toThrow(AppError);
    });

    it('Scenario 2.2: Rejects replacement when replacement serial number is not IN_STOCK (e.g. already INSTALLED)', async () => {
      const mockClaimDoc = {
        _id: new Types.ObjectId(),
        claimNumber: 'CLM-2026-00002',
        serialNumber: 'INV-DEFECTIVE-001',
        productId: mockProductId,
        customerId: mockCustomerId,
        projectId: mockProjectId,
        status: WarrantyClaimStatus.UNDER_REVIEW,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      const mockAllocatedUnit = {
        _id: new Types.ObjectId(),
        serialNumber: 'INV-ALREADY-ALLOCATED-002',
        productId: mockProductId,
        warehouseId: mockWarehouseId,
        status: SerialNumberStatus.INSTALLED, // Not available!
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue(mockClaimDoc as any);
      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(mockAllocatedUnit as any);

      await expect(
        WarrantyService.decideClaim(
          mockClaimDoc._id.toString(),
          {
            status: WarrantyClaimStatus.REPLACED,
            resolutionType: WarrantyClaimResolution.REPLACEMENT,
            replacementSerialNumber: 'INV-ALREADY-ALLOCATED-002',
            decisionNotes: 'Attempting to allocate already installed unit.'
          },
          adminActor
        )
      ).rejects.toThrow(/Must be IN_STOCK/);
    });

    it('Scenario 2.3: Approving replacement decrements warehouse stock, updates serial states, and logs compensating movements', async () => {
      const mockClaimDoc = {
        _id: new Types.ObjectId(),
        claimNumber: 'CLM-2026-00003',
        serialNumber: 'INV-DEFECTIVE-001',
        productId: mockProductId,
        customerId: mockCustomerId,
        projectId: mockProjectId,
        status: WarrantyClaimStatus.UNDER_REVIEW,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      const mockInStockReplacement: any = {
        _id: new Types.ObjectId(),
        serialNumber: 'INV-NEW-REPLACEMENT-001',
        productId: mockProductId,
        warehouseId: mockWarehouseId,
        status: SerialNumberStatus.IN_STOCK,
        save: vi.fn().mockResolvedValue(true)
      };

      const mockDefectiveDoc: any = {
        _id: new Types.ObjectId(),
        serialNumber: 'INV-DEFECTIVE-001',
        productId: mockProductId,
        status: SerialNumberStatus.INSTALLED,
        warrantyStatus: WarrantyStatus.ACTIVE,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue(mockClaimDoc as any);
      vi.spyOn(ProductSerialNumber, 'findOne').mockImplementation(((query: any) => {
        if (query.serialNumber === 'INV-NEW-REPLACEMENT-001') return Promise.resolve(mockInStockReplacement as any);
        if (query.serialNumber === 'INV-DEFECTIVE-001') return Promise.resolve(mockDefectiveDoc as any);
        return Promise.resolve(null);
      }) as any);

      const stockBalanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);
      const stockMovementSaveSpy = vi
        .spyOn(StockMovement.prototype, 'save')
        .mockImplementation(async function (this: any) {
          return this;
        });

      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const decidedClaim = await WarrantyService.decideClaim(
        mockClaimDoc._id.toString(),
        {
          status: WarrantyClaimStatus.REPLACED,
          resolutionType: WarrantyClaimResolution.REPLACEMENT,
          replacementSerialNumber: 'INV-NEW-REPLACEMENT-001',
          decisionNotes: 'Havells RMA replacement approved by technical center.'
        },
        adminActor
      );

      // Verify claim updated
      expect(decidedClaim.status).toBe(WarrantyClaimStatus.REPLACED);
      expect(decidedClaim.replacementSerialNumber).toBe('INV-NEW-REPLACEMENT-001');

      // Verify warehouse stock was decremented
      expect(stockBalanceSpy).toHaveBeenCalledWith(
        { productId: mockProductId, warehouseId: mockWarehouseId },
        expect.objectContaining({
          $inc: { onHandQuantity: -1, availableQuantity: -1 }
        })
      );

      // Verify replacement unit transitioned to INSTALLED and assigned
      expect(mockInStockReplacement.status).toBe(SerialNumberStatus.INSTALLED);
      expect(mockInStockReplacement.customerId).toEqual(mockCustomerId);
      expect(mockInStockReplacement.projectId).toEqual(mockProjectId);

      // Verify defective unit transitioned to DEFECTIVE and warranty VOID
      expect(mockDefectiveDoc.status).toBe(SerialNumberStatus.DEFECTIVE);
      expect(mockDefectiveDoc.warrantyStatus).toBe(WarrantyStatus.VOID);

      // Verify compensating stock movements saved (Issue for replacement, Return for defective)
      expect(stockMovementSaveSpy).toHaveBeenCalledTimes(2);

      // Verify audit trail recorded
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.WARRANTY_CLAIM_DECIDED,
          outcome: AuditOutcome.SUCCESS,
          details: expect.objectContaining({
            defectiveSerialNumber: 'INV-DEFECTIVE-001',
            replacementSerialNumber: 'INV-NEW-REPLACEMENT-001'
          })
        })
      );
    });

    it('Scenario 2.4: Retrieves available in-stock replacement serial numbers from warehouse', async () => {
      const mockSerialList = [
        { _id: new Types.ObjectId(), serialNumber: 'INV-SN-101', status: SerialNumberStatus.IN_STOCK },
        { _id: new Types.ObjectId(), serialNumber: 'INV-SN-102', status: SerialNumberStatus.IN_STOCK }
      ];

      const queryMock: any = {
        populate: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockSerialList)
      };

      vi.spyOn(ProductSerialNumber, 'find').mockReturnValue(queryMock);

      const available = await WarrantyService.getAvailableReplacements(
        mockProductId.toString(),
        mockWarehouseId.toString()
      );

      expect(available).toHaveLength(2);
      expect(available[0]!.serialNumber).toBe('INV-SN-101');
    });
  });

  // =========================================================================
  // 2. SERVICE & AMC MANAGEMENT (CAPABILITY 1)
  // =========================================================================
  describe('2. Service & AMC Management Engine', () => {
    it('Scenario 2.5: Project Handover initializes complimentary 1st-Year AMC awaiting contract approval', async () => {
      const mockOrderId = new Types.ObjectId();
      const mockProjectDoc = {
        _id: mockProjectId,
        projectCode: 'PRJ-2026-00001',
        customerId: mockCustomerId,
        orderId: mockOrderId,
        systemCapacityKwp: 10,
        currentStage: 'STAGE_5_HANDOVER_COMMISSIONING',
        status: 'COMPLETED'
      };

      const mockDispatches = [
        {
          _id: new Types.ObjectId(),
          dispatchNumber: 'DSP-2026-00001',
          projectId: mockProjectId,
          status: MaterialDispatchStatus.DISPATCHED,
          lineItems: [
            { productId: mockProductId, serialNumbers: ['INV-2026-001', 'MOD-2026-001'] }
          ]
        }
      ];

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc as any);
      vi.spyOn(SalesOrder, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: mockOrderId,
          status: 'CONFIRMED'
        })
      } as any);
      vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null); // No existing AMC
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockDispatches)
      } as any);

      const amcSaveSpy = vi
        .spyOn(AnnualMaintenanceContract.prototype, 'save')
        .mockImplementation(async function (this: any) {
          return this;
        });

      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const initializedAmc = await ProjectService.initializeFirstYearAmc(
        mockProjectId.toString(),
        adminActor,
        mockContext
      );

      expect(initializedAmc).toBeDefined();
      expect(initializedAmc.planType).toBe(AmcPlanType.COMPREHENSIVE);
      expect(initializedAmc.capacityKwp).toBe(10);
      expect(initializedAmc.contractAmountPaise).toBe(0); // Complimentary
      expect(initializedAmc.includedVisits).toBe(4);
      expect(initializedAmc.visitCadence).toBe(AmcVisitCadence.QUARTERLY);
      expect(initializedAmc.status).toBe(AmcStatus.PENDING_APPROVAL);
      expect(initializedAmc.coveredEquipment).toHaveLength(2);
      expect(amcSaveSpy).toHaveBeenCalled();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.AMC_CREATED,
          outcome: AuditOutcome.SUCCESS,
          details: expect.objectContaining({
            projectCode: 'PRJ-2026-00001',
            capacityKwp: 10,
            includedVisits: 4
          })
        })
      );
    });

    it('Scenario 2.6: Does not duplicate AMC if active contract already exists for the project', async () => {
      const mockOrderId = new Types.ObjectId();
      const mockProjectDoc = {
        _id: mockProjectId,
        projectCode: 'PRJ-2026-00001',
        customerId: mockCustomerId,
        orderId: mockOrderId,
        systemCapacityKwp: 10,
        currentStage: ProjectStage.STAGE_5_HANDOVER_COMMISSIONING,
        status: ProjectStatus.COMPLETED
      };

      const existingAmcDoc = {
        _id: new Types.ObjectId(),
        amcNumber: 'AMC-2026-00001',
        projectId: mockProjectId,
        status: AmcStatus.ACTIVE
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc as any);
      vi.spyOn(SalesOrder, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: mockOrderId,
          status: 'CONFIRMED'
        })
      } as any);
      vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(existingAmcDoc as any);

      const amc = await ProjectService.initializeFirstYearAmc(mockProjectId.toString(), adminActor);
      expect(amc._id).toEqual(existingAmcDoc._id);
      expect(amc.amcNumber).toBe('AMC-2026-00001');
    });

    it('Scenario 2.7: Atomic visit consumption increments included visits when under quota, chargeable when over', async () => {
      const mockAmcDoc = {
        _id: new Types.ObjectId(),
        amcNumber: 'AMC-2026-00001',
        status: AmcStatus.ACTIVE,
        includedVisits: 4,
        consumedVisits: 2,
        chargeableVisits: 0
      };

      vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(mockAmcDoc as any);

      // Under quota: consumedVisits 2 < 4 -> included consumption
      vi.spyOn(AnnualMaintenanceContract, 'findOneAndUpdate').mockResolvedValueOnce({
        ...mockAmcDoc,
        consumedVisits: 3
      } as any);

      const result1 = await AmcService.consumeVisit(mockAmcDoc._id.toString());
      expect(result1.isChargeable).toBe(false);
      expect(result1.consumedVisits).toBe(3);

      // Over quota: consumedVisits 4 == 4 -> chargeable consumption
      vi.spyOn(AnnualMaintenanceContract, 'findOneAndUpdate')
        .mockResolvedValueOnce(null) // $lt check fails
        .mockResolvedValueOnce({
          ...mockAmcDoc,
          consumedVisits: 4,
          chargeableVisits: 1
        } as any);

      const result2 = await AmcService.consumeVisit(mockAmcDoc._id.toString());
      expect(result2.isChargeable).toBe(true);
      expect(result2.chargeableVisits).toBe(1);
    });

    it('Scenario 2.8: Completing field service visit consumes AMC visit quota and updates complaint status', async () => {
      const mockAmcId = new Types.ObjectId();
      const mockComplaintId = new Types.ObjectId();

      const mockVisitDoc = {
        _id: new Types.ObjectId(),
        visitNumber: 'VST-2026-00001',
        visitType: ServiceVisitType.AMC_PREVENTIVE,
        amcId: mockAmcId,
        complaintId: mockComplaintId,
        status: ServiceVisitStatus.IN_PROGRESS,
        statusHistory: [],
        revisitRequired: false,
        save: vi.fn().mockResolvedValue(true)
      };

      const mockComplaintDoc = {
        _id: mockComplaintId,
        complaintNumber: 'CMP-2026-00001',
        status: ComplaintStatus.VISIT_SCHEDULED,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ServiceVisit, 'findById').mockResolvedValue(mockVisitDoc as any);
      vi.spyOn(ServiceComplaint, 'findById').mockResolvedValue(mockComplaintDoc as any);
      vi.spyOn(AmcService, 'consumeVisit').mockResolvedValue({
        isChargeable: false,
        consumedVisits: 1,
        chargeableVisits: 0
      });

      const auditSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue(null as any);

      const completed = await ServiceVisitService.completeVisit(
        mockVisitDoc._id.toString(),
        {
          workPerformed: 'Completed quarterly electrical inspection and panel washing guidance.',
          meterReadingKwh: 12450,
          inverterStatus: 'NORMAL',
          revisitRequired: false
        },
        technicianActor
      );

      expect(completed.status).toBe(ServiceVisitStatus.COMPLETED);
      expect(completed.isAmcIncluded).toBe(true);
      expect(completed.isChargeable).toBe(false);

      // Verify complaint progressed to IN_PROGRESS
      expect(mockComplaintDoc.status).toBe(ComplaintStatus.IN_PROGRESS);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SERVICE_VISIT_COMPLETED,
          outcome: AuditOutcome.SUCCESS
        })
      );
    });
  });

  // =========================================================================
  // 3. PROCUREMENT & 3-WAY MATCHING (CAPABILITY 3)
  // =========================================================================
  describe('3. Procurement & Vendor 3-Way Matching Engine', () => {
    it('Scenario 2.9: Flags Vendor Invoice as DISPUTED when no Goods Receipt Notes (GRN) exist for PO', async () => {
      const mockVendorDoc = {
        _id: mockVendorId,
        name: 'Havells India Limited',
        vendorCode: 'VND-001'
      };

      const mockPoDoc = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00001',
        vendorId: mockVendorId,
        totalAmountPaise: 11200000, // ₹1,12,000
        subtotalPaise: 10000000,
        totalTaxPaise: 1200000,
        lineItems: [{ productId: mockProductId, unitPricePaise: 1000000, orderedQuantity: 10 }]
      };

      vi.spyOn(Vendor, 'findById').mockResolvedValue(mockVendorDoc as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null); // No duplicate
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(mockPoDoc as any);
      vi.spyOn(GoodsReceipt, 'find').mockResolvedValue([]); // Zero GRNs in warehouse!

      vi.spyOn(VendorInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      const invoice = await VendorInvoiceService.createVendorInvoice(
        {
          vendorInvoiceNumber: 'INV-HAVL-901',
          vendorId: mockVendorId.toString(),
          purchaseOrderId: mockPoDoc._id.toString(),
          invoiceDate: '2026-11-23',
          subtotalPaise: 10000000,
          taxAmountPaise: 1200000,
          totalAmountPaise: 11200000
        },
        adminActor,
        mockContext
      );

      // Must be flagged as DISPUTED due to zero warehouse intake
      expect(invoice.status).toBe(VendorInvoiceStatus.DISPUTED);
      expect(invoice.discrepancyAmountPaise).toBe(11200000);
      expect(invoice.reconciliationNotes).toMatch(/3-Way Match Pending/);
    });

    it('Scenario 2.10: Flags Vendor Invoice as DISPUTED when billed quantity exceeds GRN accepted quantity (Partial delivery)', async () => {
      const mockVendorDoc = {
        _id: mockVendorId,
        name: 'Waaree Solar Technologies',
        vendorCode: 'VND-002'
      };

      const mockPoDoc = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00002',
        vendorId: mockVendorId,
        totalAmountPaise: 22400000, // ₹2,24,000 for 20 modules
        subtotalPaise: 20000000,
        totalTaxPaise: 2400000,
        lineItems: [{ productId: mockProductId, unitPricePaise: 1000000, orderedQuantity: 20 }]
      };

      // GRN delivered only 10 modules accepted (out of 20 ordered)
      const mockGrnDoc = {
        _id: new Types.ObjectId(),
        grnNumber: 'GRN-2026-00001',
        purchaseOrderId: mockPoDoc._id,
        status: GoodsReceiptStatus.COMPLETED,
        lineItems: [
          { productId: mockProductId, orderedQuantity: 20, deliveredQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }
        ]
      };

      vi.spyOn(Vendor, 'findById').mockResolvedValue(mockVendorDoc as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(mockPoDoc as any);
      vi.spyOn(GoodsReceipt, 'find').mockResolvedValue([mockGrnDoc] as any);

      vi.spyOn(VendorInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      // Supplier invoices full 20 modules (₹2,24,000) when only 10 were accepted in warehouse (expected ₹1,12,000)
      const invoice = await VendorInvoiceService.createVendorInvoice(
        {
          vendorInvoiceNumber: 'INV-WAAREE-889',
          vendorId: mockVendorId.toString(),
          purchaseOrderId: mockPoDoc._id.toString(),
          invoiceDate: '2026-11-23',
          subtotalPaise: 20000000,
          taxAmountPaise: 2400000,
          totalAmountPaise: 22400000
        },
        adminActor,
        mockContext
      );

      // Must be flagged as DISPUTED with over-billing discrepancy
      expect(invoice.status).toBe(VendorInvoiceStatus.DISPUTED);
      expect(invoice.discrepancyAmountPaise).toBe(11200000); // ₹1,12,000 over-billing
      expect(invoice.reconciliationNotes).toMatch(/3-Way Match Discrepancy/);
    });

    it('Scenario 2.11: Successfully reconciles Vendor Invoice when billed quantity matches GRN accepted quantities', async () => {
      const mockVendorDoc = {
        _id: mockVendorId,
        name: 'Growatt New Energy',
        vendorCode: 'VND-003'
      };

      const mockPoDoc = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00003',
        vendorId: mockVendorId,
        projectId: mockProjectId, // Project-linked PO
        totalAmountPaise: 8960000, // ₹89,600
        subtotalPaise: 8000000,
        totalTaxPaise: 960000,
        lineItems: [{ productId: mockProductId, unitPricePaise: 8000000, orderedQuantity: 1 }]
      };

      // GRN confirms 1 unit delivered and accepted
      const mockGrnDoc = {
        _id: new Types.ObjectId(),
        grnNumber: 'GRN-2026-00003',
        purchaseOrderId: mockPoDoc._id,
        status: GoodsReceiptStatus.COMPLETED,
        lineItems: [
          { productId: mockProductId, orderedQuantity: 1, deliveredQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }
        ]
      };

      vi.spyOn(Vendor, 'findById').mockResolvedValue(mockVendorDoc as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(mockPoDoc as any);
      vi.spyOn(GoodsReceipt, 'find').mockResolvedValue([mockGrnDoc] as any);

      vi.spyOn(VendorInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        return this;
      });

      const invoice = await VendorInvoiceService.createVendorInvoice(
        {
          vendorInvoiceNumber: 'INV-GROWATT-456',
          vendorId: mockVendorId.toString(),
          purchaseOrderId: mockPoDoc._id.toString(),
          invoiceDate: '2026-11-23',
          subtotalPaise: 8000000,
          taxAmountPaise: 960000,
          totalAmountPaise: 8960000
        },
        adminActor,
        mockContext
      );

      // Reconciled successfully
      expect(invoice.status).toBe(VendorInvoiceStatus.RECONCILED);
      expect(invoice.discrepancyAmountPaise).toBe(0);
      expect(invoice.goodsReceiptIds).toHaveLength(1);
      expect(invoice.projectId).toEqual(mockProjectId);
    });

    it('Scenario 2.12: Rejects disbursement when payment amount exceeds remaining balance payable', async () => {
      const mockInvoiceDoc = {
        _id: new Types.ObjectId(),
        vendorInvoiceNumber: 'INV-2026-00001',
        totalAmountPaise: 5000000, // ₹50,000
        paidAmountPaise: 4000000,  // ₹40,000 already paid
        balancePayablePaise: 1000000, // ₹10,000 remaining
        status: VendorInvoiceStatus.RECONCILED,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(VendorInvoice, 'findById').mockResolvedValue(mockInvoiceDoc as any);

      // Attempting to disburse ₹15,000 when only ₹10,000 is payable -> must be rejected
      await expect(
        VendorInvoiceService.recordPayment(
          mockInvoiceDoc._id.toString(),
          { amountPaise: 1500000, paymentMethod: 'RTGS', paymentReference: 'UTR-HDFC-991823' },
          adminActor,
          mockContext
        )
      ).rejects.toThrow(/exceeds remaining balance/);
    });
  });
});
