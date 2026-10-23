import React, { useState } from 'react';
import { Shield, Key, Copy, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export const MfaSetupPage: React.FC = () => {
  const { user } = useAuth();

  const [step, setStep] = useState<'INITIAL' | 'SCAN' | 'CONFIRMED'>('INITIAL');
  const [setupData, setSetupData] = useState<{
    qrCodeDataUrl: string;
    otpauthUri: string;
    manualEntryKey: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const startEnrollment = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient<any>('/auth/mfa/setup', { method: 'POST' });
      setSetupData(data);
      setStep('SCAN');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize MFA setup.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiClient<any>('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ totpCode: totpCode.trim() })
      });
      setRecoveryCodes(data.recoveryCodes || []);
      setStep('CONFIRMED');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid TOTP code. Enrollment not confirmed.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center space-x-2">
          <Shield className="w-6 h-6 text-solar-500" />
          <span>Multi-Factor Authentication (MFA) Setup</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Standard RFC 6238 Time-based One-Time Password (TOTP) Enrollment
        </p>
      </div>

      {user?.mfaEnabled && step === 'INITIAL' && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">MFA is active on your account</p>
            <p className="text-xs mt-0.5">
              Your privileged account is protected with an Authenticator app. You can re-enroll
              below to reset your keys.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {errorMessage}
        </div>
      )}

      {step === 'INITIAL' && (
        <div className="bg-card p-6 rounded-xl border space-y-4 shadow-sm">
          <p className="text-sm text-foreground">
            Enrolling in Multi-Factor Authentication adds an extra layer of protection to your INS
            Solar account. Privileged roles (Admin, Accounts) require MFA before executing critical
            operations.
          </p>
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Compatible Authenticator Apps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator (iOS / Android)</li>
              <li>Microsoft Authenticator</li>
              <li>1Password / Bitwarden / Apple Passwords</li>
            </ul>
          </div>
          <button
            onClick={startEnrollment}
            disabled={isLoading}
            className="flex items-center space-x-2 py-2 px-4 rounded-lg bg-solar-600 hover:bg-solar-500 text-white font-medium text-sm transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{user?.mfaEnabled ? 'Re-enroll Authenticator' : 'Begin MFA Setup'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'SCAN' && setupData && (
        <div className="bg-card p-6 rounded-xl border space-y-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              Step 1: Scan this QR Code with your Authenticator App
            </h3>
            <p className="text-xs text-muted-foreground">
              Open your authenticator app and point your camera at the QR code below:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-background rounded-lg border">
            <img
              src={setupData.qrCodeDataUrl}
              alt="MFA QR Code"
              className="w-44 h-44 rounded border shadow-sm shrink-0"
            />
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-foreground flex items-center space-x-1">
                <Key className="w-4 h-4 text-solar-500" />
                <span>Cannot scan? Enter code manually:</span>
              </p>
              <div className="p-2 bg-muted rounded font-mono text-foreground break-all select-all">
                {setupData.manualEntryKey}
              </div>
              <p className="text-muted-foreground text-[11px]">
                Account label: {user?.email} &bull; Type: Time-based (TOTP)
              </p>
            </div>
          </div>

          <form onSubmit={confirmEnrollment} className="space-y-4 pt-2 border-t">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Step 2: Verify with Generated 6-Digit Code
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the current 6-digit code shown in your authenticator app to complete setup:
              </p>
              <input
                type="text"
                required
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                placeholder="123456"
                className="w-48 pl-3 pr-3 py-2 text-lg font-mono tracking-widest text-center bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="flex items-center space-x-2 py-2.5 px-5 rounded-lg bg-solar-600 hover:bg-solar-500 text-white font-medium text-sm transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Verify & Complete Enrollment</span>
            </button>
          </form>
        </div>
      )}

      {step === 'CONFIRMED' && (
        <div className="bg-card p-6 rounded-xl border space-y-6 shadow-sm">
          <div className="flex items-center space-x-3 text-emerald-600">
            <CheckCircle className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold text-foreground">MFA Successfully Enrolled</h2>
              <p className="text-xs text-muted-foreground">
                Your account is now guarded with Time-based One-Time Passwords.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">IMPORTANT: Save your emergency recovery codes now!</p>
              <p className="mt-0.5">
                If you ever lose access to your phone or authenticator app, these one-time codes are
                the only way to log in without an administrator reset. Each code can be used exactly
                once.
              </p>
            </div>
          </div>

          {/* Recovery Codes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-background rounded-lg border font-mono text-center text-sm">
            {recoveryCodes.map((code, idx) => (
              <div key={idx} className="p-2 bg-muted rounded border select-all font-bold">
                {code}
              </div>
            ))}
          </div>

          <button
            onClick={copyRecoveryCodes}
            className="flex items-center space-x-2 py-2 px-4 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs border"
          >
            {copiedCodes ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>
              {copiedCodes ? 'Recovery Codes Copied to Clipboard!' : 'Copy All Recovery Codes'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
