/**
 * INS Solar Business Management Software — Annual Maintenance Contracts (AMC) Page
 *
 * Enterprise register for operations & maintenance agreements:
 * - Contract lifecycle: DRAFT -> PENDING_APPROVAL -> ACTIVE -> EXPIRED / RENEWED / CANCELLED
 * - Concurrency-safe included visit consumption tracking (Quota progress bar)
 * - Integer paise financial validation & commercial contract terms
 * - Contract renewal chaining with predecessor/successor linking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  RefreshCw,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface AmcRecord {
  _id: string;
  amcNumber: string;
  customerId: {
    _id: string;
    name: string;
    primaryPhone?: string;
  };
  projectId: {
    _id: string;
    projectCode: string;
    name: string;
  };
  planType: string;
  startDate: string;
  endDate: string;
  contractAmountPaise: number;
  billingCadence: string;
  paymentStatus: string;
  visitCadence: string;
  includedVisits: number;
  consumedVisits: number;
  chargeableVisits: number;
  status: string;
  previousAmcId?: string;
  successorAmcId?: string;
  scopeOfWork?: string;
  createdAt: string;
}

export const AmcPage: React.FC = () => {
  const [contracts, setContracts] = useState<AmcRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAmc, setSelectedAmc] = useState<AmcRecord | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    projectId: '',
    customerId: '',
    planType: 'COMPREHENSIVE',
    startDate: '',
    endDate: '',
    contractAmountRupees: 25000,
    visitCadence: 'QUARTERLY',
    includedVisits: 4,
    billingCadence: 'ANNUAL',
    scopeOfWork: 'Includes quarterly panel deep cleaning, inverter maintenance, thermography & earthing test.'
  });

  const [renewForm, setRenewForm] = useState({
    startDate: '',
    endDate: '',
    contractAmountRupees: 26000,
    includedVisits: 4,
    notes: 'Annual contract renewal'
  });

  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/amc?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (planFilter) query += `&planType=${encodeURIComponent(planFilter)}`;

      const res = await apiClient<any>(query);
      const items = res?.items || res?.contracts || res?.amcs || res?.data?.items || res?.data?.contracts || [];
      const totalCount = res?.total ?? res?.data?.total ?? items.length;
      setContracts(items);
      setTotal(totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load AMC contracts.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, planFilter]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleCreateAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...createForm,
        contractAmountPaise: Math.round(Number(createForm.contractAmountRupees) * 100)
      };
      await apiClient('/amc', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setShowCreateModal(false);
      fetchContracts();
    } catch (err: any) {
      alert(err?.message || 'Failed to create AMC proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmc) return;
    try {
      setSubmitting(true);
      await apiClient(`/amc/${selectedAmc._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: approvalNotes })
      });
      setShowApproveModal(false);
      setSelectedAmc(null);
      setApprovalNotes('');
      fetchContracts();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve AMC contract.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenewAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmc) return;
    try {
      setSubmitting(true);
      const payload = {
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        contractAmountPaise: Math.round(Number(renewForm.contractAmountRupees) * 100),
        includedVisits: Number(renewForm.includedVisits),
        notes: renewForm.notes
      };
      await apiClient(`/amc/${selectedAmc._id}/renew`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setShowRenewModal(false);
      setSelectedAmc(null);
      fetchContracts();
    } catch (err: any) {
      alert(err?.message || 'Failed to renew AMC contract.');
    } finally {
      setSubmitting(false);
    }
  };

  const getAmcStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'PENDING_APPROVAL':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'RENEWED':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'EXPIRED':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'CANCELLED':
      case 'ON_HOLD':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-secondary text-secondary-foreground border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 border border-solar-500/30 rounded-lg text-solar-600">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Annual Maintenance Contracts (AMC)</h1>
              <p className="text-sm text-muted-foreground">
                Solar plant maintenance agreements, included visit quotas, and scheduled servicing
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Propose AMC Contract
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>TOTAL CONTRACTS</span>
            <FileCheck2 className="w-4 h-4 text-solar-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Proposals & active agreements</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>ACTIVE CONTRACTS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-500">
            {contracts.filter(c => c.status === 'ACTIVE').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Live servicing commitments</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>PENDING APPROVAL</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-500">
            {contracts.filter(c => c.status === 'PENDING_APPROVAL' || c.status === 'DRAFT').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Awaiting supervisor signoff</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>RENEWED / EXTENDED</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-500">
            {contracts.filter(c => c.status === 'RENEWED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Successor contracts active</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contract #, customer, or project..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-solar-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="ACTIVE">Active</option>
            <option value="RENEWED">Renewed</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Plans</option>
            <option value="BASIC">Basic</option>
            <option value="STANDARD">Standard</option>
            <option value="COMPREHENSIVE">Comprehensive</option>
            <option value="PREMIUM">Premium</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setPlanFilter('');
              setPage(1);
            }}
            className="p-2 border rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Contracts Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3">Contract #</th>
                <th className="px-4 py-3">Customer & Project</th>
                <th className="px-4 py-3">Plan Type</th>
                <th className="px-4 py-3">Validity Window</th>
                <th className="px-4 py-3">Visits Quota (Consumed / Limit)</th>
                <th className="px-4 py-3">Contract Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                    Loading AMC contracts...
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileCheck2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    No AMC contracts matching the filters.
                  </td>
                </tr>
              ) : (
                contracts.map(contract => (
                  <tr key={contract._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-solar-600 whitespace-nowrap">
                      {contract.amcNumber}
                      {contract.previousAmcId && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> Renewed Contract
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">{contract.customerId?.name || 'Customer'}</div>
                      <div className="text-xs text-muted-foreground">
                        {contract.projectId?.projectCode || 'N/A'} • {contract.projectId?.name || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs bg-solar-500/10 text-solar-600 font-medium">
                        {contract.planType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : 'N/A'} to{' '}
                      {contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              contract.consumedVisits >= contract.includedVisits
                                ? 'bg-amber-500'
                                : 'bg-solar-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((contract.consumedVisits / Math.max(1, contract.includedVisits)) * 100)
                              )}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold">
                          {contract.consumedVisits} / {contract.includedVisits}
                        </span>
                        {contract.chargeableVisits > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 font-bold">
                            +{contract.chargeableVisits} Chargeable
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                      ₹{(contract.contractAmountPaise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs border font-medium ${getAmcStatusBadge(
                          contract.status
                        )}`}
                      >
                        {contract.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {(contract.status === 'DRAFT' || contract.status === 'PENDING_APPROVAL') && (
                          <button
                            onClick={() => {
                              setSelectedAmc(contract);
                              setShowApproveModal(true);
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30"
                          >
                            Approve
                          </button>
                        )}

                        {contract.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedAmc(contract);
                              const endD = new Date(contract.endDate);
                              const newStart = new Date(endD.getTime() + 24 * 60 * 60 * 1000);
                              const newEnd = new Date(newStart.getTime() + 365 * 24 * 60 * 60 * 1000);
                              const startStr = newStart.toISOString().split('T')[0] || '';
                              const endStr = newEnd.toISOString().split('T')[0] || '';
                              setRenewForm({
                                startDate: startStr,
                                endDate: endStr,
                                contractAmountRupees: Math.round(contract.contractAmountPaise / 100),
                                includedVisits: contract.includedVisits,
                                notes: `Successor renewal of ${contract.amcNumber}`
                              });
                              setShowRenewModal(true);
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-secondary text-foreground"
                          >
                            Renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing {Math.min(total, 1)} to {Math.min(page * limit, total)} of {total} records
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 border rounded hover:bg-secondary disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-foreground">Page {page}</span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 border rounded hover:bg-secondary disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Propose AMC Contract */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-solar-500" />
                Propose Annual Maintenance Contract
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAmc} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Project ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Project ObjectId"
                    value={createForm.projectId}
                    onChange={e => setCreateForm({ ...createForm, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Customer ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to Project Owner"
                    value={createForm.customerId}
                    onChange={e => setCreateForm({ ...createForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Plan Type *</label>
                  <select
                    value={createForm.planType}
                    onChange={e => setCreateForm({ ...createForm, planType: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="BASIC">Basic (Preventive Only)</option>
                    <option value="STANDARD">Standard (Quarterly + Spares Discount)</option>
                    <option value="COMPREHENSIVE">Comprehensive (All Inverter & Panel Spares)</option>
                    <option value="PREMIUM">Premium (24/7 SLA + Dedicated Tech)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Annual Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.contractAmountRupees}
                    onChange={e => setCreateForm({ ...createForm, contractAmountRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={e => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.endDate}
                    onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Visit Frequency
                  </label>
                  <select
                    value={createForm.visitCadence}
                    onChange={e => setCreateForm({ ...createForm, visitCadence: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly (12 visits)</option>
                    <option value="BI_MONTHLY">Bi-Monthly (6 visits)</option>
                    <option value="QUARTERLY">Quarterly (4 visits)</option>
                    <option value="HALF_YEARLY">Half-Yearly (2 visits)</option>
                    <option value="ANNUAL">Annual (1 visit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Included Visits In Quota *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={createForm.includedVisits}
                    onChange={e => setCreateForm({ ...createForm, includedVisits: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Scope of Work</label>
                <textarea
                  rows={2}
                  value={createForm.scopeOfWork}
                  onChange={e => setCreateForm({ ...createForm, scopeOfWork: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create AMC Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Contract */}
      {showApproveModal && selectedAmc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">
                Approve Contract: {selectedAmc.amcNumber}
              </h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApproveAmc} className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Confirming activation will commit INS Solar to the agreed service-level maintenance schedule and
                activate the {selectedAmc.includedVisits}-visit quota.
              </p>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Supervisor Approval Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record commercial rate justification, authorized signatory confirmation, etc."
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Approving...' : 'Approve & Activate Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Renew AMC Contract */}
      {showRenewModal && selectedAmc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">
                Renew Contract: {selectedAmc.amcNumber}
              </h2>
              <button
                onClick={() => setShowRenewModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenewAmc} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">New Start Date *</label>
                  <input
                    type="date"
                    required
                    value={renewForm.startDate}
                    onChange={e => setRenewForm({ ...renewForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">New End Date *</label>
                  <input
                    type="date"
                    required
                    value={renewForm.endDate}
                    onChange={e => setRenewForm({ ...renewForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Renewal Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={renewForm.contractAmountRupees}
                    onChange={e => setRenewForm({ ...renewForm, contractAmountRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Included Visits</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={renewForm.includedVisits}
                    onChange={e => setRenewForm({ ...renewForm, includedVisits: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Renewal Notes</label>
                <textarea
                  rows={2}
                  value={renewForm.notes}
                  onChange={e => setRenewForm({ ...renewForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Renewing...' : 'Create Successor Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
