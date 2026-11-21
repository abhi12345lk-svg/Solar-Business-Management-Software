import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Phone,
  ArrowRight,
  Check,
  Loader2,
  Search
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface FollowUpItem {
  id: string;
  leadId: string;
  lead?: {
    id: string;
    leadCode: string;
    prospectName: string;
    prospectPhone: string;
    status: string;
  };
  activityType: string;
  summary: string;
  remarks?: string;
  nextFollowUpDate: string;
  assignedEmployeeName?: string;
  isOverdue: boolean;
  isDueToday: boolean;
  status: string;
}

export const FollowUpsPage: React.FC = () => {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [search, setSearch] = useState('');

  // Complete Follow-up Modal State
  const [selectedItem, setSelectedItem] = useState<FollowUpItem | null>(null);
  const [completing, setCompleting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [nextDate, setNextDate] = useState('');

  const fetchFollowUps = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<FollowUpItem[]>(
        `/leads/follow-ups?timeframe=${timeframe}&limit=50`
      );
      setFollowUps(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load follow-ups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, [timeframe]);

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setCompleting(true);
    try {
      await apiClient(`/leads/activities/${selectedItem.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({
          remarks: remarks.trim() || undefined,
          nextFollowUpDate: nextDate ? new Date(nextDate).toISOString() : undefined
        })
      });

      setSelectedItem(null);
      setRemarks('');
      setNextDate('');
      fetchFollowUps();
    } catch (err: any) {
      alert(err?.message || 'Failed to complete follow-up.');
    } finally {
      setCompleting(false);
    }
  };

  const overdueCount = followUps.filter(f => f.isOverdue).length;

  const filteredFollowUps = followUps.filter(item => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = item.lead?.prospectName?.toLowerCase().includes(q);
      const phoneMatch = item.lead?.prospectPhone?.includes(q);
      const codeMatch = item.lead?.leadCode?.toLowerCase().includes(q);
      const summaryMatch = item.summary?.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !codeMatch && !summaryMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center space-x-2">
            <span>Scheduled Follow-ups</span>
            {overdueCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                {overdueCount} Overdue
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor due and overdue sales touchpoints across prospective solar inquiries.
          </p>
        </div>
      </div>

      {/* Tabs / Filter Nav & Search Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <div className="flex items-center space-x-2">
          {(['all', 'overdue', 'today', 'upcoming'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setTimeframe(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                timeframe === tab
                  ? 'bg-solar-600 text-white shadow-sm font-bold'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search prospect, phone, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
          />
        </div>
      </div>

      {/* Follow-up Items List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
            <p>Loading scheduled follow-ups...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-2 bg-card border rounded-xl">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p>{error}</p>
          </div>
        ) : filteredFollowUps.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border rounded-xl space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
            <p className="font-semibold text-foreground">
              {search.trim() ? 'No follow-ups match your search' : 'All follow-ups up to date!'}
            </p>
            <p className="text-xs">
              {search.trim()
                ? 'Try clearing the search query to see all scheduled follow-ups.'
                : 'No pending tasks found for the selected timeframe.'}
            </p>
            {search.trim() && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 px-3 py-1 text-xs font-semibold bg-secondary rounded-lg text-foreground hover:bg-secondary/80"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredFollowUps.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border bg-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                item.isOverdue
                  ? 'border-rose-300 bg-rose-50/20'
                  : item.isDueToday
                    ? 'border-amber-300 bg-amber-50/20'
                    : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-solar-700">
                    {item.lead?.leadCode || 'LEAD'}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {item.lead?.prospectName || 'Prospect'}
                  </span>
                  {item.isOverdue && (
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                      OVERDUE
                    </span>
                  )}
                  {item.isDueToday && (
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                      DUE TODAY
                    </span>
                  )}
                </div>

                <p className="text-xs text-foreground font-medium">{item.summary}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-solar-500" />
                    <span>Scheduled: {new Date(item.nextFollowUpDate).toLocaleDateString()}</span>
                  </div>
                  {item.lead?.prospectPhone && (
                    <div className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{item.lead.prospectPhone}</span>
                    </div>
                  )}
                  {item.assignedEmployeeName && (
                    <span className="italic">Assigned: {item.assignedEmployeeName}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                <button
                  onClick={() => setSelectedItem(item)}
                  className="flex-1 sm:flex-none justify-center px-3.5 py-2 text-xs font-semibold bg-emerald-600 min-h-[38px] hover:bg-emerald-700 text-white rounded-lg transition shadow-sm flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Done</span>
                </button>

                {item.lead?.id && (
                  <Link
                    to={`/leads/${item.lead.id}`}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
                    title="View Lead Details"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Completion Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground">Complete Follow-up Task</h3>
            <p className="text-xs text-muted-foreground">
              Prospect:{' '}
              <strong className="text-foreground">{selectedItem.lead?.prospectName}</strong> (
              {selectedItem.lead?.leadCode})
            </p>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Discussion Outcome / Remarks
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Record summary of customer response..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Schedule Next Follow-up (Optional)
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={e => setNextDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  {completing ? 'Completing...' : 'Confirm Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
