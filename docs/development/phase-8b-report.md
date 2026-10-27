# INS Solar — Phase 8B Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-008B`  
**Version:** `1.0.0`  
**Date:** 2026-10-27  
**Status:** Complete & Verified Gate  
**Phase:** Phase 8B (Expense Management, Project Costing & Profitability)  
**Parent Verification:** Phase 8A Verification (235 passing tests)  
**Current Test Suite:** 389 passing automated tests across all monorepo workspaces (100% green, 0 failures)

---

## 1. Executive Summary & Pre-Implementation Audit

Phase 8B of the **INS Solar Business Management System** implements operational expense management, project cost tracking, budget-versus-actual variance reporting, and operational profitability analysis. It seamlessly integrates with existing Projects, SalesOrders, PurchaseOrders, GoodsReceipts, VendorInvoices, MaterialDispatches, CustomerPayments, PaymentAllocations, and Service/AMC workflows.

### 1.1 Non-Statutory Financial Disclaimer & Operational Boundary
- **Operational Cost & Profitability Module Only:** This module tracks operational and project-level costs for solar project management. It is **not** a full double-entry general ledger and does **not** provide statutory tax accounting or audited financial statements.
- **Mandatory User-Facing Disclaimer:** Every screen and report displaying project profitability includes the mandatory disclaimer:
  > *"Operational Estimate Only: Figures represent operational cost tracking and milestone-based revenue estimation for project management. This report does not constitute a statutory accounting ledger or audited financial statement."*
- **Integer Paise Standard:** In adherence to platform standards, all money fields (`amountPaise`, `taxAmountPaise`, `totalAmountPaise`, `materialsBudgetPaise`, `directExpenseBudgetPaise`, etc.) are modeled as positive 64-bit integer paise (1 INR = 100 paise), preventing floating-point drift.

### 1.2 Authoritative Cost Recognition & Strict Anti-Double-Counting Invariants
A core principle of Phase 8B is the strict boundary preventing double-counting of costs across procurement, inventory, and field execution:
1. **Purchase Orders (POs):** Purchase orders represent procurement commitments to suppliers, not incurred project cost. PO commitments are not recognized in the project cost ledger.
2. **Goods Receipt Notes (GRNs):** Warehouse intake of goods increases inventory assets; it does not constitute a project cost.
3. **Vendor Invoices:** Vendor invoices represent accounts payable claims against purchase orders; they are not added on top of material dispatches to prevent duplicate cost booking.
4. **Authoritative Materials Cost:** Physical materials consumed for a project are derived authoritatively from `MaterialDispatch` records with status `DISPATCHED`. For each line item, the cost is calculated as:
   $$\text{Line Item Cost} = \text{issuedQuantity} \times \text{Product.standardPurchaseRatePaise}$$
   Cancelled dispatches or stock returns reverse or exclude the cost.
5. **Direct Project Expenses:** Operational field expenses (civil work, transportation, site survey, labor, permits, contingency) derive authoritatively from `Expense` records assigned to the project with status `APPROVED` or `PAID`. Draft, pending, or rejected expenses are excluded.

### 1.3 Revenue Recognition & Customer Collections
- **Contracted Sales Value:** Authoritatively taken from the accepted `SalesOrder.netTotalPaise` for the project.
- **Operational Progress Revenue:** Estimated based on physical milestone completion percentage:
  $$\text{Progress Revenue} = \left(\frac{\text{Completed Milestones}}{\text{Total Milestones}}\right) \times \text{SalesOrder.netTotalPaise}$$
- **Confirmed Collections:** Aggregated from active `PaymentAllocation` records associated with the project's sales order.
- **Outstanding Receivables:** Contracted sales value minus confirmed customer collections.

---

## 2. Implemented Domain Models & Schemas

