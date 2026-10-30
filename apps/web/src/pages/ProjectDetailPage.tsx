/**
 * INS Solar Business Management Software — Project Detail Page
 *
 * Operational management view for solar installation projects:
 * - 10-stage visual progression tracker
 * - Project lifecycle state transitions (Planning -> In Progress -> Completed/On Hold/Cancelled)
 * - Quality installation milestones with blocker reasons & sign-off auditing
 * - Project task delegation, due dates, and overdue alerts
 * - Chronological stage transition & audit activity history
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Check,
  XCircle,
  AlertCircle,
  Plus,
  Layers,
  Zap,
  User as UserIcon,
  Building2,
  ListTodo,
  History,
  ChevronRight,
  ShieldAlert,
  FileSpreadsheet,
  Truck,
  ClipboardCheck,
  Landmark,
  LifeBuoy,
  DollarSign
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { MaterialDispatchTab } from '../components/project/MaterialDispatchTab.js';
import { InstallationChecklistTab } from '../components/project/InstallationChecklistTab.js';
import { NetMeteringTab } from '../components/project/NetMeteringTab.js';
import { SubsidyTab } from '../components/project/SubsidyTab.js';
import { ServiceAmcTab } from '../components/project/ServiceAmcTab.js';
import { ProjectCostingTab } from '../components/project/ProjectCostingTab.js';

interface ProjectDetail {
  _id: string;
  projectCode: string;
  name: string;
  customerId: {
    _id: string;
    customerCode?: string;
    legalName?: string;
    displayName?: string;
    name?: string;
    primaryPhone?: string;
    email?: string;
  };
  orderId?: {
    _id: string;
    orderNumber: string;
    netTotalPaise?: number;
    status: string;
    systemCapacityKwp?: number;
  };
  siteAddress?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  systemCapacityKwp?: number;
  systemTopology?: string;
  currentStage: string;
  status: string;
  priority: string;
  plannedStartDate?: string;
  targetCompletionDate?: string;
  actualCompletionDate?: string;
  statusChangeReason?: string;
  notes?: string;
  projectManagerId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  teamMemberIds?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  milestones: Array<{
    _id: string;
    name: string;
    description?: string;
    displayOrder: number;
    plannedStartDate?: string;
    targetDueDate?: string;
    actualCompletionDate?: string;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
    blockerReason?: string;
    completedBy?: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    completedAt?: string;
  }>;
  stageHistory?: Array<{
    stage: string;
    transitionedAt: string;
    transitionedBy?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTaskItem {
  _id: string;
  taskCode: string;
  projectId: string;
  milestoneId?: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  blockerReason?: string;
  assignedUserId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  completedAt?: string;
  createdAt: string;
}

const STAGES = [
  {
    key: 'STAGE_1_ENGINEERING_DESIGN',
    step: 1,
    label: 'Design & Eng.',
    fullName: 'Stage 1: Design & Engineering'
  },
  {
    key: 'STAGE_2_NET_METERING_APPLY',
    step: 2,
    label: 'Net Metering',
    fullName: 'Stage 2: Net Metering Application'
  },
  {
    key: 'STAGE_3_MATERIAL_DISPATCH',
    step: 3,
    label: 'Dispatch',
    fullName: 'Stage 3: Material Dispatch'
  },
  {
    key: 'STAGE_4_CIVIL_STRUCTURE',
    step: 4,
    label: 'Civil Struct.',
    fullName: 'Stage 4: Civil & Roof Structure'
  },
  {
    key: 'STAGE_5_MODULE_DC_CABLING',
    step: 5,
    label: 'DC Cabling',
    fullName: 'Stage 5: Module & DC Cabling'
  },
  {
    key: 'STAGE_6_INVERTER_ACDB',
    step: 6,
    label: 'Inverter/ACDB',
    fullName: 'Stage 6: Inverter & ACDB/DCDB'
  },
  {
    key: 'STAGE_7_EARTHING_LIGHTNING',
    step: 7,
    label: 'Earthing',
    fullName: 'Stage 7: Earthing & Lightning'
  },
  {
    key: 'STAGE_8_TESTING_PRE_COMMISSION',
    step: 8,
    label: 'Pre-Test',
    fullName: 'Stage 8: Pre-Commission Testing'
  },
  {
    key: 'STAGE_9_DISCOM_METER_INSTALL',
    step: 9,
    label: 'DISCOM Sync',
    fullName: 'Stage 9: DISCOM Meter Sync'
  },
  {
    key: 'STAGE_10_COMMISSION_HANDOVER',
    step: 10,
    label: 'Handover',
    fullName: 'Stage 10: Commissioning & Handover'
  }
];

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'dispatch'
    | 'checklist'
    | 'net-metering'
    | 'subsidy'
    | 'service-amc'
    | 'milestones'
    | 'tasks'
    | 'history'
    | 'costing'
  >('overview');

  // Status transition modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Stage transition modal
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<string>('');
  const [stageNotes, setStageNotes] = useState<string>('');
  const [stageSubmitting, setStageSubmitting] = useState(false);

  // Milestone status modal
  const [milestoneStatusModalOpen, setMilestoneStatusModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [milestoneTargetStatus, setMilestoneTargetStatus] = useState<string>('');
  const [milestoneBlockerReason, setMilestoneBlockerReason] = useState<string>('');
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);

  // Add Milestone Modal
  const [addMilestoneModalOpen, setAddMilestoneModalOpen] = useState(false);
  const [newMilestoneData, setNewMilestoneData] = useState({
    name: '',
    description: '',
    displayOrder: 1,
    targetDueDate: ''
  });
  const [addMilestoneSubmitting, setAddMilestoneSubmitting] = useState(false);

  // Add Task Modal
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskFilterStatus, setTaskFilterStatus] = useState('ALL');
  const [taskOnlyOverdue, setTaskOnlyOverdue] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    milestoneId: '',
    priority: 'MEDIUM',
    dueDate: ''
  });
  const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);

  // Fetch Project Detail
  const fetchProject = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<ProjectDetail>(`/projects/${id}`);
      if (res) {
        setProject(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Tasks for Project
  const fetchTasks = async () => {
    if (!id) return;
    try {
      setTasksLoading(true);
      const params = new URLSearchParams();
      if (taskFilterStatus !== 'ALL') {
        params.append('status', taskFilterStatus);
      }
      if (taskOnlyOverdue) {
        params.append('isOverdue', 'true');
      }

      const res = await apiClient<{ tasks: ProjectTaskItem[] }>(
        `/projects/${id}/tasks?${params.toString()}`
      );
      if (res) {
        setTasks(res.tasks || []);
      }
    } catch (err: any) {
      console.error('Failed to load project tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchTasks();
    }
  }, [id, activeTab, taskFilterStatus, taskOnlyOverdue]);

  // Handle Project Status Transition
  const handleStatusTransition = async () => {
    if (!project || !targetStatus) return;
    if (['ON_HOLD', 'CANCELLED'].includes(targetStatus) && !statusReason.trim()) {
      alert('A valid reason is required when placing a project on hold or cancelling.');
      return;
    }

    try {
      setStatusSubmitting(true);
      await apiClient(`/projects/${project._id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason.trim() || undefined
        })
      });
      setActionSuccess(`Project successfully transitioned to ${targetStatus}`);
      setStatusModalOpen(false);
      setStatusReason('');
      fetchProject();
    } catch (err: any) {
      alert(err?.message || 'Failed to update project status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Stage Transition
  const handleStageAdvance = async () => {
    if (!project || !targetStage) return;

    try {
      setStageSubmitting(true);
      await apiClient(`/projects/${project._id}/stage`, {
        method: 'POST',
        body: JSON.stringify({
          stage: targetStage,
          notes: stageNotes.trim() || undefined
        })
      });
      setActionSuccess(`Project advanced to stage: ${targetStage}`);
      setStageModalOpen(false);
      setStageNotes('');
      fetchProject();
    } catch (err: any) {
      alert(err?.message || 'Failed to advance project stage');
    } finally {
      setStageSubmitting(false);
    }
  };

  // Handle Milestone Status Change
  const handleMilestoneStatusUpdate = async () => {
    if (!project || !selectedMilestone || !milestoneTargetStatus) return;
    if (milestoneTargetStatus === 'BLOCKED' && !milestoneBlockerReason.trim()) {
      alert('A blocker reason is strictly required when setting milestone to BLOCKED.');
      return;
    }

    try {
      setMilestoneSubmitting(true);
      await apiClient(`/projects/${project._id}/milestones/${selectedMilestone._id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: milestoneTargetStatus,
          blockerReason: milestoneBlockerReason.trim() || undefined
        })
      });
      setActionSuccess(`Milestone updated to ${milestoneTargetStatus}`);
      setMilestoneStatusModalOpen(false);
      setSelectedMilestone(null);
      setMilestoneBlockerReason('');
      fetchProject();
    } catch (err: any) {
      alert(err?.message || 'Failed to update milestone status');
    } finally {
      setMilestoneSubmitting(false);
    }
  };

  // Handle Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newMilestoneData.name.trim()) return;

    try {
      setAddMilestoneSubmitting(true);
      await apiClient(`/projects/${project._id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          name: newMilestoneData.name.trim(),
          description: newMilestoneData.description.trim() || undefined,
          displayOrder: Number(newMilestoneData.displayOrder) || 1,
          targetDueDate: newMilestoneData.targetDueDate || undefined
        })
      });
      setActionSuccess('New milestone added successfully');
      setAddMilestoneModalOpen(false);
      setNewMilestoneData({
        name: '',
        description: '',
        displayOrder: (project.milestones?.length || 0) + 1,
        targetDueDate: ''
      });
      fetchProject();
    } catch (err: any) {
      alert(err?.message || 'Failed to add milestone');
    } finally {
      setAddMilestoneSubmitting(false);
    }
  };

  // Handle Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newTaskData.title.trim()) return;

    try {
      setAddTaskSubmitting(true);
      await apiClient(`/projects/${project._id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskData.title.trim(),
          description: newTaskData.description.trim() || undefined,
          milestoneId: newTaskData.milestoneId || undefined,
          priority: newTaskData.priority,
          dueDate: newTaskData.dueDate || undefined
        })
      });
      setActionSuccess('Task created successfully');
      setAddTaskModalOpen(false);
      setNewTaskData({
        title: '',
        description: '',
        milestoneId: '',
        priority: 'MEDIUM',
        dueDate: ''
      });
      fetchTasks();
    } catch (err: any) {
      alert(err?.message || 'Failed to create task');
    } finally {
      setAddTaskSubmitting(false);
    }
  };

  // Quick Task Status Update
  const handleQuickTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await apiClient(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch (err: any) {
      alert(err?.message || 'Failed to update task status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Planning
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            On Hold
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const getMilestoneStatusBadge = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            Not Started
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            In Progress
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 font-semibold">
            Blocked
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 font-semibold">
            Completed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'TODO':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">To Do</span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
            In Progress
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-rose-100 text-rose-700 font-medium">
            Blocked
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 font-medium">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">Cancelled</span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-solar-600 mb-4"></div>
        <p className="text-muted-foreground">Loading project record...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-bold text-destructive mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The requested project could not be found.'}
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex(s => s.key === project.currentStage);
  const isTerminal = ['COMPLETED', 'CANCELLED'].includes(project.status);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/projects" className="hover:text-foreground flex items-center">
              <ArrowLeft className="w-4 h-4 mr-1" /> Projects
            </Link>
            <span>/</span>
            <span className="font-mono text-foreground font-semibold">{project.projectCode}</span>
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
            {getStatusBadge(project.status)}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
              Priority: {project.priority}
            </span>
          </div>
        </div>

        {/* Status Transition Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {project.status === 'PLANNING' && (
            <button
              onClick={() => {
                setTargetStatus('IN_PROGRESS');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-sm font-medium shadow-sm"
            >
              <PlayCircle className="w-4 h-4 mr-1.5" /> Start Project
            </button>
          )}

          {project.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => {
                  setTargetStage(
                    STAGES[Math.min(currentStageIndex + 1, STAGES.length - 1)]?.key ||
                      project.currentStage
                  );
                  setStageModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-sm font-medium shadow-sm"
              >
                <ChevronRight className="w-4 h-4 mr-1.5" /> Advance Stage
              </button>
              <button
                onClick={() => {
                  setTargetStatus('ON_HOLD');
                  setStatusModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 text-sm font-medium"
              >
                <PauseCircle className="w-4 h-4 mr-1.5" /> Hold
              </button>
              <button
                onClick={() => {
                  setTargetStatus('COMPLETED');
                  setStatusModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-1.5" /> Mark Completed
              </button>
            </>
          )}

          {project.status === 'ON_HOLD' && (
            <button
              onClick={() => {
                setTargetStatus('IN_PROGRESS');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-sm font-medium"
            >
              <PlayCircle className="w-4 h-4 mr-1.5" /> Resume Project
            </button>
          )}

          {!isTerminal && (
            <button
              onClick={() => {
                setTargetStatus('CANCELLED');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-medium"
            >
              <XCircle className="w-4 h-4 mr-1.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 text-sm flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* 10-Stage Progression Stepper */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-solar-600" />
            <h3 className="text-sm font-semibold text-foreground">
              Installation Progression Pipeline
            </h3>
          </div>
          <span className="text-xs font-semibold text-solar-600 bg-solar-50 px-2.5 py-0.5 rounded-full border border-solar-200">
            {STAGES[currentStageIndex]?.fullName || project.currentStage}
          </span>
        </div>

        {/* Stepper bar */}
        <div className="overflow-x-auto py-2">
          <div className="flex items-center min-w-[800px] justify-between">
            {STAGES.map((s, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center relative group">
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-4 -left-1/2 w-full h-1 -z-0 ${
                        isPast ? 'bg-solar-600' : 'bg-muted'
                      }`}
                    />
                  )}
                  {/* Node Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors shadow-sm ${
                      isPast
                        ? 'bg-solar-600 text-white'
                        : isCurrent
                          ? 'bg-solar-500 text-white ring-4 ring-solar-500/20'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : s.step}
                  </div>
                  <span
                    className={`mt-2 text-[11px] text-center font-medium line-clamp-1 max-w-[85px] ${
                      isCurrent
                        ? 'text-solar-600 font-bold'
                        : isPast
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b flex space-x-8 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'overview'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'dispatch'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Material Dispatch</span>
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'checklist'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Installation Checklist</span>
        </button>

        <button
          onClick={() => setActiveTab('net-metering')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'net-metering'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Net Metering</span>
        </button>

        <button
          onClick={() => setActiveTab('subsidy')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'subsidy'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Subsidy</span>
        </button>

        <button
          onClick={() => setActiveTab('service-amc')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'service-amc'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Service & AMC</span>
        </button>

        <button
          onClick={() => setActiveTab('costing')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'costing'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Costing & Profitability</span>
        </button>

        <button
          onClick={() => setActiveTab('milestones')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'milestones'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Milestones ({project.milestones?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'tasks'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>Project Tasks</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center space-x-2 ${
            activeTab === 'history'
              ? 'border-solar-600 text-solar-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Activity & Audit ({project.stageHistory?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Customer & Order Information */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-solar-600" /> Customer & Sales Order
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground">
                  {project.customerId?.legalName ||
                    project.customerId?.displayName ||
                    project.customerId?.name ||
                    'Customer'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Code / Phone:</span>
                <span className="font-mono text-muted-foreground">
                  {project.customerId?.customerCode || '—'}{' '}
                  {project.customerId?.primaryPhone ? `(${project.customerId.primaryPhone})` : ''}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Sales Order:</span>
                {project.orderId ? (
                  <Link
                    to={`/orders/${project.orderId._id}`}
                    className="font-mono font-medium text-solar-600 hover:underline flex items-center"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    {project.orderId.orderNumber}
                  </Link>
                ) : (
                  <span className="text-muted-foreground italic">Direct Project</span>
                )}
              </div>
              {project.orderId?.netTotalPaise && (
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Order Value:</span>
                  <span className="font-semibold text-foreground">
                    ₹{(project.orderId.netTotalPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Technical Scope & Site Address */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center">
              <Zap className="w-4 h-4 mr-2 text-solar-600" /> Technical Scope & Site
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">System Capacity:</span>
                <span className="font-bold text-foreground">
                  {project.systemCapacityKwp ? `${project.systemCapacityKwp} kWp` : 'Not Specified'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Topology:</span>
                <span className="font-medium text-foreground">
                  {project.systemTopology ? project.systemTopology.replace('_', ' ') : 'ON_GRID'}
                </span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-muted-foreground block">Installation Address:</span>
                <p className="text-xs bg-muted/50 p-2 rounded text-foreground">
                  {project.siteAddress?.addressLine1 || 'No street specified'},{' '}
                  {project.siteAddress?.city || '—'}, {project.siteAddress?.state || '—'}{' '}
                  {project.siteAddress?.postalCode || ''}
                </p>
              </div>
            </div>
          </div>

          {/* Project Schedule & Operational Notes */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-solar-600" /> Schedule & Leadership
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Planned Start:</span>
                <span className="font-medium text-foreground">
                  {project.plannedStartDate
                    ? new Date(project.plannedStartDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Target Completion:</span>
                <span className="font-medium text-foreground">
                  {project.targetCompletionDate
                    ? new Date(project.targetCompletionDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Actual Completion:</span>
                <span className="font-medium text-foreground">
                  {project.actualCompletionDate
                    ? new Date(project.actualCompletionDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Project Manager:</span>
                <span className="font-medium text-foreground flex items-center">
                  <UserIcon className="w-3.5 h-3.5 mr-1 text-solar-500" />
                  {project.projectManagerId
                    ? `${project.projectManagerId.firstName} ${project.projectManagerId.lastName}`
                    : 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Milestones */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Project Quality Milestones</h2>
              <p className="text-xs text-muted-foreground">
                Authoritative checklist of installation milestone gates and operational approvals.
              </p>
            </div>
            {!isTerminal && (
              <button
                onClick={() => {
                  setNewMilestoneData({
                    name: '',
                    description: '',
                    displayOrder: (project.milestones?.length || 0) + 1,
                    targetDueDate: ''
                  });
                  setAddMilestoneModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-sm font-medium shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Milestone
              </button>
            )}
          </div>

          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y">
              {project.milestones && project.milestones.length > 0 ? (
                project.milestones.map(m => (
                  <div
                    key={m._id}
                    className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                          {m.displayOrder}
                        </span>
                        <h4 className="font-semibold text-foreground text-sm">{m.name}</h4>
                        {getMilestoneStatusBadge(m.status)}
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground pl-8">{m.description}</p>
                      )}

                      {/* Blocker Reason Alert if Blocked */}
                      {m.status === 'BLOCKED' && m.blockerReason && (
                        <div className="ml-8 mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start space-x-1.5">
                          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                          <div>
                            <span className="font-bold">Blocker:</span> {m.blockerReason}
                          </div>
                        </div>
                      )}

                      {/* Completion Metadata if Completed */}
                      {m.status === 'COMPLETED' && m.completedAt && (
                        <div className="ml-8 mt-1 text-xs text-emerald-700 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            Signed off on {new Date(m.completedAt).toLocaleDateString()}{' '}
                            {m.completedBy
                              ? `by ${m.completedBy.firstName} ${m.completedBy.lastName}`
                              : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Milestone Due Dates & Action Buttons */}
                    <div className="flex items-center space-x-3 self-end md:self-center">
                      {m.targetDueDate && (
                        <div className="text-right text-xs text-muted-foreground hidden sm:block">
                          <span>Due: </span>
                          <span className="font-medium text-foreground">
                            {new Date(m.targetDueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {!isTerminal && (
                        <div className="flex items-center space-x-1">
                          {m.status === 'NOT_STARTED' && (
                            <button
                              onClick={() => {
                                setSelectedMilestone(m);
                                setMilestoneTargetStatus('IN_PROGRESS');
                                setMilestoneBlockerReason('');
                                setMilestoneStatusModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs rounded border bg-background hover:bg-muted font-medium"
                            >
                              Start
                            </button>
                          )}

                          {m.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedMilestone(m);
                                  setMilestoneTargetStatus('COMPLETED');
                                  setMilestoneBlockerReason('');
                                  setMilestoneStatusModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMilestone(m);
                                  setMilestoneTargetStatus('BLOCKED');
                                  setMilestoneBlockerReason('');
                                  setMilestoneStatusModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium"
                              >
                                Block
                              </button>
                            </>
                          )}

                          {m.status === 'BLOCKED' && (
                            <button
                              onClick={() => {
                                setSelectedMilestone(m);
                                setMilestoneTargetStatus('IN_PROGRESS');
                                setMilestoneBlockerReason('');
                                setMilestoneStatusModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs rounded border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium"
                            >
                              Resolve Blocker
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No milestones configured for this project.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Project Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Project Tasks</h2>
              <p className="text-xs text-muted-foreground">
                Operational action items and field task assignments.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={taskFilterStatus}
                onChange={e => setTaskFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border bg-background text-foreground"
              >
                <option value="ALL">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <label className="flex items-center space-x-1.5 text-xs text-foreground cursor-pointer border px-2.5 py-1.5 rounded-lg bg-card">
                <input
                  type="checkbox"
                  checked={taskOnlyOverdue}
                  onChange={e => setTaskOnlyOverdue(e.target.checked)}
                  className="rounded text-solar-600 focus:ring-solar-500"
                />
                <span>Overdue Only</span>
              </label>

              {!isTerminal && (
                <button
                  onClick={() => setAddTaskModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-medium shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Task
                </button>
              )}
            </div>
          </div>

          {tasksLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="divide-y">
                {tasks.length > 0 ? (
                  tasks.map(task => {
                    const isOverdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      !['COMPLETED', 'CANCELLED'].includes(task.status);
                    const linkedMilestone = project.milestones?.find(
                      m => m._id === task.milestoneId
                    );

                    return (
                      <div
                        key={task._id}
                        className="p-4 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
                              {task.taskCode}
                            </span>
                            <h4 className="text-sm font-semibold text-foreground">{task.title}</h4>
                            {getTaskStatusBadge(task.status)}
                            {isOverdue && (
                              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                            {linkedMilestone && (
                              <span className="inline-flex items-center text-solar-700 bg-solar-50 px-2 py-0.5 rounded border border-solar-200">
                                Milestone: {linkedMilestone.name}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Due {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignedUserId && (
                              <span className="flex items-center">
                                <UserIcon className="w-3 h-3 mr-1" />
                                {task.assignedUserId.firstName} {task.assignedUserId.lastName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Task Action Controls */}
                        {!isTerminal && (
                          <div className="flex items-center space-x-1.5 self-end md:self-center">
                            {task.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleQuickTaskStatus(task._id, 'COMPLETED')}
                                className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                              >
                                Complete
                              </button>
                            )}
                            {task.status === 'TODO' && (
                              <button
                                onClick={() => handleQuickTaskStatus(task._id, 'IN_PROGRESS')}
                                className="px-2.5 py-1 text-xs rounded border hover:bg-muted font-medium"
                              >
                                Start
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No tasks found matching criteria.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Material Dispatch */}
      {activeTab === 'dispatch' && (
        <MaterialDispatchTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab: Installation Checklist */}
      {activeTab === 'checklist' && (
        <InstallationChecklistTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab: Net Metering */}
      {activeTab === 'net-metering' && (
        <NetMeteringTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab: Subsidy Tracking */}
      {activeTab === 'subsidy' && <SubsidyTab projectId={project._id} isTerminal={isTerminal} />}

      {/* Tab: Service, Warranties & AMC */}
      {activeTab === 'service-amc' && (
        <ServiceAmcTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab: Project Costing & Profitability */}
      {activeTab === 'costing' && <ProjectCostingTab projectId={project._id} />}

      {/* Tab 4: Stage History & Activity */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground">
            Lifecycle & Stage Transition History
          </h2>
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            {project.stageHistory && project.stageHistory.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-muted">
                {project.stageHistory.map((item, idx) => {
                  const stageInfo = STAGES.find(s => s.key === item.stage);
                  return (
                    <div key={idx} className="relative flex items-start space-x-4 pl-8">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-solar-600 ring-4 ring-card" />
                      <div className="bg-muted/40 p-3 rounded-lg flex-1 border text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {stageInfo?.fullName || item.stage}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(item.transitionedAt).toLocaleString()}
                          </span>
                        </div>
                        {item.transitionedBy && (
                          <div className="text-xs text-muted-foreground">
                            Updated by {item.transitionedBy.firstName}{' '}
                            {item.transitionedBy.lastName} ({item.transitionedBy.email})
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-foreground bg-background p-2 rounded">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No historical transitions recorded yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Project Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Confirm Status Transition</h3>
            <p className="text-sm text-muted-foreground">
              Transition project{' '}
              <span className="font-mono font-bold text-foreground">{project.projectCode}</span> to{' '}
              <span className="font-semibold text-solar-600">{targetStatus}</span>?
            </p>

            {['ON_HOLD', 'CANCELLED'].includes(targetStatus) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  placeholder={`Provide mandatory operational justification for ${targetStatus}...`}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-solar-500"
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSubmitting}
                onClick={handleStatusTransition}
                className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
              >
                {statusSubmitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Advance Modal */}
      {stageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Advance Installation Stage</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Target Stage
                </label>
                <select
                  value={targetStage}
                  onChange={e => setTargetStage(e.target.value)}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                >
                  {STAGES.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Operational Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={stageNotes}
                  onChange={e => setStageNotes(e.target.value)}
                  placeholder="Notes regarding stage handover, inspection results, or field sign-offs..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStageModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stageSubmitting}
                onClick={handleStageAdvance}
                className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
              >
                {stageSubmitting ? 'Advancing...' : 'Advance Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Status Modal */}
      {milestoneStatusModalOpen && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">
              {milestoneTargetStatus === 'BLOCKED'
                ? 'Report Milestone Blocker'
                : 'Sign-off Milestone'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Milestone:{' '}
              <span className="font-semibold text-foreground">{selectedMilestone.name}</span>
            </p>

            {milestoneTargetStatus === 'BLOCKED' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Blocker Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={milestoneBlockerReason}
                  onChange={e => setMilestoneBlockerReason(e.target.value)}
                  placeholder="Specify blocker reason (e.g., DISCOM approval pending, site access denied)..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setMilestoneStatusModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={milestoneSubmitting}
                onClick={handleMilestoneStatusUpdate}
                className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
              >
                {milestoneSubmitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {addMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Add Custom Milestone</h3>
            <form onSubmit={handleAddMilestone} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Milestone Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMilestoneData.name}
                  onChange={e => setNewMilestoneData({ ...newMilestoneData, name: e.target.value })}
                  placeholder="e.g. DG Synchronization Test"
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newMilestoneData.description}
                  onChange={e =>
                    setNewMilestoneData({ ...newMilestoneData, description: e.target.value })
                  }
                  placeholder="Quality criteria or acceptance notes..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newMilestoneData.displayOrder}
                    onChange={e =>
                      setNewMilestoneData({
                        ...newMilestoneData,
                        displayOrder: Number(e.target.value)
                      })
                    }
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    value={newMilestoneData.targetDueDate}
                    onChange={e =>
                      setNewMilestoneData({ ...newMilestoneData, targetDueDate: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddMilestoneModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMilestoneSubmitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {addMilestoneSubmitting ? 'Adding...' : 'Add Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Create Project Task</h3>
            <form onSubmit={handleAddTask} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTaskData.title}
                  onChange={e => setNewTaskData({ ...newTaskData, title: e.target.value })}
                  placeholder="e.g. Roof penetration sealing verification"
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newTaskData.description}
                  onChange={e => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  placeholder="Detailed instructions or specifications..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Associated Milestone (Optional)
                </label>
                <select
                  value={newTaskData.milestoneId}
                  onChange={e => setNewTaskData({ ...newTaskData, milestoneId: e.target.value })}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                >
                  <option value="">No Milestone Linked</option>
                  {project.milestones?.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.displayOrder}. {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskData.priority}
                    onChange={e => setNewTaskData({ ...newTaskData, priority: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskData.dueDate}
                    onChange={e => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddTaskModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTaskSubmitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {addTaskSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
