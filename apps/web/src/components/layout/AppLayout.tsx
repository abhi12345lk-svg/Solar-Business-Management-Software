import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Sun,
  Activity,
  LayoutDashboard,
  ShieldCheck,
  Shield,
  LogOut,
  LogIn,
  Users,
  Clock,
  Layers,
  FileSpreadsheet,
  ShoppingCart,
  Boxes
} from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary.js';
import { useAuth } from '../../context/AuthContext.js';

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Title */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-lg bg-solar-500/10 border border-solar-500/30 flex items-center justify-center text-solar-600 group-hover:bg-solar-500/20 transition-colors">
              <Sun className="w-6 h-6 text-solar-500 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-foreground">
                  INS <span className="text-solar-600">SOLAR</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border">
                  Foundation
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Enterprise Business Management System
              </p>
            </div>
          </Link>

          {/* Navigation & User Status Controls */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                <span>Dashboard</span>
              </NavLink>

              {isAuthenticated && (
                <>
                  <NavLink
                    to="/leads"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Users className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Leads</span>
                  </NavLink>

                  <NavLink
                    to="/follow-ups"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Clock className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Follow-ups</span>
                  </NavLink>

                  <NavLink
                    to="/surveys"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Layers className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Surveys</span>
                  </NavLink>

                  <NavLink
                    to="/solar-designs"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Sun className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Solar Designs</span>
                  </NavLink>

                  <NavLink
                    to="/quotations"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Quotations</span>
                  </NavLink>

                  <NavLink
                    to="/orders"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <ShoppingCart className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Orders</span>
                  </NavLink>

                  <NavLink
                    to="/inventory"
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`
                    }
                  >
                    <Boxes className="w-4 h-4 mr-1.5 text-solar-500" />
                    <span>Inventory</span>
                  </NavLink>
                </>
              )}

              <NavLink
                to="/health"
                className={({ isActive }) =>
                  `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`
                }
              >
                <Activity className="w-4 h-4 mr-1.5" />
                <span>Health Status</span>
              </NavLink>

              {isAuthenticated && (
                <NavLink
                  to="/mfa-setup"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    }`
                  }
                >
                  <Shield className="w-4 h-4 mr-1.5 text-solar-500" />
                  <span>MFA Setup</span>
                </NavLink>
              )}
            </nav>

            {/* User Session Bar */}
            <div className="pl-3 border-l flex items-center space-x-3">
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-3">
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-xs font-semibold text-foreground flex items-center justify-end space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
                      <span>
                        {user.firstName} {user.lastName}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {user.role} &bull; {user.department}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Log Out"
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-colors border"
                  >
                    <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-solar-600 hover:bg-solar-500 text-white text-xs font-medium transition-colors shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card text-muted-foreground text-xs py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>INS Solar Enterprise Management &bull; Phase 2 Security & Auth Active</span>
          </div>
          <div>
            <span>Server-Managed Stateful Sessions &bull; Strict HttpOnly / CSRF Guard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
