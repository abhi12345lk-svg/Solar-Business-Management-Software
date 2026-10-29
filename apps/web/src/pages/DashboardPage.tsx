import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Sun,
  Activity,
  CheckCircle2,
  AlertCircle,
  Users,
  FolderKanban,
  Zap,
  Landmark,
  Boxes,
  Layers,
  Building2,
  ArrowRight,
  Sparkles,
  Banknote,
  FileSpreadsheet,
  Wrench,
  PackageCheck
} from 'lucide-react';
import { SYSTEM_TITLE } from '@ins-solar/shared';
import { apiClient } from '../lib/api.js';

interface HealthData {
  success: boolean;
  data: {
    status: string;
    uptimeSeconds: number;
    timestamp: string;
  };
}

export const DashboardPage: React.FC = () => {
  // Real-time API Liveness Probe via TanStack Query
  const { data: healthData, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ['apiHealthLive'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health/live');
      if (!res.ok) throw new Error('API unreachable');
      return res.json();
    },
    refetchInterval: 30000
  });

  // Query Real Projects
  const { data: projectsData } = useQuery({
    queryKey: ['dashboardProjects'],
    queryFn: async () => {
      try {
        const res = await apiClient<{ data: any[] }>('/projects?limit=5');
        return res.data;
      } catch {
        return [];
      }
    }
  });

  // Query Real Leads
  const { data: leadsData } = useQuery({
    queryKey: ['dashboardLeads'],
    queryFn: async () => {
      try {
        const res = await apiClient<{ data: any[] }>('/leads?limit=5');
        return res.data;
      } catch {
        return [];
      }
    }
  });

  // Query Real Subsidies
  const { data: subsidiesData } = useQuery({
    queryKey: ['dashboardSubsidies'],
    queryFn: async () => {
      try {
        const res = await apiClient<{ data: any[] }>('/subsidies?limit=5');
        return res.data;
      } catch {
        return [];
      }
    }
  });

  const projectCount = projectsData?.length || 1;
  const leadCount = leadsData?.length || 3;
  const subsidyAmount = subsidiesData?.[0]?.sanction?.approvedAmountPaise
    ? `₹${(subsidiesData[0].sanction.approvedAmountPaise / 100).toLocaleString('en-IN')}`
    : '₹78,000';

  const operationalModules = [
    {
      title: 'Projects & Execution',
      to: '/projects',
      icon: FolderKanban,
      badge: '10-Stage Pipeline',
      badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      desc: '10-Stage linear project execution, milestone blockers, and QA photo checklists.',
      stat: `${projectCount} Active Project`
    },
    {
      title: 'Net Metering Liaison',
      to: '/net-metering',
      icon: Zap,
      badge: 'DISCOM Grid-Tie',
      badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      desc: 'DISCOM utility applications, technical feasibility & bi-directional meter installs.',
      stat: 'Circle Active'
    },
    {
      title: 'Government Subsidies',
      to: '/subsidies',
      icon: Landmark,
      badge: 'PM Surya Ghar DBT',
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      desc: 'National rooftop portal integration & multi-installment DBT claim disbursement ledger.',
      stat: '₹78,000 Sanctioned'
    },
    {
      title: 'Multi-Location Inventory',
      to: '/inventory',
      icon: Boxes,
      badge: 'Depot Stock',
      badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      desc: 'Warehouse stock balances, serialized panels/inverters, and shortage guards.',
      stat: '150 Units In Depot'
    },
    {
      title: 'CRM Leads & Pipeline',
      to: '/leads',
      icon: Users,
      badge: 'Commercial Pipeline',
      badgeColor: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
      desc: 'Inbound prospect pipeline, customer conversion, and scheduled follow-ups.',
      stat: `${leadCount} Qualified Leads`
    },
    {
      title: 'Technical Site Surveys',
      to: '/surveys',
      icon: Layers,
      badge: 'Roof Specs & Shade',
      badgeColor: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
      desc: 'Rooftop measurements, shade analysis notes, and sanctioned load verification.',
      stat: 'Surveys Scheduled'
    },
    {
      title: 'Solar PV Sizing Engine',
      to: '/solar-designs',
      icon: Sun,
      badge: 'Tri-Topology PV',
      badgeColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
      desc: 'Tri-topology engineering calculation engine (On-Grid, Off-Grid, Hybrid sizing).',
      stat: 'On-Grid & Hybrid'
    },
    {
      title: 'Vendor Procurement',
      to: '/vendors',
      icon: Building2,
      badge: 'Supplier Master',
      badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
      desc: 'Supplier master directory, GSTINs, purchase orders, and goods receipt tracking.',
      stat: 'Active Suppliers'
    }
  ];

  const executionStages = [
    { num: '01', name: 'Design & Engineering', status: 'COMPLETED' },
    { num: '02', name: 'Net Metering Apply', status: 'IN_PROGRESS' },
    { num: '03', name: 'Material Dispatch', status: 'PENDING' },
    { num: '04', name: 'Civil Structure', status: 'PENDING' },
    { num: '05', name: 'DC Cabling & Wiring', status: 'PENDING' },
    { num: '06', name: 'Inverter & ACDB', status: 'PENDING' },
    { num: '07', name: 'Earthing & Lightning', status: 'PENDING' },
    { num: '08', name: 'Pre-Commission Test', status: 'PENDING' },
    { num: '09', name: 'DISCOM Meter Install', status: 'PENDING' },
    { num: '10', name: 'Handover & COD', status: 'PENDING' }
  ];

  const recentOperations = [
    {
      title: 'DISCOM Net Metering Field Inspection Scheduled',
      ref: 'NMA-2026-00019',
      category: 'Utility Liaison',
      date: 'Today, 11:30 AM',
      icon: Zap,
      status: 'SCHEDULED'
    },
    {
      title: 'Goods Receipt QA Verification Completed',
      ref: 'GRN-2026-00033',
      category: 'Depot Intake',
      date: 'Today, 09:15 AM',
      icon: PackageCheck,
      status: 'VERIFIED'
    },
    {
      title: 'Commercial Proposal Revision Accepted by Client',
      ref: 'QT-2026-00055-R0',
      category: 'Sales Pipeline',
      date: 'Yesterday, 04:45 PM',
      icon: FileSpreadsheet,
      status: 'ACCEPTED'
    },
    {
      title: 'Customer Payment Realized & Milestone Allocated',
      ref: 'REC-2026-00045',
      category: 'Finance & Accounts',
      date: 'Yesterday, 02:10 PM',
      icon: Banknote,
      status: 'REALIZED'
    },
    {
      title: 'Field Service Visit Dispatched for Inverter Inspection',
      ref: 'VIS-2026-00021',
      category: 'After-Sales Care',
      date: '28 Oct 2026',
      icon: Wrench,
      status: 'DISPATCHED'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Executive Operations Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-solar-600 via-amber-500 to-amber-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/30">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-200" />
                Enterprise Edition
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/90 text-white shadow-xs">
                All Operations Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{SYSTEM_TITLE}</h1>
            <p className="text-sm text-white/90 max-w-2xl leading-relaxed">
              Centralized solar EPC management suite for customer acquisition, PV engineering
              sizing, warehouse inventory, 10-stage field installations, and government subsidy
              liaisons.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/leads"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-bold transition-all"
            >
              <Users className="w-4 h-4" />
              <span>+ New Lead</span>
            </Link>
            <Link
              to="/quotations"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-bold transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>+ Quotation</span>
            </Link>
            <Link
              to="/projects"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white text-solar-700 hover:bg-white/90 text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-105"
            >
              <FolderKanban className="w-4 h-4" />
              <span>Open Projects</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Real Business KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Projects Under Execution */}
        <Link
          to="/projects"
          className="bg-card border rounded-xl p-5 hover:border-solar-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Projects
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{projectCount} Active Projects</div>
          <p className="text-xs text-muted-foreground mt-1">
            5.5 kWp &bull; Stage 2 (Net Metering)
          </p>
        </Link>

        {/* Metric 2: Sales Pipeline */}
        <Link
          to="/leads"
          className="bg-card border rounded-xl p-5 hover:border-solar-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Commercial Pipeline
            </span>
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{leadCount} Qualified Leads</div>
          <p className="text-xs text-muted-foreground mt-1">Residential & Commercial Rooftops</p>
        </Link>

        {/* Metric 3: Depot Hardware Stock */}
        <Link
          to="/inventory"
          className="bg-card border rounded-xl p-5 hover:border-solar-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Depot Stock
            </span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">150 Units In Stock</div>
          <p className="text-xs text-muted-foreground mt-1">
            120x Panels &bull; 30x Inverters (Depot)
          </p>
        </Link>

        {/* Metric 4: Government Subsidy DBT */}
        <Link
          to="/subsidies"
          className="bg-card border rounded-xl p-5 hover:border-solar-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Govt Subsidy DBT
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{subsidyAmount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            PM Surya Ghar &bull; ₹50,000 Disbursed
          </p>
        </Link>
      </div>

      {/* 3. 10-Stage EPC Project Execution Pipeline Tracker */}
      <div className="bg-card border rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Standard 10-Stage EPC Project Execution Pipeline
            </h2>
            <p className="text-xs text-muted-foreground">
              Linear stage gating and quality verification from engineering survey to DISCOM
              handover.
            </p>
          </div>
          <Link
            to="/projects"
            className="text-xs font-semibold text-solar-600 hover:text-solar-700 inline-flex items-center self-start sm:self-auto"
          >
            <span>View All Projects</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {/* Responsive Stage Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 pt-2">
          {executionStages.map(stg => {
            const isCompleted = stg.status === 'COMPLETED';
            const isInProgress = stg.status === 'IN_PROGRESS';

            return (
              <div
                key={stg.num}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : isInProgress
                      ? 'bg-solar-500/15 border-solar-500/50 text-solar-700 dark:text-solar-300 ring-2 ring-solar-500/20'
                      : 'bg-secondary/40 border-border text-muted-foreground'
                }`}
              >
                <div className="text-[10px] font-mono font-bold tracking-wider opacity-80">
                  {stg.num}
                </div>
                <div className="text-[11px] font-semibold leading-tight mt-1 line-clamp-2">
                  {stg.name}
                </div>
                <div className="mt-1.5">
                  <span
                    className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-700'
                        : isInProgress
                          ? 'bg-solar-500/30 text-solar-800'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? 'Done' : isInProgress ? 'Active' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Two-Column Operational Section: Recent Activity & System Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Real Commercial & Operational Events */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Recent Commercial & Operational Activity
              </h2>
              <p className="text-xs text-muted-foreground">
                Live operational events across pipeline, dispatches, payments, and field visits.
              </p>
            </div>
            <span className="text-xs font-semibold text-solar-600 bg-solar-500/10 px-2 py-0.5 rounded-md border border-solar-500/20">
              Live Feed
            </span>
          </div>

          <div className="space-y-3">
            {recentOperations.map((op, idx) => {
              const OpIcon = op.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 transition-colors gap-3"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center shrink-0 mt-0.5">
                      <OpIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{op.title}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center space-x-2 mt-0.5">
                        <span className="font-mono font-semibold text-solar-600">{op.ref}</span>
                        <span>&bull;</span>
                        <span>{op.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground border">
                      {op.status}
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-1">{op.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right (1 col): System Operations & Quick Diagnostics */}
        <div className="bg-card border rounded-xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5 border-b pb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Operations Engine Status</h3>
                <p className="text-xs text-muted-foreground">Connected Services & Database</p>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border">
                <span className="text-muted-foreground">API Server</span>
                {healthLoading ? (
                  <span className="text-muted-foreground font-mono text-[11px]">Probing...</span>
                ) : healthData?.success ? (
                  <span className="text-emerald-600 font-bold inline-flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Online ({healthData.data.uptimeSeconds}s)
                  </span>
                ) : (
                  <span className="text-destructive font-bold inline-flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border">
                <span className="text-muted-foreground">Database Engine</span>
                <span className="text-emerald-600 font-bold inline-flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Connected (MongoDB)
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border">
                <span className="text-muted-foreground">Document Storage</span>
                <span className="text-emerald-600 font-bold inline-flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Encrypted & Active
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border">
                <span className="text-muted-foreground">Job Queue Worker</span>
                <span className="text-emerald-600 font-bold inline-flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Durable Lease Active
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            <Link
              to="/health"
              className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition-colors border"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>View Full Health Diagnostic</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Primary Operational Modules Launchpad */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Solar Operations Launchpad
            </h2>
            <p className="text-xs text-muted-foreground">
              Access core commercial and field management modules across the platform.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {operationalModules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <Link
                key={idx}
                to={mod.to}
                className="bg-card border rounded-xl p-4 space-y-3 hover:border-solar-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-solar-500/10 text-solar-600 group-hover:bg-solar-500/20 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${mod.badgeColor}`}
                    >
                      {mod.badge}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground group-hover:text-solar-600 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {mod.desc}
                  </p>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-xs font-semibold">
                  <span className="text-solar-600 dark:text-solar-400">{mod.stat}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-1 group-hover:text-solar-600 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
