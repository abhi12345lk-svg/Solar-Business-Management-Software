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
  Loader2,
  Layers,
  Sparkles,
  XCircle,
  Zap,
  FileText,
  ShoppingBag,
  FolderGit2,
  ArrowRight,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import {
  LeadDto,
  LeadActivityDto,
  LeadStatus,
  ActivityType,
  ActivityStatus,
  ActivitySentiment,
  CustomerType,
  SolarRequirement,
  LeadPriority,
  LeadSource
} from '@ins-solar/shared';

const COMMERCIAL_STAGES = [
  { key: LeadStatus.NEW, label: '01. Inbound Inquiry', desc: 'Captured & awaiting qualification' },
  { key: LeadStatus.CONTACTED, label: '02. Discussion & Qualification', desc: 'Phone consultation & requirement check' },
  { key: LeadStatus.SURVEY_SCHEDULED, label: '03. Site Survey', desc: 'Rooftop audit & meter room inspection' },
  { key: LeadStatus.QUOTED, label: '04. Proposal Delivered', desc: 'Solar PV proposal & BOM delivered' },
  { key: LeadStatus.NEGOTIATION, label: '05. Negotiation', desc: 'Commercial terms & financing review' },
  { key: LeadStatus.CONVERTED, label: '06. Won & Converted', desc: 'Signed EPC contract & customer onboarded' }
];

