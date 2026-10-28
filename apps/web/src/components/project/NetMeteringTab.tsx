/**
 * INS Solar Business Management Software — Net Metering Project Tab
 *
 * Provides end-to-end utility interconnection tracking within a project:
 * - Application lifecycle statuses (DRAFT -> READY_TO_SUBMIT -> SUBMITTED -> APPROVED)
 * - Required document completeness audit & validation gates
 * - DISCOM field inspection scheduling & outcome recording
 * - Bi-directional net meter installation & initial reading recording
 * - Feasibility & demand note payment tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  FileCheck,
  FileText,
  Upload,
  Gauge,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface NetMeteringTabProps {
  projectId: string;
  isTerminal?: boolean;
}

interface ApplicationDoc {
  id: string;
  documentType: string;
  title: string;
  isRequired: boolean;
  status: string;
  storageKey?: string;
  fileName?: string;
  rejectionReason?: string;
}

interface NetMeteringApp {
  _id: string;
  applicationNumber: string;
  projectId: string;
  discomName: string;
  division?: string;
  subdivision?: string;
  consumerNumber: string;
  sanctionedLoadKw?: number;
  proposedCapacityKw?: number;
  discomApplicationNumber?: string;
  submissionDate?: string;
  status: string;
  inspectionSchedule?: {
    scheduledDate?: string;
    outcome?: string;
    officerName?: string;
    notes?: string;
  };
  meterInstallation?: {
    meterInstalled?: boolean;
    meterNumber?: string;
    installationDate?: string;
    initialImportReadingKwh?: number;
    initialExportReadingKwh?: number;
  };
  feasibility?: {
    isFeasible?: boolean;
    feasibilityReference?: string;
    demandNoteAmountPaise?: number;
    demandNotePaid?: boolean;
    demandNoteReceiptNumber?: string;
  };
  documents: ApplicationDoc[];
  createdAt: string;
}

export const NetMeteringTab: React.FC<NetMeteringTabProps> = ({
  projectId,
  isTerminal = false
}) => {
  const [applications, setApplications] = useState<NetMeteringApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<NetMeteringApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>('');

  // Form states
  const [formData, setFormData] = useState({
    discomName: 'MSEDCL',
    division: '',
    subdivision: '',
    consumerNumber: '',
    sanctionedLoadKw: 5,
    proposedCapacityKw: 5,
    discomApplicationNumber: '',
    notes: ''
  });

  const [inspectionForm, setInspectionForm] = useState({
    scheduledDate: '',
    officerName: '',
    officerContact: '',
    notes: ''
  });

  const [outcomeForm, setOutcomeForm] = useState({
    outcome: 'PASSED',
    notes: ''
  });

  const [meterForm, setMeterForm] = useState({
    meterNumber: '',
    installationDate: new Date().toISOString().split('T')[0],
    initialImportReadingKwh: 0,
    initialExportReadingKwh: 0,
    testedBy: '',
    notes: ''
  });

  const [uploadFileForm, setUploadFileForm] = useState({
    fileName: '',
    storageKey: '',
    mimeType: 'application/pdf',
    fileSize: 1024 * 300
  });

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<any>(`/net-metering?projectId=${projectId}`);
      const apps = res.applications || res.data?.applications || (Array.isArray(res) ? res : []);
      setApplications(apps);
      if (apps.length > 0) {
        setSelectedApp(apps[0]!);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load net metering applications.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await apiClient('/net-metering', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          discomName: formData.discomName,
          division: formData.division || undefined,
          subdivision: formData.subdivision || undefined,
          consumerNumber: formData.consumerNumber,
          sanctionedLoadKw: Number(formData.sanctionedLoadKw),
          proposedCapacityKw: Number(formData.proposedCapacityKw),
          discomApplicationNumber: formData.discomApplicationNumber || undefined,
          notes: formData.notes || undefined
        })
      });
      setSuccessMsg('Net metering application created successfully.');
      setShowCreateModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to create application.');
    }
  };

  const handleAdvanceStatus = async (status: string) => {
    if (!selectedApp) return;
    try {
      setError(null);
      await apiClient(`/net-metering/${selectedApp._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setSuccessMsg(`Application status updated to ${status}.`);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to update application status.');
    }
  };

  const handleScheduleInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      setError(null);
      await apiClient(`/net-metering/${selectedApp._id}/schedule-inspection`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledDate: inspectionForm.scheduledDate,
          officerName: inspectionForm.officerName || undefined,
          officerContact: inspectionForm.officerContact || undefined,
          notes: inspectionForm.notes || undefined
        })
      });
      setSuccessMsg('Inspection scheduled and reminder registered.');
      setShowInspectionModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule inspection.');
    }
  };

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      setError(null);
      await apiClient(`/net-metering/${selectedApp._id}/inspection-outcome`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: outcomeForm.outcome,
          notes: outcomeForm.notes || undefined
        })
      });
      setSuccessMsg(`Inspection outcome (${outcomeForm.outcome}) recorded.`);
      setShowOutcomeModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to record inspection outcome.');
    }
  };

  const handleRecordMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      setError(null);
      await apiClient(`/net-metering/${selectedApp._id}/meter-installation`, {
        method: 'POST',
        body: JSON.stringify({
          meterNumber: meterForm.meterNumber,
          installationDate: meterForm.installationDate,
          initialImportReadingKwh: Number(meterForm.initialImportReadingKwh),
          initialExportReadingKwh: Number(meterForm.initialExportReadingKwh),
          testedBy: meterForm.testedBy || undefined,
          notes: meterForm.notes || undefined
        })
      });
      setSuccessMsg('Bi-directional net meter installation recorded.');
      setShowMeterModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to record meter installation.');
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !uploadDocType) return;
    try {
      setError(null);
      const safeKey = `evidence/documents/net-metering/${selectedApp._id}/${uploadDocType}/${Date.now()}-${uploadFileForm.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await apiClient(`/net-metering/${selectedApp._id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          documentType: uploadDocType,
          storageKey: safeKey,
          fileName: uploadFileForm.fileName || `${uploadDocType.toLowerCase()}.pdf`,
          fileSize: uploadFileForm.fileSize,
          mimeType: uploadFileForm.mimeType
        })
      });
      setSuccessMsg('Document uploaded and marked for verification.');
      setShowUploadModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document.');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
      DOCUMENTS_PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
      READY_TO_SUBMIT: 'bg-blue-100 text-blue-800 border-blue-300',
      SUBMITTED: 'bg-purple-100 text-purple-800 border-purple-300',
      UNDER_REVIEW: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      INSPECTION_SCHEDULED: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
      CANCELLED: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.DRAFT}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center space-x-2">
        <Clock className="w-5 h-5 animate-spin text-solar-500" />
        <span>Loading net metering details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:text-rose-900 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="font-bold hover:text-emerald-900 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-solar-500/10 border border-solar-500/30 flex items-center justify-center text-solar-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Net Metering Applications</h2>
            <p className="text-xs text-muted-foreground">
              Utility grid interconnection, inspection approvals, and bi-directional meter setup
            </p>
          </div>
        </div>

        {!isTerminal && applications.length === 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 text-white text-xs font-semibold hover:bg-solar-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Application
          </button>
        )}
      </div>

      {applications.length === 0 ? (
        <div className="p-12 text-center bg-card border rounded-xl shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-solar-50 border border-solar-200 text-solar-600 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No Net Metering Application Filed
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Grid synchronization requires a formal application with the state DISCOM. Initiate the
            application to track documents and inspections.
          </p>
          {!isTerminal && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 text-white text-xs font-semibold hover:bg-solar-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              File Net Metering Application
            </button>
          )}
        </div>
      ) : (
        selectedApp && (
          <div className="space-y-6">
            {/* Main Info Card */}
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-extrabold text-foreground tracking-tight">
                      {selectedApp.applicationNumber}
                    </span>
                    {getStatusBadge(selectedApp.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    DISCOM: <strong className="text-foreground">{selectedApp.discomName}</strong> |
                    Consumer Connection:{' '}
                    <strong className="text-foreground">{selectedApp.consumerNumber}</strong>
                  </p>
                </div>

                {/* Action Buttons for Lifecycle */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedApp.status === 'DRAFT' && (
                    <button
                      onClick={() => handleAdvanceStatus('READY_TO_SUBMIT')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Check & Mark Ready to Submit
                    </button>
                  )}
                  {selectedApp.status === 'READY_TO_SUBMIT' && (
                    <button
                      onClick={() => handleAdvanceStatus('SUBMITTED')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors"
                    >
                      Mark as Submitted
                    </button>
                  )}
                  {['SUBMITTED', 'UNDER_REVIEW'].includes(selectedApp.status) && (
                    <button
                      onClick={() => setShowInspectionModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 transition-colors flex items-center"
                    >
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      Schedule Inspection
                    </button>
                  )}
                  {selectedApp.status === 'INSPECTION_SCHEDULED' && (
                    <button
                      onClick={() => setShowOutcomeModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center"
                    >
                      <FileCheck className="w-3.5 h-3.5 mr-1" />
                      Record Inspection Outcome
                    </button>
                  )}
                  {selectedApp.status === 'APPROVED' &&
                    !selectedApp.meterInstallation?.meterInstalled && (
                      <button
                        onClick={() => setShowMeterModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-solar-600 text-white text-xs font-semibold hover:bg-solar-700 transition-colors flex items-center"
                      >
                        <Gauge className="w-3.5 h-3.5 mr-1" />
                        Install Net Meter
                      </button>
                    )}
                </div>
              </div>

              {/* Application Overview Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Sanctioned Load</span>
                  <p className="font-bold text-foreground text-sm">
                    {selectedApp.sanctionedLoadKw || 0} kW
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Proposed Solar Capacity</span>
                  <p className="font-bold text-foreground text-sm">
                    {selectedApp.proposedCapacityKw || 0} kW
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">DISCOM Application Ref</span>
                  <p className="font-bold text-foreground text-sm">
                    {selectedApp.discomApplicationNumber || 'Pending Filing'}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Net Meter Status</span>
                  <p className="font-bold text-foreground text-sm">
                    {selectedApp.meterInstallation?.meterInstalled ? (
                      <span className="text-emerald-600 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Installed ({selectedApp.meterInstallation.meterNumber})
                      </span>
                    ) : (
                      <span className="text-amber-600">Pending Installation</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Inspection Outcome Alert if Present */}
              {selectedApp.inspectionSchedule?.scheduledDate && (
                <div className="p-4 bg-muted/30 border rounded-xl flex items-start justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-solar-600" />
                      <span className="font-bold text-foreground">DISCOM Inspection Schedule</span>
                    </div>
                    <p className="text-muted-foreground">
                      Scheduled for:{' '}
                      <strong>
                        {new Date(
                          selectedApp.inspectionSchedule.scheduledDate
                        ).toLocaleDateString()}
                      </strong>
                      {selectedApp.inspectionSchedule.officerName &&
                        ` with Officer ${selectedApp.inspectionSchedule.officerName}`}
                    </p>
                    {selectedApp.inspectionSchedule.outcome && (
                      <p className="text-muted-foreground">
                        Outcome:{' '}
                        <span
                          className={
                            selectedApp.inspectionSchedule.outcome === 'PASSED'
                              ? 'text-emerald-600 font-bold'
                              : 'text-rose-600 font-bold'
                          }
                        >
                          {selectedApp.inspectionSchedule.outcome}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Document Completeness Checklist */}
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-solar-600" />
                    <span>Mandatory Interconnection Documents</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All documents must be verified and accepted before filing to the DISCOM portal.
                  </p>
                </div>
              </div>

              <div className="divide-y text-xs">
                {selectedApp.documents.map(doc => (
                  <div key={doc.id} className="py-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">{doc.title}</span>
                        {doc.isRequired && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        Type: {doc.documentType} {doc.fileName && `| File: ${doc.fileName}`}
                      </span>
                      {doc.rejectionReason && (
                        <p className="text-rose-600 text-[11px] font-medium">
                          Rejection Reason: {doc.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          doc.status === 'ACCEPTED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : doc.status === 'UPLOADED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : doc.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {doc.status}
                      </span>

                      {!isTerminal && (
                        <button
                          onClick={() => {
                            setUploadDocType(doc.documentType);
                            setUploadFileForm({
                              fileName: `${doc.documentType.toLowerCase()}.pdf`,
                              storageKey: '',
                              mimeType: 'application/pdf',
                              fileSize: 1024 * 300
                            });
                            setShowUploadModal(true);
                          }}
                          className="px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[11px] font-semibold flex items-center"
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          {doc.storageKey ? 'Replace' : 'Upload'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* Create Application Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">File Net Metering Application</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateApplication} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">DISCOM / Utility Name</label>
                <input
                  type="text"
                  required
                  value={formData.discomName}
                  onChange={e => setFormData({ ...formData, discomName: e.target.value })}
                  placeholder="e.g. MSEDCL, BESCOM, TSSPDCL"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Division</label>
                  <input
                    type="text"
                    value={formData.division}
                    onChange={e => setFormData({ ...formData, division: e.target.value })}
                    placeholder="e.g. Pune East"
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Subdivision</label>
                  <input
                    type="text"
                    value={formData.subdivision}
                    onChange={e => setFormData({ ...formData, subdivision: e.target.value })}
                    placeholder="e.g. Hadapsar"
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Consumer Connection / CA Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.consumerNumber}
                  onChange={e => setFormData({ ...formData, consumerNumber: e.target.value })}
                  placeholder="12-digit electricity consumer number"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.sanctionedLoadKw}
                    onChange={e =>
                      setFormData({ ...formData, sanctionedLoadKw: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Proposed Solar Capacity (kW)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.proposedCapacityKw}
                    onChange={e =>
                      setFormData({ ...formData, proposedCapacityKw: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                  placeholder="Additional remarks"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg hover:bg-solar-700 font-semibold"
                >
                  Create Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Inspection Modal */}
      {showInspectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">
                Schedule DISCOM Field Inspection
              </h3>
              <button
                onClick={() => setShowInspectionModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleInspection} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Inspection Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={inspectionForm.scheduledDate}
                  onChange={e =>
                    setInspectionForm({ ...inspectionForm, scheduledDate: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Inspecting Officer Name</label>
                <input
                  type="text"
                  value={inspectionForm.officerName}
                  onChange={e =>
                    setInspectionForm({ ...inspectionForm, officerName: e.target.value })
                  }
                  placeholder="e.g. Mr. S. K. Patil"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Officer Phone</label>
                <input
                  type="text"
                  value={inspectionForm.officerContact}
                  onChange={e =>
                    setInspectionForm({ ...inspectionForm, officerContact: e.target.value })
                  }
                  placeholder="+91..."
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Special Instructions</label>
                <textarea
                  rows={2}
                  value={inspectionForm.notes}
                  onChange={e => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                  placeholder="Safety gear, access to meter room, etc."
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-semibold"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Outcome Modal */}
      {showOutcomeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">Record Inspection Outcome</h3>
              <button
                onClick={() => setShowOutcomeModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordOutcome} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Outcome</label>
                <div className="flex space-x-4 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="outcome"
                      value="PASSED"
                      checked={outcomeForm.outcome === 'PASSED'}
                      onChange={() => setOutcomeForm({ ...outcomeForm, outcome: 'PASSED' })}
                    />
                    <span className="font-semibold text-emerald-700 flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      PASSED (Approve)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="outcome"
                      value="FAILED"
                      checked={outcomeForm.outcome === 'FAILED'}
                      onChange={() => setOutcomeForm({ ...outcomeForm, outcome: 'FAILED' })}
                    />
                    <span className="font-semibold text-rose-700 flex items-center">
                      <XCircle className="w-4 h-4 mr-1" />
                      FAILED (Reject)
                    </span>
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Officer Notes & Findings</label>
                <textarea
                  rows={3}
                  required
                  value={outcomeForm.notes}
                  onChange={e => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                  placeholder="Record compliance remarks, earthing test values, or discrepancies."
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowOutcomeModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg font-semibold ${
                    outcomeForm.outcome === 'PASSED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Install Net Meter Modal */}
      {showMeterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">Record Bi-Directional Net Meter</h3>
              <button
                onClick={() => setShowMeterModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordMeter} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Meter Serial Number</label>
                <input
                  type="text"
                  required
                  value={meterForm.meterNumber}
                  onChange={e => setMeterForm({ ...meterForm, meterNumber: e.target.value })}
                  placeholder="e.g. MTR-L&T-2026-99"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Installation Date</label>
                <input
                  type="date"
                  required
                  value={meterForm.installationDate}
                  onChange={e => setMeterForm({ ...meterForm, installationDate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Initial Import Reading (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={meterForm.initialImportReadingKwh}
                    onChange={e =>
                      setMeterForm({
                        ...meterForm,
                        initialImportReadingKwh: Number(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Initial Export Reading (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={meterForm.initialExportReadingKwh}
                    onChange={e =>
                      setMeterForm({
                        ...meterForm,
                        initialExportReadingKwh: Number(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Commissioning Engineer / Tested By
                </label>
                <input
                  type="text"
                  value={meterForm.testedBy}
                  onChange={e => setMeterForm({ ...meterForm, testedBy: e.target.value })}
                  placeholder="Name of installer or DISCOM technician"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowMeterModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg hover:bg-solar-700 font-semibold"
                >
                  Save Meter Installation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">
                Upload Document: {uploadDocType}
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">File Name</label>
                <input
                  type="text"
                  required
                  value={uploadFileForm.fileName}
                  onChange={e => setUploadFileForm({ ...uploadFileForm, fileName: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">MIME Type</label>
                <select
                  value={uploadFileForm.mimeType}
                  onChange={e => setUploadFileForm({ ...uploadFileForm, mimeType: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                >
                  <option value="application/pdf">PDF Document (application/pdf)</option>
                  <option value="image/jpeg">JPEG Image (image/jpeg)</option>
                  <option value="image/png">PNG Image (image/png)</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Files are stored securely with authorized access verification. Permanent public URLs
                are never generated.
              </p>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg hover:bg-solar-700 font-semibold"
                >
                  Upload & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
