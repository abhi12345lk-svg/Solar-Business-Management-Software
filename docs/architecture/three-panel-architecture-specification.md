# INS Solar Business Management Software
# Enterprise Three-Panel Architecture Specification

**Document Reference:** `docs/architecture/three-panel-architecture-specification.md`  
**Phase:** Phase 2 — Final Architecture & Module Mapping Specification  
**Status:** Approved for Implementation  
**Architecture:** Exactly Three Internal Panels (Admin Panel | Sales Panel | Accounts Panel) + External Customer Portal  

---

## 1. Architectural Blueprint & Operational Domains

```
                                 ┌───────────────────────────────────────────────┐
                                 │       INS SOLAR ERP ENTERPRISE SUITE          │
                                 │        React + TypeScript + Tailwind          │
                                 │        Node.js + Express + MongoDB            │
                                 └───────────────────────┬───────────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
         ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
         │         ADMIN PANEL         │  │         SALES PANEL         │  │       ACCOUNTS PANEL        │
         ├─────────────────────────────┤  ├─────────────────────────────┤  ├─────────────────────────────┤
         │ Roles: SUPERADMIN, ADMIN    │  │ Roles: SALES_EXECUTIVE,     │  │ Roles: ACCOUNTS_OFFICER,    │
         │ Scope: Company-wide Ops     │  │        SURVEYOR, SALES_LEAD │  │        FINANCE_LEAD         │
         │                             │  │ Scope: CRM to Confirmed PO  │  │ Scope: Complete Financials  │
         ├─────────────────────────────┤  ├─────────────────────────────┤  ├─────────────────────────────┤
         │ • Central Ops Dashboard     │  │ • Sales Pipeline Dashboard  │  │ • Financial Dashboard       │
         │ • Customer Master Directory │  │ • Lead Management (CRM)     │  │ • Payment Collections       │
         │ • Lead Assignment Oversight │  │ • Follow-up Activity Engine │  │ • Outstanding & Aging       │
         │ • Quotation Approvals       │  │ • Customer Commercial Views │  │ • Expense Recording & Appr  │
         │ • Sales Order Oversight     │  │ • Site Survey Management    │  │ • Purchase Orders & Match   │
         │ • Project Management (10stg)│  │ • Solar PV System Sizing    │  │ • Vendor Payables Ledger    │
         │ • Installation & Commission │  │ • Quotation Suite & Revisions│  │ • Project Costing & Margin  │
         │ • Inventory & Product Master│  │ • Sales Order Execution     │  │ • Financial Statement Rpts  │
         │ • Physical Goods Receipt QA │  └─────────────────────────────┘  └─────────────────────────────┘
         │ • Vendor Company Directory  │
         │ • Service, Warranty & AMC   │
         │ • Employees & Field Crews   │
         │ • Users, Roles & Security   │
         │ • System Settings & Masters │
         └─────────────────────────────┘
                        │
                        │ (External Boundary — Isolated Self-Service)
                        ▼
         ┌──────────────────────────────────────────────────────────────┐
         │                EXTERNAL CUSTOMER PORTAL                      │
         │ Roles: CUSTOMER (Passwordless OTP / Token Auth)              │
         │ Scope: Project Milestones, Quote Approvals, Receipts, Service│
         └──────────────────────────────────────────────────────────────┘
```

---

## 2. Segregation of Functional Responsibilities

### 2.1 Purchase (Accounts) vs. Inventory Physical GRN (Admin)
- **Problem Solved:** Prevents inventory inflation before goods are physically verified and keeps procurement spend under strict accounting governance.
- **Accounts Responsibilities:**
  - Creates and approves official Purchase Orders (`PurchaseOrder` model) with vendor payment terms and GSTIN.
  - Matches Vendor Invoices against approved POs and verified GRNs (3-way match).
  - Manages vendor disbursements and payable aging.
  - *Invariant:* Creating or approving a Purchase Order does **NOT** increase physical stock balances.
- **Admin / Warehouse Responsibilities:**
  - Receives physical delivery at the designated warehouse.
  - Conducts physical quality inspection and records Goods Receipt Note (`GoodsReceipt` model).
  - *Invariant:* The stock balance (`StockBalance` model) increases atomically **only** upon valid GRN confirmation via `inventoryService.receiveStock(...)`.

