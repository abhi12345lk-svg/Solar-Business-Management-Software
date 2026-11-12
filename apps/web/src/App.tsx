import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { HealthStatusPage } from './pages/HealthStatusPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { MfaChallengePage } from './pages/MfaChallengePage.js';
import { MfaSetupPage } from './pages/MfaSetupPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { LeadsPage } from './pages/LeadsPage.js';
import { CustomersPage } from './pages/CustomersPage.js';
import { FollowUpsPage } from './pages/FollowUpsPage.js';
import { SurveysPage } from './pages/SurveysPage.js';
import { SolarDesignPage } from './pages/SolarDesignPage.js';
import { QuotationsPage } from './pages/QuotationsPage.js';
import { QuotationDetailPage } from './pages/QuotationDetailPage.js';
import { OrdersPage } from './pages/OrdersPage.js';
import { OrderDetailPage } from './pages/OrderDetailPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { VendorsPage } from './pages/VendorsPage.js';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage.js';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage.js';
import { GoodsReceiptsPage } from './pages/GoodsReceiptsPage.js';
import { VendorInvoicesPage } from './pages/VendorInvoicesPage.js';
import { NetMeteringPage } from './pages/NetMeteringPage.js';
import { SubsidyPage } from './pages/SubsidyPage.js';
import { ServiceHubPage } from './pages/ServiceHubPage.js';
import { CustomerServicePortalPage } from './pages/CustomerServicePortalPage.js';
import { CustomerPortalPage } from './pages/CustomerPortalPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { CustomerPaymentsPortalPage } from './pages/CustomerPaymentsPortalPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { TeamsPage } from './pages/TeamsPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { CreateDocumentPage } from './pages/CreateDocumentPage.js';
import { SitePhotosPage } from './pages/SitePhotosPage.js';
import { InstallationsPage } from './pages/InstallationsPage.js';
import { InstallationDetailPage } from './pages/InstallationDetailPage.js';
import { InstallationWorkflowPage } from './pages/InstallationWorkflowPage.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Full-Screen Dedicated Authentication Routes */}
        <Route path="login" element={<LoginPage />} />
        <Route path="mfa-challenge" element={<MfaChallengePage />} />

        {/* Main Authenticated Application Shell */}
        <Route path="/" element={<AppLayout />}>
          <Route
            index
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
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
                <Navigate to="/leads" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <ProtectedRoute>
                <CustomersPage />
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
          <Route path="solar-design" element={<Navigate to="/solar-designs" replace />} />
          <Route path="customer" element={<Navigate to="/customers" replace />} />
          <Route path="lead" element={<Navigate to="/leads" replace />} />
          <Route path="survey" element={<Navigate to="/surveys" replace />} />
          <Route path="quotation" element={<Navigate to="/quotations" replace />} />
          <Route path="order" element={<Navigate to="/orders" replace />} />
          <Route path="project" element={<Navigate to="/projects" replace />} />
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
            path="projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="installations"
            element={
              <ProtectedRoute>
                <InstallationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="installations/new"
            element={
              <ProtectedRoute>
                <InstallationWorkflowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="installations/:id"
            element={
              <ProtectedRoute>
                <InstallationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="installations/:id/edit"
            element={
              <ProtectedRoute>
                <InstallationWorkflowPage />
              </ProtectedRoute>
            }
          />
          <Route path="installer" element={<Navigate to="/installations" replace />} />
          <Route path="installation" element={<Navigate to="/installations" replace />} />
          <Route
            path="net-metering"
            element={
              <ProtectedRoute>
                <NetMeteringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="subsidies"
            element={
              <ProtectedRoute>
                <SubsidyPage />
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
          <Route
            path="vendors"
            element={
              <ProtectedRoute>
                <VendorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <ProtectedRoute>
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders/:id"
            element={
              <ProtectedRoute>
                <PurchaseOrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="goods-receipts"
            element={
              <ProtectedRoute>
                <GoodsReceiptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="vendor-invoices"
            element={
              <ProtectedRoute>
                <VendorInvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="service"
            element={
              <ProtectedRoute>
                <ServiceHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="complaints"
            element={
              <ProtectedRoute>
                <Navigate to="/service?tab=tickets" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="warranties"
            element={
              <ProtectedRoute>
                <Navigate to="/service?tab=warranties" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="amc"
            element={
              <ProtectedRoute>
                <Navigate to="/service?tab=amc" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="service-visits"
            element={
              <ProtectedRoute>
                <Navigate to="/service?tab=visits" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="customer-portal/service"
            element={
              <ProtectedRoute>
                <CustomerServicePortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customer-portal"
            element={
              <ProtectedRoute>
                <CustomerPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="portal"
            element={
              <ProtectedRoute>
                <CustomerPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="payments"
            element={
              <ProtectedRoute>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="expenses"
            element={
              <ProtectedRoute>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customer-portal/payments"
            element={
              <ProtectedRoute>
                <CustomerPaymentsPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="employees"
            element={
              <ProtectedRoute>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tasks"
            element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-document"
            element={
              <ProtectedRoute>
                <CreateDocumentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="site-photos"
            element={
              <ProtectedRoute>
                <SitePhotosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents/create"
            element={
              <ProtectedRoute>
                <CreateDocumentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="document-vault"
            element={<Navigate to="/documents" replace />}
          />
          <Route path="health" element={<HealthStatusPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};
