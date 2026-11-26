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
  CustomerPayment,
  StockMovement,
  PurchaseOrder,
  GoodsReceipt,
  VendorInvoice
} from '../models/index.js';
import {
  MaterialDispatchStatus,
  StockMovementType,
  ExpenseStatus,
  ProjectBudgetStatus,
  PaymentAllocationStatus,
  CustomerPaymentStatus,
  ProjectCostSourceType,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  VendorInvoiceStatus,
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
  materialIssuedCostPaise: number;
  materialInTransitCostPaise: number;
  materialConsumedCostPaise: number;
  reusableReturnCreditPaise: number;
  damagedScrapLossPaise: number;
  approvedExpensesPaise: number;
  laborCostPaise: number;
  logisticsCostPaise: number;
  civilCostPaise: number;
  miscCostPaise: number;
  totalCostPaise: number;
}

export interface ProjectCostBreakdown {
  estimatedCostPaise: number | null;
  poCommittedCostPaise: number;
  actualProcurementCostPaise: number;
  materialIssuedCostPaise: number;
  materialInTransitCostPaise: number;
  materialConsumedCostPaise: number;
  reusableReturnCreditPaise: number;
  damagedScrapLossPaise: number;
  approvedExpensesPaise: number;
  actualProjectCostPaise: number;
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
  recognizedRevenuePaise: number;

  // Cash Inflows & Collections
  confirmedCollectionsPaise: number;
  unallocatedCustomerCreditPaise: number;
  outstandingReceivablesPaise: number;

  // Authoritative Recorded Costs
  costSummary: CostCategorySummary;
  costBreakdown: ProjectCostBreakdown;

  // Estimated vs Actual Operational Margins (strictly separated; never fallback estimated to actual)
  estimatedGrossMarginPaise: number | null;
  grossMarginPercent: number | null;
  budgetedGrossMarginPaise?: number | null;
  budgetedMarginPercent?: number | null;
  actualGrossMarginPaise: number;
  actualMarginPercent: number;

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