### 2.2 Project Management (Admin) vs. Installation & Commissioning Execution
- **Problem Solved:** Eliminates disconnected installation silos while preserving thorough quality and safety checklists.
- **Integrated Project Pipeline (10 Stages):**
  - Stage 1: Site Feasibility & Structural Assessment
  - Stage 2: Technical Design Approval
  - Stage 3: Material Requisition & Allocation
  - Stage 4: Structure & Mounting Foundation
  - Stage 5: Solar PV Module Installation
  - Stage 6: DC/AC Cabling, Inverter & Protection
  - Stage 7: Grid Interconnection & Net Metering
  - Stage 8: Testing, Commissioning & QA Sign-off
  - Stage 9: DISCOM Inspection & Joint Meter Reading
  - Stage 10: Customer Acceptance & Final Handover
- **Checklist Quality Gates:** Project stage cannot advance past Stage 8 until mandatory electrical safety checklists (`ProjectInstallationChecklist` model) are signed off with required photo evidence.

### 2.3 Sales vs. Accounts Data Access Isolation
- **Problem Solved:** Protects confidential company balance sheets, profit margins, and vendor buy-rates from unauthorized commercial staff, while preventing accounting interference in engineering designs.
- **Sales Boundary:**
  - Full access to Leads, Follow-ups, Surveys, PV Sizing, Quotations, and Orders.
  - Access to Customer profiles with commercial history.
  - Read-only catalog access with selling price tiers (no raw vendor purchase rates).
  - **Forbidden:** No access to `/expenses`, `/api/v1/expenses`, `/api/v1/projects/:id/costing`, raw vendor bank account details, or unapproved financial transactions.
- **Accounts Boundary:**
  - Full access to Customer Payments, Outstanding aging, Purchase Orders, Vendor Invoices, Expenses, and Project Costing.
  - Read-only access to Confirmed Sales Orders and Accepted Quotations as the basis for invoicing.
  - **Forbidden:** Cannot modify solar technical designs, change quotation line-item configurations, or advance project engineering stages.

### 2.4 Service, Warranty & AMC Operations
- **Problem Solved:** Keeps post-commissioning customer support unified within Admin operational supervision.
- **Integrated Service Suite:**
  - **Complaints & Tickets:** Customer submits ticket (or Admin logs on their behalf). Triage and SLA escalation.
  - **Warranty Management:** Serialized tracking of PV modules and inverters. Automated warranty expiry warnings.
  - **AMC Management:** Contract creation, maintenance schedule generation, and atomic visit quota deduction upon verified service visit completion.

---

## 3. Comprehensive Role & Permission Matrix

| Role | Primary Panel | Permitted Panels | Key Permissions Granted | Key Permissions Restricted |
| :--- | :--- | :--- | :--- | :--- |
| **`SUPERADMIN`** | Admin Panel | Admin, Sales, Accounts | `*` (All 68 system permissions) | None |
| **`ADMIN`** | Admin Panel | Admin, Sales, Accounts | All permissions except sensitive `user:roles_assign` | Root role privilege escalation |
| **`DEPARTMENT_HEAD` (Sales)** | Sales Panel | Sales Panel | `lead:*`, `customer:*`, `survey:*`, `design:*`, `quote:*`, `order:*`, `quote:discount_approve` | `account:*`, `inv:adjust`, `po:approve` |
| **`SALES_EXECUTIVE`** | Sales Panel | Sales Panel | `lead:create/read/update/convert`, `customer:read/create`, `survey:read`, `design:*`, `quote:create/read/update`, `order:create/read` | `quote:discount_approve`, `account:*`, `expense:approve`, vendor costs |
| **`SURVEYOR`** | Sales Panel | Sales Panel | `survey:create/read/update/upload_photos`, `customer:read`, `lead:read` | All quotes, orders, inventory, accounts |
| **`ACCOUNTS_OFFICER`** | Accounts Panel | Accounts Panel | `payment:*`, `expense:*`, `po:read/approve`, `grn:read`, `vendor_invoice:*`, `account:*`, `project:cost_read` | `lead:delete`, `design:create`, `project:stage_advance` |
| **`INSTALLATION_CREW`** | Admin (Projects) | Admin (Projects only) | `project:read/update/stage_advance`, `checklist:*`, `evidence:*`, `dispatch:read` | Commercial quotes, customer financial ledgers, vendor invoices |
| **`SERVICE_TECHNICIAN`** | Admin (Service) | Admin (Service only) | `service:ticket_resolve`, `service:visit_execute`, `warranty:read` | Quotes, orders, project stages, financial accounts |
| **`CUSTOMER`** | Customer Portal | Customer Portal only | `customer_portal:read/interact` (own records only via token) | All internal company panels and administrative data |

