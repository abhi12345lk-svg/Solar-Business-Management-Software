/**
 * INS Solar ERP — Sales Panel Dashboard (Commercial & CRM Workspace)
 * Strictly mapped to the actual operational modules of the Sales Panel:
 * 1. Lead Management (/leads)
 * 2. Customer Directory (/customers)
 * 3. Quotation Proposals (/quotations)
 * 4. Confirmed Sales Orders (/orders)
 * 5. Document Vault & KYC (/documents)
 * 6. Generate Agreement / Form (/create-document)
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  FileSpreadsheet,
  ShoppingCart,
  FolderLock,
  FilePlus2,
  TrendingUp,
  ArrowRight,
  Plus,
  Compass
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import {
  DateFilterRange,
  isWithinDateRange,
  formatShortDate,
  formatPaiseToInr
} from './dashboardUtils.js';

interface SalesDashboardProps {
  dateRange: DateFilterRange;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ dateRange }) => {
  // 1. Fetch Leads
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['salesLeads'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/leads?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 2. Fetch Customers
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['salesCustomers'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/customers?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch Quotations
  const { data: quotations = [] } = useQuery<any[]>({
    queryKey: ['salesQuotations'],
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
    queryKey: ['salesOrders'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/orders?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 5. Fetch Documents
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['salesDocuments'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/documents?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // Date Filtering
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

  const filteredDocuments = useMemo(
    () => documents.filter(d => isWithinDateRange(d.createdAt, dateRange)),
    [documents, dateRange]
  );

  // Key KPI Calculations
  const totalLeads = filteredLeads.length;
  const newLeads = filteredLeads.filter(l => (l.status || '').toUpperCase() === 'NEW').length;

  const totalQuotes = filteredQuotations.length;
  const awaitingQuotes = filteredQuotations.filter(q =>
    ['SENT', 'DRAFT', 'UNDER_REVIEW'].includes((q.status || '').toUpperCase())
  ).length;
  const acceptedQuotes = filteredQuotations.filter(
    q => (q.status || '').toUpperCase() === 'ACCEPTED'
  ).length;

  const totalOrders = filteredOrders.length;
  const confirmedOrders = filteredOrders.filter(
    o => (o.status || '').toUpperCase() === 'CONFIRMED'
  ).length;

  const totalBookedPaise = filteredOrders.reduce((sum, o) => {
    return (
      sum +
      (o.netTotalPaise ||
        o.totalAmountPaise ||
        (o.grandTotal ? Math.round(o.grandTotal * 100) : 0) ||
        0)
    );
  }, 0);

  const totalCustomers = filteredCustomers.length;
  const totalDocuments = filteredDocuments.length;

  // Conversion rate: Accepted quotes vs total quotes (or Orders vs Leads)
  const quoteConversionRate =
    totalQuotes > 0
      ? Math.round((acceptedQuotes / totalQuotes) * 100)
      : totalLeads > 0
        ? Math.round((totalOrders / totalLeads) * 100)
        : 0;

  // 6-Stage CRM Lead Conversion Funnel
  const pipelineStages = [
    { key: 'NEW', label: 'New Inbound', color: 'bg-blue-500' },
    { key: 'CONTACTED', label: 'Contacted', color: 'bg-sky-500' },
    { key: 'QUALIFIED', label: 'Qualified', color: 'bg-indigo-500' },
    { key: 'QUOTED', altKey: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'bg-purple-500' },
    { key: 'CONVERTED', altKey: 'WON', label: 'Converted Order', color: 'bg-emerald-500' },
    { key: 'LOST', altKey: 'DROPPED', label: 'Lost / Dropped', color: 'bg-slate-400' }
  ];

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pipelineStages.forEach(stg => (counts[stg.key] = 0));
    filteredLeads.forEach(l => {
      const status = (l.status || 'NEW').toUpperCase();
      if (counts[status] !== undefined) {
        counts[status] = (counts[status] ?? 0) + 1;
      } else if (status === 'PROPOSAL_SENT' && counts['QUOTED'] !== undefined) {
        counts['QUOTED'] = (counts['QUOTED'] ?? 0) + 1;
      } else if (status === 'WON' && counts['CONVERTED'] !== undefined) {
        counts['CONVERTED'] = (counts['CONVERTED'] ?? 0) + 1;
      } else {
        counts['NEW'] = (counts['NEW'] ?? 0) + 1;
      }
    });
    return counts;
  }, [filteredLeads]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PART 1: SALES QUICK ACTION LAUNCHPAD (Only Real Sales Modules)
         ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-card border shadow-xs">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 shrink-0">
          Sales Actions:
        </span>
        <Link
          to="/leads"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-solar-500 hover:bg-solar-600 text-slate-950 text-xs font-bold shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Lead</span>
        </Link>
        <Link
          to="/quotations"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500" />
          <span>Create Quotation</span>
        </Link>
        <Link
          to="/create-document"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-amber-500" />
          <span>Generate Agreement / Form</span>
        </Link>
        <Link
          to="/customers"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <UserCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>Customer Directory</span>
        </Link>
        <Link
          to="/orders"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
          <span>Confirmed Orders</span>
        </Link>
        <Link
          to="/documents"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <FolderLock className="w-3.5 h-3.5 text-slate-500" />
          <span>Document Vault</span>
        </Link>
      </div>

      {/* =========================================================================
          PART 2: CORE SALES & CRM KPIS (Directly matching the Sales panel modules)
         ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            Commercial &amp; Sales Pipeline Performance
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Range: {dateRange} &bull; Conversion Rate: {quoteConversionRate}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Total Leads */}
          <DashboardKpiCard
            title="Total Inbound Leads"
            value={totalLeads}
            subtitle={`${newLeads} new / uncontacted`}
            icon={Users}
            to="/leads"
            color="blue"
            badge={newLeads > 0 ? `${newLeads} New` : undefined}
          />

          {/* 2. Quotation Proposals */}
          <DashboardKpiCard
            title="Active Quotations"
            value={totalQuotes}
            subtitle={`${awaitingQuotes} awaiting decision`}
            icon={FileSpreadsheet}
            to="/quotations"
            color="purple"
            badge={awaitingQuotes > 0 ? `${awaitingQuotes} Pending` : undefined}
          />

          {/* 3. Confirmed Orders */}
          <DashboardKpiCard
            title="Confirmed Orders"
            value={confirmedOrders || totalOrders}
            subtitle={`Booked: ${formatPaiseToInr(totalBookedPaise, { compact: true })}`}
            icon={ShoppingCart}
            to="/orders"
            color="emerald"
          />

          {/* 4. Customer Directory */}
          <DashboardKpiCard
            title="Registered Clients"
            value={totalCustomers}
            subtitle="Customer directory accounts"
            icon={UserCheck}
            to="/customers"
            color="sky"
          />

          {/* 5. Document Vault & Generation */}
          <DashboardKpiCard
            title="Agreements &amp; KYC"
            value={totalDocuments}
            subtitle="Generated official docs"
            icon={FolderLock}
            to="/documents"
            color="amber"
          />

          {/* 6. Conversion Rate */}
          <DashboardKpiCard
            title="Conversion Rate"
            value={`${quoteConversionRate}%`}
            subtitle={`${acceptedQuotes} won / signed deals`}
            icon={TrendingUp}
            to="/orders"
            color="teal"
          />
        </div>
      </div>

      {/* =========================================================================
          PART 3: 6-STAGE CRM LEAD CONVERSION FUNNEL
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              CRM Lead Conversion Pipeline
            </h2>
            <p className="text-xs text-muted-foreground">
              Commercial progression of prospective clients from initial inquiry to signed contract.
            </p>
          </div>
          <Link
            to="/leads"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center self-start sm:self-auto shrink-0"
          >
            <span>Open All Leads</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {pipelineStages.map((stg, idx) => {
            const count = stageCounts[stg.key] || 0;
            return (
              <Link
                key={stg.key}
                to={`/leads?status=${stg.key}`}
                className="p-3 rounded-xl border bg-secondary/30 hover:bg-secondary/60 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">
                    0{idx + 1}
                  </span>
                  <span className="text-xs font-black text-foreground">{count}</span>
                </div>
                <div className="text-xs font-bold mt-1 text-foreground group-hover:text-solar-600 truncate">
                  {stg.label}
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className={`${stg.color} h-1.5 rounded-full transition-all`}
                    style={{
                      width: `${totalLeads > 0 ? Math.min(100, Math.max(8, Math.round((count / totalLeads) * 100))) : 0}%`
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          PART 4: TWO OPERATIONAL SECTIONS: PROPOSALS & CONFIRMED ORDERS + CONTRACTS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Quotations & Proposals */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                Recent Quotations &amp; Proposals
              </h2>
              <p className="text-xs text-muted-foreground">
                Formal customer solar proposals with capacity sizing and pricing.
              </p>
            </div>
            <Link
              to="/quotations"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center shrink-0"
            >
              <span>View All Quotes</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {filteredQuotations.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>No quotation proposals created yet.</p>
              <Link
                to="/quotations"
                className="inline-flex items-center space-x-1 text-xs font-bold text-purple-600 hover:underline"
              >
                <span>+ Create First Quotation</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredQuotations.slice(0, 5).map((q: any) => {
                const custName =
                  q.customerId?.legalName ||
                  q.customerId?.name ||
                  q.customerId?.companyName ||
                  q.customerName ||
                  'Direct Client';
                const quoteCode = q.fullQuotationCode || q.quotationNumber || 'QUOTE';
                const status = (q.status || 'DRAFT').toUpperCase();
                const totalPaise =
                  q.netTotalPaise ||
                  q.grandTotalPaise ||
                  (q.grandTotal ? Math.round(q.grandTotal * 100) : 0) ||
                  0;

                const statusColor =
                  status === 'ACCEPTED'
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                    : status === 'SENT'
                      ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                      : status === 'REJECTED'
                        ? 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-700 border-amber-500/20';

                return (
                  <div
                    key={q._id || q.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-400">
                          {quoteCode}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${statusColor}`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {custName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {q.systemCapacityKwp && (
                          <span className="font-bold text-foreground">
                            {q.systemCapacityKwp} kWp
                          </span>
                        )}
                        <span>&bull;</span>
                        <span>{formatShortDate(q.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                      <div className="text-xs font-black font-mono text-foreground">
                        {formatPaiseToInr(totalPaise)}
                      </div>
                      <Link
                        to={`/quotations/${q._id || q.id}`}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline inline-flex items-center mt-0.5"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Confirmed Sales Orders & Contract Generation */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                Confirmed Orders &amp; Documents
              </h2>
              <p className="text-xs text-muted-foreground">
                Booked customer contracts ready for document generation &amp; execution.
              </p>
            </div>
            <Link
              to="/orders"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center shrink-0"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>No confirmed sales orders yet.</p>
              <Link
                to="/orders"
                className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 hover:underline"
              >
                <span>+ View Orders Workspace</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.slice(0, 4).map((order: any) => {
                const custName =
                  order.customerId?.legalName ||
                  order.customerId?.name ||
                  order.customerName ||
                  'Customer';
                const orderNum = order.orderNumber || 'SO-2026';
                const totalPaise =
                  order.netTotalPaise ||
                  order.totalAmountPaise ||
                  (order.grandTotal ? Math.round(order.grandTotal * 100) : 0) ||
                  0;
                const custId = order.customerId?._id || order.customerId?.id || order.customerId;

                return (
                  <div
                    key={order._id || order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                          {orderNum}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                          {order.status || 'CONFIRMED'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {custName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{formatShortDate(order.orderDate || order.createdAt)}</span>
                        <span>&bull;</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatPaiseToInr(totalPaise)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        to={`/create-document${custId ? `?customerId=${custId}` : ''}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20 transition-all"
                        title="Generate Solar Agreement or Cover Letter"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        <span>Gen Doc</span>
                      </Link>
                      <Link
                        to={`/orders/${order._id || order.id}`}
                        className="inline-flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Official Document Templates Launch Bar */}
          <div className="pt-2 border-t space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Official Document Templates (/create-document):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Link
                to="/create-document?template=SOLAR_AGGREMENT"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Solar Agreement
                </div>
                <div className="text-[10px] text-muted-foreground">2 Pages A4 Contract</div>
              </Link>
              <Link
                to="/create-document?template=COVER_LETTER"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Cover Letter
                </div>
                <div className="text-[10px] text-muted-foreground">DISCOM Application</div>
              </Link>
              <Link
                to="/create-document?template=WORK_COMPLETION"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Work Completion
                </div>
                <div className="text-[10px] text-muted-foreground">Handover Report</div>
              </Link>
              <Link
                to="/create-document?template=LETTER_FOR_BANK"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Letter For Bank
                </div>
                <div className="text-[10px] text-muted-foreground">Loan Disbursement</div>
              </Link>
              <Link
                to="/create-document?template=POWER_PURCHASE_AGREEMENT"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Power Purchase
                </div>
                <div className="text-[10px] text-muted-foreground">CSPDCL PPA Form</div>
              </Link>
              <Link
                to="/create-document?template=DECLARATION_DCR_ANNEXURE_A"
                className="p-2 rounded-lg border bg-secondary/30 hover:bg-secondary/60 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-foreground group-hover:text-amber-600 truncate">
                  Annexure - A
                </div>
                <div className="text-[10px] text-muted-foreground">DCR Declaration</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
