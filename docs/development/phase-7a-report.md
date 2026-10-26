# INS Solar — Phase 7A Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-007A`  
**Version:** `1.0.0`  
**Date:** 2026-10-26  
**Status:** Complete & Verified Gate  
**Phase:** Phase 7A (Net Metering & Government Subsidy Tracking)  
**Parent Verification:** Phase 6B Verification (291 passing tests)  
**Current Test Suite:** 325 passing tests across all workspaces (100% green, 0 failures)

---

## 1. Executive Summary

Phase 7A of the **INS Solar Business Management System** has been fully designed, implemented, and verified. Integrated seamlessly into existing customer, project, checklist, document, notification, and audit foundations, Phase 7A delivers enterprise-grade utility liaison and subsidy claim tracking:

1. **Pre-Implementation Audit & Module Mapping Resolution:**
   - Evaluated working tree and requirements catalog.
   - Resolved the Module 16 vs Module 17 mapping discrepancy: Module 16 is established as "Installation Checklist & QA" (completed in Phase 6B with `REQ-MOD16-01` through `REQ-MOD16-10`), while Module 17 is established as "Net Metering / Subsidy Tracking" (`REQ-MOD17-01` through `REQ-MOD17-11`), which Phase 7A implements and verifies.
   - Evaluated private file storage: Confirmed safe object storage abstraction using private storage keys (`evidence/documents/...`) with short-lived signed URLs (300-second TTL) and customer multi-tenant boundary checks.
   - Evaluated notification gateways: In the absence of live third-party SMS/WhatsApp credentials, implemented honest reporting with `SIMULATED_LOG_ONLY` delivery status and reminder deduplication.

2. **Net Metering Application Engine (`NetMeteringApplication` & `NetMeteringService`):**
   - Sequential, atomic application numbering (`NMA-YYYY-NNNNN`) via `SequenceService`.
   - Binding to project, customer, and originating sales order.
   - DISCOM/utility identification (name, circle, division, subdivision, consumer number, sanctioned load).
   - Validated state machine: `DRAFT` → `DOCUMENTS_PENDING` → `READY_TO_SUBMIT` → `SUBMITTED` → `UNDER_REVIEW` → `INSPECTION_SCHEDULED` → `APPROVED` / `REJECTED` / `CANCELLED`.
   - Technical feasibility tracking (feasibility status, approval date, demand note amount in integer paise, payment reference, and payment date).
   - Field inspection scheduling, rescheduling, and outcome recording (`PENDING`, `PASSED`, `FAILED`, `RESCHEDULE_REQUIRED`).
   - Bi-directional net meter installation tracking (work order number, meter serial number, installed date, installer details, and old/new meter initial/final kWh readings).
   - Document completeness validation gate: Transition to `READY_TO_SUBMIT` is hard-blocked if any mandatory document is missing or rejected.
   - Full timeline audit trail preserving status history, actors, timestamps, and notes.

3. **Subsidy Tracking Engine (`SubsidyApplication` & `SubsidyService`):**
   - Sequential, atomic application numbering (`SUB-YYYY-NNNNN`).
   - Scheme identification (e.g. `PM_SURYA_GHAR_MUFT_BIJLI_YOJANA`, `STATE_ROOFTOP_SUBSIDY`, `CENTRAL_FINANCIAL_ASSISTANCE`) with scheme version, portal application numbers, and acknowledgment dates.
   - Strict monetary integrity in **Integer Paise**:
     - `estimatedAmountPaise`, `requestedAmountPaise`, `approvedAmountPaise`, `disbursedAmountPaise`, and `remainingAmountPaise`.
     - Invariants enforced server-side: Non-negative amounts; `approvedAmountPaise <= requestedAmountPaise`; cumulative `disbursedAmountPaise <= approvedAmountPaise`.
   - Validated subsidy state machine: `ELIGIBLE` → `DOCUMENTS_PENDING` → `READY_TO_APPLY` → `APPLIED` → `UNDER_REVIEW` → `APPROVED` → `SANCTIONED` → `DISBURSED` / `REJECTED` / `CANCELLED`.
   - Concurrency-safe, append-only disbursement ledger:
     - Supports partial disbursements across multiple installments.
     - Enforces duplicate prevention via unique `idempotencyKey` and bank transaction UTR.
     - Never marks funds as received merely upon approval; tracks actual disbursement realization with date and payment mode.
   - Customer Portal isolation: Customers can access and review only their own subsidy claims.

