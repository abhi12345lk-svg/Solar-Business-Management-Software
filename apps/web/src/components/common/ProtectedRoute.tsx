import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Permission, UserRole } from '@ins-solar/shared';
import { LoadingSpinner } from './LoadingSpinner.js';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission;
  requiredRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRoles
}) => {
  const { user, isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner message="Verifying security session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-card border rounded-xl shadow-sm text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
        <p className="text-xs text-muted-foreground">
          You lack the required permission token:{' '}
          <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
            {requiredPermission}
          </code>{' '}
          to access this screen.
        </p>
      </div>
    );
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-card border rounded-xl shadow-sm text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Role Restricted</h2>
        <p className="text-xs text-muted-foreground">
          Your current role (<span className="font-semibold">{user.role}</span>) is not authorized
          for this view.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
