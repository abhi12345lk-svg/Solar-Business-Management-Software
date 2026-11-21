import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCcw,
  Trash2,
  X,
  User,
  Users,
  FolderKanban
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface TaskItem {
  _id: string;
  taskNumber?: string;
  taskCode?: string;
  title: string;
  description?: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  isOverdue?: boolean;
  blockerReason?: string;
  completionNotes?: string;
  followUpDate?: string;
  projectId?: {
    _id: string;
    projectNumber?: string;
    projectCode?: string;
    name?: string;
    title?: string;
  };
  customerId?: {
    _id: string;
    customerCode?: string;
    fullName?: string;
    name?: string;
  };
  assignedUserId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode?: string;
  };
  teamId?: {
    _id: string;
    teamCode: string;
    name: string;
  };
  relatedEntityType?: string;
  relatedEntityId?: string;
}

interface TaskMetadata {
  users: Array<{ _id: string; name: string; email: string; role: string; employeeCode?: string }>;
  teams: Array<{ _id: string; name: string; teamCode: string; purpose?: string }>;
  projects: Array<{ _id: string; projectCode: string; name: string; status: string }>;
  customers: Array<{ _id: string; customerCode: string; name: string; phone?: string }>;
}

const TASK_CATEGORIES: { value: string; label: string }[] = [
  { value: 'PROJECT', label: 'Project Execution (Field/EPC)' },
  { value: 'INSTALLATION_CHECKLIST', label: 'Installation Checklist & Commissioning' },
  { value: 'NET_METERING', label: 'Net Metering & DISCOM Liaison' },
  { value: 'SUBSIDY', label: 'Govt Subsidy (DBT) Documentation' },
  { value: 'DOCUMENT_REVIEW', label: 'Document Review & KYC Verification' },
  { value: 'CUSTOMER_FOLLOWUP', label: 'Customer Milestone & Follow-up' },
  { value: 'SERVICE_COMPLAINT', label: 'Service Complaint & Maintenance' },
  { value: 'GENERAL', label: 'General Operational Task' }
];

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Metadata
  const [metadata, setMetadata] = useState<TaskMetadata>({
    users: [],
    teams: [],
    projects: [],
    customers: []
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Status Modal Form State
  const [nextStatus, setNextStatus] = useState<
    'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
  >('IN_PROGRESS');
  const [completionNotes, setCompletionNotes] = useState('');
  const [blockerReason, setBlockerReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Reassign Modal Form State
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Create Modal Form State
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCategory, setCreateCategory] = useState('PROJECT');
  const [createPriority, setCreatePriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [createTeamId, setCreateTeamId] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [createCustomerId, setCreateCustomerId] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Metadata
  const fetchMetadata = async () => {
    try {
      const data = await apiClient<TaskMetadata>('/tasks/metadata');
      if (data) {
        setMetadata({
          users: data.users || [],
          teams: data.teams || [],
          projects: data.projects || [],
          customers: data.customers || []
        });
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (statusFilter) queryParams.set('status', statusFilter);
      if (priorityFilter) queryParams.set('priority', priorityFilter);
      if (categoryFilter) queryParams.set('category', categoryFilter);
      if (isOverdueOnly) queryParams.set('isOverdue', 'true');

      const res = await apiClient<any>(`/tasks?${queryParams.toString()}`);
      setTasks(Array.isArray(res) ? res : res?.items || res?.tasks || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load unified tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [search, statusFilter, priorityFilter, categoryFilter, isOverdueOnly]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setIsOverdueOnly(false);
  };

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || priorityFilter || categoryFilter || isOverdueOnly
  );

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDesc.trim() || undefined,
          category: createCategory,
          priority: createPriority,
          dueDate: createDueDate ? new Date(createDueDate).toISOString() : undefined,
          assignedUserId: createAssigneeId.trim() || undefined,
          teamId: createTeamId.trim() || undefined,
          projectId: createProjectId.trim() || undefined,
          customerId: createCustomerId.trim() || undefined
        })
      });

      setCreateModalOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateDueDate('');
      setCreateAssigneeId('');
      setCreateTeamId('');
      setCreateProjectId('');
      setCreateCustomerId('');
      fetchTasks();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    if (nextStatus === 'BLOCKED' && !blockerReason.trim()) {
      setFormError('A blocker reason is mandatory when marking a task as BLOCKED.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/tasks/${selectedTask._id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: nextStatus,
          completionNotes: nextStatus === 'COMPLETED' ? completionNotes.trim() : undefined,
          blockerReason: nextStatus === 'BLOCKED' ? blockerReason.trim() : undefined,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : undefined
        })
      });

      setStatusModalOpen(false);
      setSelectedTask(null);
      setCompletionNotes('');
      setBlockerReason('');
      setFollowUpDate('');
      fetchTasks();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update task status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!reassignUserId.trim()) {
      setFormError('Please select a team member to reassign this task to.');
      return;
    }
    if (!reassignReason.trim()) {
      setFormError('Reassignment reason is required for operational audit trail.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/tasks/${selectedTask._id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          assignedUserId: reassignUserId.trim(),
          reason: reassignReason.trim()
        })
      });

      setReassignModalOpen(false);
      setSelectedTask(null);
      setReassignUserId('');
      setReassignReason('');
      fetchTasks();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to reassign task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/tasks/${selectedTask._id}`, {
        method: 'DELETE'
      });
      setDeleteModalOpen(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats
  const totalCount = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length;
  const overdueCount = tasks.filter(
    t =>
      t.isOverdue ||
      (t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED')
  ).length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-amber-500" />
            Unified Task Management
          </h1>
          <p className="text-sm text-gray-500">
            Cross-functional operational tasks across solar EPC projects, field installations, DISCOM net-metering, and subsidy disbursements.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-gray-50 text-gray-700 rounded-lg">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-xs text-gray-500">Total Filtered Tasks</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700">{inProgressCount}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{blockedCount}</div>
            <div className="text-xs text-gray-500">Blocked Dependencies</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4 bg-red-50/20">
          <div className="p-3 bg-red-100 text-red-700 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            <div className="text-xs text-red-600 font-semibold">Overdue Deadlines</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">{completedCount}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search task number, title, or details..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
        >
          <option value="">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
        >
          <option value="">All Categories</option>
          {TASK_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer pl-1">
          <input
            type="checkbox"
            checked={isOverdueOnly}
            onChange={e => setIsOverdueOnly(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-red-700">Show Overdue Only</span>
        </label>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            title="Reset All Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading operational tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No tasks found matching current filters.</p>
            <p className="text-sm text-gray-400 mt-1">
              {hasActiveFilters
                ? 'Try resetting your filter parameters or search term.'
                : 'Click "Create Task" above to schedule cross-functional work.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 rounded-lg transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left border-collapse text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Task Details</th>
                  <th className="py-3 px-4">Category & Scope</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assignee / Team</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map(task => {
                  const isOverdue =
                    task.isOverdue ||
                    (task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      task.status !== 'COMPLETED' &&
                      task.status !== 'CANCELLED');

                  const assigneeName = task.assignedUserId
                    ? `${task.assignedUserId.firstName} ${task.assignedUserId.lastName}`.trim()
                    : null;

                  const categoryLabel =
                    TASK_CATEGORIES.find(c => c.value === task.category)?.label ||
                    task.category.replace(/_/g, ' ');

                  return (
                    <tr
                      key={task._id}
                      className={`hover:bg-gray-50/80 transition ${
                        isOverdue ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-mono text-xs font-bold text-amber-600">
                          {task.taskCode || task.taskNumber}
                        </div>
                        <div className="font-semibold text-gray-900 line-clamp-1">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">
                            {task.description}
                          </div>
                        )}
                        {task.blockerReason && (
                          <div className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Blocker: {task.blockerReason}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {categoryLabel}
                        </span>
                        {task.projectId && (
                          <div className="text-xs text-indigo-600 font-mono mt-0.5 flex items-center gap-1">
                            <FolderKanban className="w-3 h-3" />
                            <span>{task.projectId.projectCode || task.projectId.projectNumber || 'Project'}</span>
                          </div>
                        )}
                        {task.customerId && (
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="line-clamp-1">
                              {task.customerId.fullName || task.customerId.name || 'Client'}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            task.priority === 'URGENT'
                              ? 'bg-red-100 text-red-800'
                              : task.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : task.priority === 'MEDIUM'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        {assigneeName ? (
                          <div className="font-medium text-gray-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-blue-500" />
                            <span>{assigneeName}</span>
                          </div>
                        ) : task.teamId ? (
                          <div className="font-medium text-indigo-700 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{task.teamId.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs">
                        {task.dueDate ? (
                          <div
                            className={`font-medium ${
                              isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'
                            }`}
                          >
                            {new Date(task.dueDate).toLocaleDateString()}
                            {isOverdue && (
                              <span className="block text-[10px] text-red-500 uppercase tracking-wider font-semibold">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No deadline</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : task.status === 'BLOCKED'
                                  ? 'bg-red-100 text-red-800'
                                  : task.status === 'CANCELLED'
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setNextStatus(task.status);
                              setBlockerReason(task.blockerReason || '');
                              setCompletionNotes(task.completionNotes || '');
                              setFollowUpDate(task.followUpDate ? task.followUpDate.slice(0, 10) : '');
                              setFormError(null);
                              setStatusModalOpen(true);
                            }}
                            className="text-xs font-medium text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 transition"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setReassignUserId(task.assignedUserId?._id || '');
                              setReassignReason('');
                              setFormError(null);
                              setReassignModalOpen(true);
                            }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setFormError(null);
                              setDeleteModalOpen(true);
                            }}
                            className="text-xs font-medium text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Update Status */}
      {statusModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 !mt-0 !m-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Update Status: {selectedTask.taskCode || selectedTask.taskNumber}
                </h3>
                <p className="text-xs text-gray-500 font-medium">{selectedTask.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={nextStatus}
                  onChange={e => setNextStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  <option value="TODO">To Do (Pending)</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked (Requires Blocker Reason)</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {nextStatus === 'BLOCKED' && (
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Blocker Reason *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Waiting for DISCOM meter testing inspection approval"
                    value={blockerReason}
                    onChange={e => setBlockerReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {nextStatus === 'COMPLETED' && (
                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">
                    Completion Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Structure torqued, inverter synched with grid, signed checklist attached."
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Task */}
      {reassignModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 !mt-0 !m-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Reassign Task: {selectedTask.taskCode || selectedTask.taskNumber}
                </h3>
                <p className="text-xs text-gray-500">{selectedTask.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleReassign} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign To Team Member *
                </label>
                <select
                  value={reassignUserId}
                  onChange={e => setReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  required
                >
                  <option value="">Select Assignee...</option>
                  {metadata.users.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} {u.employeeCode ? `(${u.employeeCode})` : ''} - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Reassignment *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Field engineer on leave, delegated to electrical specialist"
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Task Confirmation */}
      {deleteModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 !mt-0 !m-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 sm:p-6 space-y-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">Delete Task</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete task{' '}
                <strong className="text-gray-900 font-mono">
                  {selectedTask.taskCode || selectedTask.taskNumber}
                </strong>
                ? This action will remove the task record and cannot be undone.
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Unified Task */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 !mt-0 !m-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-500" />
                Create Operational Task
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conduct Megger insulation resistance test & inverter sync"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description / Operational Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed requirements, checklist items or handover notes..."
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={createCategory}
                    onChange={e => setCreateCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    {TASK_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={createPriority}
                    onChange={e => setCreatePriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (Blocker)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={createDueDate}
                  onChange={e => setCreateDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assign To Employee (Optional)
                  </label>
                  <select
                    value={createAssigneeId}
                    onChange={e => setCreateAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="">None / Unassigned</option>
                    {metadata.users.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.name} {u.employeeCode ? `(${u.employeeCode})` : ''} - {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assign To Team (Optional)
                  </label>
                  <select
                    value={createTeamId}
                    onChange={e => setCreateTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="">None / Individual Staff</option>
                    {metadata.teams.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.teamCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Link Solar Project (Optional)
                  </label>
                  <select
                    value={createProjectId}
                    onChange={e => setCreateProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="">None / General Task</option>
                    {metadata.projects.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.projectCode} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Customer / Client (Optional)
                  </label>
                  <select
                    value={createCustomerId}
                    onChange={e => setCreateCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="">None / Internal Task</option>
                    {metadata.customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.customerCode} - {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
