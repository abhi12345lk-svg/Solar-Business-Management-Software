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
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
  AlertTriangle,
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
  IndianRupee,
  Camera,
  LifeBuoy,
  Printer
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { MaterialDispatchTab } from '../components/project/MaterialDispatchTab.js';
import { InstallationChecklistTab } from '../components/project/InstallationChecklistTab.js';
import { ProjectSitePhotosTab } from '../components/project/ProjectSitePhotosTab.js';
import { NetMeteringTab } from '../components/project/NetMeteringTab.js';
import { SubsidyTab } from '../components/project/SubsidyTab.js';
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

export const FIVE_STAGES = [
  {
    key: 'STAGE_1_DESIGN_APPROVAL',
    step: 1,
    label: 'Design & Approval',
    fullName: 'Stage 1: Design & DISCOM Approval',
    targetTab: 'overview' as const,
    description: 'Engineering design, PV layout, and DISCOM net-metering portal application'
  },
  {
    key: 'STAGE_2_MATERIAL_DISPATCH',
    step: 2,
    label: 'Material Dispatch',
    fullName: 'Stage 2: Material Dispatch',
    targetTab: 'dispatch' as const,
    description: 'Hardware dispatch: solar modules, inverter, structure, and BOS to customer site'
  },
  {
    key: 'STAGE_3_SITE_INSTALLATION',
    step: 3,
    label: 'Site Installation',
    fullName: 'Stage 3: Site Installation & Wiring',
    targetTab: 'checklist' as const,
    description: 'Rooftop mounting, module fixing, inverter connection, AC/DC cabling, earthing & testing'
  },
  {
    key: 'STAGE_4_NET_METER_SYNC',
    step: 4,
    label: 'DISCOM Net Meter',
    fullName: 'Stage 4: DISCOM Net Meter Sync',
    targetTab: 'net-metering' as const,
    description: 'DISCOM inspection, bi-directional net meter installation & utility grid synchronization'
  },
  {
    key: 'STAGE_5_HANDOVER_COMMISSIONING',
    step: 5,
    label: 'Handover & COD',
    fullName: 'Stage 5: Commissioning & Handover',
    targetTab: 'subsidy' as const,
    description: 'Plant energization, Joint Commissioning Report (JCR) sign-off & PM Surya Ghar subsidy claim'
  }
];

export function getSimplifiedStageIndex(stageKey: string): number {
  switch (stageKey) {
    case 'STAGE_1_ENGINEERING_DESIGN':
    case 'STAGE_1_DESIGN_APPROVAL':
    case 'STAGE_2_NET_METERING_APPLY':
      return 0;

    case 'STAGE_3_MATERIAL_DISPATCH':
    case 'STAGE_2_MATERIAL_DISPATCH':
      return 1;

    case 'STAGE_4_CIVIL_STRUCTURE':
    case 'STAGE_5_MODULE_DC_CABLING':
    case 'STAGE_6_INVERTER_ACDB':
    case 'STAGE_7_EARTHING_LIGHTNING':
    case 'STAGE_8_TESTING_PRE_COMMISSION':
    case 'STAGE_3_SITE_INSTALLATION':
      return 2;

    case 'STAGE_9_DISCOM_METER_INSTALL':
    case 'STAGE_4_NET_METER_SYNC':
      return 3;

    case 'STAGE_10_COMMISSION_HANDOVER':
    case 'STAGE_5_HANDOVER_COMMISSIONING':
      return 4;

    default:
      return 0;
  }
}

export function getStageDisplayInfo(stageKey: string) {
  const idx = getSimplifiedStageIndex(stageKey);
  return (FIVE_STAGES[idx] || FIVE_STAGES[0])!;
}

