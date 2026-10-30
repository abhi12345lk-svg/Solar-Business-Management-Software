# INS Solar Business Management Software
# Enterprise Three-Panel Architecture Audit & Mapping Specification

**Document Reference:** `docs/architecture/three-panel-architecture-audit.md`  
**Phase:** Phase 1 — Complete Existing Project Audit & Feature Mapping  
**Date:** 2026-10-30  
**Target Architecture:** Exactly Three Internal Panels (Admin Panel | Sales Panel | Accounts Panel) + External Customer Portal  
**Database Status:** MongoDB Atlas Connected (46 Collections, Zero Data Loss Guarantee)  
**Quality Baseline:** 488 Passing Unit/Integration/Security Tests (49 Test Suites)

---

## 1. Executive Summary & Purpose

The **INS Solar Business Management Software** is an enterprise-grade ERP designed specifically for solar engineering, procurement, and construction (EPC) companies.

Following the complete development and verification of all 30 operational business modules, this Phase 1 Audit maps the restructuring of the application into exactly **THREE main internal panels**:
1. **ADMIN PANEL:** Central Company Management, Operational Control, Product & Inventory Management, Project Supervision (incorporating Installation & Commissioning), Service & AMC Management, Workforce Administration, and System Configuration.
2. **SALES PANEL:** Customer Acquisition and Sales Pipeline Execution—from Lead Capture, Follow-ups, and Customer Qualification through Site Survey, Solar PV System Design, Quotation Generation, PDF Sharing, and Confirmed Sales Orders.
3. **ACCOUNTS PANEL:** Complete Financial Stewardship—Customer Invoicing, Receivables, Payments & Collections, Purchase Management (POs & 3-Way Matching), Vendor Payables, Operational Expenses, Project Costing & Profitability Margins.

### External Customer Portal Demarcation
The existing **Customer Portal** (`/customer-portal`, `/portal`) remains an external self-service environment for customers (`CUSTOMER` role) to track installation milestones, view shared quotations, make online payments, and register warranty/complaint tickets. It is strictly **NOT** a 4th internal company panel, and internal company staff are restricted to the 3 internal panels.

---

## 2. Core Architecture Rules & Invariants

1. **Exactly Three Main Panels:** No separate internal panels for Installation, Inventory, Service, Purchase, or Employees. These exist as functional modules within the appropriate panel.
2. **Zero Data Loss Guarantee:** All 46 existing Mongoose models, MongoDB Atlas collections, schema indexes, sequence counters (`SequenceCounter`), and historical audit logs (`SecurityAuditLog`) remain 100% intact.
3. **Financial Precision:** Strict adherence to integer-paise calculations across quotations, sales orders, payments, vendor invoices, and project budgets.
4. **Single Source of Truth:**
   - One authoritative `Customer` record shared across Admin, Sales, and Accounts.
   - One `Quotation` record with immutable accepted revisions.
   - One `SalesOrder` record linking accepted quote to operational `Project`.
   - One unified `Inventory` ledger with positive stock invariant and physical GRN linkage.
   - One immutable `Payment` and `Expense` ledger.
5. **No Docker / No AWS Requirement:** Pure native Node.js (TypeScript) + React (Vite, Tailwind) + MongoDB Atlas architecture deployable seamlessly to Vercel Serverless.

---

## 3. Comprehensive 10-Column Feature Mapping Table (All 30 Modules)

