import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  LogOut,
  LogIn,
  Users,
  UserCheck,
  FileSpreadsheet,
  ShoppingCart,
  Boxes,
  Building2,
  FileText,
  Receipt,
  FolderKanban,
  Zap,
  Landmark,
  Menu,
  X,
  CreditCard,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  FolderLock,
  Camera,
  LifeBuoy,
  Wrench,
  PackageCheck,
  Compass,
  SunMedium
} from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary.js';
import { useAuth } from '../../context/AuthContext.js';
import { Department, PanelType, Permission, UserRole, getDefaultPanelForRole } from '@ins-solar/shared';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  permission?: Permission;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'Commercial & CRM',
    items: [
      { to: '/leads', label: 'Leads', icon: Users, permission: 'lead:read' },
      { to: '/surveys', label: 'Site Surveys', icon: Compass, permission: 'survey:read' },
      { to: '/solar-designs', label: 'Solar PV Designs', icon: SunMedium, permission: 'design:read' },
      { to: '/quotations', label: 'Quotations', icon: FileSpreadsheet, permission: 'quote:read' },
      { to: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'order:read' },
      { to: '/customers', label: 'Customers', icon: UserCheck, permission: 'customer:read' }
    ]
  },
  {
    title: 'Projects & Liaison',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban, permission: 'project:read' },
      { to: '/net-metering', label: 'Net Metering', icon: Zap, permission: 'net_metering:read' },
      { to: '/subsidies', label: 'Subsidies', icon: Landmark, permission: 'subsidy:read' }
    ]
  },
  {
    title: 'Supply Chain',
    items: [
      { to: '/vendors', label: 'Vendors', icon: Building2, permission: 'vendor:read' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText, permission: 'po:read' },
      { to: '/goods-receipts', label: 'Goods Receipts (GRN)', icon: PackageCheck, permission: 'grn:read' },
      { to: '/inventory', label: 'Inventory', icon: Boxes, permission: 'inv:read' }
    ]
  },
  {
    title: 'Finance & Accounts',
    items: [
      { to: '/customer-invoices', label: 'Customer Invoices', icon: Receipt, permission: 'account:invoice_read' },
      { to: '/payments', label: 'Payments', icon: CreditCard, permission: 'payment:read' },
      { to: '/vendor-invoices', label: 'Vendor Bills', icon: FileSpreadsheet, permission: 'vendor_invoice:read' },
      { to: '/expenses', label: 'Expenses', icon: TrendingUp, permission: 'expense:read' }
    ]
  },
  {
    title: 'Service & Maintenance',
    items: [
      { to: '/service', label: 'Service & AMC', icon: LifeBuoy, permission: 'service:ticket_read' }
    ]
  },
  {
    title: 'Organization',
    items: [
      { to: '/employees', label: 'Employees', icon: Users, permission: 'employee:read' },
      { to: '/teams', label: 'Teams', icon: Users, permission: 'team:read' },
      { to: '/documents', label: 'Documents', icon: FolderLock, permission: 'document:read' },
      { to: '/health', label: 'System Health', icon: Wrench }
    ]
  }
];

const SALES_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'Sales Pipeline',
    items: [
      { to: '/leads', label: 'Leads', icon: Users, permission: 'lead:read' },
      { to: '/surveys', label: 'Site Surveys', icon: Compass, permission: 'survey:read' },
      { to: '/solar-designs', label: 'Solar PV Designs', icon: SunMedium, permission: 'design:read' },
      { to: '/quotations', label: 'Quotations', icon: FileSpreadsheet, permission: 'quote:read' },
      { to: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'order:read' },
      { to: '/customers', label: 'Customers', icon: UserCheck, permission: 'customer:read' }
    ]
  }
];

