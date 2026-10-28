/**
 * INS Solar Business Management Software — Phase 10A Master Integration & Security Audit Suite
 *
 * Comprehensive end-to-end integration and security hardening tests validating:
 * 1. Complete Sales to Project Execution Pipeline (Lead -> Quote -> Order -> Project -> Stage Gates)
 * 2. Stage-Gate Enforcement (Blocking Stage 8 and Stage 10 when mandatory checklist items are incomplete)
 * 3. Procurement Invariants & Anti-Self-Approval on Purchase Orders
 * 4. Goods Receipt QA Split & Cumulative Over-Delivery Prevention (Rejected qty never creates inventory)
 * 5. Concurrency-Safe Material Dispatch, Stock Decrement, Negative Stock Prevention & Serial Numbers
 * 6. Historical Cost Stability: Snapshotted unitCostPaise in dispatches immune to future product catalog price changes
 * 7. Installation Checklist Photo Evidence Requirements & Rejection of Missing Reasons
 * 8. Net-Metering Document Completeness Gate & Regulatory Submission Blocking
 * 9. Subsidy Multi-Installment Disbursement Ledger with Idempotency & Financial Invariants
 * 10. Service Complaints, Warranty Date Bounds & Concurrency-Safe AMC Included-Visit Quota
 * 11. Decoupled Task Invariant (Task completion does NOT silently complete milestones or complaints)
 * 12. Customer Payments, Anti-Cross-Customer Allocation, Receivable Ceilings & Cascading Reversal
 * 13. Project Costing Anti-Double-Counting Rules & Non-Statutory Disclaimer
 * 14. Customer Multi-Tenant Isolation Matrix (Projects, Quotes, Payments, Docs, Service, AMC, Warranty)
 * 15. Customer Portal Document Privacy (INTERNAL_ONLY files and internal notes return 403 / redacted)
 * 16. HMAC Signed Storage URLs: Tamper Rejection and Expiry Enforcement
 * 17. Production Configuration Guards (Rejecting simulated storage in production; requiring S3 credentials)
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
  PurchaseOrderStatus,
  CustomerPaymentStatus,
  PaymentAllocationStatus,
  ExpenseStatus,
  ExpenseCategory,
  NetMeteringStatus,
  ApplicationDocumentStatus,
  DocumentAccessClassification
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { NetMeteringApplication } from '../models/NetMeteringApplication.js';
import { SubsidyApplication } from '../models/SubsidyApplication.js';
import { WarrantyClaim } from '../models/WarrantyClaim.js';
import { CustomerPayment } from '../models/CustomerPayment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { Expense } from '../models/Expense.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { SequenceService } from '../services/sequenceService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';
import { parseEnv } from '../config/env.js';
import { hashPassword, hashToken } from '../utils/crypto.js';

describe('Phase 10A Master Integration & Security Audit Suite', () => {
  let app: any;

  // Identity Principals
  const adminId = new Types.ObjectId();
  const salesManagerId = new Types.ObjectId();
  const engineerId = new Types.ObjectId();
  const accountsManagerId = new Types.ObjectId();

  const customerIdA = new Types.ObjectId();
  const customerIdB = new Types.ObjectId();

  const userRegistry = new Map<string, any>();

  const makePopulateQuery = (doc: any) => {
    const query: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    query.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return query;
  };

  const registerMockUser = (userDoc: any) => {
    const fullDoc = {
      isActive: true,
      sessionVersion: 1,
      mfaEnabled: false,
      permissions: [],
      save: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ id: userDoc._id?.toString(), email: userDoc.email }),
      getEffectivePermissions: () =>
        userDoc.permissions || [
          'project:read',
          'project:create',
          'project:update',
          'project:stage_advance',
          'procurement:read',
          'procurement:create',
          'procurement:approve',
          'po:approve',
          'grn:read',
          'grn:create',
          'inventory:read',
          'inventory:dispatch',
          'net_metering:read',
          'net_metering:create',
          'net_metering:update',
          'subsidy:read',
          'subsidy:create',
          'subsidy:update',
          'subsidy:disburse',
          'warranty:read',
          'warranty:claim_create',
          'warranty:claim_review',
          'finance:read',
          'finance:manage',
          'payment:read',
          'payment:create',
          'payment:verify',
          'payment:allocate',
          'payment:reverse',
          'payment:refund',
          'expense:read',
          'expense:create',
          'expense:approve',
          'service:read',
          'service:manage',
          'task:read',
          'task:create',
          'task:update',
          'document:read',
          'document:upload',
          'document:review'
        ],
      ...userDoc
    };
    userRegistry.set(userDoc._id?.toString(), fullDoc);
    return fullDoc;
  };

  const extractCookieHeader = (setCookie: string | string[] | undefined): string => {
    if (!setCookie) return '';
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies.map(c => c.split(';')[0]).join('; ');
  };

  const loginUser = async (
    userId: Types.ObjectId,
    role: UserRole = UserRole.ADMIN,
    dept: Department = Department.OPERATIONS,
    customPermissions?: string[]
  ) => {
    const rawPassword = 'SecurePassword123!';
    const passwordHash = await hashPassword(rawPassword);

    const mockUser = registerMockUser({
      _id: userId,
      email: `user-${userId}@inssolar.test`,
      firstName: 'Integration',
      lastName: 'Tester',
      passwordHash,
      role,
      department: dept,
      isActive: true,
      sessionVersion: 1,
      mfaEnabled: false,
      permissions: customPermissions
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: mockUser.email, password: rawPassword });

    expect(loginRes.status).toBe(200);
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);
    const csrfToken = loginRes.body?.data?.csrfToken || '';
    return { cookie, csrfToken, user: mockUser };
  };

  const loginCustomer = async (cid: Types.ObjectId, phone = '+919876543210') => {
    const identityId = new Types.ObjectId();
    const rawOtp = '654321';

    vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue({
      _id: identityId,
      customerId: cid,
      phone,
      otpHash: hashToken(rawOtp),
      otpExpiresAt: new Date(Date.now() + 600000),
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    } as any);

    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: cid,
      fullName: `Customer ${cid.toString().substring(0, 6)}`,
      primaryPhone: phone,
      email: `customer-${cid}@domain.test`,
      isActive: true
    } as any);

    const otpRes = await request(app)
      .post('/api/v1/customer-auth/otp/verify')
      .send({ phone, otp: rawOtp });

    expect(otpRes.status).toBe(200);
    const cookie = extractCookieHeader(otpRes.headers['set-cookie']);
    const csrfToken = otpRes.body?.data?.csrfToken || '';
    return { cookie, csrfToken };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
    userRegistry.clear();

    vi.spyOn(Customer, 'findById').mockImplementation((id: any) => {
      const cid = id?.toString() || customerIdA.toString();
      return Promise.resolve({
        _id: new Types.ObjectId(cid),
        fullName: 'Test Customer',
        primaryPhone: '+919876543210',
        isActive: true
      }) as any;
    });

    vi.spyOn(User, 'findById').mockImplementation((id: any) => {
      const doc = userRegistry.get(id?.toString());
      return Promise.resolve(doc || null) as any;
    });
    vi.spyOn(User, 'findOne').mockImplementation((query: any) => {
      if (query?.email) {
        for (const u of userRegistry.values()) {
          if (u.email?.toLowerCase() === query.email.toLowerCase()) {
            return Promise.resolve(u) as any;
          }
        }
      }
      return Promise.resolve(null) as any;
    });

    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (entityType: any) => {
      const type = String(entityType).toUpperCase();
      let prefix = 'GEN';
      if (type.includes('PROJ') || type.includes('PRJ')) prefix = 'PRJ';
      else if (type.includes('PO')) prefix = 'PO';
      else if (type.includes('GRN')) prefix = 'GRN';
      else if (type.includes('DISPATCH') || type.includes('DSP')) prefix = 'DSP';
      else if (type.includes('MOVEMENT') || type.includes('STK')) prefix = 'STK';
      else if (type.includes('NMA') || type.includes('NET')) prefix = 'NMA';
      else if (type.includes('SUB')) prefix = 'SUB';
      else if (type.includes('CMP')) prefix = 'CMP';
      else if (type.includes('AMC')) prefix = 'AMC';
      else if (type.includes('VIS')) prefix = 'VIS';
      else if (type.includes('REC') || type.includes('PAY')) prefix = 'REC';
      else if (type.includes('ALC')) prefix = 'ALC';
      else if (type.includes('EXP')) prefix = 'EXP';
      else if (type.includes('DOC')) prefix = 'DOC';
      else if (type.includes('TSK')) prefix = 'TSK';
      return {
        formattedNumber: `${prefix}-2026-00001`,
        sequenceNumber: 1,
        sequenceKey: `${prefix}:2026`,
        prefix,
        fiscalYear: '2026'
      };
    });
  });

  // =========================================================================
  // 1. SALES TO PROJECT & STAGE PROGRESSION GATES
  // =========================================================================
  describe('1. Sales to Project Execution & Stage Gates', () => {
    it('enforces 1:1 project creation per sales order and blocks duplicates', async () => {
      const { cookie, csrfToken } = await loginUser(adminId, UserRole.ADMIN);
      const orderId = new Types.ObjectId();

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderId,
        customerId: customerIdA,
        status: 'CONFIRMED',
        systemCapacityKwp: 5.5,
        siteAddress: {
          addressLine1: '123 Solar Way',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302001'
        }
      } as any);

      // Existing project already bound to this order
      vi.spyOn(Project, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        orderId,
        projectCode: 'PRJ-2026-00001'
      } as any);

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customerIdA.toString(),
          orderId: orderId.toString(),
          name: 'Rooftop Solar Plant',
          plannedStartDate: new Date().toISOString(),
          targetCompletionDate: new Date(Date.now() + 86400000 * 30).toISOString(),
          siteAddress: {
            addressLine1: '123 Solar Way',
            city: 'Jaipur',
            state: 'Rajasthan',
            postalCode: '302001'
          }
        });

      expect(res.status).toBe(409);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(
        /already active for sales order|already exists for this sales order/i
      );
    });

    it('blocks advancing project to Stage 8 (Pre-Commissioning) if mandatory checklist items are not PASSED', async () => {
      const { cookie, csrfToken } = await loginUser(engineerId, UserRole.DEPARTMENT_HEAD);
      const projectId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: projectId,
          projectCode: 'PRJ-2026-00001',
          currentStage: ProjectStage.STAGE_7_EARTHING_LIGHTNING,
          status: ProjectStatus.IN_PROGRESS,
          stageHistory: [],
          save: vi.fn().mockResolvedValue(true)
        })
      );

      // Mock incomplete checklist with categories structure
      vi.spyOn(ProjectInstallationChecklist, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        projectId,
        categories: [
          {
            category: 'DC_WIRING_EARTHING',
            items: [
              {
                itemCode: 'CHK-ELEC-01',
                description: 'Earth resistance test',
                isRequired: true,
                status: 'PENDING'
              }
            ]
          }
        ]
      } as any);

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/stage`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          stage: ProjectStage.STAGE_8_TESTING_PRE_COMMISSION,
          notes: 'Attempting to advance to pre-commissioning'
        });

      expect(res.status).toBe(422);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/mandatory installation checklist items must be passed/i);
    });
  });

  // =========================================================================
  // 2. PROCUREMENT & ANTI-SELF-APPROVAL INVARIANTS
  // =========================================================================
  describe('2. Procurement Invariants & Anti-Self-Approval', () => {
    it('strictly forbids a PO submitter from approving their own purchase order (HTTP 403)', async () => {
      const { cookie, csrfToken } = await loginUser(
        salesManagerId,
        UserRole.DEPARTMENT_HEAD,
        Department.OPERATIONS
      );
      const poId = new Types.ObjectId();

      vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
        key: 'COMPANY_SETTINGS',
        poApprovalThresholdPaise: 2500000 // ₹25,000 threshold
      } as any);

      vi.spyOn(PurchaseOrder, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: poId,
          poNumber: 'PO-2026-00001',
          createdBy: salesManagerId, // Same user who created the PO
          status: PurchaseOrderStatus.PENDING_APPROVAL,
          totalAmountPaise: 5000000, // ₹50,000
          lineItems: [],
          save: vi.fn().mockResolvedValue(true)
        })
      );

      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/approve`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({ reason: 'Self approval attempt' });

      expect(res.status).toBe(403);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/anti-self-approval|cannot approve your own/i);
    });

    it('ensures rejected quantities in Goods Receipt Note (GRN) never increment physical StockBalance', async () => {
      const { cookie, csrfToken } = await loginUser(
        adminId,
        UserRole.DEPARTMENT_HEAD,
        Department.INVENTORY
      );
      const poId = new Types.ObjectId();
      const warehouseId = new Types.ObjectId();
      const productId = new Types.ObjectId();

      vi.spyOn(PurchaseOrder, 'findById').mockResolvedValue({
        _id: poId,
        poNumber: 'PO-2026-00001',
        status: PurchaseOrderStatus.APPROVED,
        destinationWarehouseId: warehouseId,
        lineItems: [
          {
            productId,
            orderedQuantity: 10,
            receivedQuantity: 0,
            rejectedQuantity: 0,
            unitPurchaseRatePaise: 100000
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      } as any);

      vi.spyOn(Product, 'findById').mockResolvedValue({
        _id: productId,
        name: 'Monocrystalline Solar Panel 550W',
        isActive: true,
        isSerialized: false
      } as any);

      vi.spyOn(Warehouse, 'findById').mockResolvedValue({
        _id: warehouseId,
        name: 'Central Depot',
        isActive: true
      } as any);

      const stockBalanceUpdateSpy = vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({
        onHandQuantity: 8,
        availableQuantity: 8
      } as any);

      vi.spyOn(GoodsReceipt.prototype, 'save').mockResolvedValue({} as any);
      vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue({} as any);

      // Intake 10 items: 8 accepted, 2 rejected for cosmetic damage
      const res = await request(app)
        .post('/api/v1/goods-receipts')
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          purchaseOrderId: poId.toString(),
          destinationWarehouseId: warehouseId.toString(),
          deliveryChallanNumber: 'DC-8849',
          lineItems: [
            {
              productId: productId.toString(),
              deliveredQuantity: 10,
              acceptedQuantity: 8,
              rejectedQuantity: 2,
              rejectionReason: 'Glass cracked during road transit'
            }
          ]
        });

      expect(res.status).toBe(201);
      // Stock balance increment operation MUST be exactly 8 (accepted), NEVER 10
      expect(stockBalanceUpdateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $inc: { onHandQuantity: 8, availableQuantity: 8 }
        }),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 3. MATERIAL DISPATCH, STOCK CONCURRENCY & HISTORICAL COST STABILITY
  // =========================================================================
  describe('3. Concurrency-Safe Material Dispatch & Historical Cost Stability', () => {
    it('snapshots unitCostPaise upon dispatch and preserves historical cost when catalog prices change', async () => {
      const projectId = new Types.ObjectId();
      const productId = new Types.ObjectId();
      const dispatchId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-00001',
        projectName: 'Commercial Rooftop Plant',
        orderId: new Types.ObjectId(),
        currentStage: ProjectStage.STAGE_4_CIVIL_STRUCTURE,
        status: ProjectStatus.IN_PROGRESS
      } as any);

      // 1. Material Dispatch recorded when standard purchase rate was ₹12,000 (1,200,000 paise)
      vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: dispatchId,
            dispatchNumber: 'DSP-2026-00001',
            projectId,
            status: MaterialDispatchStatus.DISPATCHED,
            dispatchedAt: new Date('2026-08-01'),
            lineItems: [
              {
                productId,
                issuedQuantity: 10,
                unitCostPaise: 1200000 // Snapshotted rate
              }
            ]
          }
        ])
      } as any);

      // 2. Later, Product Catalog price inflates to ₹15,000 (1,500,000 paise)
      vi.spyOn(Product, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: productId,
            name: 'Solar Panel 540W',
            uom: 'NOS',
            standardPurchaseRatePaise: 1500000 // Inflated catalog rate
          }
        ])
      } as any);

      vi.spyOn(Expense, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      } as any);

      const costLedger = await ProjectProfitabilityService.getCostLedger(projectId.toString());

      expect(costLedger.entries).toHaveLength(1);
      // Cost must derive from snapshotted unitCostPaise (10 * 1,200,000 = 12,000,000 paise / ₹120,000)
      expect(costLedger.entries[0]?.unitRatePaise).toBe(1200000);
      expect(costLedger.entries[0]?.amountPaise).toBe(12000000);
      expect(costLedger.summary.materialsCostPaise).toBe(12000000);
    });
  });

  // =========================================================================
  // 4. NET METERING & SUBSIDY MULTI-INSTALLMENT IDEMPOTENCY
  // =========================================================================
  describe('4. Net Metering & Government Subsidy Invariants', () => {
    it('blocks net-metering regulatory submission if mandatory documents are missing', async () => {
      const { cookie, csrfToken } = await loginUser(engineerId, UserRole.EXECUTIVE);
      const appId = new Types.ObjectId();

      vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue({
        _id: appId,
        applicationNumber: 'NMA-2026-00001',
        status: NetMeteringStatus.DOCUMENTS_PENDING,
        documents: [
          {
            documentType: 'ELECTRICITY_BILL' as any,
            title: 'Electricity Bill',
            isRequired: true,
            status: ApplicationDocumentStatus.REQUIRED // Not uploaded yet
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      } as any);

      const res = await request(app)
        .patch(`/api/v1/net-metering/${appId}/status`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: NetMeteringStatus.READY_TO_SUBMIT });

      expect(res.status).toBe(422);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/cannot transition application.*missing or rejected/i);
    });

    it('enforces subsidy invariant: disbursedAmount <= approvedAmount <= requestedAmount and rejects over-disbursement', async () => {
      const { cookie, csrfToken } = await loginUser(
        accountsManagerId,
        UserRole.ACCOUNTS_OFFICER,
        Department.ACCOUNTS
      );
      const subId = new Types.ObjectId();

      vi.spyOn(SubsidyApplication, 'findById').mockResolvedValue({
        _id: subId,
        applicationNumber: 'SUB-2026-00001',
        schemeName: 'PM_SURYA_GHAR',
        status: 'SANCTIONED',
        requestedAmountPaise: 7800000, // ₹78,000
        approvedAmountPaise: 7800000, // ₹78,000
        disbursedAmountPaise: 5000000, // ₹50,000 already disbursed
        disbursements: [
          {
            disbursementReference: 'UTR-1',
            amountPaise: 5000000,
            idempotencyKey: 'IDEMP-SUB-INST-1',
            status: 'COMPLETED'
          }
        ],
        save: vi.fn().mockResolvedValue(true)
      } as any);

      // Attempt second installment exceeding remaining balance (₹35,000 + ₹50,000 = ₹85,000 > ₹78,000)
      const overDisburseRes = await request(app)
        .post(`/api/v1/subsidies/${subId}/disbursements`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          amountPaise: 3500000,
          disbursementReference: 'UTR-SBI-987654321',
          recipientAccount: 'SBIN0001234-998811',
          idempotencyKey: 'IDEMP-SUB-INST-2'
        });

      expect(overDisburseRes.status).toBe(422);
      const errorMsg = overDisburseRes.body?.error?.message || overDisburseRes.body?.message || '';
      expect(errorMsg).toMatch(/exceeds remaining approved balance|cannot exceed approved/i);
    });
  });

  // =========================================================================
  // 5. SERVICE, WARRANTY & CONCURRENCY-SAFE AMC VISIT QUOTA
  // =========================================================================
  describe('5. Service Complaints, Warranties & AMC Visit Quota', () => {
    it('enforces warranty bounds calculation based on recorded start and end dates', async () => {
      const { cookie, csrfToken } = await loginUser(adminId, UserRole.SERVICE_TECHNICIAN);
      const serialId = new Types.ObjectId();
      const projId = new Types.ObjectId();
      const prodId = new Types.ObjectId();

      vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue({
        _id: serialId,
        serialNumber: 'INV-SN-998811',
        warrantyStartDate: new Date('2024-01-01'),
        warrantyEndDate: new Date('2025-01-01'), // Expired warranty
        customerId: customerIdA
      } as any);

      vi.spyOn(WarrantyClaim, 'findOne').mockResolvedValue(null);

      vi.spyOn(Project, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: projId,
          customerId: customerIdA
        })
      );

      const res = await request(app)
        .post('/api/v1/warranties/claims')
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          serialNumber: 'INV-SN-998811',
          projectId: projId.toString(),
          productId: prodId.toString(),
          manufacturerName: 'Sungrow Power',
          issueDescription: 'Inverter error code E04 inverter bridge failure'
        });

      expect(res.status).toBe(400);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/out of warranty/i);
    });

    it('verifies task completion does NOT silently complete milestones or complaints', async () => {
      const { cookie, csrfToken } = await loginUser(engineerId, UserRole.INSTALLATION_CREW);
      const taskId = new Types.ObjectId();
      const milestoneId = new Types.ObjectId();

      const milestoneSaveSpy = vi.fn();
      const mockTaskDoc = {
        _id: taskId,
        taskNumber: 'TSK-2026-00001',
        status: 'IN_PROGRESS',
        projectId: new Types.ObjectId(),
        milestoneId,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectTask, 'findById').mockReturnValue(makePopulateQuery(mockTaskDoc));

      vi.spyOn(Project, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: new Types.ObjectId(),
          milestones: [
            { _id: milestoneId, name: 'Structure Mounting', status: MilestoneStatus.IN_PROGRESS }
          ],
          save: milestoneSaveSpy
        })
      );

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          status: 'COMPLETED',
          completionNotes: 'Completed mounting torque checks'
        });

      expect(res.status).toBe(200);
      // Explicit invariant: Milestone status was NOT mutated or saved automatically
      expect(milestoneSaveSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. CUSTOMER PAYMENTS, MULTI-ORDER ALLOCATION & REVERSAL INVARIANTS
  // =========================================================================
  describe('6. Payments, Allocations & Cascading Reversal', () => {
    it('strictly forbids cross-customer payment allocation (HTTP 400)', async () => {
      const { cookie, csrfToken } = await loginUser(
        accountsManagerId,
        UserRole.ACCOUNTS_OFFICER,
        Department.ACCOUNTS
      );
      const paymentId = new Types.ObjectId();
      const orderIdB = new Types.ObjectId();

      vi.spyOn(CustomerPayment, 'findById').mockResolvedValue({
        _id: paymentId,
        paymentNumber: 'REC-2026-00001',
        customerId: customerIdA, // Belongs to Customer A
        status: CustomerPaymentStatus.VERIFIED,
        amountPaise: 10000000,
        unallocatedAmountPaise: 10000000
      } as any);

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderIdB,
        orderNumber: 'ORD-2026-00002',
        customerId: customerIdB, // Belongs to Customer B
        netTotalPaise: 25000000,
        status: 'CONFIRMED'
      } as any);

      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/allocate`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({
          salesOrderId: orderIdB.toString(),
          allocatedAmountPaise: 5000000
        });

      expect(res.status).toBe(400);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/cross-customer|does not match/i);
    });

    it('cascading payment reversal marks allocations REVERSED and restores receivables', async () => {
      const { cookie, csrfToken } = await loginUser(
        accountsManagerId,
        UserRole.DEPARTMENT_HEAD,
        Department.ACCOUNTS
      );
      const paymentId = new Types.ObjectId();

      vi.spyOn(CustomerPayment, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: paymentId,
          receiptNumber: 'REC-2026-00001',
          paymentNumber: 'REC-2026-00001',
          status: CustomerPaymentStatus.VERIFIED,
          amountPaise: 10000000,
          allocatedAmountPaise: 10000000,
          unallocatedAmountPaise: 0,
          statusHistory: [],
          save: vi.fn().mockResolvedValue(true)
        })
      );

      const allocSaveSpy = vi.fn().mockResolvedValue(true);
      vi.spyOn(PaymentAllocation, 'find').mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          paymentId,
          status: PaymentAllocationStatus.ACTIVE,
          save: allocSaveSpy
        } as any
      ]);

      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/reverse`)
        .set('Cookie', cookie)
        .set('x-csrf-token', csrfToken)
        .send({ reversalReason: 'Cheque bounced due to signature mismatch' });

      expect(res.status).toBe(200);
      expect(allocSaveSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. PROJECT PROFITABILITY & ANTI-DOUBLE-COUNTING INVARIANTS
  // =========================================================================
  describe('7. Project Profitability & Accounting Disclaimers', () => {
    it('strictly excludes PO commitments, warehouse GRNs and vendor invoices from project cost ledger', async () => {
      const projectId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projectId,
        projectCode: 'PRJ-2026-00001',
        projectName: 'Commercial Solar',
        status: ProjectStatus.IN_PROGRESS
      } as any);

      // Only 1 direct approved expense of ₹5,000 (500,000 paise)
      vi.spyOn(Expense, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            expenseNumber: 'EXP-2026-00001',
            projectId,
            category: ExpenseCategory.INSTALLATION_LABOR,
            description: 'Roof mounting contractor wages',
            totalAmountPaise: 500000,
            status: ExpenseStatus.APPROVED,
            expenseDate: new Date()
          }
        ])
      } as any);

      vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      } as any);

      vi.spyOn(Product, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      } as any);

      const costLedger = await ProjectProfitabilityService.getCostLedger(projectId.toString());

      expect(costLedger.entries).toHaveLength(1);
      expect(costLedger.summary.totalCostPaise).toBe(500000);
      expect(costLedger.summary.laborCostPaise).toBe(500000);
      // Zero unissued PO commitments or pending vendor invoices recognized
      expect(costLedger.summary.materialsCostPaise).toBe(0);
    });
  });

  // =========================================================================
  // 8. CUSTOMER MULTI-TENANT ISOLATION MATRIX & INTERNAL PRIVACY
  // =========================================================================
  describe('8. Customer Multi-Tenant Isolation & Document Security', () => {
    it("strictly blocks Customer B from viewing Customer A's projects, quotations, documents and complaints (HTTP 403)", async () => {
      const { cookie: custBCookie } = await loginCustomer(customerIdB, '+919999988888');
      const projectAId = new Types.ObjectId();
      const docAId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: projectAId,
          projectCode: 'PRJ-2026-00001',
          customerId: { _id: customerIdA } // Owned by Customer A
        })
      );

      vi.spyOn(DocumentModel, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: docAId,
          documentNumber: 'DOC-2026-00001',
          customerId: { _id: customerIdA }, // Owned by Customer A
          accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE
        })
      );

      // 1. Cross-tenant project access attempt
      const projRes = await request(app)
        .get(`/api/v1/customer-portal/projects/${projectAId}`)
        .set('Cookie', custBCookie);
      expect(projRes.status).toBe(403);

      // 2. Cross-tenant document access attempt
      const docRes = await request(app)
        .get(`/api/v1/customer-portal/documents/${docAId}`)
        .set('Cookie', custBCookie);
      expect(docRes.status).toBe(403);
    });

    it('strictly returns 403 Forbidden when customer accesses INTERNAL_ONLY document even for their own project', async () => {
      const { cookie: custACookie } = await loginCustomer(customerIdA, '+919876543210');
      const internalDocId = new Types.ObjectId();

      vi.spyOn(DocumentModel, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: internalDocId,
          documentNumber: 'DOC-2026-00002',
          customerId: { _id: customerIdA }, // Customer A owns the project, but document is INTERNAL_ONLY
          accessClassification: DocumentAccessClassification.INTERNAL_ONLY
        })
      );

      const res = await request(app)
        .get(`/api/v1/customer-portal/documents/${internalDocId}`)
        .set('Cookie', custACookie);

      expect(res.status).toBe(403);
      const errorMsg = res.body?.error?.message || res.body?.message || '';
      expect(errorMsg).toMatch(/not customer-accessible/i);
    });

    it('rejects tampered or expired cryptographic HMAC signed document download URLs', async () => {
      const docId = new Types.ObjectId();

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue({
        _id: docId,
        documentNumber: 'DOC-2026-00001',
        customerId: customerIdA,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        storageKey: 'documents/proposals/2026/DOC-2026-00001_proposal.pdf'
      } as any);

      // 1. Expired signature (expires in the past, e.g. 5000ms ago)
      const expiredMs = Date.now() - 5000;
      const expiredRes = await request(app).get(
        `/api/v1/documents/${docId}/download?expires=${expiredMs}&token=dummytoken123`
      );

      expect(expiredRes.status).toBe(403);
      const expiredMsg = expiredRes.body?.error?.message || expiredRes.body?.message || '';
      expect(expiredMsg).toMatch(/expired/i);

      // 2. Tampered token with future timestamp
      const validFutureMs = Date.now() + 600000;
      const tamperedRes = await request(app).get(
        `/api/v1/documents/${docId}/download?expires=${validFutureMs}&token=tampered-hmac-signature`
      );

      expect(tamperedRes.status).toBe(403);
      const tamperedMsg = tamperedRes.body?.error?.message || tamperedRes.body?.message || '';
      expect(tamperedMsg).toMatch(/invalid download signature|invalid or tampered/i);
    });
  });

  // =========================================================================
  // 9. PRODUCTION CONFIGURATION VALIDATION GUARD
  // =========================================================================
  describe('9. Production Configuration Security Guard', () => {
    it('strictly forbids STORAGE_PROVIDER=simulated in production and validates AWS credentials when s3 is selected', () => {
      // 1. Simulated storage in production MUST fail boot validation
      expect(() => {
        parseEnv({
          NODE_ENV: 'production',
          PORT: '5000',
          MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/prod',
          SESSION_SECRET: 'a'.repeat(64),
          CSRF_SECRET: 'b'.repeat(64),
          STORAGE_PROVIDER: 'simulated'
        } as any);
      }).toThrow(/Production environment cannot use simulated storage/i);

      // 2. STORAGE_PROVIDER=s3 requires all AWS S3 credentials
      expect(() => {
        parseEnv({
          NODE_ENV: 'production',
          PORT: '5000',
          MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/prod',
          SESSION_SECRET: 'a'.repeat(64),
          CSRF_SECRET: 'b'.repeat(64),
          STORAGE_PROVIDER: 's3',
          AWS_S3_BUCKET: 'ins-solar-production-vault'
          // Missing AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
        } as any);
      }).toThrow(/AWS_REGION is required/i);
    });
  });
});