export type ProjectDetailTab =
  | 'overview'
  | 'dispatch'
  | 'checklist'
  | 'photos'
  | 'net-metering'
  | 'subsidy'
  | 'costing';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as any;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(() => {
    if (urlTab === 'dispatch') return 'dispatch';
    if (urlTab === 'checklist') return 'checklist';
    if (urlTab === 'photos') return 'photos';
    if (urlTab === 'net-metering') return 'net-metering';
    if (urlTab === 'subsidy') return 'subsidy';
    if (urlTab === 'costing') return 'costing';
    return 'overview';
  });

  // Status transition modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');
  const [generationReadingKwh, setGenerationReadingKwh] = useState<string>('');
  const [customerHandoverSignedOff, setCustomerHandoverSignedOff] = useState<boolean>(false);
  const [customerSignOffName, setCustomerSignOffName] = useState<string>('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  // Stage transition modal
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<string>('');
  const [stageNotes, setStageNotes] = useState<string>('');
  const [stageSubmitting, setStageSubmitting] = useState(false);
  const [stageModalError, setStageModalError] = useState<string | null>(null);

  // Milestone status modal
  const [milestoneStatusModalOpen, setMilestoneStatusModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [milestoneTargetStatus, setMilestoneTargetStatus] = useState<string>('');
  const [milestoneBlockerReason, setMilestoneBlockerReason] = useState<string>('');
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);
  const [milestoneModalError, setMilestoneModalError] = useState<string | null>(null);

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
  const [taskModalError, setTaskModalError] = useState<string | null>(null);

  // AMC Initialization
  const [initializingAmc, setInitializingAmc] = useState(false);

  // Assign Team & Edit Schedule Modal
  const [assignTeamModalOpen, setAssignTeamModalOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [assignPmId, setAssignPmId] = useState('');
  const [assignTeamIds, setAssignTeamIds] = useState<string[]>([]);
  const [editPriority, setEditPriority] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editAddress, setEditAddress] = useState({
    addressLine1: '',
    city: '',
    state: '',
    postalCode: ''
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleOpenAssignTeamModal = async () => {
    setAssignError(null);
    setAssignPmId((project?.projectManagerId as any)?._id || '');
    setAssignTeamIds((project?.teamMemberIds || []).map((m: any) => m._id || m));
    setEditPriority(project?.priority || 'MEDIUM');
    setEditTargetDate(
      project?.targetCompletionDate
        ? new Date(project.targetCompletionDate).toISOString().split('T')[0]!
        : ''
    );
    setEditAddress({
      addressLine1: project?.siteAddress?.addressLine1 || '',
      city: project?.siteAddress?.city || '',
      state: project?.siteAddress?.state || '',
      postalCode: project?.siteAddress?.postalCode || ''
    });

    try {
      const res = await apiClient<any>('/employees?limit=100');
      const emps = res?.items || res?.employees || (Array.isArray(res) ? res : []);
      setEmployeesList(emps);
    } catch {
      // fallback
    }

    setAssignTeamModalOpen(true);
  };

  const handleSaveTeamAndSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      setAssignSubmitting(true);
      setAssignError(null);
      await apiClient(`/projects/${project._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          projectManagerId: assignPmId || undefined,
          teamMemberIds: assignTeamIds,
          priority: editPriority,
          targetCompletionDate: editTargetDate ? new Date(editTargetDate).toISOString() : undefined,
          siteAddress: editAddress.addressLine1 ? editAddress : undefined
        })
      });
      setAssignTeamModalOpen(false);
      setActionSuccess('Project team assignments and schedule updated successfully.');
      await fetchProject();
    } catch (err: any) {
      setAssignError(err?.message || 'Failed to update team assignments.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const toggleTeamMember = (empUserId: string) => {
    if (assignTeamIds.includes(empUserId)) {
      setAssignTeamIds(assignTeamIds.filter(id => id !== empUserId));
    } else {
      setAssignTeamIds([...assignTeamIds, empUserId]);
    }
  };
  const [amcInfo, setAmcInfo] = useState<string | null>(null);

  const handleInitializeAmc = async () => {
    if (!id) return;
    try {
      setInitializingAmc(true);
      const res = await apiClient<any>(`/projects/${id}/initialize-amc`, {
        method: 'POST'
      });
      const data = res?.data || res;
      const amcNum = data?.amcNumber || 'AMC-PENDING';
      const statusLabel = data?.status === 'ACTIVE' ? 'Active' : 'Pending Approval';
      setAmcInfo(`${statusLabel}: Contract #${amcNum} (4 Quarterly Visits Scheduled)`);
      setActionSuccess(
        data?.status === 'ACTIVE'
          ? `1st-Year Comprehensive AMC active: Contract #${amcNum}`
          : `1st-Year Comprehensive AMC proposal #${amcNum} created (${data?.status || 'PENDING_APPROVAL'}). Approve in Service & AMC to activate.`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to initialize AMC contract.');
    } finally {
      setInitializingAmc(false);
    }
  };

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
    if (!urlTab) {
      setActiveTab('overview');
      return;
    }
    if (urlTab === 'dispatch') {
      setActiveTab('dispatch');
    } else if (urlTab === 'checklist') {
      setActiveTab('checklist');
    } else if (urlTab === 'photos') {
      setActiveTab('photos');
    } else if (urlTab === 'net-metering') {
      setActiveTab('net-metering');
    } else if (urlTab === 'subsidy') {
      setActiveTab('subsidy');
    } else if (urlTab === 'costing') {
      setActiveTab('costing');
    } else {
      setActiveTab('overview');
    }
  }, [urlTab]);

  const handleSelectTab = (tab: ProjectDetailTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams);
  };

  useEffect(() => {
    if (id) {
      fetchTasks();
    }
  }, [id, taskFilterStatus, taskOnlyOverdue]);

  // Handle Project Status Transition
  const handleStatusTransition = async () => {
    if (!project || !targetStatus) return;
    if (['ON_HOLD', 'CANCELLED'].includes(targetStatus) && !statusReason.trim()) {
      setStatusModalError('A valid operational reason is required when placing a project on hold or cancelling.');
      return;
    }

    try {
      setStatusSubmitting(true);
      setStatusModalError(null);
      const bodyPayload: any = {
        status: targetStatus,
        reason: statusReason.trim() || undefined
      };
      if (targetStatus === 'COMPLETED') {
        const genNum = generationReadingKwh.trim() !== '' ? Number(generationReadingKwh) : undefined;
        bodyPayload.commissioningDetails = {
          ...(genNum !== undefined && !isNaN(genNum) ? { generationReadingKwh: genNum } : {}),
          customerHandoverSignedOff,
          customerSignOffName: customerSignOffName.trim() || undefined,
          handoverNotes: statusReason.trim() || undefined
        };
      }
      await apiClient(`/projects/${project._id}/status`, {
        method: 'POST',
        body: JSON.stringify(bodyPayload)
      });
      setActionSuccess(`Project successfully transitioned to ${targetStatus}`);
      setStatusModalOpen(false);
      setStatusReason('');
      setGenerationReadingKwh('');
      setCustomerHandoverSignedOff(false);
      setCustomerSignOffName('');
      fetchProject();
    } catch (err: any) {
      setStatusModalError(err?.message || 'Failed to update project status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Stage Transition
  const handleStageAdvance = async () => {
    if (!project || !targetStage) return;

    try {
      setStageSubmitting(true);
      setStageModalError(null);
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
      setStageModalError(err?.message || 'Failed to advance project stage');
    } finally {
      setStageSubmitting(false);
    }
  };

  // Handle Milestone Status Change
  const handleMilestoneStatusUpdate = async () => {
    if (!project || !selectedMilestone || !milestoneTargetStatus) return;
    if (milestoneTargetStatus === 'BLOCKED' && !milestoneBlockerReason.trim()) {
      setMilestoneModalError('A blocker reason is strictly required when setting milestone to BLOCKED.');
      return;
    }

    try {
      setMilestoneSubmitting(true);
      setMilestoneModalError(null);
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
      setMilestoneModalError(err?.message || 'Failed to update milestone status');
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
      setMilestoneModalError(null);
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
      setMilestoneModalError(err?.message || 'Failed to add milestone');
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
      setTaskModalError(null);
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
      setTaskModalError(err?.message || 'Failed to create task');
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
      console.warn('Failed to update task status:', err);
    }
  };

  const handleStageClick = (stageKey: string) => {
    const idx = getSimplifiedStageIndex(stageKey);
    const target = FIVE_STAGES[idx];
    if (target) {
      handleSelectTab(target.targetTab as ProjectDetailTab);
    }
  };

  const handleStageNodeClick = (stageKey: string, stageIndex: number) => {
    handleStageClick(stageKey);

    // If clicking next stage directly while in progress, open advance stage modal
    if (project?.status === 'IN_PROGRESS' && stageIndex === currentStageIndex + 1) {
      setTargetStage(stageKey);
      setStageModalOpen(true);
    } else if (project?.status === 'PLANNING') {
      setTargetStatus('IN_PROGRESS');
      setStatusModalOpen(true);
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

  const currentStageIndex = getSimplifiedStageIndex(project.currentStage);
  const isTerminal = ['COMPLETED', 'CANCELLED'].includes(project.status);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Link to="/projects" className="hover:text-foreground flex items-center font-medium">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Projects
            </Link>
            <span>/</span>
            <span className="font-mono text-foreground font-semibold">{project.projectCode}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate max-w-xl">
              {project.name}
            </h1>
            {getStatusBadge(project.status)}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
              Priority: {project.priority}
            </span>
          </div>
        </div>

        {/* Status Transition Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 shrink-0 self-start lg:self-center">
          <button
            onClick={() => window.print()}
            title="Print or export project engineering & site dossier"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors print:hidden"
          >
            <Printer className="w-3.5 h-3.5" /> Print Dossier
          </button>

          {project.status === 'PLANNING' && (
            <button
              onClick={() => {
                setStatusModalError(null);
                setTargetStatus('IN_PROGRESS');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-bold shadow-xs transition-colors"
            >
              <PlayCircle className="w-4 h-4" /> Start Project
            </button>
          )}

          {project.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => {
                  setStageModalError(null);
                  setTargetStage(
                    FIVE_STAGES[Math.min(currentStageIndex + 1, FIVE_STAGES.length - 1)]?.key ||
                      project.currentStage
                  );
                  setStageModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-bold shadow-xs transition-colors"
              >
                <ChevronRight className="w-4 h-4" /> Advance Stage
              </button>
              <button
                onClick={() => {
                  setStatusModalError(null);
                  setTargetStatus('ON_HOLD');
                  setStatusModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" /> Hold
              </button>
              <button
                onClick={() => {
                  setStatusModalError(null);
                  setTargetStatus('COMPLETED');
                  setStatusModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Mark Completed
              </button>
            </>
          )}

          {project.status === 'ON_HOLD' && (
            <button
              onClick={() => {
                setStatusModalError(null);
                setTargetStatus('IN_PROGRESS');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-bold shadow-xs transition-colors"
            >
              <PlayCircle className="w-4 h-4" /> Resume Project
            </button>
          )}

          {!isTerminal && (
            <button
              onClick={() => {
                setStatusModalError(null);
                setTargetStatus('CANCELLED');
                setStatusModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel
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

      {/* 5-Stage Progression Stepper */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-solar-600" />
            <h3 className="text-sm font-semibold text-foreground">
              Installation Progression Pipeline (5 Master Milestones)
            </h3>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            project.status === 'CANCELLED'
              ? 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
              : project.status === 'COMPLETED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                : 'text-solar-600 bg-solar-50 border-solar-200 dark:bg-solar-950/40 dark:border-solar-800'
          }`}>
            {project.status === 'CANCELLED'
              ? 'Project Status: CANCELLED'
              : project.status === 'COMPLETED'
                ? 'All 5 Stages Completed (Commissioned)'
                : (FIVE_STAGES[currentStageIndex]?.fullName || project.currentStage)}
          </span>
        </div>

        {/* Stepper bar */}
        <div className="overflow-x-auto py-2">
          <div className="flex items-center min-w-[650px] justify-between">
            {FIVE_STAGES.map((s, idx) => {
              const isCompleted = project.status === 'COMPLETED';
              const isCancelled = project.status === 'CANCELLED';
              const isPast = isCompleted ? true : idx < currentStageIndex;
              const isCurrent = isCompleted || isCancelled ? false : idx === currentStageIndex;
              const isNext = isCompleted || isCancelled ? false : idx === currentStageIndex + 1;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center relative group">
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-4 -left-1/2 w-full h-1 -z-0 ${
                        isCancelled
                          ? 'bg-muted/80'
                          : isPast
                            ? 'bg-solar-600'
                            : 'bg-muted'
                      }`}
                    />
                  )}
                  {/* Node Circle */}
                  <div
                    onClick={() => handleStageNodeClick(s.key, idx)}
                    title={
                      isNext
                        ? `Next Milestone: Click to Advance to ${s.fullName}`
                        : `Jump to ${s.fullName} tab`
                    }
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all shadow-sm cursor-pointer hover:scale-105 ${
                      isCancelled
                        ? 'bg-muted text-muted-foreground border border-red-300 dark:border-red-900/40'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isPast
                            ? 'bg-solar-600 text-white'
                            : isCurrent
                              ? 'bg-solar-500 text-white ring-4 ring-solar-500/20'
                              : isNext
                                ? 'bg-solar-500/20 border-2 border-solar-500 text-solar-700 dark:text-solar-300 hover:bg-solar-500 hover:text-white ring-2 ring-solar-500/10 animate-pulse'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {isCompleted || isPast ? <Check className="w-5 h-5" /> : s.step}
                  </div>
                  <span
                    onClick={() => handleStageNodeClick(s.key, idx)}
                    title={s.fullName}
                    className={`mt-2 text-xs text-center font-medium line-clamp-1 max-w-[120px] hover:underline cursor-pointer ${
                      isCurrent
                        ? 'text-solar-600 font-bold'
                        : isPast || isCompleted
                          ? 'text-foreground font-semibold'
                          : isNext
                            ? 'text-solar-600 dark:text-solar-400 font-semibold'
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

        {/* Operational Guidance Banner depending on status & stage */}
        {project.status === 'CANCELLED' && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-xs mt-2">
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <span className="font-bold text-red-900 dark:text-red-200">
                Project Execution Cancelled
              </span>
              <p className="text-red-700 dark:text-red-300 text-[11px] mt-0.5">
                This project has been cancelled. All installation and field activities are halted.
              </p>
            </div>
          </div>
        )}

        {project.status === 'COMPLETED' && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-2">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  Project Successfully Commissioned &amp; Handed Over
                </span>
                <p className="text-emerald-700 dark:text-emerald-300 text-[11px] mt-0.5">
                  All 5 stages (Design, Dispatch, Physical Installation, Net Metering &amp; Handover) are complete.
                </p>
                {amcInfo && (
                  <p className="text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{amcInfo}</span>
                  </p>
                )}
              </div>
            </div>
            {!amcInfo && (
              <button
                type="button"
                onClick={handleInitializeAmc}
                disabled={initializingAmc}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>{initializingAmc ? 'Initializing...' : 'Initialize 1st-Year AMC'}</span>
              </button>
            )}
          </div>
        )}
        {project.status === 'PLANNING' && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-2">
            <div className="flex items-start sm:items-center space-x-2.5">
              <PlayCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Project is currently in PLANNING Phase — Ready for Mobilization
                </span>
                <p className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">
                  Click <strong>&quot;Start Project&quot;</strong> to activate the 5-Stage EPC Pipeline and proceed through Design, Dispatch, Installation, Net Metering, and Handover.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setTargetStatus('IN_PROGRESS');
                setStatusModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Project Now</span>
            </button>
          </div>
        )}

        {project.status === 'IN_PROGRESS' && (
          <div className="p-3 bg-solar-500/10 border border-solar-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-2">
            <div className="flex items-center space-x-2.5">
              <Zap className="w-4 h-4 text-solar-600 shrink-0" />
              <div>
                <span className="font-bold text-solar-900 dark:text-solar-200">
                  Active Milestone {currentStageIndex + 1}/5: {FIVE_STAGES[currentStageIndex]?.fullName}
                </span>
                <span className="text-muted-foreground ml-2 hidden sm:inline">
                  &bull; {FIVE_STAGES[currentStageIndex]?.description}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {currentStageIndex < FIVE_STAGES.length - 1 && (
                <button
                  onClick={() => {
                    setTargetStage(FIVE_STAGES[currentStageIndex + 1]?.key || '');
                    setStageModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Advance to Stage {currentStageIndex + 2} ({FIVE_STAGES[currentStageIndex + 1]?.label})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7 First-Class Tabs + History Navigation */}
      <div className="border-b flex items-center gap-1 sm:gap-4 text-xs sm:text-sm font-medium pb-0.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleSelectTab('overview')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Overview &amp; Milestones</span>
        </button>

        <button
          onClick={() => handleSelectTab('dispatch')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'dispatch'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Material Dispatch</span>
        </button>

        <button
          onClick={() => handleSelectTab('checklist')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'checklist'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Installation Checklist</span>
        </button>

        <button
          onClick={() => handleSelectTab('photos')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'photos'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Site Photos &amp; Barcodes</span>
        </button>

        <button
          onClick={() => handleSelectTab('net-metering')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'net-metering'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Net-Metering</span>
        </button>

        <button
          onClick={() => handleSelectTab('subsidy')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'subsidy'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Subsidy &amp; PM Surya Ghar</span>
        </button>

        <button
          onClick={() => handleSelectTab('costing')}
          className={`shrink-0 whitespace-nowrap pb-2.5 sm:pb-3 border-b-2 flex items-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer ${
            activeTab === 'costing'
              ? 'border-solar-600 text-solar-600 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          <span>Project Costing</span>
        </button>
      </div>

      {/* Tab 1: Overview, Milestones & Tasks */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 3 Metric / Info Cards */}
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-solar-600" /> Schedule & Leadership
                </h3>
                {!isTerminal && (
                  <button
                    type="button"
                    onClick={handleOpenAssignTeamModal}
                    className="text-xs font-bold text-solar-600 hover:text-solar-700 hover:underline cursor-pointer"
                  >
                    Manage Team &amp; Dates
                  </button>
                )}
              </div>
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
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Project Manager:</span>
                  <span className="font-medium text-foreground flex items-center">
                    <UserIcon className="w-3.5 h-3.5 mr-1 text-solar-500" />
                    {project.projectManagerId
                      ? `${project.projectManagerId.firstName} ${project.projectManagerId.lastName}`
                      : 'Unassigned'}
                  </span>
                </div>
                <div className="pt-1 space-y-1.5">
                  <span className="text-muted-foreground text-xs block">Assigned Field Crew / Installers:</span>
                  {project.teamMemberIds && project.teamMemberIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {project.teamMemberIds.map((m: any) => (
                        <span
                          key={m._id || m}
                          className="px-2 py-0.5 rounded-full bg-solar-500/10 text-solar-800 text-[11px] font-medium border border-solar-500/20 flex items-center gap-1"
                        >
                          <UserIcon className="w-3 h-3 text-solar-600" />
                          {m.firstName ? `${m.firstName} ${m.lastName}` : 'Technician'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No technicians assigned yet. Click &quot;Manage Team &amp; Dates&quot; to assign crew.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Project Quality Milestones & Action Tasks Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Milestones Column */}
            <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-solar-600" />
                    <span>Quality Milestones ({project.milestones?.length || 0})</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Quality gates & operational sign-offs</p>
                </div>
                {!isTerminal && (
                  <button
                    onClick={() => {
                      setMilestoneModalError(null);
                      setNewMilestoneData({
                        name: '',
                        description: '',
                        displayOrder: (project.milestones?.length || 0) + 1,
                        targetDueDate: ''
                      });
                      setAddMilestoneModalOpen(true);
                    }}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </button>
                )}
              </div>

              <div className="divide-y max-h-[500px] overflow-y-auto">
                {project.milestones && project.milestones.length > 0 ? (
                  project.milestones.map(m => (
                    <div key={m._id} className="py-3 first:pt-0 last:pb-0 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                            {m.displayOrder}
                          </span>
                          <span className="font-semibold text-foreground text-xs truncate">{m.name}</span>
                          {getMilestoneStatusBadge(m.status)}
                        </div>
                        {!isTerminal && (
                          <div className="flex items-center space-x-1 shrink-0">
                            {m.status === 'NOT_STARTED' && (
                              <button
                                onClick={() => {
                                  setSelectedMilestone(m);
                                  setMilestoneTargetStatus('IN_PROGRESS');
                                  setMilestoneBlockerReason('');
                                  setMilestoneModalError(null);
                                  setMilestoneStatusModalOpen(true);
                                }}
                                className="px-2 py-0.5 text-[11px] rounded border bg-background hover:bg-muted font-medium"
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
                                    setMilestoneModalError(null);
                                    setMilestoneStatusModalOpen(true);
                                  }}
                                  className="px-2 py-0.5 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedMilestone(m);
                                    setMilestoneTargetStatus('BLOCKED');
                                    setMilestoneBlockerReason('');
                                    setMilestoneModalError(null);
                                    setMilestoneStatusModalOpen(true);
                                  }}
                                  className="px-2 py-0.5 text-[11px] rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium"
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
                                  setMilestoneModalError(null);
                                  setMilestoneStatusModalOpen(true);
                                }}
                                className="px-2 py-0.5 text-[11px] rounded border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {m.description && <p className="text-[11px] text-muted-foreground pl-7 mt-0.5">{m.description}</p>}
                      {m.status === 'BLOCKED' && m.blockerReason && (
                        <div className="ml-7 mt-1.5 p-1.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-start gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                          <span><strong>Blocker:</strong> {m.blockerReason}</span>
                        </div>
                      )}
                      {m.status === 'COMPLETED' && m.completedAt && (
                        <div className="ml-7 mt-1 text-[10px] text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Signed off on {new Date(m.completedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No milestones configured.
                  </div>
                )}
              </div>
            </div>

            {/* Tasks Column */}
            <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-solar-600" />
                    <span>Project Tasks ({tasks.length})</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Operational tasks & site assignments</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={taskFilterStatus}
                    onChange={e => setTaskFilterStatus(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border bg-background text-foreground"
                  >
                    <option value="ALL">All Status</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskOnlyOverdue}
                      onChange={e => setTaskOnlyOverdue(e.target.checked)}
                      className="rounded text-solar-600 focus:ring-solar-500"
                    />
                    <span>Overdue</span>
                  </label>
                  {!isTerminal && (
                    <button
                      onClick={() => {
                        setTaskModalError(null);
                        setAddTaskModalOpen(true);
                      }}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-solar-600 text-white hover:bg-solar-700 text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> New Task
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y max-h-[500px] overflow-y-auto">
                {tasksLoading ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">Loading tasks...</div>
                ) : tasks.length > 0 ? (
                  tasks.map(task => {
                    const isOverdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      !['COMPLETED', 'CANCELLED'].includes(task.status);
                    return (
                      <div key={task._id} className="py-3 first:pt-0 last:pb-0 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground shrink-0">{task.taskCode}</span>
                            <span className="font-semibold text-foreground text-xs truncate">{task.title}</span>
                            {getTaskStatusBadge(task.status)}
                            {isOverdue && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Overdue</span>
                            )}
                          </div>
                          {!isTerminal && task.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleQuickTaskStatus(task._id, 'COMPLETED')}
                              className="px-2 py-0.5 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium shrink-0"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                        {task.description && <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                          {task.dueDate && (
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" /> Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignedUserId && (
                            <span className="flex items-center">
                              <UserIcon className="w-3 h-3 mr-1" /> {task.assignedUserId.firstName} {task.assignedUserId.lastName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">No tasks matching criteria.</div>
                )}
              </div>
            </div>
          </div>

          {/* Lifecycle & Stage Transition Audit History (Integrated in Overview) */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-solar-600" />
              <span>Lifecycle &amp; Stage Transition History ({project.stageHistory?.length || 0})</span>
            </h2>
            {project.stageHistory && project.stageHistory.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-muted">
                {project.stageHistory.map((item, idx) => {
                  const stageInfo = getStageDisplayInfo(item.stage);
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
                            {item.transitionedAt
                              ? new Date(item.transitionedAt).toLocaleString()
                              : new Date().toLocaleDateString()}
                          </span>
                        </div>
                        {item.transitionedBy && (
                          <div className="text-xs text-muted-foreground">
                            Updated by{' '}
                            {typeof item.transitionedBy === 'object'
                              ? `${item.transitionedBy.firstName || ''} ${item.transitionedBy.lastName || ''}`.trim()
                              : 'System Administrator'}
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

      {/* Tab 2: Material Dispatch */}
      {activeTab === 'dispatch' && (
        <MaterialDispatchTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab 3: Site Installation Checklist */}
      {activeTab === 'checklist' && (
        <InstallationChecklistTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab 4: Statutory Site Photos & Barcodes */}
      {activeTab === 'photos' && (
        <ProjectSitePhotosTab
          projectId={project._id}
          customerId={(project.customerId as any)?._id || (project.customerId as any)?.id || project.customerId}
          customerName={(project.customerId as any)?.name || (project.customerId as any)?.legalName}
          projectCode={project.projectCode}
          isTerminal={isTerminal}
        />
      )}

      {/* Tab 5: DISCOM Net-Metering */}
      {activeTab === 'net-metering' && (
        <NetMeteringTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab 6: PM Surya Ghar Subsidy Claim */}
      {activeTab === 'subsidy' && (
        <SubsidyTab projectId={project._id} isTerminal={isTerminal} />
      )}

      {/* Tab 7: Project Costing & Margin */}
      {activeTab === 'costing' && (
        <ProjectCostingTab projectId={project._id} />
      )}

      {/* Project Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Confirm Status Transition</h3>
            <p className="text-sm text-muted-foreground">
              Transition project{' '}
              <span className="font-mono font-bold text-foreground">{project.projectCode}</span> to{' '}
              <span className="font-semibold text-solar-600">{targetStatus}</span>?
            </p>

            {statusModalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-semibold">
                {statusModalError}
              </div>
            )}

            {targetStatus === 'COMPLETED' && (
              <div className="space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Stage 5 Commissioning &amp; Customer Handover Verification
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Initial Generation Reading (kWh)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={generationReadingKwh}
                    onChange={e => setGenerationReadingKwh(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Customer / Authorised Signatory Name
                  </label>
                  <input
                    type="text"
                    value={customerSignOffName}
                    onChange={e => setCustomerSignOffName(e.target.value)}
                    placeholder="Name of person signing JCR / handover"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-1.5 text-foreground"
                  />
                </div>
                <label className="flex items-center space-x-2 text-xs font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customerHandoverSignedOff}
                    onChange={e => setCustomerHandoverSignedOff(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Customer Handover &amp; Joint Commissioning Report (JCR) Signed Off</span>
                </label>
              </div>
            )}

            {['ON_HOLD', 'CANCELLED'].includes(targetStatus) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={e => {
                    setStatusReason(e.target.value);
                    if (statusModalError) setStatusModalError(null);
                  }}
                  placeholder={`Provide mandatory operational justification for ${targetStatus}...`}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-solar-500"
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStatusModalOpen(false);
                  setStatusModalError(null);
                }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Advance Installation Stage</h3>
            
            {stageModalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-semibold">
                {stageModalError}
              </div>
            )}

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
                  {FIVE_STAGES.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {targetStage === 'STAGE_5_HANDOVER_COMMISSIONING' && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>EPC Quality &amp; Safety Gate Notice</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Advancing to <strong>Stage 5 (Plant Commissioning &amp; Handover)</strong> verifies that physical installation, rooftop cabling, and earthing checklists are marked <strong>PASSED</strong> in the <em>Installation Checklist</em> tab.
                  </p>
                </div>
              )}

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
                onClick={() => {
                  setStageModalOpen(false);
                  setStageModalError(null);
                }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">
              {milestoneTargetStatus === 'BLOCKED'
                ? 'Report Milestone Blocker'
                : 'Sign-off Milestone'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Milestone:{' '}
              <span className="font-semibold text-foreground">{selectedMilestone.name}</span>
            </p>

            {milestoneModalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-semibold">
                {milestoneModalError}
              </div>
            )}

            {milestoneTargetStatus === 'BLOCKED' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Blocker Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={milestoneBlockerReason}
                  onChange={e => {
                    setMilestoneBlockerReason(e.target.value);
                    if (milestoneModalError) setMilestoneModalError(null);
                  }}
                  placeholder="Specify blocker reason (e.g., DISCOM approval pending, site access denied)..."
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMilestoneStatusModalOpen(false);
                  setMilestoneModalError(null);
                }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Add Custom Milestone</h3>

            {milestoneModalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-semibold">
                {milestoneModalError}
              </div>
            )}

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
                  onClick={() => {
                    setAddMilestoneModalOpen(false);
                    setMilestoneModalError(null);
                  }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Create Project Task</h3>

            {taskModalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-semibold">
                {taskModalError}
              </div>
            )}

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
                  onClick={() => {
                    setAddTaskModalOpen(false);
                    setTaskModalError(null);
                  }}
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
      {/* Manage Team & Dates Modal */}
      {assignTeamModalOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-solar-600" />
                <h3 className="text-base font-bold text-foreground">
                  Assign Project Team &amp; Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignTeamModalOpen(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {assignError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                {assignError}
              </div>
            )}

            <form onSubmit={handleSaveTeamAndSchedule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Project Manager
                </label>
                <select
                  value={assignPmId}
                  onChange={e => setAssignPmId(e.target.value)}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                >
                  <option value="">-- Unassigned (No PM) --</option>
                  {employeesList.map((emp: any) => {
                    const u = emp.userId || emp;
                    const uId = u._id || emp._id;
                    const name = u.firstName ? `${u.firstName} ${u.lastName || ''}` : emp.fullName || 'Employee';
                    return (
                      <option key={uId} value={uId}>
                        {name} ({emp.designation || emp.department || 'Staff'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Assign Field Crew / Technicians (Installer Panel Scoping)
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Assigned technicians will see this project in their Field Operations / Assigned Projects workstation.
                </p>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1.5 bg-muted/20">
                  {employeesList.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-1">No employee records loaded.</p>
                  ) : (
                    employeesList.map((emp: any) => {
                      const u = emp.userId || emp;
                      const uId = u._id || emp._id;
                      const name = u.firstName ? `${u.firstName} ${u.lastName || ''}` : emp.fullName || 'Employee';
                      const isChecked = assignTeamIds.includes(uId);

                      return (
                        <label
                          key={uId}
                          className="flex items-center space-x-2 text-xs p-1.5 rounded hover:bg-muted cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTeamMember(uId)}
                            className="rounded border-input text-solar-600 focus:ring-solar-500"
                          />
                          <span className="font-medium text-foreground">{name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({emp.designation || emp.department || 'Crew'})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={e => setEditTargetDate(e.target.value)}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Installation Site Street Address
                </label>
                <input
                  type="text"
                  value={editAddress.addressLine1}
                  onChange={e => setEditAddress({ ...editAddress, addressLine1: e.target.value })}
                  placeholder="Street / Building Address Line 1"
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 text-foreground"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">City</label>
                  <input
                    type="text"
                    value={editAddress.city}
                    onChange={e => setEditAddress({ ...editAddress, city: e.target.value })}
                    className="w-full text-xs rounded-lg border bg-background px-2.5 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">State</label>
                  <input
                    type="text"
                    value={editAddress.state}
                    onChange={e => setEditAddress({ ...editAddress, state: e.target.value })}
                    className="w-full text-xs rounded-lg border bg-background px-2.5 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">PIN Code</label>
                  <input
                    type="text"
                    value={editAddress.postalCode}
                    onChange={e => setEditAddress({ ...editAddress, postalCode: e.target.value })}
                    className="w-full text-xs rounded-lg border bg-background px-2.5 py-1.5 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setAssignTeamModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-4 py-2 bg-solar-600 text-white rounded-lg text-sm font-medium hover:bg-solar-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>{assignSubmitting ? 'Saving...' : 'Save Assignments'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
