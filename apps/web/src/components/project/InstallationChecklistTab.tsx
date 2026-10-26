/**
 * INS Solar Business Management Software — Installation Checklist Component
 *
 * Operational 5-category quality and safety checklist inspection:
 * - 1. Site readiness and safety
 * - 2. Mounting structure and module installation
 * - 3. DC wiring, protection and earthing
 * - 4. Inverter, AC wiring and electrical protection
 * - 5. Testing, commissioning and handover readiness
 *
 * Enforces mandatory photo evidence for PASSED status and mandatory failure/blocker reasons.
 * Integrates private object-storage metadata and authorized link resolution.
 */

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Camera,
  MapPin,
  ShieldCheck,
  FileCheck,
  X,
  Plus,
  Eye
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface EvidenceItem {
  _id: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  uploadedAt: string;
  uploadedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface ChecklistItem {
  _id: string;
  itemCode: string;
  description: string;
  isRequired: boolean;
  requiresEvidence: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'BLOCKED';
  notes?: string;
  failureReason?: string;
  blockerReason?: string;
  inspectedAt?: string;
  inspectedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  evidence: EvidenceItem[];
}

interface ChecklistCategoryGroup {
  category: string;
  title: string;
  items: ChecklistItem[];
}

interface ProjectChecklistDetail {
  _id: string;
  projectId: string;
  templateCode: string;
  templateVersion: number;
  categories: ChecklistCategoryGroup[];
}

interface InstallationChecklistTabProps {
  projectId: string;
  isTerminal?: boolean;
}

const CATEGORY_NAMES: Record<string, string> = {
  SITE_READINESS_SAFETY: '1. Site Readiness & Safety',
  STRUCTURE_MODULE_MOUNTING: '2. Mounting Structure & Modules',
  DC_WIRING_EARTHING: '3. DC Wiring, Protection & Earthing',
  INVERTER_AC_PROTECTION: '4. Inverter, AC & Protection',
  TESTING_COMMISSIONING_HANDOVER: '5. Testing & Handover Readiness'
};

export const InstallationChecklistTab: React.FC<InstallationChecklistTabProps> = ({
  projectId,
  isTerminal = false
}) => {
  const [checklist, setChecklist] = useState<ProjectChecklistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Reason Modal State (for FAILED or BLOCKED)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'PASSED' | 'FAILED' | 'BLOCKED' | 'IN_PROGRESS'>('PASSED');
  const [statusReason, setStatusReason] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Evidence Upload Modal State
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceTargetItem, setEvidenceTargetItem] = useState<ChecklistItem | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [evidenceCaption, setEvidenceCaption] = useState('');
  const [evidenceLat, setEvidenceLat] = useState('');
  const [evidenceLng, setEvidenceLng] = useState('');
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);

  // Secure Access Viewer Modal State
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessData, setAccessData] = useState<{
    evidenceId: string;
    accessUrl: string;
    expiresAt: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<ProjectChecklistDetail>(`/projects/${projectId}/checklist`);
      setChecklist(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load installation checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [projectId]);

  // Handle Initialize/Generate Checklist from Default Template
  const handleGenerateChecklist = async () => {
    try {
      setLoading(true);
      await apiClient(`/projects/${projectId}/checklist/generate`, {
        method: 'POST',
        body: JSON.stringify({ templateCode: 'CKT-STANDARD-ROOFTOP' })
      });
      fetchChecklist();
    } catch (err: any) {
      alert(err?.message || 'Failed to generate installation checklist.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Pass action or open modal if FAILED/BLOCKED
  const handleStatusClick = async (item: ChecklistItem, status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'IN_PROGRESS') => {
    if (status === 'PASSED') {
      if (item.requiresEvidence && (!item.evidence || item.evidence.length === 0)) {
        alert(`Photo evidence is strictly mandatory for checklist item "${item.itemCode}: ${item.description}" before marking it PASSED.`);
        return;
      }
      try {
        await apiClient(`/projects/${projectId}/checklist/items/${item._id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'PASSED' })
        });
        fetchChecklist();
      } catch (err: any) {
        alert(err?.message || 'Failed to update item status.');
      }
      return;
    }

    if (status === 'IN_PROGRESS') {
      try {
        await apiClient(`/projects/${projectId}/checklist/items/${item._id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'IN_PROGRESS' })
        });
        fetchChecklist();
      } catch (err: any) {
        alert(err?.message || 'Failed to set item in progress.');
      }
      return;
    }

    // FAILED or BLOCKED requires a reason dialog
    setActiveItem(item);
    setTargetStatus(status);
    setStatusReason('');
    setStatusNotes('');
    setStatusModalOpen(true);
  };

  // Submit Status Modal
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (['FAILED', 'BLOCKED'].includes(targetStatus) && !statusReason.trim()) {
      alert(`A valid justification is strictly required when marking an inspection item as ${targetStatus}.`);
      return;
    }

    try {
      setStatusSubmitting(true);
      const payload: any = {
        status: targetStatus,
        notes: statusNotes.trim() || undefined
      };
      if (targetStatus === 'FAILED') payload.failureReason = statusReason.trim();
      if (targetStatus === 'BLOCKED') payload.blockerReason = statusReason.trim();

      await apiClient(`/projects/${projectId}/checklist/items/${activeItem._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setStatusModalOpen(false);
      setActiveItem(null);
      setStatusReason('');
      setStatusNotes('');
      fetchChecklist();
    } catch (err: any) {
      alert(err?.message || 'Failed to update inspection item.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Open Evidence Modal
  const handleOpenEvidenceModal = (item: ChecklistItem) => {
    setEvidenceTargetItem(item);
    setEvidenceFileName(`CHK-${item.itemCode}-${Date.now().toString().slice(-4)}.jpg`);
    setEvidenceCaption('');
    setEvidenceLat('');
    setEvidenceLng('');
    setEvidenceModalOpen(true);
  };

  // Detect GPS Location
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEvidenceLat(pos.coords.latitude.toFixed(6));
        setEvidenceLng(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        alert(`Failed to detect GPS coordinates: ${err.message}`);
      }
    );
  };

  // Submit Evidence
  const handleEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceTargetItem) return;

    try {
      setEvidenceSubmitting(true);
      const payload: any = {
        fileName: evidenceFileName.trim() || 'inspection_photo.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024 * 350, // Standard 350KB test photo size
        caption: evidenceCaption.trim() || undefined
      };

      if (evidenceLat.trim() && evidenceLng.trim()) {
        const lat = parseFloat(evidenceLat.trim());
        const lng = parseFloat(evidenceLng.trim());
        if (isNaN(lat) || lat < -90 || lat > 90) {
          alert('Latitude must be a valid number between -90 and 90.');
          setEvidenceSubmitting(false);
          return;
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          alert('Longitude must be a valid number between -180 and 180.');
          setEvidenceSubmitting(false);
          return;
        }
        payload.latitude = lat;
        payload.longitude = lng;
      }

      await apiClient(`/projects/${projectId}/checklist/items/${evidenceTargetItem._id}/evidence`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setEvidenceModalOpen(false);
      setEvidenceTargetItem(null);
      fetchChecklist();
    } catch (err: any) {
      alert(err?.message || 'Failed to attach evidence.');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  // Request Authorized Link
  const handleViewEvidence = async (evidenceId: string) => {
    try {
      setAccessLoading(true);
      setAccessModalOpen(true);
      const res = await apiClient<any>(`/projects/${projectId}/checklist/evidence/${evidenceId}`);
      setAccessData(res);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate authorized access link.');
      setAccessModalOpen(false);
    } finally {
      setAccessLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-solar-600 mb-2"></div>
        <p>Loading installation inspection checklist...</p>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="p-8 bg-card border rounded-xl text-center space-y-4">
        <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto" />
        <h3 className="text-base font-bold text-foreground">No Checklist Initialized</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          This project does not have an active installation checklist instance. Initialize from standard rooftop
          template to begin quality assurance.
        </p>
        {!isTerminal && (
          <button
            onClick={handleGenerateChecklist}
            className="inline-flex items-center px-4 py-2 bg-solar-600 text-white rounded-lg text-xs font-semibold hover:bg-solar-700 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Initialize Standard Checklist
          </button>
        )}
      </div>
    );
  }

  // Calculate Global Counts & Incomplete Mandatory Items
  let totalMandatory = 0;
  let passedMandatory = 0;
  const blockedMandatoryItems: ChecklistItem[] = [];

  checklist.categories.forEach((cat) => {
    cat.items.forEach((item) => {
      if (item.isRequired) {
        totalMandatory++;
        if (item.status === 'PASSED') {
          passedMandatory++;
        } else if (item.status === 'FAILED' || item.status === 'BLOCKED') {
          blockedMandatoryItems.push(item);
        }
      }
    });
  });

  const allItems = checklist.categories.flatMap((c) => c.items);
  const totalItemsCount = allItems.length;
  const passedItemsCount = allItems.filter((i) => i.status === 'PASSED').length;

  const filteredCategories =
    selectedCategory === 'ALL'
      ? checklist.categories
      : checklist.categories.filter((c) => c.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-solar-600" />
            Installation Quality & Safety Checklist
          </h2>
          <p className="text-xs text-muted-foreground">
            Standard Rooftop Quality Gates ({checklist.templateCode} v{checklist.templateVersion})
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-solar-50 text-solar-800 border border-solar-200">
            Mandatory: {passedMandatory} / {totalMandatory} Passed
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border">
            Total: {passedItemsCount} / {totalItemsCount}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Mandatory Stage Gate Blocker Warning */}
      {blockedMandatoryItems.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Commissioning Stage Gates Blocked ({blockedMandatoryItems.length} items failed/blocked)
            </h4>
            <p className="text-xs">
              Project cannot advance to <strong>Stage 8: Pre-Commission Testing</strong> or{' '}
              <strong>Stage 10: Handover</strong> until all mandatory checks are PASSED.
            </p>
            <ul className="text-xs list-disc list-inside space-y-0.5 pt-1 font-mono">
              {blockedMandatoryItems.map((b) => (
                <li key={b._id}>
                  [{b.itemCode}] {b.description} —{' '}
                  <span className="font-bold text-destructive">{b.status}</span>
                  {b.failureReason ? `: ${b.failureReason}` : b.blockerReason ? `: ${b.blockerReason}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Category Navigation Pills */}
      <div className="flex flex-wrap gap-2 pt-1 border-b pb-3">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            selectedCategory === 'ALL'
              ? 'bg-solar-600 text-white shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          All Categories ({totalItemsCount})
        </button>
        {checklist.categories.map((c) => {
          const catPassed = c.items.filter((i) => i.status === 'PASSED').length;
          const catTotal = c.items.length;
          const isComplete = catPassed === catTotal;

          return (
            <button
              key={c.category}
              onClick={() => setSelectedCategory(c.category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                selectedCategory === c.category
                  ? 'bg-solar-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{CATEGORY_NAMES[c.category] || c.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                {catPassed}/{catTotal}
              </span>
            </button>
          );
        })}
      </div>

      {/* Categories & Checklist Items */}
      <div className="space-y-6">
        {filteredCategories.map((catGroup) => (
          <div key={catGroup.category} className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-muted/20 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground flex items-center">
                <FileCheck className="w-4 h-4 mr-2 text-solar-600" />
                {CATEGORY_NAMES[catGroup.category] || catGroup.title}
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {catGroup.items.filter((i) => i.status === 'PASSED').length} / {catGroup.items.length} Passed
              </span>
            </div>

            <div className="divide-y">
              {catGroup.items.map((item) => {
                const isPassed = item.status === 'PASSED';
                const isFailed = item.status === 'FAILED';
                const isBlocked = item.status === 'BLOCKED';
                const isInProgress = item.status === 'IN_PROGRESS';

                return (
                  <div key={item._id} className="p-4 hover:bg-muted/10 transition-colors space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border">
                            {item.itemCode}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground">{item.description}</h4>

                          {item.isRequired ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                              Mandatory
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              Optional
                            </span>
                          )}

                          {item.requiresEvidence && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 flex items-center">
                              <Camera className="w-3 h-3 mr-1" /> Photo Required
                            </span>
                          )}
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          {isPassed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> PASSED
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 mr-1 text-rose-600" /> FAILED
                            </span>
                          )}
                          {isBlocked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> BLOCKED
                            </span>
                          )}
                          {isInProgress && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Clock className="w-3 h-3 mr-1 text-blue-600" /> IN PROGRESS
                            </span>
                          )}
                          {item.status === 'NOT_STARTED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                              NOT STARTED
                            </span>
                          )}

                          {item.inspectedAt && (
                            <span className="text-muted-foreground text-[11px]">
                              Inspected {new Date(item.inspectedAt).toLocaleString()}
                              {item.inspectedBy && ` by ${item.inspectedBy.firstName} ${item.inspectedBy.lastName}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Item Actions */}
                      {!isTerminal && (
                        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-center">
                          <button
                            onClick={() => handleOpenEvidenceModal(item)}
                            className="inline-flex items-center px-2.5 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium"
                          >
                            <Camera className="w-3.5 h-3.5 mr-1" />
                            Attach Photo ({item.evidence?.length || 0})
                          </button>

                          {item.status !== 'PASSED' && (
                            <button
                              onClick={() => handleStatusClick(item, 'PASSED')}
                              className="inline-flex items-center px-2.5 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Pass
                            </button>
                          )}

                          {item.status !== 'IN_PROGRESS' && item.status !== 'PASSED' && (
                            <button
                              onClick={() => handleStatusClick(item, 'IN_PROGRESS')}
                              className="px-2 py-1 text-xs rounded border hover:bg-muted font-medium"
                            >
                              In Progress
                            </button>
                          )}

                          {item.status !== 'FAILED' && (
                            <button
                              onClick={() => handleStatusClick(item, 'FAILED')}
                              className="px-2 py-1 text-xs rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium"
                            >
                              Fail
                            </button>
                          )}

                          {item.status !== 'BLOCKED' && (
                            <button
                              onClick={() => handleStatusClick(item, 'BLOCKED')}
                              className="px-2 py-1 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium"
                            >
                              Block
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Failure / Blocker Reasons */}
                    {item.failureReason && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Failure Reason:</strong> {item.failureReason}
                      </div>
                    )}
                    {item.blockerReason && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                        <strong>Blocker Reason:</strong> {item.blockerReason}
                      </div>
                    )}

                    {/* Attached Photo Evidence Gallery */}
                    {item.evidence && item.evidence.length > 0 && (
                      <div className="pt-2 border-t space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Attached Verification Photos ({item.evidence.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {item.evidence.map((ev) => (
                            <div
                              key={ev._id}
                              className="p-2.5 bg-muted/40 border rounded-lg flex items-center justify-between text-xs hover:bg-muted/60 transition-colors"
                            >
                              <div className="space-y-0.5 overflow-hidden pr-2">
                                <p className="font-semibold text-foreground truncate">{ev.fileName}</p>
                                <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
                                  <span>{(ev.fileSizeBytes / 1024).toFixed(0)} KB</span>
                                  {ev.latitude !== undefined && ev.longitude !== undefined && (
                                    <span className="flex items-center text-blue-600 font-mono">
                                      <MapPin className="w-2.5 h-2.5 mr-0.5" />
                                      {ev.latitude.toFixed(2)}, {ev.longitude.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewEvidence(ev._id)}
                                className="inline-flex items-center px-2 py-1 rounded bg-card border text-[11px] font-semibold text-solar-700 hover:bg-solar-50 flex-shrink-0"
                              >
                                <Eye className="w-3 h-3 mr-1" /> View Link
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Reason Modal (For FAILED or BLOCKED) */}
      {statusModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground">
              Mark Item as <span className={targetStatus === 'FAILED' ? 'text-destructive' : 'text-amber-600'}>{targetStatus}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              [{activeItem.itemCode}] {activeItem.description}
            </p>

            <form onSubmit={handleStatusSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Justification / Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={`Specify why this inspection item is ${targetStatus.toLowerCase()}...`}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Remediation instructions or notes..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {statusSubmitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Photo Evidence Modal */}
      {evidenceModalOpen && evidenceTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-base font-bold text-foreground flex items-center">
                <Camera className="w-4 h-4 mr-2 text-solar-600" />
                Attach Photo Evidence
              </h3>
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              [{evidenceTargetItem.itemCode}] {evidenceTargetItem.description}
            </p>

            <form onSubmit={handleEvidenceSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">File Name</label>
                <input
                  type="text"
                  required
                  value={evidenceFileName}
                  onChange={(e) => setEvidenceFileName(e.target.value)}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Caption / Inspection Notes
                </label>
                <input
                  type="text"
                  value={evidenceCaption}
                  onChange={(e) => setEvidenceCaption(e.target.value)}
                  placeholder="e.g. Grounding pit resistance test meter reading 1.8 ohms"
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-foreground">
                    GPS Coordinates (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    className="text-[11px] text-solar-600 hover:text-solar-700 font-semibold flex items-center"
                  >
                    <MapPin className="w-3 h-3 mr-1" /> Detect Device GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={evidenceLat}
                    onChange={(e) => setEvidenceLat(e.target.value)}
                    placeholder="Latitude (-90 to 90)"
                    className="w-full text-xs rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                  <input
                    type="text"
                    value={evidenceLng}
                    onChange={(e) => setEvidenceLng(e.target.value)}
                    placeholder="Longitude (-180 to 180)"
                    className="w-full text-xs rounded-lg border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg text-[11px] text-muted-foreground">
                Photos are stored privately in private object storage. Public links are strictly forbidden. Short-lived authorized access tokens are generated on demand.
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEvidenceModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={evidenceSubmitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {evidenceSubmitting ? 'Uploading...' : 'Save Evidence Metadata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authorized Secure Link Viewer Modal */}
      {accessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-base font-bold text-foreground flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" />
                Authorized Private Evidence Access
              </h3>
              <button
                onClick={() => setAccessModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accessLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-solar-600 mb-2"></div>
                <p>Generating authorized access link...</p>
              </div>
            ) : accessData ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted/30 border rounded-lg text-xs space-y-1.5 font-mono">
                  <p><strong>File:</strong> {accessData.fileName}</p>
                  <p><strong>MIME:</strong> {accessData.mimeType}</p>
                  <p><strong>Size:</strong> {(accessData.fileSizeBytes / 1024).toFixed(1)} KB</p>
                  <p className="text-solar-700"><strong>Link Expiry:</strong> {new Date(accessData.expiresAt).toLocaleTimeString()}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">
                    Temporary Authorized URL:
                  </label>
                  <div className="p-2 bg-muted rounded border text-[11px] font-mono break-all text-muted-foreground">
                    {accessData.accessUrl}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAccessModalOpen(false)}
                    className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
