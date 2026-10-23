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
import { LeadsPage } from './pages/LeadsPage.js';
import { LeadDetailPage } from './pages/LeadDetailPage.js';
import { FollowUpsPage } from './pages/FollowUpsPage.js';
import { SurveysPage } from './pages/SurveysPage.js';
import { SolarDesignPage } from './pages/SolarDesignPage.js';
import { QuotationsPage } from './pages/QuotationsPage.js';
import { QuotationDetailPage } from './pages/QuotationDetailPage.js';
import { OrdersPage } from './pages/OrdersPage.js';
import { OrderDetailPage } from './pages/OrderDetailPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
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
          <Route
            path="leads"
            element={
              <ProtectedRoute>
                <LeadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads/:id"
            element={
              <ProtectedRoute>
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="follow-ups"
            element={
              <ProtectedRoute>
                <FollowUpsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="surveys"
            element={
              <ProtectedRoute>
                <SurveysPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="solar-designs"
            element={
              <ProtectedRoute>
                <SolarDesignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="quotations"
            element={
              <ProtectedRoute>
                <QuotationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="quotations/:id"
            element={
              <ProtectedRoute>
                <QuotationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute>
                <InventoryPage />
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
