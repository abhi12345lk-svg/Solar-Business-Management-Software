import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthUserDto, Permission, UserRole, Department, LoginInput } from '@ins-solar/shared';
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
  loginDemo: (role?: UserRole) => void;
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
      } catch {
        try {
          localStorage.removeItem('ins_demo_user');
        } catch {
          // ignore
        }
        return null;
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
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch {
        // Continue logout even if backend API is offline
      }
    },
    onSettled: () => {
      try {
        localStorage.removeItem('ins_demo_user');
      } catch {
        // ignore
      }
      queryClient.setQueryData(['authUser'], null);
      queryClient.clear();
      setMfaChallenge(null);
    }
  });

  const loginDemo = (role: UserRole = UserRole.SUPERADMIN) => {
    const demoUser: AuthUserDto = {
      id: 'demo-superadmin-001',
      employeeCode: role === UserRole.SUPERADMIN ? 'EMP-0001' : 'EMP-0002',
      email: role === UserRole.SUPERADMIN ? 'admin@inssolar.com' : 'sales@inssolar.com',
      firstName: role === UserRole.SUPERADMIN ? 'System' : 'Rajesh',
      lastName: role === UserRole.SUPERADMIN ? 'Administrator' : 'Sharma',
      phone: '+919876500000',
      department: role === UserRole.SUPERADMIN ? Department.ADMIN : Department.SALES,
      role,
      permissions: [],
      isActive: true,
      mfaEnabled: false
    };
    try {
      localStorage.setItem('ins_demo_user', JSON.stringify(demoUser));
    } catch {
      // ignore
    }
    queryClient.setQueryData(['authUser'], demoUser);
  };

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
        loginDemo,
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
