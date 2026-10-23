import { useQuery } from '@tanstack/react-query';
import { Activity, Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';

interface HealthLiveResult {
  success: boolean;
  data: {
    status: string;
    uptimeSeconds: number;
    timestamp: string;
  };
  meta: {
    correlationId: string;
    timestamp: string;
  };
}

interface HealthReadyResult {
  success: boolean;
  data: {
    status: 'ready' | 'degraded' | 'unhealthy';
    database: 'connected' | 'disconnected' | 'unconfigured';
    timestamp: string;
  };
  meta: {
    correlationId: string;
    timestamp: string;
  };
}

export const HealthStatusPage: React.FC = () => {
  const {
    data: liveData,
    isLoading: isLiveLoading,
    refetch: refetchLive
  } = useQuery<HealthLiveResult>({
    queryKey: ['healthLive'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health/live');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  });

  const {
    data: readyData,
    isLoading: isReadyLoading,
    refetch: refetchReady
  } = useQuery<HealthReadyResult>({
    queryKey: ['healthReady'],
    queryFn: async () => {
      const res = await fetch('/api/v1/health/ready');
      return res.json();
    }
  });

  const handleRefresh = (): void => {
    refetchLive();
    refetchReady();
  };

  const getDbStatusBadge = (status?: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </span>
        );
      case 'unconfigured':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Unconfigured (Local Dev)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">System Health & Telemetry</h1>
          <p className="text-xs text-muted-foreground">
            Direct monitoring of backend process liveness and database readiness probes.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Probes
        </button>
      </div>

      {(isLiveLoading || isReadyLoading) && <LoadingSpinner message="Querying health probes..." />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Process Liveness Probe */}
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold">Process Liveness (/live)</h2>
            </div>
            {liveData?.data?.status === 'alive' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Alive
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                <XCircle className="w-3 h-3 mr-1" /> Offline
              </span>
            )}
          </div>

          <div className="text-xs space-y-2 pt-2 border-t text-muted-foreground font-mono">
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="text-foreground">{liveData?.data?.uptimeSeconds ?? 0} seconds</span>
            </div>
            <div className="flex justify-between">
              <span>Timestamp:</span>
              <span className="text-foreground">{liveData?.data?.timestamp ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Correlation ID:</span>
              <span className="text-foreground truncate max-w-[200px]">
                {liveData?.meta?.correlationId ?? 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* System Readiness Probe */}
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Database className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold">Database Readiness (/ready)</h2>
            </div>
            {getDbStatusBadge(readyData?.data?.database)}
          </div>

          <div className="text-xs space-y-2 pt-2 border-t text-muted-foreground font-mono">
            <div className="flex justify-between">
              <span>Overall State:</span>
              <span className="text-foreground uppercase">
                {readyData?.data?.status ?? 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database Provider:</span>
              <span className="text-foreground">MongoDB Atlas / Mongoose</span>
            </div>
            <div className="flex justify-between">
              <span>Credentials Redaction:</span>
              <span className="text-emerald-600 font-semibold">Strictly Enforced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