4. **Document Requirements & Private Evidence Gateway:**
   - 12 standardized regulatory document types (`ELECTRICITY_BILL`, `PROPERTY_TAX_RECEIPT`, `AADHAAR_CARD`, `PAN_CARD`, `CANCELLED_CHEQUE`, `PASSPORT_PHOTO`, `SINGLE_LINE_DIAGRAM`, `TEST_REPORT`, `VENDOR_INVOICE`, `COMMISSIONING_REPORT`, `SUBSIDY_CLAIM_AFFIDAVIT`, `NET_METERING_AGREEMENT`).
   - Configurable per-application document requirement checklists with status tracking (`REQUIRED`, `UPLOADED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `RESUBMISSION_REQUIRED`).
   - Private authorized access generation with 300s TTL and multi-tenant customer ownership checks.

5. **Notifications, Reminders & Honest Audit:**
   - `NotificationReminderService` supporting upcoming inspection reminders, document rejection alerts, follow-up alerts, and meter installation tracking.
   - Automated reminder deduplication key `${entityType}:${entityId}:${reminderType}:${targetDate}` preventing alert spam.
   - Honest delivery status reporting: Emits `SIMULATED_LOG_ONLY` when external gateways (SMS/WhatsApp) are unconfigured, avoiding false delivery claims.

6. **Web User Interface (`apps/web`):**
   - `NetMeteringPage`: Dedicated register with summary cards (Total Applications, In Review, Inspection Scheduled, Approved/Installed), utility filter, status pipeline, and detail inspection modals.
   - `SubsidyPage`: Dedicated financial register with financial metric cards (Total Requested, Total Approved, Disbursed, Pending Disbursement in Rupees), scheme filter, and disbursement ledger view.
   - `NetMeteringTab`: Integrated into `ProjectDetailPage.tsx`, showing utility connection details, document readiness checklist, feasibility & demand note tracking, inspection scheduling, and meter installation.
   - `SubsidyTab`: Integrated into `ProjectDetailPage.tsx`, showing scheme status, financial breakdown cards, bank account details for DBT, document review gates, and partial disbursement history.
   - Main navigation: Added "Net Metering" and "Subsidies" routes and sidebar links.

7. **Automated Verification:**
   - 325 passing tests with 0 failures across `@ins-solar/shared` (135 tests), `@ins-solar/api` (164 tests), and `@ins-solar/web` (26 tests).

---

## 2. Implemented Models, Schemas & Services

### 2.1 Backend Domain Models

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `NetMeteringApplication` | `net_metering_applications` | Utility net-metering lifecycle, inspections, and meter tracking | `applicationNumber` (unique `NMA-YYYY-NNNNN`), `projectId` (indexed), `customerId` (indexed), `orderId`, `discomName`, `division`, `subdivision`, `consumerNumber`, `status`, `technicalFeasibility`, `inspection`, `meterInstallation`, `documentRequirements`, `statusHistory`. Compound index `{ projectId: 1, discomName: 1 }`. |
| `SubsidyApplication` | `subsidy_applications` | Government subsidy claims, DBT status, and disbursement ledger | `applicationNumber` (unique `SUB-YYYY-NNNNN`), `projectId` (indexed), `customerId` (indexed), `schemeName`, `schemeVersion`, `nationalPortalApplicationNumber` (sparse unique), `requestedAmountPaise`, `approvedAmountPaise`, `disbursedAmountPaise`, `remainingAmountPaise`, `status`, `disbursements` subdocuments (`idempotencyKey` sparse unique, `installmentNumber`, `amountPaise`, `disbursedAt`, `utrNumber`), `documentRequirements`, `statusHistory`. |

### 2.2 Core Business Services

| Service | File | Responsibilities |
| :--- | :--- | :--- |
| `NetMeteringService` | `apps/api/src/services/netMeteringService.ts` | Atomic sequence numbering; application creation with project/customer validation; state machine transitions with document completeness gates; inspection scheduling and outcome recording; meter installation logging; technical feasibility updates; private document URL generation. |
| `SubsidyService` | `apps/api/src/services/subsidyService.ts` | Atomic sequence numbering; subsidy creation; sanction recording (`approved <= requested`); concurrency-safe disbursement entry with unique idempotency keys and UTR numbers; balance invariant checks (`disbursed <= approved`); document review updates; customer portal multi-tenant isolation. |
| `NotificationReminderService` | `apps/api/src/services/notificationReminderService.ts` | Centralized notification dispatch; automated reminder deduplication; honest delivery status reporting (`SIMULATED_LOG_ONLY` in development/staging). |
| `SequenceService` (extended) | `apps/api/src/services/sequenceService.ts` | Extended with `SequenceEntityType.NET_METERING` (`NMA`) and `SequenceEntityType.SUBSIDY` (`SUB`). |

---

## 3. Versioned REST API Routes

Mounted under `/api/v1`:

### 3.1 Net Metering Endpoints (`/api/v1/net-metering`)
- `POST /` — Create a new net metering application (Staff, RBAC `net_metering:create`).
- `GET /` — List applications with filters (project, customer, status, DISCOM, pagination).
- `GET /:id` — Get application details with timeline and document status.
- `PATCH /:id/status` — Validated status transition with document completeness checks.
- `PATCH /:id/feasibility` — Update technical feasibility & demand note (amount in paise).
- `PATCH /:id/inspection` — Schedule or record field inspection outcome.
- `PATCH /:id/meter-installation` — Record bi-directional meter installation and readings.
- `PATCH /:id/documents/:docType` — Update application document review status and notes.
- `GET /:id/documents/:docType/access-url` — Generate short-lived private access URL.

### 3.2 Subsidy Tracking Endpoints (`/api/v1/subsidies`)
- `POST /` — Create a new subsidy claim application (Staff, RBAC `subsidy:create`).
- `GET /` — List subsidy claims with scheme and status filters.
- `GET /:id` — Get subsidy details with disbursement breakdown.
- `PATCH /:id/status` — Validated status transition.
- `PATCH /:id/sanction` — Record official sanction (`approvedAmountPaise <= requestedAmountPaise`).
- `POST /:id/disbursements` — Add partial disbursement entry (enforces non-exceeding balance and unique `idempotencyKey`).
- `PATCH /:id/documents/:docType` — Update subsidy document review status.
- `GET /:id/documents/:docType/access-url` — Generate short-lived private access URL.

### 3.3 Customer Portal Endpoints (`/api/v1/customer-portal/projects/:id`)
- `GET /:id/net-metering` — Retrieve customer's project net metering status (tenant-isolated).
- `GET /:id/subsidy` — Retrieve customer's project subsidy status and disbursements (tenant-isolated).

---

## 4. Quality Gates & Test Verification

All quality gates passed cleanly across the entire monorepo:

```bash
# 1. Typecheck: Zero TypeScript errors across all 3 workspaces
npm run typecheck
✓ @ins-solar/shared: tsc --noEmit (0 errors)
✓ @ins-solar/api: tsc --noEmit (0 errors)
✓ @ins-solar/web: tsc --noEmit (0 errors)

# 2. Automated Test Suite: 325 passing tests, 0 failures
npm test
✓ @ins-solar/shared: 135 passed (including 16 net metering & subsidy schema tests)
✓ @ins-solar/api: 164 passed (including 14 comprehensive Phase 7A integration tests)
✓ @ins-solar/web: 26 passed (including 4 Phase 7A page and component tests)

# 3. Production Bundles: Built successfully
npm run build
✓ @ins-solar/shared built (dist/)
✓ @ins-solar/api built (dist/)
✓ @ins-solar/web built (dist/assets/index.js 823.77 kB, index.css 44.61 kB)
```

---

## 5. Traceability Matrix Resolution & Status

| Requirement ID | Module / Feature | Implemented Components | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-MOD17-01` | Utility Application Number | `NetMeteringApplication.applicationNumber` (`NMA-YYYY-NNNNN`) | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-02` | Customer & Project Association | `projectId`, `customerId` validation & isolation | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-03` | DISCOM Office Identification | `discomName`, `division`, `subdivision`, `consumerNumber` | `netMetering_subsidy.test.ts` | **Verified** |
| `REQ-MOD17-04` | Application Submission Date | `submissionDate`, `applicationReferenceNumber` | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-05` | Regulatory Document Checklist | `documentRequirements` gate blocking submission | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-06` | DISCOM Feasibility & Site Inspection | Feasibility demand note & inspection scheduler | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-07` | Bi-Directional Meter Installation | `meterInstallation` tracking & initial/final readings | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-08` | Subsidy Application Lifecycle | `SubsidyApplication` state machine & transitions | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-09` | Liaison Remarks & Action Notes | `internalNotes`, `statusHistory`, `rejectionReason` | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-10` | Subsidy Eligibility Verification | `eligibilityStatus`, `eligibilityNotes`, verification | `phase7a.test.ts` | **Verified** |
| `REQ-MOD17-11` | DISCOM Escalation Reminders | `NotificationReminderService` deduplication & alerts | `phase7a.test.ts` | **Verified** |

---

## 6. Open Decisions, Risks & External Dependencies

1. **Third-Party Government / DISCOM Integration:**
   - Real-time API integrations with state DISCOM portals or the National Rooftop Solar Portal require official governmental API credentials, dedicated IP whitelisting, and digital certificates.
   - Current implementation provides complete operational manual-tracking and document verification without claiming synthetic integrations.
2. **Payment Gateway / Direct Benefit Transfer (DBT):**
   - Government rooftop subsidies are typically disbursed directly to the consumer's Aadhaar-linked bank account (DBT) by the nodal agency or utility. The disbursement ledger tracks and reconciles official bank UTR numbers and sanction references honestly without fabricating payment gateway events.
3. **Private Object Storage:**
   - Document files are stored against private storage keys (`evidence/documents/...`) with signed short-lived URLs. Live S3/Cloud Storage bucket provisioning remains environment-dependent.
