/**
 * INS Solar Business Management Software — Subsidy Register Page
 *
 * Enterprise register for Central & State solar subsidies (PM Surya Ghar Muft Bijli Yojana):
 * - Financial summary in INR (Requested, Sanctioned, Disbursed, Remaining)
 * - Sanction & Direct Benefit Transfer (DBT) progression
 * - Bounded filters by scheme, status, and portal registration numbers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark,
  Search,
  Filter,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface SubsidyRecord {
  _id: string;
  applicationNumber: string;
  projectId: {
    _id: string;
    projectCode: string;
    name: string;
  };
  customerId: {
    _id: string;
    name: string;
    phone: string;
  };
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
  createdAt: string;
}

export const SubsidyPage: React.FC = () => {
  const [subsidies, setSubsidies] = useState<SubsidyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Detail & Audit Modal State
  const [selectedSubsidyDetail, setSelectedSubsidyDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Register New Claim Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [projectsList, setProjectsList] = useState<Array<{ _id: string; projectCode: string; name: string; capacityKw?: number; customerId?: any }>>([]);
  const [registerForm, setRegisterForm] = useState({
    projectId: '',
    schemeName: 'PM_SURYA_GHAR_MUFT_BIJLI_YOJANA',
    portalApplicationNumber: '',
    systemCapacityKw: 3.0,
    requestedAmountRupees: 78000,
    notes: ''
  });
  const [submittingRegister, setSubmittingRegister] = useState(false);

  // DBT Disbursement Modal State
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [selectedSubsidy, setSelectedSubsidy] = useState<SubsidyRecord | null>(null);
  const [disburseForm, setDisburseForm] = useState({
    amountRupees: '',
    disbursementReference: '',
    recipientAccount: '',
    disbursedAt: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [submittingDisburse, setSubmittingDisburse] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleOpenDisburseModal = (sub: SubsidyRecord) => {
    setSelectedSubsidy(sub);
    const approved = sub.approvedAmountPaise || sub.requestedAmountPaise || 0;
    const remaining = Math.max(0, approved - (sub.disbursedAmountPaise || 0));
    setDisburseForm({
      amountRupees: remaining > 0 ? (remaining / 100).toFixed(2) : (approved / 100).toFixed(2),
      disbursementReference: `DBT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      recipientAccount: `Beneficiary Account • ${sub.customerId?.name || 'Consumer'}`,
      disbursedAt: new Date().toISOString().split('T')[0],
      notes: 'PM Surya Ghar DBT subsidy credited directly to consumer bank account.'
    });
    setIsDisburseModalOpen(true);
  };

  const handleSubmitDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubsidy) return;
    try {
      setSubmittingDisburse(true);
      setError(null);
      const amountPaise = Math.round(parseFloat(disburseForm.amountRupees) * 100);
      if (isNaN(amountPaise) || amountPaise <= 0) {
        alert('Please enter a valid disbursement amount.');
        return;
      }

      await apiClient(`/subsidies/${selectedSubsidy._id}/disbursements`, {
        method: 'POST',
        body: JSON.stringify({
          disbursementReference: disburseForm.disbursementReference.trim(),
          amountPaise,
          disbursedAt: new Date(disburseForm.disbursedAt || Date.now()),
          paymentMode: 'DIRECT_BENEFIT_TRANSFER',
          recipientAccount: disburseForm.recipientAccount.trim(),
          idempotencyKey: `dbt-${selectedSubsidy._id}-${Date.now()}`,
          notes: disburseForm.notes.trim() || undefined
        })
      });

      setActionSuccess(`DBT Disbursement of ₹${disburseForm.amountRupees} recorded successfully!`);
      setIsDisburseModalOpen(false);
      setSelectedSubsidy(null);
      fetchSubsidies();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to record disbursement: ${err.message || 'Error'}`);
    } finally {
      setSubmittingDisburse(false);
    }
  };

  const handleOpenDetailModal = async (sub: SubsidyRecord) => {
    try {
      // Fetch fresh populated application document with disbursements
      const res = await apiClient<any>(`/subsidies/${sub._id}`);
      setSelectedSubsidyDetail(res || sub);
    } catch {
      setSelectedSubsidyDetail(sub);
    }
    setIsDetailModalOpen(true);
  };

  const handleOpenRegisterModal = async () => {
    try {
      const res = await apiClient<any>('/projects?limit=50');
      const list = res?.projects || res?.data || (Array.isArray(res) ? res : []);
      setProjectsList(list);
      if (list.length > 0) {
        const first = list[0];
        const cap = Number(first.capacityKw) || 3.0;
        const est = cap <= 2 ? Math.round(cap * 30000) : 78000;
        setRegisterForm({
          projectId: first._id,
          schemeName: 'PM_SURYA_GHAR_MUFT_BIJLI_YOJANA',
          portalApplicationNumber: `PMSG-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          systemCapacityKw: cap,
          requestedAmountRupees: est,
          notes: 'Subsidy claim initiated under PM Surya Ghar national portal'
        });
      }
      setIsRegisterModalOpen(true);
    } catch (err: any) {
      alert(`Failed to load projects: ${err.message}`);
    }
  };

  const handleProjectSelectForRegister = (pId: string) => {
    const proj = projectsList.find(p => p._id === pId);
    const cap = Number(proj?.capacityKw) || 3.0;
    const est = cap <= 2 ? Math.round(cap * 30000) : 78000;
    setRegisterForm(prev => ({
      ...prev,
      projectId: pId,
      systemCapacityKw: cap,
      requestedAmountRupees: est
    }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.projectId) {
      alert('Please select a solar project.');
      return;
    }
    try {
      setSubmittingRegister(true);
      const reqPaise = Math.round(Number(registerForm.requestedAmountRupees) * 100);
      await apiClient('/subsidies', {
        method: 'POST',
        body: JSON.stringify({
          projectId: registerForm.projectId,
          schemeName: registerForm.schemeName,
          portalApplicationNumber: registerForm.portalApplicationNumber.trim() || undefined,
          systemCapacityKw: Number(registerForm.systemCapacityKw),
          estimatedAmountPaise: reqPaise,
          requestedAmountPaise: reqPaise,
          notes: registerForm.notes.trim() || undefined
        })
      });
      setActionSuccess('Government subsidy claim registered successfully!');
      setIsRegisterModalOpen(false);
      fetchSubsidies();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to register subsidy: ${err.message || 'Error'}`);
    } finally {
      setSubmittingRegister(false);
    }
  };

  const fetchSubsidies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/subsidies?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (schemeFilter) query += `&schemeName=${encodeURIComponent(schemeFilter)}`;

      const res = await apiClient<any>(query);
      const list = res.applications || res.data?.applications || [];
      const count = res.total ?? res.data?.total ?? list.length;
      setSubsidies(list);
      setTotal(count);
    } catch (err: any) {
      setError(err.message || 'Failed to load subsidy records.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, schemeFilter]);

  useEffect(() => {
    fetchSubsidies();
  }, [fetchSubsidies]);

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
        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || styles.ELIGIBLE}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Financial aggregates
  const totalRequestedPaise = subsidies.reduce((sum, s) => sum + (s.requestedAmountPaise || 0), 0);
  const totalApprovedPaise = subsidies.reduce((sum, s) => sum + (s.approvedAmountPaise || 0), 0);
  const totalDisbursedPaise = subsidies.reduce((sum, s) => sum + (s.disbursedAmountPaise || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-solar-500/10 text-solar-600 border border-solar-500/20">
              <Landmark className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Government Subsidies &amp; DBT Registry
            </h1>
            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              PM Surya Ghar DBT
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            National Rooftop Solar Portal claims, sanctions, and Direct Benefit Transfer (DBT)
            disbursement verification.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleOpenRegisterModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <span>+ Register Subsidy Claim</span>
          </button>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Claims</span>
            <Landmark className="w-4 h-4 text-solar-600" />
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">{total}</p>
          <span className="text-[11px] text-muted-foreground">Applications registered</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Requested</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 tracking-tight">
            {formatRupees(totalRequestedPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground">Submitted claim total</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Sanctioned Amount</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-700 tracking-tight">
            {formatRupees(totalApprovedPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground">Approved by MNRE / DISCOM</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Actually Disbursed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 tracking-tight">
            {formatRupees(totalDisbursedPaise)}
          </p>
          <span className="text-[11px] text-muted-foreground">Credited via DBT</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search by application #, portal reg #, or sanction ref..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ELIGIBLE">Eligible</option>
            <option value="DOCUMENTS_PENDING">Documents Pending</option>
            <option value="APPLIED">Applied</option>
            <option value="CLAIM_SUBMITTED">Claim Submitted</option>
            <option value="SANCTIONED">Sanctioned</option>
            <option value="PARTIALLY_DISBURSED">Partially Disbursed</option>
            <option value="FULLY_DISBURSED">Fully Disbursed</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={schemeFilter}
            onChange={e => {
              setSchemeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none"
          >
            <option value="">All Schemes</option>
            <option value="PM_SURYA_GHAR_MUFT_BIJLI_YOJANA">PM Surya Ghar Yojana</option>
            <option value="STATE_ROOFTOP_SUBSIDY">State Rooftop Subsidy</option>
            <option value="CENTRAL_FINANCIAL_ASSISTANCE">CFA</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs flex items-center justify-center space-x-2">
            <Clock className="w-5 h-5 animate-spin text-solar-500" />
            <span>Loading subsidy claims...</span>
          </div>
        ) : subsidies.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Landmark className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No subsidy records found</p>
            <p className="text-xs text-muted-foreground">Adjust filters or search parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Project & Customer</th>
                  <th className="py-3 px-4">Scheme & Portal Ref</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Requested</th>
                  <th className="py-3 px-4">Approved</th>
                  <th className="py-3 px-4">Disbursed</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subsidies.map(sub => (
                  <tr key={sub._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(sub)}
                        className="text-solar-600 hover:text-solar-700 hover:underline cursor-pointer font-bold"
                        title="Click to view full application & DBT audit"
                      >
                        {sub.applicationNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {sub.projectId?.name || sub.projectId?.projectCode || 'Project'}
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {sub.customerId?.name || 'Customer'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {sub.schemeName.replace(/_/g, ' ')}
                      </div>
                      <span className="text-muted-foreground text-[11px] font-mono">
                        {sub.portalApplicationNumber || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {sub.systemCapacityKw} kW
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {formatRupees(sub.requestedAmountPaise)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                      {formatRupees(sub.approvedAmountPaise)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                      {formatRupees(sub.disbursedAmountPaise)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(sub.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(sub)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border transition-colors cursor-pointer"
                          title="View Application Details & DBT Audit History"
                        >
                          <span>Details</span>
                        </button>
                        {sub.status !== 'FULLY_DISBURSED' && (
                          <button
                            type="button"
                            onClick={() => handleOpenDisburseModal(sub)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            title="Record Direct Benefit Transfer (DBT) Subsidy Credit"
                          >
                            <IndianRupee className="w-3 h-3" />
                            <span>Record DBT</span>
                          </button>
                        )}
                        {sub.projectId?._id && (
                          <Link
                            to={`/projects/${sub.projectId._id}?tab=subsidy`}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
                            title="Open 10-Stage EPC Project Subsidy Tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-solar-500" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} claims
            </span>
            <div className="flex items-center space-x-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded border hover:bg-muted disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">Page {page}</span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded border hover:bg-muted disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record DBT Disbursement Modal */}
      {isDisburseModalOpen && selectedSubsidy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Record DBT Subsidy Credit</h3>
                  <p className="text-[11px] text-muted-foreground">
                    PM Surya Ghar Muft Bijli Yojana direct benefit transfer
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDisburseModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Beneficiary Summary */}
            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application #:</span>
                <span className="font-mono font-bold text-foreground">{selectedSubsidy.applicationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Beneficiary Client:</span>
                <span className="font-semibold text-foreground">{selectedSubsidy.customerId?.name || 'Consumer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Portal Scheme:</span>
                <span className="font-medium text-foreground">{selectedSubsidy.schemeName.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved Amount:</span>
                <span className="font-mono font-bold text-indigo-600">{formatRupees(selectedSubsidy.approvedAmountPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Credited:</span>
                <span className="font-mono font-bold text-emerald-600">{formatRupees(selectedSubsidy.disbursedAmountPaise)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitDisbursement} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Disbursed Amount (₹) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={disburseForm.amountRupees}
                    onChange={e => setDisburseForm({ ...disburseForm, amountRupees: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Disbursement Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={disburseForm.disbursedAt}
                    onChange={e => setDisburseForm({ ...disburseForm, disbursedAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Bank UTR / Transaction Reference <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-SBI-202611-89104"
                  value={disburseForm.disbursementReference}
                  onChange={e => setDisburseForm({ ...disburseForm, disbursementReference: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Recipient Bank Account / Account Details <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI A/c ending 4589"
                  value={disburseForm.recipientAccount}
                  onChange={e => setDisburseForm({ ...disburseForm, recipientAccount: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Disbursement Remarks &amp; Audit Notes
                </label>
                <textarea
                  rows={2}
                  value={disburseForm.notes}
                  onChange={e => setDisburseForm({ ...disburseForm, notes: e.target.value })}
                  placeholder="e.g. Verified from PM Surya Ghar national portal DBT confirmation sheet"
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDisburse}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingDisburse ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5" />}
                  <span>{submittingDisburse ? 'Recording...' : 'Confirm DBT Credit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Details & DBT Audit History Modal */}
      {isDetailModalOpen && selectedSubsidyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-foreground">
                      {selectedSubsidyDetail.applicationNumber}
                    </h3>
                    {getStatusBadge(selectedSubsidyDetail.status)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    PM Surya Ghar DBT Subsidy Application &amp; Audit Trail
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Application Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Requested</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatRupees(selectedSubsidyDetail.requestedAmountPaise)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase font-semibold block">Approved</span>
                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                  {formatRupees(selectedSubsidyDetail.approvedAmountPaise)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Disbursed (DBT)</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatRupees(selectedSubsidyDetail.disbursedAmountPaise)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border bg-amber-500/5 border-amber-500/20">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold block">Balance Pending</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
                  {formatRupees(
                    Math.max(
                      0,
                      (selectedSubsidyDetail.approvedAmountPaise || selectedSubsidyDetail.requestedAmountPaise || 0) -
                        (selectedSubsidyDetail.disbursedAmountPaise || 0)
                    )
                  )}
                </span>
              </div>
            </div>

            {/* Beneficiary & Portal Reference Table */}
            <div className="p-3.5 rounded-xl border bg-card space-y-2 text-xs">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider border-b pb-1">
                Beneficiary &amp; Scheme Identifiers
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Client / Beneficiary:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSubsidyDetail.customerId?.name || 'Consumer Client'}
                  </span>
                  {selectedSubsidyDetail.customerId?.phone && (
                    <span className="block text-[11px] text-muted-foreground font-mono">
                      {selectedSubsidyDetail.customerId.phone}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Linked Solar Project:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSubsidyDetail.projectId?.name || selectedSubsidyDetail.projectId?.projectCode || 'EPC Project'}
                  </span>
                  <span className="block text-[11px] font-mono text-solar-600">
                    Capacity: {selectedSubsidyDetail.systemCapacityKw} kWp
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">National Portal Registration:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedSubsidyDetail.portalApplicationNumber || 'Not Registered on National Portal'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Sanction Approval Ref:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {selectedSubsidyDetail.sanctionReference || 'Pending Sanction Letter'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Benefit Transfer (DBT) Credits History */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-1">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Realized DBT Bank Credits ({selectedSubsidyDetail.disbursements?.length || 0})</span>
                </h4>
                {selectedSubsidyDetail.status !== 'FULLY_DISBURSED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenDisburseModal(selectedSubsidyDetail);
                    }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs cursor-pointer"
                  >
                    <IndianRupee className="w-3 h-3" />
                    <span>+ Record DBT</span>
                  </button>
                )}
              </div>

              {(!selectedSubsidyDetail.disbursements || selectedSubsidyDetail.disbursements.length === 0) ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-muted-foreground text-xs">
                  No Direct Benefit Transfer credits recorded yet. Click &apos;+ Record DBT&apos; once the subsidy is credited by DISCOM.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Disbursement Ref / UTR</th>
                        <th className="py-2 px-3">Credit Date</th>
                        <th className="py-2 px-3">Recipient Account</th>
                        <th className="py-2 px-3 text-right">Amount Credited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedSubsidyDetail.disbursements.map((d: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                            {d.disbursementReference || d.disbursementId || `DBT-${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-3">
                            {d.disbursedAt ? new Date(d.disbursedAt).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                            {d.recipientAccount || 'Beneficiary A/c'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                            ₹{((d.amountPaise || 0) / 100).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer with clean, clearly labeled project link */}
            <div className="flex items-center justify-between pt-3 border-t">
              {selectedSubsidyDetail.projectId?._id ? (
                <Link
                  to={`/projects/${selectedSubsidyDetail.projectId._id}?tab=subsidy`}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-solar-600 hover:text-solar-700 hover:underline"
                >
                  <span>View 10-Stage Project Execution (Subsidy Tab)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : <div />}
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Subsidy Claim Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Register Subsidy Claim</h3>
                  <p className="text-[11px] text-muted-foreground">
                    PM Surya Ghar Muft Bijli Yojana Central DBT Claim Registration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Select Completed / Commissioned Solar Project <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={registerForm.projectId}
                  onChange={e => handleProjectSelectForRegister(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg focus:ring-2 focus:ring-solar-500 text-foreground"
                >
                  <option value="">-- Choose Project --</option>
                  {projectsList.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.projectCode} • {p.name} ({p.capacityKw || 3} kWp)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Scheme Name
                  </label>
                  <select
                    value={registerForm.schemeName}
                    onChange={e => setRegisterForm({ ...registerForm, schemeName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                  >
                    <option value="PM_SURYA_GHAR_MUFT_BIJLI_YOJANA">PM Surya Ghar Yojana</option>
                    <option value="STATE_ROOFTOP_SUBSIDY">State Rooftop Subsidy</option>
                    <option value="CENTRAL_FINANCIAL_ASSISTANCE">CFA Scheme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Capacity (kWp)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    required
                    value={registerForm.systemCapacityKw}
                    onChange={e => {
                      const cap = Number(e.target.value) || 0;
                      const est = cap <= 2 ? Math.round(cap * 30000) : 78000;
                      setRegisterForm({ ...registerForm, systemCapacityKw: cap, requestedAmountRupees: est });
                    }}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Portal Application Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PMSG-RJ-2026-449102"
                    value={registerForm.portalApplicationNumber}
                    onChange={e => setRegisterForm({ ...registerForm, portalApplicationNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Requested Subsidy (₹)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    required
                    value={registerForm.requestedAmountRupees}
                    onChange={e => setRegisterForm({ ...registerForm, requestedAmountRupees: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Std: ₹30k/kW (≤2kW), ₹78k max cap.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Claim Notes &amp; Portal Directives
                </label>
                <textarea
                  rows={2}
                  value={registerForm.notes}
                  onChange={e => setRegisterForm({ ...registerForm, notes: e.target.value })}
                  placeholder="e.g. Uploaded DISCOM inspection report and joint commission certificate."
                  className="w-full px-3 py-2 text-xs bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRegister}
                  className="px-4 py-2 text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingRegister ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
                  <span>{submittingRegister ? 'Submitting...' : 'Register Subsidy'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
