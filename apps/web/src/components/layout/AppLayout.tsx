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
  CheckSquare
} from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary.js';
import { useAuth } from '../../context/AuthContext.js';

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

const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: 'Core & Executive',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    title: 'Sales & CRM',
    items: [
      { to: '/leads', label: 'Leads & Follow-ups', icon: Users },
      { to: '/surveys', label: 'Site Surveys', icon: Layers },
      { to: '/solar-designs', label: 'Solar PV Sizing', icon: Sun },
      { to: '/quotations', label: 'Quotation Suite', icon: FileSpreadsheet },
      { to: '/orders', label: 'Sales Orders', icon: ShoppingCart }
    ]
  },
  {
    title: 'Execution & Projects',
    items: [
      { to: '/projects', label: 'Projects (10-Stage)', icon: FolderKanban },
      { to: '/tasks', label: 'Unified Tasks', icon: CheckSquare },
      { to: '/documents', label: 'Document Vault', icon: FileText },
      { to: '/net-metering', label: 'Net Metering', icon: Zap },
      { to: '/subsidies', label: 'Govt Subsidies', icon: Landmark }
    ]
  },
  {
    title: 'Supply Chain & Inventory',
    items: [
      { to: '/inventory', label: 'Inventory Management', icon: Boxes },
      { to: '/vendors', label: 'Vendor Directory', icon: Building2 },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/goods-receipts', label: 'Goods Receipt (GRN)', icon: PackageCheck },
      { to: '/vendor-invoices', label: 'Vendor Invoices', icon: Receipt }
    ]
  },
  {
    title: 'Service & Maintenance',
    items: [
      { to: '/complaints', label: 'Service Complaints', icon: LifeBuoy },
      { to: '/warranties', label: 'Asset Warranties', icon: ShieldCheck },
      { to: '/amc', label: 'AMC Contracts', icon: FileCheck2 },
      { to: '/service-visits', label: 'Field Visits', icon: Wrench },
      { to: '/customer-portal', label: 'Customer Portal Hub', icon: Users }
    ]
  },
  {
    title: 'Team & Workforce',
    items: [
      { to: '/employees', label: 'Employee Directory', icon: Users },
      { to: '/teams', label: 'Crews & Squads', icon: Users }
    ]
  }
];

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-border/70 shrink-0 bg-card">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-solar-500/15 border border-solar-500/30 flex items-center justify-center text-solar-600 group-hover:bg-solar-500/25 transition-all shadow-xs">
            <Sun className="w-6 h-6 text-solar-500" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-lg tracking-tight text-foreground">
                INS <span className="text-solar-600">SOLAR</span>
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-solar-500/10 text-solar-700 dark:text-solar-400 border border-solar-500/20">
                ERP
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
              Enterprise Business Suite
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {SIDEBAR_SECTIONS.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-1.5">
              {section.title}
            </div>
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
                    className={({ isActive: navActive }) => {
                      const active = isExact ? navActive : isActive;
                      return `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                        active
                          ? 'bg-solar-500/15 text-solar-700 dark:text-solar-400 font-semibold border-l-3 border-solar-500 shadow-xs'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`;
                    }}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <ItemIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
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

      {/* Sidebar Footer: Health Status & Version */}
      <div className="p-3 border-t border-border/70 shrink-0 bg-card/50 space-y-2">
        <NavLink
          to="/health"
          className={({ isActive }) =>
            `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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
            <span>Health Status</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            Live
          </span>
        </NavLink>

        <div className="px-3 pt-1 text-[10px] text-muted-foreground/60 flex items-center justify-between">
          <span>Enterprise v1.2</span>
          <span>Prod Ready</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* 1. Desktop Left Sidebar (Fixed 256px) */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-40 bg-card border-r border-border shadow-xs">
        {renderNavContent()}
      </aside>

      {/* 2. Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-card border-r shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="w-5 h-5" />
            </button>
            {renderNavContent()}
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area (Offset by 256px on Desktop) */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen min-w-0">
        {/* Top Navbar Header */}
        <header className="h-16 sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-xs">
          {/* Left: Mobile Toggle & Page Context */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-foreground hidden sm:inline">
                Solar Business Operations
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                System Active
              </span>
            </div>
          </div>

          {/* Right: User Profile, Notifications & Controls */}
          <div className="flex items-center space-x-3">
            {/* Customer Portal Shortcut */}
            <Link
              to="/customer-portal"
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors border"
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
              <div className="flex items-center space-x-3 pl-2 border-l border-border/80">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-solar-500 to-amber-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {user.firstName ? user.firstName[0] : 'U'}
                    {user.lastName ? user.lastName[0] : ''}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-foreground leading-tight">
                      {user.firstName || 'System'} {user.lastName || 'Administrator'}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      {user.role}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-900/50"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-solar-600 hover:bg-solar-700 text-white transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
