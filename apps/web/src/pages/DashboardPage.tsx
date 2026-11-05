/**
 * INS Solar ERP — Unified Role-Based Dashboard Page
 * Automatically detects user role & departmental responsibility:
 * - Admin Panel (SUPERADMIN / ADMIN) -> Central Management Control Room
 * - Sales Panel (SALES_EXECUTIVE / SURVEYOR) -> CRM & Commercial Workspace
 * - Accounts Panel (ACCOUNTS_OFFICER) -> Financial & Billing Treasury Workspace
 * Provides an Executive View Switcher for Superadmin / Admin users to preview all 3 workspaces.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import { PanelType, getDefaultPanelForRole, UserRole } from '@ins-solar/shared';
import { DashboardHeader } from '../components/dashboard/DashboardHeader.js';
import { AdminDashboard } from '../components/dashboard/AdminDashboard.js';
import { SalesDashboard } from '../components/dashboard/SalesDashboard.js';
import { AccountsDashboard } from '../components/dashboard/AccountsDashboard.js';
import { InstallationsPage } from './InstallationsPage.js';
import { DateFilterRange } from '../components/dashboard/dashboardUtils.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Determine initial panel based on authenticated user's role and department
  const userDefaultPanel: PanelType = user?.role
    ? getDefaultPanelForRole(user.role, user.department)
    : PanelType.ADMIN;

  // Admins and Superadmins have multi-panel oversight and can toggle between all three panels
  const canSwitchView = !user || user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN;

  const [currentView, setCurrentView] = useState<PanelType>(userDefaultPanel);
  const [dateRange, setDateRange] = useState<DateFilterRange>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync currentView if user role loads after initial render
  useEffect(() => {
    if (!canSwitchView) {
      setCurrentView(userDefaultPanel);
    }
  }, [userDefaultPanel, canSwitchView]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, [queryClient]);

  return (
    <div className="space-y-6 pb-12 max-w-full overflow-x-hidden">
      {/* 1. Contextual Header with Role Identity, Multi-Panel Switcher & Date Filter */}
      <DashboardHeader
        currentView={currentView}
        onViewChange={setCurrentView}
        canSwitchView={canSwitchView}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* 2. Distinct Role-Based Dashboard View */}
      {currentView === PanelType.ADMIN && <AdminDashboard dateRange={dateRange} />}

      {currentView === PanelType.SALES && <SalesDashboard dateRange={dateRange} />}

      {currentView === PanelType.ACCOUNTS && <AccountsDashboard dateRange={dateRange} />}

      {currentView === PanelType.INSTALLER && <InstallationsPage />}
    </div>
  );
};
