/**
 * INS Solar ERP — Accounts Panel Dashboard (Financial & Billing Workspace)
 * Tailored for Accounts Officers, Billing Executives, and CFOs.
 * Focuses on Customer Receivables, Bank Realizations, Aging Analysis, 3-Way Vendor Matching,
 * and Project Gross Profitability.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Banknote,
  Receipt,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Landmark,
  FileText,
  DollarSign,
  PackageCheck
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import { DateFilterRange, isWithinDateRange, formatPaiseToInr } from './dashboardUtils.js';

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
        return res?.data || res || { items: [] };
      } catch {
        return { items: [] };
      }
    }
  });
  const payments: any[] = paymentsData?.items || (Array.isArray(paymentsData) ? paymentsData : []);

  // 2. Fetch Sales Orders (for contract billing & receivables)
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['accountsOrders'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/orders?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch Operational Expenses
  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: ['accountsExpenses'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/expenses?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 4. Fetch Vendor Invoices
  const { data: vendorInvoices = [] } = useQuery<any[]>({
    queryKey: ['accountsVendorInvoices'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/vendor-invoices?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 5. Fetch Subsidies
  const { data: subsidies = [] } = useQuery<any[]>({
    queryKey: ['accountsSubsidies'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/subsidies?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // Date Filtering
  const filteredPayments = useMemo(
    () => payments.filter(p => isWithinDateRange(p.paymentDate || p.createdAt, dateRange)),
    [payments, dateRange]
  );
  const filteredOrders = useMemo(
    () => orders.filter(o => isWithinDateRange(o.orderDate || o.createdAt, dateRange)),
    [orders, dateRange]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter(e => isWithinDateRange(e.expenseDate || e.createdAt, dateRange)),
    [expenses, dateRange]
  );
  const filteredVendorInvoices = useMemo(
    () => vendorInvoices.filter(vi => isWithinDateRange(vi.invoiceDate || vi.createdAt, dateRange)),
    [vendorInvoices, dateRange]
  );

  // Financial KPI Calculations (integer paise)
  const totalBilledContractPaise = filteredOrders.reduce(
    (sum, o) => sum + (o.netTotalPaise || o.totalAmountPaise || 0),
    0
  );

  const verifiedPayments = filteredPayments.filter(p => p.status === 'VERIFIED');
  const recordedPayments = filteredPayments.filter(p => p.status === 'RECORDED');

  const realizedCollectionsPaise = verifiedPayments.reduce(
    (sum, p) => sum + (p.amountPaise || 0),
    0
  );
  const pendingVerificationPaise = recordedPayments.reduce(
    (sum, p) => sum + (p.amountPaise || 0),
    0
  );

  // Today's Collections
  const todayCollectionsPaise = useMemo(() => {
    return payments
      .filter(
        p => p.status === 'VERIFIED' && isWithinDateRange(p.paymentDate || p.createdAt, 'TODAY')
      )
      .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  }, [payments]);

  // Month-To-Date (MTD) Collections
  const mtdCollectionsPaise = useMemo(() => {
    return payments
      .filter(
        p =>
          p.status === 'VERIFIED' && isWithinDateRange(p.paymentDate || p.createdAt, 'THIS_MONTH')
      )
      .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  }, [payments]);

  // Total Customer Receivables
  const totalReceivablesPaise = Math.max(0, totalBilledContractPaise - realizedCollectionsPaise);

  // Total Expenses
  const totalExpensesPaise = filteredExpenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0);

  // Vendor Payables
  const totalVendorPayablesPaise = filteredVendorInvoices
    .filter(vi => vi.status === 'APPROVED' || vi.status === 'PENDING' || vi.status === 'SUBMITTED')
    .reduce((sum, vi) => sum + (vi.netTotalPaise || vi.totalAmountPaise || 0), 0);

  const unreconciledInvoicesCount = filteredVendorInvoices.filter(
    vi => vi.status !== 'RECONCILED' && vi.status !== 'PAID'
  ).length;

  // Gross Realized Margin
  const grossMarginPaise = realizedCollectionsPaise - totalExpensesPaise;

  // Receivables Aging Breakdown (0-30, 31-60, 61-90, 90+ days)
  const agingBuckets = useMemo(() => {
    const buckets = {
      current0To30: 0,
      overdue31To60: 0,
      overdue61To90: 0,
      overdueAbove90: 0
    };

    const nowTime = new Date().getTime();

    filteredOrders.forEach(o => {
      const orderDate = new Date(o.orderDate || o.createdAt || nowTime).getTime();
      const ageDays = Math.floor((nowTime - orderDate) / (1000 * 60 * 60 * 24));
      const orderTotal = o.netTotalPaise || o.totalAmountPaise || 0;
      const orderAllocated = o.allocatedAmountPaise || 0;
      const orderOutstanding = Math.max(0, orderTotal - orderAllocated);

      if (ageDays <= 30) {
        buckets.current0To30 += orderOutstanding;
      } else if (ageDays <= 60) {
        buckets.overdue31To60 += orderOutstanding;
      } else if (ageDays <= 90) {
        buckets.overdue61To90 += orderOutstanding;
      } else {
        buckets.overdueAbove90 += orderOutstanding;
      }
    });

    return buckets;
  }, [filteredOrders]);

  const overdueReceivablesPaise =
    agingBuckets.overdue31To60 + agingBuckets.overdue61To90 + agingBuckets.overdueAbove90;

  // Payment Collection Channels
  const channelBreakdown = useMemo(() => {
    const channels: Record<string, { paise: number; count: number }> = {
      UPI: { paise: 0, count: 0 },
      NEFT_RTGS: { paise: 0, count: 0 },
      BANK_TRANSFER: { paise: 0, count: 0 },
      CASH: { paise: 0, count: 0 },
      CHEQUE: { paise: 0, count: 0 },
      GATEWAY: { paise: 0, count: 0 }
    };

    verifiedPayments.forEach(p => {
      const method = (p.paymentMethod || 'BANK_TRANSFER').toUpperCase();
      const mapped =
        method === 'NEFT' || method === 'RTGS' || method === 'NEFT_RTGS'
          ? 'NEFT_RTGS'
          : method === 'UPI'
            ? 'UPI'
            : method === 'CASH'
              ? 'CASH'
              : method === 'CHEQUE'
                ? 'CHEQUE'
                : method === 'GATEWAY' || method === 'PAYMENT_GATEWAY'
                  ? 'GATEWAY'
                  : 'BANK_TRANSFER';

      if (channels[mapped]) {
        channels[mapped].paise += p.amountPaise || 0;
        channels[mapped].count++;
      }
    });

    return channels;
  }, [verifiedPayments]);

  // Operational Expenses by Category
  const expenseCategories = useMemo(() => {
    const cats: Record<string, { paise: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'GENERAL_OPERATIONAL';
      if (!cats[cat]) cats[cat] = { paise: 0, count: 0 };
      cats[cat].paise += e.amountPaise || 0;
      cats[cat].count++;
    });
    return Object.entries(cats).sort((a, b) => b[1].paise - a[1].paise);
  }, [filteredExpenses]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PART 1: ACCOUNTS QUICK ACTION BAR
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
          to="/expenses"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Receipt className="w-3.5 h-3.5 text-rose-500" />
          <span>Record Expense Voucher</span>
        </Link>
        <Link
          to="/vendor-invoices"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>Register Vendor Invoice</span>
        </Link>
        <Link
          to="/subsidies"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Landmark className="w-3.5 h-3.5 text-amber-500" />
          <span>Govt Subsidy Disbursements</span>
        </Link>
      </div>

      {/* =========================================================================
          PART 2: 10 FINANCIAL & BILLING KPIS
         ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            Financial Health & Treasury Overview
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Range: {dateRange} &bull; Exact Integer Paise Precision
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Customer Receivables */}
          <DashboardKpiCard
            title="Total Receivables"
            value={formatPaiseToInr(totalReceivablesPaise, { compact: true })}
            subtitle="Contract order balance"
            icon={CreditCard}
            to="/payments"
            color="rose"
          />

          {/* 2. Realized Bank Collections */}
          <DashboardKpiCard
            title="Realized Collections"
            value={formatPaiseToInr(realizedCollectionsPaise, { compact: true })}
            subtitle="Verified bank intake"
            icon={Banknote}
            to="/payments"
            color="emerald"
          />

          {/* 3. Pending Verification */}
          <DashboardKpiCard
            title="Pending Verification"
            value={formatPaiseToInr(pendingVerificationPaise, { compact: true })}
            subtitle={`${recordedPayments.length} unverified receipts`}
            icon={Clock}
            to="/payments"
            color="amber"
            badge={recordedPayments.length > 0 ? `${recordedPayments.length} Due` : undefined}
          />

          {/* 4. Overdue Receivables (>30d) */}
          <DashboardKpiCard
            title="Overdue Receivables"
            value={formatPaiseToInr(overdueReceivablesPaise, { compact: true })}
            subtitle="Aging > 30 calendar days"
            icon={AlertTriangle}
            to="/payments"
            color={overdueReceivablesPaise > 0 ? 'rose' : 'emerald'}
          />

          {/* 5. Today's Collections */}
          <DashboardKpiCard
            title="Today's Intake"
            value={formatPaiseToInr(todayCollectionsPaise)}
            subtitle="Realized during today"
            icon={DollarSign}
            to="/payments"
            color="blue"
          />

          {/* 6. MTD Collections */}
          <DashboardKpiCard
            title="MTD Collections"
            value={formatPaiseToInr(mtdCollectionsPaise, { compact: true })}
            subtitle="Current calendar month"
            icon={TrendingUp}
            to="/payments"
            color="sky"
          />

          {/* 7. Total Operational Expenses */}
          <DashboardKpiCard
            title="Operational Expenses"
            value={formatPaiseToInr(totalExpensesPaise, { compact: true })}
            subtitle="Approved vouchers"
            icon={Receipt}
            to="/expenses"
            color="orange"
          />

          {/* 8. Vendor Payables */}
          <DashboardKpiCard
            title="Vendor Payables"
            value={formatPaiseToInr(totalVendorPayablesPaise, { compact: true })}
            subtitle="Approved supplier bills"
            icon={Building2}
            to="/vendor-invoices"
            color="purple"
          />

          {/* 9. Unreconciled Invoices */}
          <DashboardKpiCard
            title="Unreconciled Invoices"
            value={unreconciledInvoicesCount}
            subtitle="Pending bill audit"
            icon={FileText}
            to="/vendor-invoices"
            color="cyan"
            badge={unreconciledInvoicesCount > 0 ? 'Audit Pending' : 'Reconciled'}
          />

          {/* 10. Gross Realized Margin */}
          <DashboardKpiCard
            title="Gross Realized Margin"
            value={formatPaiseToInr(grossMarginPaise, { compact: true })}
            subtitle="Collections - Expenses"
            icon={TrendingUp}
            to="/expenses"
            color={grossMarginPaise >= 0 ? 'emerald' : 'rose'}
          />
        </div>
      </div>

      {/* =========================================================================
          PART 3: RECEIVABLES AGING STATEMENT & PAYMENT CHANNELS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): 4-Bucket Receivables Aging Breakdown */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-solar-600" />
                Customer Receivables Aging Schedule
              </h2>
              <p className="text-xs text-muted-foreground">
                Maturity and collection risk buckets calculated from sales order execution dates.
              </p>
            </div>
            <Link
              to="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center self-start sm:self-auto shrink-0"
            >
              <span>Detailed Aging Ledger</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                Current (0 - 30 Days)
              </span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-200 mt-1">
                {formatPaiseToInr(agingBuckets.current0To30)}
              </div>
              <span className="text-[10px] text-emerald-600 opacity-90">Healthy credit period</span>
            </div>

            <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20">
              <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                Overdue (31 - 60 Days)
              </span>
              <div className="text-lg font-black text-amber-700 dark:text-amber-200 mt-1">
                {formatPaiseToInr(agingBuckets.overdue31To60)}
              </div>
              <span className="text-[10px] text-amber-600 opacity-90">Follow-up reminder due</span>
            </div>

            <div className="p-3.5 rounded-xl border bg-orange-500/10 border-orange-500/20">
              <span className="text-[11px] font-bold uppercase text-orange-700 dark:text-orange-300">
                Overdue (61 - 90 Days)
              </span>
              <div className="text-lg font-black text-orange-700 dark:text-orange-200 mt-1">
                {formatPaiseToInr(agingBuckets.overdue61To90)}
              </div>
              <span className="text-[10px] text-orange-600 opacity-90">Formal notice required</span>
            </div>

            <div className="p-3.5 rounded-xl border bg-rose-500/10 border-rose-500/20">
              <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-300">
                Critical (90+ Days)
              </span>
              <div className="text-lg font-black text-rose-700 dark:text-rose-200 mt-1">
                {formatPaiseToInr(agingBuckets.overdueAbove90)}
              </div>
              <span className="text-[10px] text-rose-600 opacity-90">High credit risk</span>
            </div>
          </div>

          {/* Visual Aging Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Aging Distribution</span>
              <span>Total: {formatPaiseToInr(totalReceivablesPaise)}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 flex overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 transition-all"
                style={{
                  width: `${totalReceivablesPaise > 0 ? (agingBuckets.current0To30 / totalReceivablesPaise) * 100 : 25}%`
                }}
                title="Current 0-30 Days"
              />
              <div
                className="bg-amber-500 h-2.5 transition-all"
                style={{
                  width: `${totalReceivablesPaise > 0 ? (agingBuckets.overdue31To60 / totalReceivablesPaise) * 100 : 25}%`
                }}
                title="Overdue 31-60 Days"
              />
              <div
                className="bg-orange-500 h-2.5 transition-all"
                style={{
                  width: `${totalReceivablesPaise > 0 ? (agingBuckets.overdue61To90 / totalReceivablesPaise) * 100 : 25}%`
                }}
                title="Overdue 61-90 Days"
              />
              <div
                className="bg-rose-500 h-2.5 transition-all"
                style={{
                  width: `${totalReceivablesPaise > 0 ? (agingBuckets.overdueAbove90 / totalReceivablesPaise) * 100 : 25}%`
                }}
                title="Critical 90+ Days"
              />
            </div>
          </div>
        </div>

        {/* Right (1 col): Payment Collection Channels */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              Realized Channels Breakdown
            </h2>
            <p className="text-xs text-muted-foreground">Collections by banking instrument.</p>
          </div>

          <div className="space-y-2.5 text-xs">
            {Object.entries(channelBreakdown).map(([chKey, data]) => {
              const label =
                chKey === 'NEFT_RTGS'
                  ? 'NEFT / RTGS'
                  : chKey === 'BANK_TRANSFER'
                    ? 'Bank Transfer / IMPS'
                    : chKey;

              const percent =
                realizedCollectionsPaise > 0
                  ? Math.round((data.paise / realizedCollectionsPaise) * 100)
                  : 0;

              return (
                <div key={chKey} className="p-2.5 rounded-xl bg-secondary/30 border space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">{label}</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatPaiseToInr(data.paise)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{data.count} Payments</span>
                    <span>{percent}% share</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PART 4: VENDOR BILLS AUDIT & OPERATIONAL EXPENSE LEDGER
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Invoices & Bill Audit Health */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Vendor Bills &amp; Payment Audit
              </h2>
              <p className="text-xs text-muted-foreground">
                Verification of supplier equipment invoices, tax compliance, and payment clearance.
              </p>
            </div>
            <Link
              to="/vendor-invoices"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center shrink-0"
            >
              <span>View All Bills</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <PackageCheck className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">Total Vendor Invoices Logged</span>
              </div>
              <span className="font-bold text-foreground">{vendorInvoices.length} Bills</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-medium">Fully Reconciled &amp; Paid</span>
              </div>
              <span className="font-bold text-emerald-600">
                {
                  vendorInvoices.filter(vi => vi.status === 'RECONCILED' || vi.status === 'PAID')
                    .length
                }{' '}
                Invoices
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium">Pending Audit &amp; Clearance</span>
              </div>
              <span className="font-bold text-amber-600">{unreconciledInvoicesCount} Invoices</span>
            </div>

            {subsidies.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border">
                <div className="flex items-center space-x-2.5">
                  <Landmark className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Govt Subsidy DBT Claims</span>
                </div>
                <span className="font-bold text-emerald-600">{subsidies.length} Claims</span>
              </div>
            )}
          </div>
        </div>

        {/* Operational Expenses by Category */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                Operational Expenses by Category
              </h2>
              <p className="text-xs text-muted-foreground">
                Incurred site installation, logistics, and engineering costs.
              </p>
            </div>
            <Link
              to="/expenses"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center shrink-0"
            >
              <span>Expense Vouchers</span>
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
                  <span className="font-mono font-bold text-rose-600">
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