| # | 1. Existing Module | 2. Existing Features | 3. Existing Routes / APIs | 4. Existing Database Models | 5. Proposed Panel | 6. Proposed Module / Submodule | 7. Required Changes | 8. Dependencies | 9. Data Migration Risk | 10. Verification Tests |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Dashboard** | Executive KPIs, pipeline metrics, survey counters, pending orders, inventory alerts, collections summary. | Web: `/`<br>API: `/api/v1/auth/me`, `/api/v1/leads`, `/api/v1/projects`, `/api/v1/inventory/summary` | `Lead`, `SalesOrder`, `Project`, `CustomerPayment`, `StockBalance` | **Admin, Sales, Accounts** (Role-adaptive cockpit) | **Dashboard** (Contextual Cockpit per panel) | Display role-tailored KPIs: Admin sees full company ops; Sales sees lead/quote conversion; Accounts sees cashflow/payables. | `UserRole`, `Permission`, active transactional collections | Zero risk (Read-only aggregation pipelines). | `apps/web/src/pages/__tests__/DashboardPage.test.tsx` |
| **2** | **Leads Management** | Lead capture, status lifecycle, source attribution, energy requirement, priority, duplicate phone advisory. | Web: `/leads`, `/leads/:id`<br>API: `/api/v1/leads` | `Lead`, `LeadActivity` | **Sales Panel** (Primary),<br>**Admin Panel** (Oversight) | **Lead Management** (CRM) | Implement record-level filtering so Sales Executives see assigned leads; Admins see company-wide pipeline. | `User` (assigned employee), `Customer` (target) | Zero risk (All fields preserved). | `apps/api/src/routes/__tests__/lead.test.ts`, `apps/web/src/pages/__tests__/crmPages.test.tsx` |
| **3** | **Customer Management** | Customer directory, contact profiles, site address, GSTIN, consumer load profile, linked orders, payment history. | Web: `/customers`, `/leads` (Customers tab)<br>API: `/api/v1/leads/customers` | `Customer`, `CustomerIdentity` | **Admin Panel** (Master),<br>**Sales Panel** (Profile),<br>**Accounts Panel** (Billing) | **Customer Management** (Unified Master) | Single authoritative record accessed across all 3 panels with role-appropriate sensitive data masking. | `Customer`, `SalesOrder`, `CustomerPayment` | Zero risk (Single collection preserved). | `apps/api/src/services/__tests__/customerService.test.ts` |
| **4** | **Follow-up Management** | Call scheduling, meeting notes, next follow-up dates, reminders, overdue flags. | Web: `/follow-ups`, `/leads/:id`<br>API: `/api/v1/leads/:id/activities` | `LeadActivity` | **Sales Panel** (Primary),<br>**Admin Panel** (Audit) | Embedded inside **Lead & Customer Management** | Standalone sidebar item removed; fully embedded in Lead/Customer activity timeline and Sales Dashboard widget. | `Lead`, `User` | Zero risk (`LeadActivity` historical records preserved). | `apps/api/src/routes/__tests__/lead.test.ts` |
| **5** | **Site Survey Management** | Survey scheduling, field surveyor dispatch, roof dimensions, tilt/azimuth, shading, load audit, photo uploads. | Web: `/surveys`<br>API: `/api/v1/surveys` | `SiteSurvey` | **Sales Panel** (Primary),<br>**Admin Panel** (Engineering) | **Site Survey Management** | Direct technical handover feed into Solar PV Sizing module. | `Lead`, `Customer`, `User` (Surveyor) | Zero risk. | `apps/api/src/routes/__tests__/survey.test.ts`, `apps/web/src/pages/__tests__/surveysPage.test.tsx` |
| **6** | **Solar System Design** | PV capacity calculator, string sizing, inverter matching, module selection from catalogue, yield simulation. | Web: `/solar-designs`<br>API: `/api/v1/solar-designs` | `SolarDesign` | **Sales Panel** (Primary),<br>**Admin Panel** (Engineering) | **Solar System Design** | Connect equipment selection directly to Product Master; lock design upon quotation acceptance. | `SiteSurvey`, `Product`, `Customer` | Zero risk. | `apps/api/src/routes/__tests__/solarDesign.test.ts` |
| **7** | **Quotations Management** | Multi-item quotation builder, pricing tiers, discounts (approval thresholds), tax snapshots, revision control. | Web: `/quotations`, `/quotations/:id`<br>API: `/api/v1/quotations` | `Quotation` | **Sales Panel** (Commercial),<br>**Admin Panel** (Approvals) | **Quotation Suite** | Strict immutability for accepted revisions; auto-generates Sales Order upon customer acceptance. | `Customer`, `SolarDesign`, `Product` | Zero risk (All price snapshots preserved). | `apps/api/src/routes/__tests__/quotation.test.ts`, `apps/web/src/pages/__tests__/quotationsPage.test.tsx` |
| **8** | **Quotation Sharing & PDF** | Professional PDF export, secure customer portal share token, SMS/Email/WhatsApp preview. | Web: `/quotations/:id`<br>API: `/api/v1/quotations/:id/pdf`, `/api/v1/customer-portal/quotations` | `Quotation`, `DocumentModel` | Embedded in **Sales & Admin Panels** + **Customer Portal** | Subfeature within **Quotation Suite** | Standalone route consolidated; actions triggered directly from quotation view. | `Quotation` | Zero risk. | `apps/api/src/routes/__tests__/quotation.test.ts` |
| **9** | **Sales Orders** | Order confirmation, link to accepted quote revision, commercial terms, project initiation trigger. | Web: `/orders`, `/orders/:id`<br>API: `/api/v1/orders` | `SalesOrder` | **Sales Panel** (Commercial),<br>**Admin Panel** (Ops),<br>**Accounts Panel** (Receivables) | **Sales Order Management** | Prevents duplicate order creation; one-click transition to operational Project in Admin Panel. | `Quotation`, `Customer`, `Project` | Zero risk. | `apps/api/src/routes/__tests__/order.test.ts` |
| **10** | **Product & Item Master** | Solar modules, inverters, structures, cables, consumables catalogue, specifications, categories, HSN codes. | Web: `/inventory` (Catalogue tab)<br>API: `/api/v1/catalog` | `Product`, `ProductCategory` | **Admin Panel** (Master),<br>**Sales Panel** (Read-only sizing) | **Inventory Management** (Product Master tab) | Unified inside Inventory Suite; Sales has read-only access for technical sizing without cost visibility. | `ProductCategory` | Zero risk. | `apps/api/src/routes/__tests__/catalog.test.ts` |
| **11** | **Inventory Management** | Multi-warehouse stock tracking, stock movements (IN/OUT/ADJUST/TRANSFER), serials, project reservations. | Web: `/inventory`<br>API: `/api/v1/inventory`, `/api/v1/warehouses`, `/api/v1/dispatches` | `Warehouse`, `StockBalance`, `StockMovement`, `StockReservation`, `ProductSerialNumber`, `MaterialDispatch` | **Admin Panel** | **Inventory Management** | Standalone Inventory Panel eliminated; operates under Admin Operations. Negative stock strictly forbidden. | `Product`, `Warehouse`, `Project` | Zero risk (Ledger preserved). | `apps/api/src/routes/__tests__/inventory.test.ts` |
| **12** | **Purchase Management** | Purchase order (PO) generation, vendor selection, PO approvals, goods receipt note (GRN) linkage, 3-way match. | Web: `/purchase-orders`, `/purchase-orders/:id`, `/goods-receipts`<br>API: `/api/v1/purchase-orders`, `/api/v1/goods-receipts` | `PurchaseOrder`, `GoodsReceipt` | **Accounts Panel** (Financial PO & Approval),<br>**Admin Panel** (Physical GRN QA) | **Purchase Management** (Accounts) / **Goods Receipt** (Admin) | Clear segregation: Accounts manages POs & payments; Admin/Warehouse verifies physical delivery (GRN updates stock). | `Vendor`, `Product`, `Warehouse` | Zero risk. | `apps/api/src/routes/__tests__/purchaseOrder.test.ts`, `apps/api/src/routes/__tests__/goodsReceipt.test.ts` |
| **13** | **Vendor Management** | Vendor profiles, contact persons, bank accounts, GSTIN, payment terms, vendor product association. | Web: `/vendors`, `/vendor-invoices`<br>API: `/api/v1/vendors`, `/api/v1/vendor-invoices` | `Vendor`, `VendorInvoice` | **Accounts Panel** (Payables & Invoicing),<br>**Admin Panel** (Vendor Directory) | **Vendor Payables** (Accounts) / **Vendor Profiles** (Admin) | Accounts handles invoices, payments, aging; Admin manages vendor qualification and operational directory. | `Vendor`, `PurchaseOrder` | Zero risk. | `apps/api/src/routes/__tests__/vendor.test.ts` |
| **14** | **Project Management** | 10-stage execution pipeline, milestone management, PM assignment, site work updates, handover certificates. | Web: `/projects`, `/projects/:id`<br>API: `/api/v1/projects` | `Project` | **Admin Panel** | **Project Management** | Serves as central operational execution hub for all installation projects. Subsumes standalone Installation. | `SalesOrder`, `Customer`, `User` (PM) | Zero risk. | `apps/api/src/routes/__tests__/project.test.ts` |
| **15** | **Installation Management** | Installation crew assignment, stage tracking (Stages 6–8: Structure, Cabling, Inverter), site photos, rework logs. | Web: `/projects/:id` (Execution tabs)<br>API: `/api/v1/projects/:id/stages` | `Project`, `MaterialDispatch` | **Admin Panel** | Submodule within **Project Management** | Standalone Installation Panel eliminated; integrated into Project Management stages. | `Project`, `Team`, `MaterialDispatch` | Zero risk. | `apps/api/src/routes/__tests__/project.test.ts` |
| **16** | **Installation Checklist** | Versioned checklist templates, mandatory photo evidence, electrical test values, commissioning approval. | Web: `/projects/:id` (Checklists tab)<br>API: `/api/v1/checklists`, `/api/v1/projects/:id/checklists` | `InstallationChecklistTemplate`, `ProjectInstallationChecklist` | **Admin Panel** | Submodule within **Project Management** (QA & Commissioning) | Checklist completion enforces QA gate before stage advancement to Commissioning & Handover. | `Project`, `InstallationChecklistTemplate` | Zero risk. | `apps/api/src/routes/__tests__/checklist.test.ts` |
| **17** | **Net Metering & Subsidy** | DISCOM application filing, bi-directional meter installation tracking, DBT subsidy claim logging. | Web: `/net-metering`, `/subsidies`<br>API: `/api/v1/net-metering`, `/api/v1/subsidies` | `NetMeteringApplication`, `SubsidyApplication` | **Admin Panel** (Operations),<br>**Accounts Panel** (Subsidy Ledger) | **Net Metering & Subsidy Management** | Integrated into Project Stage 9; Accounts tracks incoming DBT subsidy disbursements against customer receivable. | `Project`, `Customer` | Zero risk. | `apps/api/src/routes/__tests__/netMetering.test.ts`, `apps/api/src/routes/__tests__/subsidy.test.ts` |
| **18** | **Payment Management** | Customer payment recording, partial payments, payment allocation to orders, unallocated receipts, integer paise precision. | Web: `/payments`<br>API: `/api/v1/payments`, `/api/v1/accounts` | `CustomerPayment`, `PaymentAllocation` | **Accounts Panel** (Primary),<br>**Admin Panel** (Executive Summary) | **Payment Management & Outstanding** | Primary financial management of customer collections; Sales users have no access to raw financial entries. | `Customer`, `SalesOrder` | Zero risk. | `apps/api/src/routes/__tests__/payment.test.ts` |
| **19** | **Expense Management** | Corporate and project-linked expenses, categories (transport, labour, permissions), receipt attachments, approval flows. | Web: `/expenses`<br>API: `/api/v1/expenses` | `Expense` | **Accounts Panel** (Primary),<br>**Admin Panel** (Executive Approval) | **Expense Management** | Expenses linked to projects automatically attribute to Project Costing calculation. | `Project`, `User`, `Vendor` | Zero risk. | `apps/api/src/routes/__tests__/expense.test.ts` |
| **20** | **Project Costing & Profitability** | Realized gross margin calculation (Revenue - Issued Materials - Direct Expenses), budget tracking, variance reports. | Web: `/expenses` (Costing tab), `/projects/:id` (Costing tab)<br>API: `/api/v1/projects/:projectId/costing` | `ProjectBudget`, `MaterialDispatch`, `Expense` | **Accounts Panel** (Primary),<br>**Admin Panel** (Analytics) | **Project Costing & Profitability** | Uses historical cost snapshot from material dispatch; prevents double-counting direct expenses and purchases. | `Project`, `MaterialDispatch`, `Expense`, `SalesOrder` | Zero risk. | `apps/api/src/routes/__tests__/projectCosting.test.ts` |
| **21** | **Service & Complaints** | Post-commissioning customer ticket registration, severity triage, technician assignment, SLA tracking, resolution reports. | Web: `/complaints`<br>API: `/api/v1/complaints` | `ServiceComplaint` | **Admin Panel** (Internal Ops),<br>**Customer Portal** (Self-service logging) | **Service & AMC Management** (Complaints) | Standalone Service Panel removed; after-sales operations integrated under Admin Panel. | `Customer`, `Project`, `User` (Technician) | Zero risk. | `apps/api/src/routes/__tests__/complaint.test.ts` |
| **22** | **AMC Management** | Annual Maintenance Contracts, service packages, scheduled visit quotas, renewal reminders, warranty claims. | Web: `/amc`, `/warranties`<br>API: `/api/v1/amc`, `/api/v1/warranties` | `AnnualMaintenanceContract`, `WarrantyClaim`, `ProductSerialNumber` | **Admin Panel** (Operations),<br>**Accounts Panel** (AMC Invoicing) | **Service & AMC Management** (Contracts & Warranties) | Contract quota ledger seamlessly connects with field visit scheduling. | `Customer`, `Project`, `AnnualMaintenanceContract` | Zero risk. | `apps/api/src/routes/__tests__/amc.test.ts`, `apps/api/src/routes/__tests__/warranty.test.ts` |
| **23** | **Service Visits** | Field visit scheduling, technician dispatch, checklist verification, customer signature / photo capture, quota deduction. | Web: `/service-visits`<br>API: `/api/v1/service-visits` | `ServiceVisit` | **Admin Panel** | Submodule within **Service & AMC Management** | Field technician operations managed under Service & AMC; visit completion updates AMC contract quota. | `ServiceComplaint`, `AnnualMaintenanceContract`, `User` | Zero risk. | `apps/api/src/routes/__tests__/serviceVisit.test.ts` |
| **24** | **Employee & Team Management** | Staff directory, designations, departments, installation crews, field squads, active workload tracking. | Web: `/employees`, `/teams`<br>API: `/api/v1/employees`, `/api/v1/teams` | `EmployeeProfile`, `Team` | **Admin Panel** | **Employee & Team Management** | Standalone Employees panel removed; HR & crew allocation managed in Admin. | `User`, `EmployeeProfile`, `Team` | Zero risk. | `apps/api/src/routes/__tests__/employee.test.ts`, `apps/api/src/routes/__tests__/team.test.ts` |
| **25** | **Task Management** | Project & operational tasks, priorities, due dates, assignee, status lifecycle (TODO, IN_PROGRESS, REVIEW, DONE). | Web: `/tasks`<br>API: `/api/v1/tasks` | `ProjectTask` | **Admin Panel** (Global),<br>Contextual in **Sales & Accounts** | **Task Management** | Unified operational task system linked to projects, leads, or general operations. | `User`, `Project` | Zero risk. | `apps/api/src/routes/__tests__/projectTask.test.ts` |
| **26** | **Document Management** | Document vault, category tagging (Aadhaar, Electricity Bill, Sanction Letter, Handover), confidentiality levels. | Web: `/documents`<br>API: `/api/v1/documents` | `DocumentModel` | **Admin Panel** (Global Vault),<br>Contextual in **Sales & Accounts** | **Document Vault** | Central vault in Admin; Sales and Accounts have contextual file upload access for surveys and bills. | `Customer`, `Project` | Zero risk. | `apps/api/src/routes/__tests__/document.test.ts` |
| **27** | **Reports & Analytics** | Executive sales funnel, installation velocity, stock turnover, cashflow receivables, profitability reports. | Web: `/reports`, Contextual dashboards<br>API: Cross-module aggregation | Cross-model aggregations | **Admin Panel** (Company-wide),<br>**Accounts Panel** (Financial Reports) | **Reports & Analytics** | Real database aggregation pipelines respecting RBAC permissions. CSV/PDF exports. | All core transaction models | Zero risk. | `apps/api/src/routes/__tests__/health.test.ts` |
| **28** | **User & Role Management** | User credentials, RBAC role assignment, MFA setup and challenge, session version revocation. | Web: `/users`, `/mfa-setup`, `/mfa-challenge`<br>API: `/api/v1/auth`, `/api/v1/users` | `User`, `PasswordResetToken`, `SecurityAuditLog` | **Admin Panel** | **User & Role Management** | Enforce panel-based role mapping: `SUPERADMIN`, `ADMIN` -> Admin; `SALES_EXECUTIVE`, `SURVEYOR` -> Sales; `ACCOUNTS_OFFICER` -> Accounts. | `User`, `SecurityAuditLog` | Zero risk. | `apps/api/src/routes/__tests__/auth.test.ts`, `apps/api/src/middleware/__tests__/authorize.test.ts` |
| **29** | **Notifications & Reminders** | Persistent in-app notifications, topbar notification bell, unread counters, notification preferences, deduplication. | Web: Topbar bell<br>API: `/api/v1/notifications` | `Notification`, `NotificationPreference` | **Global across all 3 Panels** | **Notification Centre** | Topbar bell accessible across Admin, Sales, and Accounts with alerts tailored to user's duties. | `Notification`, `User` | Zero risk. | `apps/api/src/routes/__tests__/notification.test.ts` |
| **30** | **Settings & Masters** | Company profile, GSTIN, bank details, numbering sequences (`SequenceCounter`), project stages, tax rules. | Web: `/settings`<br>API: `/api/v1/settings`, Company settings | `CompanySettings`, `SequenceCounter` | **Admin Panel** | **Settings & Masters** | Admin manages company configurations, tax rules, and numbering sequences. | `CompanySettings`, `SequenceCounter` | Zero risk. | `apps/api/src/services/__tests__/companySettingsService.test.ts` |