const ACCOUNTS_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'Billing & Inflow',
    items: [
      { to: '/customer-invoices', label: 'Customer Invoices', icon: Receipt, permission: 'account:invoice_read' },
      { to: '/payments', label: 'Payments', icon: CreditCard, permission: 'payment:read' },
      { to: '/subsidies', label: 'Subsidies', icon: Landmark, permission: 'subsidy:read' }
    ]
  },
  {
    title: 'Procurement Verification',
    items: [
      { to: '/vendors', label: 'Vendors', icon: Building2, permission: 'vendor:read' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText, permission: 'po:read' },
      { to: '/goods-receipts', label: 'Goods Receipts (GRN)', icon: PackageCheck, permission: 'grn:read' }
    ]
  },
  {
    title: 'Payables & Expenses',
    items: [
      { to: '/vendor-invoices', label: 'Vendor Bills', icon: FileSpreadsheet, permission: 'vendor_invoice:read' },
      { to: '/expenses', label: 'Expenses', icon: TrendingUp, permission: 'expense:read' }
    ]
  }
];

const INSTALLER_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Field Operations',
    items: [
      { to: '/projects', label: 'Assigned Projects', icon: FolderKanban, permission: 'project:read' },
      { to: '/site-photos', label: 'Site Photos & Barcodes', icon: Camera, permission: 'installation:read' },
      { to: '/service?tab=visits', label: 'Field Service Visits', icon: Wrench, permission: 'service:ticket_read' },
      { to: '/documents', label: 'Site Documents', icon: FolderLock, permission: 'document:read' }
    ]
  }
];

