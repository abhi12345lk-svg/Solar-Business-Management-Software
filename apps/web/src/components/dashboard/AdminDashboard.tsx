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
  Zap,
  PackageCheck,
  ArrowUpRight,
  Activity,
  Layers,
  Sparkles,
  MapPin
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import {
  DateFilterRange,
  isWithinDateRange,
  formatPaiseToInr
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
  const filteredPurchaseOrders = useMemo(
    () => purchaseOrders.filter(po => isWithinDateRange(po.orderDate || po.createdAt, dateRange)),
    [purchaseOrders, dateRange]
  );

  // Executive KPI Calculations
  const totalCustomersCount = filteredCustomers.length;
  const totalLeadsCount = filteredLeads.length;
  const newLeadsCount = filteredLeads.filter(l => l.status === 'NEW').length;

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

  // Total Customer Receivables
  const totalReceivablesPaise = Math.max(0, totalOrderValuePaise - realizedPaymentsPaise);

  // Fast Customer Lookup Map
  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers.forEach(c => {
      const id = (c._id || c.id)?.toString?.();
      if (id) map[id] = c;
    });
    return map;
  }, [customers]);

  const getCustomerName = (customerId: any) => {
    if (!customerId) return 'Valued Client';
    if (typeof customerId === 'object' && customerId.name) return customerId.name;
    const cid = (customerId?._id || customerId?.id || customerId)?.toString?.();
    const cust = customerMap[cid];
    return cust?.name || cust?.companyName || 'Valued Client';
  };

  const unreservedOrdersCount = filteredOrders.filter(
    o => o.status === 'CONFIRMED' && (!o.reservationStatus || o.reservationStatus === 'NONE')
  ).length;

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

  const getStageMeta = (stageKey?: string) => {
    const found = standardStages.find(s => s.stageKey === stageKey);
    if (found) {
      const num = parseInt(found.num, 10);
      return {
        num: found.num,
        name: found.name,
        progressPercent: Math.round((num / 10) * 100)
      };
    }
    return {
      num: '01',
      name: 'Design & Engineering',
      progressPercent: 10
    };
  };

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

          {/* 7. Recovery Pending */}
          <DashboardKpiCard
            title="Recovery Pending"
            value={formatPaiseToInr(totalReceivablesPaise, { compact: true })}
            subtitle="Net contract dues outstanding"
            icon={CreditCard}
            to="/payments"
            color="rose"
          />
        </div>
      </div>

      {/* =========================================================================
          PART 2: 10-STAGE EPC PROJECT EXECUTION PIPELINE
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
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
        <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2.5 pt-1">
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

      {/* =========================================================================
          PART 3: ACTIVE SOLAR EPC SITES & FIELD EXECUTION
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-solar-600" />
              Active Solar EPC Site Execution & Milestone Progress
            </h2>
            <p className="text-xs text-muted-foreground">
              Live physical stage tracking, capacity kWp, customer site status, and linear milestone completion.
            </p>
          </div>
          <Link
            to="/projects"
            className="text-xs font-semibold text-solar-600 hover:text-solar-700 inline-flex items-center self-start sm:self-auto shrink-0"
          >
            <span>View All {projects.length} Projects</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {activeProjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-secondary/10">
            No active project installations currently running in this period.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjects.slice(0, 4).map(p => {
              const custName = getCustomerName(p.customerId);
              const stage = getStageMeta(p.currentStage || p.stage);
              const isPlanning = p.status === 'PLANNING';

              return (
                <div
                  key={p._id || p.id}
                  className="p-4 sm:p-5 rounded-xl border bg-card hover:border-solar-500/40 hover:shadow-xs transition-all space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-solar-600 bg-solar-500/10 px-2 py-0.5 rounded border border-solar-500/20">
                          {p.projectCode || 'PRJ-EXEC'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPlanning
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {p.status || 'IN_PROGRESS'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground mt-1.5 leading-snug">
                        {p.name || 'Solar PV System Installation'}
                      </h3>
                    </div>
                    <span className="text-xs font-black text-foreground shrink-0 bg-secondary px-2.5 py-1 rounded-lg border">
                      {p.systemCapacityKwp || 0} kWp {p.systemTopology ? `• ${p.systemTopology}` : ''}
                    </span>
                  </div>

                  {/* Customer & Location */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{custName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">
                        {p.siteAddress?.city || 'Raipur'}, {p.siteAddress?.state || 'Chhattisgarh'}
                      </span>
                    </div>
                  </div>

                  {/* Stage Progress Bar */}
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <span className="font-mono text-[10px] text-solar-600 font-bold">
                          STAGE {stage.num}:
                        </span>{' '}
                        {stage.name}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px] font-bold">
                        {stage.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-solar-500 h-2 rounded-full transition-all"
                        style={{ width: `${stage.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                      {p.priority || 'HIGH'} Priority
                    </span>
                    <Link
                      to={`/projects/${p._id || p.id}`}
                      className="text-xs font-bold text-solar-600 hover:text-solar-700 inline-flex items-center"
                    >
                      <span>Open Project Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          PART 4: COMMERCIAL CONTRACTS & OPERATIONAL DISPATCH DESK
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Confirmed Sales Orders & Hardware Readiness */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-600" />
                  Confirmed Commercial Orders & Backlog
                </h2>
                <p className="text-xs text-muted-foreground">
                  Agreed EPC contract value, customer profiles, and warehouse stock allocation status.
                </p>
              </div>
              <Link
                to="/orders"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center shrink-0"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {/* Total Order Booking Summary Pill */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Total Confirmed Order Book
                </div>
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {formatPaiseToInr(totalOrderValuePaise)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-foreground">
                  {filteredOrders.length} Signed Contracts
                </span>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {unreservedOrdersCount > 0 ? `${unreservedOrdersCount} pending allocation` : 'Hardware fully secured'}
                </div>
              </div>
            </div>

            {/* List of Real Orders */}
            <div className="space-y-2.5">
              {filteredOrders.slice(0, 3).map(o => {
                const custName = getCustomerName(o.customerId);
                const isFullyReserved = o.reservationStatus === 'FULLY_RESERVED';

                return (
                  <Link
                    key={o._id || o.id}
                    to={`/orders/${o._id || o.id}`}
                    className="p-3.5 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-all block group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground group-hover:text-solar-600">
                          {o.orderNumber || o.orderCode || 'ORD-EPC'}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          &bull; {custName}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formatPaiseToInr(o.netTotalPaise || o.totalAmountPaise || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">
                        {o.systemCapacityKwp || 10} kWp {o.systemTopology || 'SOLAR'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFullyReserved
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isFullyReserved ? 'Hardware Reserved' : 'Allocation Needed'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Operational Directives & Inbound Inquiries */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Executive Action Center & Directives
            </h2>
            <p className="text-xs text-muted-foreground">
              Critical operations, supply chain health, and inbound commercial inquiries.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* 1. Unassigned Inbound Leads */}
            {newLeadsCount > 0 && (
              <Link
                to="/leads"
                className="flex items-start justify-between p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 hover:bg-blue-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Users className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Unassigned Inbound Leads ({newLeadsCount})</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {newLeadsCount} new commercial inquiries await sales rep and site survey allocation.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-500 shrink-0 ml-1" />
              </Link>
            )}

            {/* 2. Stock Allocation Directive */}
            {unreservedOrdersCount > 0 && (
              <Link
                to="/orders"
                className="flex items-start justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Boxes className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Hardware Allocation Pending</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {unreservedOrdersCount} confirmed sales order requires depot stock reservation before dispatch.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
              </Link>
            )}

            {/* 3. PM Surya Ghar DBT Subsidy */}
            {subsidies.length > 0 && (
              <Link
                to="/subsidies"
                className="flex items-start justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 hover:bg-purple-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">PM Surya Ghar Subsidy Registration</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {subsidies.length} application registered under CSPDCL / CREDA state nodal agency.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-purple-500 shrink-0 ml-1" />
              </Link>
            )}

            {/* 4. Purchase Order Approval Directive */}
            {pendingPurchaseOrdersCount > 0 && (
              <Link
                to="/purchase-orders"
                className="flex items-start justify-between p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-900 dark:text-cyan-200 hover:bg-cyan-500/15 transition-colors"
              >
                <div className="flex items-start space-x-2.5">
                  <Building2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Purchase Orders Awaiting Sign-Off</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {pendingPurchaseOrdersCount} procurement POs require management sign-off.
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-cyan-500 shrink-0 ml-1" />
              </Link>
            )}

            {/* 4. Warehouse Depot Health */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-xs">Central Depot Raipur (WH-RAIPUR-01)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                Stock Balances Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
