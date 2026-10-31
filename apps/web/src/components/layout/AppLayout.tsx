import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  LogIn,
  Users,
  Layers,
  FileSpreadsheet,
  ShoppingCart,
  Boxes,
  Building2,
  FileText,
  PackageCheck,
  Receipt,
  FolderKanban,
  Zap,
  Landmark,
  LifeBuoy,
  Wrench,
  FileCheck2,
  Menu,
  X,
  Bell,
  CheckSquare,
  CreditCard,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight
} from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary.js';
import { useAuth } from '../../context/AuthContext.js';
import { PanelType, getDefaultPanelForRole, UserRole } from '@ins-solar/shared';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Executive & Commercial',
    items: [
      { to: '/', label: 'Admin Dashboard', icon: LayoutDashboard },
      { to: '/leads', label: 'Lead & Customer CRM', icon: Users },
      { to: '/surveys', label: 'Site Surveys', icon: Layers },
      { to: '/solar-designs', label: 'Solar PV Sizing', icon: Sun },
      { to: '/quotations', label: 'Quotation Suite', icon: FileSpreadsheet },
      { to: '/orders', label: 'Sales Orders', icon: ShoppingCart }
    ]
  },
  {
    title: 'Project & Field Operations',
    items: [
      { to: '/projects', label: 'Project Management (10-Stage)', icon: FolderKanban },
      { to: '/tasks', label: 'Operational Tasks', icon: CheckSquare },
      { to: '/documents', label: 'Document Vault', icon: FileText },
      { to: '/net-metering', label: 'Net Metering Compliance', icon: Zap },
      { to: '/subsidies', label: 'Govt Subsidies (DBT)', icon: Landmark }
    ]
  },
  {
    title: 'Supply Chain & Procurement',
    items: [
      { to: '/inventory', label: 'Inventory Management', icon: Boxes },
      { to: '/vendors', label: 'Vendor Directory', icon: Building2 },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/goods-receipts', label: 'Goods Receipts (GRN)', icon: PackageCheck },
      { to: '/vendor-invoices', label: 'Vendor Invoices', icon: Receipt }
    ]
  },
  {
    title: 'Accounts & Controlling',
    items: [
      { to: '/payments', label: 'Accounts & Receivables', icon: CreditCard },
      { to: '/expenses', label: 'Project Costing & Profitability', icon: TrendingUp }
    ]
  },
  {
    title: 'After-Sales & Service',
    items: [
      { to: '/complaints', label: 'Service Complaints', icon: LifeBuoy },
      { to: '/warranties', label: 'Asset Warranties', icon: ShieldCheck },
      { to: '/amc', label: 'AMC & Service Visits', icon: FileCheck2 },
      { to: '/service-visits', label: 'Field Service Visits', icon: Wrench }
    ]
  },
  {
    title: 'Workforce & Governance',
    items: [
      { to: '/employees', label: 'Employee Management', icon: Users },
      { to: '/teams', label: 'Teams & Field Crews', icon: Users },
      { to: '/mfa-setup', label: 'Users & Roles (MFA)', icon: ShieldCheck }
    ]
  }
];

const SALES_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'CRM & Sales Pipeline',
    items: [
      { to: '/', label: 'Sales Dashboard', icon: LayoutDashboard },
      { to: '/leads', label: 'Lead Management', icon: Users },
      { to: '/follow-ups', label: 'Follow-ups & Reminders', icon: Bell }
    ]
  },
  {
    title: 'Engineering & Proposals',
    items: [
      { to: '/surveys', label: 'Site Surveys', icon: Layers },
      { to: '/solar-designs', label: 'Solar PV Sizing', icon: Sun },
      { to: '/quotations', label: 'Quotation Suite', icon: FileSpreadsheet },
      { to: '/orders', label: 'Confirmed Sales Orders', icon: ShoppingCart }
    ]
  },
  {
    title: 'Execution & Milestone Tracking',
    items: [
      { to: '/projects', label: 'Project Progress', icon: FolderKanban },
      { to: '/net-metering', label: 'Net Metering Status', icon: Zap },
      { to: '/subsidies', label: 'Govt Subsidies (DBT)', icon: Landmark }
    ]
  },
  {
    title: 'Workspace & Documents',
    items: [
      { to: '/tasks', label: 'Sales Tasks', icon: CheckSquare },
      { to: '/documents', label: 'Client Document Vault', icon: FileText }
    ]
  }
];

