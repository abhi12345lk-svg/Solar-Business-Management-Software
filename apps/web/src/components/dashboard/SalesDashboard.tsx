/**
 * INS Solar ERP — Sales Panel Dashboard (Commercial & CRM Workspace)
 * Tailored for Sales Executives, CRM Managers, and Field Surveyors.
 * Focuses on Lead Qualification, Scheduled Follow-ups, PV Sizing, Proposals, and Order Intake.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Sun,
  FileSpreadsheet,
  ShoppingCart,
  Calendar,
  Clock,
  Phone,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
  Compass,
  TrendingUp,
  Check
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DashboardKpiCard } from './DashboardKpiCard.js';
import { DateFilterRange, isWithinDateRange, formatShortDate } from './dashboardUtils.js';

interface SalesDashboardProps {
  dateRange: DateFilterRange;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ dateRange }) => {
  const queryClient = useQueryClient();
  const [followUpTab, setFollowUpTab] = useState<'today' | 'overdue' | 'upcoming'>('today');

  // Complete Follow-up Modal State
  const [completingItem, setCompletingItem] = useState<any | null>(null);
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 2. Fetch Follow-ups
  const { data: followUpsData = [] } = useQuery<any[]>({
    queryKey: ['salesFollowUps', followUpTab],
    queryFn: async () => {
      try {
        const res = await apiClient<any>(`/leads/follow-ups?timeframe=${followUpTab}&limit=50`);
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 3. Fetch Surveys
  const { data: surveys = [] } = useQuery<any[]>({
    queryKey: ['salesSurveys'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/surveys?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 4. Fetch Solar PV Designs
  const { data: solarDesigns = [] } = useQuery<any[]>({
    queryKey: ['salesSolarDesigns'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/solar-designs?limit=100');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // 5. Fetch Quotations
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

  // 6. Fetch Sales Orders
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

  // Filter items by date range
  const filteredLeads = useMemo(
    () => leads.filter(l => isWithinDateRange(l.createdAt, dateRange)),
    [leads, dateRange]
  );
  const filteredQuotations = useMemo(
    () => quotations.filter(q => isWithinDateRange(q.createdAt, dateRange)),
    [quotations, dateRange]
  );
  const filteredOrders = useMemo(
    () => orders.filter(o => isWithinDateRange(o.orderDate || o.createdAt, dateRange)),
    [orders, dateRange]
  );

  // KPIs
  const totalLeads = filteredLeads.length;
  const newLeads = filteredLeads.filter(l => l.status === 'NEW').length;
  const contactedLeads = filteredLeads.filter(
    l => l.status === 'CONTACTED' || l.status === 'QUALIFIED'
  ).length;

  const dueTodayFollowUps = followUpsData.filter(f => f.isDueToday).length;
  const overdueFollowUps = followUpsData.filter(f => f.isOverdue).length;

  const totalDesigns = solarDesigns.length;

  const totalQuotes = filteredQuotations.length;
  const quotesAwaitingResponse = filteredQuotations.filter(
    q => q.status === 'SENT' || q.status === 'UNDER_REVIEW' || q.status === 'DRAFT'
  ).length;
  const acceptedQuotes = filteredQuotations.filter(q => q.status === 'ACCEPTED').length;
  const confirmedOrders = filteredOrders.filter(o => o.status === 'CONFIRMED').length;

  const quoteConversionRate =
    totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

  // 7-Stage Visual Lead Pipeline Funnel
  const pipelineStages = [
    { key: 'NEW', label: 'New Inbound', color: 'bg-blue-500' },
    { key: 'CONTACTED', label: 'Contacted', color: 'bg-sky-500' },
    { key: 'SURVEY_SCHEDULED', label: 'Survey Booked', color: 'bg-teal-500' },
    { key: 'QUOTED', label: 'Quotation Sent', color: 'bg-purple-500' },
    { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-amber-500' },
    { key: 'CONVERTED', label: 'Converted Order', color: 'bg-emerald-500' },
    { key: 'LOST', label: 'Lost / Dropped', color: 'bg-slate-400' }
  ];

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pipelineStages.forEach(stg => (counts[stg.key] = 0));
    filteredLeads.forEach(l => {
      const status = l.status || 'NEW';
      if (counts[status] !== undefined) {
        counts[status] = (counts[status] ?? 0) + 1;
      } else {
        counts['NEW'] = (counts['NEW'] ?? 0) + 1;
      }
    });
    return counts;
  }, [filteredLeads]);

  // Handle Mark Follow-Up Complete
  const handleCompleteFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;

    try {
      setIsSubmitting(true);
      await apiClient(`/leads/activities/${completingItem.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({
          remarks: completeRemarks.trim() || undefined,
          nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : undefined
        })
      });

      queryClient.invalidateQueries({ queryKey: ['salesFollowUps'] });
      setCompletingItem(null);
      setCompleteRemarks('');
      setNextFollowUpDate('');
    } catch (err: any) {
      alert(err?.message || 'Failed to complete follow up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          PART 1: SALES QUICK ACTION LAUNCHPAD
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
          to="/follow-ups"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Calendar className="w-3.5 h-3.5 text-blue-500" />
          <span>Schedule Follow-Up</span>
        </Link>
        <Link
          to="/solar-designs"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>PV Sizing Engine</span>
        </Link>
        <Link
          to="/quotations"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500" />
          <span>Create Quotation</span>
        </Link>
      </div>

      {/* =========================================================================
          PART 2: 10 SALES & CRM KPI METRICS
         ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            CRM Pipeline & Commercial Performance
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Range: {dateRange} &bull; Conversion Rate: {quoteConversionRate}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Total Leads */}
          <DashboardKpiCard
            title="Total Inbound Leads"
            value={totalLeads}
            subtitle="Pipeline inquiries"
            icon={Users}
            to="/leads"
            color="blue"
          />

          {/* 2. New Leads */}
          <DashboardKpiCard
            title="New / Uncontacted"
            value={newLeads}
            subtitle="Requires prompt outreach"
            icon={Users}
            to="/leads"
            color="sky"
            badge={newLeads > 0 ? `${newLeads} New` : undefined}
          />

          {/* 3. Qualified Prospects */}
          <DashboardKpiCard
            title="Qualified Leads"
            value={contactedLeads}
            subtitle="Requirement established"
            icon={Users}
            to="/leads"
            color="indigo"
          />

          {/* 4. Follow-ups Due Today */}
          <DashboardKpiCard
            title="Follow-ups Today"
            value={dueTodayFollowUps}
            subtitle="Scheduled interactions"
            icon={Clock}
            to="/follow-ups"
            color="amber"
            badge={dueTodayFollowUps > 0 ? 'Today' : undefined}
          />

          {/* 5. Overdue Follow-ups */}
          <DashboardKpiCard
            title="Overdue Reminders"
            value={overdueFollowUps}
            subtitle="Missed appointment dates"
            icon={AlertCircle}
            to="/follow-ups"
            color={overdueFollowUps > 0 ? 'rose' : 'emerald'}
            badge={overdueFollowUps > 0 ? 'Urgent' : 'Clear'}
          />

          {/* 6. Solar Designs */}
          <DashboardKpiCard
            title="Solar Designs"
            value={totalDesigns}
            subtitle="PV sizing & CAD layouts"
            icon={Sun}
            to="/solar-designs"
            color="amber"
          />

          {/* 7. Quotations Created */}
          <DashboardKpiCard
            title="Quotes Created"
            value={totalQuotes}
            subtitle="Customer proposals"
            icon={FileSpreadsheet}
            to="/quotations"
            color="purple"
          />

          {/* 8. Proposals Awaiting Decision */}
          <DashboardKpiCard
            title="Awaiting Response"
            value={quotesAwaitingResponse}
            subtitle="Under client review"
            icon={Clock}
            to="/quotations"
            color="orange"
          />

          {/* 9. Accepted Quotations */}
          <DashboardKpiCard
            title="Accepted Proposals"
            value={acceptedQuotes}
            subtitle="Client approved quotes"
            icon={CheckCircle2}
            to="/quotations"
            color="emerald"
          />

          {/* 10. Confirmed Orders */}
          <DashboardKpiCard
            title="Confirmed Orders"
            value={confirmedOrders}
            subtitle="Signed project contracts"
            icon={ShoppingCart}
            to="/orders"
            color="emerald"
          />
        </div>
      </div>

      {/* =========================================================================
          PART 3: 7-STAGE LEAD PIPELINE FUNNEL
         ========================================================================= */}
      <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              7-Stage CRM Lead Conversion Funnel
            </h2>
            <p className="text-xs text-muted-foreground">
              Commercial progression of prospective clients from initial inquiry to signed contract.
            </p>
          </div>
          <Link
            to="/leads"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center self-start sm:self-auto shrink-0"
          >
            <span>Open CRM Leads</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
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
                      width: `${totalLeads > 0 ? Math.min(100, Math.max(10, Math.round((count / totalLeads) * 100))) : 0}%`
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          PART 4: INTERACTIVE FOLLOW-UP WORKBENCH & TECHNICAL SURVEYS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Follow-Up Execution Workbench */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Scheduled Follow-up Reminders Workbench
              </h2>
              <p className="text-xs text-muted-foreground">
                Action pending phone calls, client meetings, and technical quote reviews.
              </p>
            </div>

            {/* Timeframe Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-secondary border text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFollowUpTab('today')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  followUpTab === 'today'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Today ({dueTodayFollowUps})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpTab('overdue')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  followUpTab === 'overdue'
                    ? 'bg-rose-500 text-white shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overdue ({overdueFollowUps})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpTab('upcoming')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  followUpTab === 'upcoming'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Upcoming
              </button>
            </div>
          </div>

          {/* Follow-ups List */}
          {followUpsData.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              All follow-up reminders in this category are completely cleared.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {followUpsData.slice(0, 6).map(item => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-foreground truncate">
                        {item.lead?.prospectName || item.summary || 'Prospect Follow-up'}
                      </span>
                      {item.isOverdue && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Overdue
                        </span>
                      )}
                      {item.isDueToday && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Due Today
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                      {item.lead?.prospectPhone && (
                        <span className="inline-flex items-center text-foreground font-mono font-medium">
                          <Phone className="w-3 h-3 mr-1 text-solar-500" />
                          {item.lead.prospectPhone}
                        </span>
                      )}
                      <span>&bull;</span>
                      <span className="truncate">
                        {item.summary || item.remarks || 'Routine check-in'}
                      </span>
                    </div>

                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>{formatShortDate(item.nextFollowUpDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setCompletingItem(item)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors"
                      title="Mark follow-up completed"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                    {item.leadId && (
                      <Link
                        to={`/leads/${item.leadId}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border text-xs font-semibold transition-colors"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1 col): Technical Surveys & PV Sizing */}
        <div className="bg-card border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sun className="w-4 h-4 text-solar-500" />
                Technical Surveys & Sizing Engine
              </h2>
              <p className="text-xs text-muted-foreground">
                Rooftop engineering specs & sizing proposals.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-secondary/30 border space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Site Surveys Logged</span>
                  <span className="font-bold">{surveys.length} Records</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Roof dimensions, shade obstruction & sanctioned load verified.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Solar Designs Sized</span>
                  <span className="font-bold">{solarDesigns.length} Calculations</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Tri-topology PV simulations (On-Grid, Off-Grid, Hybrid).
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Quote Acceptance Rate</span>
                  <span className="font-bold text-emerald-600">{quoteConversionRate}%</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {acceptedQuotes} accepted out of {totalQuotes} commercial proposals.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/solar-designs"
              className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-solar-500 hover:bg-solar-600 text-slate-950 text-xs font-bold shadow-xs transition-all"
            >
              <Sun className="w-4 h-4" />
              <span>Launch PV Sizing Engine</span>
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL: COMPLETE FOLLOW-UP
         ========================================================================= */}
      {completingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">Complete Follow-up Reminder</h3>
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteFollowUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Prospect / Task
                </label>
                <div className="p-2.5 rounded-lg bg-secondary/40 font-bold text-foreground">
                  {completingItem.lead?.prospectName || completingItem.summary}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Outcome Remarks & Notes
                </label>
                <textarea
                  value={completeRemarks}
                  onChange={e => setCompleteRemarks(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-solar-500"
                  placeholder="e.g. Spoke with client, requested revised 5kW quote with mono-perc panels..."
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Next Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={e => setNextFollowUpDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="px-4 py-2 rounded-xl border text-muted-foreground hover:bg-secondary font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-solar-500 hover:bg-solar-600 text-slate-950 font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
