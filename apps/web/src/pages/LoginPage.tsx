import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Sun, Lock, Mail, ShieldAlert, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // If already authenticated, redirect
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
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-xl border shadow-lg shadow-black/5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-solar-500/10 border border-solar-500/30 flex items-center justify-center text-solar-600 mx-auto mb-4">
            <Sun className="w-7 h-7 text-solar-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to INS Solar ERP
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Internal Staff & Multi-Department Management Console
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
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
                placeholder="employee@inssolar.com"
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 transition-colors"
              />
            </div>
          </div>

          {/* Optional inline TOTP code */}
          {showMfaInput ? (
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                Authenticator 6-Digit Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
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
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-widest bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMfaInput(true)}
              className="text-xs text-solar-600 hover:text-solar-700 underline font-medium"
            >
              Have your authenticator code ready? Enter it here
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-solar-600 hover:bg-solar-500 text-white font-medium text-sm transition-all shadow-md shadow-solar-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Workstation</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Notice on Customer Portal Boundary */}
        <div className="pt-4 border-t text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            External Customer?{' '}
            <Link to="/portal/login" className="text-solar-600 hover:underline font-medium">
              Customer Portal Sign-In
            </Link>
          </p>
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Customer Boundary Notice:</strong> External SMS/WhatsApp gateway delivery is
            currently disabled.
          </div>
        </div>
      </div>
    </div>
  );
};
