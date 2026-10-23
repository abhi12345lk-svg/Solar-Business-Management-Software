import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Activity,
  Users,
  Briefcase,
  Wrench,
  Receipt,
  Headphones,
  Package,
  Globe
} from 'lucide-react';
import { SYSTEM_TITLE } from '@ins-solar/shared';

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
  const {
    data: healthData,
    isLoading,
    isError
  } = useQuery<HealthData>({
    queryKey: ['apiHealthLive'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health/live');
      if (!res.ok) throw new Error('API unreachable');
      return res.json();
    },
    refetchInterval: 30000
  });

  const plannedPanels = [
    {
      title: 'Admin Panel',
      icon: Users,
      desc: 'Executive governance, user RBAC, corporate policy, and approval thresholds.'
    },
    {
      title: 'Sales Panel',
      icon: Briefcase,
      desc: 'Lead management, rooftop site surveys, tri-topology system sizing, and quotations.'
    },
    {
      title: 'Installation Panel',
      icon: Wrench,
      desc: '10-stage field execution, QA photo checklists, testing, and utility liaison.'
    },
    {
      title: 'Accounts Panel',
      icon: Receipt,
      desc: 'Payment receipts, milestone tracking, expenses, vendor payables, and project gross profit.'
    },
    {
      title: 'Service Panel',
      icon: Headphones,
      desc: 'Customer break-fix tickets, warranty claims, AMC schedules, and field visit logs.'
    },
    {
      title: 'Inventory Panel',
      icon: Package,
      desc: 'Hardware item master, multi-location stock, atomic reservations, and shortage guards.'
    },
    {
      title: 'Customer Portal',
      icon: Globe,
      desc: 'Dedicated client self-service portal for milestone progress and quote approvals.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Foundation Status Alert Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-5">
        <div className="flex items-start space-x-3">
          <Layers className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-foreground">
              {SYSTEM_TITLE} &bull; Phase 1 Foundation Shell
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This environment is verified on the{' '}
              <strong>Node.js 24 LTS + Express 5 + React 18 + Vite</strong> architecture. In strict
              adherence to Phase 1 boundaries, no business modules, fake database collections, or
              fabricated metrics are rendered. Business workflows will be implemented sequentially
              in Phases 2 through 10.
            </p>
          </div>
        </div>
      </div>

      {/* Backend API Connectivity Probe */}
      <div className="bg-card border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-secondary text-secondary-foreground">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Backend API Gateway Connectivity</h2>
              <p className="text-xs text-muted-foreground">Probing endpoint: /api/v1/health/live</p>
            </div>
          </div>

          <div>
            {isLoading && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                Probing API...
              </span>
            )}
            {healthData?.success && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                API Online (Uptime: {healthData.data.uptimeSeconds}s)
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                API Offline (Start Backend Server)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Planned Role-Based Panels Roadmap Overview */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Planned Functional Panels</h2>
          <p className="text-xs text-muted-foreground">
            354 atomic requirements mapped across 6 internal operational panels and 1 secure
            customer portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plannedPanels.map((panel, idx) => {
            const Icon = panel.icon;
            return (
              <div
                key={idx}
                className="bg-card border rounded-lg p-4 space-y-2 hover:border-solar-500/40 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-md bg-solar-500/10 text-solar-600">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-medium">{panel.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">{panel.desc}</p>
                <div className="pt-2 flex justify-between items-center text-[11px] text-muted-foreground border-t">
                  <span>Architecture Verified</span>
                  <span className="font-mono text-solar-600">Phase 2-10</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
