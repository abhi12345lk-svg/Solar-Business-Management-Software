/**
 * INS Solar Business Management Software — Service Complaints Register Page
 *
 * Enterprise register for break-fix tickets, customer complaints, and SLA tracking:
 * - Status pipeline: OPEN -> TRIAGED -> ASSIGNED -> VISIT_SCHEDULED -> IN_PROGRESS -> RESOLVED -> CLOSED
 * - Alternate flows: AWAITING_CUSTOMER, AWAITING_PARTS, REOPENED, CANCELLED
 * - Real-time statistics, multi-criteria filtering, technician dispatch
 * - Reopen workflow with documented audit reason
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface ServiceComplaintRecord {
  _id: string;
  complaintNumber: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  severity: string;
  status: string;
  reportedDate: string;
  preferredVisitTime?: string;
  contactPreference?: string;
  isWarrantyCovered?: boolean;
  customerId: {
    _id: string;
    name: string;
    primaryPhone?: string;
    email?: string;
  };
  projectId: {
    _id: string;
    projectCode: string;
    name: string;
  };
  assignedTechnicianId?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  resolutionSummary?: string;
  reopenReason?: string;
  customerUpdates?: Array<{ message: string; timestamp: string }>;
  createdAt: string;
}

export const ComplaintsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<ServiceComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ServiceComplaintRecord | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    projectId: '',
    customerId: '',
    title: '',
    description: '',
    category: 'INVERTER_FAULT',
    priority: 'HIGH',
    severity: 'MAJOR',
    preferredVisitTime: 'Morning (9 AM - 12 PM)',
    contactPreference: 'PHONE'
  });

  const [statusForm, setStatusForm] = useState({
    targetStatus: 'TRIAGED',
    notes: '',
    resolutionSummary: ''
  });

  const [reopenReason, setReopenReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available projects for dropdown
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [manualProjectEntry, setManualProjectEntry] = useState(false);

  useEffect(() => {
    if (showCreateModal && availableProjects.length === 0) {
      setLoadingProjects(true);
      apiClient<any>('/projects?limit=100')
        .then(res => {
          const list = Array.isArray(res) ? res : res?.data || res?.items || [];
          setAvailableProjects(list);
        })
        .catch(() => {})
        .finally(() => setLoadingProjects(false));
    }
  }, [showCreateModal]);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/complaints?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter) query += `&category=${encodeURIComponent(categoryFilter)}`;
      if (severityFilter) query += `&severity=${encodeURIComponent(severityFilter)}`;

      const res = await apiClient<any>(query);
      const items =
        res?.items || res?.complaints || res?.data?.items || res?.data?.complaints || [];
      const totalCount = res?.total ?? res?.data?.total ?? items.length;
      setComplaints(items);
      setTotal(totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load service complaints.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, categoryFilter, severityFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient('/complaints', {
        method: 'POST',
        body: JSON.stringify(createForm)
      });
      setShowCreateModal(false);
      setCreateForm({
        projectId: '',
        customerId: '',
        title: '',
        description: '',
        category: 'INVERTER_FAULT',
        priority: 'HIGH',
        severity: 'MAJOR',
        preferredVisitTime: 'Morning (9 AM - 12 PM)',
        contactPreference: 'PHONE'
      });
      fetchComplaints();
    } catch (err: any) {
      alert(err?.message || 'Failed to register complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    try {
      setSubmitting(true);
      await apiClient(`/complaints/${selectedComplaint._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(statusForm)
      });
      setShowStatusModal(false);
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err: any) {
      alert(err?.message || 'Failed to transition complaint status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    try {
      setSubmitting(true);
      await apiClient(`/complaints/${selectedComplaint._id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason: reopenReason })
      });
      setShowReopenModal(false);
      setSelectedComplaint(null);
      setReopenReason('');
      fetchComplaints();
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Badge Colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'TRIAGED':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'ASSIGNED':
      case 'VISIT_SCHEDULED':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'IN_PROGRESS':
        return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'REOPENED':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'CANCELLED':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-secondary text-secondary-foreground border';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-600 font-bold';
      case 'MAJOR':
        return 'bg-orange-500/20 text-orange-600 font-semibold';
      case 'MINOR':
        return 'bg-blue-500/20 text-blue-600';
      default:
        return 'bg-slate-500/20 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 border border-solar-500/30 rounded-lg text-solar-600">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Service Complaints
              </h1>
              <p className="text-sm text-muted-foreground">
                Customer break-fix requests, inverter alerts, and technician dispatch lifecycle
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Register Complaint
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
            <span>TOTAL TICKETS</span>
            <LifeBuoy className="w-4 h-4 text-solar-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Logged in service system</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>OPEN / TRIAGED</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-500">
            {complaints.filter(c => c.status === 'OPEN' || c.status === 'TRIAGED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Awaiting technician assignment</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>IN FIELD PROGRESS</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-sky-500">
            {
              complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'VISIT_SCHEDULED')
                .length
            }
          </div>
          <div className="text-xs text-muted-foreground mt-1">Technicians dispatched on-site</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>RESOLVED & CLOSED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-500">
            {complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Resolution confirmed</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search complaint #, title, or project..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-solar-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="VISIT_SCHEDULED">Visit Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="INVERTER_FAULT">Inverter Fault</option>
            <option value="PANEL_ISSUE">Panel Issue</option>
            <option value="GRID_TRIP">Grid Trip</option>
            <option value="MONITORING_OFFLINE">Monitoring Offline</option>
            <option value="EARTHING_FAULT">Earthing Fault</option>
            <option value="WATER_LEAKAGE">Water Leakage</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
            <option value="LOW">Low</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setCategoryFilter('');
              setSeverityFilter('');
              setPage(1);
            }}
            className="p-2 border rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Complaints Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3">Complaint #</th>
                <th className="px-4 py-3">Customer & Project</th>
                <th className="px-4 py-3">Issue Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Assigned Tech</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                    Loading service complaints...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    No service complaints matching the selected filters.
                  </td>
                </tr>
              ) : (
                complaints.map(item => (
                  <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-solar-600 whitespace-nowrap">
                      {item.complaintNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {item.customerId?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.projectId?.projectCode || 'N/A'} • {item.projectId?.name || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={item.description}>
                      <div className="font-medium text-foreground truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {item.category?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getSeverityBadge(item.severity)}`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {item.assignedTechnicianId
                        ? `${item.assignedTechnicianId.firstName} ${item.assignedTechnicianId.lastName}`
                        : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs border font-medium ${getStatusBadge(item.status)}`}
                      >
                        {item.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setSelectedComplaint(item);
                            setStatusForm({
                              targetStatus: item.status === 'OPEN' ? 'TRIAGED' : 'IN_PROGRESS',
                              notes: '',
                              resolutionSummary: item.resolutionSummary || ''
                            });
                            setShowStatusModal(true);
                          }}
                          className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-secondary text-foreground"
                          title="Transition Status"
                        >
                          Update
                        </button>

                        {(item.status === 'RESOLVED' || item.status === 'CLOSED') && (
                          <button
                            onClick={() => {
                              setSelectedComplaint(item);
                              setShowReopenModal(true);
                            }}
                            className="px-2 py-1 rounded text-xs font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30"
                            title="Reopen Ticket"
                          >
                            Reopen
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
            Showing {complaints.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} records
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

      {/* Modal: Register New Complaint */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-solar-500" />
                Register Service Complaint
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Solar Project <span className="text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualProjectEntry(!manualProjectEntry)}
                      className="text-[10px] text-solar-600 dark:text-solar-400 hover:underline"
                    >
                      {manualProjectEntry ? '← Select Project' : 'Custom Code'}
                    </button>
                  </div>
                  {!manualProjectEntry ? (
                    <select
                      required
                      value={createForm.projectId}
                      onChange={e => setCreateForm({ ...createForm, projectId: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                    >
                      <option value="">
                        {loadingProjects ? 'Loading projects...' : '-- Select Solar Project --'}
                      </option>
                      {availableProjects.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>
                          {p.projectCode || p.projectNumber || 'PRJ'} —{' '}
                          {p.name || p.projectName || 'Solar Project'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Enter Project Code (e.g. PRJ-2026-00001) or ID"
                      value={createForm.projectId}
                      onChange={e => setCreateForm({ ...createForm, projectId: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Customer ID / Account (Optional)
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

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Issue Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inverter Error Code 301 - Grid Voltage Out of Spec"
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Issue Description & Diagnostics *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe visible LED fault, solar app generation reading, or customer feedback..."
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={createForm.category}
                    onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="INVERTER_FAULT">Inverter Fault</option>
                    <option value="PANEL_ISSUE">Panel Issue</option>
                    <option value="GRID_TRIP">Grid Trip</option>
                    <option value="MONITORING_OFFLINE">Monitoring Offline</option>
                    <option value="EARTHING_FAULT">Earthing Fault</option>
                    <option value="WATER_LEAKAGE">Water Leakage</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Severity
                  </label>
                  <select
                    value={createForm.severity}
                    onChange={e => setCreateForm({ ...createForm, severity: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="CRITICAL">Critical (Zero Gen)</option>
                    <option value="MAJOR">Major (Reduced Gen)</option>
                    <option value="MINOR">Minor</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Preferred Visit Slot
                  </label>
                  <input
                    type="text"
                    value={createForm.preferredVisitTime}
                    onChange={e =>
                      setCreateForm({ ...createForm, preferredVisitTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Contact Channel
                  </label>
                  <select
                    value={createForm.contactPreference}
                    onChange={e =>
                      setCreateForm({ ...createForm, contactPreference: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="PHONE">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
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
                  {submitting ? 'Registering...' : 'Register Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transition Complaint Status */}
      {showStatusModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">
                Update Status: {selectedComplaint.complaintNumber}
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Current Status
                </label>
                <div className="text-sm font-semibold">{selectedComplaint.status}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Target Status *
                </label>
                <select
                  value={statusForm.targetStatus}
                  onChange={e => setStatusForm({ ...statusForm, targetStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                >
                  <option value="TRIAGED">TRIAGED (Initial Assessment Done)</option>
                  <option value="ASSIGNED">ASSIGNED (Technician Appointed)</option>
                  <option value="VISIT_SCHEDULED">VISIT_SCHEDULED (Field Slot Booked)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Technician On-Site)</option>
                  <option value="AWAITING_PARTS">AWAITING_PARTS (Procuring Spares)</option>
                  <option value="AWAITING_CUSTOMER">
                    AWAITING_CUSTOMER (Customer Confirmation)
                  </option>
                  <option value="RESOLVED">RESOLVED (Technical Issue Fixed)</option>
                  <option value="CLOSED">CLOSED (Customer Verified & Ticket Archived)</option>
                  <option value="CANCELLED">CANCELLED (Duplicate or Invalid)</option>
                </select>
              </div>

              {(statusForm.targetStatus === 'RESOLVED' || statusForm.targetStatus === 'CLOSED') && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Resolution Summary (Mandatory for Resolve/Close) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Document root cause and rectification performed (e.g. replaced DC isolator, tightened torque)..."
                    value={statusForm.resolutionSummary}
                    onChange={e =>
                      setStatusForm({ ...statusForm, resolutionSummary: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Status Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal transition log notes..."
                  value={statusForm.notes}
                  onChange={e => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Transition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reopen Complaint */}
      {showReopenModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-rose-500 flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Reopen Complaint: {selectedComplaint.complaintNumber}
              </h2>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReopen} className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Document why this ticket is being reopened after resolution. This action will be
                audited.
              </p>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reopen Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Issue re-occurred next morning; inverter tripping again after sunrise..."
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                >
                  {submitting ? 'Reopening...' : 'Reopen Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
