import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { HealthStatusPage } from './pages/HealthStatusPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { MfaChallengePage } from './pages/MfaChallengePage.js';
import { MfaSetupPage } from './pages/MfaSetupPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route
            index
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="login" element={<LoginPage />} />
          <Route path="mfa-challenge" element={<MfaChallengePage />} />
          <Route
            path="mfa-setup"
            element={
              <ProtectedRoute>
                <MfaSetupPage />
              </ProtectedRoute>
            }
          />
          <Route path="health" element={<HealthStatusPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};
