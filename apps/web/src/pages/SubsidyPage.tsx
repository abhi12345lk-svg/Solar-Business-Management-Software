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
  TrendingUp
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
              Government Subsidies
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            National Rooftop Solar Portal claims, sanctions, and Direct Benefit Transfer (DBT)
            disbursement registry
          </p>
        </div>
      </div>

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
                      {sub.applicationNumber}
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
                      {sub.projectId?._id && (
                        <Link
                          to={`/projects/${sub.projectId._id}`}
                          className="inline-flex items-center text-solar-600 hover:text-solar-700 font-semibold text-xs"
                        >
                          <span>Manage</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      )}
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
    </div>
  );
};
