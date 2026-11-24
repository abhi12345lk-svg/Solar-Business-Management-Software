/**
 * INS Solar Business Management Software — After-Sales & Asset Care Hub
 *
 * Consolidated post-commissioning lifecycle workstation:
 * - Tab 1: Service Complaints & Break-Fix Tickets (/service?tab=tickets)
 * - Tab 2: Field Technician Visits & Dispatches (/service?tab=visits)
 * - Tab 3: Serialized Hardware Asset Warranties (/service?tab=warranties)
 * - Tab 4: AMC Maintenance Contracts & Quotas (/service?tab=amc)
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { LifeBuoy, Wrench, ShieldCheck, FileCheck2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Permission, UserRole } from '@ins-solar/shared';
import { ComplaintsPage } from './ComplaintsPage.js';
import { ServiceVisitsPage } from './ServiceVisitsPage.js';
import { WarrantiesPage } from './WarrantiesPage.js';
import { AmcPage } from './AmcPage.js';

type ServiceTab = 'tickets' | 'visits' | 'warranties' | 'amc';

export const ServiceHubPage: React.FC = () => {
  const { user, isAdmin, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const projectIdParam = searchParams.get('projectId');

  const allTabs: Array<{
    id: ServiceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    permission?: Permission;
  }> = [
    { id: 'tickets', label: 'Complaints & Tickets', icon: LifeBuoy, permission: 'service:ticket_read' },
    { id: 'visits', label: 'Field Technician Visits', icon: Wrench, permission: 'service:ticket_read' },
    { id: 'warranties', label: 'Asset Warranties', icon: ShieldCheck, permission: 'warranty:read' },
    { id: 'amc', label: 'AMC Contracts', icon: FileCheck2, permission: 'service:amc_manage' }
  ];

  // Filter tabs accessible to the logged in user
  const tabs = allTabs.filter(
    tab => !tab.permission || isAdmin || hasPermission(tab.permission)
  );

  const defaultTab: ServiceTab =
    user?.role === UserRole.INSTALLATION_CREW || user?.role === UserRole.TECHNICIAN
      ? 'visits'
      : (tabs[0]?.id || 'tickets');

  const resolvedTabParam = tabParam === 'complaints' ? 'tickets' : tabParam;
  const currentTab: ServiceTab =
    resolvedTabParam && tabs.some(t => t.id === resolvedTabParam)
      ? (resolvedTabParam as ServiceTab)
      : defaultTab;

  const handleTabChange = (tab: ServiceTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-6">
      {/* Hub Master Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span>Consolidated After-Sales Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              After-Sales & Asset Care Hub
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Unified post-commissioning customer care: resolve breakdown tickets, dispatch field
              technicians, verify 25-year panel degradation warranties, and manage recurring AMC
              schedules.
            </p>
          </div>

          {projectIdParam && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
              <span className="font-semibold">Contextual View:</span>
              <span>Project #{projectIdParam.slice(-6).toUpperCase()}</span>
              <button
                type="button"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('projectId');
                  setSearchParams(nextParams);
                }}
                className="ml-auto hover:text-foreground font-bold text-sm"
                title="Clear project filter"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Synchronized Hub Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/70">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab View */}
      <div className="transition-opacity duration-200">
        {currentTab === 'tickets' && <ComplaintsPage />}
        {currentTab === 'visits' && <ServiceVisitsPage />}
        {currentTab === 'warranties' && <WarrantiesPage />}
        {currentTab === 'amc' && <AmcPage />}
      </div>
    </div>
  );
};