const STAGE_ORDER = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SURVEY_SCHEDULED,
  LeadStatus.QUOTED,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED
];

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

  // Edit Lead Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('Rajasthan');
  const [editPinCode, setEditPinCode] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editRequirement, setEditRequirement] = useState<SolarRequirement>(SolarRequirement.RESIDENTIAL);
  const [editPriority, setEditPriority] = useState<LeadPriority>(LeadPriority.MEDIUM);
  const [editSource, setEditSource] = useState<LeadSource>(LeadSource.WEBSITE);
  const [editNotes, setEditNotes] = useState('');

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

  const handleQuickStatusChange = async (newStatus: LeadStatus, reason?: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiClient<LeadDto>(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          lostReason: reason
        })
      });
      setLead(updated);
      setSelectedStatus(newStatus);
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

  const openEditModal = () => {
    if (!lead) return;
    setEditName(lead.prospectName || '');
    setEditPhone(lead.prospectPhone || '');
    setEditEmail(lead.prospectEmail || '');
    setEditCompanyName(lead.companyName || '');
    setEditStreet(lead.location?.street || '');
    setEditCity(lead.location?.city || '');
    setEditState(lead.location?.state || 'Rajasthan');
    setEditPinCode(lead.location?.pinCode || '');
    setEditCapacity(lead.estimatedCapacityKw ? String(lead.estimatedCapacityKw) : '');
    setEditRequirement(lead.solarRequirement || SolarRequirement.RESIDENTIAL);
    setEditPriority(lead.priority || LeadPriority.MEDIUM);
    setEditSource(lead.source || LeadSource.WEBSITE);
    setEditNotes(lead.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient<LeadDto>(`/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          prospectName: editName.trim(),
          prospectPhone: editPhone.trim(),
          prospectEmail: editEmail.trim() || undefined,
          companyName: editCompanyName.trim() || undefined,
          location: {
            street: editStreet.trim() || undefined,
            city: editCity.trim(),
            state: editState.trim(),
            pinCode: editPinCode.trim() || undefined
          },
          estimatedCapacityKw: editCapacity ? parseFloat(editCapacity) : null,
          solarRequirement: editRequirement,
          priority: editPriority,
          source: editSource,
          notes: editNotes.trim() || undefined
        })
      });
      setLead(updated);
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update lead details.');
    } finally {
      setSavingEdit(false);
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
            className="px-3 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition cursor-pointer"
          >
            Update Status
          </button>

          {/* Contextual Primary Action based on Stage */}
          {lead.status === LeadStatus.NEW && (
            <button
              onClick={() => handleQuickStatusChange(LeadStatus.CONTACTED)}
              disabled={updatingStatus}
              className="px-3.5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Mark Contacted & Qualified →</span>
            </button>
          )}

          {lead.status === LeadStatus.CONTACTED && (
            <Link
              to={`/surveys?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
              className="px-3.5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Schedule Site Survey →</span>
            </Link>
          )}

          {lead.status === LeadStatus.SURVEY_SCHEDULED && (
            <Link
              to={`/solar-design?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
              className="px-3.5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Solar PV Sizing & CAD →</span>
            </Link>
          )}

          {lead.status === LeadStatus.QUOTED && (
            <button
              onClick={() => handleQuickStatusChange(LeadStatus.NEGOTIATION)}
              disabled={updatingStatus}
              className="px-3.5 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Advance to Negotiation →</span>
            </button>
          )}

          {lead.status === LeadStatus.NEGOTIATION && (
            <button
              onClick={handleConvertLead}
              disabled={converting}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{converting ? 'Converting...' : 'Convert to Customer ✓'}</span>
            </button>
          )}

          {/* Secondary Survey shortcut if not on NEW or CONTACTED */}
          {lead.status !== LeadStatus.NEW &&
            lead.status !== LeadStatus.CONTACTED &&
            lead.status !== LeadStatus.LOST &&
            lead.status !== LeadStatus.CONVERTED && (
              <Link
                to={`/surveys?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
                className="px-3 py-2 text-xs font-semibold bg-muted/70 hover:bg-muted text-foreground rounded-lg transition border border-border flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Site Survey</span>
              </Link>
            )}

          {/* Direct Convert fast-track for admins when not already in negotiation or converted */}
          {lead.status !== LeadStatus.CONVERTED &&
            lead.status !== LeadStatus.LOST &&
            lead.status !== LeadStatus.NEGOTIATION && (
              <button
                onClick={handleConvertLead}
                disabled={converting}
                title="Fast-track conversion into official customer record"
                className="px-3 py-2 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg transition flex items-center space-x-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Fast-Track Convert</span>
              </button>
            )}

          {lead.status === LeadStatus.CONVERTED && (
            <div className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-1.5">
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

      {/* 6-Stage Commercial Lead Conversion Stepper */}
      <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-solar-500" />
              <span>Commercial Lead Qualification & Conversion Stepper</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standard 6-stage solar sales process from inbound inquiry to customer conversion.
            </p>
          </div>
          {lead.status === LeadStatus.LOST && (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30">
              <XCircle className="w-3.5 h-3.5" />
              <span>Inquiry Dropped / Lost</span>
            </div>
          )}
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          {COMMERCIAL_STAGES.map((st, idx) => {
            const currentStageIdx = STAGE_ORDER.indexOf(lead.status);
            const isCompleted = currentStageIdx !== -1 && currentStageIdx > idx;
            const isCurrent = currentStageIdx === idx;

            return (
              <div
                key={st.key}
                onClick={() => {
                  if (st.key === LeadStatus.CONVERTED) {
                    handleConvertLead();
                  } else if (st.key !== lead.status && lead.status !== LeadStatus.CONVERTED) {
                    if (window.confirm(`Transition lead to "${st.label}"?`)) {
                      handleQuickStatusChange(st.key);
                    }
                  }
                }}
                title={
                  st.key === lead.status
                    ? 'Current active milestone'
                    : `Click to transition to ${st.label}`
                }
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer select-none ${
                  isCurrent
                    ? 'bg-solar-50/80 dark:bg-solar-950/40 border-solar-400 dark:border-solar-700 ring-2 ring-solar-500/20 shadow-xs'
                    : isCompleted
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400'
                      : 'bg-muted/30 border-border opacity-70 hover:opacity-100 hover:border-solar-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                      Stage 0{idx + 1}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-solar-500 animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <h4
                    className={`text-xs font-bold ${
                      isCurrent
                        ? 'text-solar-800 dark:text-solar-300'
                        : isCompleted
                          ? 'text-emerald-800 dark:text-emerald-300'
                          : 'text-foreground'
                    }`}
                  >
                    {st.label}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                    {st.desc}
                  </p>
                </div>

                {isCurrent && lead.status !== LeadStatus.CONVERTED && (
                  <div className="mt-2 pt-2 border-t border-solar-200 dark:border-solar-800/50">
                    <span className="text-[10px] font-bold text-solar-700 dark:text-solar-400 uppercase tracking-wider">
                      Current Milestone
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Converted Customer Celebration & Quick-Action Hub */}
      {lead.status === LeadStatus.CONVERTED && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-solar-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  ✓
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Inquiry Successfully Converted to Official Customer
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                This prospect is officially onboarded. Proceed with technical engineering, quotation, order booking, and project installation.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                to="/customers"
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Customer Directory</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-emerald-500/20">
            <Link
              to={`/solar-design?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
              className="p-3.5 bg-card/80 hover:bg-card border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl transition shadow-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <Sun className="w-4 h-4 text-solar-500 group-hover:scale-110 transition-transform" />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-solar-600 group-hover:translate-x-0.5 transition" />
              </div>
              <h4 className="text-xs font-bold text-foreground">1. Solar PV Sizing & CAD</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Simulate generation, roof geometry & inverter sizing.
              </p>
            </Link>

            <Link
              to="/quotations"
              className="p-3.5 bg-card/80 hover:bg-card border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl transition shadow-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <FileText className="w-4 h-4 text-solar-500 group-hover:scale-110 transition-transform" />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-solar-600 group-hover:translate-x-0.5 transition" />
              </div>
              <h4 className="text-xs font-bold text-foreground">2. Quotation Suite</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Draft official proposal with BOM & subsidy calculations.
              </p>
            </Link>

            <Link
              to="/orders"
              className="p-3.5 bg-card/80 hover:bg-card border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl transition shadow-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <ShoppingBag className="w-4 h-4 text-solar-500 group-hover:scale-110 transition-transform" />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-solar-600 group-hover:translate-x-0.5 transition" />
              </div>
              <h4 className="text-xs font-bold text-foreground">3. Confirmed Sales Order</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Lock payment milestones, billing & procurement.
              </p>
            </Link>

            <Link
              to="/projects"
              className="p-3.5 bg-card/80 hover:bg-card border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl transition shadow-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <FolderGit2 className="w-4 h-4 text-solar-500 group-hover:scale-110 transition-transform" />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-solar-600 group-hover:translate-x-0.5 transition" />
              </div>
              <h4 className="text-xs font-bold text-foreground">4. 10-Stage EPC Pipeline</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Manage net metering, dispatch, structure & COD.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* Lost / Dropped Banner */}
      {lead.status === LeadStatus.LOST && (
        <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <XCircle className="w-4 h-4" />
              <span>This Lead is Marked as Lost / Dropped</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Reason:{' '}
              <span className="font-semibold text-foreground">
                {lead.lostReason || 'No reason specified'}
              </span>
            </p>
          </div>
          <button
            onClick={() => handleQuickStatusChange(LeadStatus.CONTACTED)}
            disabled={updatingStatus}
            className="px-4 py-2 text-xs font-semibold bg-white dark:bg-card border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 rounded-lg transition flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${updatingStatus ? 'animate-spin' : ''}`} />
            <span>Re-Open Inquiry</span>
          </button>
        </div>
      )}

      {/* Active Pipeline Next-Step Guidance Card */}
      {lead.status !== LeadStatus.CONVERTED && lead.status !== LeadStatus.LOST && (
        <div className="bg-solar-500/5 border border-solar-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-solar-500/10 text-solar-600 mt-0.5 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-solar-600 block">
                Recommended Next Step ({lead.status})
              </span>
              <p className="text-xs text-foreground mt-0.5 font-medium">
                {lead.status === LeadStatus.NEW &&
                  'Contact the prospect to qualify their solar capacity requirement, monthly electricity bill, and sanctioned load.'}
                {lead.status === LeadStatus.CONTACTED &&
                  'Requirement qualified. Schedule a technician site survey to inspect roof azimuth, shading obstacles, and DISCOM meter.'}
                {lead.status === LeadStatus.SURVEY_SCHEDULED &&
                  'Site survey scheduled. After engineer completes survey observations, proceed to Solar PV Sizing & generate Quotation.'}
                {lead.status === LeadStatus.QUOTED &&
                  'Official quotation delivered. Follow up with prospect to address technical queries, warranty terms, and discounts.'}
                {lead.status === LeadStatus.NEGOTIATION &&
                  'Final negotiations in progress. Once terms are accepted, convert this prospect into an official Customer to initiate installation.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {lead.status === LeadStatus.NEW && (
              <button
                onClick={() => handleQuickStatusChange(LeadStatus.CONTACTED)}
                disabled={updatingStatus}
                className="px-3.5 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>Mark Contacted & Qualified →</span>
              </button>
            )}
            {lead.status === LeadStatus.CONTACTED && (
              <Link
                to={`/surveys?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
                className="px-3.5 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1"
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                <span>Schedule Site Survey →</span>
              </Link>
            )}
            {lead.status === LeadStatus.SURVEY_SCHEDULED && (
              <Link
                to={`/solar-design?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
                className="px-3.5 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1"
              >
                <Sun className="w-3.5 h-3.5 mr-1" />
                <span>Solar PV Sizing →</span>
              </Link>
            )}
            {lead.status === LeadStatus.QUOTED && (
              <button
                onClick={() => handleQuickStatusChange(LeadStatus.NEGOTIATION)}
                disabled={updatingStatus}
                className="px-3.5 py-2 text-xs font-semibold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>Mark Under Negotiation →</span>
              </button>
            )}
            {lead.status === LeadStatus.NEGOTIATION && (
              <button
                onClick={handleConvertLead}
                disabled={converting}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                <span>{converting ? 'Converting...' : 'Convert to Customer ✓'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Details + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead Information Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Sun className="w-4 h-4 text-solar-500" />
                <span>Prospect Profile</span>
              </h2>
              {lead.status !== LeadStatus.CONVERTED && (
                <button
                  onClick={openEditModal}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md border border-border transition cursor-pointer"
                  title="Edit prospect contact, location, and solar requirements"
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>

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

      {/* Edit Prospect Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Edit Prospect Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update customer contact information, installation site, and solar requirements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Prospect Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={e => setEditCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Street / Area Address
                </label>
                <input
                  type="text"
                  value={editStreet}
                  onChange={e => setEditStreet(e.target.value)}
                  placeholder="Plot/Flat number, landmark..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={e => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={editState}
                    onChange={e => setEditState(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={editPinCode}
                    onChange={e => setEditPinCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Capacity (kWp)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editCapacity}
                    onChange={e => setEditCapacity(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Requirement Type
                  </label>
                  <select
                    value={editRequirement}
                    onChange={e => setEditRequirement(e.target.value as SolarRequirement)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    {Object.values(SolarRequirement).map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value as LeadPriority)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    {Object.values(LeadPriority).map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Lead Source</label>
                <select
                  value={editSource}
                  onChange={e => setEditSource(e.target.value as LeadSource)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  {Object.values(LeadSource).map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Inquiry Remarks & Technical Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Electricity bill average, sanctioned load, shadow obstructions, rooftop access notes..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Prospect Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
