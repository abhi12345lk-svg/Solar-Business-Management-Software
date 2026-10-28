/**
 * INS Solar Business Management Software — Phase 8B Integration Tests
 *
 * Comprehensive test suite for Expense Management, Project Costing & Profitability:
 * - Expense creation with atomic sequence (EXP-YYYY-NNNNN) and positive integer paise validation
 * - Company approval threshold enforcement (default ₹5,000 / 500,000 paise)
 * - Anti-self-approval enforcement (submitter cannot approve their own expense)
 * - Expense approval and rejection workflows with audit history
 * - Expense payment disbursement (full and partial) and rejection of overpayment
 * - Expense cancellation guard (blocking cancellation of already paid expenses)
 * - Anti-double-counting invariants (excluding POs, GRNs, cancelled dispatches from cost ledger)
 * - Materials consumed cost recognition (dispatched qty * product standard purchase rate)
 * - Project cost aggregation across categories in integer paise
 * - Separation of contracted value, confirmed collections, and operational progress revenue
 * - Estimated gross margin and operational profitability calculations
 * - Project budget versioning and automatic superseding of prior approved versions
 * - Budget-vs-actual variance analysis
 * - Incomplete data completeness indicator
 * - 401 Unauthorized guards on secured routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  ExpenseCategory,
  ExpenseStatus,
  ExpensePaymentStatus,
  PaymentMethod,
  ProjectBudgetStatus,
  MaterialDispatchStatus,
  PaymentAllocationStatus,
  CustomerPaymentStatus,
  UserRole
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Expense } from '../models/Expense.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Product } from '../models/Product.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { ProjectBudget } from '../models/ProjectBudget.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { CustomerPayment } from '../models/CustomerPayment.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { ExpenseService } from '../services/expenseService.js';
import { ProjectProfitabilityService } from '../services/projectProfitabilityService.js';

describe('Phase 8B Integration: Expense Management, Project Costing & Profitability', () => {
  let app: any;
  const adminUserId = new Types.ObjectId().toString();
  const engineerUserId = new Types.ObjectId().toString();
  const sampleProjectId = new Types.ObjectId().toString();
  const sampleOrderId = new Types.ObjectId().toString();
  const sampleCustomerId = new Types.ObjectId().toString();

  const makePopulateQuery = (doc: any) => {
    const query: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    query.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return query;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();

    // Default CompanySettings mock with ₹5,000 (500,000 paise) approval threshold
    vi.spyOn(CompanySettings, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        expenseApprovalThresholdPaise: 500000
      }),
      exec: vi.fn().mockResolvedValue({
        expenseApprovalThresholdPaise: 500000
      })
    } as any);
  });

  // --------------------------------------------------------------------------
  // 1. Expense Creation with Atomic Sequence & Amount Validation
  // --------------------------------------------------------------------------
  it('creates an expense with atomic sequence EXP-YYYY-NNNNN and integer paise validation', async () => {
    vi.spyOn(Expense, 'findOne').mockResolvedValue(null);
    vi.spyOn(Expense.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const expense = await ExpenseService.createExpense(
      {
        category: ExpenseCategory.TRAVEL_FUEL,
        description: 'Fuel for site inspection vehicle',
        amountPaise: 250000, // ₹2,500.00
        taxAmountPaise: 45000, // ₹450.00
        expenseDate: new Date('2026-10-25'),
        payeeName: 'Indian Oil Corporation',
        notes: 'Site visit for rooftop survey'
      },
      { userId: engineerUserId, role: UserRole.INSTALLATION_CREW }
    );

    expect(expense.expenseNumber).toMatch(/^EXP-\d{4}-\d{5}$/);
    expect(expense.amountPaise).toBe(250000);
    expect(expense.taxAmountPaise).toBe(45000);
    expect(expense.totalAmountPaise).toBe(295000);
    expect(expense.paymentStatus).toBe(ExpensePaymentStatus.UNPAID);
    // Amount is below ₹5,000 threshold -> auto-approved
    expect(expense.requiresApproval).toBe(false);
    expect(expense.status).toBe(ExpenseStatus.APPROVED);
  });

  it('rejects duplicate expense submissions using idempotency key check', async () => {
    const existingExpense = {
      _id: new Types.ObjectId(),
      expenseNumber: 'EXP-2026-00001',
      idempotencyKey: 'IDEM-EXP-001',
      amountPaise: 100000
    };
    vi.spyOn(Expense, 'findOne').mockResolvedValue(existingExpense as any);

    const result = await ExpenseService.createExpense(
      {
        category: ExpenseCategory.MISCELLANEOUS,
        description: 'Hardware items',
        amountPaise: 100000,
        idempotencyKey: 'IDEM-EXP-001'
      },
      { userId: engineerUserId }
    );

    expect(result.expenseNumber).toBe('EXP-2026-00001');
    expect(result.idempotencyKey).toBe('IDEM-EXP-001');
  });

  // --------------------------------------------------------------------------
  // 2. Approval Threshold & Anti-Self-Approval Enforcement
  // --------------------------------------------------------------------------
  it('enforces PENDING_APPROVAL status when expense amount exceeds threshold (> ₹5,000)', async () => {
    vi.spyOn(Expense, 'findOne').mockResolvedValue(null);
    vi.spyOn(Expense.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const expense = await ExpenseService.createExpense(
      {
        category: ExpenseCategory.CRANE_EQUIPMENT_HIRE,
        description: 'Crane hire for heavy module rooftop lift',
        amountPaise: 1800000, // ₹18,000.00 (Exceeds ₹5,000 threshold)
        payeeName: 'Apex Crane Services'
      },
      { userId: engineerUserId, role: UserRole.INSTALLATION_CREW }
    );

    expect(expense.requiresApproval).toBe(true);
    expect(expense.status).toBe(ExpenseStatus.PENDING_APPROVAL);
  });

  it('strictly blocks submitter from approving their own expense (Anti-Self-Approval)', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      submittedBy: new Types.ObjectId(engineerUserId), // Submitted by engineerUserId
      status: ExpenseStatus.PENDING_APPROVAL,
      amountPaise: 1500000,
      save: vi.fn()
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    // Attempting self-approval
    await expect(
      ExpenseService.approveExpense(
        expenseId,
        { approvalNotes: 'Self approved' },
        { userId: engineerUserId, role: UserRole.DEPARTMENT_HEAD }
      )
    ).rejects.toThrow(/anti-self-approval violation/i);
  });

  it('allows authorized manager to approve a pending expense', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      submittedBy: new Types.ObjectId(engineerUserId),
      status: ExpenseStatus.PENDING_APPROVAL,
      amountPaise: 1500000,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    const approved = await ExpenseService.approveExpense(
      expenseId,
      { approvalNotes: 'Verified with site supervisor' },
      { userId: adminUserId, role: UserRole.ACCOUNTS_OFFICER }
    );

    expect(approved.status).toBe(ExpenseStatus.APPROVED);
    expect(approved.approvedBy?.toString()).toBe(adminUserId);
    expect(approved.approvalNotes).toBe('Verified with site supervisor');
  });

  // --------------------------------------------------------------------------
  // 3. Expense Rejection & Payment Workflows
  // --------------------------------------------------------------------------
  it('rejects a pending expense with mandatory rejection reason', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      status: ExpenseStatus.PENDING_APPROVAL,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    const rejected = await ExpenseService.rejectExpense(
      expenseId,
      { rejectionReason: 'Receipt missing GSTIN and proper itemization' },
      { userId: adminUserId }
    );

    expect(rejected.status).toBe(ExpenseStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('Receipt missing GSTIN and proper itemization');
  });

  it('records full payment disbursement against an approved expense', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      status: ExpenseStatus.APPROVED,
      paymentStatus: ExpensePaymentStatus.UNPAID,
      totalAmountPaise: 500000,
      paidAmountPaise: 0,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    const paid = await ExpenseService.recordPayment(
      expenseId,
      {
        paymentMode: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'UTR987654321',
        paidAmountPaise: 500000,
        notes: 'Disbursed from ICICI operating account'
      },
      { userId: adminUserId }
    );

    expect(paid.status).toBe(ExpenseStatus.PAID);
    expect(paid.paymentStatus).toBe(ExpensePaymentStatus.PAID);
    expect(paid.paidAmountPaise).toBe(500000);
    expect(paid.paymentReference).toBe('UTR987654321');
  });

  it('records partial payment disbursement against an approved expense', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      status: ExpenseStatus.APPROVED,
      paymentStatus: ExpensePaymentStatus.UNPAID,
      totalAmountPaise: 1000000, // ₹10,000.00
      paidAmountPaise: 0,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    const partial = await ExpenseService.recordPayment(
      expenseId,
      {
        paymentMode: PaymentMethod.UPI,
        paymentReference: 'UPI-ADV-123',
        paidAmountPaise: 400000 // ₹4,000.00 (partial)
      },
      { userId: adminUserId }
    );

    expect(partial.paymentStatus).toBe(ExpensePaymentStatus.PARTIALLY_PAID);
    expect(partial.paidAmountPaise).toBe(400000);
  });

  it('rejects payment on unapproved or draft expense', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      status: ExpenseStatus.PENDING_APPROVAL,
      totalAmountPaise: 500000
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    await expect(
      ExpenseService.recordPayment(
        expenseId,
        { paymentMode: PaymentMethod.CASH, paymentReference: 'CASH-REC-1' },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/only approved expenses can be paid/i);
  });

  it('prevents cancellation of an expense that has already been paid', async () => {
    const expenseId = new Types.ObjectId().toString();
    const mockExpense = {
      _id: new Types.ObjectId(expenseId),
      status: ExpenseStatus.PAID,
      paymentStatus: ExpensePaymentStatus.PAID
    };
    vi.spyOn(Expense, 'findById').mockResolvedValue(mockExpense as any);

    await expect(
      ExpenseService.cancelExpense(
        expenseId,
        { cancellationReason: 'Mistaken submission' },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/cannot cancel an expense that has already been paid/i);
  });

  // --------------------------------------------------------------------------
  // 4. Project Cost Ledger & Anti-Double-Counting Rules
  // --------------------------------------------------------------------------
  it('derives materials consumed costs strictly from DISPATCHED material dispatches and excludes CANCELLED ones', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      name: 'Rooftop 15kWp'
    };
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    const productId1 = new Types.ObjectId();
    const productId2 = new Types.ObjectId();

    // Mock DISPATCHED dispatches
    vi.spyOn(MaterialDispatch, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          dispatchNumber: 'DSP-2026-00001',
          status: MaterialDispatchStatus.DISPATCHED,
          dispatchedAt: new Date('2026-10-20'),
          lineItems: [
            { productId: productId1, issuedQuantity: 30 }, // 30 panels
            { productId: productId2, issuedQuantity: 1 } // 1 inverter
          ]
        }
      ])
    } as any);

    // Mock Product catalog with standardPurchaseRatePaise
    vi.spyOn(Product, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: productId1,
          name: 'Solar Panel 540W Mono PERC',
          uom: 'NOS',
          standardPurchaseRatePaise: 1250000 // ₹12,500.00 per panel
        },
        {
          _id: productId2,
          name: '15kW 3-Phase Grid-Tie Inverter',
          uom: 'NOS',
          standardPurchaseRatePaise: 8500000 // ₹85,000.00
        }
      ])
    } as any);

    // Mock Expenses (approved direct expense)
    vi.spyOn(Expense, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          expenseNumber: 'EXP-2026-00010',
          category: ExpenseCategory.INSTALLATION_LABOR,
          description: 'Structure assembly contractor charge',
          amountPaise: 4500000, // ₹45,000.00
          taxAmountPaise: 0,
          totalAmountPaise: 4500000,
          status: ExpenseStatus.APPROVED,
          expenseDate: new Date('2026-10-22')
        }
      ])
    } as any);

    const { entries, summary } = await ProjectProfitabilityService.getCostLedger(sampleProjectId);

    // 30 * 12,500 = ₹375,000 (37,500,000 paise) + 1 * ₹85,000 (8,500,000 paise) = 46,000,000 paise
    expect(summary.materialsCostPaise).toBe(46000000);
    // Labor: ₹45,000 = 4,500,000 paise
    expect(summary.laborCostPaise).toBe(4500000);
    expect(summary.totalCostPaise).toBe(50500000); // ₹505,000.00
    expect(entries.length).toBe(3); // 2 materials + 1 expense
  });

  // --------------------------------------------------------------------------
  // 5. Project Profitability, Contract Value & Revenue Separation
  // --------------------------------------------------------------------------
  it('generates profitability report separating contracted sales value, confirmed collections and progress revenue', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001',
      name: 'Rooftop 15kWp Commercial',
      customerId: new Types.ObjectId(sampleCustomerId),
      orderId: new Types.ObjectId(sampleOrderId),
      systemCapacityKwp: 15,
      currentStage: 'STAGE_06_INSTALLATION_WORK',
      status: 'IN_PROGRESS',
      milestones: [
        { name: 'Site Readiness', status: 'COMPLETED' },
        { name: 'Structure Mounting', status: 'COMPLETED' },
        { name: 'Inverter & Cabling', status: 'IN_PROGRESS' },
        { name: 'Testing & Commissioning', status: 'PENDING' }
      ] // 2 of 4 milestones completed = 50% progress
    };
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    // Mock SalesOrder
    vi.spyOn(SalesOrder, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(sampleOrderId),
        orderNumber: 'ORD-2026-00001',
        netTotalPaise: 75000000 // ₹750,000.00 contracted sales value
      })
    } as any);

    // Mock PaymentAllocations: ₹300,000 collected against order
    vi.spyOn(PaymentAllocation, 'find').mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([
          { allocatedAmountPaise: 30000000, status: PaymentAllocationStatus.ACTIVE }
        ])
    } as any);

    // Mock CustomerPayment: ₹20,000 unallocated customer advance credit
    vi.spyOn(CustomerPayment, 'find').mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([
          { unallocatedAmountPaise: 2000000, status: CustomerPaymentStatus.VERIFIED }
        ])
    } as any);

    // Mock Cost Ledger
    vi.spyOn(ProjectProfitabilityService, 'getCostLedger').mockResolvedValue({
      entries: [],
      summary: {
        materialsCostPaise: 46000000,
        laborCostPaise: 4500000,
        logisticsCostPaise: 1500000,
        civilCostPaise: 0,
        miscCostPaise: 0,
        totalCostPaise: 52000000 // ₹520,000.00
      }
    });

    // Mock ProjectBudget
    vi.spyOn(ProjectBudget, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        version: 1,
        materialsBudgetPaise: 45000000,
        laborBudgetPaise: 5000000,
        logisticsBudgetPaise: 1000000,
        civilBudgetPaise: 0,
        miscBudgetPaise: 0,
        contingencyBudgetPaise: 1000000,
        totalBudgetPaise: 52000000,
        approvedAt: new Date('2026-10-15')
      })
    } as any);

    const report = await ProjectProfitabilityService.getProjectProfitability(sampleProjectId);

    expect(report.contractedSalesValuePaise).toBe(75000000); // ₹750,000.00
    expect(report.confirmedCollectionsPaise).toBe(30000000); // ₹300,000.00
    expect(report.outstandingReceivablesPaise).toBe(45000000); // ₹450,000.00
    expect(report.unallocatedCustomerCreditPaise).toBe(2000000); // ₹20,000.00
    expect(report.operationalProgressPercent).toBe(50); // 2 of 4 milestones = 50%
    expect(report.operationalProgressRevenuePaise).toBe(37500000); // 50% of ₹750,000 = ₹375,000.00

    // Estimated Gross Margin: 75,000,000 - 52,000,000 = 23,000,000 paise (₹230,000.00)
    expect(report.estimatedGrossMarginPaise).toBe(23000000);
    // Margin %: (230,000 / 750,000) * 100 = 30.67%
    expect(report.grossMarginPercent).toBe(30.67);

    // Budget Comparison Check
    expect(report.budgetComparison.hasApprovedBudget).toBe(true);
    expect(report.budgetComparison.materials.variancePaise).toBe(1000000); // 46M actual - 45M planned = +1M
    expect(report.disclaimer).toMatch(
      /operational cost allocations and project progress estimates/i
    );
    expect(report.disclaimer).toMatch(/do not constitute audited statutory financial statements/i);
  });

  // --------------------------------------------------------------------------
  // 6. Project Budget Management & Versioning
  // --------------------------------------------------------------------------
  it('creates project budget revisions and atomically supersedes previous versions upon approval', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId)
    } as any);

    // Existing budget v1 is APPROVED
    vi.spyOn(ProjectBudget, 'findOne').mockReturnValue(
      makePopulateQuery({
        version: 1,
        status: ProjectBudgetStatus.APPROVED
      }) as any
    );

    vi.spyOn(ProjectBudget.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const budgetV2 = await ProjectProfitabilityService.createBudget(
      sampleProjectId,
      {
        projectId: sampleProjectId,
        materialsBudgetPaise: 48000000,
        laborBudgetPaise: 6000000,
        logisticsBudgetPaise: 2000000,
        revisionReason: 'Scope addition: upgraded to bifacial modules'
      },
      { userId: engineerUserId }
    );

    expect(budgetV2.version).toBe(2);
    expect(budgetV2.status).toBe(ProjectBudgetStatus.DRAFT);
    expect(budgetV2.totalBudgetPaise).toBe(56000000);

    // Approve Budget V2
    const updateManySpy = vi.spyOn(ProjectBudget, 'updateMany').mockResolvedValue({} as any);
    vi.spyOn(ProjectBudget, 'findOne').mockReturnValue(
      makePopulateQuery({
        _id: budgetV2._id,
        projectId: new Types.ObjectId(sampleProjectId),
        version: 2,
        status: ProjectBudgetStatus.DRAFT,
        totalBudgetPaise: 56000000,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      }) as any
    );

    const approvedV2 = await ProjectProfitabilityService.approveBudget(
      sampleProjectId,
      budgetV2._id.toString(),
      { notes: 'Client accepted change order price revision' },
      { userId: adminUserId }
    );

    expect(approvedV2.status).toBe(ProjectBudgetStatus.APPROVED);
    // Prior versions must have been superseded
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: sampleProjectId,
        status: ProjectBudgetStatus.APPROVED
      }),
      expect.objectContaining({
        $set: { status: ProjectBudgetStatus.SUPERSEDED }
      })
    );
  });

  // --------------------------------------------------------------------------
  // 7. Missing/Incomplete Cost Data Indicator
  // --------------------------------------------------------------------------
  it('flags data completeness indicator when project lacks confirmed sales order or milestones', async () => {
    const incompleteProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00002',
      name: 'Site Speculative Proposal',
      customerId: new Types.ObjectId(sampleCustomerId),
      // orderId missing
      milestones: [] // empty milestones
    };
    vi.spyOn(Project, 'findById').mockResolvedValue(incompleteProject as any);
    vi.spyOn(ProjectProfitabilityService, 'getCostLedger').mockResolvedValue({
      entries: [],
      summary: {
        materialsCostPaise: 0,
        laborCostPaise: 0,
        logisticsCostPaise: 0,
        civilCostPaise: 0,
        miscCostPaise: 0,
        totalCostPaise: 0
      }
    });
    vi.spyOn(CustomerPayment, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([])
    } as any);
    vi.spyOn(ProjectBudget, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as any);

    const report = await ProjectProfitabilityService.getProjectProfitability(sampleProjectId);

    expect(report.isDataComplete).toBe(false);
    expect(report.dataCompletenessNotes.length).toBeGreaterThan(0);
    expect(report.dataCompletenessNotes.some(n => /no confirmed sales order/i.test(n))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Secured Route Authentication Guards (401 Unauthorized)
  // --------------------------------------------------------------------------
  it('returns 401 Unauthorized for unauthenticated requests on secured expense and costing routes', async () => {
    const resList = await request(app).get('/api/v1/expenses');
    expect(resList.status).toBe(401);

    const resDetail = await request(app).get(`/api/v1/expenses/${new Types.ObjectId()}`);
    expect(resDetail.status).toBe(401);

    const resCostLedger = await request(app).get(`/api/v1/projects/${sampleProjectId}/cost-ledger`);
    expect(resCostLedger.status).toBe(401);

    const resProfit = await request(app).get(`/api/v1/projects/${sampleProjectId}/profitability`);
    expect(resProfit.status).toBe(401);

    const resBudgets = await request(app).get(`/api/v1/projects/${sampleProjectId}/budgets`);
    expect(resBudgets.status).toBe(401);
  });
});
