import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sun,
  Loader2
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import {
  LeadDto,
  LeadActivityDto,
  LeadStatus,
  ActivityType,
  ActivityStatus,
  ActivitySentiment,
  CustomerType
} from '@ins-solar/shared';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [lead, setLead] = useState<LeadDto | null>(null);
  const [activities, setActivities] = useState<LeadActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Change Modal / State
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | ''>('');
  const [lostReason, setLostReason] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Conversion State
  const [converting, setConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Add Activity Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>(ActivityType.CALL);
  const [activitySummary, setActivitySummary] = useState('');
  const [activityRemarks, setActivityRemarks] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [activitySentiment, setActivitySentiment] = useState<ActivitySentiment | ''>('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [leadData, activityData] = await Promise.all([
        apiClient<LeadDto>(`/leads/${id}`),
        apiClient<LeadActivityDto[]>(`/leads/${id}/activities`)
      ]);
      setLead(leadData);
      setActivities(activityData || []);
      setSelectedStatus(leadData.status);
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedStatus) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiClient<LeadDto>(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedStatus,
          lostReason: selectedStatus === LeadStatus.LOST ? lostReason : undefined
        })
      });
      setLead(updated);
      setShowStatusModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update lead status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConvertLead = async () => {
    if (!id || !lead) return;
    if (!window.confirm(`Convert lead ${lead.leadCode} into an official Customer record?`)) {
      return;
    }

    setConverting(true);
    setConvertError(null);
    setConvertSuccess(null);
    try {
      const result = await apiClient<{ customerCode: string; isAlreadyConverted: boolean }>(
        `/leads/${id}/convert`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerType: CustomerType.INDIVIDUAL
          })
        }
      );
      setConvertSuccess(`Successfully converted to Customer: ${result.customerCode}`);
      loadData();
    } catch (err: any) {
      setConvertError(err?.message || 'Failed to convert lead.');
    } finally {
      setConverting(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setAddingActivity(true);
    try {
      await apiClient<LeadActivityDto>(`/leads/${id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          activityType,
          summary: activitySummary.trim(),
          remarks: activityRemarks.trim() || undefined,
          nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : undefined,
          sentiment: activitySentiment || undefined,
          status: ActivityStatus.COMPLETED
        })
      });

      setShowActivityModal(false);
      setActivitySummary('');
      setActivityRemarks('');
      setNextFollowUpDate('');
      setActivitySentiment('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to record activity.');
    } finally {
      setAddingActivity(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
        <p>Loading lead details and activity timeline...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8 text-center text-destructive space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto" />
        <p className="font-semibold">{error || 'Lead not found.'}</p>
        <Link to="/leads" className="inline-flex items-center text-sm underline text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to Leads</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/leads"
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground mb-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Back to Leads Directory</span>
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {lead.leadCode}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-solar-500/10 text-solar-600 border border-solar-500/20">
              {lead.status}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground">
              {lead.priority} Priority
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Created on {new Date(lead.createdAt).toLocaleDateString()} by{' '}
            {lead.assignedEmployeeName || 'Internal Sales Team'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-3.5 py-2 text-sm font-medium bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition"
          >
            Update Status
          </button>

          {lead.status !== LeadStatus.CONVERTED && (
            <button
              onClick={handleConvertLead}
              disabled={converting}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{converting ? 'Converting...' : 'Convert to Customer'}</span>
            </button>
          )}

          {lead.status === LeadStatus.CONVERTED && (
            <div className="px-3.5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Converted Customer</span>
            </div>
          )}
        </div>
      </div>

      {convertSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{convertSuccess}</span>
        </div>
      )}

      {convertError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{convertError}</span>
        </div>
      )}

      {/* Main Grid: Details + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead Information Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-foreground border-b pb-3 flex items-center space-x-2">
              <Sun className="w-4 h-4 text-solar-500" />
              <span>Prospect Profile</span>
            </h2>

            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Customer / Prospect Name
                </span>
                <span className="font-semibold text-foreground text-base">{lead.prospectName}</span>
                {lead.companyName && (
                  <span className="block text-xs text-muted-foreground">{lead.companyName}</span>
                )}
              </div>

              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Phone Number
                </span>
                <div className="flex items-center space-x-1.5 text-foreground font-medium">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.prospectPhone}</span>
                </div>
              </div>

              {lead.prospectEmail && (
                <div>
                  <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Email
                  </span>
                  <div className="flex items-center space-x-1.5 text-foreground">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.prospectEmail}</span>
                  </div>
                </div>
              )}

              <div>
                <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Installation Address
                </span>
                <div className="flex items-start space-x-1.5 text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>
                    {lead.location.street ? `${lead.location.street}, ` : ''}
                    {lead.location.city}, {lead.location.state}
                    {lead.location.pinCode ? ` - ${lead.location.pinCode}` : ''}
                  </span>
                </div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs text-muted-foreground font-semibold">
                    Capacity
                  </span>
                  <span className="font-semibold text-foreground">
                    {lead.estimatedCapacityKw ? `${lead.estimatedCapacityKw} kWp` : '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-muted-foreground font-semibold">
                    Requirement
                  </span>
                  <span className="font-semibold text-foreground">{lead.solarRequirement}</span>
                </div>

                <div>
                  <span className="block text-xs text-muted-foreground font-semibold">Source</span>
                  <span className="font-semibold text-foreground">{lead.source}</span>
                </div>

                <div>
                  <span className="block text-xs text-muted-foreground font-semibold">
                    Next Follow-up
                  </span>
                  <span className="font-semibold text-foreground">
                    {lead.nextFollowUpDate
                      ? new Date(lead.nextFollowUpDate).toLocaleDateString()
                      : 'None'}
                  </span>
                </div>
              </div>

              {lead.notes && (
                <div className="border-t pt-3">
                  <span className="block text-xs text-muted-foreground font-semibold mb-1">
                    Inquiry Notes
                  </span>
                  <p className="text-xs bg-muted/40 p-2.5 rounded-lg text-foreground italic whitespace-pre-wrap">
                    "{lead.notes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity History & Follow-up Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Interaction & Activity History
                </h2>
                <p className="text-xs text-muted-foreground">
                  Full chronological audit of phone calls, visits, and follow-up milestones.
                </p>
              </div>
              <button
                onClick={() => setShowActivityModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Log Activity</span>
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <Clock className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-sm font-medium">No recorded activities yet.</p>
                <p className="text-xs">Log phone calls or site visits to track this lead.</p>
              </div>
            ) : (
              <div className="relative border-l border-solar-200 ml-4 space-y-6 py-2">
                {activities.map(act => (
                  <div key={act.id} className="relative pl-6">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-2.5 top-1 w-5 h-5 rounded-full bg-solar-50 border-2 border-solar-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-solar-600" />
                    </div>

                    <div className="bg-muted/30 border rounded-xl p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-solar-700 uppercase tracking-wide">
                          {act.activityType}
                        </span>
                        <span>{new Date(act.activityDate).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{act.summary}</p>
                      {act.remarks && (
                        <p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
                          {act.remarks}
                        </p>
                      )}
                      {act.nextFollowUpDate && (
                        <div className="pt-1 text-xs text-solar-700 font-medium flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Next Follow-up: {new Date(act.nextFollowUpDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground">Update Lead Status</h3>
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Target Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as LeadStatus)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  {Object.values(LeadStatus)
                    .filter(s => s !== LeadStatus.CONVERTED) // Use dedicated conversion button for converted
                    .map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
              </div>

              {selectedStatus === LeadStatus.LOST && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Reason for Lost Status *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={lostReason}
                    onChange={e => setLostReason(e.target.value)}
                    placeholder="Specify why prospect did not proceed (e.g. competitor pricing, budget, rooftop clearance)..."
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700"
                >
                  {updatingStatus ? 'Updating...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground">Log Interaction or Follow-up</h3>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Activity Type
                </label>
                <select
                  value={activityType}
                  onChange={e => setActivityType(e.target.value as ActivityType)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  {Object.values(ActivityType).map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Summary / Discussion Point *
                </label>
                <input
                  type="text"
                  required
                  value={activitySummary}
                  onChange={e => setActivitySummary(e.target.value)}
                  placeholder="e.g. Discussed 5kW bifacial modules and BESCOM net metering"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Detailed Remarks
                </label>
                <textarea
                  rows={3}
                  value={activityRemarks}
                  onChange={e => setActivityRemarks(e.target.value)}
                  placeholder="Customer agreed to schedule physical site survey on weekend..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={e => setNextFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Sentiment
                  </label>
                  <select
                    value={activitySentiment}
                    onChange={e => setActivitySentiment(e.target.value as ActivitySentiment)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    <option value="">None</option>
                    {Object.values(ActivitySentiment).map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingActivity}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700"
                >
                  {addingActivity ? 'Saving...' : 'Record Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
