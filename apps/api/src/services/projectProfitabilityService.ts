/**
 * INS Solar Business Management Software — Project Profitability & Costing Service
 *
 * Implements authoritative project cost derivation, multi-category cost ledger,
 * contract revenue vs operational progress recognition, budget-vs-actual variance,
 * and data completeness validation without duplicate cost recognition.
 *
 * BOUNDARY NOTICE: This service is an operational cost and project margin engine,
 * NOT a statutory double-entry general ledger or audited financial statement.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  Project,
  SalesOrder,
  MaterialDispatch,
  Product,
  Expense,
  ProjectBudget,
  IProjectBudgetDocument,
  PaymentAllocation,
  CustomerPayment
} from '../models/index.js';
import {
  MaterialDispatchStatus,
  ExpenseStatus,
  ProjectBudgetStatus,
  PaymentAllocationStatus,
  CustomerPaymentStatus,
  ProjectCostSourceType,
  AuditAction,
  AuditOutcome,
  ActorType,
  CreateProjectBudgetInput,
  ApproveProjectBudgetInput
} from '@ins-solar/shared';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { UserContext } from './expenseService.js';

export interface CostLedgerEntry {
  id: string;
  sourceType: ProjectCostSourceType;
  sourceId: string;
  sourceNumber: string;
  costCategory: string;
  description: string;
  quantity?: number;
  unitRatePaise?: number;
  amountPaise: number;
  effectiveDate: Date;
  status: string;
  paymentStatus?: string;
}

export interface CostCategorySummary {
  materialsCostPaise: number;
  laborCostPaise: number;
  logisticsCostPaise: number;
  civilCostPaise: number;
  miscCostPaise: number;
  totalCostPaise: number;
}

export interface BudgetVsActualComparison {
  hasApprovedBudget: boolean;
  budgetVersion?: number;
  approvedAt?: Date;
  materials: { plannedPaise: number; actualPaise: number; variancePaise: number };
  labor: { plannedPaise: number; actualPaise: number; variancePaise: number };
  logistics: { plannedPaise: number; actualPaise: number; variancePaise: number };
  civil: { plannedPaise: number; actualPaise: number; variancePaise: number };
  misc: { plannedPaise: number; actualPaise: number; variancePaise: number };
  contingency: { plannedPaise: number; actualPaise: number; variancePaise: number };
  total: { plannedPaise: number; actualPaise: number; variancePaise: number };
}

export interface ProjectProfitabilityReport {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerId: string;
  systemCapacityKwp?: number;
  currentStage: string;
  projectStatus: string;

  // Authoritative Sales & Revenue
  hasConfirmedOrder: boolean;
  orderNumber?: string;
  contractedSalesValuePaise: number;
  operationalProgressPercent: number;
  operationalProgressRevenuePaise: number;

  // Cash Inflows & Collections
  confirmedCollectionsPaise: number;
  unallocatedCustomerCreditPaise: number;
  outstandingReceivablesPaise: number;

  // Authoritative Recorded Costs
  costSummary: CostCategorySummary;

  // Estimated Operational Margin
  estimatedGrossMarginPaise: number;
  grossMarginPercent: number;

  // Budget vs Actual
  budgetComparison: BudgetVsActualComparison;

  // Data Integrity & Disclaimers
  isDataComplete: boolean;
  dataCompletenessNotes: string[];
  disclaimer: string;
}

export class ProjectProfitabilityService {
  /**
   * Derives authoritative project cost ledger entries without double-counting.
   */
  public static async getCostLedger(projectId: string): Promise<{
    entries: CostLedgerEntry[];
    summary: CostCategorySummary;
  }> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw AppError.badRequest('Invalid project ID format.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${projectId} not found.`);
    }

    const entries: CostLedgerEntry[] = [];

    // 1. Materials consumed from DISPATCHED material dispatches
    // Note: Cancelled dispatches or draft dispatches are strictly excluded.
    const dispatches = await MaterialDispatch.find({
      projectId: project._id,
      status: MaterialDispatchStatus.DISPATCHED
    }).lean();

    const productIds = new Set<string>();
    dispatches.forEach(d => {
      d.lineItems?.forEach(item => {
        if (item.productId) {
          productIds.add(item.productId.toString());
        }
      });
    });

    const products = await Product.find({
      _id: { $in: Array.from(productIds).map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    const productMap = new Map<string, any>();
    products.forEach(p => productMap.set(p._id.toString(), p));

    for (const d of dispatches) {
      for (const item of d.lineItems || []) {
        const prod = productMap.get(item.productId.toString());
        const unitRate = prod?.standardPurchaseRatePaise || 0;
        const lineItemAmount = (item.issuedQuantity || 0) * unitRate;

        entries.push({
          id: `${d._id}_${item.productId}`,
          sourceType: ProjectCostSourceType.MATERIAL_DISPATCH,
          sourceId: d._id.toString(),
          sourceNumber: d.dispatchNumber,
          costCategory: 'MATERIALS',
          description: `${prod?.name || 'Solar Hardware Item'} (Qty: ${item.issuedQuantity} ${prod?.uom || 'NOS'})`,
          quantity: item.issuedQuantity,
          unitRatePaise: unitRate,
          amountPaise: lineItemAmount,
          effectiveDate: d.dispatchedAt || d.createdAt,
          status: d.status
        });
      }
    }

    // 2. Direct project expenses (APPROVED or PAID only)
    const expenses = await Expense.find({
      projectId: project._id,
      status: { $in: [ExpenseStatus.APPROVED, ExpenseStatus.PAID] }
    }).lean();

    for (const exp of expenses) {
      entries.push({
        id: exp._id.toString(),
        sourceType: ProjectCostSourceType.EXPENSE,
        sourceId: exp._id.toString(),
        sourceNumber: exp.expenseNumber,
        costCategory: exp.category,
        description: exp.description,
        amountPaise: exp.totalAmountPaise || exp.amountPaise + (exp.taxAmountPaise || 0),
        effectiveDate: exp.expenseDate,
        status: exp.status,
        paymentStatus: exp.paymentStatus
      });
    }

    // Sort entries chronologically descending
    entries.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    // Compute category aggregations
    let materialsCostPaise = 0;
    let laborCostPaise = 0;
    let logisticsCostPaise = 0;
    let civilCostPaise = 0;
    let miscCostPaise = 0;

    for (const e of entries) {
      if (e.costCategory === 'MATERIALS' || e.costCategory === 'CONSUMABLES_ELECTRICAL') {
        materialsCostPaise += e.amountPaise;
      } else if (e.costCategory === 'INSTALLATION_LABOR') {
        laborCostPaise += e.amountPaise;
      } else if (
        e.costCategory === 'FREIGHT_LOGISTICS' ||
        e.costCategory === 'CRANE_EQUIPMENT_HIRE'
      ) {
        logisticsCostPaise += e.amountPaise;
      } else if (e.costCategory === 'CIVIL_FOUNDATION_WORKS') {
        civilCostPaise += e.amountPaise;
      } else {
        miscCostPaise += e.amountPaise;
      }
    }

    const totalCostPaise =
      materialsCostPaise + laborCostPaise + logisticsCostPaise + civilCostPaise + miscCostPaise;

    return {
      entries,
      summary: {
        materialsCostPaise,
        laborCostPaise,
        logisticsCostPaise,
        civilCostPaise,
        miscCostPaise,
        totalCostPaise
      }
    };
  }

  /**
   * Generates comprehensive project profitability and budget-vs-actual analysis.
   */
  public static async getProjectProfitability(projectId: string): Promise<ProjectProfitabilityReport> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw AppError.badRequest('Invalid project ID format.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${projectId} not found.`);
    }

    const completenessNotes: string[] = [];

    // 1. Contracted sales value
    let order: any = null;
    let contractedSalesValuePaise = 0;

    if (project.orderId) {
      order = await SalesOrder.findById(project.orderId).lean();
      if (order) {
        contractedSalesValuePaise = order.netTotalPaise || 0;
      } else {
        completenessNotes.push('Referenced Sales Order could not be located in database.');
      }
    } else {
      completenessNotes.push('No confirmed Sales Order is linked to this project.');
    }

    // 2. Customer Collections & Outstanding Receivables
    let confirmedCollectionsPaise = 0;
    let outstandingReceivablesPaise = 0;

    if (order) {
      const activeAllocations = await PaymentAllocation.find({
        salesOrderId: order._id,
        status: PaymentAllocationStatus.ACTIVE
      }).lean();

      confirmedCollectionsPaise = activeAllocations.reduce(
        (sum, a) => sum + (a.allocatedAmountPaise || 0),
        0
      );
      outstandingReceivablesPaise = Math.max(0, contractedSalesValuePaise - confirmedCollectionsPaise);
    }

    // 3. Unallocated Customer Credit
    const customerPayments = await CustomerPayment.find({
      customerId: project.customerId,
      status: CustomerPaymentStatus.VERIFIED,
      unallocatedAmountPaise: { $gt: 0 }
    }).lean();

    const unallocatedCustomerCreditPaise = customerPayments.reduce(
      (sum, p) => sum + (p.unallocatedAmountPaise || 0),
      0
    );

    // 4. Milestone Operational Progress & Revenue Recognition
    const milestones = project.milestones || [];
    let operationalProgressPercent = 0;

    if (milestones.length > 0) {
      const completedCount = milestones.filter(
        (m: any) => m.status === 'COMPLETED' || m.status === 'DONE'
      ).length;
      operationalProgressPercent = Math.round((completedCount / milestones.length) * 100);
    } else if (project.status === 'COMPLETED') {
      operationalProgressPercent = 100;
    } else {
      completenessNotes.push('No project installation milestones recorded.');
    }

    const operationalProgressRevenuePaise = Math.round(
      contractedSalesValuePaise * (operationalProgressPercent / 100)
    );

    // 5. Cost Ledger & Summaries
    const { summary: costSummary } = await this.getCostLedger(projectId);

    // 6. Estimated Gross Margin
    const estimatedGrossMarginPaise = contractedSalesValuePaise - costSummary.totalCostPaise;
    const grossMarginPercent =
      contractedSalesValuePaise > 0
        ? Math.round((estimatedGrossMarginPaise / contractedSalesValuePaise) * 10000) / 100
        : 0;

    // 7. Budget vs Actual Comparison
    const approvedBudget = await ProjectBudget.findOne({
      projectId: project._id,
      status: ProjectBudgetStatus.APPROVED
    }).lean();

    const budgetComparison: BudgetVsActualComparison = {
      hasApprovedBudget: Boolean(approvedBudget),
      budgetVersion: approvedBudget?.version,
      approvedAt: approvedBudget?.approvedAt,
      materials: {
        plannedPaise: approvedBudget?.materialsBudgetPaise || 0,
        actualPaise: costSummary.materialsCostPaise,
        variancePaise: costSummary.materialsCostPaise - (approvedBudget?.materialsBudgetPaise || 0)
      },
      labor: {
        plannedPaise: approvedBudget?.laborBudgetPaise || 0,
        actualPaise: costSummary.laborCostPaise,
        variancePaise: costSummary.laborCostPaise - (approvedBudget?.laborBudgetPaise || 0)
      },
      logistics: {
        plannedPaise: approvedBudget?.logisticsBudgetPaise || 0,
        actualPaise: costSummary.logisticsCostPaise,
        variancePaise: costSummary.logisticsCostPaise - (approvedBudget?.logisticsBudgetPaise || 0)
      },
      civil: {
        plannedPaise: approvedBudget?.civilBudgetPaise || 0,
        actualPaise: costSummary.civilCostPaise,
        variancePaise: costSummary.civilCostPaise - (approvedBudget?.civilBudgetPaise || 0)
      },
      misc: {
        plannedPaise: approvedBudget?.miscBudgetPaise || 0,
        actualPaise: costSummary.miscCostPaise,
        variancePaise: costSummary.miscCostPaise - (approvedBudget?.miscBudgetPaise || 0)
      },
      contingency: {
        plannedPaise: approvedBudget?.contingencyBudgetPaise || 0,
        actualPaise: 0,
        variancePaise: -(approvedBudget?.contingencyBudgetPaise || 0)
      },
      total: {
        plannedPaise: approvedBudget?.totalBudgetPaise || 0,
        actualPaise: costSummary.totalCostPaise,
        variancePaise: costSummary.totalCostPaise - (approvedBudget?.totalBudgetPaise || 0)
      }
    };

    if (!approvedBudget) {
      completenessNotes.push('No approved project baseline budget exists.');
    }

    const isDataComplete = completenessNotes.length === 0;

    const disclaimer =
      'Operational Costing & Profitability Notice: These figures represent operational cost allocations and project progress estimates. They do not constitute audited statutory financial statements or double-entry general ledger accounts under Indian GAAP or Ind AS.';

    return {
      projectId: project._id.toString(),
      projectCode: project.projectCode,
      projectName: project.name,
      customerId: project.customerId?.toString(),
      systemCapacityKwp: project.systemCapacityKwp,
      currentStage: project.currentStage,
      projectStatus: project.status,
      hasConfirmedOrder: Boolean(order),
      orderNumber: order?.orderNumber,
      contractedSalesValuePaise,
      operationalProgressPercent,
      operationalProgressRevenuePaise,
      confirmedCollectionsPaise,
      unallocatedCustomerCreditPaise,
      outstandingReceivablesPaise,
      costSummary,
      estimatedGrossMarginPaise,
      grossMarginPercent,
      budgetComparison,
      isDataComplete,
      dataCompletenessNotes: completenessNotes,
      disclaimer
    };
  }

  /**
   * Retrieves all budget revisions for a project.
   */
  public static async getProjectBudgets(projectId: string) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw AppError.badRequest('Invalid project ID format.');
    }

    return await ProjectBudget.find({ projectId })
      .populate('createdBy', 'firstName lastName employeeCode')
      .populate('approvedBy', 'firstName lastName employeeCode')
      .sort({ version: -1 })
      .lean();
  }

  /**
   * Creates a new budget baseline or revision for a project.
   */
  public static async createBudget(
    projectId: string,
    input: CreateProjectBudgetInput,
    actor: UserContext
  ): Promise<IProjectBudgetDocument> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw AppError.badRequest('Invalid project ID format.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID ${projectId} not found.`);
    }

    const latestBudget = await ProjectBudget.findOne({ projectId: project._id })
      .sort({ version: -1 })
      .lean();

    const version = (latestBudget?.version || 0) + 1;

    const materialsBudgetPaise = input.materialsBudgetPaise || 0;
    const laborBudgetPaise = input.laborBudgetPaise || 0;
    const logisticsBudgetPaise = input.logisticsBudgetPaise || 0;
    const civilBudgetPaise = input.civilBudgetPaise || 0;
    const miscBudgetPaise = input.miscBudgetPaise || 0;
    const contingencyBudgetPaise = input.contingencyBudgetPaise || 0;

    const totalBudgetPaise =
      materialsBudgetPaise +
      laborBudgetPaise +
      logisticsBudgetPaise +
      civilBudgetPaise +
      miscBudgetPaise +
      contingencyBudgetPaise;

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    const budget = new ProjectBudget({
      projectId: project._id,
      version,
      status: ProjectBudgetStatus.DRAFT,
      materialsBudgetPaise,
      laborBudgetPaise,
      logisticsBudgetPaise,
      civilBudgetPaise,
      miscBudgetPaise,
      contingencyBudgetPaise,
      totalBudgetPaise,
      notes: input.notes?.trim(),
      revisionReason: input.revisionReason?.trim(),
      createdBy: actorId,
      statusHistory: [
        {
          fromStatus: 'NONE',
          toStatus: ProjectBudgetStatus.DRAFT,
          changedAt: new Date(),
          changedBy: actorId,
          notes: version > 1 ? `Revision v${version} created` : 'Initial budget created'
        }
      ]
    });

    await budget.save();

    await AuditService.recordEvent({
      action: AuditAction.PROJECT_BUDGET_CREATED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'ProjectBudget',
      targetId: budget._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        projectId,
        version,
        totalBudgetPaise
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return budget;
  }

  /**
   * Approves a project budget revision and atomically supersedes prior versions.
   */
  public static async approveBudget(
    projectId: string,
    budgetId: string,
    input: ApproveProjectBudgetInput,
    actor: UserContext
  ): Promise<IProjectBudgetDocument> {
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(budgetId)) {
      throw AppError.badRequest('Invalid project ID or budget ID format.');
    }

    const budget = await ProjectBudget.findOne({
      _id: budgetId,
      projectId
    });

    if (!budget) {
      throw AppError.notFound(`Project budget with ID ${budgetId} not found.`);
    }

    if (budget.status === ProjectBudgetStatus.APPROVED) {
      return budget;
    }

    const actorId = actor.userId
      ? new mongoose.Types.ObjectId(actor.userId)
      : new mongoose.Types.ObjectId();

    // 1. Mark any currently approved budget as SUPERSEDED
    await ProjectBudget.updateMany(
      {
        projectId,
        status: ProjectBudgetStatus.APPROVED,
        _id: { $ne: budget._id }
      },
      {
        $set: { status: ProjectBudgetStatus.SUPERSEDED },
        $push: {
          statusHistory: {
            fromStatus: ProjectBudgetStatus.APPROVED,
            toStatus: ProjectBudgetStatus.SUPERSEDED,
            changedAt: new Date(),
            changedBy: actorId,
            notes: `Superseded by budget v${budget.version}`
          }
        }
      }
    );

    // 2. Mark this budget as APPROVED
    const previousStatus = budget.status;
    budget.status = ProjectBudgetStatus.APPROVED;
    budget.approvedBy = actorId;
    budget.approvedAt = new Date();
    if (input.notes?.trim()) {
      budget.notes = budget.notes ? `${budget.notes}\nApproval notes: ${input.notes.trim()}` : input.notes.trim();
    }

    budget.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: ProjectBudgetStatus.APPROVED,
      changedAt: new Date(),
      changedBy: actorId,
      notes: input.notes?.trim() || `Approved budget version ${budget.version}`
    });

    await budget.save();

    await AuditService.recordEvent({
      action: AuditAction.PROJECT_BUDGET_APPROVED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'ProjectBudget',
      targetId: budget._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        projectId,
        version: budget.version,
        totalBudgetPaise: budget.totalBudgetPaise
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || crypto.randomUUID()
    });

    return budget;
  }
}
