/**
 * INS Solar Business Management Software — Project Costing & Profitability Tab
 *
 * Operational costing & margin analytics:
 * - Authoritative cost ledger (materials consumed + direct project expenses)
 * - Anti-double-counting guarantees (POs, GRNs excluded)
 * - Sales order contracted value vs milestone progress revenue vs customer collections
 * - Budget-vs-actual variance comparison by cost category
 * - Budget revision manager modal
 * - Mandatory operational costing disclaimer
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Truck,
  Plus,
  RefreshCw,
  Layers,
  Info
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface CostLedgerEntry {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  costCategory: string;
  description: string;
  quantity?: number;
  unitRatePaise?: number;
  amountPaise: number;
  effectiveDate: string;
  status: string;
  paymentStatus?: string;
}

interface BudgetCategory {
  plannedPaise: number;
  actualPaise: number;
  variancePaise: number;
}

interface ProfitabilityData {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerId: string;
  systemCapacityKwp?: number;
  currentStage: string;
  projectStatus: string;
  hasConfirmedOrder: boolean;
  orderNumber?: string;
  contractedSalesValuePaise: number;
  operationalProgressPercent: number;
  operationalProgressRevenuePaise: number;
  confirmedCollectionsPaise: number;
  unallocatedCustomerCreditPaise: number;
  outstandingReceivablesPaise: number;
  costSummary: {
    materialsCostPaise: number;
    laborCostPaise: number;
    logisticsCostPaise: number;
    civilCostPaise: number;
    miscCostPaise: number;
    totalCostPaise: number;
  };
  estimatedGrossMarginPaise: number;
  grossMarginPercent: number;
  budgetComparison: {
    hasApprovedBudget: boolean;
    budgetVersion?: number;
    approvedAt?: string;
    materials: BudgetCategory;
    labor: BudgetCategory;
    logistics: BudgetCategory;
    civil: BudgetCategory;
    misc: BudgetCategory;
    contingency: BudgetCategory;
    total: BudgetCategory;
  };
  isDataComplete: boolean;
  dataCompletenessNotes: string[];
  disclaimer: string;
}

interface BudgetVersion {
  _id: string;
  version: number;
  status: string;
  totalBudgetPaise: number;
  materialsBudgetPaise: number;
  laborBudgetPaise: number;
  logisticsBudgetPaise: number;
  civilBudgetPaise: number;
  miscBudgetPaise: number;
  contingencyBudgetPaise: number;
  revisionReason?: string;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string };
}

interface ProjectCostingTabProps {
  projectId: string;
}

export const ProjectCostingTab: React.FC<ProjectCostingTabProps> = ({ projectId }) => {
  const [report, setReport] = useState<ProfitabilityData | null>(null);
  const [costLedger, setCostLedger] = useState<CostLedgerEntry[]>([]);
  const [budgets, setBudgets] = useState<BudgetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  // Budget Modals
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [createBudgetOpen, setCreateBudgetOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    materialsRupees: '',
    laborRupees: '',
    logisticsRupees: '',
    civilRupees: '',
    miscRupees: '',
    contingencyRupees: '',
    notes: '',
    revisionReason: ''
  });
  const [submittingBudget, setSubmittingBudget] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profitRes, ledgerRes, budgetsRes] = await Promise.all([
        apiClient<ProfitabilityData>(`/projects/${projectId}/profitability`),
        apiClient<{ entries: CostLedgerEntry[] }>(`/projects/${projectId}/cost-ledger`),
        apiClient<BudgetVersion[]>(`/projects/${projectId}/budgets`)
      ]);

      if (profitRes) {
        setReport(profitRes);
      }
      if (ledgerRes?.entries) {
        setCostLedger(ledgerRes.entries);
      }
      if (budgetsRes) {
        setBudgets(budgetsRes);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message || err?.message || 'Failed to load project costing data.'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatPaise = (paise?: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBudget(true);
    setError(null);
    try {
      const materialsBudgetPaise = Math.round(parseFloat(budgetForm.materialsRupees || '0') * 100);
      const laborBudgetPaise = Math.round(parseFloat(budgetForm.laborRupees || '0') * 100);
      const logisticsBudgetPaise = Math.round(parseFloat(budgetForm.logisticsRupees || '0') * 100);
      const civilBudgetPaise = Math.round(parseFloat(budgetForm.civilRupees || '0') * 100);
      const miscBudgetPaise = Math.round(parseFloat(budgetForm.miscRupees || '0') * 100);
      const contingencyBudgetPaise = Math.round(
        parseFloat(budgetForm.contingencyRupees || '0') * 100
      );

      await apiClient(`/projects/${projectId}/budgets`, {
        method: 'POST',
        body: JSON.stringify({
          materialsBudgetPaise,
          laborBudgetPaise,
          logisticsBudgetPaise,
          civilBudgetPaise,
          miscBudgetPaise,
          contingencyBudgetPaise,
          notes: budgetForm.notes.trim() || undefined,
          revisionReason: budgetForm.revisionReason.trim() || undefined
        })
      });

      setCreateBudgetOpen(false);
      setBudgetForm({
        materialsRupees: '',
        laborRupees: '',
        logisticsRupees: '',
        civilRupees: '',
        miscRupees: '',
        contingencyRupees: '',
        notes: '',
        revisionReason: ''
      });
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to create budget.');
    } finally {
      setSubmittingBudget(false);
    }
  };

  const handleApproveBudget = async (budgetId: string) => {
    setSubmittingBudget(true);
    setError(null);
    try {
      await apiClient(`/projects/${projectId}/budgets/${budgetId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Approved as current baseline'
        })
      });
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to approve budget.');
    } finally {
      setSubmittingBudget(false);
    }
  };

  const filteredEntries = costLedger.filter((entry) => {
    if (sourceFilter === 'ALL') return true;
    return entry.sourceType === sourceFilter;
  });

  if (loading && !report) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-600" />
        Loading project costing and profitability analysis...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Top Banner: Data Completeness & Disclaimer */}
      {report && (
        <div className="space-y-3">
          {!report.isDataComplete && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 text-sm flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Incomplete Financial Data Notice</span>
                <p className="text-xs text-amber-700 mt-0.5">
                  Profitability metrics represent recorded entries only. The following data points are missing:
                </p>
                <ul className="list-disc list-inside text-xs mt-1 text-amber-800">
                  {report.dataCompletenessNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/40 border rounded-xl flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{report.disclaimer}</span>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Contracted Order Value
            </span>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatPaise(report.contractedSalesValuePaise)}
            </p>
            <p className="text-xs text-muted-foreground">
              {report.orderNumber ? `Order: ${report.orderNumber}` : 'No confirmed order'}
            </p>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Customer Collections
            </span>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatPaise(report.confirmedCollectionsPaise)}
            </p>
            <p className="text-xs text-muted-foreground">
              Outstanding: {formatPaise(report.outstandingReceivablesPaise)}
            </p>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Incurred Cost
            </span>
            <p className="text-xl font-bold text-foreground font-mono">
              {formatPaise(report.costSummary.totalCostPaise)}
            </p>
            <p className="text-xs text-muted-foreground">
              Materials: {formatPaise(report.costSummary.materialsCostPaise)} | Direct: {formatPaise(report.costSummary.totalCostPaise - report.costSummary.materialsCostPaise)}
            </p>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-solar-600 uppercase tracking-wider flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Estimated Gross Margin
            </span>
            <div className="flex items-baseline space-x-2">
              <p className="text-xl font-bold text-foreground font-mono">
                {formatPaise(report.estimatedGrossMarginPaise)}
              </p>
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  report.grossMarginPercent >= 20
                    ? 'bg-emerald-100 text-emerald-800'
                    : report.grossMarginPercent >= 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {report.grossMarginPercent.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Progress Revenue: {formatPaise(report.operationalProgressRevenuePaise)} ({report.operationalProgressPercent}%)
            </p>
          </div>
        </div>
      )}

      {/* Budget vs Actual Comparison Card */}
      {report && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-solar-600" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Budget versus Actual Cost Analysis
                </h3>
                <p className="text-xs text-muted-foreground">
                  {report.budgetComparison.hasApprovedBudget
                    ? `Compared against baseline budget Version ${report.budgetComparison.budgetVersion}`
                    : 'No approved baseline budget active. Create a project budget to track variances.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setBudgetModalOpen(true)}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted"
              >
                Version History ({budgets.length})
              </button>
              <button
                onClick={() => setCreateBudgetOpen(true)}
                className="px-3 py-1.5 bg-solar-600 text-white rounded-lg text-xs font-medium hover:bg-solar-700 flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Revision
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/50 border-b uppercase tracking-wider text-muted-foreground text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Cost Category</th>
                  <th className="py-2.5 px-4 text-right">Planned Budget</th>
                  <th className="py-2.5 px-4 text-right">Actual Incurred</th>
                  <th className="py-2.5 px-4 text-right">Variance</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { label: 'Materials Consumed', data: report.budgetComparison.materials },
                  { label: 'Installation Labor', data: report.budgetComparison.labor },
                  { label: 'Logistics & Crane Hire', data: report.budgetComparison.logistics },
                  { label: 'Civil Works & Foundation', data: report.budgetComparison.civil },
                  { label: 'Consumables & Overheads', data: report.budgetComparison.misc },
                  { label: 'Contingency Reserve', data: report.budgetComparison.contingency }
                ].map((row, idx) => {
                  const isOver = row.data.variancePaise > 0;
                  return (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="py-2 px-4 font-medium">{row.label}</td>
                      <td className="py-2 px-4 text-right font-mono">
                        {formatPaise(row.data.plannedPaise)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold">
                        {formatPaise(row.data.actualPaise)}
                      </td>
                      <td
                        className={`py-2 px-4 text-right font-mono font-bold ${
                          isOver ? 'text-destructive' : 'text-emerald-600'
                        }`}
                      >
                        {row.data.variancePaise > 0 ? '+' : ''}
                        {formatPaise(row.data.variancePaise)}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.data.plannedPaise === 0
                              ? 'bg-muted text-muted-foreground'
                              : isOver
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {row.data.plannedPaise === 0
                            ? 'Unbudgeted'
                            : isOver
                            ? 'Over Budget'
                            : 'Within Budget'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-bold border-t">
                  <td className="py-2.5 px-4">Total Project Cost</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatPaise(report.budgetComparison.total.plannedPaise)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatPaise(report.budgetComparison.total.actualPaise)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono ${
                      report.budgetComparison.total.variancePaise > 0
                        ? 'text-destructive'
                        : 'text-emerald-600'
                    }`}
                  >
                    {report.budgetComparison.total.variancePaise > 0 ? '+' : ''}
                    {formatPaise(report.budgetComparison.total.variancePaise)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        report.budgetComparison.total.variancePaise > 0
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {report.budgetComparison.total.variancePaise > 0
                        ? 'Exceeding Budget'
                        : 'On Budget'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Ledger Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center">
              <DollarSign className="w-4 h-4 mr-1 text-solar-600" /> Project Cost Ledger
            </h3>
            <p className="text-xs text-muted-foreground">
              Line-item entries derived from physical material issues and approved project expenses.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs rounded-lg border bg-background px-2.5 py-1.5 text-foreground"
            >
              <option value="ALL">All Sources ({costLedger.length})</option>
              <option value="MATERIAL_DISPATCH">Materials Dispatched</option>
              <option value="EXPENSE">Direct Expenses</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/50 border-b uppercase tracking-wider text-muted-foreground text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Reference #</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Item / Description</th>
                <th className="py-2.5 px-4 text-right">Qty & Rate</th>
                <th className="py-2.5 px-4 text-right">Incurred Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No cost entries recorded under current filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground">
                      {new Date(entry.effectiveDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted">
                        {entry.sourceType === 'MATERIAL_DISPATCH' ? (
                          <>
                            <Truck className="w-3 h-3 mr-1 text-blue-600" /> Dispatch
                          </>
                        ) : (
                          <>
                            <Receipt className="w-3 h-3 mr-1 text-emerald-600" /> Expense
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-solar-600">
                      {entry.sourceNumber}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{entry.costCategory}</td>
                    <td className="py-2.5 px-4 max-w-xs truncate">{entry.description}</td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {entry.quantity ? (
                        <>
                          {entry.quantity} @ {formatPaise(entry.unitRatePaise)}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {formatPaise(entry.amountPaise)}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Version History */}
      {budgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center">
                <Layers className="w-5 h-5 mr-2 text-solar-600" /> Project Budget Version History
              </h3>
              <button
                onClick={() => setBudgetModalOpen(false)}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {budgets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No budget revisions found.
                </p>
              ) : (
                budgets.map((b) => (
                  <div key={b._id} className="p-3 border rounded-lg space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">
                        Version {b.version}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          b.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'SUPERSEDED'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Planned:</span>
                      <span className="font-mono font-bold text-foreground">
                        {formatPaise(b.totalBudgetPaise)}
                      </span>
                    </div>
                    {b.revisionReason && (
                      <div className="text-muted-foreground italic">Reason: {b.revisionReason}</div>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t text-[11px] text-muted-foreground">
                      <span>Created {new Date(b.createdAt).toLocaleDateString()}</span>
                      {b.status === 'DRAFT' && (
                        <button
                          onClick={() => handleApproveBudget(b._id)}
                          disabled={submittingBudget}
                          className="px-2 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Set as Active Baseline
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBudgetModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create New Budget Revision */}
      {createBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground flex items-center">
              <Plus className="w-5 h-5 mr-2 text-solar-600" /> Create Budget Baseline Revision
            </h3>
            <p className="text-xs text-muted-foreground">
              Define planned amounts in INR for each cost category. Previous versions are preserved.
            </p>

            <form onSubmit={handleCreateBudget} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Materials Budget (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 450000"
                  value={budgetForm.materialsRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, materialsRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Installation Labor Budget (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 50000"
                  value={budgetForm.laborRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, laborRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Logistics & Crane Hire (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 15000"
                  value={budgetForm.logisticsRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, logisticsRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Civil Foundation Works (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 20000"
                  value={budgetForm.civilRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, civilRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Consumables & Miscellaneous (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 10000"
                  value={budgetForm.miscRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, miscRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Contingency Reserve (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 15000"
                  value={budgetForm.contingencyRupees}
                  onChange={(e) => setBudgetForm({ ...budgetForm, contingencyRupees: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Revision Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Initial engineering estimate or change order revision"
                  value={budgetForm.revisionReason}
                  onChange={(e) => setBudgetForm({ ...budgetForm, revisionReason: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-foreground"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCreateBudgetOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBudget}
                  className="px-3 py-1.5 bg-solar-600 text-white rounded-lg text-xs font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submittingBudget ? 'Saving...' : 'Create Budget Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