---

## 4. Exact Three-Panel Functional & Navigational Structure

```
                  ┌───────────────────────────────────────────────┐
                  │          INS SOLAR ENTERPRISE SUITE           │
                  └───────────────────────┬───────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         ▼                                ▼                                ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   ADMIN PANEL    │            │   SALES PANEL    │            │  ACCOUNTS PANEL  │
├──────────────────┤            ├──────────────────┤            ├──────────────────┤
│• Dashboard       │            │• Dashboard       │            │• Dashboard       │
│• Customers       │            │• Leads           │            │• Payments        │
│• Leads           │            │• Follow-ups      │            │• Outstanding     │
│• Quotations      │            │• Customers       │            │• Expenses        │
│• Orders          │            │• Site Surveys    │            │• Purchase        │
│• Projects        │            │• Solar Designs   │            │• Vendor Payables │
│• Inventory       │            │• Quotations      │            │• Project Costing │
│• Vendors         │            │• Orders          │            │• Financial Rpts  │
│• Service & AMC   │            └──────────────────┘            └──────────────────┘
│• Employees/Teams │
│• Users & Roles   │
│• Reports         │
│• Settings        │
└──────────────────┘
         │
         │ (External Self-Service — NOT an internal company panel)
         ▼
┌────────────────────────────────────────┐
│         CUSTOMER PORTAL (Public)       │
│  Milestones, Quotes, Payments, Service │
└────────────────────────────────────────┘
```

