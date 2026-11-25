import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FolderKanban,
  Search,
  Plus,
  ArrowRight,
  AlertTriangle,
  Calendar,
  Zap,
  User as UserIcon,
  CheckCircle2,
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Flame
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '@ins-solar/shared';

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
  siteAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
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

export interface SimplifiedStageInfo {
  step: number;
  key: string;
  shortLabel: string;
  label: string;
  fullName: string;
  description: string;
}

export const FIVE_STAGES: SimplifiedStageInfo[] = [
  {
    step: 1,
    key: 'STAGE_1_DESIGN_APPROVAL',
    shortLabel: 'Design & Approval',
    label: 'Design & DISCOM Approval',
    fullName: 'Stage 1: Engineering Design & DISCOM Approval',
    description: 'Site layout, electrical SLD, and DISCOM net-metering portal application'
  },
  {
    step: 2,
    key: 'STAGE_2_MATERIAL_DISPATCH',
    shortLabel: 'Material Dispatch',
    label: 'Material Dispatch',
    fullName: 'Stage 2: BOM & Hardware Site Dispatch',
    description: 'Dispatch solar modules, string inverter, mounting structure & BOS from warehouse'
  },
  {
    step: 3,
    key: 'STAGE_3_SITE_INSTALLATION',
    shortLabel: 'Site Installation',
    label: 'Site Installation & Wiring',
    fullName: 'Stage 3: Physical Rooftop Installation, Cabling & Earthing',
    description: 'Civil structure mounting, panel clamping, inverter installation, DC/AC cabling & earthing'
  },
  {
    step: 4,
    key: 'STAGE_4_NET_METER_SYNC',
    shortLabel: 'DISCOM Net Meter',
    label: 'DISCOM Net Meter Sync',
    fullName: 'Stage 4: DISCOM Inspection & Bi-Directional Meter Installation',
    description: 'DISCOM site inspection, solar bi-directional net meter installation & utility grid synchronization'
  },
  {
    step: 5,
    key: 'STAGE_5_HANDOVER_COMMISSIONING',
    shortLabel: 'Handover & COD',
    label: 'Commissioning & Handover',
    fullName: 'Stage 5: Plant Commissioning, Customer Handover & Subsidy Claim',
    description: 'Plant energization, customer Joint Commissioning Report (JCR) sign-off & PM Surya Ghar subsidy claim'
  }
];

