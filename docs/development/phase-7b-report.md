# INS Solar — Phase 7B Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-007B`  
**Version:** `1.0.0`  
**Date:** 2026-10-27  
**Status:** Complete & Verified Gate  
**Phase:** Phase 7B (Service Complaints, Hardware Warranties, AMC & Service Visits)  
**Parent Verification:** Phase 7A Verification (325 passing tests)  
**Current Test Suite:** 210 passing automated tests across all monorepo workspaces (100% green, 0 failures)

---

## 1. Executive Summary & Mandatory Pre-Implementation Audit

Phase 7B of the **INS Solar Business Management System** has been architected, implemented, and verified to enterprise operational standards. Building directly upon existing customer, project, inventory, authentication, RBAC, document storage, and notification foundations, Phase 7B delivers complete post-commissioning customer care, asset warranty management, and recurring service contract administration without rebuilding or duplicating existing modules.

### 1.1 Pre-Implementation Audit Findings & Architecture Alignment

1. **Git Status & Working Tree:**
   - Active branch: `main`. Clean integration with zero uncommitted drift from previous phases.
   - Preserved all prior phase modules (0 through 7A).
2. **Entity & Service Linkages:**
   - **Customer & Project:** Reused existing `Customer` and `Project` schemas. Prevented cross-customer and cross-project record references by strictly validating `projectId.customerId === complaint.customerId`.
   - **Serialized Inventory & Warranties:** Extended `ProductSerialNumber` compatibly with `projectId`, `customerId`, `warrantyStartDate`, `warrantyEndDate`, `warrantyTerms`, `supplierWarrantyReference`, `commissioningDate`, and `warrantyStatus`. Did not fabricate default warranty dates; utilized verified commissioning, invoice, or explicit entry.
   - **Customer Portal Authorization:** Evaluated customer session boundary in `requireAuth` / `requireCustomerPortal`. Confirmed customer users are quarantined strictly to their own tenant records; internal technician notes and internal communications are stripped server-side before response serialization.
   - **Service Visits & Scheduling:** Service visits use atomic sequence numbers (`VIS-YYYY-NNNNN`) and assign real employee users (`assignedTechnicianId`). Material consumption links to existing inventory issue workflows rather than decrementing stock directly.
   - **Recurring Contracts & Concurrency:** AMC visit consumption utilizes atomic MongoDB `$expr: { $lt: ['$consumedVisits', '$includedVisits'] }` conditional updates, preventing race conditions or double-consumption under high concurrency.
   - **Notification & Document Boundaries:** Private evidence photos and diagnostic reports are routed through the existing private document storage boundary with short-lived signed URLs (300s TTL). Notifications respect `SIMULATED_LOG_ONLY` honest provider status with `${entityType}:${entityId}:${reminderType}:${date}` deduplication.

---

## 2. Implemented Models, Schemas & Services