const ACCOUNTS_PANEL_SECTIONS: NavSection[] = [
  {
    title: 'Receivables & Billing',
    items: [
      { to: '/', label: 'Accounts Dashboard', icon: LayoutDashboard },
      { to: '/payments', label: 'Payment Collections & Receipts', icon: CreditCard },
      { to: '/subsidies', label: 'Govt Subsidy Disbursements', icon: Landmark },
      { to: '/orders', label: 'Confirmed Sales Orders (Billing)', icon: ShoppingCart }
    ]
  },
  {
    title: 'Procurement & 3-Way Match',
    items: [
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/goods-receipts', label: 'Goods Receipts (GRN QA)', icon: PackageCheck },
      { to: '/vendor-invoices', label: 'Vendor Invoices & Aging', icon: Receipt },
      { to: '/vendors', label: 'Vendor Directory & Balances', icon: Building2 }
    ]
  },
  {
    title: 'Costing, Vouchers & Tasks',
    items: [
      { to: '/expenses', label: 'Operational Expense Vouchers', icon: TrendingUp },
      { to: '/documents', label: 'Financial Documents & Invoices', icon: FileText },
      { to: '/tasks', label: 'Accounts Tasks & Approvals', icon: CheckSquare }
    ]
  }
];

function getBreadcrumb(pathname: string): { section: string; title: string } {
  if (pathname === '/') return { section: 'Executive', title: 'Dashboard' };
  if (pathname.startsWith('/leads')) return { section: 'CRM', title: 'Leads & Customers' };
  if (pathname.startsWith('/follow-ups')) return { section: 'Sales', title: 'Follow-ups' };
  if (pathname.startsWith('/surveys')) return { section: 'Engineering', title: 'Site Surveys' };
  if (pathname.startsWith('/solar-designs')) return { section: 'Engineering', title: 'PV Sizing' };
  if (pathname.startsWith('/quotations')) return { section: 'Commercial', title: 'Quotation Suite' };
  if (pathname.startsWith('/orders')) return { section: 'Commercial', title: 'Sales Orders' };
  if (pathname.startsWith('/projects')) return { section: 'Operations', title: 'Project Pipeline' };
  if (pathname.startsWith('/net-metering')) return { section: 'Compliance', title: 'Net Metering' };
  if (pathname.startsWith('/subsidies')) return { section: 'Govt Liaisons', title: 'Subsidies' };
  if (pathname.startsWith('/inventory')) return { section: 'Supply Chain', title: 'Inventory' };
  if (pathname.startsWith('/vendors')) return { section: 'Procurement', title: 'Vendors' };
  if (pathname.startsWith('/purchase-orders')) return { section: 'Procurement', title: 'Purchase Orders' };
  if (pathname.startsWith('/goods-receipts')) return { section: 'Procurement', title: 'Goods Receipts' };
  if (pathname.startsWith('/vendor-invoices')) return { section: 'Procurement', title: 'Vendor Invoices' };
  if (pathname.startsWith('/payments')) return { section: 'Accounts', title: 'Payments & Receipts' };
  if (pathname.startsWith('/expenses')) return { section: 'Accounts', title: 'Project Costing' };
  if (pathname.startsWith('/complaints')) return { section: 'Service', title: 'Service Tickets' };
  if (pathname.startsWith('/warranties')) return { section: 'Service', title: 'Asset Warranties' };
  if (pathname.startsWith('/amc')) return { section: 'Service', title: 'AMC Contracts' };
  if (pathname.startsWith('/service-visits')) return { section: 'Service', title: 'Field Visits' };
  if (pathname.startsWith('/employees')) return { section: 'HR', title: 'Employees' };
  if (pathname.startsWith('/teams')) return { section: 'HR', title: 'Field Crews' };
  if (pathname.startsWith('/tasks')) return { section: 'Workspace', title: 'Tasks' };
  if (pathname.startsWith('/documents')) return { section: 'Workspace', title: 'Document Vault' };
  if (pathname.startsWith('/customer-portal')) return { section: 'Customer', title: 'Client Portal' };
  if (pathname.startsWith('/mfa')) return { section: 'Security', title: 'MFA Security' };
  if (pathname.startsWith('/health')) return { section: 'System', title: 'System Health' };
  return { section: 'INS Solar', title: 'ERP Workstation' };
}

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Derive default panel from logged in user role & department
  const defaultPanel: PanelType = user?.role
    ? getDefaultPanelForRole(user.role, user.department)
    : PanelType.ADMIN;

  // Allow Superadmin & Admin to switch panel viewports dynamically
  const canSwitchPanels = user?.role === UserRole.SUPERADMIN || user?.role === UserRole.ADMIN;
  const [activePanel, setActivePanel] = useState<PanelType>(defaultPanel);

  useEffect(() => {
    setActivePanel(defaultPanel);
  }, [defaultPanel]);

  const currentSections =
    activePanel === PanelType.SALES
      ? SALES_PANEL_SECTIONS
      : activePanel === PanelType.ACCOUNTS
        ? ACCOUNTS_PANEL_SECTIONS
        : ADMIN_PANEL_SECTIONS;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const breadcrumb = getBreadcrumb(location.pathname);

  const renderNavContent = (isCollapsed = false) => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'} border-b border-border/70 shrink-0 bg-card`}>
        <Link to="/" className="flex items-center space-x-2.5 group overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-solar-500/15 border border-solar-500/30 flex items-center justify-center text-solar-600 group-hover:bg-solar-500/25 transition-all shadow-xs shrink-0">
            <Sun className="w-5 h-5 text-solar-500" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-foreground truncate">
                  INS <span className="text-solar-600">SOLAR</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
                  ERP
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium truncate">
                Solar Enterprise Suite
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse Toggle */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:flex p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand Button when Collapsed */}
      {isCollapsed && (
        <div className="p-2 border-b flex justify-center">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Panel Switcher / Badge */}
      <div className={`p-3 shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {!isCollapsed ? (
          canSwitchPanels ? (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Active Workstation Panel
              </div>
              <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-xl border border-border/80">
                <button
                  type="button"
                  onClick={() => setActivePanel(PanelType.ADMIN)}
                  className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                    activePanel === PanelType.ADMIN
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel(PanelType.SALES)}
                  className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                    activePanel === PanelType.SALES
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  Sales
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel(PanelType.ACCOUNTS)}
                  className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                    activePanel === PanelType.ACCOUNTS
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  Accounts
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl border shadow-xs ${
                activePanel === PanelType.ADMIN
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  : activePanel === PanelType.SALES
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  activePanel === PanelType.ADMIN
                    ? 'bg-amber-500'
                    : activePanel === PanelType.SALES
                      ? 'bg-sky-500'
                      : 'bg-emerald-500'
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black uppercase tracking-wider truncate">
                  {activePanel} PANEL
                </span>
                <span className="text-[10px] text-muted-foreground font-medium truncate">
                  {activePanel === PanelType.ADMIN
                    ? 'Operations & Management'
                    : activePanel === PanelType.SALES
                      ? 'CRM & Commercial'
                      : 'Finance & Controlling'}
                </span>
              </div>
            </div>
          )
        ) : (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shadow-xs ${
              activePanel === PanelType.ADMIN
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400'
                : activePanel === PanelType.SALES
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
            }`}
            title={`${activePanel} Panel Active`}
          >
            {activePanel[0]}
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'} py-2 space-y-5 scrollbar-thin scrollbar-thumb-muted-foreground/20`}>
        {currentSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-1.5">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const ItemIcon = item.icon;
                const isExact = item.to === '/';
                const isActive = isExact
                  ? location.pathname === '/'
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={isExact}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive: navActive }) => {
                      const active = isExact ? navActive : isActive;
                      return `flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'} rounded-lg text-xs font-medium transition-all group ${
                        active
                          ? 'bg-solar-500/15 text-solar-700 dark:text-solar-400 font-semibold border-l-3 border-solar-500 shadow-xs'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`;
                    }}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'} truncate`}>
                      <ItemIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-solar-500/20 text-solar-700">
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

      {/* Sidebar Footer */}
      <div className={`p-3 border-t border-border/70 shrink-0 bg-card/50 space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        <NavLink
          to="/health"
          title="Health Status"
          className={({ isActive }) =>
            `flex items-center ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-1.5'} rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? 'bg-solar-500/15 text-solar-700 font-semibold'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            }`
          }
        >
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {!isCollapsed && <span>Health Status</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
        </NavLink>

        {!isCollapsed && (
          <div className="px-3 text-[10px] text-muted-foreground/60 flex items-center justify-between">
            <span>Enterprise v1.2</span>
            <span>Prod Ready</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* 1. Desktop Left Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } flex-col fixed inset-y-0 left-0 z-40 bg-card border-r border-border shadow-xs transition-all duration-300`}
      >
        {renderNavContent(sidebarCollapsed)}
      </aside>

      {/* 2. Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-card border-r shadow-2xl z-10 animate-in slide-in-from-left duration-200">
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
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        } flex flex-col min-h-screen min-w-0 transition-all duration-300`}
      >
        {/* Top Navbar Header */}
        <header className="h-16 sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-6 shadow-xs">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center space-x-1.5 text-xs sm:text-sm font-semibold truncate">
              <span className="text-muted-foreground hidden sm:inline truncate">
                {breadcrumb.section}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline shrink-0" />
              <span className="text-foreground font-bold truncate">
                {breadcrumb.title}
              </span>
              <span
                className={`ml-1.5 hidden xs:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  activePanel === PanelType.ADMIN
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : activePanel === PanelType.SALES
                      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {activePanel}
              </span>
            </div>
          </div>

          {/* Right: User Profile, Notifications & Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Customer Portal Shortcut */}
            <Link
              to="/customer-portal"
              className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors border"
            >
              <Users className="w-3.5 h-3.5 text-solar-600" />
              <span>Customer Portal</span>
            </Link>

            {/* Notification Bell */}
            <Link
              to="/customer-portal"
              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-solar-500"></span>
            </Link>

            {/* Authenticated User Badge & Logout */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2 sm:space-x-3 pl-1.5 sm:pl-2 border-l border-border/80">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-solar-500 to-amber-400 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {user.firstName ? user.firstName[0] : 'U'}
                    {user.lastName ? user.lastName[0] : ''}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-xs font-bold text-foreground leading-tight truncate max-w-[120px]">
                      {user.firstName || 'System'} {user.lastName || 'Admin'}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                      {user.role}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-900/50"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-7xl mx-auto min-w-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
