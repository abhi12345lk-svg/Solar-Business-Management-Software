import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sun,
  Lock,
  Mail,
  ShieldAlert,
  ArrowRight,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Zap,
  Building2,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { UserRole } from '@ins-solar/shared';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginDemo, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // If already authenticated, redirect to target or dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await login({
        email,
        password,
        totpCode: totpCode.trim() || undefined
      });

      if (result.requiresMfa) {
        navigate('/mfa-challenge');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || '';
      // If cloud DB is not configured, fall back to instant demo workstation!
      if (
        (msg.includes('SERVER_INITIALIZATION_ERROR') ||
          msg.includes('MONGODB_URI') ||
          msg.includes('503') ||
          msg.includes('Failed to fetch')) &&
        (email === 'admin@inssolar.com' || email === 'sales@inssolar.com')
      ) {
        loginDemo(email === 'admin@inssolar.com' ? UserRole.SUPERADMIN : UserRole.SALES_EXECUTIVE);
        navigate(from, { replace: true });
        return;
      }
      setErrorMessage(msg || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFillAndLogin = async (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await login({
        email: fillEmail,
        password: fillPass
      });

      if (result.requiresMfa) {
        navigate('/mfa-challenge');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || '';
      // If Vercel cloud database is not connected (no MONGODB_URI), automatically log into Demo Mode!
      if (
        msg.includes('SERVER_INITIALIZATION_ERROR') ||
        msg.includes('MONGODB_URI') ||
        msg.includes('503') ||
        msg.includes('Failed to fetch') ||
        msg.includes('unreachable')
      ) {
        loginDemo(fillEmail.includes('admin') ? UserRole.SUPERADMIN : UserRole.SALES_EXECUTIVE);
        navigate(from, { replace: true });
        return;
      }
      setErrorMessage(msg || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 font-sans selection:bg-amber-500 selection:text-white">
      {/* ============================================================ */}
      {/* LEFT COLUMN: Premium Enterprise Brand & Capability Hero       */}
      {/* ============================================================ */}
      <div className="relative hidden lg:flex lg:w-7/12 xl:w-3/5 flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border-r border-slate-800/80 overflow-hidden">
        {/* Subtle Ambient Background Lighting */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header: Brand Identity */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25 ring-1 ring-amber-400/30">
              <Sun className="w-7 h-7 animate-[spin_20s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-white">
                  INS <span className="text-amber-500">SOLAR</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Enterprise ERP
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Complete Solar EPC Lifecycle Platform
              </p>
            </div>
          </div>
        </div>

        {/* Center: Hero Value Proposition & Operational Pillars */}
        <div className="relative z-10 my-auto py-8 space-y-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-amber-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Solar Business Management Suite v2.0</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              Powering Modern Solar EPC Operations.
            </h1>
            <p className="text-slate-300 text-sm xl:text-base leading-relaxed">
              Unified command center bridging commercial CRM pipelines, engineering designs,
              multi-warehouse supply chains, and DISCOM net metering compliance.
            </p>
          </div>

          {/* 4 Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1.5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4" />
                <span>10-Stage Project EPC</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                BOM dispatch gate-checks, 5-category installation audits, and commissioning.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1.5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Sun className="w-4 h-4" />
                <span>Solar PV Engineering</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                String calculations, inverter sizing, and customer quotation proposals.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1.5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                <span>Inventory & Supply Chain</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Multi-location depot balances, serialized panel tracking, and anti-self-approval
                POs.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1.5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Net Metering & Subsidy</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                DISCOM utility inspection tracking & PM Surya Ghar DBT disbursement ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Footer: Compliance & Security Badges */}
        <div className="relative z-10 pt-6 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>TLS 256-bit Encryption</span>
            </span>
            <span>•</span>
            <span>Argon2id Protected</span>
            <span>•</span>
            <span>RBAC & MFA Secured</span>
          </div>
          <span>v1.0.0 Production</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Modern High-Contrast Authentication Workstation */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 p-6 sm:p-12 lg:p-16 min-h-screen">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          {/* Mobile-only logo */}
          <div className="flex items-center space-x-2 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Sun className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              INS <span className="text-amber-500">SOLAR</span>
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational Workstation</span>
          </div>

          <Link
            to="/portal"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <span>Customer Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Center: Sign-In Card Container */}
        <div className="my-auto mx-auto w-full max-w-md py-8">
          <div className="space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sign in to Workstation
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your corporate email and password to access the INS Solar management system.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start space-x-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="space-y-0.5">
                <p className="font-semibold">Authentication Denied</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Authentication Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
              >
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@inssolar.com"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
                <span className="text-xs text-slate-400 cursor-not-allowed">
                  Forgot password? Contact Admin
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Optional TOTP 2FA input */}
            <div className="pt-1">
              {showMfaInput ? (
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="totpCode"
                      className="block text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider"
                    >
                      6-Digit Authenticator Token
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMfaInput(false)}
                      className="text-[11px] text-amber-700 hover:underline"
                    >
                      Hide 2FA
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-600">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="totpCode"
                      name="totpCode"
                      type="text"
                      maxLength={6}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-2.5 text-base font-mono tracking-[0.3em] text-center bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMfaInput(true)}
                  className="inline-flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Have your 2FA authenticator code ready? Enter here</span>
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Validating session credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workstation</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Instant 1-Click Login (Evaluation Mode)
              </p>
              <span className="text-[10px] text-amber-500 font-semibold">Auto-fills & logs in</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickFillAndLogin('admin@inssolar.com', 'SolarAdmin2026!')}
                className="flex-1 py-2.5 px-3.5 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all text-center border border-amber-500/30 hover:border-amber-500 shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>⚡ Super Admin</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                  (admin)
                </span>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickFillAndLogin('sales@inssolar.com', 'SolarSales2026!')}
                className="flex-1 py-2.5 px-3.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all text-center border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>💼 Sales Exec</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                  (sales)
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>INS Solar Business Management System © 2026</span>
          <div className="flex items-center space-x-3 text-slate-500">
            <span>Enterprise ERP</span>
            <span>•</span>
            <Link to="/health" className="hover:text-amber-500 transition-colors">
              System Health
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
