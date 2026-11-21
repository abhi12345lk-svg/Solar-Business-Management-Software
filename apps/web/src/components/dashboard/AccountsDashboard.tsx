/**
 * INS Solar ERP — Accounts Panel Dashboard (Financial & Billing Workspace)
 * Strictly mapped to the actual operational modules of the Accounts Panel:
 * 1. Customer Billing & Milestone Inflow (/payments)
 * 2. Govt Subsidy DBT Inflow (/subsidies)
 * 3. Equipment Purchase Bills Outflow (/vendor-invoices)
 * 4. Site Expenses & Labor Outflow (/expenses)
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
  Landmark,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import {
  DateFilterRange,
  isWithinDateRange,
  formatPaiseToInr,
  formatShortDate
} from './dashboardUtils.js';

interface AccountsDashboardProps {
  dateRange: DateFilterRange;
}

export const AccountsDashboard: React.FC<AccountsDashboardProps> = ({ dateRange }) => {
  // 1. Fetch Customer Payments
  const { data: paymentsData } = useQuery<any>({
    queryKey: ['accountsPayments'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/payments?limit=100');
        return res;
      } catch {
        return { items: [] };
      }
    }
  });
  const payments: any[] = useMemo(() => {
    if (Array.isArray(paymentsData)) return paymentsData;
    return paymentsData?.items || paymentsData?.data?.items || paymentsData?.data || [];
  }, [paymentsData]);

  // 2. Fetch Vendor Invoices
  const { data: vendorInvoicesData } = useQuery<any>({
    queryKey: ['accountsVendorInvoices'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/vendor-invoices?limit=100');
        return res;
      } catch {
        return [];
      }
    }
  });
  const vendorInvoices: any[] = useMemo(() => {
    if (Array.isArray(vendorInvoicesData)) return vendorInvoicesData;
    return (
      vendorInvoicesData?.items ||
      vendorInvoicesData?.data?.items ||
      vendorInvoicesData?.data ||
      []
    );
  }, [vendorInvoicesData]);

  // 3. Fetch Subsidies
  const { data: subsidiesData } = useQuery<any>({
    queryKey: ['accountsSubsidies'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/subsidies?limit=100');
        return res;
      } catch {
        return [];
      }
    }
  });
  const subsidies: any[] = useMemo(() => {
    if (Array.isArray(subsidiesData)) return subsidiesData;
    return (
      subsidiesData?.applications ||
      subsidiesData?.items ||
      subsidiesData?.data ||
      []
    );
  }, [subsidiesData]);

  // 4. Fetch Site Expenses
  const { data: expensesData } = useQuery<any>({
    queryKey: ['accountsExpenses'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/expenses?limit=100');
        return res;
      } catch {
        return [];
      }
    }
  });
  const expenses: any[] = useMemo(() => {
    if (Array.isArray(expensesData)) return expensesData;
    return (
      expensesData?.data?.data ||
      expensesData?.data ||
      expensesData?.items ||
      []
    );
  }, [expensesData]);

  // Date Filtering
  const filteredPayments = useMemo(
    () => payments.filter(p => isWithinDateRange(p.paymentDate || p.createdAt, dateRange)),
    [payments, dateRange]
  );

  const filteredVendorInvoices = useMemo(
    () =>
      vendorInvoices.filter(
        vi =>
          vi.status !== 'CANCELLED' &&
          isWithinDateRange(vi.invoiceDate || vi.createdAt, dateRange)
      ),
    [vendorInvoices, dateRange]
  );

  const filteredSubsidies = useMemo(
    () => subsidies.filter(s => isWithinDateRange(s.createdAt || s.updatedAt, dateRange)),
    [subsidies, dateRange]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        e =>
          e.status !== 'CANCELLED' &&
          e.status !== 'REJECTED' &&
          isWithinDateRange(e.expenseDate || e.createdAt, dateRange)
      ),
    [expenses, dateRange]
  );

  // Financial Calculations (integer paise precision)
  const verifiedPayments = filteredPayments.filter(
    p => (p.status || '').toUpperCase() === 'VERIFIED'
  );
  const pendingPayments = filteredPayments.filter(
    p =>
      (p.status || '').toUpperCase() === 'RECORDED' ||
      (p.status || '').toUpperCase() === 'PENDING'
  );

  const realizedCollectionsPaise = verifiedPayments.reduce(
    (sum, p) => sum + (p.amountPaise || (p.amount ? Math.round(p.amount * 100) : 0) || 0),
    0
  );

  // Govt DBT Subsidies
  const totalSubsidyDisbursedPaise = filteredSubsidies.reduce(
    (sum, s) =>
      sum + (s.disbursedAmountPaise || (s.disbursedAmount ? Math.round(s.disbursedAmount * 100) : 0) || 0),
    0
  );

  const pendingSubsidies = filteredSubsidies.filter(
    s => (s.status || '').toUpperCase() !== 'DISBURSED' && (s.status || '').toUpperCase() !== 'REJECTED'
  );

  const totalSubsidyPendingPaise = pendingSubsidies.reduce((sum, s) => {
    const requested = s.approvedAmountPaise || s.requestedAmountPaise || 0;
    const disbursed = s.disbursedAmountPaise || 0;
    return sum + Math.max(0, requested - disbursed);
  }, 0);

  // Vendor Outflows & Payables
  const totalVendorPaidPaise = filteredVendorInvoices.reduce(
    (sum, vi) =>
      sum + (vi.paidAmountPaise || (vi.paidAmount ? Math.round(vi.paidAmount * 100) : 0) || 0),
    0
  );

  const totalVendorPayablesPaise = filteredVendorInvoices.reduce((sum, vi) => {
    if (vi.balancePayablePaise !== undefined) return sum + vi.balancePayablePaise;
    const tot = vi.totalAmountPaise || (vi.totalAmount ? Math.round(vi.totalAmount * 100) : 0) || 0;
    const paid = vi.paidAmountPaise || (vi.paidAmount ? Math.round(vi.paidAmount * 100) : 0) || 0;
    return sum + Math.max(0, tot - paid);
  }, 0);

  const pendingVendorBillsCount = filteredVendorInvoices.filter(
    vi => (vi.status || '').toUpperCase() !== 'PAID' && (vi.status || '').toUpperCase() !== 'RECONCILED'
  ).length;

  // Site Expenses
  const totalExpensesPaise = filteredExpenses.reduce(
    (sum, e) => sum + (e.amountPaise || (e.amount ? Math.round(e.amount * 100) : 0) || 0),
    0
  );

  // Net Cash Flow: Inflow (Customer Collections + Disbursed Subsidy) - Outflow (Vendor Paid + Site Expenses)
  const totalInflowPaise = realizedCollectionsPaise + totalSubsidyDisbursedPaise;
  const totalOutflowPaise = totalVendorPaidPaise + totalExpensesPaise;
  const netCashFlowPaise = totalInflowPaise - totalOutflowPaise;

  // Expenses Categorization
  const expenseCategories = useMemo(() => {
    const cats: Record<string, { paise: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'OPERATIONAL_SITE_LABOR';
      if (!cats[cat]) cats[cat] = { paise: 0, count: 0 };
      cats[cat].paise +=
        e.amountPaise || (e.amount ? Math.round(e.amount * 100) : 0) || 0;
      cats[cat].count++;
    });
    return Object.entries(cats).sort((a, b) => b[1].paise - a[1].paise);
  }, [filteredExpenses]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PART 1: ACCOUNTS QUICK ACTION LAUNCHPAD (Strictly Accounts Modules)
         ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-card border shadow-xs">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 shrink-0">
          Financial Actions:
        </span>
        <Link
          to="/payments"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Customer Payment</span>
        </Link>
        <Link
          to="/vendor-invoices"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Receipt className="w-3.5 h-3.5 text-purple-500" />
          <span>Equipment Purchase Bills</span>
        </Link>
        <Link
          to="/subsidies"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Landmark className="w-3.5 h-3.5 text-amber-500" />
          <span>Govt Subsidy (DBT)</span>
        </Link>
        <Link
          to="/expenses"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
          <span>Site Expenses &amp; Labor</span>
        </Link>
      </div>

      {/* =========================================================================
          PART 2: 5 CORE FINANCIAL HEALTH KPIS (Inflow, Outflow & Net Balance)
         ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            Treasury &amp; Cash Flow Overview
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Range: {dateRange} &bull; Exact Rupee Precision
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Customer Collections (Inflow) */}
          <DashboardKpiCard
            title="Customer Collections"
            value={formatPaiseToInr(realizedCollectionsPaise, { compact: true })}
            subtitle={
              pendingPayments.length > 0
                ? `${pendingPayments.length} receipts pending verification`
                : 'All receipts verified'
            }
            icon={Banknote}
            to="/payments"
            color="emerald"
            badge={pendingPayments.length > 0 ? `${pendingPayments.length} Due` : undefined}
          />

          {/* 2. Govt Subsidy DBT (Inflow) */}
          <DashboardKpiCard
            title="Govt Subsidy (DBT)"
            value={formatPaiseToInr(totalSubsidyDisbursedPaise, { compact: true })}
            subtitle={
              pendingSubsidies.length > 0
                ? `${pendingSubsidies.length} claims pending portal`
                : 'All DBT claims settled'
            }
            icon={Landmark}
            to="/subsidies"
            color="amber"
          />

          {/* 3. Vendor Equipment Bills (Outflow) */}
          <DashboardKpiCard
            title="Vendor Purchase Bills"
            value={formatPaiseToInr(totalVendorPaidPaise, { compact: true })}
            subtitle={`Due: ${formatPaiseToInr(totalVendorPayablesPaise, { compact: true })} (${pendingVendorBillsCount} bills)`}
            icon={Receipt}
            to="/vendor-invoices"
            color="purple"
            badge={pendingVendorBillsCount > 0 ? 'Payable Due' : 'Cleared'}
          />

          {/* 4. Site Expenses & Labor (Outflow) */}
          <DashboardKpiCard
            title="Site Expenses &amp; Labor"
            value={formatPaiseToInr(totalExpensesPaise, { compact: true })}
            subtitle={`${filteredExpenses.length} approved vouchers`}
            icon={TrendingUp}
            to="/expenses"
            color="orange"
          />

          {/* 5. Net Cash Flow */}
          <DashboardKpiCard
            title="Net Cash Flow"
            value={formatPaiseToInr(netCashFlowPaise, { compact: true })}
            subtitle="Total Inflow minus Outflow"
            icon={CreditCard}
            to="/payments"
            color={netCashFlowPaise >= 0 ? 'teal' : 'rose'}
          />
        </div>
      </div>

      {/* =========================================================================
          PART 3: SOLAR FINANCIAL FLOW: STEP-BY-STEP ARCHITECTURE BANNER
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Solar Financial Flow: Step-By-Step Architecture
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            Treasury Synchronization
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Link
            to="/payments"
            className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-left flex items-start space-x-3 group"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              1
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 truncate">
                Customer Advance (20%)
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Inflow: Booking collection at /payments
              </div>
            </div>
          </Link>

          <Link
            to="/vendor-invoices"
            className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-all text-left flex items-start space-x-3 group"
          >
            <div className="w-6 h-6 rounded-lg bg-purple-500 text-white font-black text-xs flex items-center justify-center shrink-0">
              2
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-purple-600 truncate">
                Vendor Purchase Bills
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Outflow: Material &amp; BOS at /vendor-invoices
              </div>
            </div>
          </Link>

          <Link
            to="/payments"
            className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-left flex items-start space-x-3 group"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              3
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 truncate">
                Dispatch &amp; Handover (80%)
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Inflow: 70% delivery + 10% commissioning
              </div>
            </div>
          </Link>

          <Link
            to="/subsidies"
            className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-left flex items-start space-x-3 group"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              4
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-amber-600 truncate">
                Govt Subsidy (DBT)
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Inflow: Portal claim at /subsidies
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          PART 4: TWO OPERATIONAL SECTIONS: CUSTOMER INFLOW VS VENDOR OUTFLOW
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Customer Payments & Collections (/payments) */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Customer Receipts &amp; Milestone Collections
              </h2>
              <p className="text-xs text-muted-foreground">
                Inflow receipts linked to customer project milestones (Advance, Dispatch, Handover).
              </p>
            </div>
            <Link
              to="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center shrink-0"
            >
              <span>View All Receipts</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <Banknote className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>No customer payment receipts recorded yet.</p>
              <Link
                to="/payments"
                className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 hover:underline"
              >
                <span>+ Record Customer Receipt</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPayments.slice(0, 5).map((p: any) => {
                const recNum = p.receiptNumber || p.paymentNumber || 'REC-2026';
                const custName =
                  p.customerName ||
                  p.customerId?.legalName ||
                  p.customerId?.name ||
                  'Customer';
                const stage =
                  p.milestoneStage ||
                  p.stage ||
                  (p.paymentType === 'ADVANCE' ? 'Advance Receipt' : 'Milestone Payment');
                const isVerified = (p.status || '').toUpperCase() === 'VERIFIED';
                const amountPaise =
                  p.amountPaise || (p.amount ? Math.round(p.amount * 100) : 0) || 0;

                return (
                  <div
                    key={p._id || p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                          {recNum}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                          }`}
                        >
                          {isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {custName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{stage}</span>
                        <span>&bull;</span>
                        <span>{p.paymentMethod || 'BANK TRANSFER'}</span>
                        <span>&bull;</span>
                        <span>{formatShortDate(p.paymentDate || p.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                      <div className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                        +{formatPaiseToInr(amountPaise)}
                      </div>
                      <Link
                        to="/payments"
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center mt-0.5"
                      >
                        <span>Receipt</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Vendor Purchase Bills (/vendor-invoices) */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                Equipment Purchase Bills &amp; Supplier Dues
              </h2>
              <p className="text-xs text-muted-foreground">
                Outflow bills for solar panels, inverters, structures &amp; BOS components.
              </p>
            </div>
            <Link
              to="/vendor-invoices"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center shrink-0"
            >
              <span>View All Bills</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {filteredVendorInvoices.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>No vendor purchase bills recorded yet.</p>
              <Link
                to="/vendor-invoices"
                className="inline-flex items-center space-x-1 text-xs font-bold text-purple-600 hover:underline"
              >
                <span>+ Register Vendor Invoice</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredVendorInvoices.slice(0, 5).map((vi: any) => {
                const invNum = vi.invoiceNumber || 'INV-VEND';
                const vendName =
                  vi.vendorName ||
                  vi.vendorId?.name ||
                  vi.vendorId?.companyName ||
                  'Solar Supplier';
                const status = (vi.status || 'VERIFIED').toUpperCase();
                const totalPaise =
                  vi.totalAmountPaise ||
                  (vi.totalAmount ? Math.round(vi.totalAmount * 100) : 0) ||
                  0;
                const paidPaise =
                  vi.paidAmountPaise ||
                  (vi.paidAmount ? Math.round(vi.paidAmount * 100) : 0) ||
                  0;
                const balancePaise =
                  vi.balancePayablePaise !== undefined
                    ? vi.balancePayablePaise
                    : Math.max(0, totalPaise - paidPaise);

                const statusColor =
                  status === 'PAID' || status === 'RECONCILED'
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                    : status === 'PARTIALLY_PAID'
                      ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-700 border-amber-500/20';

                return (
                  <div
                    key={vi._id || vi.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-400">
                          {invNum}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusColor}`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {vendName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>Total: {formatPaiseToInr(totalPaise)}</span>
                        <span>&bull;</span>
                        <span>{formatShortDate(vi.invoiceDate || vi.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                      <div className="text-xs font-bold font-mono">
                        {balancePaise > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            Due: {formatPaiseToInr(balancePaise)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Paid In Full</span>
                        )}
                      </div>
                      <Link
                        to="/vendor-invoices"
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline inline-flex items-center mt-0.5"
                      >
                        <span>Bill Details</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          PART 5: SECONDARY FINANCIAL MODULES: GOVT SUBSIDIES & SITE EXPENSES
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PM Surya Ghar Govt Subsidies Status (/subsidies) */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-600" />
                Govt Subsidy (DBT) Claims Status
              </h2>
              <p className="text-xs text-muted-foreground">
                Central Financial Assistance (CFA) claims under PM Surya Ghar Muft Bijli Yojana.
              </p>
            </div>
            <Link
              to="/subsidies"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center shrink-0"
            >
              <span>View Subsidy Ledger</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <Landmark className="w-4 h-4 text-amber-500" />
                <span className="font-medium">Total DBT Subsidy Applications</span>
              </div>
              <span className="font-bold text-foreground">{subsidies.length} Claims</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">Direct DBT Disbursed Inflow</span>
              </div>
              <span className="font-bold text-emerald-600">
                {formatPaiseToInr(totalSubsidyDisbursedPaise)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium">Pending Claims With DISCOM / Portal</span>
              </div>
              <span className="font-bold text-amber-600">
                {pendingSubsidies.length} Claims ({formatPaiseToInr(totalSubsidyPendingPaise)})
              </span>
            </div>
          </div>
        </div>

        {/* Site Installation & Labor Expenses (/expenses) */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                Site Expenses &amp; Labor Vouchers
              </h2>
              <p className="text-xs text-muted-foreground">
                Breakdown of project installation labor, equipment logistics &amp; site charges.
              </p>
            </div>
            <Link
              to="/expenses"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center shrink-0"
            >
              <span>View All Expenses</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {expenseCategories.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No operational expenses recorded for this date range.
            </div>
          ) : (
            <div className="space-y-2.5 text-xs max-h-56 overflow-y-auto pr-1">
              {expenseCategories.map(([cat, data]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 border"
                >
                  <div>
                    <span className="font-bold text-foreground">{cat.replace(/_/g, ' ')}</span>
                    <div className="text-[10px] text-muted-foreground">{data.count} vouchers</div>
                  </div>
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                    {formatPaiseToInr(data.paise)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