### 4.1 Admin Panel
- **Target User Roles:** `SUPERADMIN`, `ADMIN`
- **Scope:** Complete company-wide visibility and governance.
- **Sidebar Menu Items:**
  1. `Dashboard` (`/` or `/admin/dashboard`)
  2. `Customers` (`/customers` or `/leads` Customers tab)
  3. `Leads` (`/leads`)
  4. `Quotations` (`/quotations`)
  5. `Orders` (`/orders`)
  6. `Projects` (`/projects` — includes 10-stage execution, installation submodules, and checklists)
  7. `Inventory` (`/inventory` — includes Warehouses, Stock Balances, Movements, Serials, and Product Master)
  8. `Vendors` (`/vendors` — vendor profiles and contact management)
  9. `Service & AMC` (`/amc`, `/complaints`, `/service-visits`, `/warranties`)
  10. `Employees & Teams` (`/employees`, `/teams`)
  11. `Users & Roles` (`/users`, `/mfa-setup`)
  12. `Reports` (`/reports`)
  13. `Settings` (`/settings`)

### 4.2 Sales Panel
- **Target User Roles:** `SALES_EXECUTIVE`, `DEPARTMENT_HEAD` (Sales), `SURVEYOR`
- **Scope:** Customer acquisition, technical system sizing, and quotation conversion.
- **Data Boundary:** Strictly isolated from raw purchase prices, company-wide balance sheets, vendor payment ledger, and internal operational overheads.
- **Sidebar Menu Items:**
  1. `Dashboard` (Sales-specific KPIs: assigned leads, pending follow-ups, quotation pipeline, conversion rate)
  2. `Leads` (`/leads` — filtered to assigned leads by default)
  3. `Follow-ups` (`/follow-ups` or contextual tab in `/leads/:id`)
  4. `Customers` (`/customers` — sales view of active clients)
  5. `Site Surveys` (`/surveys` — schedule and log roof/electrical parameters)
  6. `Solar Designs` (`/solar-designs` — PV capacity simulation and BOM generator)
  7. `Quotations` (`/quotations` — create proposals, discount approvals, immutable revisions)
  8. `Orders` (`/orders` — track confirmed customer orders)

