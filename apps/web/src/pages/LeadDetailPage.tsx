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
  Sparkles,
  XCircle,
  FileText,
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
  const [editState, setEditState] = useState('Chhattisgarh');
  const [editPinCode, setEditPinCode] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editRequirement, setEditRequirement] = useState<SolarRequirement>(SolarRequirement.RESIDENTIAL);
  const [editPriority, setEditPriority] = useState<LeadPriority>(LeadPriority.MEDIUM);
  const [editSource, setEditSource] = useState<LeadSource>(LeadSource.WEBSITE);
  const [editNotes, setEditNotes] = useState('');

  // Milestone Transition Modal State
  const [stageModal, setStageModal] = useState<{ key: LeadStatus; label: string; desc: string } | null>(null);
  const [stageRemark, setStageRemark] = useState('');
  const [advancingStage, setAdvancingStage] = useState(false);

  // Convert to Customer Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertCustomerType, setConvertCustomerType] = useState<CustomerType>(CustomerType.INDIVIDUAL);

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

  const handleConfirmStageAdvance = async () => {
    if (!id || !stageModal) return;
    setAdvancingStage(true);
    try {
      await apiClient<LeadDto>(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: stageModal.key,
          lostReason: stageModal.key === LeadStatus.LOST ? stageRemark.trim() || undefined : undefined
        })
      });

      if (stageRemark.trim()) {
        await apiClient(`/leads/${id}/activities`, {
          method: 'POST',
          body: JSON.stringify({
            activityType: ActivityType.NOTE,
            summary: `Milestone advanced to ${stageModal.label}`,
            remarks: stageRemark.trim(),
            status: ActivityStatus.COMPLETED
          })
        });
      }

      setStageModal(null);
      setStageRemark('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update milestone.');
    } finally {
      setAdvancingStage(false);
    }
  };

  const handleOpenConvertModal = () => {
    if (!lead || lead.status === LeadStatus.CONVERTED) return;
    setConvertCustomerType(
      lead.solarRequirement === SolarRequirement.COMMERCIAL ||
        lead.solarRequirement === SolarRequirement.INDUSTRIAL
        ? CustomerType.COMMERCIAL
        : CustomerType.INDIVIDUAL
    );
    setShowConvertModal(true);
  };

  const handleExecuteConvert = async () => {
    if (!id || !lead) return;
    if (lead.status === LeadStatus.CONVERTED) return;

    setConverting(true);
    setConvertError(null);
    setConvertSuccess(null);
    try {
      const result = await apiClient<{ customerCode: string; isAlreadyConverted: boolean }>(
        `/leads/${id}/convert`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerType: convertCustomerType
          })
        }
      );
      setConvertSuccess(`Successfully converted to Customer: ${result.customerCode}`);
      setShowConvertModal(false);
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
    setEditState(lead.location?.state || 'Chhattisgarh');
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
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center space-x-2">
              <span className="font-mono">{lead.leadCode}</span>
              <span className="text-muted-foreground font-normal">•</span>
              <span>{lead.prospectName}</span>
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

        {/* Simple & Clean Action Controls */}
        <div className="flex items-center gap-2">
          {/* Main Contextual Next Action Button */}
          {lead.status === LeadStatus.NEW && (
            <button
              onClick={() => handleQuickStatusChange(LeadStatus.CONTACTED)}
              disabled={updatingStatus}
              className="px-4 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Mark as Contacted →</span>
            </button>
          )}

          {lead.status === LeadStatus.CONTACTED && (
            <div className="flex items-center space-x-2">
              <Link
                to={`/solar-designs?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
                className="px-4 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Solar PV Sizing &amp; Design →</span>
              </Link>
              <button
                onClick={() =>
                  setStageModal({
                    key: LeadStatus.QUOTED,
                    label: '04. Proposal Delivered',
                    desc: 'Advance directly to Proposal Delivered if physical survey is complete or bypassed.'
                  })
                }
                title="If site survey is already done or bypassed, advance to Proposal Delivered"
                className="px-3 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition border border-border flex items-center space-x-1 cursor-pointer"
              >
                <span>Advance to Quoted →</span>
              </button>
            </div>
          )}

          {lead.status === LeadStatus.SURVEY_SCHEDULED && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() =>
                  setStageModal({
                    key: LeadStatus.QUOTED,
                    label: '04. Proposal Delivered',
                    desc: 'Site survey completed. Transition lead to quotation & proposal delivered stage.'
                  })
                }
                disabled={updatingStatus}
                className="px-4 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Mark Proposal Delivered →</span>
              </button>
              <Link
                to={`/solar-designs?leadId=${lead.id}&prospectName=${encodeURIComponent(lead.prospectName)}`}
                className="px-3 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition border border-border flex items-center space-x-1"
              >
                <Sun className="w-3.5 h-3.5 text-solar-500" />
                <span>Solar PV CAD</span>
              </Link>
            </div>
          )}

          {lead.status === LeadStatus.QUOTED && (
            <button
              onClick={() => handleQuickStatusChange(LeadStatus.NEGOTIATION)}
              disabled={updatingStatus}
              className="px-4 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Move to Negotiation →</span>
            </button>
          )}

          {lead.status === LeadStatus.NEGOTIATION && (
            <button
              onClick={handleOpenConvertModal}
              disabled={converting}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{converting ? 'Converting...' : 'Convert to Customer ✓'}</span>
            </button>
          )}

          {lead.status === LeadStatus.CONVERTED && (
            <Link
              to="/customers"
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Profile →</span>
            </Link>
          )}

          {/* Update / Change Status Modal (Only for non-converted leads) */}
          {lead.status !== LeadStatus.CONVERTED && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="px-3.5 py-2 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg text-secondary-foreground transition cursor-pointer"
            >
              Update Status
            </button>
          )}
        </div>
      </div>

      {convertSuccess && lead.status !== LeadStatus.CONVERTED && (
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
      <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-solar-500" />
            <h2 className="text-sm font-bold text-foreground">
              Sales Pipeline Progress
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Stage {STAGE_ORDER.indexOf(lead.status) + 1} of 6: <strong className="text-foreground">{lead.status}</strong>
          </span>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {COMMERCIAL_STAGES.map((st, idx) => {
            const currentStageIdx = STAGE_ORDER.indexOf(lead.status);
            const isCompleted = currentStageIdx !== -1 && currentStageIdx > idx;
            const isCurrent = currentStageIdx === idx;

            return (
              <div
                key={st.key}
                onClick={() => {
                  if (lead.status === LeadStatus.CONVERTED) {
                    return; // Already won and converted
                  }
                  if (st.key === LeadStatus.CONVERTED) {
                    handleOpenConvertModal();
                  } else if (st.key !== lead.status) {
                    setStageModal({ key: st.key, label: st.label, desc: st.desc });
                  }
                }}
                title={
                  st.key === lead.status
                    ? 'Current active milestone'
                    : lead.status === LeadStatus.CONVERTED
                      ? `${st.label} (Lead won & converted)`
                      : isCompleted
                        ? `${st.label} (Completed)`
                        : `Click to advance milestone to ${st.label}`
                }
                className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                  lead.status === LeadStatus.CONVERTED ? 'cursor-default' : 'cursor-pointer'
                } select-none ${
                  isCurrent
                    ? 'bg-solar-50/80 dark:bg-solar-950/40 border-solar-400 dark:border-solar-700 ring-2 ring-solar-500/20 shadow-xs'
                    : isCompleted
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-muted/30 border-border opacity-60 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">
                      0{idx + 1}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-solar-500 animate-pulse" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
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
                    {st.label.replace(/^\d+\.\s*/, '')}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Converted Customer Notification Banner */}
      {lead.status === LeadStatus.CONVERTED && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Inquiry Won & Converted to Official Customer Record
            </span>
          </div>
          <Link
            to="/customers"
            className="inline-flex items-center space-x-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
          >
            <span>View in Customer Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
                  Chronological log of phone calls, site surveys, and follow-up milestones.
                </p>
              </div>
              {lead.status !== LeadStatus.CONVERTED ? (
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-solar-600 text-white rounded-lg hover:bg-solar-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Log Activity</span>
                </button>
              ) : (
                <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Deal Won & Closed</span>
                </span>
              )}
            </div>

            {(() => {
              const displayActivities = activities.filter(
                act => !act.summary.startsWith('Status changed from')
              );

              if (displayActivities.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-50 text-solar-500" />
                    <p className="text-sm font-medium">No recorded interaction notes yet.</p>
                    <p className="text-xs">Log phone calls or site consultation notes to track this inquiry.</p>
                  </div>
                );
              }

              return (
                <div className="relative border-l border-solar-200 ml-4 space-y-4 py-2">
                  {displayActivities.map(act => {
                    const isSystemLog =
                      act.summary.startsWith('Lead converted') ||
                      act.summary.startsWith('Lead captured');

                    if (isSystemLog) {
                      return (
                        <div key={act.id} className="relative pl-6">
                          <div className="absolute -left-2 top-2 w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          </div>
                          <div className="py-1.5 px-3 bg-muted/20 border border-border/60 rounded-lg flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                            <span className="font-semibold text-foreground">{act.summary}</span>
                            <span className="text-[10px]">
                              {new Date(act.activityDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.activityDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={act.id} className="relative pl-6">
                        {/* Timeline Node Icon */}
                        <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full bg-solar-50 border-2 border-solar-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-solar-600" />
                        </div>

                        <div className="bg-muted/30 border rounded-xl p-3.5 space-y-1.5">
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
                    );
                  })}
                </div>
              );
            })()}
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
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Lead Follow-up</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save consultation notes and schedule next customer interaction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Activity Type
                  </label>
                  <select
                    value={activityType}
                    onChange={e => setActivityType(e.target.value as ActivityType)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  >
                    <option value={ActivityType.CALL}>Phone Call</option>
                    <option value={ActivityType.SITE_VISIT}>Physical Site Visit / Roof Audit</option>
                    <option value={ActivityType.MEETING}>Meeting / Office Consultation</option>
                    <option value={ActivityType.WHATSAPP}>WhatsApp / Chat Message</option>
                    <option value={ActivityType.EMAIL}>Email Sent</option>
                    <option value={ActivityType.NOTE}>Internal Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Next Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={e => setNextFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Discussion Points & Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={activitySummary}
                  onChange={e => setActivitySummary(e.target.value)}
                  placeholder="e.g. Discussed 5kW bifacial modules, client requested subsidy quote, roof clear of shadow..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingActivity}
                  className="px-4 py-1.5 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {addingActivity ? 'Saving...' : 'Record Activity ✓'}
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

      {/* Milestone Advance Modal */}
      {stageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Advance Lead Milestone
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Transition this prospect into the next operational phase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageModal(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-solar-50/60 dark:bg-solar-950/30 border border-solar-200 dark:border-solar-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current Stage:</span>
                <span className="font-semibold text-foreground">{lead.status}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-solar-700 dark:text-solar-400">
                <span>Target Stage:</span>
                <span>{stageModal.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-solar-200/50">
                {stageModal.desc}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Milestone Note / Activity Remarks (Optional)
              </label>
              <textarea
                rows={2}
                value={stageRemark}
                onChange={e => setStageRemark(e.target.value)}
                placeholder="e.g. Completed site survey observations, or Sent official Waaree proposal..."
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setStageModal(null);
                  setStageRemark('');
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStageAdvance}
                disabled={advancingStage}
                className="px-4 py-1.5 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-lg transition shadow-xs disabled:opacity-50"
              >
                {advancingStage ? 'Updating...' : 'Advance Milestone ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Lead to Customer Conversion Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Convert Lead to Official Customer
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Onboard prospect into the active Customer Directory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-muted/40 border rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Prospect:</span>
                <span className="font-bold text-foreground">{lead.prospectName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono text-foreground">{lead.prospectPhone}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Location:</span>
                <span className="text-foreground">{lead.location?.city || 'N/A'}, {lead.location?.state || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Requirement / Capacity:</span>
                <span className="font-semibold text-solar-600">
                  {lead.estimatedCapacityKw ? `${lead.estimatedCapacityKw} kWp` : 'Custom'} ({lead.solarRequirement})
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Customer Account Type
              </label>
              <select
                value={convertCustomerType}
                onChange={e => setConvertCustomerType(e.target.value as CustomerType)}
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={CustomerType.INDIVIDUAL}>Residential / Individual Homeowner</option>
                <option value={CustomerType.COMMERCIAL}>Commercial Entity / Business Enterprise</option>
                <option value={CustomerType.INDUSTRIAL}>Industrial Plant / Manufacturing Facility</option>
                <option value={CustomerType.INSTITUTIONAL}>Institutional / Non-Profit / School / Hospital</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Generates a unique Customer ID (e.g. CUST-2026-xxxxx) and unlocks CAD sizing, quotations, and project execution.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConvert}
                disabled={converting}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Converting...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Confirm & Onboard Customer ✓</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
