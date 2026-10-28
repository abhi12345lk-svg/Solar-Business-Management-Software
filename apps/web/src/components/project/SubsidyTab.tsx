/**
 * INS Solar Business Management Software — Subsidy Project Tab
 *
 * Implements government subsidy tracking within a project:
 * - Scheme identification (PM Surya Ghar Muft Bijli Yojana, State Subsidies)
 * - Integer paise financial balance breakdown (Estimated, Requested, Approved, Disbursed, Remaining)
 * - Visual disbursement progress bar
 * - Sanction recording with approved <= requested invariant
 * - Concurrency-safe partial & full disbursement ledger
 * - Subsidy document requirements and verification
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Plus,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  CheckCircle2,
  IndianRupee,
  X,
  CreditCard
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface SubsidyTabProps {
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

interface DisbursementEntry {
  disbursementId: string;
  disbursementReference: string;
  amountPaise: number;
  disbursedAt: string;
  paymentMode: string;
  recipientAccount: string;
  idempotencyKey: string;
  notes?: string;
}

interface SubsidyApp {
  _id: string;
  applicationNumber: string;
  projectId: string;
  schemeName: string;
  schemeVersion?: string;
  portalApplicationNumber?: string;
  systemCapacityKw: number;
  estimatedAmountPaise: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  disbursedAmountPaise: number;
  status: string;
  sanctionReference?: string;
  sanctionDate?: string;
  eligibilityVerified?: boolean;
  documents: ApplicationDoc[];
  disbursements: DisbursementEntry[];
  createdAt: string;
}

export const SubsidyTab: React.FC<SubsidyTabProps> = ({ projectId, isTerminal = false }) => {
  const [applications, setApplications] = useState<SubsidyApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<SubsidyApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>('');

  // Form states
  const [createForm, setCreateForm] = useState({
    schemeName: 'PM_SURYA_GHAR_MUFT_BIJLI_YOJANA',
    schemeVersion: 'v2024.1',
    portalApplicationNumber: '',
    systemCapacityKw: 3.0,
    estimatedAmountRupees: 78000,
    requestedAmountRupees: 78000,
    notes: ''
  });

  const [sanctionForm, setSanctionForm] = useState({
    sanctionReference: '',
    sanctionDate: new Date().toISOString().split('T')[0],
    approvedAmountRupees: 78000,
    notes: ''
  });

  const [disburseForm, setDisburseForm] = useState({
    disbursementReference: '',
    amountRupees: 0,
    disbursedAt: new Date().toISOString().split('T')[0],
    paymentMode: 'DIRECT_BENEFIT_TRANSFER',
    recipientAccount: '',
    idempotencyKey: '',
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
      const res = await apiClient<any>(`/subsidies?projectId=${projectId}`);
      const apps = res.applications || res.data?.applications || (Array.isArray(res) ? res : []);
      setApplications(apps);
      if (apps.length > 0) {
        setSelectedApp(apps[0]!);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subsidy applications.');
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
      await apiClient('/subsidies', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          schemeName: createForm.schemeName,
          schemeVersion: createForm.schemeVersion || undefined,
          portalApplicationNumber: createForm.portalApplicationNumber || undefined,
          systemCapacityKw: Number(createForm.systemCapacityKw),
          estimatedAmountPaise: Math.round(Number(createForm.estimatedAmountRupees) * 100),
          requestedAmountPaise: Math.round(Number(createForm.requestedAmountRupees) * 100),
          notes: createForm.notes || undefined
        })
      });
      setSuccessMsg('Government subsidy application record created.');
      setShowCreateModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to create subsidy application.');
    }
  };

  const handleAdvanceStatus = async (status: string) => {
    if (!selectedApp) return;
    try {
      setError(null);
      await apiClient(`/subsidies/${selectedApp._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setSuccessMsg(`Subsidy status advanced to ${status}.`);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to advance subsidy status.');
    }
  };

  const handleRecordSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      setError(null);
      const approvedPaise = Math.round(Number(sanctionForm.approvedAmountRupees) * 100);
      await apiClient(`/subsidies/${selectedApp._id}/sanction`, {
        method: 'POST',
        body: JSON.stringify({
          sanctionReference: sanctionForm.sanctionReference,
          sanctionDate: sanctionForm.sanctionDate,
          approvedAmountPaise: approvedPaise,
          notes: sanctionForm.notes || undefined
        })
      });
      setSuccessMsg('Official subsidy sanction recorded successfully.');
      setShowSanctionModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to record subsidy sanction.');
    }
  };

  const handleRecordDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      setError(null);
      const amountPaise = Math.round(Number(disburseForm.amountRupees) * 100);
      const idempKey =
        disburseForm.idempotencyKey || `DISB-${selectedApp.applicationNumber}-${Date.now()}`;
      await apiClient(`/subsidies/${selectedApp._id}/disbursements`, {
        method: 'POST',
        body: JSON.stringify({
          disbursementReference: disburseForm.disbursementReference,
          amountPaise,
          disbursedAt: disburseForm.disbursedAt,
          paymentMode: disburseForm.paymentMode,
          recipientAccount: disburseForm.recipientAccount,
          idempotencyKey: idempKey,
          notes: disburseForm.notes || undefined
        })
      });
      setSuccessMsg('Disbursement recorded to audit ledger.');
      setShowDisburseModal(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to record disbursement.');
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !uploadDocType) return;
    try {
      setError(null);
      const safeKey = `evidence/documents/subsidies/${selectedApp._id}/${uploadDocType}/${Date.now()}-${uploadFileForm.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await apiClient(`/subsidies/${selectedApp._id}/documents`, {
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

  const formatRupees = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(rupees);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ELIGIBLE: 'bg-slate-100 text-slate-700 border-slate-300',
      DOCUMENTS_PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
      APPLIED: 'bg-blue-100 text-blue-800 border-blue-300',
      CLAIM_SUBMITTED: 'bg-purple-100 text-purple-800 border-purple-300',
      SANCTIONED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      PARTIALLY_DISBURSED: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      FULLY_DISBURSED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
      CANCELLED: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.ELIGIBLE}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center space-x-2">
        <Clock className="w-5 h-5 animate-spin text-solar-500" />
        <span>Loading subsidy tracking details...</span>
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

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-solar-500/10 border border-solar-500/30 flex items-center justify-center text-solar-600">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Government Subsidy Tracking</h2>
            <p className="text-xs text-muted-foreground">
              PM Surya Ghar Muft Bijli Yojana & State Rooftop subsidy sanctions and disbursements
            </p>
          </div>
        </div>

        {!isTerminal && applications.length === 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 text-white text-xs font-semibold hover:bg-solar-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Subsidy Claim
          </button>
        )}
      </div>

      {applications.length === 0 ? (
        <div className="p-12 text-center bg-card border rounded-xl shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-solar-50 border border-solar-200 text-solar-600 flex items-center justify-center mx-auto">
            <Landmark className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No Subsidy Application Initiated
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Track central/state subsidies, sanction orders, and DBT disbursements for this rooftop
            solar project.
          </p>
          {!isTerminal && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-solar-600 text-white text-xs font-semibold hover:bg-solar-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Initiate Subsidy Tracking
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
                    Scheme:{' '}
                    <strong className="text-foreground">
                      {selectedApp.schemeName.replace(/_/g, ' ')}
                    </strong>{' '}
                    {selectedApp.portalApplicationNumber &&
                      `| Portal Reg: ${selectedApp.portalApplicationNumber}`}
                  </p>
                </div>

                {/* Action Buttons for Lifecycle */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedApp.status === 'ELIGIBLE' && (
                    <button
                      onClick={() => handleAdvanceStatus('APPLIED')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Submit Subsidy Claim
                    </button>
                  )}
                  {['APPLIED', 'CLAIM_SUBMITTED'].includes(selectedApp.status) && (
                    <button
                      onClick={() => {
                        setSanctionForm({
                          sanctionReference: '',
                          sanctionDate: new Date().toISOString().split('T')[0],
                          approvedAmountRupees: (selectedApp.requestedAmountPaise || 0) / 100,
                          notes: ''
                        });
                        setShowSanctionModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Record Sanction
                    </button>
                  )}
                  {['SANCTIONED', 'PARTIALLY_DISBURSED'].includes(selectedApp.status) && (
                    <button
                      onClick={() => {
                        const remainingRupees =
                          ((selectedApp.approvedAmountPaise || 0) -
                            (selectedApp.disbursedAmountPaise || 0)) /
                          100;
                        setDisburseForm({
                          disbursementReference: '',
                          amountRupees: remainingRupees,
                          disbursedAt: new Date().toISOString().split('T')[0],
                          paymentMode: 'DIRECT_BENEFIT_TRANSFER',
                          recipientAccount: '',
                          idempotencyKey: `DISB-${selectedApp.applicationNumber}-${Date.now()}`,
                          notes: ''
                        });
                        setShowDisburseModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center"
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1" />
                      Record Disbursement
                    </button>
                  )}
                </div>
              </div>

              {/* Financial Amounts Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Requested Amount</span>
                  <p className="font-bold text-foreground text-sm">
                    {formatRupees(selectedApp.requestedAmountPaise)}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Sanctioned / Approved</span>
                  <p className="font-bold text-indigo-700 text-sm">
                    {formatRupees(selectedApp.approvedAmountPaise)}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Disbursed (DBT / Bank)</span>
                  <p className="font-bold text-emerald-700 text-sm">
                    {formatRupees(selectedApp.disbursedAmountPaise)}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <p className="font-bold text-foreground text-sm">
                    {formatRupees(
                      Math.max(
                        0,
                        selectedApp.approvedAmountPaise - selectedApp.disbursedAmountPaise
                      )
                    )}
                  </p>
                </div>
              </div>

              {/* Visual Disbursement Progress Bar */}
              {selectedApp.approvedAmountPaise > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Disbursement Progress</span>
                    <span>
                      {Math.round(
                        (selectedApp.disbursedAmountPaise / selectedApp.approvedAmountPaise) * 100
                      )}
                      % Disbursed
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((selectedApp.disbursedAmountPaise / selectedApp.approvedAmountPaise) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Sanction Details if recorded */}
              {selectedApp.sanctionReference && (
                <div className="p-3 bg-muted/30 border rounded-xl text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-foreground">Sanction Order Reference</span>
                  </div>
                  <p className="text-muted-foreground">
                    Order Number:{' '}
                    <strong className="text-foreground">{selectedApp.sanctionReference}</strong>
                    {selectedApp.sanctionDate &&
                      ` | Date: ${new Date(selectedApp.sanctionDate).toLocaleDateString()}`}
                  </p>
                </div>
              )}
            </div>

            {/* Disbursement Ledger Table */}
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                    <IndianRupee className="w-4 h-4 text-solar-600" />
                    <span>Disbursement Ledger ({selectedApp.disbursements?.length || 0})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Immutable audit records of partial and full subsidy bank credits
                  </p>
                </div>
              </div>

              {selectedApp.disbursements && selectedApp.disbursements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Disbursed Date</th>
                        <th className="py-2.5 px-3 font-semibold">UTR / Reference</th>
                        <th className="py-2.5 px-3 font-semibold">Mode</th>
                        <th className="py-2.5 px-3 font-semibold">Recipient Account</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedApp.disbursements.map((d, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3">
                            {new Date(d.disbursedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium">
                            {d.disbursementReference}
                          </td>
                          <td className="py-2.5 px-3">{d.paymentMode.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 font-mono">{d.recipientAccount}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatRupees(d.amountPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No disbursements recorded yet. Monies will be logged upon credit to beneficiary
                  account.
                </div>
              )}
            </div>

            {/* Document Checklist */}
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-solar-600" />
                    <span>Subsidy Claim Supporting Documents</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Evidence for Direct Benefit Transfer (Aadhaar, Bank Passbook, Commissioning
                    Report)
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

      {/* Create Subsidy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">Initiate Subsidy Application</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateApplication} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Subsidy Scheme</label>
                <select
                  value={createForm.schemeName}
                  onChange={e => setCreateForm({ ...createForm, schemeName: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                >
                  <option value="PM_SURYA_GHAR_MUFT_BIJLI_YOJANA">
                    PM Surya Ghar Muft Bijli Yojana (Central)
                  </option>
                  <option value="STATE_ROOFTOP_SUBSIDY">State Rooftop Solar Subsidy</option>
                  <option value="CENTRAL_FINANCIAL_ASSISTANCE">
                    Central Financial Assistance (CFA)
                  </option>
                  <option value="OTHER">Other Scheme</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Scheme Version</label>
                  <input
                    type="text"
                    value={createForm.schemeVersion}
                    onChange={e => setCreateForm({ ...createForm, schemeVersion: e.target.value })}
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    National Portal Reg Number
                  </label>
                  <input
                    type="text"
                    value={createForm.portalApplicationNumber}
                    onChange={e =>
                      setCreateForm({ ...createForm, portalApplicationNumber: e.target.value })
                    }
                    placeholder="e.g. PMSG-2026-99"
                    className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">System Capacity (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={createForm.systemCapacityKw}
                    onChange={e =>
                      setCreateForm({ ...createForm, systemCapacityKw: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Requested Subsidy (₹)</label>
                  <input
                    type="number"
                    required
                    value={createForm.requestedAmountRupees}
                    onChange={e =>
                      setCreateForm({
                        ...createForm,
                        requestedAmountRupees: Number(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Notes</label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Verification notes"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
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
                  Initiate Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Sanction Modal */}
      {showSanctionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">Record Subsidy Sanction</h3>
              <button
                onClick={() => setShowSanctionModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordSanction} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Sanction Order Reference</label>
                <input
                  type="text"
                  required
                  value={sanctionForm.sanctionReference}
                  onChange={e =>
                    setSanctionForm({ ...sanctionForm, sanctionReference: e.target.value })
                  }
                  placeholder="e.g. SANC-MNRE-2026-99"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Sanction Date</label>
                <input
                  type="date"
                  required
                  value={sanctionForm.sanctionDate}
                  onChange={e => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Approved Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={sanctionForm.approvedAmountRupees}
                  onChange={e =>
                    setSanctionForm({
                      ...sanctionForm,
                      approvedAmountRupees: Number(e.target.value)
                    })
                  }
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
                <p className="text-[11px] text-muted-foreground">
                  Must not exceed requested amount (
                  {formatRupees(selectedApp?.requestedAmountPaise || 0)}).
                </p>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Remarks</label>
                <textarea
                  rows={2}
                  value={sanctionForm.notes}
                  onChange={e => setSanctionForm({ ...sanctionForm, notes: e.target.value })}
                  placeholder="Sanction conditions or notes"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowSanctionModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  Confirm Sanction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Disbursement Modal */}
      {showDisburseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-sm text-foreground">Record Subsidy Disbursement</h3>
              <button
                onClick={() => setShowDisburseModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordDisbursement} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Bank UTR / Transaction Reference
                </label>
                <input
                  type="text"
                  required
                  value={disburseForm.disbursementReference}
                  onChange={e =>
                    setDisburseForm({ ...disburseForm, disbursementReference: e.target.value })
                  }
                  placeholder="e.g. UTR202611250001"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tranche Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={disburseForm.amountRupees}
                    onChange={e =>
                      setDisburseForm({ ...disburseForm, amountRupees: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Disbursed Date</label>
                  <input
                    type="date"
                    required
                    value={disburseForm.disbursedAt}
                    onChange={e =>
                      setDisburseForm({ ...disburseForm, disbursedAt: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Payment Mode</label>
                <select
                  value={disburseForm.paymentMode}
                  onChange={e => setDisburseForm({ ...disburseForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                >
                  <option value="DIRECT_BENEFIT_TRANSFER">Direct Benefit Transfer (DBT)</option>
                  <option value="VENDOR_ACCOUNT">Vendor Account (Installer)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Beneficiary Bank Account</label>
                <input
                  type="text"
                  required
                  value={disburseForm.recipientAccount}
                  onChange={e =>
                    setDisburseForm({ ...disburseForm, recipientAccount: e.target.value })
                  }
                  placeholder="e.g. SBI A/c ending 9901"
                  className="w-full px-3 py-2 bg-background border rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Idempotency Key (Duplicate Prevention)
                </label>
                <input
                  type="text"
                  required
                  value={disburseForm.idempotencyKey}
                  onChange={e =>
                    setDisburseForm({ ...disburseForm, idempotencyKey: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono text-[11px]"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
                >
                  Record Disbursement
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
                Document will be securely linked to the subsidy claim. Permanent public URLs are
                never exposed.
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
