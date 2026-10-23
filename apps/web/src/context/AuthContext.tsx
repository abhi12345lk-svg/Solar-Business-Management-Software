import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthUserDto, Permission, UserRole, LoginInput } from '@ins-solar/shared';
import { apiClient } from '../lib/api.js';

interface MfaChallengeState {
  userId: string;
  challengeToken: string;
}

interface AuthContextType {
  user: AuthUserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mfaChallenge: MfaChallengeState | null;
  login: (credentials: LoginInput) => Promise<{ requiresMfa?: boolean }>;
  verifyMfaLogin: (code: string, isRecovery?: boolean) => Promise<void>;
  clearMfaChallenge: () => void;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeState | null>(null);

  // Fetch current session status
  const { data: user, isLoading } = useQuery<AuthUserDto | null>({
    queryKey: ['authUser'],
    queryFn: async () => {
      try {
        return await apiClient<AuthUserDto>('/auth/me');
      } catch (err: any) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginInput) => {
      // First ensure CSRF cookie is initialized
      await apiClient('/auth/csrf');
      return await apiClient<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
    },
    onSuccess: data => {
      if (data.requiresMfa) {
        setMfaChallenge({
          userId: data.userId,
          challengeToken: data.challengeToken
        });
      } else {
        setMfaChallenge(null);
        queryClient.setQueryData(['authUser'], data.user);
      }
    }
  });

  const mfaVerifyMutation = useMutation({
    mutationFn: async ({ code, isRecovery }: { code: string; isRecovery?: boolean }) => {
      if (!mfaChallenge) throw new Error('No active MFA challenge.');

      const payload = isRecovery
        ? {
            userId: mfaChallenge.userId,
            challengeToken: mfaChallenge.challengeToken,
            recoveryCode: code
          }
        : {
            userId: mfaChallenge.userId,
            challengeToken: mfaChallenge.challengeToken,
            totpCode: code
          };

      return await apiClient<any>('/auth/login/mfa', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: data => {
      setMfaChallenge(null);
      queryClient.setQueryData(['authUser'], data.user);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/auth/logout', { method: 'POST' });
    },
    onSettled: () => {
      queryClient.setQueryData(['authUser'], null);
      queryClient.clear();
      setMfaChallenge(null);
    }
  });

  const login = async (credentials: LoginInput) => {
    const res = await loginMutation.mutateAsync(credentials);
    return { requiresMfa: !!res.requiresMfa };
  };

  const verifyMfaLogin = async (code: string, isRecovery = false) => {
    await mfaVerifyMutation.mutateAsync({ code, isRecovery });
  };

  const clearMfaChallenge = () => {
    setMfaChallenge(null);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPERADMIN) return true;
    return (user.permissions || []).includes(permission);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPERADMIN) return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        mfaChallenge,
        login,
        verifyMfaLogin,
        clearMfaChallenge,
        logout,
        hasPermission,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