function getBreadcrumb(pathname: string, panel?: PanelType): { section: string; title: string } {
  if (pathname === '/') {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Assigned Projects' };
    if (panel === PanelType.SALES) return { section: 'Overview', title: 'Dashboard' };
    if (panel === PanelType.ACCOUNTS) return { section: 'Overview', title: 'Dashboard' };
    return { section: 'Overview', title: 'Dashboard' };
  }
  if (pathname.startsWith('/site-photos')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Site Photos & Barcodes' };
    return { section: 'Projects & Liaison', title: 'Site Photos' };
  }
  if (pathname.startsWith('/leads')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Leads' };
  if (pathname.startsWith('/surveys')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Site Surveys' };
  if (pathname.startsWith('/solar-designs')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Solar PV Designs' };
  if (pathname.startsWith('/customers')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Customer Records' };
    return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Customers' };
  }
  if (pathname.startsWith('/follow-ups')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Follow-ups' };
  if (pathname.startsWith('/quotations')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Quotations' };
  if (pathname.startsWith('/orders')) return { section: panel === PanelType.SALES ? 'Sales Pipeline' : 'Commercial & CRM', title: 'Orders' };
  if (pathname.startsWith('/projects')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Assigned Projects' };
    return { section: 'Projects & Liaison', title: 'Projects' };
  }
  if (pathname.startsWith('/net-metering')) return { section: panel === PanelType.ADMIN ? 'Projects & Liaison' : 'Projects', title: 'Net Metering' };
  if (pathname.startsWith('/subsidies'))
    return {
      section: panel === PanelType.ACCOUNTS ? 'Billing & Inflow' : 'Projects & Liaison',
      title: 'Subsidies'
    };
  if (pathname.startsWith('/inventory')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Inventory' };
    return { section: 'Supply Chain', title: 'Inventory' };
  }
  if (pathname.startsWith('/vendors')) return { section: panel === PanelType.ACCOUNTS ? 'Procurement Verification' : 'Supply Chain', title: 'Vendors' };
  if (pathname.startsWith('/purchase-orders')) return { section: panel === PanelType.ACCOUNTS ? 'Procurement Verification' : 'Supply Chain', title: 'Purchase Orders' };
  if (pathname.startsWith('/goods-receipts')) return { section: panel === PanelType.ACCOUNTS ? 'Procurement Verification' : 'Supply Chain', title: 'Goods Receipts' };
  if (pathname.startsWith('/customer-invoices'))
    return {
      section: panel === PanelType.ACCOUNTS ? 'Billing & Inflow' : 'Finance & Accounts',
      title: 'Customer Invoices'
    };
  if (pathname.startsWith('/vendor-invoices'))
    return {
      section: panel === PanelType.ACCOUNTS ? 'Payables & Expenses' : 'Finance & Accounts',
      title: 'Vendor Bills'
    };
  if (pathname.startsWith('/payments'))
    return {
      section: panel === PanelType.ACCOUNTS ? 'Billing & Inflow' : 'Finance & Accounts',
      title: 'Payments'
    };
  if (pathname.startsWith('/expenses'))
    return {
      section: panel === PanelType.ACCOUNTS ? 'Payables & Expenses' : 'Finance & Accounts',
      title: 'Expenses'
    };
  if (pathname.startsWith('/create-document') || pathname.startsWith('/documents/create'))
    return { section: 'Organization', title: 'Create Document' };
  if (pathname.startsWith('/documents') || pathname.startsWith('/document-vault')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Site Documents' };
    return { section: 'Organization', title: 'Documents' };
  }
  if (pathname.startsWith('/service') || pathname.startsWith('/complaints') || pathname.startsWith('/service-visits') || pathname.startsWith('/warranties') || pathname.startsWith('/amc')) {
    if (panel === PanelType.INSTALLER) return { section: 'Field Operations', title: 'Field Service Visits' };
    return { section: 'Service & Maintenance', title: 'Service & AMC' };
  }
  if (pathname.startsWith('/employees') || pathname.startsWith('/teams') || pathname.startsWith('/tasks')) {
    return { section: 'Organization', title: 'Employees & Team' };
  }
  if (pathname.startsWith('/customer-portal')) return { section: 'Customer', title: 'Client Portal' };
  if (pathname.startsWith('/health')) return { section: 'Organization', title: 'System Health' };
  return { section: 'Rarebox Solar', title: 'Workstation' };
}

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Strictly determine active panel from user role & department
  const activePanel: PanelType = user?.role
    ? getDefaultPanelForRole(user.role, user.department)
    : PanelType.ADMIN;

  const isInventorySpecialist =
    user?.department === Department.INVENTORY &&
    user?.role !== UserRole.SUPERADMIN &&
    user?.role !== UserRole.ADMIN &&
    user?.role !== UserRole.DEPARTMENT_HEAD;

  const rawSections =
    activePanel === PanelType.INSTALLER
      ? INSTALLER_PANEL_SECTIONS
      : activePanel === PanelType.SALES
        ? SALES_PANEL_SECTIONS
        : activePanel === PanelType.ACCOUNTS
          ? ACCOUNTS_PANEL_SECTIONS
          : ADMIN_PANEL_SECTIONS;

  const currentSections = rawSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.to === '/' && isInventorySpecialist) return false;
        if (!item.permission) return true;
        return !user || hasPermission(item.permission);
      })
    }))
    .filter(section => section.items.length > 0);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const breadcrumb = getBreadcrumb(location.pathname, activePanel);

  const renderNavContent = (isCollapsed = false) => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div
        className={`h-14 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'} border-b border-border/60 shrink-0 bg-card`}
      >
        <Link
          to={activePanel === PanelType.INSTALLER ? '/projects' : isInventorySpecialist ? '/inventory' : '/'}
          className="flex items-center space-x-2.5 group min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-amber-500 dark:text-amber-600 flex items-center justify-center shrink-0 shadow-xs border border-zinc-800/10 dark:border-zinc-200/10">
            <Sun className="w-4 h-4 stroke-[2.2]" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-[14px] tracking-tight text-foreground whitespace-nowrap">
                  Rarebox <span className="text-amber-600 dark:text-amber-500">Solar</span>
                </span>
                <span className="px-1 py-0.2 rounded text-[9px] font-mono font-semibold bg-muted text-muted-foreground border border-border/60 shrink-0">
                  ERP
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/70 font-medium whitespace-nowrap">
                Raipur Operations
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse Toggle */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:flex p-1.5 rounded-lg text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand Button when Collapsed */}
      {isCollapsed && (
        <div className="p-2 border-b border-border/60 flex justify-center">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Panel / Workstation Identity Capsule */}
      <div className={`px-3 py-2.5 shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {!isCollapsed ? (
          <div className="px-3 py-2 rounded-xl bg-secondary/40 border border-border/60">
            <div className="flex items-center space-x-2">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activePanel === PanelType.ADMIN
                    ? 'bg-zinc-700 dark:bg-zinc-300'
                    : activePanel === PanelType.SALES
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : activePanel === PanelType.INSTALLER
                        ? 'bg-amber-600 dark:bg-amber-400'
                        : 'bg-emerald-600 dark:bg-emerald-400'
                }`}
              />
              <span className="text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase truncate">
                {activePanel === PanelType.ADMIN
                  ? 'Admin Panel'
                  : activePanel === PanelType.SALES
                    ? 'Sales Panel'
                    : activePanel === PanelType.INSTALLER
                      ? 'Installer Panel'
                      : 'Accounts Panel'}
              </span>
            </div>
            <div className="text-xs font-semibold text-foreground tracking-tight mt-0.5 truncate">
              {activePanel === PanelType.ADMIN
                ? 'Management & Operations'
                : activePanel === PanelType.SALES
                  ? 'Sales Pipeline & CRM'
                  : activePanel === PanelType.INSTALLER
                    ? 'Site Photos & Installation'
                    : 'Invoices, Bills & Reconciliation'}
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border border-border/80 bg-secondary/50 text-foreground"
            title={`${activePanel} Panel Active`}
          >
            {activePanel[0]}
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav
        className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'} py-1 space-y-4 scrollbar-thin scrollbar-thumb-muted-foreground/20`}
      >
        {currentSections.map((section, idx) => (
          <div key={idx} className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.08em] pb-1 pt-1">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const ItemIcon = item.icon;

                // Mutually-exclusive active matching to prevent duplicate highlights
                const isActive = (() => {
                  if (item.to === '/') {
                    return location.pathname === '/';
                  }
                  if (item.to === '/site-photos') {
                    return location.pathname === '/site-photos';
                  }
                  if (item.to === '/create-document') {
                    return (
                      location.pathname === '/create-document' || location.pathname.startsWith('/documents/create')
                    );
                  }
                  if (item.to === '/documents') {
                    return (
                      location.pathname === '/documents' ||
                      (location.pathname.startsWith('/documents/') && !location.pathname.startsWith('/documents/create'))
                    );
                  }
                  return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                })();

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center ${
                      isCollapsed ? 'justify-center p-2 min-h-[38px]' : 'justify-between px-2.5 py-1.5 min-h-[36px]'
                    } rounded-lg text-[13px] transition-colors group ${
                      isActive
                        ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground/80 hover:bg-secondary/50 hover:text-foreground font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {!isCollapsed && isActive && (
                        <span className="w-1 h-3.5 rounded-full bg-amber-500 shrink-0 -ml-0.5" />
                      )}
                      <ItemIcon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground/70 group-hover:text-foreground'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer User Anchor Card */}
      <div className={`p-3 border-t border-border/60 shrink-0 bg-card/60 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-secondary border border-border/80 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                {user?.firstName ? user.firstName[0] : 'S'}
                {user?.lastName ? user.lastName[0] : 'O'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">
                  {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User' : 'Operator'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase truncate">
                  {user?.role || activePanel}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-secondary transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* 1. Desktop Left Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } flex-col fixed inset-y-0 left-0 z-40 bg-card border-r border-border/60 shadow-xs transition-all duration-200`}
      >
        {renderNavContent(sidebarCollapsed)}
      </aside>

      {/* 2. Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-card border-r border-border shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:bg-secondary active:scale-95"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavContent(false)}
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div
        className={`flex-1 ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        } flex flex-col min-h-screen min-w-0 transition-all duration-200`}
      >
        {/* Top Navbar Header */}
        <header className="h-14 sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/60 flex items-center justify-between px-3 sm:px-6">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center space-x-2 text-xs font-medium truncate">
              <span className="text-muted-foreground/70 hidden sm:inline truncate">
                {breadcrumb.section}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 hidden sm:inline shrink-0" />
              <span className="text-foreground font-semibold truncate">{breadcrumb.title}</span>
              <span className="ml-1.5 hidden xs:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-secondary text-muted-foreground border border-border/60">
                {activePanel}
              </span>
            </div>
          </div>

          {/* Right: Simple & Clean (Mobile Sign Out) */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Mobile-Only Sign Out (On desktop, user profile & logout are cleanly in sidebar bottom) */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="lg:hidden p-1.5 rounded-lg text-muted-foreground/70 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-7xl mx-auto min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
