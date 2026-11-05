/**
 * INS Solar ERP — Unified Role-Based Dashboard Header
 * Provides contextual role identity, multi-panel executive view switching (for Admins),
 * and standard date range filtering.
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Landmark,
  HardHat
} from 'lucide-react';
import { PanelType } from '@ins-solar/shared';
import { DateFilterRange, DATE_FILTER_OPTIONS } from './dashboardUtils.js';

interface DashboardHeaderProps {
  currentView: PanelType;
  onViewChange: (panel: PanelType) => void;
  canSwitchView: boolean;
  dateRange: DateFilterRange;
  onDateRangeChange: (range: DateFilterRange) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentView,
  onViewChange,
  canSwitchView,
  dateRange,
  onDateRangeChange,
  isRefreshing = false,
  onRefresh
}) => {
  // Panel configuration details
  const panelMeta = {
    [PanelType.ADMIN]: {
      badge: 'Executive Control Room',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
      gradient: 'from-slate-900 via-solar-950 to-slate-900 border-solar-500/30',
      title: 'Executive Operations Control Center',
      desc: 'Company-wide oversight across commercial pipeline, 10-stage project delivery, supply chain inventory, and statutory compliance.',
      icon: ShieldCheck
    },
    [PanelType.SALES]: {
      badge: 'Sales & CRM Workspace',
      badgeColor: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
      gradient: 'from-blue-950 via-slate-900 to-indigo-950 border-blue-500/30',
      title: 'Commercial & Sales Pipeline Workspace',
      desc: 'Lead qualification, prospect follow-ups, PV engineering sizing, quotation conversion, and sales order intake.',
      icon: TrendingUp
    },
    [PanelType.ACCOUNTS]: {
      badge: 'Accounts & Financial Ledger',
      badgeColor: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      gradient: 'from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/30',
      title: 'Financial & Billing Workspace',
      desc: 'Customer receivables, collection receipts, 3-way vendor match, project costing, and operational expenses.',
      icon: Landmark
    },
    [PanelType.INSTALLER]: {
      badge: 'Field Installation Hub',
      badgeColor: 'bg-solar-500/20 text-solar-200 border-solar-400/30',
      gradient: 'from-amber-950 via-slate-900 to-orange-950 border-solar-500/30',
      title: 'Field Installation & Commissioning Workstation',
      desc: 'Mobile-first field execution hub for recording solar component serials, barcode scans, GPS geotagging, and site photographs.',
      icon: HardHat
    }
  }[currentView];

  const CurrentIcon = panelMeta.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${panelMeta.gradient} border p-5 sm:p-7 text-white shadow-xl transition-all`}
    >
      {/* Decorative backdrop light */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-solar-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Department Identity & Scope */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-xs ${panelMeta.badgeColor}`}
            >
              <CurrentIcon className="w-3.5 h-3.5 mr-1.5" />
              {panelMeta.badge}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/90 border border-white/20">
              <Sparkles className="w-3 h-3 mr-1 text-solar-300" />
              Live ERP Ledger
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            {panelMeta.title}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{panelMeta.desc}</p>
        </div>

        {/* Right: Controls (Panel Switcher + Date Range + Refresh) */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          {/* Executive Multi-Panel Switcher (Superadmin & Admin only) */}
          {canSwitchView && (
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/15 backdrop-blur-md">
              <button
                type="button"
                onClick={() => onViewChange(PanelType.ADMIN)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentView === PanelType.ADMIN
                    ? 'bg-solar-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch to Admin Dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange(PanelType.SALES)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentView === PanelType.SALES
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch to Sales Dashboard"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sales</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange(PanelType.ACCOUNTS)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentView === PanelType.ACCOUNTS
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch to Accounts Dashboard"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Accounts</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange(PanelType.INSTALLER)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === PanelType.INSTALLER
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch to Installer Field Panel"
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>Installer</span>
              </button>
            </div>
          )}

          {/* Date Range Selector & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <select
                value={dateRange}
                onChange={e => onDateRangeChange(e.target.value as DateFilterRange)}
                className="w-full sm:w-auto appearance-none pl-8 pr-7 py-1.5 rounded-xl bg-black/40 border border-white/20 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-solar-500/50 hover:bg-black/60 transition-colors cursor-pointer"
                aria-label="Filter by date range"
              >
                {DATE_FILTER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400 text-[10px]">
                ▼
              </div>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white transition-all disabled:opacity-50"
                title="Refresh dashboard data"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-solar-400' : ''}`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