---

## 4. Complete Route & Layout Mapping

### 4.1 Internal Panel Navigation Routes

```typescript
// Proposed Navigation Structure by Panel
export const PANEL_NAVIGATION = {
  ADMIN: [
    { title: 'Overview', items: [{ to: '/', label: 'Admin Dashboard', icon: LayoutDashboard }] },
    { title: 'Commercial', items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/leads', label: 'Leads & CRM', icon: Users },
      { to: '/quotations', label: 'Quotations', icon: FileSpreadsheet },
      { to: '/orders', label: 'Sales Orders', icon: ShoppingCart }
    ]},
    { title: 'Operations', items: [
      { to: '/projects', label: 'Projects & Installation', icon: FolderKanban },
      { to: '/inventory', label: 'Inventory & Catalogue', icon: Boxes },
      { to: '/vendors', label: 'Vendors', icon: Building2 },
      { to: '/amc', label: 'Service & AMC', icon: FileCheck2 },
      { to: '/complaints', label: 'Complaints', icon: LifeBuoy }
    ]},
    { title: 'Management', items: [
      { to: '/employees', label: 'Employees & Teams', icon: Users },
      { to: '/tasks', label: 'Operational Tasks', icon: CheckSquare },
      { to: '/documents', label: 'Document Vault', icon: FileText },
      { to: '/reports', label: 'Reports & Analytics', icon: TrendingUp },
      { to: '/settings', label: 'Settings & Masters', icon: ShieldCheck }
    ]}
  ],
  SALES: [
    { title: 'Workspace', items: [{ to: '/', label: 'Sales Dashboard', icon: LayoutDashboard }] },
    { title: 'Pipeline', items: [
      { to: '/leads', label: 'Leads', icon: Users },
      { to: '/follow-ups', label: 'Follow-ups', icon: Bell },
      { to: '/customers', label: 'Customers', icon: Users }
    ]},
    { title: 'Engineering & Quoting', items: [
      { to: '/surveys', label: 'Site Surveys', icon: Layers },
      { to: '/solar-designs', label: 'Solar PV Sizing', icon: Sun },
      { to: '/quotations', label: 'Quotation Suite', icon: FileSpreadsheet },
      { to: '/orders', label: 'Sales Orders', icon: ShoppingCart }
    ]}
  ],
  ACCOUNTS: [
    { title: 'Workspace', items: [{ to: '/', label: 'Accounts Dashboard', icon: LayoutDashboard }] },
    { title: 'Receivables & Collections', items: [
      { to: '/payments', label: 'Payments & Receipts', icon: CreditCard },
      { to: '/payments?tab=outstanding', label: 'Customer Outstanding', icon: Landmark }
    ]},
    { title: 'Procurement & Payables', items: [
      { to: '/purchase-orders', label: 'Purchase Orders', icon: FileText },
      { to: '/vendor-invoices', label: 'Vendor Payables', icon: Receipt },
      { to: '/vendors', label: 'Vendors Ledger', icon: Building2 }
    ]},
    { title: 'Controlling', items: [
      { to: '/expenses', label: 'Expense Management', icon: TrendingUp },
      { to: '/expenses?tab=costing', label: 'Project Costing & Margin', icon: FolderKanban },
      { to: '/reports?tab=finance', label: 'Financial Reports', icon: FileSpreadsheet }
    ]}
  ]
};
```

---

## 5. Architectural Quality Standards & Verification Gates

1. **TypeScript Strict Typechecking:** Zero `any` leaks in new navigation contracts; strict typing of user roles and panel states.
2. **Backward Compatibility:** All existing routes (`/leads`, `/projects`, `/payments`, etc.) remain fully functional so bookmarks, tests, and deep links continue working seamlessly.
3. **Automated Test Coverage:** Existing 488 tests continue passing without modification of business assertions.
