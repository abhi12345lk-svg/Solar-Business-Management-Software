import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { VendorService } from '../services/vendorService.js';
import { PurchaseOrderService } from '../services/purchaseOrderService.js';
import { GoodsReceiptService } from '../services/goodsReceiptService.js';
import { VendorInvoiceService } from '../services/vendorInvoiceService.js';
import { Vendor } from '../models/Vendor.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { VendorInvoice } from '../models/VendorInvoice.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { CompanySettings } from '../models/CompanySettings.js';
import {
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  VendorInvoiceStatus,
  UnitOfMeasurement,
  UserRole,
  Department
} from '@ins-solar/shared';

describe('Phase 5B: Procurement, Vendor Management & Goods Receipt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  const mockAdminUser = {
    userId: '507f1f77bcf86cd799439011',
    role: UserRole.ADMIN,
    department: Department.ADMIN
  };

  const mockPurchaserUser = {
    userId: '507f1f77bcf86cd799439022',
    role: UserRole.DEPARTMENT_HEAD,
    department: Department.OPERATIONS
  };

  const mockApproverUser = {
    userId: '507f1f77bcf86cd799439033',
    role: UserRole.ACCOUNTS_OFFICER,
    department: Department.ACCOUNTS
  };

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'vitest-test-agent',
    correlationId: 'test-phase-5b-req'
  };

  describe('1. Vendor Management', () => {
    it('creates a new vendor with auto-generated VEN-YYYY-NNNNN sequential code', async () => {
      vi.spyOn(Vendor, 'findOne').mockResolvedValue(null);
      vi.spyOn(Vendor.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const vendor = await VendorService.createVendor(
        {
          name: 'Adani Solar Tech Ltd',
          contactPerson: 'Karan Patel',
          email: 'karan@adanisolar.com',
          phone: '+919876543210',
          gstin: '24AAACA1234A1Z5',
          paymentTermsDays: 45
        },
        mockPurchaserUser,
        mockContext
      );

      expect(vendor.vendorCode).toMatch(/^VEN-\d{4}-\d{5}$/);
      expect(vendor.name).toBe('Adani Solar Tech Ltd');
      expect(vendor.isActive).toBe(true);
      expect(vendor.hasPurchaseHistory).toBe(false);
    });

    it('rejects duplicate active vendor name and duplicate GSTIN', async () => {
      vi.spyOn(Vendor, 'findOne').mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        name: 'Adani Solar'
      } as any);

      await expect(
        VendorService.createVendor({ name: 'Adani Solar' }, mockPurchaserUser, mockContext)
      ).rejects.toThrow(/already exists/i);

      // Now test duplicate GSTIN
      vi.spyOn(Vendor, 'findOne')
        .mockResolvedValueOnce(null) // name check passes
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), gstin: '24AAACA1234A1Z5' } as any); // gstin check fails

      await expect(
        VendorService.createVendor(
          { name: 'New Brand', gstin: '24AAACA1234A1Z5' },
          mockPurchaserUser,
          mockContext
        )
      ).rejects.toThrow(/GSTIN/i);
    });

    it('deactivates vendor cleanly and blocks hard delete if purchase history exists', async () => {
      const mockVendor = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439044'),
        vendorCode: 'VEN-2026-00001',
        name: 'Waaree Energies Ltd',
        isActive: true,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Vendor, 'findById').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockVendor)
        })
      } as any);

      const deactivated = await VendorService.deactivateVendor(
        '507f1f77bcf86cd799439044',
        mockAdminUser,
        mockContext
      );
      expect(deactivated.isActive).toBe(false);

      // Test delete blockage when PO exists
      vi.spyOn(PurchaseOrder, 'exists').mockResolvedValue(true as any);
      await expect(VendorService.deleteVendor('507f1f77bcf86cd799439044')).rejects.toThrow(
        /Cannot delete vendor with historical purchase orders/i
      );
    });
  });

  describe('2. Purchase Order Creation & Calculation', () => {
    it('creates a Purchase Order with line items, integer paise rates, taxes, and PO sequence', async () => {
      const vendorId = new Types.ObjectId('507f1f77bcf86cd799439044');
      const warehouseId = new Types.ObjectId('507f1f77bcf86cd799439055');
      const productId = new Types.ObjectId('507f1f77bcf86cd799439066');

      vi.spyOn(Vendor, 'findById').mockResolvedValue({
        _id: vendorId,
        isActive: true,
        vendorCode: 'VEN-2026-00001',
        save: vi.fn()
      } as any);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue({
        _id: warehouseId,
        isActive: true
      } as any);
      vi.spyOn(Product, 'findById').mockResolvedValue({
        _id: productId,
        isActive: true,
        sku: 'MOD-550-TOPCON',
        name: '550Wp Mono TopCon Panel',
        uom: UnitOfMeasurement.NOS
      } as any);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
        poApprovalThresholdPaise: 2500000
      } as any);

      vi.spyOn(PurchaseOrder.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const po = await PurchaseOrderService.createPurchaseOrder(
        {
          vendorId: vendorId.toString(),
          destinationWarehouseId: warehouseId.toString(),
          lineItems: [
            {
              productId: productId.toString(),
              orderedQuantity: 10,
              unitPurchaseRatePaise: 1500000, // ₹15,000 per panel = ₹150,000 base
              discountPaise: 0,
              gstRate: 12
            }
          ],
          isInterState: false
        },
        mockPurchaserUser,
        mockContext
      );

      expect(po.poNumber).toMatch(/^PO-\d{4}-\d{5}$/);
      expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
      expect(po.subtotalPaise).toBe(15000000); // ₹1,50,000
      // Intra-state: 6% CGST + 6% SGST = 12% = ₹18,000 = 1,800,000 paise
      expect(po.totalTaxPaise).toBe(1800000);
      expect(po.totalAmountPaise).toBe(16800000); // ₹1,68,000
      expect(po.approval.requiresApproval).toBe(true); // ₹1,68,000 > ₹25,000 threshold
      expect(po.lineItems[0]!.outstandingQuantity).toBe(10);
    });

    it('rejects PO creation with inactive vendor or invalid product', async () => {
      vi.spyOn(Vendor, 'findById').mockResolvedValue({ isActive: false } as any);

      await expect(
        PurchaseOrderService.createPurchaseOrder(
          {
            vendorId: '507f1f77bcf86cd799439044',
            destinationWarehouseId: '507f1f77bcf86cd799439055',
            lineItems: [
              {
                productId: '507f1f77bcf86cd799439066',
                orderedQuantity: 5,
                unitPurchaseRatePaise: 1000
              }
            ]
          },
          mockPurchaserUser,
          mockContext
        )
      ).rejects.toThrow(/inactive or not found/i);
    });
  });

  describe('3. Purchase Approval Workflow & Anti-Self-Approval', () => {
    it('submits PO for approval: auto-approves if under threshold, marks PENDING_APPROVAL if above', async () => {
      // Case A: under threshold
      const smallPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00001',
        totalAmountPaise: 1000000, // ₹10,000 < ₹25,000
        status: PurchaseOrderStatus.DRAFT,
        approval: {},
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(smallPO);
      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
        poApprovalThresholdPaise: 2500000
      } as any);

      const submittedSmall = await PurchaseOrderService.submitForApproval(
        'dummy',
        mockPurchaserUser,
        mockContext
      );
      expect(submittedSmall.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(submittedSmall.approval.requiresApproval).toBe(false);

      // Case B: above threshold
      const largePO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00002',
        totalAmountPaise: 5000000, // ₹50,000 > ₹25,000
        status: PurchaseOrderStatus.DRAFT,
        approval: {},
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(largePO);

      const submittedLarge = await PurchaseOrderService.submitForApproval(
        'dummy',
        mockPurchaserUser,
        mockContext
      );
      expect(submittedLarge.status).toBe(PurchaseOrderStatus.PENDING_APPROVAL);
      expect(submittedLarge.approval.requiresApproval).toBe(true);
    });

    it('enforces anti-self-approval: requester CANNOT approve their own PO', async () => {
      const pendingPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00003',
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        createdBy: new Types.ObjectId(mockPurchaserUser.userId), // created by mockPurchaserUser
        approval: {},
        lineItems: []
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(pendingPO);

      // Same user attempts approval
      await expect(
        PurchaseOrderService.approvePurchaseOrder('dummy', {}, mockPurchaserUser, mockContext)
      ).rejects.toThrow(/Anti-Self-Approval Violation/i);
    });

    it('allows a separate authorized user to approve PO and recalculates totals', async () => {
      const pendingPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00004',
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        createdBy: new Types.ObjectId(mockPurchaserUser.userId), // created by purchaser
        approval: {},
        isInterState: true,
        lineItems: [
          {
            orderedQuantity: 2,
            unitPurchaseRatePaise: 100000,
            discountPaise: 0,
            gstRate: 18,
            taxableAmountPaise: 0,
            totalTaxPaise: 0,
            totalAmountPaise: 0
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(pendingPO);

      // Approved by mockApproverUser (Accounts Officer)
      const approved = await PurchaseOrderService.approvePurchaseOrder(
        'dummy',
        { reason: 'Commercial terms verified' },
        mockApproverUser,
        mockContext
      );
      expect(approved.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(approved.approval.approvedBy).toEqual(new Types.ObjectId(mockApproverUser.userId));
      expect(approved.totalAmountPaise).toBe(236000); // 200,000 base + 18% IGST (36,000)
    });

    it('records rejection with reason and updates status to REJECTED', async () => {
      const pendingPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00005',
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        approval: {},
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(pendingPO);

      const rejected = await PurchaseOrderService.rejectPurchaseOrder(
        'dummy',
        { reason: 'Price exceeds budget allocation' },
        mockApproverUser,
        mockContext
      );
      expect(rejected.status).toBe(PurchaseOrderStatus.REJECTED);
      expect(rejected.approval.rejectionReason).toBe('Price exceeds budget allocation');
    });

    it('allows cancellation before goods receipt but blocks cancellation once goods have been received', async () => {
      // Pre-receipt cancellation: Allowed
      const zeroReceiptPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00006',
        status: PurchaseOrderStatus.APPROVED,
        lineItems: [{ receivedQuantity: 0 }],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(zeroReceiptPO);

      const cancelled = await PurchaseOrderService.cancelPurchaseOrder(
        'dummy',
        'Supplier discontinued SKU',
        mockAdminUser,
        mockContext
      );
      expect(cancelled.status).toBe(PurchaseOrderStatus.CANCELLED);

      // Post-receipt cancellation: Blocked
      const receivedPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00007',
        status: PurchaseOrderStatus.APPROVED,
        lineItems: [{ receivedQuantity: 5 }],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(PurchaseOrderService, 'getPurchaseOrderById').mockResolvedValue(receivedPO);

      await expect(
        PurchaseOrderService.cancelPurchaseOrder('dummy', 'Cancel test', mockAdminUser, mockContext)
      ).rejects.toThrow(/Cannot cancel purchase order.*units have already been received/i);
    });
  });

  describe('4. Goods Receipt Note (GRN) & Stock Ledger Integration', () => {
    it('creates a GRN, validates against approved PO, guards against over-delivery, and updates physical stock balance', async () => {
      const poId = new Types.ObjectId('507f1f77bcf86cd799439077');
      const vendorId = new Types.ObjectId('507f1f77bcf86cd799439044');
      const warehouseId = new Types.ObjectId('507f1f77bcf86cd799439055');
      const productId = new Types.ObjectId('507f1f77bcf86cd799439066');

      const mockPO: any = {
        _id: poId,
        poNumber: 'PO-2026-00008',
        vendorId,
        destinationWarehouseId: warehouseId,
        status: PurchaseOrderStatus.APPROVED,
        lineItems: [
          {
            productId,
            sku: 'INV-10KW-3P',
            productName: '10kW 3-Phase Solar Inverter',
            orderedQuantity: 10,
            receivedQuantity: 0,
            rejectedQuantity: 0,
            outstandingQuantity: 10
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(mockPO);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue({
        _id: warehouseId,
        isActive: true,
        code: 'WH-CENTRAL'
      } as any);
      vi.spyOn(Product, 'findById').mockResolvedValue({
        _id: productId,
        isActive: true,
        sku: 'INV-10KW-3P'
      } as any);

      // Track stock balance calls
      const stockBalanceSpy = vi
        .spyOn(StockBalance, 'findOneAndUpdate')
        .mockResolvedValue({} as any);
      vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue({} as any);
      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(null);
      vi.spyOn(ProductSerialNumber.prototype, 'save').mockResolvedValue({} as any);
      vi.spyOn(GoodsReceipt.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      // Receipt 1: Partial delivery of 6 units (5 accepted, 1 rejected due to dent)
      const grn1 = await GoodsReceiptService.createGoodsReceipt(
        {
          purchaseOrderId: poId.toString(),
          lineItems: [
            {
              productId: productId.toString(),
              deliveredQuantity: 6,
              acceptedQuantity: 5,
              rejectedQuantity: 1,
              rejectionReason: 'Casing dent observed during inspection',
              serialNumbers: ['INV-SN-001', 'INV-SN-002', 'INV-SN-003', 'INV-SN-004', 'INV-SN-005']
            }
          ],
          deliveryChallanNumber: 'DC-9901'
        },
        mockPurchaserUser,
        mockContext
      );

      expect(grn1.grnNumber).toMatch(/^GRN-\d{4}-\d{5}$/);
      expect(grn1.status).toBe(GoodsReceiptStatus.COMPLETED);

      // Verify Stock Balance ONLY incremented for the 5 accepted units, NOT the 1 rejected unit!
      expect(stockBalanceSpy).toHaveBeenCalledWith(
        { productId, warehouseId },
        expect.objectContaining({
          $inc: { onHandQuantity: 5, availableQuantity: 5 }
        }),
        expect.anything()
      );

      // Verify PO state transitioned to PARTIALLY_RECEIVED with 5 outstanding
      expect(mockPO.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
      expect(mockPO.lineItems[0].receivedQuantity).toBe(5);
      expect(mockPO.lineItems[0].rejectedQuantity).toBe(1);
      expect(mockPO.lineItems[0].outstandingQuantity).toBe(5);
    });

    it('rejects GRN if cumulative delivered exceeds ordered quantity (over-delivery guard)', async () => {
      const poId = new Types.ObjectId();
      const mockPO: any = {
        _id: poId,
        poNumber: 'PO-2026-00009',
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
        destinationWarehouseId: new Types.ObjectId(),
        lineItems: [
          {
            productId: new Types.ObjectId('507f1f77bcf86cd799439066'),
            sku: 'INV-10KW-3P',
            orderedQuantity: 10,
            receivedQuantity: 8,
            rejectedQuantity: 0,
            outstandingQuantity: 2
          }
        ]
      };
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(mockPO);
      vi.spyOn(Warehouse, 'findById').mockResolvedValue({ isActive: true } as any);

      // Vendor attempts to deliver 5 units, but only 2 were outstanding (8 + 5 = 13 > 10)
      await expect(
        GoodsReceiptService.createGoodsReceipt(
          {
            purchaseOrderId: poId.toString(),
            lineItems: [
              {
                productId: '507f1f77bcf86cd799439066',
                deliveredQuantity: 5,
                acceptedQuantity: 5,
                rejectedQuantity: 0
              }
            ]
          },
          mockPurchaserUser,
          mockContext
        )
      ).rejects.toThrow(/Over-delivery rejected/i);
    });

    it('rejects GRN against draft, rejected or cancelled purchase order', async () => {
      const draftPO: any = {
        _id: new Types.ObjectId(),
        poNumber: 'PO-2026-00010',
        status: PurchaseOrderStatus.DRAFT
      };
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue(draftPO);

      await expect(
        GoodsReceiptService.createGoodsReceipt(
          {
            purchaseOrderId: 'dummy',
            lineItems: [
              { productId: '507f1f77bcf86cd799439066', deliveredQuantity: 1, acceptedQuantity: 1 }
            ]
          },
          mockPurchaserUser,
          mockContext
        )
      ).rejects.toThrow(/Must be APPROVED or PARTIALLY_RECEIVED/i);
    });

    it('returns existing GRN idempotently on duplicate retry without double-counting inventory', async () => {
      const existingGRN: any = {
        _id: new Types.ObjectId(),
        grnNumber: 'GRN-2026-00001',
        idempotencyKey: 'idemp-grn-1234'
      };
      vi.spyOn(GoodsReceipt, 'findOne').mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue(existingGRN)
          })
        })
      } as any);

      const stockBalanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');

      const grn = await GoodsReceiptService.createGoodsReceipt(
        {
          purchaseOrderId: 'dummy',
          idempotencyKey: 'idemp-grn-1234',
          lineItems: [
            { productId: '507f1f77bcf86cd799439066', deliveredQuantity: 5, acceptedQuantity: 5 }
          ]
        },
        mockPurchaserUser,
        mockContext
      );

      expect(grn.grnNumber).toBe('GRN-2026-00001');
      expect(stockBalanceSpy).not.toHaveBeenCalled(); // zero inventory mutation on idempotent retry
    });
  });

  describe('5. Vendor Invoice & 3-Way Match Reconciliation', () => {
    it('registers vendor invoice, rejects duplicates for same vendor, and marks RECONCILED on exact match', async () => {
      const vendorId = new Types.ObjectId('507f1f77bcf86cd799439044');
      const poId = new Types.ObjectId('507f1f77bcf86cd799439088');

      vi.spyOn(Vendor, 'findById').mockResolvedValue({
        _id: vendorId,
        name: 'Waaree Energies',
        vendorCode: 'VEN-2026-00001'
      } as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue({
        _id: poId,
        totalAmountPaise: 11200000
      } as any); // PO value = ₹112,000

      vi.spyOn(VendorInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const invoice = await VendorInvoiceService.createVendorInvoice(
        {
          vendorId: vendorId.toString(),
          purchaseOrderId: poId.toString(),
          vendorInvoiceNumber: 'INV-WAR-9901',
          invoiceDate: new Date().toISOString(),
          subtotalPaise: 10000000,
          taxAmountPaise: 1200000,
          totalAmountPaise: 11200000 // exactly matches PO!
        },
        mockApproverUser,
        mockContext
      );

      expect(invoice.vendorInvoiceNumber).toBe('INV-WAR-9901');
      expect(invoice.status).toBe(VendorInvoiceStatus.RECONCILED);
      expect(invoice.discrepancyAmountPaise).toBe(0);
      expect(invoice.balancePayablePaise).toBe(11200000);
      expect(invoice.paidAmountPaise).toBe(0); // scope invariant: never automatically mark as paid
    });

    it('detects 3-way match price discrepancy and flags invoice status as DISPUTED', async () => {
      const vendorId = new Types.ObjectId('507f1f77bcf86cd799439044');
      const poId = new Types.ObjectId('507f1f77bcf86cd799439088');

      vi.spyOn(Vendor, 'findById').mockResolvedValue({
        _id: vendorId,
        name: 'Waaree Energies'
      } as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue(null);
      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue({
        _id: poId,
        totalAmountPaise: 10000000
      } as any); // PO = ₹100,000

      vi.spyOn(VendorInvoice.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      // Vendor billed ₹105,000 instead of agreed ₹100,000
      const invoice = await VendorInvoiceService.createVendorInvoice(
        {
          vendorId: vendorId.toString(),
          purchaseOrderId: poId.toString(),
          vendorInvoiceNumber: 'INV-WAR-9902',
          invoiceDate: new Date().toISOString(),
          subtotalPaise: 9500000,
          taxAmountPaise: 1000000,
          totalAmountPaise: 10500000
        },
        mockApproverUser,
        mockContext
      );

      expect(invoice.status).toBe(VendorInvoiceStatus.DISPUTED);
      expect(invoice.discrepancyAmountPaise).toBe(500000); // ₹5,000 discrepancy
      expect(invoice.reconciliationNotes).toMatch(/3-Way Match Discrepancy/i);
    });

    it('rejects duplicate invoice submission for the same vendor', async () => {
      vi.spyOn(Vendor, 'findById').mockResolvedValue({
        _id: new Types.ObjectId(),
        name: 'Waaree'
      } as any);
      vi.spyOn(VendorInvoice, 'findOne').mockResolvedValue({ _id: new Types.ObjectId() } as any);

      await expect(
        VendorInvoiceService.createVendorInvoice(
          {
            vendorId: '507f1f77bcf86cd799439044',
            vendorInvoiceNumber: 'DUPLICATE-BILL-1',
            invoiceDate: new Date().toISOString(),
            subtotalPaise: 1000,
            taxAmountPaise: 100,
            totalAmountPaise: 1100
          },
          mockApproverUser,
          mockContext
        )
      ).rejects.toThrow(/already been registered/i);
    });
  });

  describe('6. REST Endpoints & Authorization Security', () => {
    it('enforces authentication and authorization on procurement routes', async () => {
      const app = createApp();

      // Unauthenticated access
      const unauthRes = await request(app).get('/api/v1/vendors');
      expect(unauthRes.status).toBe(401);

      const unauthPORes = await request(app).get('/api/v1/purchase-orders');
      expect(unauthPORes.status).toBe(401);

      const unauthGRNRes = await request(app).get('/api/v1/goods-receipts');
      expect(unauthGRNRes.status).toBe(401);

      const unauthVInvRes = await request(app).get('/api/v1/vendor-invoices');
      expect(unauthVInvRes.status).toBe(401);
    });
  });
});
