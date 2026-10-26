import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Search,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Zap,
  User as UserIcon
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface ProjectListItem {
  _id: string;
  projectCode: string;
  name: string;
  customerId: {
    _id: string;
    customerCode: string;
    name: string;
    phone: string;
  };
  orderId?: {
    _id: string;
    orderNumber: string;
    netTotalPaise: number;
    status: string;
  };
  systemCapacityKwp?: number;
  systemTopology?: string;
  currentStage: string;
  status: string;
  priority: string;
  plannedStartDate: string;
  targetCompletionDate: string;
  projectManagerId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  milestones?: Array<{
    _id: string;
    status: string;
  }>;
}

const STAGE_LABELS: Record<string, { step: number; label: string }> = {
  STAGE_1_ENGINEERING_DESIGN: { step: 1, label: 'Design & Engineering' },
  STAGE_2_NET_METERING_APPLY: { step: 2, label: 'Net Metering Application' },
  STAGE_3_MATERIAL_DISPATCH: { step: 3, label: 'Material Dispatch' },
  STAGE_4_CIVIL_STRUCTURE: { step: 4, label: 'Civil & Roof Structure' },
  STAGE_5_MODULE_DC_CABLING: { step: 5, label: 'Module & DC Cabling' },
  STAGE_6_INVERTER_ACDB: { step: 6, label: 'Inverter & ACDB/DCDB' },
  STAGE_7_EARTHING_LIGHTNING: { step: 7, label: 'Earthing & Lightning' },
  STAGE_8_TESTING_PRE_COMMISSION: { step: 8, label: 'Pre-Commission Testing' },
  STAGE_9_DISCOM_METER_INSTALL: { step: 9, label: 'DISCOM Meter Sync' },
  STAGE_10_COMMISSION_HANDOVER: { step: 10, label: 'Commissioning & Handover' }
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // New Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    customerId: '',
    orderId: '',
    systemCapacityKwp: '',
    systemTopology: 'ON_GRID',
    plannedStartDate: new Date().toISOString().split('T')[0] || '',
    targetCompletionDate: '',
    priority: 'MEDIUM',
    notes: '',
    applyDefaultMilestones: true,
    addressLine1: '',
    city: '',
    state: '',
    postalCode: ''
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?limit=50&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;
      if (priorityFilter !== 'ALL') query += `&priority=${priorityFilter}`;

      const res = await apiClient<{ projects: ProjectListItem[]; total: number }>(`/projects${query}`);
      setProjects(res.projects || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [search, statusFilter, priorityFilter]);

  const openNewProjectModal = async () => {
    setIsModalOpen(true);
    try {
      const [custRes, ordRes] = await Promise.all([
        apiClient<{ customers: any[] }>('/customers?limit=100').catch(() => ({ customers: [] })),
        apiClient<{ items: any[] }>('/orders?limit=100').catch(() => ({ items: [] }))
      ]);
      setCustomersList(custRes.customers || []);
      setOrdersList(ordRes.items || []);
    } catch {
      // Non-critical background fetch
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setFormData(prev => ({ ...prev, orderId }));
    const selectedOrder = ordersList.find(o => o._id === orderId);
    if (selectedOrder) {
      setFormData(prev => ({
        ...prev,
        orderId,
        customerId: selectedOrder.customerId?._id || selectedOrder.customerId || prev.customerId,
        systemCapacityKwp: selectedOrder.systemCapacityKwp ? String(selectedOrder.systemCapacityKwp) : prev.systemCapacityKwp,
        systemTopology: selectedOrder.systemTopology || prev.systemTopology,
        name: prev.name || `Solar Installation - ${selectedOrder.orderNumber}`
      }));
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: formData.name.trim(),
        customerId: formData.customerId,
        orderId: formData.orderId || undefined,
        systemCapacityKwp: formData.systemCapacityKwp ? Number(formData.systemCapacityKwp) : undefined,
        systemTopology: formData.systemTopology,
        plannedStartDate: new Date(formData.plannedStartDate).toISOString(),
        targetCompletionDate: new Date(formData.targetCompletionDate).toISOString(),
        priority: formData.priority,
        notes: formData.notes || undefined,
        applyDefaultMilestones: formData.applyDefaultMilestones,
        siteAddress: formData.addressLine1
          ? {
              addressLine1: formData.addressLine1,
              city: formData.city,
              state: formData.state,
              postalCode: formData.postalCode,
              country: 'India'
            }
          : undefined
      };

      await apiClient('/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        customerId: '',
        orderId: '',
        systemCapacityKwp: '',
        systemTopology: 'ON_GRID',
        plannedStartDate: new Date().toISOString().split('T')[0] || '',
        targetCompletionDate: '',
        priority: 'MEDIUM',
        notes: '',
        applyDefaultMilestones: true,
        addressLine1: '',
        city: '',
        state: '',
        postalCode: ''
      });
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalCount = projects.length;
  const inProgressCount = projects.filter(p => p.status === 'IN_PROGRESS').length;
  const planningCount = projects.filter(p => p.status === 'PLANNING').length;
  const completedCount = projects.filter(p => p.status === 'COMPLETED').length;
  const onHoldCount = projects.filter(p => p.status === 'ON_HOLD').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderKanban className="w-7 h-7 text-primary" />
            Project Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Track solar rooftop installations, 10-stage milestones, field teams, and operational progress.
          </p>
        </div>
        <button
          onClick={openNewProjectModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Projects</span>
            <FolderKanban className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgressCount}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Planning</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{planningCount}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">On Hold</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{onHoldCount}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border p-3.5 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by project code, project name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNING">Planning</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading project records...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <h3 className="font-semibold text-foreground text-base">No projects found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Create a new project from an accepted customer order or start a standalone planning project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs font-semibold">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Capacity & System</th>
                  <th className="py-3 px-4">Stage Progress</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {projects.map(proj => {
                  const stageInfo = STAGE_LABELS[proj.currentStage] || { step: 1, label: proj.currentStage };
                  const percent = Math.round((stageInfo.step / 10) * 100);

                  return (
                    <tr key={proj._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/projects/${proj._id}`}
                          className="font-semibold text-primary hover:underline font-mono text-xs block"
                        >
                          {proj.projectCode}
                        </Link>
                        <span className="font-medium text-foreground text-xs line-clamp-1">{proj.name}</span>
                        {proj.priority === 'URGENT' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                            URGENT
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-foreground">{proj.customerId?.name || 'N/A'}</div>
                        <div className="text-[11px] text-muted-foreground">{proj.customerId?.phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          {proj.systemCapacityKwp ? `${proj.systemCapacityKwp} kWp` : 'Custom'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{proj.systemTopology || 'Standard'}</div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium text-foreground truncate max-w-[130px]">{stageInfo.label}</span>
                          <span className="text-muted-foreground font-mono">{stageInfo.step}/10</span>
                        </div>
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              proj.status === 'COMPLETED'
                                ? 'bg-emerald-500'
                                : proj.status === 'ON_HOLD'
                                ? 'bg-orange-400'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Target: {new Date(proj.targetCompletionDate).toLocaleDateString()}</span>
                        </div>
                        {proj.projectManagerId && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <UserIcon className="w-3 h-3" />
                            <span>{proj.projectManagerId.firstName} {proj.projectManagerId.lastName}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            proj.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : proj.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : proj.status === 'ON_HOLD'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                              : proj.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/projects/${proj._id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Manage
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden my-8 animate-in fade-in-50 zoom-in-95">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-lg">Create New Project</h3>
                <p className="text-xs text-muted-foreground">
                  Initialize a new installation project with 10 standard milestone planning templates.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Linked Order */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Link Confirmed Sales Order (Optional)
                </label>
                <select
                  value={formData.orderId}
                  onChange={e => handleOrderSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">-- Standalone Project (No Linked Order) --</option>
                  {ordersList.map(ord => (
                    <option key={ord._id} value={ord._id}>
                      {ord.orderNumber} — {ord.customerId?.name || 'Customer'} ({ord.systemCapacityKwp || 0} kWp)
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Project Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10kW Rooftop Solar - Ramesh Sharma Residence"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                />
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Customer <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={formData.customerId}
                  onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="">-- Select Customer --</option>
                  {customersList.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.customerCode || c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Technical Capacity & Topology */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Capacity (kWp)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 8.5"
                    value={formData.systemCapacityKwp}
                    onChange={e => setFormData({ ...formData, systemCapacityKwp: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Topology</label>
                  <select
                    value={formData.systemTopology}
                    onChange={e => setFormData({ ...formData, systemTopology: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                  >
                    <option value="ON_GRID">On-Grid Solar Plant</option>
                    <option value="OFF_GRID">Off-Grid Solar Plant with Battery</option>
                    <option value="HYBRID">Hybrid Solar Plant (Grid + Battery)</option>
                  </select>
                </div>
              </div>

              {/* Planned Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Planned Start Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.plannedStartDate}
                    onChange={e => setFormData({ ...formData, plannedStartDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Target Completion Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.targetCompletionDate}
                    onChange={e => setFormData({ ...formData, targetCompletionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent (Express Commissioning)</option>
                </select>
              </div>

              {/* Site Address */}
              <div className="p-3 border border-border rounded-lg bg-secondary/10 space-y-2">
                <div className="font-semibold text-xs text-foreground">Installation Site Address</div>
                <input
                  type="text"
                  placeholder="Street / Building Address Line 1"
                  value={formData.addressLine1}
                  onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                  <input
                    type="text"
                    placeholder="PIN Code"
                    value={formData.postalCode}
                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                </div>
              </div>

              {/* Default Milestones Checkbox */}
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.applyDefaultMilestones}
                  onChange={e => setFormData({ ...formData, applyDefaultMilestones: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                />
                <span>Automatically initialize 10 standard installation milestones</span>
              </label>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-input text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
