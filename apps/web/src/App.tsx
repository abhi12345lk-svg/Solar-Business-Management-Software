import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { HealthStatusPage } from './pages/HealthStatusPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { LeadsPage } from './pages/LeadsPage.js';
import { LeadDetailPage } from './pages/LeadDetailPage.js';
import { SurveysPage } from './pages/SurveysPage.js';
import { SolarDesignPage } from './pages/SolarDesignPage.js';
import { CustomersPage } from './pages/CustomersPage.js';
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
import { CustomerPortalPage } from './pages/CustomerPortalPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { CustomerInvoicesPage } from './pages/CustomerInvoicesPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { CreateDocumentPage } from './pages/CreateDocumentPage.js';
import { SitePhotosPage } from './pages/SitePhotosPage.js';
import { ServiceHubPage } from './pages/ServiceHubPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { TeamsPage } from './pages/TeamsPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { ProtectedRoute } from './components/common/ProtectedRoute.js';

export const App: React.FC = () => {
  React.useEffect(() => {
    try {
      if (localStorage.getItem('solar_clean_slate_demo_v2') !== 'true') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith('solar_photos_') ||
              k === 'solar_cached_customers' ||
              k === 'solar_installer_active_customer_id' ||
              k === 'ins_demo_user')
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('solar_clean_slate_demo_v2', 'true');
      }
    } catch {}
  }, []);

  return (
    <AuthProvider>
      <Routes>
        {/* Full-Screen Dedicated Authentication Routes */}
        <Route path="login" element={<LoginPage />} />
        <Route path="mfa-challenge" element={<Navigate to="/login" replace />} />

        {/* Standalone Customer Portal Routes (Customer OTP / Magic-Link Isolated) */}
        <Route
          path="customer-portal"
          element={
            <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 max-w-6xl mx-auto">
              <CustomerPortalPage />
            </div>
          }
        />
        <Route
          path="portal"
          element={
            <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 max-w-6xl mx-auto">
              <CustomerPortalPage />
            </div>
          }
        />
        <Route
          path="customer-portal/service"
          element={
            <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 max-w-6xl mx-auto">
              <CustomerPortalPage defaultTab="SERVICE" />
            </div>
          }
        />
        <Route
          path="customer-portal/payments"
          element={
            <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 max-w-6xl mx-auto">
              <CustomerPortalPage defaultTab="PAYMENTS" />
            </div>
          }
        />

        {/* Main Authenticated Internal ERP Application Shell */}
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
            element={<Navigate to="/" replace />}
          />
          <Route
            path="leads"
            element={
              <ProtectedRoute requiredPermission="lead:read">
                <LeadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads/:id"
            element={
              <ProtectedRoute requiredPermission="lead:read">
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <ProtectedRoute requiredPermission="customer:read">
                <CustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="follow-ups"
            element={
              <ProtectedRoute requiredPermission="lead:read">
                <Navigate to="/leads" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="surveys"
            element={
              <ProtectedRoute requiredPermission="survey:read">
                <SurveysPage />
              </ProtectedRoute>
            }
          />
          <Route path="survey" element={<Navigate to="/surveys" replace />} />
          <Route
            path="solar-designs"
            element={
              <ProtectedRoute requiredPermission="design:read">
                <SolarDesignPage />
              </ProtectedRoute>
            }
          />
          <Route path="solar-design" element={<Navigate to="/solar-designs" replace />} />
          <Route path="customer" element={<Navigate to="/customers" replace />} />
          <Route path="lead" element={<Navigate to="/leads" replace />} />
          <Route path="quotation" element={<Navigate to="/quotations" replace />} />
          <Route path="order" element={<Navigate to="/orders" replace />} />
          <Route path="project" element={<Navigate to="/projects" replace />} />
          <Route
            path="quotations"
            element={
              <ProtectedRoute requiredPermission="quote:read">
                <QuotationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="quotations/:id"
            element={
              <ProtectedRoute requiredPermission="quote:read">
                <QuotationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute requiredPermission="order:read">
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <ProtectedRoute requiredPermission="order:read">
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects"
            element={
              <ProtectedRoute requiredPermission="project:read">
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects/:id"
            element={
              <ProtectedRoute requiredPermission="project:read">
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="installations/*" element={<Navigate to="/site-photos" replace />} />
          <Route path="installations" element={<Navigate to="/site-photos" replace />} />
          <Route path="installer" element={<Navigate to="/projects" replace />} />
          <Route path="installation" element={<Navigate to="/site-photos" replace />} />
          <Route
            path="net-metering"
            element={
              <ProtectedRoute requiredPermission="net_metering:read">
                <NetMeteringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="subsidies"
            element={
              <ProtectedRoute requiredPermission="subsidy:read">
                <SubsidyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute requiredPermission="inv:read">
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="vendors"
            element={
              <ProtectedRoute requiredPermission="vendor:read">
                <VendorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <ProtectedRoute requiredPermission="po:read">
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders/:id"
            element={
              <ProtectedRoute requiredPermission="po:read">
                <PurchaseOrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="goods-receipts"
            element={
              <ProtectedRoute requiredPermission="grn:read">
                <GoodsReceiptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="vendor-invoices"
            element={
              <ProtectedRoute requiredPermission="vendor_invoice:read">
                <VendorInvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="service"
            element={
              <ProtectedRoute requiredPermission="service:ticket_read">
                <ServiceHubPage />
              </ProtectedRoute>
            }
          />
          <Route path="complaints" element={<Navigate to="/service?tab=tickets" replace />} />
          <Route path="warranties" element={<Navigate to="/service?tab=warranties" replace />} />
          <Route path="amc" element={<Navigate to="/service?tab=amc" replace />} />
          <Route path="service-visits" element={<Navigate to="/service?tab=visits" replace />} />
          <Route
            path="customer-invoices"
            element={
              <ProtectedRoute requiredPermission="account:invoice_read">
                <CustomerInvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="payments"
            element={
              <ProtectedRoute requiredPermission="payment:read">
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="expenses"
            element={
              <ProtectedRoute requiredPermission="expense:read">
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="employees"
            element={
              <ProtectedRoute requiredPermission="employee:read">
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="teams"
            element={
              <ProtectedRoute requiredPermission="team:read">
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tasks"
            element={
              <ProtectedRoute requiredPermission="task:read">
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-document"
            element={
              <ProtectedRoute requiredPermission="document:upload">
                <CreateDocumentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="site-photos"
            element={
              <ProtectedRoute requiredPermission="installation:read">
                <SitePhotosPage initialTab="photos" />
              </ProtectedRoute>
            }
          />
          <Route
            path="equipment-barcodes"
            element={<Navigate to="/site-photos" replace />}
          />
          <Route
            path="installation-docs"
            element={<Navigate to="/site-photos" replace />}
          />
          <Route
            path="documents/create"
            element={
              <ProtectedRoute requiredPermission="document:upload">
                <CreateDocumentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents"
            element={
              <ProtectedRoute requiredPermission="document:read">
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