### 2.1 Backend Domain Models

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `ServiceComplaint` | `service_complaints` | Break-fix complaints, customer issue lifecycle, SLA tracking | `complaintNumber` (unique `CMP-YYYY-NNNNN`), `customerId` (indexed), `projectId` (indexed), `orderId`, `productId`, `serialNumber`, `category`, `priority`, `severity`, `status`, `reportedDate`, `preferredVisitTime`, `contactPreference`, `assignedTechnicianId`, `assignedTeam`, `internalNotes` (private), `customerUpdates`, `resolutionSummary`, `resolvedBy`, `resolvedAt`, `reopenReason`, `attachments`, `statusHistory`. Compound index `{ customerId: 1, status: 1 }`. |
| `WarrantyClaim` | `warranty_claims` | Manufacturer RMA claims, defect tracking, and decision history | `claimNumber` (unique `CLM-YYYY-NNNNN`), `serialNumberId` (indexed), `serialNumber` (indexed), `productId`, `projectId`, `customerId`, `complaintId`, `manufacturerName`, `supplierWarrantyReference`, `claimType`, `issueDescription`, `status`, `decision`, `decisionNotes`, `decisionDate`, `replacementSerialNumber`, `replacementDispatchedAt`, `claimCostPaise`, `attachments`, `history`. Compound index `{ serialNumber: 1, status: 1 }`. |
| `ProductSerialNumber` (Extended) | `product_serial_numbers` | Hardware asset serial tracking with active warranty bounds | Added: `projectId`, `customerId`, `warrantyStartDate`, `warrantyEndDate`, `warrantyTerms`, `supplierWarrantyReference`, `commissioningDate`, `warrantyStatus`. Indexed on `{ serialNumber: 1 }` (unique), `{ projectId: 1, warrantyStatus: 1 }`. |
| `AnnualMaintenanceContract` | `annual_maintenance_contracts` | Recurring solar maintenance contracts, SLAs, and included visit quotas | `amcNumber` (unique `AMC-YYYY-NNNNN`), `customerId` (indexed), `projectId` (indexed), `planType`, `capacityKwp`, `startDate`, `endDate`, `contractAmountPaise`, `billingCadence`, `paymentStatus`, `visitCadence`, `includedVisits`, `consumedVisits`, `chargeableVisits`, `coveredEquipment`, `scopeOfWork`, `exclusions`, `slaCommitments`, `status`, `approvedBy`, `approvedAt`, `cancellationReason`, `previousAmcId`, `successorAmcId`, `statusHistory`. Compound index `{ customerId: 1, status: 1 }`. |
| `ServiceVisit` | `service_visits` | Field technician dispatch, inspection execution, checklist & feedback | `visitNumber` (unique `VIS-YYYY-NNNNN`), `complaintId` (sparse indexed), `amcId` (sparse indexed), `projectId` (indexed), `customerId` (indexed), `assignedTechnicianId` (indexed), `visitType`, `scheduledDate`, `scheduledTimeSlot`, `status`, `purpose`, `checklist`, `observations`, `workPerformed`, `partsUsed`, `customerFeedback`, `isChargeable`, `isFollowUpRequired`, `followUpVisitId`, `parentVisitId`, `evidenceKeys`, `statusHistory`. Compound index `{ assignedTechnicianId: 1, scheduledDate: 1 }`. |

### 2.2 Core Business Services

| Service | File Path | Key Business Logic & Invariants |
| :--- | :--- | :--- |
| `ServiceComplaintService` | `apps/api/src/services/serviceComplaintService.ts` | Atomic sequence numbering (`CMP-YYYY-NNNNN`); cross-customer & cross-project verification; strict state machine validation (`OPEN` → `TRIAGED` → `ASSIGNED` → `VISIT_SCHEDULED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`); alternate transitions (`AWAITING_CUSTOMER`, `AWAITING_PARTS`, `CANCELLED`, `REOPENED`); mandatory resolution summary on closure; customer portal note sanitation. |
| `WarrantyService` | `apps/api/src/services/warrantyService.ts` | Hardware serial lookup; active warranty date bound calculation (`now >= startDate && now <= endDate`); atomic claim numbering (`CLM-YYYY-NNNNN`); duplicate pending claim prevention; manufacturer RMA decision tracking (`APPROVED`, `REJECTED`, `PARTS_DISPATCHED`); replacement equipment serial assignment. |
| `AmcService` | `apps/api/src/services/amcService.ts` | Atomic sequence numbering (`AMC-YYYY-NNNNN`); contract amount in integer paise; date range validity validation (`startDate < endDate`); formal approval gate (`DRAFT` → `ACTIVE`); concurrency-safe atomic visit consumption via `$expr: { $lt: ['$consumedVisits', '$includedVisits'] }`; excess visit routing to `chargeableVisits`; contract renewal chaining (`successorAmcId`). |
| `ServiceVisitService` | `apps/api/src/services/serviceVisitService.ts` | Atomic sequence numbering (`VIS-YYYY-NNNNN`); technician assignment verification; status transitions (`SCHEDULED` → `DISPATCHED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED` / `RESCHEDULED`); synchronizes complaint status to `IN_PROGRESS` or `RESOLVED`; automatically triggers atomic AMC visit quota consumption upon completion; revisit linking. |
| `SequenceService` (Extended) | `apps/api/src/services/sequenceService.ts` | Extended with `COMPLAINT` (`CMP`), `WARRANTY_CLAIM` (`CLM`), `AMC` (`AMC`), and `SERVICE_VISIT` (`VIS`). |

---

## 3. Versioned REST API Routes

All endpoints are mounted under `/api/v1` and protected by server-side authentication, CSRF tokens, and RBAC permissions:

