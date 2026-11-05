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
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  type PortalType = 'ADMIN' | 'SALES' | 'ACCOUNTS' | 'INSTALLER' | 'CUSTOMER';
  const [selectedPortal, setSelectedPortal] = useState<PortalType>('ADMIN');

  const [email, setEmail] = useState('admin@inssolar.com');
  const [password, setPassword] = useState('SolarAdmin2026!');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // Synchronize credentials and active workstation title when portal tab is switched
  const handleSelectPortal = (portal: PortalType) => {
    setSelectedPortal(portal);
    setErrorMessage(null);
    if (portal === 'ADMIN') {
      setEmail('admin@inssolar.com');
      setPassword('SolarAdmin2026!');
    } else if (portal === 'SALES') {
      setEmail('sales@inssolar.com');
      setPassword('SolarSales2026!');
    } else if (portal === 'ACCOUNTS') {
      setEmail('accounts@inssolar.com');
      setPassword('SolarAccounts2026!');
    } else if (portal === 'INSTALLER') {
      setEmail('installer@inssolar.com');
      setPassword('SolarInstaller2026!');
    } else if (portal === 'CUSTOMER') {
      navigate('/customer-portal');
    }
  };

  const portalConfig = {
    ADMIN: {
      badge: 'Admin Workstation',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      title: 'Administrator Workstation',
      description:
        'Sign in to access corporate governance, EPC project execution, and full ERP operations.',
      themeColor: 'from-amber-500 to-amber-600',
      tabActive: 'bg-amber-500 text-slate-950 font-bold shadow-md'
    },
    SALES: {
      badge: 'Sales CRM & Commercial',
      badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      title: 'Sales & Commercial Workstation',
      description:
        'Sign in to manage lead pipelines, site surveys, solar PV sizing, and client proposals.',
      themeColor: 'from-sky-500 to-sky-600',
      tabActive: 'bg-sky-500 text-white font-bold shadow-md'
    },
    ACCOUNTS: {
      badge: 'Accounts & Finance',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      title: 'Accounts & Billing Workstation',
      description:
        'Sign in to oversee payment collections, vendor 3-way matching, DBT subsidies, and costing.',
      themeColor: 'from-emerald-500 to-emerald-600',
      tabActive: 'bg-emerald-500 text-white font-bold shadow-md'
    },
    INSTALLER: {
      badge: 'Installer Field Workstation',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      title: 'Field Installer & Commissioning Workstation',
      description:
        'Sign in to record rooftop equipment serials, scan barcodes with phone camera, capture live GPS, and upload 10 site photos.',
      themeColor: 'from-amber-500 to-orange-500',
      tabActive: 'bg-amber-500 text-slate-950 font-bold shadow-md'
    },
    CUSTOMER: {
      badge: 'Client Portal',
      badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      title: 'Customer Self-Service Portal',
      description:
        'Redirecting to customer milestone tracking, subsidy status, and digital document vault.',
      themeColor: 'from-purple-500 to-purple-600',
      tabActive: 'bg-purple-500 text-white font-bold shadow-md'
    }
  };

  const currentConfig = portalConfig[selectedPortal];

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
        const destination = selectedPortal === 'INSTALLER' ? '/installations' : from;
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || '';
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
                  RAREBOX <span className="text-amber-500">SOLAR</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  RAREBOX LLP
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Raipur, Chhattisgarh • Solar Energy & Business Enterprise
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
              RAREBOX <span className="text-amber-500">SOLAR</span>
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Multi-Portal Authentication</span>
          </div>

          <Link
            to="/customer-portal"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <span>Customer Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Center: Sign-In Card Container */}
        <div className="my-auto mx-auto w-full max-w-md py-6">
          {/* Workstation Selector Tabs */}
          <div className="mb-6 space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Select Operating Portal
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => handleSelectPortal('ADMIN')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                  selectedPortal === 'ADMIN'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>⚡</span>
                <span className="truncate">Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPortal('SALES')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                  selectedPortal === 'SALES'
                    ? 'bg-sky-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>💼</span>
                <span className="truncate">Sales</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPortal('ACCOUNTS')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                  selectedPortal === 'ACCOUNTS'
                    ? 'bg-emerald-500 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>💳</span>
                <span className="truncate">Accounts</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPortal('INSTALLER')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                  selectedPortal === 'INSTALLER'
                    ? 'bg-amber-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>⛑️</span>
                <span className="truncate">Installer</span>
              </button>
            </div>
          </div>

          {/* Dynamic Workstation Header */}
          <div className="space-y-2 mb-6">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
              <span>{currentConfig.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {currentConfig.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {currentConfig.description}
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
              >
                Workstation Email Address
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
                  placeholder="name@inssolar.com"
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
                  Forgot password? Contact IT
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
              className={`w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r ${currentConfig.themeColor} text-white font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating secure session...</span>
                </>
              ) : (
                <>
                  <span>
                    Sign In to {selectedPortal.charAt(0) + selectedPortal.slice(1).toLowerCase()}{' '}
                    Portal
                  </span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Secure Workstation Note */}
          <div className="mt-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Role-Based Access Control (RBAC) enforced with session token integrity.</span>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>Rarebox Solar (associated with RAREBOX LLP) © 2026 • Raipur, Chhattisgarh</span>
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
