/**
 * INS Solar ERP — Admin Panel Dashboard (Executive Operations Control Room)
 * Provides centralized executive visibility across Sales, 10-Stage Project Delivery,
 * Multi-Location Inventory, Procurement, and Financial Health.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  ShoppingCart,
  Boxes,
  CreditCard,
  Building2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Zap,
  PackageCheck,
  ArrowUpRight,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import {
  DateFilterRange,
  isWithinDateRange,
  formatPaiseToInr,
  formatRelativeTime
} from './dashboardUtils.js';

interface AdminDashboardProps {
  dateRange: DateFilterRange;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ dateRange }) => {
  // 1. Fetch Customers
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['adminCustomers'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/customers?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 2. Fetch Leads
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['adminLeads'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/leads?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch Quotations
  const { data: quotations = [] } = useQuery<any[]>({
    queryKey: ['adminQuotations'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/quotations?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 4. Fetch Sales Orders
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['adminOrders'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/orders?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 5. Fetch Projects
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['adminProjects'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/projects?limit=100');
        return Array.isArray(res) ? res : res?.projects || res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 6. Fetch Inventory Balances
  const { data: inventoryBalances = [] } = useQuery<any[]>({
    queryKey: ['adminInventoryBalances'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/inventory/balances');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 7. Fetch Purchase Orders
  const { data: purchaseOrders = [] } = useQuery<any[]>({
    queryKey: ['adminPurchaseOrders'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/purchase-orders?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 8. Fetch Customer Payments
  const { data: paymentsData } = useQuery<any>({
    queryKey: ['adminPayments'],
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

  // 9. Fetch Expenses
  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: ['adminExpenses'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/expenses?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 10. Fetch Subsidies
  const { data: subsidies = [] } = useQuery<any[]>({
    queryKey: ['adminSubsidies'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/subsidies?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // Filter items by selected date range
  const filteredLeads = useMemo(
    () => leads.filter(l => isWithinDateRange(l.createdAt, dateRange)),
    [leads, dateRange]
  );
  const filteredCustomers = useMemo(
    () => customers.filter(c => isWithinDateRange(c.createdAt, dateRange)),
    [customers, dateRange]
  );
  const filteredQuotations = useMemo(
    () => quotations.filter(q => isWithinDateRange(q.createdAt, dateRange)),
    [quotations, dateRange]
  );
  const filteredOrders = useMemo(
    () => orders.filter(o => isWithinDateRange(o.orderDate || o.createdAt, dateRange)),
    [orders, dateRange]
  );
  const filteredProjects = useMemo(
    () => projects.filter(p => isWithinDateRange(p.createdAt, dateRange)),
    [projects, dateRange]
  );
  const filteredPayments = useMemo(
    () => payments.filter(p => isWithinDateRange(p.paymentDate || p.createdAt, dateRange)),
    [payments, dateRange]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter(e => isWithinDateRange(e.expenseDate || e.createdAt, dateRange)),
    [expenses, dateRange]
  );
  const filteredPurchaseOrders = useMemo(
    () => purchaseOrders.filter(po => isWithinDateRange(po.orderDate || po.createdAt, dateRange)),
    [purchaseOrders, dateRange]
  );

  // Executive KPI Calculations
  const totalCustomersCount = filteredCustomers.length;
  const totalLeadsCount = filteredLeads.length;
  const newLeadsCount = filteredLeads.filter(l => l.status === 'NEW').length;
  const totalQuotationsCount = filteredQuotations.length;
  const acceptedQuotationsCount = filteredQuotations.filter(q => q.status === 'ACCEPTED').length;
  const confirmedOrdersCount = filteredOrders.filter(o => o.status === 'CONFIRMED').length;

  const activeProjects = filteredProjects.filter(
    p => p.status === 'ACTIVE' || p.status === 'IN_PROGRESS' || !p.status
  );
  const completedProjects = filteredProjects.filter(p => p.status === 'COMPLETED');

  // Pending Installations: projects in physical execution stages (Civil, DC, Inverter, Earthing)
  const pendingInstallations = filteredProjects.filter(p => {
    const stage = p.currentStage || p.stage;
    return (
      stage === 'CIVIL_WORK' ||
      stage === 'MODULE_MOUNTING' ||
      stage === 'ELECTRICAL_WIRING' ||
      stage === 'INVERTER_INSTALL' ||
      stage === 'TESTING_COMMISSIONING' ||
      stage === 'STAGE_4' ||
      stage === 'STAGE_5' ||
      stage === 'STAGE_6' ||
      stage === 'STAGE_7'
    );
  }).length;

  // Inventory Low Stock Alerts
  const lowStockCount = inventoryBalances.filter(
    b => (b.availableQuantity ?? b.quantity ?? 0) <= (b.reorderLevel ?? 10)
  ).length;

  // Pending PO approvals
  const pendingPurchaseOrdersCount = filteredPurchaseOrders.filter(
    po => po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT'
  ).length;

  // Financial calculations (in integer paise)
  const totalOrderValuePaise = filteredOrders.reduce(
    (sum, o) => sum + (o.netTotalPaise || o.totalAmountPaise || 0),
    0
  );
  const realizedPaymentsPaise = filteredPayments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  const pendingPaymentsPaise = filteredPayments
    .filter(p => p.status === 'RECORDED')
    .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
  const totalExpensesPaise = filteredExpenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0);

  // Total Customer Receivables
  const totalReceivablesPaise = Math.max(0, totalOrderValuePaise - realizedPaymentsPaise);
  const netMarginPaise = realizedPaymentsPaise - totalExpensesPaise;

  // 10-Stage Project Execution Breakdown
  const standardStages = [
    { num: '01', name: 'Design & Engineering', stageKey: 'STAGE_1_ENGINEERING_DESIGN' },
    { num: '02', name: 'Net Metering Apply', stageKey: 'STAGE_2_NET_METERING_APPLY' },
    { num: '03', name: 'Material Dispatch', stageKey: 'STAGE_3_MATERIAL_DISPATCH' },
    { num: '04', name: 'Civil Structure', stageKey: 'STAGE_4_CIVIL_STRUCTURE' },
    { num: '05', name: 'DC Cabling & Wiring', stageKey: 'STAGE_5_MODULE_DC_CABLING' },
    { num: '06', name: 'Inverter & ACDB', stageKey: 'STAGE_6_INVERTER_ACDB' },
    { num: '07', name: 'Earthing & Protection', stageKey: 'STAGE_7_EARTHING_LIGHTNING' },
    { num: '08', name: 'Pre-Commission Test', stageKey: 'STAGE_8_TESTING_PRE_COMMISSION' },
    { num: '09', name: 'DISCOM Meter Install', stageKey: 'STAGE_9_DISCOM_METER_INSTALL' },
    { num: '10', name: 'Handover & COD', stageKey: 'STAGE_10_COMMISSION_HANDOVER' }
  ];

  // Map active projects to stages (Active sites remain visible across all stages)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    standardStages.forEach(s => (counts[s.stageKey] = 0));

    // Pipeline reflects current active sites; fallback to all active or within date filter
    const pipelineProjects = dateRange === 'ALL'
      ? projects
      : projects.filter(p => p.status === 'PLANNING' || p.status === 'IN_PROGRESS' || isWithinDateRange(p.createdAt, dateRange));

    pipelineProjects.forEach(p => {
      const stage = p.currentStage || 'STAGE_1_ENGINEERING_DESIGN';
      if (counts[stage] !== undefined) {
        counts[stage] = (counts[stage] ?? 0) + 1;
      } else {
        counts['STAGE_1_ENGINEERING_DESIGN'] =
          (counts['STAGE_1_ENGINEERING_DESIGN'] ?? 0) + 1;
      }
    });
    return counts;
  }, [projects, dateRange]);

  // Combined Live Operational Feed
  const liveFeed = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      ref: string;
      category: string;
      date: string;
      icon: any;
      color: string;
      to: string;
    }> = [];

    // Latest Orders
    filteredOrders.slice(0, 3).forEach(o => {
      items.push({
        id: `order-${o._id || o.id}`,
        title: `Sales Order Confirmed: ${o.customer?.name || o.customerName || 'Client Order'}`,
        ref: o.orderNumber || 'SO-ORD',
        category: 'Commercial Order',
        date: formatRelativeTime(o.orderDate || o.createdAt),
        icon: ShoppingCart,
        color: 'text-blue-500 bg-blue-500/10',
        to: `/orders/${o._id || o.id}`
      });
    });

    // Latest Projects
    filteredProjects.slice(0, 3).forEach(p => {
      items.push({
        id: `proj-${p._id || p.id}`,
        title: `Project Stage Active: ${p.title || p.projectName || 'Solar Installation'}`,
        ref: p.projectCode || 'PRJ-EXEC',
        category: 'Field Operations',
        date: formatRelativeTime(p.updatedAt || p.createdAt),
        icon: FolderKanban,
        color: 'text-amber-500 bg-amber-500/10',
        to: `/projects/${p._id || p.id}`
      });
    });

    // Latest Realized Payments
    filteredPayments.slice(0, 3).forEach(pay => {
      items.push({
        id: `pay-${pay._id || pay.id}`,
        title: `Payment Realized: ${formatPaiseToInr(pay.amountPaise)} (${pay.paymentMethod || 'Bank'})`,
        ref: pay.receiptNumber || 'REC-PAY',
        category: 'Finance & Treasury',
        date: formatRelativeTime(pay.paymentDate || pay.createdAt),
        icon: CreditCard,
        color: 'text-emerald-500 bg-emerald-500/10',
        to: '/payments'
      });
    });

    // Latest Leads
    filteredLeads.slice(0, 3).forEach(l => {
      items.push({
        id: `lead-${l._id || l.id}`,
        title: `Inbound Prospect Qualified: ${l.prospectName}`,
        ref: l.leadCode || 'LD-CRM',
        category: 'Lead Pipeline',
        date: formatRelativeTime(l.createdAt),
        icon: Users,
        color: 'text-purple-500 bg-purple-500/10',
        to: `/leads/${l._id || l.id}`
      });
    });

    return items.slice(0, 6);
  }, [filteredOrders, filteredProjects, filteredPayments, filteredLeads]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PART 1: 7 CORE EXECUTIVE KPI METRICS
         ========================================================================= */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-solar-500" />
            Executive Pulse & Core ERP Metrics
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Range: {dateRange} &bull; 100% Real Ledger
          </span>
        </div>

        {/* Primary Row: Customer Base & EPC Project Delivery (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Total Customers */}
          <DashboardKpiCard
            title="Total Customers"
            value={totalCustomersCount}
            subtitle="Verified client accounts"
            icon={Users}
            to="/customers"
            color="blue"
          />

          {/* 2. Total Leads */}
          <DashboardKpiCard
            title="Total Inquiries & Leads"
            value={totalLeadsCount}
            subtitle="Commercial pipeline"
            icon={TrendingUp}
            to="/leads"
            color="sky"
          />

          {/* 3. Active EPC Projects */}
          <DashboardKpiCard
            title="Active EPC Projects"
            value={activeProjects.length}
            subtitle="Under 10-stage execution"
            icon={FolderKanban}
            to="/projects"
            color="orange"
          />

          {/* 4. Completed Projects */}
          <DashboardKpiCard
            title="Commissioned Projects"
            value={completedProjects.length}
            subtitle="Commissioned & COD handover"
            icon={PackageCheck}
            to="/projects"
            color="emerald"
          />
        </div>

        {/* Secondary Row: Field Operations, Inventory Health & Financial Dues (3 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {/* 5. Pending Installations */}
          <DashboardKpiCard
            title="Pending Installations"
            value={pendingInstallations}
            subtitle="Field structural & electrical stages"
            icon={Layers}
            to="/projects"
            color="amber"
          />

          {/* 6. Inventory Low Stock Alerts */}
          <DashboardKpiCard
            title="Low Stock Alerts"
            value={lowStockCount}
            subtitle={
              lowStockCount > 0
                ? `${lowStockCount} items below depot reorder level`
                : 'All depot stock levels healthy'
            }
            icon={Boxes}
            to="/inventory"
            color={lowStockCount > 0 ? 'rose' : 'emerald'}
            badge={lowStockCount > 0 ? 'Reorder' : 'Healthy'}
          />

          {/* 7. Customer Receivables */}
          <DashboardKpiCard
            title="Customer Receivables"
            value={formatPaiseToInr(totalReceivablesPaise, { compact: true })}
            subtitle="Net contract dues outstanding"
            icon={CreditCard}
            to="/payments"
            color="rose"
          />
        </div>
      </div>

      {/* =========================================================================
          PART 2: COMMERCIAL CONVERSION & 10-STAGE EXECUTION OVERVIEW
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): 10-Stage Linear EPC Project Tracker */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-solar-600" />
                Standard 10-Stage EPC Project Execution Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Linear milestone gating and quality oversight from engineering survey to COD
                handover.
              </p>
            </div>
            <Link
              to="/projects"
              className="text-xs font-semibold text-solar-600 hover:text-solar-700 inline-flex items-center self-start sm:self-auto shrink-0"
            >
              <span>View All Projects</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {/* 10 Stages Stepper Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {standardStages.map(stg => {
              const count = stageCounts[stg.stageKey] || 0;
              const hasProjects = count > 0;

              return (
                <Link
                  key={stg.num}
                  to={`/projects?stage=${stg.stageKey}`}
                  className={`p-3 rounded-xl border transition-all text-left group hover:shadow-xs ${
                    hasProjects
                      ? 'bg-solar-500/10 border-solar-500/30 text-solar-900 dark:text-solar-200 ring-1 ring-solar-500/20'
                      : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider opacity-75">
                      STAGE {stg.num}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        hasProjects
                          ? 'bg-solar-500/25 text-solar-800 dark:text-solar-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count} {count === 1 ? 'Site' : 'Sites'}
                    </span>
                  </div>
                  <div className="text-xs font-bold leading-snug mt-2 line-clamp-2 text-foreground group-hover:text-solar-600">
                    {stg.name}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Stage Insights */}
          <div className="p-3 rounded-xl bg-secondary/30 border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Linear QA Photo evidence & DISCOM test reports required before stage transitions.
              </span>
            </div>
            <Link
              to="/projects"
              className="font-bold text-solar-600 hover:text-solar-700 self-start sm:self-auto shrink-0"
            >
              Inspect Quality Checklists &rarr;
            </Link>
          </div>
        </div>

        {/* Right (1 col): Commercial Conversion & Pipeline Value */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Commercial Conversion Funnel
              </h2>
              <p className="text-xs text-muted-foreground">
                Inbound prospect conversion efficiency.
              </p>
            </div>

            {/* Funnel Ratios */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-muted-foreground">Total Inbound Inquiries</span>
                  <span className="font-bold">{totalLeadsCount} Leads</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-muted-foreground">Quotation Proposals Issued</span>
                  <span className="font-bold">{totalQuotationsCount} Quotes</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalLeadsCount > 0 ? Math.min(100, Math.round((totalQuotationsCount / totalLeadsCount) * 100)) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-muted-foreground">Proposals Accepted</span>
                  <span className="font-bold">{acceptedQuotationsCount} Accepted</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalQuotationsCount > 0 ? Math.min(100, Math.round((acceptedQuotationsCount / totalQuotationsCount) * 100)) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-muted-foreground">Confirmed Commercial Orders</span>
                  <span className="font-bold text-emerald-600">{confirmedOrdersCount} Orders</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalLeadsCount > 0 ? Math.min(100, Math.round((confirmedOrdersCount / totalLeadsCount) * 100)) : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Booked Order Value Highlight */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Total Order Booking Value
            </div>
            <div className="text-2xl font-black mt-1">{formatPaiseToInr(totalOrderValuePaise)}</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              Across {confirmedOrdersCount} confirmed contract milestones
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PART 3: FINANCIAL HEALTH & SUPPLY CHAIN PULSE
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Health Snapshot (2 cols) */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Company Financial Health & Cash Flow Ledger
              </h2>
              <p className="text-xs text-muted-foreground">
                Verified collections, outstanding client receivables, operational overhead, and net
                margin.
              </p>
            </div>
            <Link
              to="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center self-start sm:self-auto shrink-0"
            >
              <span>Accounts Ledger</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="p-4 rounded-xl border bg-secondary/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Realized Bank Collections
              </span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {formatPaiseToInr(realizedPaymentsPaise)}
              </div>
              <span className="text-[11px] text-muted-foreground">Status: VERIFIED</span>
            </div>

            <div className="p-4 rounded-xl border bg-secondary/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Pending Verification
              </span>
              <div className="text-xl font-black text-amber-600 mt-1">
                {formatPaiseToInr(pendingPaymentsPaise)}
              </div>
              <span className="text-[11px] text-muted-foreground">Status: RECORDED</span>
            </div>

            <div className="p-4 rounded-xl border bg-secondary/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total Project Expenses
              </span>
              <div className="text-xl font-black text-rose-600 mt-1">
                {formatPaiseToInr(totalExpensesPaise)}
              </div>
              <span className="text-[11px] text-muted-foreground">Approved vouchers</span>
            </div>

            <div className="p-4 rounded-xl border bg-secondary/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Gross Operational Margin
              </span>
              <div
                className={`text-xl font-black mt-1 ${
                  netMarginPaise >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatPaiseToInr(netMarginPaise)}
              </div>
              <span className="text-[11px] text-muted-foreground">Collections minus Expenses</span>
            </div>
          </div>

          {/* Subsidy Disbursement Insight */}
          {subsidies.length > 0 && (
            <div className="p-3.5 rounded-xl bg-secondary/40 border flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-solar-500" />
                <span className="text-foreground font-semibold">
                  PM Surya Ghar DBT Subsidy Claims:
                </span>
                <span className="text-muted-foreground">
                  {subsidies.length} cases registered with state DISCOM liaison.
                </span>
              </div>
              <Link to="/subsidies" className="font-bold text-solar-600 hover:text-solar-700">
                View Subsidy Portal &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Actionable Bottleneck Alerts (1 col) */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Operational Bottleneck Alerts
            </h2>
            <p className="text-xs text-muted-foreground">
              Multi-department critical items requiring executive intervention.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {lowStockCount > 0 ? (
              <Link
                to="/inventory"
                className="flex items-start justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 hover:bg-rose-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Boxes className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Low Hardware Stock Detected</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {lowStockCount} SKU items are at or below warehouse reorder threshold.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-rose-500 shrink-0 ml-1" />
              </Link>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold">Warehouse Hardware Balances Healthy</span>
              </div>
            )}

            {pendingPurchaseOrdersCount > 0 && (
              <Link
                to="/purchase-orders"
                className="flex items-start justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Building2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Purchase Orders Pending Sign-Off</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {pendingPurchaseOrdersCount} POs awaiting commercial and technical approval.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
              </Link>
            )}

            {newLeadsCount > 0 && (
              <Link
                to="/leads"
                className="flex items-start justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 hover:bg-blue-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Users className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Unassigned Inbound Leads</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {newLeadsCount} new prospect inquiries require sales rep allocation.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-500 shrink-0 ml-1" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PART 4: LIVE OPERATIONAL ACTIVITY FEED
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-solar-600" />
              Live Commercial & Field Operations Feed
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time events recorded across pipeline, stage advances, payments, and procurements.
            </p>
          </div>
          <span className="text-xs font-semibold text-solar-600 bg-solar-500/10 px-2.5 py-0.5 rounded-full border border-solar-500/20">
            Real ERP Data
          </span>
        </div>

        {liveFeed.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No recent operational transactions recorded in this date range.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveFeed.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className="flex items-start space-x-3 p-3.5 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors group"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground group-hover:text-solar-600 transition-colors truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center space-x-2 mt-1">
                      <span className="font-mono font-semibold text-solar-600">{item.ref}</span>
                      <span>&bull;</span>
                      <span>{item.category}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{item.date}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