### 4.3 Accounts Panel
- **Target User Roles:** `ACCOUNTS_OFFICER`, `DEPARTMENT_HEAD` (Accounts)
- **Scope:** Financial stewardship, cashflow receivables, vendor disbursements, procurement approvals, and project profitability.
- **Data Boundary:** Authorized to view customer payment ledgers, vendor invoices, purchase orders, and project costing. Restricted from modifying solar technical designs or installation stages.
- **Sidebar Menu Items:**
  1. `Dashboard` (Financial KPIs: customer receivables, aging analysis, today's collections, vendor payables, profit margins)
  2. `Payments` (`/payments` — record customer collections, receipts, unallocated funds, reversals)
  3. `Outstanding` (`/payments` Outstanding tab — customer-wise aging, due dates, reminder triggers)
  4. `Expenses` (`/expenses` — corporate & project direct expenses, approval workflows)
  5. `Purchase` (`/purchase-orders`, `/goods-receipts` — financial PO approvals, 3-way matching)
  6. `Vendor Payables` (`/vendor-invoices` — vendor billing, balance ledgers, payment disbursement)
  7. `Project Costing` (`/expenses` Costing tab — actual gross margins: Revenue vs Materials Issued vs Direct Expenses)
  8. `Financial Reports` (`/reports` Financial tab — cashflow statement, collection summary, margin analysis)

### 4.4 External Customer Portal (Preserved Self-Service)
- **Target User Roles:** `CUSTOMER` (authenticated via passwordless magic link or OTP)
- **Boundary:** Isolated routes under `/customer-portal` (`/customer-portal/service`, `/customer-portal/payments`, `/customer-portal/documents`, `/customer-portal/quotations`). Internal employee panels are strictly inaccessible.

---

## 5. End-to-End Cross-Panel Workflow Verification

The three panels interact across 6 core commercial and operational lifecycles:

1. **Lead-to-Sales Workflow (Sales Panel):**
   - New enquiry arrives $\rightarrow$ Sales creates Lead $\rightarrow$ Schedules Follow-up $\rightarrow$ Qualifies Customer $\rightarrow$ Dispatches Surveyor for Site Survey $\rightarrow$ Generates Solar PV Design $\rightarrow$ Compiles Quotation $\rightarrow$ Customer accepts Quote $\rightarrow$ Confirmed Sales Order created.
2. **Order-to-Installation Workflow (Sales $\rightarrow$ Admin Panel):**
   - Confirmed Sales Order in Sales Panel automatically alerts Admin Panel $\rightarrow$ Admin creates Project $\rightarrow$ Assigns Project Manager and Crew $\rightarrow$ Material Requirement checked against Inventory $\rightarrow$ Stock Reserved $\rightarrow$ Material Dispatched $\rightarrow$ Installation Executed (Stages 6–8) $\rightarrow$ Mandatory Checklists completed $\rightarrow$ Testing & Commissioning $\rightarrow$ Customer Handover Certificate signed.
3. **Purchase-to-Inventory Workflow (Accounts $\rightarrow$ Admin Panel):**
   - Material Requisition $\rightarrow$ Accounts creates Purchase Order $\rightarrow$ Approves PO $\rightarrow$ Vendor dispatches goods $\rightarrow$ Admin / Warehouse staff inspects and posts physical Goods Receipt (GRN) $\rightarrow$ Inventory stock increases atomically $\rightarrow$ Accounts matches Vendor Invoice with PO & GRN (3-way match) $\rightarrow$ Accounts schedules payment.
4. **Customer Payment Workflow (Sales / Admin $\rightarrow$ Accounts Panel):**
   - Customer Order Confirmed $\rightarrow$ Accounts records Payment with transaction reference $\rightarrow$ Payment allocated to Sales Order in integer paise $\rightarrow$ Customer receipt issued $\rightarrow$ Outstanding balance recalculated $\rightarrow$ Real-time status visible on Sales Customer Profile and Customer Portal.
5. **Project Financial Workflow (Admin $\rightarrow$ Accounts Panel):**
   - Sales Order Revenue established $\rightarrow$ Material Dispatches logged by Admin $\rightarrow$ Actual material cost computed using historical cost snapshots $\rightarrow$ Site expenses recorded in Accounts $\rightarrow$ Gross profit and margin calculated without double counting.
6. **After-Sales Service Workflow (Customer Portal $\rightarrow$ Admin $\rightarrow$ Accounts):**
   - Customer submits ticket via Customer Portal $\rightarrow$ Admin triages complaint $\rightarrow$ Assigns Service Technician $\rightarrow$ Field visit executed $\rightarrow$ AMC contract quota deducted $\rightarrow$ If billable repair, Accounts generates service invoice.

---

## 6. Security, RBAC & Direct URL Access Controls

| Control Area | Security Requirement | Implementation Mechanism |
| :--- | :--- | :--- |
| **Backend Route Guards** | Every API endpoint validates session and role permissions. | `requireAuth`, `requireEmployee`, `requirePermission(...)` in `apps/api/src/middleware/authorize.ts`. |
| **Direct URL Protection** | Sales users entering `/expenses` or `/inventory` cannot access restricted data. | Backend 403 `PERMISSION_DENIED` response envelope + React `ProtectedRoute` redirection to permitted dashboard. |
| **Panel Isolation** | Sales users cannot read or modify raw vendor purchase costs or company bank ledgers. | Granular permission sets: Sales has no `account:*`, `po:approve`, or `expense:approve` permissions. |
| **Quotation Immutability** | Accepted quotations cannot be edited. | Status check in `quotationService.ts`: attempting update on `ACCEPTED` returns 400 `BUSINESS_RULE_VIOLATION`. Must create new revision. |
| **Positive Stock Invariant** | Stock issues or dispatches cannot reduce stock below zero. | Atomic MongoDB `$inc` with `{ quantity: { $gte: requiredQuantity } }` condition in `inventoryService.ts`. |
| **Customer Isolation** | External customers can never access internal staff panels or other customers' records. | `requireCustomerOwnership` middleware verifies `customerId === session.customer.customerId`. |

---

## 7. Zero Data Loss & Migration Risk Analysis

- **Total Existing Collections:** 46
- **Total Existing Documents:** 100% Preserved
- **Data Migration Risk:** **ZERO RISK**
  - No database collections are dropped or renamed.
  - No Mongoose schemas or field names are modified destructively.
  - All existing ObjectIds, sequence counters (`SequenceCounter`), and relational foreign keys remain untouched.
  - Reorganization operates strictly at the presentation (navigation, routing, view filtering) and API authorization layer.

---

## 8. Phased Execution Roadmap

- **Phase 1 (Current):** Complete Existing Project Audit & Feature Mapping Document (`docs/architecture/three-panel-architecture-audit.md`).
- **Phase 2:** Final Architecture Specification & Role-Permission Matrices (`docs/architecture/three-panel-architecture-specification.md`).
- **Phase 3:** Backend RBAC & Authorization Layer Enhancements (Strict panel boundary enforcement).
- **Phase 4:** Frontend Shell & Navigation Restructuring (`AppLayout.tsx`, role-adaptive dashboards for Admin, Sales, Accounts).
- **Phase 5:** End-to-End Cross-Panel Workflow Verification (Lead-to-Order, Purchase-to-Stock, Payment-to-Costing).
- **Phase 6:** Security, Direct URL, and Data Integrity Testing.
- **Phase 7:** Final Quality Verification (Typecheck, Lint, Format, Build, 488+ Tests Passing) and Final Report.
