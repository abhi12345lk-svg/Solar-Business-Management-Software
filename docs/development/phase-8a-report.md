# INS Solar — Phase 8A Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-008A`  
**Version:** `1.0.0`  
**Date:** 2026-10-27  
**Status:** Complete & Verified Gate  
**Phase:** Phase 8A (Customer Payments, Receivables & Outstanding Management)  
**Parent Verification:** Phase 7B Verification (210 passing tests)  
**Current Test Suite:** 235 passing automated tests across all monorepo workspaces (100% green, 0 failures)

---

## 1. Executive Summary & Mandatory Pre-Implementation Audit

Phase 8A of the **INS Solar Business Management System** implements an operational customer receivables ledger, payment intake with atomic receipt numbering, bank realization verification, multi-order fund allocations, cascading reversals, unallocated credit refunds, overdue aging statements, and printable operational payment receipts.

### 1.1 Scope & Non-Accounting Claim Boundaries
- **Operational Receivables Ledger Only:** This phase provides an operational receivables and payment realization ledger for solar project execution. It is **not** a full double-entry accounting system and makes **no statutory general ledger or tax compliance claims**.
- **Non-Tax Invoice Disclaimer:** Generated payment receipts confirm operational fund realizations against installation milestones and contain an explicit legal disclaimer: *"This document is an operational payment receipt confirming realization of customer funds against solar plant installation milestones. It does not constitute a statutory Tax Invoice under GST law."*
- **Integer Paise Financial Standard:** All financial amounts are modeled and transacted as positive integer paise (1 INR = 100 paise), avoiding floating-point rounding errors.

### 1.2 Pre-Implementation Audit Findings & Architecture Alignment
1. **Existing Model Inspection:**
   - **SalesOrder:** Utilizes `netTotalPaise`, `taxableAmountPaise`, `totalTaxPaise`, `totalDiscountPaise`, and `status`. Historical quotation/order values are strictly preserved and never silently recomputed from current tax settings.
   - **Customer:** Master directory providing billing addresses, GSTIN, and tenant identification.
   - **SequenceService:** Extended with atomic sequences for `SequenceEntityType.PAYMENT_RECEIPT` (`REC-YYYY-NNNNN`) and `SequenceEntityType.PAYMENT_ALLOCATION` (`ALC-YYYY-NNNNN`).
   - **AuditService:** Audits every payment creation, verification, allocation, reversal, and refund via `AuditService.recordEvent`.
2. **Tenant Boundary & Redaction:**
   - Customer Portal endpoints under `/api/v1/customer-portal/payments` strictly enforce customer tenant boundaries (`session.customer.customerId === payment.customerId`).
   - Confidential internal accounts notes (`internalNotes`) are stripped server-side on customer portal requests.

---

## 2. Implemented Domain Models & Schemas

### 2.1 Backend Models (`apps/api/src/models`)

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `CustomerPayment` | `customer_payments` | Inbound customer payments, receipt sequences, verification, unallocated balances, and refund history | `receiptNumber` (unique `REC-YYYY-NNNNN`), `customerId` (indexed), `amountPaise` (positive integer paise), `paymentDate`, `paymentMethod` (enum), `transactionReference` (sparse unique per customer), `status` (`RECORDED`, `VERIFIED`, `REVERSED`, `REFUNDED`), `allocatedAmountPaise`, `unallocatedAmountPaise`, `evidenceKey`, `notes`, `internalNotes` (staff only), `idempotencyKey` (sparse unique), `recordedBy`, `verifiedBy`, `verifiedAt`, `verificationNotes`, `reversedBy`, `reversedAt`, `reversalReason`, `refundReference`, `refundedAt`, `refundedBy`, `refundReason`, `refundAmountPaise`, `statusHistory`. Compound index `{ customerId: 1, status: 1 }`. |
| `PaymentAllocation` | `payment_allocations` | Allocation of verified payment funds to specific Sales Orders | `allocationNumber` (unique `ALC-YYYY-NNNNN`), `paymentId` (indexed), `salesOrderId` (indexed), `customerId` (indexed), `allocatedAmountPaise`, `allocationDate`, `status` (`ACTIVE`, `REVERSED`), `allocatedBy`, `notes`, `reversalReason`, `reversedBy`, `reversedAt`, `idempotencyKey` (sparse unique). Compound index `{ paymentId: 1, status: 1 }` and `{ salesOrderId: 1, status: 1 }`. |