### 2.1 Backend Models (`apps/api/src/models`)

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `Expense` | `expenses` | Operational expenses, receipts, approval lifecycle, and disbursements | `expenseNumber` (unique `EXP-YYYY-NNNNN`), `category` (`ExpenseCategory`), `expenseDate`, `amountPaise`, `taxAmountPaise`, `totalAmountPaise`, `currency`, `description`, `vendorId` (optional ref), `payeeName`, `projectId` (optional ref, indexed), `salesOrderId` (optional ref), `paymentMethod`, `paymentStatus` (`UNPAID`, `PAID`, `PARTIAL`), `paidAmountPaise`, `paymentDate`, `paymentReference`, `disbursedBy`, `status` (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED`), `requiresApproval` (boolean), `submittedBy` (ref), `submittedAt`, `approvedBy` (ref), `approvedAt`, `approvalNotes`, `rejectedBy` (ref), `rejectedAt`, `rejectionReason`, `cancelledBy`, `cancelledAt`, `cancellationReason`, `receiptUrl`, `tags`, `idempotencyKey` (sparse unique), `statusHistory`. Compound indexes: `{ projectId: 1, status: 1 }`, `{ status: 1, expenseDate: -1 }`, `{ category: 1 }`. |
| `ProjectBudget` | `project_budgets` | Versioned financial baseline and cost category budgets | `projectId` (ref, indexed), `version` (positive integer), `status` (`DRAFT`, `APPROVED`, `SUPERSEDED`, `REJECTED`), `materialsBudgetPaise`, `laborBudgetPaise`, `equipmentBudgetPaise`, `permitsBudgetPaise`, `logisticsBudgetPaise`, `contingencyBudgetPaise`, `otherBudgetPaise`, `totalBudgetPaise` (computed sum), `currency`, `notes`, `createdBy` (ref), `approvedBy` (ref), `approvedAt`, `approvalNotes`, `effectiveDate`, `supersededByBudgetVersion`. Unique compound index: `{ projectId: 1, version: 1 }`, index `{ projectId: 1, status: 1 }`. |

### 2.2 Shared Validation Schemas (`packages/shared/src/schemas`)
- `createExpenseSchema`: Validates expense category, date, positive `amountPaise`, `taxAmountPaise`, optional `projectId`, `vendorId`, `payeeName`, receipt references, and `idempotencyKey`.
- `approveExpenseSchema`: Validates optional approval notes.
- `rejectExpenseSchema`: Mandates `rejectionReason` (min 3 characters).
- `payExpenseSchema`: Validates `paymentMethod`, `paidAmountPaise`, `paymentReference`, and date.
- `cancelExpenseSchema`: Mandates `cancellationReason` (min 3 characters).
- `createProjectBudgetSchema`: Validates non-negative category budgets and optional notes.
- `approveProjectBudgetSchema`: Validates approval notes.

---

## 3. Business Logic, Invariants & Security

### 3.1 Approval Threshold & Anti-Self-Approval Enforcement
- **Threshold Rule:** In `CompanySettings`, an `expenseApprovalThresholdPaise` setting (default ₹5,000.00 / 500,000 paise) governs automatic approval vs manager review. Expenses with `amountPaise > expenseApprovalThresholdPaise` automatically mandate `requiresApproval = true` and enter `PENDING_APPROVAL`. Below the threshold, expenses are auto-approved upon creation.
- **Anti-Self-Approval Guard:** An employee cannot approve an expense they submitted (`actor.userId === expense.submittedBy.toString()`). Attempting self-approval returns HTTP 403 `AppError.forbidden('Anti-Self-Approval Violation: You cannot approve your own expense submission.')`.
- **Payment Disbursement Guard:** Only approved expenses (`status === APPROVED`) can be disbursed. Recording payment marks `paymentStatus = PAID`.

### 3.2 Budget Versioning Lifecycle
- Budgets support sequential version numbers (`version = max(existingVersions) + 1`).
- Initial creation starts in `DRAFT` status.
- Upon manager approval (`approveBudget`), any previously active approved budget for that project is automatically transitioned to `SUPERSEDED` with `supersededByBudgetVersion` set, ensuring exactly one active approved budget version per project at all times.

### 3.3 Audit Trail & Security
- Every lifecycle mutation (create, approve, reject, disburse, cancel expense, budget creation, budget approval) invokes `AuditService.recordEvent` capturing the actor, entity ID, action, outcome, IP address, user agent, and correlation ID.
- Access is restricted using role-based permissions: `expense:create`, `expense:read`, `expense:approve`, `expense:pay`, `expense:cancel`, `project:budget_create`, `project:budget_approve`, `project:cost_read`.

---

## 4. Versioned REST API Endpoints

### 4.1 Expense Management Routes (`/api/v1/expenses`)
- `GET /` — List expenses with pagination, category, project, status, and date range filters (`expense:read`).
- `POST /` — Record new operational expense with atomic `EXP-YYYY-NNNNN` numbering and threshold evaluation (`expense:create`).
- `GET /:id` — Detailed expense record with populated project, submitter, approver, and status history (`expense:read`).
- `POST /:id/approve` — Manager approval enforcing anti-self-approval (`expense:approve`).
- `POST /:id/reject` — Manager rejection with documented reason (`expense:approve`).
- `POST /:id/pay` — Disburse payment against approved expense (`expense:pay`).
- `POST /:id/cancel` — Cancel unpaid expense with documented reason (`expense:cancel`).

### 4.2 Project Costing & Profitability Routes (`/api/v1/projects/:projectId`)
- `GET /cost-ledger` — Line-by-line project cost entries from dispatched materials and approved direct expenses (`project:cost_read`).
- `GET /profitability` — Comprehensive profitability report, margin % and budget-vs-actual variance (`project:cost_read`).
- `GET /budgets` — Version history of planned budgets for this project (`project:cost_read`).
- `POST /budgets` — Create new budget baseline or revision (`project:budget_create`).
- `POST /budgets/:budgetId/approve` — Approve budget and supersede prior active version (`project:budget_approve`).

---

## 5. Web Frontend Implementation

### 5.1 Expense Register (`/expenses`)
- **KPI Metrics:** Total Expenses Recorded, Total Disbursed (Paid), Pending Approval, and Unpaid Liabilities.
- **Search & Filters:** Search by description, expense number, payee; filter by Category, Status, Payment Status, and Date Range.
- **Modals & Workflows:**
  - *Record Expense Modal:* Dynamic category selection, integer paise inputs, receipt link, and project attachment.
  - *Approve Modal:* Review details and approve with notes.
  - *Reject Modal:* Record mandatory rejection reason.
  - *Disburse Payment Modal:* Record payment method, transaction reference, date, and disbursement details.
  - *Cancel Modal:* Document cancellation reason.
  - *Expense Detail & Audit Modal:* Full status history timeline and metadata view.

### 5.2 Project Costing & Profitability Tab
Embedded directly into `ProjectDetailPage.tsx` under the tab **"Costing & Profitability"**:
- **Financial KPI Cards:** Contracted Sales Value, Recorded Project Cost, Estimated Gross Profit & Margin %, Customer Collections, and Progress Revenue.
- **Budget vs Actual Variance Card:** Side-by-side comparison of planned budgets vs actual expenditures across Materials, Labor, Equipment, Permits, Logistics, and Contingency with percentage consumption indicators.
- **Line-by-Line Cost Ledger:** Authoritative itemized entries with source badges (`Material Dispatch` vs `Direct Expense`), unit rates, quantities, and dates.
- **Budget Version Manager Modal:** View version history, current active budget, and create/approve new budget versions.
- **Legal Non-Statutory Disclaimer:** Clearly rendered alert box at the bottom of the tab.

### 5.3 Navigation Integration
- Added `Expenses Register` under `Finance & Accounts` navigation menu in `apps/web/src/components/layout/AppLayout.tsx`.
- Mounted `/expenses` route in `App.tsx` guarded by `ProtectedRoute`.

---

## 6. Verification & Quality Gates

### 6.1 Automated Test Execution Summary
- **Backend API Tests:** 15 automated tests in `apps/api/src/__tests__/phase8b.test.ts` covering:
  - Atomic sequence generation (`EXP-YYYY-NNNNN`).
  - Company threshold evaluation (> ₹5,000 mandates approval).
  - Anti-self-approval enforcement (HTTP 403).
  - Payment disbursement metadata recording.
  - Expense cancellation and audit history.
  - Unauthenticated access rejection (HTTP 401).
  - Project cost ledger compilation with anti-double-counting invariants.
  - Budget versioning and automatic superseding of prior approved versions.
  - Project profitability calculations and margin percentage derivation.
- **Frontend Web Tests:** 4 automated tests in `apps/web/src/__tests__/phase8bPages.test.tsx` covering:
  - Expenses page KPI and register rendering.
  - Record Expense modal opening and input controls.
  - Project Costing tab financial overview and margin rendering.
  - Cost ledger entries and disclaimer banner display.

### 6.2 Monorepo Test Results
| Package | Tests Passed | Status |
| :--- | :--- | :--- |
| `@ins-solar/shared` | 135 / 135 | **PASS** |
| `@ins-solar/api` | 213 / 213 | **PASS** |
| `@ins-solar/web` | 41 / 41 | **PASS** |
| **Total Automated Tests** | **389 / 389** | **100% GREEN** |

### 6.3 Build & Typecheck Quality
- `npm run typecheck`: **0 errors** across all packages.
- `npm run build`: **0 errors**, production bundle compiled cleanly.
