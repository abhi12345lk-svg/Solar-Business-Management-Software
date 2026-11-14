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
  ChevronRight,
  Plus,
  X,
  RefreshCw,
  Edit3
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
    officerName?: string;
  };
  meterInstallation?: {
    meterInstalled?: boolean;
    meterNumber?: string;
    installationDate?: string;
    initialImportReadingKwh?: number;
    initialExportReadingKwh?: number;
    testedBy?: string;
    notes?: string;
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

  // Bi-directional Meter (BM) Modal State
  const [selectedAppForMeter, setSelectedAppForMeter] = useState<NetMeteringRecord | null>(null);
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterForm, setMeterForm] = useState({
    meterNumber: '',
    installationDate: new Date().toISOString().split('T')[0],
    initialImportReadingKwh: 0,
    initialExportReadingKwh: 0,
    testedBy: '',
    notes: ''
  });
  const [submittingMeter, setSubmittingMeter] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleOpenMeterModal = (app: NetMeteringRecord) => {
    setSelectedAppForMeter(app);
    setMeterForm({
      meterNumber: app.meterInstallation?.meterNumber || '',
      installationDate: app.meterInstallation?.installationDate
        ? new Date(app.meterInstallation.installationDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      initialImportReadingKwh: app.meterInstallation?.initialImportReadingKwh ?? 0,
      initialExportReadingKwh: app.meterInstallation?.initialExportReadingKwh ?? 0,
      testedBy: app.meterInstallation?.testedBy || '',
      notes: app.meterInstallation?.notes || ''
    });
    setShowMeterModal(true);
  };

  const handleSaveMeterInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForMeter) return;
    try {
      setSubmittingMeter(true);
      setError(null);
      await apiClient(`/net-metering/${selectedAppForMeter._id}/meter-installation`, {
        method: 'POST',
        body: JSON.stringify({
          meterNumber: meterForm.meterNumber.trim(),
          installationDate: meterForm.installationDate,
          initialImportReadingKwh: Number(meterForm.initialImportReadingKwh) || 0,
          initialExportReadingKwh: Number(meterForm.initialExportReadingKwh) || 0,
          testedBy: meterForm.testedBy.trim() || undefined,
          notes: meterForm.notes.trim() || undefined
        })
      });
      setActionSuccess(`Bi-directional Net Meter (BM: ${meterForm.meterNumber.trim()}) successfully recorded!`);
      setShowMeterModal(false);
      setSelectedAppForMeter(null);
      fetchApplications();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Failed to record meter installation.');
    } finally {
      setSubmittingMeter(false);
    }
  };

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

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

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
            <span className="text-xs font-semibold">BM Meters Active</span>
            <Gauge className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 tracking-tight">
            {meterInstalledCount}
          </p>
          <span className="text-[11px] text-muted-foreground">Bi-directional grid synchronized</span>
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
            placeholder="Search by consumer #, BP number, BM meter no., or DISCOM..."
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
                  <th className="py-3 px-4">Consumer / BP #</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Inspection</th>
                  <th className="py-3 px-4">Bi-directional Meter (BM No.)</th>
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
                      {(app.proposedCapacityKw || 0) > (app.sanctionedLoadKw || 0) && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold inline-block mt-1 border border-amber-500/20">
                          ⚠️ Load Enh. Req.
                        </span>
                      )}
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
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-flex items-center text-emerald-700 dark:text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                              <CheckCircle2 className="w-3 h-3 mr-1 shrink-0 text-emerald-600" />
                              BM: {app.meterInstallation.meterNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenMeterModal(app)}
                              className="text-muted-foreground hover:text-solar-600 p-0.5 cursor-pointer"
                              title="Edit BM Details"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Imp: {app.meterInstallation.initialImportReadingKwh ?? 0} | Exp: {app.meterInstallation.initialExportReadingKwh ?? 0} kWh
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground block">Pending Net Meter</span>
                          <button
                            type="button"
                            onClick={() => handleOpenMeterModal(app)}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-300 border border-solar-500/30 transition cursor-pointer"
                            title="Record DISCOM Bi-directional Meter (BM Number)"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Record BM No.
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.projectId?._id && (
                        <Link
                          to={`/projects/${app.projectId._id}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border transition-colors"
                          title="Open 10-Stage EPC Project"
                        >
                          <span>Open Project</span>
                          <ExternalLink className="w-3 h-3 text-solar-500" />
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

      {/* Record / Update Bi-directional Net Meter (BM) Modal */}
      {showMeterModal && selectedAppForMeter && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Record Bi-directional Meter (BM Number)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Consumer / BP: <strong className="font-mono text-foreground">{selectedAppForMeter.consumerNumber}</strong> • {selectedAppForMeter.discomName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMeterModal(false);
                  setSelectedAppForMeter(null);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-muted/40 border-b text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center text-foreground font-semibold">
                <Zap className="w-3.5 h-3.5 text-solar-500 mr-1 shrink-0" />
                <span>DISCOM Net-Metering Synchronization</span>
              </div>
              <p>
                Bi-directional Net Meter (BM) is physically installed by DISCOM / utility line staff after solar plant installation is completed and field inspection passes. It records bidirectional grid power flow (Import &amp; Export kWh).
              </p>
            </div>

            <form onSubmit={handleSaveMeterInstallation} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  BM Number (Bi-directional / Net Meter Serial No.) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={meterForm.meterNumber}
                  onChange={e => setMeterForm({ ...meterForm, meterNumber: e.target.value })}
                  placeholder="e.g. L&T-BM-981240 or SECURE-BM-0198"
                  className="w-full px-3 py-2 bg-background border rounded-lg font-mono font-bold text-foreground focus:ring-2 focus:ring-solar-500"
                />
                <span className="text-[10px] text-muted-foreground">
                  Unique barcode or serial number stamped on newly installed physical net meter.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  Meter Installation Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={meterForm.installationDate}
                  onChange={e => setMeterForm({ ...meterForm, installationDate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    Initial Import Reading (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={meterForm.initialImportReadingKwh}
                    onChange={e =>
                      setMeterForm({
                        ...meterForm,
                        initialImportReadingKwh: Number(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg font-mono text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                  <span className="text-[10px] text-muted-foreground">Power drawn from grid at start</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    Initial Export Reading (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={meterForm.initialExportReadingKwh}
                    onChange={e =>
                      setMeterForm({
                        ...meterForm,
                        initialExportReadingKwh: Number(e.target.value)
                      })
                    }
                    className="w-full px-3 py-2 bg-background border rounded-lg font-mono text-foreground focus:ring-2 focus:ring-solar-500"
                  />
                  <span className="text-[10px] text-muted-foreground">Solar power sent to grid (0.0)</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  DISCOM Testing Officer / Commissioning Engineer
                </label>
                <input
                  type="text"
                  value={meterForm.testedBy}
                  onChange={e => setMeterForm({ ...meterForm, testedBy: e.target.value })}
                  placeholder="e.g. Er. Rajesh Verma (JE CSPDCL Raipur)"
                  className="w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  Commissioning Remarks &amp; Meter Seal Details
                </label>
                <textarea
                  rows={2}
                  value={meterForm.notes}
                  onChange={e => setMeterForm({ ...meterForm, notes: e.target.value })}
                  placeholder="e.g. Polycarbonate meter seal #771239 applied by DISCOM AE."
                  className="w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowMeterModal(false);
                    setSelectedAppForMeter(null);
                  }}
                  className="px-4 py-2 border rounded-xl text-foreground hover:bg-muted font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMeter}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingMeter ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
                  <span>{submittingMeter ? 'Saving BM Meter...' : 'Save BM Meter Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