### 2.2 Validation Schemas (`packages/shared/src/schemas/payment.ts`)
- `recordPaymentSchema`: Validates positive `amountPaise`, payment method, date, optional `transactionReference`, `idempotencyKey`, `notes`, `internalNotes`, and `autoVerify`.
- `verifyPaymentSchema`: Validates bank verification notes and date.
- `allocatePaymentSchema`: Validates `salesOrderId`, positive `allocatedAmountPaise`, `notes`, and `idempotencyKey`.
- `reverseAllocationSchema`: Requires mandatory `reversalReason` (min 3 chars).
- `reversePaymentSchema`: Requires mandatory `reversalReason` (min 3 chars).
- `refundPaymentSchema`: Validates positive `refundAmountPaise`, mandatory `refundReference`, and `refundReason`.
- `paymentFilterSchema` & `receivablesFilterSchema`: Bounded pagination and filters.

---

## 3. Financial Invariants & Concurrency Guards

1. **Anti-Cross-Customer Protection:**
   A payment can only be allocated to Sales Orders belonging to the exact same customer (`payment.customerId.toString() === order.customerId.toString()`). Cross-customer attempts throw `AppError.badRequest`.
2. **Atomic Concurrency-Safe Deduction:**
   Payment allocation executes an atomic conditional update using MongoDB `$expr`:
   ```typescript
   {
     _id: payment._id,
     status: CustomerPaymentStatus.VERIFIED,
     $expr: {
       $lte: [
         { $add: ['$allocatedAmountPaise', input.allocatedAmountPaise] },
         '$amountPaise'
       ]
     }
   }
   ```
   This prevents over-allocation race conditions under concurrent requests without relying on in-memory locks.
3. **Order Collectible Ceiling:**
   Total active allocations to an order cannot exceed the order's collectible amount (`order.netTotalPaise - currentActiveAllocations`).
4. **Reversal Balance Restoration:**
   Reversing an allocation restores the payment's unallocated quota (`allocatedAmountPaise -= amount; unallocatedAmountPaise += amount`) and logs an audited reason.
5. **Cascading Payment Reversal:**
   Reversing a confirmed payment automatically cascade-reverses all active allocations linked to that payment, restoring order collectible balances. Double-reversals are strictly rejected.
6. **Refund Quota Guard:**
   Refunds are only permitted from verified unallocated balances (`refundAmountPaise <= payment.unallocatedAmountPaise`).

---

## 4. Versioned REST API Endpoints

### 4.1 Staff Financial Routes (`/api/v1/payments`)
- `GET /` — List customer payments with pagination, status, method, and date filters (`payment:read`).
- `POST /` — Record new customer payment with atomic `REC-YYYY-NNNNN` generation (`payment:create`).
- `GET /:id` — Detailed payment record with populated allocations and status timeline (`payment:read`).
- `PATCH /:id/verify` — Confirm bank clearance, transitioning `RECORDED` to `VERIFIED` (`payment:verify`).
- `POST /:id/allocate` — Allocate verified funds to eligible sales orders (`payment:allocate`).
- `POST /allocations/:allocationId/reverse` — Reverse active allocation and restore payment quota (`payment:reverse`).
- `POST /:id/reverse` — Reverse payment and cascade-reverse active allocations (`payment:reverse`).
- `POST /:id/refund` — Process customer refund from unallocated funds (`payment:reverse`).
- `GET /:id/receipt` — Printable operational receipt document data with disclaimer (`payment:receipt_read`).
- `GET /receivables/orders/:orderId` — Order-level collectible, allocated, and outstanding balance (`payment:read`).
- `GET /receivables/customers/:customerId` — Customer-level receivables ledger and 4-tier aging breakdown (`payment:read`).

### 4.2 Customer Portal Isolated Routes (`/api/v1/customer-portal/payments`)
- `GET /` — List payments made by the authenticated customer.
- `GET /:id/receipt` — View/print operational payment receipt (internal notes strictly redacted).
- `GET /receivables` — Customer's active orders, allocated milestones, and remaining outstanding balance.

---

## 5. Web Frontend Implementation (`apps/web`)