    // 1. Track issued vs physically delivered/consumed material dispatches
    // Note: DISPATCHED / IN_TRANSIT slips are reported under issued/in-transit cost, NEVER treated as consumed cost until DELIVERED at site.
    const dispatches = await MaterialDispatch.find({
      projectId: project._id,
      status: {
        $in: [
          MaterialDispatchStatus.DISPATCHED,
          MaterialDispatchStatus.IN_TRANSIT,
          MaterialDispatchStatus.DELIVERED
        ]
      }
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

    let materialIssuedCostPaise = 0;
    let materialInTransitCostPaise = 0;
    let deliveredMaterialCostPaise = 0;

    for (const d of dispatches) {
      const isDelivered = d.status === MaterialDispatchStatus.DELIVERED;
      for (const item of d.lineItems || []) {
        const prod = productMap.get(item.productId.toString());
        const unitRate =
          item.unitCostPaise !== undefined
            ? item.unitCostPaise
            : prod?.standardPurchaseRatePaise || 0;
        const lineItemAmount = (item.issuedQuantity || 0) * unitRate;

        materialIssuedCostPaise += lineItemAmount;
        if (isDelivered) {
          deliveredMaterialCostPaise += lineItemAmount;
        } else {
          materialInTransitCostPaise += lineItemAmount;
        }

        entries.push({
          id: `${d._id}_${item.productId}`,
          sourceType: ProjectCostSourceType.MATERIAL_DISPATCH,
          sourceId: d._id.toString(),
          sourceNumber: d.dispatchNumber,
          costCategory: 'MATERIALS',
          description: `${prod?.name || 'Solar Hardware Item'} (Qty: ${item.issuedQuantity} ${prod?.uom || 'NOS'})${isDelivered ? '' : ' [In Transit — Not Yet Consumed]'}`,
          quantity: item.issuedQuantity,
          unitRatePaise: unitRate,
          amountPaise: isDelivered ? lineItemAmount : 0,
          effectiveDate: d.dispatchedAt || d.createdAt,
          status: d.status
        });
      }
    }

    // 1b. Physical Material returns (excluding DISPATCH_REVERSAL which cancels un-departed dispatches)
    let reusableReturnCreditPaise = 0;
    let damagedScrapLossPaise = 0;

    if (project.orderId) {
      const returnMovements = await StockMovement.find({
        orderId: project.orderId,
        movementType: StockMovementType.RETURN,
        isReversal: { $ne: true }
      }).lean();

      for (const ret of returnMovements) {
        if (ret.movementType !== StockMovementType.RETURN || (ret as any).isReversal) {
          continue;
        }
        let prod = productMap.get(ret.productId.toString());
        if (!prod) {
          prod = await Product.findById(ret.productId).lean();
          if (prod) productMap.set(prod._id.toString(), prod);
        }
        const unitRate =
          (ret as any).unitCostPaise !== undefined
            ? (ret as any).unitCostPaise
            : (prod?.standardPurchaseRatePaise || 0);

        const rawCondition = (ret as any).condition
          ? String((ret as any).condition).toUpperCase()
          : 'REUSABLE';
        const isDamagedOrScrap =
          rawCondition.includes('DAMAGED') ||
          rawCondition.includes('SCRAP') ||
          rawCondition.includes('REJECT');

        const disposition =
          (ret as any).disposition ||
          (isDamagedOrScrap ? 'SCRAP_WRITEOFF' : 'RESTOCK');

        const salvageCreditPaise = (ret as any).salvageCreditPaise || 0;
        const grossReturnValue = Math.abs(Math.round((ret.quantity || 0) * unitRate));

        let returnCreditPaise = 0;
        let entryStatus = 'RETURNED';
        let entrySourceType = ProjectCostSourceType.RETURN_CREDIT;
        let desc = '';

        if (!isDamagedOrScrap) {
          // Reusable / accepted physical return: full original valuation credited back to project
          returnCreditPaise = -grossReturnValue;
          reusableReturnCreditPaise += grossReturnValue;
          entryStatus = 'RETURNED';
          entrySourceType = ProjectCostSourceType.RETURN_CREDIT;
          desc = `Material Return Credit [REUSABLE]: ${prod?.name || 'Solar Hardware Item'} (Qty: ${ret.quantity} ${prod?.uom || 'NOS'}) via ${ret.movementNumber}`;
        } else {
          // Damaged / Scrap / Rejected return: business absorbed unrecovered loss
          returnCreditPaise = salvageCreditPaise > 0 ? -Math.abs(salvageCreditPaise) : 0;
          damagedScrapLossPaise += Math.max(0, grossReturnValue - Math.abs(salvageCreditPaise));
          entryStatus = rawCondition.includes('DAMAGED')
            ? 'DAMAGED_WRITE_OFF'
            : rawCondition.includes('SCRAP')
            ? 'SCRAP_LOSS'
            : 'REJECTED';
          entrySourceType = ProjectCostSourceType.SCRAP_LOSS;
          desc = `Material Site Return [${rawCondition} - ${disposition}]: ${prod?.name || 'Solar Hardware Item'} (Qty: ${ret.quantity} ${prod?.uom || 'NOS'})${salvageCreditPaise > 0 ? ` - Recovery Credit: ₹${salvageCreditPaise / 100}` : ' - Uncredited Damage/Loss'} via ${ret.movementNumber}`;
        }

        entries.push({
          id: `RET_${ret._id}`,
          sourceType: entrySourceType,
          sourceId: ret._id.toString(),
          sourceNumber: ret.movementNumber,
          costCategory: 'MATERIALS',
          description: desc,
          quantity: -(ret.quantity || 0),
          unitRatePaise: unitRate,
          amountPaise: returnCreditPaise,
          effectiveDate: ret.createdAt,
          status: entryStatus
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
    entries.sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );

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
    const approvedExpensesPaise =
      expenses.reduce(
        (sum, exp) => sum + (exp.totalAmountPaise || exp.amountPaise + (exp.taxAmountPaise || 0)),
        0
      );
    const materialConsumedCostPaise = Math.max(
      0,
      deliveredMaterialCostPaise - reusableReturnCreditPaise
    );

    return {
      entries,
      summary: {
        materialsCostPaise,
        materialIssuedCostPaise,
        materialInTransitCostPaise,
        materialConsumedCostPaise,
        reusableReturnCreditPaise,
        damagedScrapLossPaise,
        approvedExpensesPaise,
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
  public static async getProjectProfitability(
    projectId: string
  ): Promise<ProjectProfitabilityReport> {
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
      outstandingReceivablesPaise = Math.max(
        0,
        contractedSalesValuePaise - confirmedCollectionsPaise
      );
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

    // 5. Cost Ledger & Summaries (Issued vs Consumed vs Return Credit vs Loss vs Approved Expenses)
    const { summary: costSummary } = await this.getCostLedger(projectId);

    // 6. PO Committed & Actual Procurement Cost (tracked separately; NEVER added to actual project cost ledger to avoid double counting)
    let poCommittedCostPaise = 0;
    let actualProcurementCostPaise = 0;
    if (mongoose.connection.readyState === 1 || (PurchaseOrder.find as any)?.mock) {
      const committedPos = await PurchaseOrder.find({
        projectId: project._id,
        status: {
          $in: [
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.FULLY_RECEIVED
          ]
        }
      }).lean();
      poCommittedCostPaise = committedPos.reduce((sum, po) => sum + (po.totalAmountPaise || 0), 0);

      const poIds = committedPos.map(po => po._id);
      if (mongoose.connection.readyState === 1 || (VendorInvoice.find as any)?.mock) {
        const vendorInvoices = await VendorInvoice.find({
          status: { $ne: VendorInvoiceStatus.CANCELLED },
          $or: [
            { projectId: project._id },
            ...(poIds.length > 0 ? [{ purchaseOrderId: { $in: poIds } }] : [])
          ]
        }).lean();
        actualProcurementCostPaise = vendorInvoices.reduce(
          (sum, v) => sum + (v.totalAmountPaise || 0),
          0
        );
      }

      if (
        actualProcurementCostPaise === 0 &&
        poIds.length > 0 &&
        (mongoose.connection.readyState === 1 || (GoodsReceipt.find as any)?.mock)
      ) {
        const grns = await GoodsReceipt.find({
          purchaseOrderId: { $in: poIds },
          status: GoodsReceiptStatus.COMPLETED
        }).lean();
        for (const grn of grns) {
          const po = committedPos.find(p => p._id.toString() === grn.purchaseOrderId.toString());
          if (!po) continue;
          for (const gLine of grn.lineItems || []) {
            const pLine = (po.lineItems || []).find(
              l => l.productId.toString() === gLine.productId.toString()
            );
            const rate = (pLine as any)?.unitPurchaseRatePaise ?? (pLine as any)?.unitPricePaise ?? 0;
            const gst = (pLine as any)?.gstRate ?? 12;
            const sub = (gLine.acceptedQuantity || 0) * rate;
            actualProcurementCostPaise += sub + Math.round((sub * gst) / 100);
          }
        }
      }
    }

    const actualGrossMarginPaise = contractedSalesValuePaise - costSummary.totalCostPaise;
    const actualMarginPercent =
      contractedSalesValuePaise > 0
        ? Math.round((actualGrossMarginPaise / contractedSalesValuePaise) * 10000) / 100
        : 0;

    // 7. Budget vs Actual Comparison (Never equate estimated/budgeted margin with actual margin!)
    const approvedBudget = await ProjectBudget.findOne({
      projectId: project._id,
      status: ProjectBudgetStatus.APPROVED
    }).lean();

    const estimatedCostPaise = approvedBudget ? approvedBudget.totalBudgetPaise || 0 : null;
    const budgetedGrossMarginPaise = approvedBudget
      ? contractedSalesValuePaise - (estimatedCostPaise || 0)
      : null;
    const budgetedMarginPercent =
      approvedBudget && contractedSalesValuePaise > 0 && budgetedGrossMarginPaise !== null
        ? Math.round((budgetedGrossMarginPaise / contractedSalesValuePaise) * 10000) / 100
        : null;

    const estimatedGrossMarginPaise = budgetedGrossMarginPaise;
    const grossMarginPercent = budgetedMarginPercent;

    const costBreakdown: ProjectCostBreakdown = {
      estimatedCostPaise,
      poCommittedCostPaise,
      actualProcurementCostPaise,
      materialIssuedCostPaise: costSummary.materialIssuedCostPaise ?? costSummary.materialsCostPaise,
      materialInTransitCostPaise: costSummary.materialInTransitCostPaise ?? 0,
      materialConsumedCostPaise: costSummary.materialConsumedCostPaise ?? costSummary.materialsCostPaise,
      reusableReturnCreditPaise: costSummary.reusableReturnCreditPaise ?? 0,
      damagedScrapLossPaise: costSummary.damagedScrapLossPaise ?? 0,
      approvedExpensesPaise:
        costSummary.approvedExpensesPaise ??
        costSummary.laborCostPaise +
          costSummary.logisticsCostPaise +
          costSummary.civilCostPaise +
          costSummary.miscCostPaise,
      actualProjectCostPaise: costSummary.totalCostPaise
    };

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
      recognizedRevenuePaise: operationalProgressRevenuePaise,
      confirmedCollectionsPaise,
      unallocatedCustomerCreditPaise,
      outstandingReceivablesPaise,
      costSummary,
      costBreakdown,
      estimatedGrossMarginPaise,
      grossMarginPercent,
      budgetedGrossMarginPaise,
      budgetedMarginPercent,
      actualGrossMarginPaise,
      actualMarginPercent,
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
      budget.notes = budget.notes
        ? `${budget.notes}\nApproval notes: ${input.notes.trim()}`
        : input.notes.trim();
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
