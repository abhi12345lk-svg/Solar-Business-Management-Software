/**
 * INS Solar Business Management Software — Warranties & Hardware Claims Page
 *
 * Enterprise register for serialized hardware asset warranties, RMA claims, and expiry tracking:
 * - Dynamic warranty expiry countdowns (ACTIVE / EXPIRED / CLAIM_PENDING)
 * - Serial number lookup, commissioning verification, manufacturer supplier references
 * - Submit Warranty Claim workflow (CLM-YYYY-NNNNN)
 * - RMA claim decision tracking: replacement / repair / out-of-scope rejection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface WarrantyRecord {
  _id: string;
  serialNumber: string;
  productId: {
    _id: string;
    name: string;
    productCode: string;
    sku?: string;
    brand?: string;
    model?: string;
    productType?: string;
  };
  customerId?: {
    _id: string;
    name: string;
    primaryPhone?: string;
  };
  projectId?: {
    _id: string;
    projectCode: string;
    name: string;
  };
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  supplierWarrantyReference?: string;
  commissioningDate?: string;
  warrantyStatus: string;
  isExpired: boolean;
  createdAt: string;
}

interface WarrantyClaimRecord {
  _id: string;
  claimNumber: string;
  serialNumber: string;
  manufacturerName: string;
  issueDescription: string;
  status: string;
  resolutionOutcome?: string;
  decisionNotes?: string;
  replacementSerialNumber?: string;
  claimDate: string;
  createdAt: string;
}

export const WarrantiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'EQUIPMENT' | 'CLAIMS'>('EQUIPMENT');
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [claims, setClaims] = useState<WarrantyClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<WarrantyRecord | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaimRecord | null>(null);

  // Form states
  const [claimForm, setClaimForm] = useState({
    serialNumber: '',
    productId: '',
    projectId: '',
    customerId: '',
    manufacturerName: '',
    issueDescription: ''
  });

  const [decisionForm, setDecisionForm] = useState({
    status: 'CLAIM_APPROVED',
    resolutionType: 'REPLACED_UNDER_WARRANTY',
    decisionNotes: '',
    replacementSerialNumber: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchWarranties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/warranties?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await apiClient<any>(query);
      const items =
        res?.items || res?.warranties || res?.data?.items || res?.data?.warranties || [];
      const totalCount = res?.total ?? res?.data?.total ?? items.length;
      setWarranties(items);
      setTotal(totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load warranty equipment records.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter]);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/warranties/claims?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await apiClient<any>(query);
      const items = res?.items || res?.claims || res?.data?.items || res?.data?.claims || [];
      const totalCount = res?.total ?? res?.data?.total ?? items.length;
      setClaims(items);
      setTotal(totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load warranty claims.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    if (activeTab === 'EQUIPMENT') {
      fetchWarranties();
    } else {
      fetchClaims();
    }
  }, [activeTab, fetchWarranties, fetchClaims]);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient('/warranties/claims', {
        method: 'POST',
        body: JSON.stringify(claimForm)
      });
      setShowClaimModal(false);
      setSelectedSerial(null);
      setActiveTab('CLAIMS');
      fetchClaims();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit warranty claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      setSubmitting(true);
      await apiClient(`/warranties/claims/${selectedClaim._id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify(decisionForm)
      });
      setShowDecisionModal(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (err: any) {
      alert(err?.message || 'Failed to record claim decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const getWarrantyStatusBadge = (status: string, isExpired: boolean) => {
    if (status === 'CLAIM_PENDING') {
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
    if (isExpired || status === 'EXPIRED') {
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    }
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  const getClaimStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'CLAIM_PENDING':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'CLAIM_APPROVED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'CLAIM_REJECTED':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 border border-solar-500/30 rounded-lg text-solar-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Hardware Warranties & Claims
              </h1>
              <p className="text-sm text-muted-foreground">
                Serialized solar assets, manufacturer guarantee periods, and RMA claims
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedSerial(null);
              setClaimForm({
                serialNumber: '',
                productId: '',
                projectId: '',
                customerId: '',
                manufacturerName: '',
                issueDescription: ''
              });
              setShowClaimModal(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Submit Warranty Claim
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b space-x-6 text-sm">
        <button
          onClick={() => {
            setActiveTab('EQUIPMENT');
            setPage(1);
          }}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'EQUIPMENT'
              ? 'border-b-2 border-solar-600 text-solar-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Serialized Equipment Register
        </button>

        <button
          onClick={() => {
            setActiveTab('CLAIMS');
            setPage(1);
          }}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'CLAIMS'
              ? 'border-b-2 border-solar-600 text-solar-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          Warranty Claims Ledger
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>TRACKED ASSETS</span>
            <ShieldCheck className="w-4 h-4 text-solar-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Serialized panels & inverters</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>ACTIVE COVERAGE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-500">
            {warranties.filter(w => !w.isExpired && w.warrantyStatus === 'ACTIVE').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Under valid manufacturer terms</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>EXPIRED WARRANTIES</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-rose-500">
            {warranties.filter(w => w.isExpired || w.warrantyStatus === 'EXPIRED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Standard period elapsed</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>PENDING CLAIMS</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-purple-500">
            {warranties.filter(w => w.warrantyStatus === 'CLAIM_PENDING').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">RMA decisions in progress</div>
        </div>
      </div>

      {/* Honest Notice */}
      <div className="p-3 bg-secondary/40 border border-secondary rounded-lg flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-solar-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Manufacturer RMA Boundary Notice:</span>{' '}
          Warranty decisions and replacement dispatches are recorded manually based on formal
          supplier RMA reports. No direct automated external vendor API integration is active in
          this phase.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === 'EQUIPMENT'
                ? 'Search serial number, product, or reference...'
                : 'Search claim #, serial number, or manufacturer...'
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-solar-500"
          />
        </div>

        {activeTab === 'EQUIPMENT' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
            >
              <option value="">All Warranty Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="CLAIM_PENDING">Claim Pending</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPage(1);
              }}
              className="p-2 border rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Reset Filters"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content Tables */}
      {activeTab === 'EQUIPMENT' ? (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                <tr>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Product Name & Code</th>
                  <th className="px-4 py-3">Project & Customer</th>
                  <th className="px-4 py-3">Supplier Reference</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                      Loading serialized warranty records...
                    </td>
                  </tr>
                ) : warranties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                      No equipment records found matching the filters.
                    </td>
                  </tr>
                ) : (
                  warranties.map(item => (
                    <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-solar-600 whitespace-nowrap">
                        {item.serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {item.productId?.name || 'Solar Hardware'}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.productId?.productCode || item.productId?.sku || 'SKU-N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-foreground">{item.customerId?.name || 'Owner'}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.projectId?.projectCode || 'No Project'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {item.supplierWarrantyReference || 'Standard Manufacturer'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {item.warrantyStartDate
                          ? new Date(item.warrantyStartDate).toISOString().split('T')[0]
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <span
                          className={
                            item.isExpired ? 'text-rose-500 font-semibold' : 'text-foreground'
                          }
                        >
                          {item.warrantyEndDate
                            ? new Date(item.warrantyEndDate).toISOString().split('T')[0]
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs border font-medium ${getWarrantyStatusBadge(
                            item.warrantyStatus,
                            item.isExpired
                          )}`}
                        >
                          {item.isExpired ? 'EXPIRED' : item.warrantyStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!item.isExpired && item.warrantyStatus !== 'CLAIM_PENDING' ? (
                          <button
                            onClick={() => {
                              setSelectedSerial(item);
                              setClaimForm({
                                serialNumber: item.serialNumber,
                                productId: item.productId?._id || '',
                                projectId: item.projectId?._id || '',
                                customerId: item.customerId?._id || '',
                                manufacturerName: item.productId?.brand || 'Manufacturer',
                                issueDescription: ''
                              });
                              setShowClaimModal(true);
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-solar-500/10 text-solar-600 hover:bg-solar-500/20 border border-solar-500/30"
                          >
                            File Claim
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No Action</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Claims Ledger Table */
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                <tr>
                  <th className="px-4 py-3">Claim #</th>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Manufacturer</th>
                  <th className="px-4 py-3">Issue Description</th>
                  <th className="px-4 py-3">Filed Date</th>
                  <th className="px-4 py-3">Decision / Outcome</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                      Loading warranty claims...
                    </td>
                  </tr>
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                      No warranty claims logged yet.
                    </td>
                  </tr>
                ) : (
                  claims.map(claim => (
                    <tr key={claim._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-solar-600 whitespace-nowrap">
                        {claim.claimNumber}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                        {claim.serialNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {claim.manufacturerName}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={claim.issueDescription}>
                        {claim.issueDescription}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {claim.claimDate
                          ? new Date(claim.claimDate).toISOString().split('T')[0]
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {claim.resolutionOutcome ? (
                          <div className="font-medium text-foreground">
                            {claim.resolutionOutcome.replace(/_/g, ' ')}
                            {claim.replacementSerialNumber && (
                              <div className="text-xs text-emerald-500 font-mono">
                                New S/N: {claim.replacementSerialNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Pending Review</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs border font-medium ${getClaimStatusBadge(claim.status)}`}
                        >
                          {claim.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {(claim.status === 'SUBMITTED' || claim.status === 'CLAIM_PENDING') && (
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                              setShowDecisionModal(true);
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-secondary text-foreground"
                          >
                            Record Decision
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="px-4 py-3 border rounded-xl bg-card flex items-center justify-between text-xs text-muted-foreground">
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

      {/* Modal: Submit Warranty Claim */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-solar-500" />
                Submit Warranty RMA Claim
              </h2>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {selectedSerial && (
              <div className="p-2.5 bg-solar-500/10 border border-solar-500/20 rounded-md text-xs text-solar-700 dark:text-solar-300">
                Selected Serial:{' '}
                <span className="font-mono font-semibold">{selectedSerial.serialNumber}</span> (
                {selectedSerial.productId?.name || 'Equipment'})
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Hardware Serial Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOL-MOD-400W-8812"
                  value={claimForm.serialNumber}
                  onChange={e => setClaimForm({ ...claimForm, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Product ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Catalog ObjectId"
                    value={claimForm.productId}
                    onChange={e => setClaimForm({ ...claimForm, productId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Project ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Project ObjectId"
                    value={claimForm.projectId}
                    onChange={e => setClaimForm({ ...claimForm, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Manufacturer / OEM Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solax / Havells / Vikram Solar"
                  value={claimForm.manufacturerName}
                  onChange={e => setClaimForm({ ...claimForm, manufacturerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Defect Description & Failure Symptoms *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe electrical or physical defect (e.g. bypass diode burnt, glass internal microcrack, grid synchronization relay failure)..."
                  value={claimForm.issueDescription}
                  onChange={e => setClaimForm({ ...claimForm, issueDescription: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Claim Decision */}
      {showDecisionModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">
                RMA Decision: {selectedClaim.claimNumber}
              </h2>
              <button
                onClick={() => setShowDecisionModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClaimDecision} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Serial Number Under Claim
                </label>
                <div className="font-mono text-sm font-semibold">{selectedClaim.serialNumber}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Manufacturer Decision *
                </label>
                <select
                  value={decisionForm.status}
                  onChange={e => setDecisionForm({ ...decisionForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                >
                  <option value="CLAIM_APPROVED">CLAIM_APPROVED (Accepted by OEM)</option>
                  <option value="CLAIM_REJECTED">CLAIM_REJECTED (Rejected / Void)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Resolution Outcome *
                </label>
                <select
                  value={decisionForm.resolutionType}
                  onChange={e =>
                    setDecisionForm({ ...decisionForm, resolutionType: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                >
                  <option value="REPLACED_UNDER_WARRANTY">Replaced with New Serial Asset</option>
                  <option value="REPAIRED_UNDER_WARRANTY">Repaired Component by OEM</option>
                  <option value="REJECTED_OUT_OF_SCOPE">
                    Rejected: Physical Damage / Out of Scope
                  </option>
                  <option value="REJECTED_EXPIRED">Rejected: Warranty Expired</option>
                </select>
              </div>

              {decisionForm.resolutionType === 'REPLACED_UNDER_WARRANTY' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Replacement Hardware Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="New equipment S/N from OEM"
                    value={decisionForm.replacementSerialNumber}
                    onChange={e =>
                      setDecisionForm({ ...decisionForm, replacementSerialNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background font-mono focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Decision Notes & RMA Documentation *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Record manufacturer RMA credit memo reference, technician inspection notes, or rejection grounds..."
                  value={decisionForm.decisionNotes}
                  onChange={e =>
                    setDecisionForm({ ...decisionForm, decisionNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