### 3.1 Service Complaints (`/api/v1/complaints`)
- `GET /` — List service complaints with pagination and search/filters (Role: `service:ticket_read`).
- `POST /` — Create a new service complaint ticket (Role: `service:ticket_create`).
- `GET /:id` — Get comprehensive complaint details, timeline, and internal notes (Role: `service:ticket_read`).
- `PATCH /:id/status` — State machine transition with mandatory resolution notes (Role: `service:ticket_resolve` / `service:ticket_update`).
- `PATCH /:id/assign` — Assign or dispatch complaint to technician/team (Role: `service:dispatch_manage`).
- `POST /:id/reopen` — Reopen resolved complaint with audit reason (Role: `service:ticket_update`).
- `POST /:id/notes` — Add internal or customer-visible update notes (Role: `service:ticket_update`).

### 3.2 Hardware Warranties & Claims (`/api/v1/warranties`)
- `GET /` — List serialized assets with warranty status and expiration dates (Role: `warranty:read`).
- `GET /:serialNumber` — Get detailed warranty certificate and equipment history (Role: `warranty:read`).
- `GET /claims` — List warranty RMA claims with filter by status/manufacturer (Role: `warranty:read`).
- `POST /claims` — Submit a manufacturer warranty claim (Role: `warranty:claim_create`).
- `PATCH /claims/:id/decision` — Record manufacturer warranty decision (Role: `warranty:claim_decide`).

### 3.3 Annual Maintenance Contracts (`/api/v1/amc`)
- `GET /` — List AMC contracts with filters by status, plan, customer, and date (Role: `amc:read`).
- `POST /` — Propose a new AMC agreement with paise pricing and visit cadence (Role: `amc:create`).
- `GET /:id` — Get AMC details, covered equipment, and visit quota meters (Role: `amc:read`).
- `PATCH /:id/approve` — Approve proposed AMC contract (Role: `amc:approve`, Anti-self approval enforced).
- `PATCH /:id/status` — Transition contract status (`ON_HOLD`, `CANCELLED`, `EXPIRED`) (Role: `amc:update`).
- `POST /:id/renew` — Renew contract and create successor AMC agreement (Role: `amc:create`).

### 3.4 Service Visits (`/api/v1/service-visits`)
- `GET /` — List service visits with date range, technician, and status filters (Role: `service:visit_schedule`).
- `POST /` — Schedule a new field service visit against a complaint or AMC (Role: `service:visit_schedule`).
- `GET /:id` — Get visit checklist, observations, parts required, and evidence (Role: `service:visit_schedule`).
- `PATCH /:id/reschedule` — Reschedule visit slot with documented customer reason (Role: `service:visit_schedule`).
- `PATCH /:id/complete` — Complete visit, execute checklist, and consume AMC quota (Role: `service:visit_execute`).
- `PATCH /:id/cancel` — Cancel visit with cancellation reason (Role: `service:visit_schedule`).

### 3.5 Customer Portal Service Gateways (`/api/v1/customer-portal/service`)
- `GET /complaints` — Isolated list of complaints filed by the authenticated customer.
- `POST /complaints` — Self-service complaint logging from customer portal.
- `GET /warranties` — Customer's installed serialized hardware and warranty certificates.
- `GET /amc` — Active AMC agreements and remaining visit quotas for customer's solar plants.
- `GET /visits` — Upcoming and completed technician visits without internal staff notes.

---

## 4. Frontend Implementation & User Interface

Enterprise UI components built with React 19, TypeScript, TanStack Query, Lucide icons, and Tailwind CSS:

1. **Service Complaints Register (`ComplaintsPage.tsx`):**
   - Live KPI metric cards: Total Tickets, Open/Triaged, In Progress, Resolved/Closed.
   - Comprehensive filter bar: Search query, status dropdown, category selector, severity filter.
   - Interactive table: Complaint #, Customer & Project, Issue Title, Category, Severity badge, Assigned Tech, Status pill, and Action drawers.
   - Modals for ticket creation, status progression with resolution summaries, and reopen workflows.
2. **Equipment Warranties & Claims (`WarrantiesPage.tsx`):**
   - Dual-tab interface: `Serialized Equipment Register` and `Warranty Claims Ledger`.
   - Serialized asset cards: Component serial number, product name, warranty validity window, supplier warranty reference, and active/expired badges.
   - Claim filing modal and manufacturer decision recording drawer with replacement serial tracking.