1. **`PaymentsPage.tsx` (`/payments`):**
   - KPI Summary Cards: Total Collections Realized, Total Allocated, Unallocated Advance Credits, Ledger Entries.
   - Payments Register Table: Receipt number, customer, payment date & method, UTR reference, INR amount, allocation breakdown, status badge, and action buttons.
   - Record Payment Modal: Customer reference, INR to integer-paise conversion, payment method selector, UTR, and private internal notes.
   - Verify Realization Modal: Bank statement matching details.
   - Allocate Funds Modal: Sales order target selection and amount quota validation.
   - Reverse Payment Modal: Mandatory reason capture with cascade notice.
   - Refund Modal: Unallocated fund return processing.
   - Operational Receipt View: Clean printable voucher preview with legal non-tax disclaimer and `window.print()` trigger.
   - Customer Receivables Drawer: 4-tier aging breakdown (Current 0–30, Overdue 31–60, 61–90, >90 days) and contracted orders status (`UNPAID`, `PARTIALLY_PAID`, `PAID`).
2. **`CustomerPaymentsPortalPage.tsx` (`/customer-portal/payments`):**
   - Self-service portal view for solar customers to track milestone payments and print operational receipts.
   - Receivables statement tab showing contracted plant capacities, paid to date, and remaining balance.
3. **Navigation Integration (`AppLayout.tsx`):**
   - Added `Finance & Accounts` navigation group with links to Customer Payments and Client Payments Portal.

---

## 6. Automated Test Coverage & Verification

### 6.1 Backend Integration Tests (`apps/api/src/__tests__/phase8a.test.ts`)
20 automated tests passing with 0 failures:
- Payment creation with atomic sequence `REC-YYYY-NNNNN` and unallocated quota initialization.
- Rejection of payment recording when customer does not exist.
- Rejection of duplicate external transaction reference (UTR/cheque) within customer scope.
- Safe replay of existing payment when duplicate idempotency key is submitted.
- Payment verification lifecycle (`RECORDED` -> `VERIFIED`) with audit logging.
- Rejection of verifying a payment not in `RECORDED` status.
- Concurrency-safe payment allocation to Sales Order with sequence `ALC-YYYY-NNNNN`.
- Rejection of allocating an unverified (`RECORDED`) payment.
- Rejection of cross-customer allocation (`payment.customerId !== order.customerId`).
- Prevention of allocation exceeding payment unallocated balance.
- Prevention of allocation exceeding order collectible ceiling.
- Allocation reversal with payment unallocated quota restoration.
- Rejection of double-reversing an already reversed allocation.
- Cascading payment reversal reconciling all active allocations.
- Refund from verified unallocated balance and status update.
- Rejection of refund amount exceeding unallocated balance.
- Customer receivables statement calculation with 4-tier aging analysis (0-30, 31-60, 61-90, >90 days).
- Printable operational receipt generation with company settings, customer details, and legal non-tax disclaimer.
- Customer portal tenant boundary enforcement blocking unauthorized foreign customer receipts.
- 401 Unauthorized rejection for unauthenticated staff and portal endpoints.

### 6.2 Frontend Component Tests (`apps/web/src/__tests__/phase8aPages.test.tsx`)
5 automated tests passing with 0 failures:
- Renders Customer Payments register with KPI metric cards, filters, and records.
- Opens Record Payment modal with required fields upon button click.
- Opens and prints operational payment receipt with legal non-tax disclaimer.
- Opens customer receivables statement with aging breakdown.
- Renders Customer Payments Portal with receipt view and statement tabs.

### 6.3 Full Monorepo Test Summary
| Workspace | Test Files | Total Tests | Passing | Failing |
| :--- | :---: | :---: | :---: | :---: |
| `@ins-solar/shared` | Typecheck & Build | — | Verified | 0 |
| `@ins-solar/api` | 17 suites | 198 | 198 | 0 |
| `@ins-solar/web` | 10 suites | 37 | 37 | 0 |
| **Total Monorepo** | **27 suites** | **235** | **235** | **0** |

---

## 7. Quality Gates & Build Verification

- `npm run typecheck --workspaces`: **0 errors** across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.
- `npm run build`: **0 errors**; production bundle built cleanly with Vite.
- Monorepo tests: **235 passed, 0 failed**.
- Zero regressions against existing Phases 0–7B functionality.