export function getSimplifiedStage(stageKey: string): SimplifiedStageInfo {
  switch (stageKey) {
    case 'STAGE_1_ENGINEERING_DESIGN':
    case 'STAGE_1_DESIGN_APPROVAL':
    case 'STAGE_2_NET_METERING_APPLY':
      return FIVE_STAGES[0]!;

    case 'STAGE_3_MATERIAL_DISPATCH':
    case 'STAGE_2_MATERIAL_DISPATCH':
      return FIVE_STAGES[1]!;

    case 'STAGE_4_CIVIL_STRUCTURE':
    case 'STAGE_5_MODULE_DC_CABLING':
    case 'STAGE_6_INVERTER_ACDB':
    case 'STAGE_7_EARTHING_LIGHTNING':
    case 'STAGE_8_TESTING_PRE_COMMISSION':
    case 'STAGE_3_SITE_INSTALLATION':
      return FIVE_STAGES[2]!;

    case 'STAGE_9_DISCOM_METER_INSTALL':
    case 'STAGE_4_NET_METER_SYNC':
      return FIVE_STAGES[3]!;

    case 'STAGE_10_COMMISSION_HANDOVER':
    case 'STAGE_5_HANDOVER_COMMISSIONING':
      return FIVE_STAGES[4]!;

    default:
      return FIVE_STAGES[0]!;
  }
}

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStage = searchParams.get('stage') || 'ALL';

  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState<string>(initialStage);
  const [topologyFilter, setTopologyFilter] = useState('ALL');
  const [pmFilter, setPmFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync state if URL search param changes
  useEffect(() => {
    const stageFromUrl = searchParams.get('stage');
    if (stageFromUrl && stageFromUrl !== stageFilter) {
      setStageFilter(stageFromUrl);
    } else if (!stageFromUrl && stageFilter !== 'ALL') {
      setStageFilter('ALL');
    }
  }, [searchParams]);

  const handleStageFilterChange = (val: string) => {
    setStageFilter(val);
    const newParams = new URLSearchParams(searchParams);
    if (val === 'ALL') {
      newParams.delete('stage');
    } else {
      newParams.set('stage', val);
    }
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setTopologyFilter('ALL');
    setPmFilter('ALL');
    setCityFilter('ALL');
    setOverdueOnly(false);
    handleStageFilterChange('ALL');
    setCurrentPage(1);
  };

  const isAnyFilterActive =
    search.trim() !== '' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    stageFilter !== 'ALL' ||
    topologyFilter !== 'ALL' ||
    pmFilter !== 'ALL' ||
    cityFilter !== 'ALL' ||
    overdueOnly;

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
      const res = await apiClient<{ projects: ProjectListItem[]; total: number }>(
        '/projects?limit=100'
      );
      setAllProjects(res?.projects || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openNewProjectModal = async () => {
    setIsModalOpen(true);
    try {
      const [custRes, ordRes] = await Promise.all([
        apiClient<any>('/customers?limit=100').catch(() => []),
        apiClient<any>('/orders?limit=100').catch(() => [])
      ]);
      const custs = Array.isArray(custRes) ? custRes : custRes?.customers || custRes?.items || custRes?.data || [];
      const ords = Array.isArray(ordRes) ? ordRes : ordRes?.items || ordRes?.orders || ordRes?.data || [];
      setCustomersList(custs);
      setOrdersList(ords);
      return { custs, ords };
    } catch {
      return { custs: [], ords: [] };
    }
  };

  // Auto-open modal when customerId or orderId is present in URL search params
  useEffect(() => {
    const custId = searchParams.get('customerId');
    const ordId = searchParams.get('orderId');
    const custName = searchParams.get('customerName');
    if (custId || ordId) {
      openNewProjectModal().then(data => {
        setFormData(prev => {
          const updated = { ...prev };
          if (custId) updated.customerId = custId;
          if (ordId) {
            updated.orderId = ordId;
            const matchedOrder = data?.ords?.find((o: any) => o._id === ordId || o.id === ordId);
            if (matchedOrder) {
              updated.customerId =
                matchedOrder.customerId?._id ||
                matchedOrder.customerId?.id ||
                matchedOrder.customerId ||
                updated.customerId;
              if (matchedOrder.systemCapacityKwp) {
                updated.systemCapacityKwp = String(matchedOrder.systemCapacityKwp);
              }
              if (matchedOrder.systemTopology) {
                updated.systemTopology = matchedOrder.systemTopology;
              }
            }
          }
          if (custName && !updated.name) {
            updated.name = `Solar Installation - ${custName}`;
          }
          return updated;
        });
      });
    }
  }, [searchParams]);

  const handleOrderSelect = (orderId: string) => {
    setFormData(prev => ({ ...prev, orderId }));
    const selectedOrder = ordersList.find(o => o._id === orderId);
    if (selectedOrder) {
      setFormData(prev => ({
        ...prev,
        orderId,
        customerId: selectedOrder.customerId?._id || selectedOrder.customerId || prev.customerId,
        systemCapacityKwp: selectedOrder.systemCapacityKwp
          ? String(selectedOrder.systemCapacityKwp)
          : prev.systemCapacityKwp,
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
        systemCapacityKwp: formData.systemCapacityKwp
          ? Number(formData.systemCapacityKwp)
          : undefined,
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

  // Derive dynamic options for PM and City filters from loaded projects
  const availablePMs = useMemo(() => {
    const pmsMap = new Map<string, string>();
    allProjects.forEach(p => {
      if (p.projectManagerId?._id) {
        const name = `${p.projectManagerId.firstName || ''} ${p.projectManagerId.lastName || ''}`.trim() || p.projectManagerId.email;
        pmsMap.set(p.projectManagerId._id, name);
      }
    });
    return Array.from(pmsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [allProjects]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    allProjects.forEach(p => {
      if (p.siteAddress?.city) {
        cities.add(p.siteAddress.city.trim());
      }
    });
    return Array.from(cities).sort();
  }, [allProjects]);

  // Compute 5 Master KPI Metrics from allProjects (Independent & Persistent)
  const kpis = useMemo(() => {
    const activeProjects = allProjects.filter(p => p.status !== 'CANCELLED' && p.status !== 'COMPLETED');
    const inExecution = allProjects.filter(p => p.status === 'IN_PROGRESS');
    const pendingDispatch = activeProjects.filter(p => {
      const stage = getSimplifiedStage(p.currentStage);
      return stage.step <= 2;
    });
    const commissioned = allProjects.filter(p => {
      const stage = getSimplifiedStage(p.currentStage);
      return p.status === 'COMPLETED' || stage.step === 5;
    });
    const totalCapacityKwp = activeProjects.reduce((sum, p) => sum + (p.systemCapacityKwp || 0), 0);

    return {
      activeCount: activeProjects.length,
      inExecutionCount: inExecution.length,
      pendingDispatchCount: pendingDispatch.length,
      commissionedCount: commissioned.length,
      totalCapacityKwp: Math.round(totalCapacityKwp * 10) / 10
    };
  }, [allProjects]);

  // Filter projects with Strict AND Logic
  const filteredProjects = useMemo(() => {
    return allProjects.filter(p => {
      // Status Filter
      if (statusFilter === 'ACTIVE_ONLY') {
        if (p.status === 'CANCELLED' || p.status === 'COMPLETED') return false;
      } else if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }

      // Stage Filter
      if (stageFilter !== 'ALL') {
        const stageInfo = getSimplifiedStage(p.currentStage);
        if (stageInfo.key !== stageFilter && p.currentStage !== stageFilter) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL' && p.priority !== priorityFilter) return false;

      // System Topology Filter
      if (topologyFilter !== 'ALL' && p.systemTopology !== topologyFilter) return false;

      // Project Manager Filter
      if (pmFilter !== 'ALL' && p.projectManagerId?._id !== pmFilter) return false;

      // Location / City Filter
      if (cityFilter !== 'ALL' && p.siteAddress?.city?.toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }

      // Overdue Filter
      if (overdueOnly) {
        if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
        if (!p.targetCompletionDate || new Date(p.targetCompletionDate).getTime() >= Date.now()) {
          return false;
        }
      }

      // Search (Project Code, Title, Customer Name, Phone, City)
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const codeMatch = p.projectCode?.toLowerCase().includes(s);
        const nameMatch = p.name?.toLowerCase().includes(s);
        const custMatch = p.customerId?.name?.toLowerCase().includes(s);
        const phoneMatch = p.customerId?.phone?.includes(s);
        const cityMatch = p.siteAddress?.city?.toLowerCase().includes(s);
        if (!codeMatch && !nameMatch && !custMatch && !phoneMatch && !cityMatch) return false;
      }

      return true;
    });
  }, [allProjects, statusFilter, stageFilter, priorityFilter, topologyFilter, pmFilter, cityFilter, overdueOnly, search]);

  // Sorting
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      if (sortBy === 'targetDate_asc') {
        return new Date(a.targetCompletionDate || 0).getTime() - new Date(b.targetCompletionDate || 0).getTime();
      }
      if (sortBy === 'targetDate_desc') {
        return new Date(b.targetCompletionDate || 0).getTime() - new Date(a.targetCompletionDate || 0).getTime();
      }
      if (sortBy === 'capacity_desc') {
        return (b.systemCapacityKwp || 0) - (a.systemCapacityKwp || 0);
      }
      if (sortBy === 'capacity_asc') {
        return (a.systemCapacityKwp || 0) - (b.systemCapacityKwp || 0);
      }
      if (sortBy === 'code_asc') {
        return (a.projectCode || '').localeCompare(b.projectCode || '');
      }
      // Default newest
      return (b.projectCode || '').localeCompare(a.projectCode || '');
    });
  }, [filteredProjects, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedProjects.slice(start, start + pageSize);
  }, [sortedProjects, safeCurrentPage, pageSize]);

  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    // Safe fallback for testing harnesses outside AuthProvider
  }
  const isInstaller = user?.role === UserRole.INSTALLATION_CREW || user?.role === UserRole.TECHNICIAN;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-solar-600" />
            <span>{isInstaller ? 'Assigned Field Projects' : 'Projects'}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {isInstaller
              ? 'Authorized rooftop installation sites, bill of materials, dispatches, and commissioning checklists.'
              : 'End-to-end solar EPC project execution, milestones, statutory approvals, and COD.'}
          </p>
        </div>
        {!isInstaller && (
          <button
            onClick={openNewProjectModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-solar-600 text-white font-medium text-sm hover:bg-solar-700 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* 5 Real Functional KPI Cards with Filter Triggers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Active Projects */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'ACTIVE_ONLY' ? 'ALL' : 'ACTIVE_ONLY');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
            statusFilter === 'ACTIVE_ONLY'
              ? 'bg-solar-500/15 border-solar-500 ring-2 ring-solar-500/20 shadow-xs'
              : 'bg-card border-border/70 hover:border-solar-500/50 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Active Projects</span>
            <FolderKanban className="w-4 h-4 text-solar-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{kpis.activeCount}</span>
            <span className="text-[11px] text-muted-foreground">in pipeline</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">Non-completed, non-cancelled</p>
        </div>

        {/* KPI 2: In Execution */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
            statusFilter === 'IN_PROGRESS'
              ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-card border-border/70 hover:border-blue-500/50 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>In Execution</span>
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {kpis.inExecutionCount}
            </span>
            <span className="text-[11px] text-muted-foreground">active work</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">Status: IN_PROGRESS</p>
        </div>

        {/* KPI 3: Pending Dispatch */}
        <div
          onClick={() => {
            if (stageFilter === 'STAGE_2_MATERIAL_DISPATCH') {
              handleStageFilterChange('ALL');
            } else {
              handleStageFilterChange('STAGE_2_MATERIAL_DISPATCH');
            }
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
            stageFilter === 'STAGE_2_MATERIAL_DISPATCH'
              ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-card border-border/70 hover:border-amber-500/50 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Pending Dispatch</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {kpis.pendingDispatchCount}
            </span>
            <span className="text-[11px] text-muted-foreground">plants</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">Stage 1 or 2 awaiting BOM</p>
        </div>

        {/* KPI 4: Commissioned Plants */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-card border-border/70 hover:border-emerald-500/50 hover:bg-muted/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Commissioned</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {kpis.commissionedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">energized</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">COD &amp; Handover signed</p>
        </div>

        {/* KPI 5: Capacity Under Execution */}
        <div
          onClick={() => {
            // Focus on projects under execution
            setStatusFilter('ACTIVE_ONLY');
            setCurrentPage(1);
          }}
          className="col-span-2 sm:col-span-1 p-4 rounded-xl border bg-card border-border/70 hover:border-solar-500/50 hover:bg-muted/40 shadow-xs transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Execution Capacity</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-foreground">{kpis.totalCapacityKwp}</span>
            <span className="text-xs font-bold text-solar-600">kWp</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">Active installation volume</p>
        </div>
      </div>

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-card border border-border/70 rounded-xl p-3.5 shadow-xs space-y-3">
        {/* Row 1: Search, Stage, Status & Primary Actions */}
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by code, title, customer, phone, or city..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-solar-500"
            />
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { label: 'All', value: 'ALL' },
              { label: 'In Progress', value: 'IN_PROGRESS' },
              { label: 'Planning', value: 'PLANNING' },
              { label: 'Completed', value: 'COMPLETED' },
              { label: 'On Hold', value: 'ON_HOLD' },
              { label: 'Cancelled', value: 'CANCELLED' }
            ].map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.value
                    ? 'bg-solar-500 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Filters & Sorts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-2 pt-1 border-t border-border/50 text-xs">
          {/* Stage Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              EPC Stage
            </label>
            <select
              value={stageFilter}
              onChange={e => handleStageFilterChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All 5 Stages</option>
              <option value="STAGE_1_DESIGN_APPROVAL">Stage 1: Design &amp; Approval</option>
              <option value="STAGE_2_MATERIAL_DISPATCH">Stage 2: Material Dispatch</option>
              <option value="STAGE_3_SITE_INSTALLATION">Stage 3: Site Installation &amp; Wiring</option>
              <option value="STAGE_4_NET_METER_SYNC">Stage 4: DISCOM Net Meter Sync</option>
              <option value="STAGE_5_HANDOVER_COMMISSIONING">Stage 5: Commissioning &amp; Handover</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={e => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent (Express)</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Topology Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              System Topology
            </label>
            <select
              value={topologyFilter}
              onChange={e => {
                setTopologyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Topologies</option>
              <option value="ON_GRID">On-Grid Solar</option>
              <option value="OFF_GRID">Off-Grid (Battery)</option>
              <option value="HYBRID">Hybrid (Grid+Battery)</option>
            </select>
          </div>

          {/* Project Manager Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Project Manager
            </label>
            <select
              value={pmFilter}
              onChange={e => {
                setPmFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Managers</option>
              {availablePMs.map(pm => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>

          {/* City Location Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              City / Location
            </label>
            <select
              value={cityFilter}
              onChange={e => {
                setCityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Cities</option>
              {availableCities.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="targetDate_asc">Target Date (Earliest)</option>
              <option value="targetDate_desc">Target Date (Latest)</option>
              <option value="capacity_desc">Capacity (High to Low)</option>
              <option value="capacity_asc">Capacity (Low to High)</option>
              <option value="code_asc">Project Code (A-Z)</option>
            </select>
          </div>

          {/* Overdue Checkbox & Clear Action */}
          <div className="col-span-2 sm:col-span-3 md:col-span-6 lg:col-span-1 flex items-center justify-between lg:flex-col lg:items-start lg:justify-end gap-1.5 pt-1 lg:pt-0">
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-foreground select-none">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={e => {
                  setOverdueOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-3.5 h-3.5 rounded border-input text-solar-600 focus:ring-solar-500 cursor-pointer"
              />
              <span className={overdueOnly ? 'text-destructive font-bold' : ''}>Overdue Only</span>
            </label>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Banner */}
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              Showing {filteredProjects.length} of {allProjects.length} projects
            </span>
            {isAnyFilterActive && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-solar-500/10 text-solar-800 dark:text-solar-300 font-medium">
                Active Filter Applied
              </span>
            )}
          </div>

          {/* Items per page selector */}
          <div className="flex items-center gap-1 text-xs">
            <span>Per page:</span>
            {[10, 25, 50].map(sz => (
              <button
                key={sz}
                onClick={() => {
                  setPageSize(sz);
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  pageSize === sz ? 'bg-secondary font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
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
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading project records...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <h3 className="font-semibold text-foreground text-base">No matching projects found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              No project records match the current filter selection. Adjust or reset your filters.
            </p>
            {isAnyFilterActive && (
              <button
                onClick={handleClearAllFilters}
                className="mt-4 px-4 py-1.5 rounded-lg bg-solar-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-solar-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs font-semibold">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Capacity &amp; System</th>
                  <th className="py-3 px-4">Stage Progress</th>
                  <th className="py-3 px-4">Schedule &amp; PM</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {paginatedProjects.map(proj => {
                  const stageInfo = getSimplifiedStage(proj.currentStage);
                  const percent = Math.round((stageInfo.step / 5) * 100);
                  const isOverdue =
                    proj.status !== 'COMPLETED' &&
                    proj.status !== 'CANCELLED' &&
                    proj.targetCompletionDate &&
                    new Date(proj.targetCompletionDate).getTime() < Date.now();

                  return (
                    <tr key={proj._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/projects/${proj._id}`}
                          className="font-semibold text-primary hover:underline font-mono text-xs block"
                        >
                          {proj.projectCode}
                        </Link>
                        <span className="font-medium text-foreground text-xs line-clamp-1">
                          {proj.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {proj.priority === 'URGENT' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                              URGENT
                            </span>
                          )}
                          {isOverdue && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-foreground">
                          {proj.customerId?.name || 'N/A'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {proj.customerId?.phone}
                        </div>
                        {proj.siteAddress?.city && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-solar-600" />
                            <span>{proj.siteAddress.city}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          {proj.systemCapacityKwp ? `${proj.systemCapacityKwp} kWp` : 'Custom'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {proj.systemTopology || 'Standard'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-foreground truncate max-w-[130px]">
                            {stageInfo.shortLabel}
                          </span>
                          <span className="text-muted-foreground font-mono font-bold">
                            {stageInfo.step}/5
                          </span>
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
                          <span>
                            Target: {new Date(proj.targetCompletionDate).toLocaleDateString()}
                          </span>
                        </div>
                        {proj.projectManagerId && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <UserIcon className="w-3 h-3" />
                            <span>
                              {proj.projectManagerId.firstName} {proj.projectManagerId.lastName}
                            </span>
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
                        {proj.status === 'PLANNING' ? (
                          <Link
                            to={`/projects/${proj._id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-lg transition-colors border border-amber-500/30"
                            title="Open project and start execution to advance through 5 stages"
                          >
                            <span>Start Project</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : proj.status === 'IN_PROGRESS' ? (
                          <Link
                            to={`/projects/${proj._id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-solar-700 dark:text-solar-300 bg-solar-500/15 hover:bg-solar-500/25 px-2.5 py-1 rounded-lg transition-colors border border-solar-500/30"
                            title={`Currently at Stage ${stageInfo.step}/5. Click to advance or inspect checklists`}
                          >
                            <span>Advance Stage</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : proj.status === 'COMPLETED' ? (
                          <Link
                            to={`/projects/${proj._id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <span>COD Complete</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <Link
                            to={`/projects/${proj._id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredProjects.length > 0 && (
          <div className="flex items-center justify-between p-3.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing{' '}
              <span className="font-semibold text-foreground">
                {(safeCurrentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(safeCurrentPage * pageSize, sortedProjects.length)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{sortedProjects.length}</span> entries
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-medium">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
                  Initialize a new installation project with 5 standard milestone planning templates.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreateProject}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
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
                      {ord.orderNumber} — {ord.customerId?.name || 'Customer'} (
                      {ord.systemCapacityKwp || 0} kWp)
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
                  placeholder="e.g. 10kW Rooftop Solar System"
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
                  {customersList.map(c => {
                    const cid = c.id || c._id;
                    return (
                      <option key={cid} value={cid}>
                        {c.name || c.legalName} ({c.customerCode || c.primaryPhone || c.phone || 'Client'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Technical Capacity & Topology */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Capacity (kWp)
                  </label>
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
                    onChange={e =>
                      setFormData({ ...formData, targetCompletionDate: e.target.value })
                    }
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
                <div className="font-semibold text-xs text-foreground">
                  Installation Site Address
                </div>
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
                  onChange={e =>
                    setFormData({ ...formData, applyDefaultMilestones: e.target.checked })
                  }
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                />
                <span>Automatically initialize standard installation milestones</span>
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
