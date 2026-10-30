/**
 * INS Solar Business Management Software — Service Visits & Technician Field Execution
 *
 * Enterprise register for technician dispatch, on-site execution, and visit completion:
 * - Schedule field visits against complaints or active AMC agreements
 * - Conflict checking, rescheduling, and cancellation tracking
 * - Execution completion: observations, solar generation readings, checklist verification,
 *   parts/materials consumed, and atomic AMC visit quota deduction
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  RefreshCw,
  User,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface ServiceVisitRecord {
  _id: string;
  visitNumber: string;
  visitType: string;
  complaintId?: {
    _id: string;
    complaintNumber: string;
    title: string;
  };
  amcId?: {
    _id: string;
    amcNumber: string;
    planType: string;
  };
  projectId: {
    _id: string;
    projectCode: string;
    name: string;
  };
  customerId: {
    _id: string;
    name: string;
    primaryPhone?: string;
  };
  assignedTechnicianId: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  scheduledDate: string;
  scheduledTimeSlot: string;
  status: string;
  purpose: string;
  workPerformed?: string;
  observations?: string;
  checklist: Array<{ item: string; status: string; notes?: string }>;
  partsRequiredOrUsed: Array<{ name: string; quantity: number; isWarrantyCovered: boolean }>;
  isAmcIncluded: boolean;
  isChargeable: boolean;
  revisitRequired: boolean;
  completedAt?: string;
  createdAt: string;
}

export const ServiceVisitsPage: React.FC = () => {
  const [visits, setVisits] = useState<ServiceVisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<ServiceVisitRecord | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Forms
  const [scheduleForm, setScheduleForm] = useState({
    projectId: '',
    customerId: '',
    assignedTechnicianId: '',
    visitType: 'BREAKDOWN_REPAIR',
    scheduledDate: '',
    scheduledTimeSlot: '10:00 - 13:00',
    purpose: '',
    complaintId: '',
    amcId: ''
  });

  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newTimeSlot: '14:00 - 17:00',
    reason: ''
  });

  const [completeForm, setCompleteForm] = useState({
    workPerformed: '',
    observations: '',
    instantaneousKw: 5.2,
    meterReadingKwh: 1240,
    soilingCondition: 'CLEAN',
    inverterStatus: 'NORMAL',
    checklist: [
      {
        item: 'Inspect solar PV modules for soiling, hotspots & frame damage',
        status: 'PASSED',
        notes: 'No cracks'
      },
      {
        item: 'Inspect inverter DC/AC connections, heatsink & error logs',
        status: 'PASSED',
        notes: 'Fans spinning freely'
      },
      {
        item: 'Check ACDB / DCDB surge protectors and isolator switches',
        status: 'PASSED',
        notes: 'SPDs healthy'
      },
      {
        item: 'Verify earthing pit resistance and lightning arrester',
        status: 'PASSED',
        notes: '3.4 Ohms measured'
      },
      {
        item: 'Record instantaneous kW generation and cumulative kWh meter reading',
        status: 'PASSED'
      }
    ],
    partsUsed: [{ name: 'MC4 Male/Female Connector Pair', quantity: 2, isWarrantyCovered: true }],
    customerFeedback: 'Technician was polite, professional and generation resumed immediately.'
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/service-visits?page=${page}&limit=${limit}`;
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;
      if (typeFilter) query += `&visitType=${encodeURIComponent(typeFilter)}`;

      const res = await apiClient<any>(query);
      const items = res?.items || res?.visits || res?.data?.items || res?.data?.visits || [];
      const totalCount = res?.total ?? res?.data?.total ?? items.length;
      setVisits(items);
      setTotal(totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load service visits.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient('/service-visits', {
        method: 'POST',
        body: JSON.stringify({
          ...scheduleForm,
          complaintId: scheduleForm.complaintId || undefined,
          amcId: scheduleForm.amcId || undefined
        })
      });
      setShowScheduleModal(false);
      fetchVisits();
    } catch (err: any) {
      alert(err?.message || 'Failed to schedule service visit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      setSubmitting(true);
      await apiClient(`/service-visits/${selectedVisit._id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(rescheduleForm)
      });
      setShowRescheduleModal(false);
      setSelectedVisit(null);
      fetchVisits();
    } catch (err: any) {
      alert(err?.message || 'Failed to reschedule visit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      setSubmitting(true);
      await apiClient(`/service-visits/${selectedVisit._id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          workPerformed: completeForm.workPerformed,
          observations: completeForm.observations,
          instantaneousKw: Number(completeForm.instantaneousKw),
          meterReadingKwh: Number(completeForm.meterReadingKwh),
          soilingCondition: completeForm.soilingCondition,
          inverterStatus: completeForm.inverterStatus,
          checklist: completeForm.checklist,
          partsRequiredOrUsed: completeForm.partsUsed,
          customerFeedback: completeForm.customerFeedback
        })
      });
      setShowCompleteModal(false);
      setSelectedVisit(null);
      fetchVisits();
    } catch (err: any) {
      alert(err?.message || 'Failed to complete visit.');
    } finally {
      setSubmitting(false);
    }
  };

  const getVisitStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'DISPATCHED':
      case 'IN_PROGRESS':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'RESCHEDULED':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'CANCELLED':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
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
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Service Visits & Technician Dispatch
              </h1>
              <p className="text-sm text-muted-foreground">
                Technician field visit calendars, checklist verification, and atomic AMC quota
                deductions
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowScheduleModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Schedule Field Visit
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
            <span>TOTAL FIELD VISITS</span>
            <Calendar className="w-4 h-4 text-solar-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Scheduled & logged visits</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>UPCOMING / SCHEDULED</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-500">
            {visits.filter(v => v.status === 'SCHEDULED' || v.status === 'RESCHEDULED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Queued on field calendar</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>IN FIELD EXECUTION</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-500">
            {visits.filter(v => v.status === 'IN_PROGRESS' || v.status === 'DISPATCHED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Technician currently on site</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>COMPLETED VISITS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-500">
            {visits.filter(v => v.status === 'COMPLETED').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Checklists & work signed off</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search visit #, customer, technician, or purpose..."
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
            <option value="SCHEDULED">Scheduled</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="RESCHEDULED">Rescheduled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
          >
            <option value="">All Visit Types</option>
            <option value="ROUTINE_PREVENTIVE">Routine Preventive (AMC)</option>
            <option value="BREAKDOWN_REPAIR">Breakdown Repair</option>
            <option value="WARRANTY_INSPECTION">Warranty Inspection</option>
            <option value="COMMISSIONING_CHECK">Commissioning Check</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setTypeFilter('');
              setPage(1);
            }}
            className="p-2 border rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Visits Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3">Visit #</th>
                <th className="px-4 py-3">Type & Source</th>
                <th className="px-4 py-3">Project & Customer</th>
                <th className="px-4 py-3">Assigned Technician</th>
                <th className="px-4 py-3">Scheduled Slot</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                    Loading field service visits...
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    No field service visits matching the filters.
                  </td>
                </tr>
              ) : (
                visits.map(visit => (
                  <tr key={visit._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-solar-600 whitespace-nowrap">
                      {visit.visitNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {visit.visitType?.replace(/_/g, ' ')}
                      </div>
                      {visit.complaintId && (
                        <div className="text-[11px] text-amber-500">
                          Ticket: {visit.complaintId.complaintNumber}
                        </div>
                      )}
                      {visit.amcId && (
                        <div className="text-[11px] text-blue-500">
                          AMC: {visit.amcId.amcNumber} {visit.isChargeable && '(Chargeable)'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {visit.customerId?.name || 'Customer'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {visit.projectId?.projectCode || 'N/A'} • {visit.projectId?.name || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {visit.assignedTechnicianId
                          ? `${visit.assignedTechnicianId.firstName} ${visit.assignedTechnicianId.lastName}`
                          : 'Unassigned'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      <div>
                        {visit.scheduledDate
                          ? new Date(visit.scheduledDate).toISOString().split('T')[0]
                          : 'N/A'}
                      </div>
                      <div className="text-[11px] font-mono">{visit.scheduledTimeSlot}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={visit.purpose}>
                      {visit.purpose}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs border font-medium ${getVisitStatusBadge(
                          visit.status
                        )}`}
                      >
                        {visit.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedVisit(visit);
                                setRescheduleForm({
                                  newDate: visit.scheduledDate
                                    ? new Date(visit.scheduledDate).toISOString().split('T')[0] ||
                                      ''
                                    : '',
                                  newTimeSlot: visit.scheduledTimeSlot || '14:00 - 17:00',
                                  reason: ''
                                });
                                setShowRescheduleModal(true);
                              }}
                              className="px-2.5 py-1 rounded text-xs font-medium border hover:bg-secondary text-foreground"
                            >
                              Reschedule
                            </button>

                            <button
                              onClick={() => {
                                setSelectedVisit(visit);
                                setShowCompleteModal(true);
                              }}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30"
                            >
                              Execute / Complete
                            </button>
                          </>
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

      {/* Modal: Schedule New Service Visit */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-solar-500" />
                Schedule Field Service Visit
              </h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleVisit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Solar Project *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Project Code (e.g. PRJ-2026-00001) or ID"
                    value={scheduleForm.projectId}
                    onChange={e => setScheduleForm({ ...scheduleForm, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Technician User ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Technician Employee ID / User ID"
                    value={scheduleForm.assignedTechnicianId}
                    onChange={e =>
                      setScheduleForm({ ...scheduleForm, assignedTechnicianId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Visit Type *
                  </label>
                  <select
                    value={scheduleForm.visitType}
                    onChange={e => setScheduleForm({ ...scheduleForm, visitType: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="BREAKDOWN_REPAIR">Breakdown Repair</option>
                    <option value="ROUTINE_PREVENTIVE">Routine Preventive (AMC)</option>
                    <option value="WARRANTY_INSPECTION">Warranty Inspection</option>
                    <option value="COMMISSIONING_CHECK">Commissioning Check</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduledDate}
                    onChange={e =>
                      setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Time Slot *
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.scheduledTimeSlot}
                    onChange={e =>
                      setScheduleForm({ ...scheduleForm, scheduledTimeSlot: e.target.value })
                    }
                    placeholder="e.g. 10:00 - 13:00"
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Linked Complaint ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Linked Complaint Ticket or ID"
                    value={scheduleForm.complaintId}
                    onChange={e =>
                      setScheduleForm({ ...scheduleForm, complaintId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Visit Purpose & Scope *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe purpose (e.g. Inverter tripping inspection, MC4 connector replacement, quarterly module cleaning)..."
                  value={scheduleForm.purpose}
                  onChange={e => setScheduleForm({ ...scheduleForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reschedule Visit */}
      {showRescheduleModal && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground">
                Reschedule Visit: {selectedVisit.visitNumber}
              </h2>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReschedule} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  New Visit Date *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.newDate}
                  onChange={e => setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  New Time Slot
                </label>
                <input
                  type="text"
                  value={rescheduleForm.newTimeSlot}
                  onChange={e =>
                    setRescheduleForm({ ...rescheduleForm, newTimeSlot: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reschedule Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Document client availability change, weather contingency, or parts delay..."
                  value={rescheduleForm.reason}
                  onChange={e => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Reschedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Visit Execution */}
      {showCompleteModal && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                Complete Service Visit: {selectedVisit.visitNumber}
              </h2>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteVisit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Work Performed Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail work performed on site: component re-crimping, solar panel deep wash, torque tightening, string inverter reboot..."
                  value={completeForm.workPerformed}
                  onChange={e =>
                    setCompleteForm({ ...completeForm, workPerformed: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Site Observations & Technical Findings
                </label>
                <textarea
                  rows={2}
                  placeholder="Record ambient temperature, open circuit Voc, earthing resistance, roof condition..."
                  value={completeForm.observations}
                  onChange={e => setCompleteForm({ ...completeForm, observations: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Instantaneous kW Generation
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={completeForm.instantaneousKw}
                    onChange={e =>
                      setCompleteForm({ ...completeForm, instantaneousKw: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Meter Reading Cumulative kWh
                  </label>
                  <input
                    type="number"
                    value={completeForm.meterReadingKwh}
                    onChange={e =>
                      setCompleteForm({ ...completeForm, meterReadingKwh: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                  />
                </div>
              </div>

              {/* Mandatory Checklist Items */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Service Execution Quality Checklist
                </label>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                  {completeForm.checklist.map((chk, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs gap-2">
                      <div className="text-muted-foreground">{chk.item}</div>
                      <select
                        value={chk.status}
                        onChange={e => {
                          const updated = [...completeForm.checklist];
                          const item = updated[idx];
                          if (item) {
                            item.status = e.target.value;
                            setCompleteForm({ ...completeForm, checklist: updated });
                          }
                        }}
                        className="px-2 py-1 border rounded bg-background text-xs font-medium"
                      >
                        <option value="PASSED">PASSED</option>
                        <option value="FAILED">FAILED</option>
                        <option value="NOT_APPLICABLE">N/A</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Customer Signoff & Feedback
                </label>
                <input
                  type="text"
                  placeholder="Record customer signoff or feedback quote"
                  value={completeForm.customerFeedback}
                  onChange={e =>
                    setCompleteForm({ ...completeForm, customerFeedback: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              {selectedVisit.amcId && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-500">
                  ℹ️ Completing this visit will automatically deduct 1 visit from AMC contract{' '}
                  <span className="font-semibold">{selectedVisit.amcId.amcNumber}</span> atomically.
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Completing...' : 'Sign Off & Complete Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