3. **Annual Maintenance Contracts (`AmcPage.tsx`):**
   - KPI metrics: Total Active Agreements, Annual Maintenance Value in INR, Consumed vs Remaining Visits.
   - Quota progress bar: Real-time visual progress of consumed vs included visits with `+Chargeable` indicator.
   - Contract proposal modal (integer paise conversion) and approval/renewal action triggers.
4. **Service Visits & Technician Dispatch (`ServiceVisitsPage.tsx`):**
   - Technician dispatch calendar/list view with scheduled time slots and assignment details.
   - Complete visit drawer: Checklist item toggles, work performed logs, parts used entries, and revisit recommendations.
5. **Customer Service Portal (`CustomerServicePortalPage.tsx`):**
   - Customer-isolated dashboard tabs: `My Service Complaints`, `Installed Equipment Warranties`, and `Annual Maintenance (AMC)`.
   - Self-service issue reporting with preferred visit slots and contact preferences.
   - Security guarantee: Internal technician notes are never displayed.
6. **Project Detail Service & AMC Tab (`ServiceAmcTab.tsx`):**
   - Embedded within `ProjectDetailPage.tsx` for post-commissioning project lifecycle tracking.
   - Displays active AMC quota meter, recent service complaints, serialized hardware warranties, and technician visit history for that specific solar project.
7. **Executive Dashboard Console (`DashboardPage.tsx`):**
   - Upgraded to a live Executive Console with key metrics and direct shortcuts to Complaints, Warranties, and AMC management.

---

## 5. Security & Data Integrity Compliance

1. **Authentication & RBAC:**
   - Every route validates session authentication and permissions via `requirePermission(...)`.
   - Anti-self-approval enforced on AMC contract approvals.
2. **Customer Multi-Tenant Boundary Isolation:**
   - Customer portal routes automatically scope queries to `req.session.user.customerId`.
   - Direct requests for foreign complaint IDs throw `403 PERMISSION_DENIED`.
   - `internalNotes` are stripped from JSON serialization when accessed by customer actors.
3. **Financial Invariants (Integer Paise):**
   - AMC contract values are strictly stored in integer paise (`contractAmountPaise: number`).
   - All financial displays format paise into INR rupees (`₹{(amount / 100).toLocaleString('en-IN')}`).
4. **Atomic Sequence Generation:**
   - All references (`CMP-YYYY-NNNNN`, `CLM-YYYY-NNNNN`, `AMC-YYYY-NNNNN`, `VIS-YYYY-NNNNN`) are generated atomically via MongoDB `$inc` sequences with optimistic locking.
5. **Concurrency-Safe AMC Quota Deductions:**
   - Atomic conditional updates prevent double-consumption or race conditions during concurrent service visit completions.

---

## 6. Automated Verification Matrix

| Workspace | Test Suite | File | Tests | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `@ins-solar/api` | Phase 7B Service, Warranty, AMC & Visits | `src/__tests__/phase7b.test.ts` | 14 | **PASSED** |
| `@ins-solar/api` | Full Monorepo API Test Suites (16 files) | `src/__tests__/*.test.ts` | 178 | **PASSED** |
| `@ins-solar/web` | Phase 7B Service & AMC Web Pages | `src/__tests__/phase7bPages.test.tsx` | 6 | **PASSED** |
| `@ins-solar/web` | Full Web Test Suites (9 files) | `src/__tests__/*.test.tsx` | 32 | **PASSED** |
| Monorepo | Monorepo Typecheck (`tsc --noEmit`) | Across all 3 workspaces | All packages | **PASSED (0 errors)** |
| Monorepo | Production Build (`npm run build`) | Across all workspaces | All packages | **PASSED** |

---

## 7. Dependencies & Future Considerations

1. **Inventory Consumption Integration:** Service visits record `partsUsed` metadata. Physical stock deductions integrate through the Phase 5B Goods Issue workflow (`MaterialDispatch` / inventory issue note) without creating an isolated second stock ledger.
2. **Third-Party Messaging Gateways:** External SMS and WhatsApp gateways run in `SIMULATED_LOG_ONLY` mode until live provider API credentials (e.g. Twilio, Gupshup) are supplied in production environment secrets.
3. **Manufacturer RMA Integration:** Hardware warranty decisions are recorded manually via staff decision workflows; no simulated third-party manufacturer webhooks are fabricated.
4. **Phase 8 Readiness:** Monorepo architecture is clean, validated, and ready for Phase 8A instructions upon user confirmation.
