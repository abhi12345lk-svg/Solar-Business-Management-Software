/**
 * INS Solar Business Management Software — Net Metering Register Page
 *
 * Enterprise register for utility interconnection and net-metering applications:
 * - DISCOM breakdown and consumer connection directory
 * - Status pipelines (DRAFT -> READY_TO_SUBMIT -> SUBMITTED -> INSPECTION_SCHEDULED -> APPROVED)
 * - Bi-directional net meter installation monitoring
 * - Search, pagination, and multi-criteria filters
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Search,
  Filter,
  Clock,
  Calendar,
  CheckCircle2,
  Gauge,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface NetMeteringRecord {
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
  discomName: string;
  division?: string;
  subdivision?: string;
  consumerNumber: string;
  sanctionedLoadKw?: number;
  proposedCapacityKw?: number;
  status: string;
  inspectionSchedule?: {
    scheduledDate?: string;
    outcome?: string;
  };
  meterInstallation?: {
    meterInstalled?: boolean;
    meterNumber?: string;
  };
  createdAt: string;
}

export const NetMeteringPage: React.FC = () => {
  const [applications, setApplications] = useState<NetMeteringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [discomFilter, setDiscomFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/net-metering?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (discomFilter) query += `&discomName=${encodeURIComponent(discomFilter)}`;

      const res = await apiClient<any>(query);
      const list = res.applications || res.data?.applications || [];
      const count = res.total ?? res.data?.total ?? list.length;
      setApplications(list);
      setTotal(count);
    } catch (err: any) {
      setError(err.message || 'Failed to load net metering applications.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, discomFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

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
        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || styles.DRAFT}`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Metrics summary
  const pendingDocsCount = applications.filter(
    a => a.status === 'DOCUMENTS_PENDING' || a.status === 'DRAFT'
  ).length;
  const inspectionScheduledCount = applications.filter(
    a => a.status === 'INSPECTION_SCHEDULED'
  ).length;
  const meterInstalledCount = applications.filter(a => a.meterInstallation?.meterInstalled).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-solar-500/10 text-solar-600 border border-solar-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Net Metering Applications
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            DISCOM synchronization pipeline, site inspections, and bi-directional meter records
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Tracked</span>
            <Zap className="w-4 h-4 text-solar-600" />
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">{total}</p>
          <span className="text-[11px] text-muted-foreground">Active interconnection filings</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Docs Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 tracking-tight">{pendingDocsCount}</p>
          <span className="text-[11px] text-muted-foreground">Awaiting consumer bills / SLD</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Inspections Scheduled</span>
            <Calendar className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-2xl font-black text-cyan-700 tracking-tight">
            {inspectionScheduledCount}
          </p>
          <span className="text-[11px] text-muted-foreground">Field inspection due</span>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Meters Installed</span>
            <Gauge className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 tracking-tight">
            {meterInstalledCount}
          </p>
          <span className="text-[11px] text-muted-foreground">Synchronized to grid</span>
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
            placeholder="Search by application #, consumer number, or DISCOM..."
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
            <option value="DRAFT">Draft</option>
            <option value="DOCUMENTS_PENDING">Documents Pending</option>
            <option value="READY_TO_SUBMIT">Ready to Submit</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="INSPECTION_SCHEDULED">Inspection Scheduled</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <input
            type="text"
            value={discomFilter}
            onChange={e => {
              setDiscomFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter DISCOM"
            className="w-32 px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none"
          />
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
            <span>Loading applications...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No applications found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search criteria or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Project & Customer</th>
                  <th className="py-3 px-4">DISCOM & Division</th>
                  <th className="py-3 px-4">Consumer #</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Inspection</th>
                  <th className="py-3 px-4">Net Meter</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications.map(app => (
                  <tr key={app._id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {app.applicationNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {app.projectId?.name || app.projectId?.projectCode || 'Project'}
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {app.customerId?.name || 'Customer'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{app.discomName}</div>
                      <span className="text-muted-foreground text-[11px]">
                        {app.division || 'Standard Circle'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {app.consumerNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground">
                        {app.proposedCapacityKw || 0} kW
                      </span>
                      <span className="text-muted-foreground text-[11px] block">
                        Sanction: {app.sanctionedLoadKw || 0} kW
                      </span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(app.status)}</td>
                    <td className="py-3 px-4">
                      {app.inspectionSchedule?.scheduledDate ? (
                        <div className="text-[11px]">
                          <span>
                            {new Date(app.inspectionSchedule.scheduledDate).toLocaleDateString()}
                          </span>
                          <span
                            className={`block font-semibold ${
                              app.inspectionSchedule.outcome === 'PASSED'
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {app.inspectionSchedule.outcome || 'Pending'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Not scheduled</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {app.meterInstallation?.meterInstalled ? (
                        <span className="text-emerald-600 font-semibold flex items-center text-[11px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Installed
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.projectId?._id && (
                        <Link
                          to={`/projects/${app.projectId._id}`}
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
              applications
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
