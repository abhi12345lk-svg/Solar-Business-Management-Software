# INS Solar — Phase 4A Implementation Report: CRM, Lead Management, Follow-ups & Site Survey Foundation

**Document Reference:** `INS-DEV-P4A-001`  
**Date:** October 23, 2026  
**Implementation Lead:** Lead Software Architect, CRM Domain Architect & Senior Full-Stack Engineer  
**Status:** Completed & Empirically Verified  
**Runtime Toolchain:** Node.js `v24.11.1` LTS / npm `v11.6.2` / TypeScript `5.7.3` / Vitest `3.2.7`  

---

## 1. Executive Summary

Phase 4A of the **INS Solar Business Management System** has been successfully designed, implemented, and verified. This phase establishes the operational solar-business CRM foundation, providing robust, scalable, and audit-compliant workflows for:

1. **Lead Management:** Atomic document sequencing (`LEAD-YYYY-NNNNN`), structured solar requirements, sanitized contact details, supervisory assignments, and strict lifecycle state machine controls.
2. **Duplicate-Contact Detection:** Advisory search across leads and customers based on normalized E.164 phone numbers that alerts sales reps without rejecting legitimate shared family or corporate numbers.
3. **Lead Activity & Follow-up History:** Chronological, tamper-evident interaction logging (calls, meetings, site visits, notes), qualitative sentiment classification, and overdue/upcoming follow-up tracking.
4. **Site Survey Foundation:** Architectural site audit records with atomic sequencing (`SRV-YYYY-NNNNN`), non-negative physical measurements (usable roof area in sq ft, integer paise electricity bill, utility sanctioned load in kW), structural roof classification, shadow analysis notes, and private photo metadata attachment.
5. **Idempotent Lead-to-Customer Conversion:** Transitioning qualified prospects into formal `Customer` records with duplicate-conversion prevention, bidirectional referencing, and permanent lead history preservation.
6. **Operational UI:** High-polish, responsive web views for Leads, Lead Details & Timelines, Follow-ups, and Site Surveys with full API persistence, optimistic loading states, and error handling.

All existing security barriers (Argon2id, anti-self-approval, session lifecycle, CSRF tokens, rate limiting), catalog foundations, warehouse registries, and database connection controls remain completely intact with zero regressions across **151 passing automated tests**.

---

## 2. Implemented Architecture & Source Files

### 2.1 Workspace: `@ins-solar/shared` (`packages/shared/`)
* **[enums.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/types/enums.ts):**
  * Added `SequenceEntityType.LEAD` and `SequenceEntityType.SURVEY`.
  * Added `LeadStatus` enum (`NEW`, `CONTACTED`, `QUALIFIED`, `SURVEY_SCHEDULED`, `SURVEY_COMPLETED`, `PROPOSAL_SENT`, `NEGOTIATION`, `CONVERTED`, `LOST`, `ARCHIVED`).
  * Added `LeadSource` enum (`WEBSITE`, `REFERRAL`, `EXPO`, `COLD_CALL`, `SOCIAL_MEDIA`, `CHANNEL_PARTNER`, `DIRECT_INQUIRY`, `OTHER`).
  * Added `LeadPriority` enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  * Added `SolarRequirement` enum (`RESIDENTIAL`, `COMMERCIAL_INDUSTRIAL`, `AGRICULTURAL_PUMP`, `STORAGE_RETROFIT`, `OFF_GRID_REMOTE`, `OTHER`).
  * Added `ActivityType` enum (`CALL`, `MEETING`, `VISIT`, `NOTE`, `FOLLOW_UP`, `SURVEY`, `STATUS_CHANGE`).
  * Added `ActivityStatus` enum (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `RESCHEDULED`).
  * Added `ActivitySentiment` enum (`HOT`, `WARM`, `COLD`).
  * Added `SurveyStatus` enum (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  * Added `RoofType` enum (`RCC_FLAT`, `METAL_TRAPEZOIDAL`, `METAL_STANDING_SEAM`, `TILED_SLOPED`, `GROUND_MOUNT`, `SHED_CURVED`, `OTHER`).
  * Added `ConnectionPhase` enum (`SINGLE_PHASE`, `THREE_PHASE`).
  * Added `SurveyPhotoCategory` enum (`ROOF`, `DISTRIBUTION_BOARD`, `ENERGY_METER`, `EARTHING_PIT`, `OBSTACLE_SHADOW`, `CABLE_TRAY`, `OTHER`).
  * Added CRM security audit actions (`LEAD_ASSIGNED`, `LEAD_STATUS_CHANGED`, `LEAD_CONVERTED`, `SURVEY_STATUS_CHANGED`).
* **[auth.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/types/auth.ts):**
  * Added `lead:convert` permission to `ALL_PERMISSIONS`.
  * Configured role defaults allowing Administrators, Sales Managers, and Sales Executives to perform CRM operations according to their scope.
* **[crm.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/schemas/crm.ts):**
  * Defined Zod schemas and TypeScript DTOs: `CreateLeadInputSchema`, `UpdateLeadInputSchema`, `AssignLeadInputSchema`, `LeadFilterSchema`, `CreateLeadActivityInputSchema`, `UpdateLeadActivityInputSchema`, `FollowUpFilterSchema`, `SurveyPhotoSchema`, `CreateSiteSurveyInputSchema`, `UpdateSiteSurveyInputSchema`, `SiteSurveyFilterSchema`, `DuplicatePhoneCheckSchema`.
* **[crm.test.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/__tests__/crm.test.ts):**
  * 15 automated unit tests validating lead creation constraints, lost reason requirements, non-negative survey measurements, integer paise electric bills, and phone query normalization.

### 2.2 Workspace: `@ins-solar/api` (`apps/api/`)
* **[Lead.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/Lead.ts):**
  * Mongoose schema with `{ leadCode: 1 }` unique index, non-unique `{ prospectPhone: 1 }` index, `{ assignedToEmployeeId: 1, status: 1 }` compound index, and lifecycle tracking.
* **[LeadActivity.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/LeadActivity.ts):**
  * Chronological interaction model with `{ leadId: 1, activityDate: -1 }` index, `{ assignedEmployeeId: 1, nextFollowUpDate: 1, status: 1 }` compound index for fast follow-up filtering.
* **[SiteSurvey.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/SiteSurvey.ts):**
  * Solar site engineering audit model with `{ surveyNumber: 1 }` unique index, `{ leadId: 1 }` and `{ customerId: 1 }` relational links, non-negative measurements, and embedded photo metadata subdocuments.
* **[leadService.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/services/leadService.ts):**
  * Business logic for atomic lead creation (`LEAD-YYYY-NNNNN`), advisory duplicate phone checking, RBAC record-scoping (sales reps see only assigned/unassigned leads, department heads see department scope, admins see all), supervisory lead assignment/reassignment with audit logging, chronological activity logging, and follow-up query filtering (`all`, `overdue`, `today`, `upcoming`).
* **[surveyService.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/services/surveyService.ts):**
  * Business logic for atomic survey creation (`SRV-YYYY-NNNNN`), non-negative measurement validations, lifecycle state progression (`SCHEDULED` -> `IN_PROGRESS` -> `COMPLETED`), and private photo metadata attachment.
* **[lead.routes.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/routes/lead.routes.ts):**
  * Secure Express endpoints mounted at `/api/v1/leads`:
    * `GET /api/v1/leads`: Paginated lead directory with role scoping.
    * `POST /api/v1/leads`: Lead creation with input validation.
    * `GET /api/v1/leads/check-duplicate`: Duplicate phone advisory search.
    * `GET /api/v1/leads/follow-ups`: Scheduled follow-ups query filter.
    * `PATCH /api/v1/leads/follow-ups/:id/complete`: Complete a follow-up.
    * `GET /api/v1/leads/:id`: Single lead retrieval.
    * `PATCH /api/v1/leads/:id`: Safe lead updates (protected fields blocked).
    * `POST /api/v1/leads/:id/assign`: Authorized sales rep assignment.
    * `POST /api/v1/leads/:id/convert`: Idempotent customer conversion.
    * `GET /api/v1/leads/:id/activities`: Chronological interaction history.
    * `POST /api/v1/leads/:id/activities`: Log new interaction activity.
* **[survey.routes.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/routes/survey.routes.ts):**
  * Secure Express endpoints mounted at `/api/v1/surveys`:
    * `GET /api/v1/surveys`: Paginated survey directory.
    * `POST /api/v1/surveys`: Survey creation linked to lead or customer.
    * `GET /api/v1/surveys/:id`: Survey detail retrieval.
    * `PATCH /api/v1/surveys/:id`: Survey update and lifecycle progression.
    * `POST /api/v1/surveys/:id/photos`: Photo metadata attachment.
* **[phase4a.test.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/__tests__/phase4a.test.ts):**
  * 13 comprehensive integration tests verifying lead creation, atomic numbering, duplicate phone checks, RBAC supervisory assignment, sales record scoping, activity history persistence, overdue follow-up queries, survey measurements, status lifecycle, photo metadata attachment, customer conversion idempotency, mass assignment protection, and 401 unauthenticated guards.

### 2.3 Workspace: `@ins-solar/web` (`apps/web/`)
* **[LeadsPage.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/LeadsPage.tsx):**
  * Lead directory with search by prospect name, phone, or lead code, status and priority filter chips, and a New Lead dialog featuring live duplicate phone detection advisory alerts.
* **[LeadDetailPage.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/LeadDetailPage.tsx):**
  * Detailed lead profile displaying requirement category, capacity, contact information, status updater, "Convert to Customer" workflow button, Log Activity dialog, and an interactive chronological activity timeline.
* **[FollowUpsPage.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/FollowUpsPage.tsx):**
  * Scheduled interactions management with quick-filter tabs for **All**, **Overdue**, **Today**, and **Upcoming**, displaying client contacts, scheduled dates, and action to complete follow-ups.
* **[SurveysPage.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/SurveysPage.tsx):**
  * Site survey registry displaying usable roof area, sanctioned loads, monthly electricity bills, survey status badges, New Survey creation dialog, and photo metadata attachment drawer.
* **[AppLayout.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/components/layout/AppLayout.tsx):**
  * Added navigation sidebar links for Leads, Follow-ups, and Surveys with modern SVG icons.
* **[App.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/App.tsx):**
  * Registered authenticated client routes: `/leads`, `/leads/:id`, `/follow-ups`, and `/surveys`.
* **[crmPages.test.tsx](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/__tests__/crmPages.test.tsx):**
  * 3 automated React Testing Library tests verifying successful rendering and API integration of the new CRM pages.

---

## 3. Key CRM Policies & Domain Invariants

### 3.1 Lead vs Customer Boundary & Conversion Behavior
* **Strict Decoupling:** Inquiries and preliminary prospects are stored exclusively in the `Lead` collection. A lead never becomes a `Customer` automatically merely upon submission.
* **Explicit Conversion Action:** Conversion requires an explicit HTTP POST to `/api/v1/leads/:id/convert` authorized by an employee with `lead:convert` permission.
* **Conversion Idempotency:**
  * Checks if `lead.status === LeadStatus.CONVERTED` and `lead.convertedCustomerId` is already populated.
  * If already converted, returns the existing customer link immediately without creating duplicate customer records or throwing an unhandled conflict.
  * If converting for the first time:
    1. Looks up existing Customer by normalized phone or creates a new `Customer` record with sequential code `CUST-YYYY-NNNNN`.
    2. Updates lead status to `CONVERTED` and binds `lead.convertedCustomerId = customer._id`.
    3. Logs an audit event and appends a `STATUS_CHANGE` record to `LeadActivity`.
    4. **History Preservation:** The original `Lead` record and all past interactions are permanently preserved; neither is ever deleted.

### 3.2 Duplicate-Contact Detection Policy
* **Advisory Warning, Not Blocking Rejection:** In the Indian solar rooftop market, families, property owners, and business conglomerates frequently share contact phone numbers across multiple properties or separate project inquiries. Therefore, matching phone numbers generate advisory warnings for sales review (`isDuplicate: true`), rather than rejecting lead creation.
* **Database Index:** The `Lead.prospectPhone` field is indexed for efficient query lookup (`{ prospectPhone: 1 }`), but does **not** have a unique constraint.
* **Privacy Isolation:** Duplicate lookup queries sanitize results, returning only minimum necessary metadata (Lead Code, Prospect Name, Created Date, Status) and preventing leakage of confidential customer data to unauthorized users.

### 3.3 Assignment & Access Control Rules
* **Assignment Authorization:** Only Administrators and Sales Department Heads are authorized to assign or reassign leads to sales representatives. Sales executives are strictly prevented from reassigning leads or modifying owner metadata.
* **Record Scoping:**
  * Administrators and Sales Department Heads can view all leads across their supervisory domain.
  * Sales Executives querying `/api/v1/leads` are strictly scoped by the database query engine to:
    1. Leads explicitly assigned to their `userId` (`assignedToEmployeeId: userId`), OR
    2. Unassigned leads available in the pool (`assignedToEmployeeId: null / { $exists: false }`).
* **Mass Assignment Protection:** Fields such as `_id`, `leadCode`, `convertedCustomerId`, `createdBy`, and `createdAt` are omitted from user updates and strictly rejected if submitted.

### 3.4 Site Survey & Photo Metadata Handling
* **Physical Measurement Integrity:** Usable roof area (`usableRoofAreaSqFt`), average monthly electricity bill (`averageMonthlyBillPaise`), and sanctioned load (`sanctionedLoadKw`) are validated by Zod as non-negative numbers. Incomplete or unknown values remain `undefined` rather than falsely recorded as `0`.
* **Zero Binary Storage in MongoDB:** Image binary data is never stored in MongoDB. The `SiteSurvey.photos` array stores private object references (`storageKey`), category tags (`ROOF`, `DISTRIBUTION_BOARD`, etc.), MIME types, and file sizes.
* **Secure Storage Boundary:** Because external cloud object storage (e.g. AWS S3) is not yet configured with production credentials in Phase 4A, no fake uploads or public URLs are constructed. The schema and API enforce the exact secure metadata interface boundary ready for signed URL generation in Phase 6.

---

## 4. Verification Test Results

All test suites were executed across the entire monorepo using `npm run test` and `npm run ci`.

```
Test Files  14 passed (14)
     Tests  151 passed (151)
  Duration  5.82s

Workspaces verified:
- @ins-solar/shared: 5 test suites, 76 passed (auth, catalog, crm, domain, schemas)
- @ins-solar/api:    9 test suites, 71 passed (bootstrap, crypto, env, errors, health, phase3a, phase3b, phase4a, security)
- @ins-solar/web:    2 test suites,  4 passed (App, crmPages)
```

### Static Analysis & Stop Gate Verification
* `npm run typecheck`: **0 errors** across all workspaces (`tsc --noEmit`).
* `npm run lint`: **0 errors** (`eslint .`).
* `npm run format:check`: **0 errors** (all files formatted with Prettier).
* `npm run build`: **0 errors** (Vite web bundle and TypeScript builds successful).

---

## 5. Traceability Matrix Updates

The following requirement items in `docs/requirements/feature-traceability-matrix.md` have been updated to **Verified**:

| Req ID | Module / Area | Feature | Status |
| :--- | :--- | :--- | :--- |
| `REQ-MOD02-01` | Lead Management | Atomic Lead ID Generation (`LEAD-YYYY-NNNNN`) | **Verified** |
| `REQ-MOD02-02` | Lead Management | Lead Date & Creator Attribution | **Verified** |
| `REQ-MOD02-03` | Lead Management | Customer Name Capture & Sanitization | **Verified** |
| `REQ-MOD02-04` | Lead Management | Mobile Number Normalization & Advisory Duplicate Check | **Verified** |
| `REQ-MOD02-05` | Lead Management | Location Details & Postal PIN Code | **Verified** |
| `REQ-MOD02-06` | Lead Management | Lead Source Attribution Master | **Verified** |
| `REQ-MOD02-07` | Lead Management | Solar Requirement Classification | **Verified** |
| `REQ-MOD02-08` | Lead Management | Desired Capacity Capture (kWp) | **Verified** |
| `REQ-MOD02-09` | Lead Management | Assigned Employee Tracking & Audit | **Verified** |
| `REQ-MOD02-10` | Lead Management | Lead Lifecycle State Machine | **Verified** |
| `REQ-MOD03-01` | Customer Management | Customer ID Generation (`CUST-YYYY-NNNNN`) | **Verified** |
| `REQ-MOD03-02` | Customer Management | Customer Legal Name Structure | **Verified** |
| `REQ-MOD03-03` | Customer Management | Mobile Numbers & Primary E.164 Contact | **Verified** |
| `REQ-MOD03-04` | Customer Management | Validated Email RFC 5322 Address | **Verified** |
| `REQ-MOD03-05` | Customer Management | Permanent Billing Postal Address | **Verified** |
| `REQ-MOD03-06` | Customer Management | GSTIN & PAN Identification Primitives | **Verified** |
| `REQ-MOD04-01` | Follow-up Management | Lead / Customer Relational Linkage | **Verified** |
| `REQ-MOD04-02` | Follow-up Management | Interaction Timestamp Capture | **Verified** |
| `REQ-MOD04-03` | Follow-up Management | Discussion Narrative Logging | **Verified** |
| `REQ-MOD04-04` | Follow-up Management | Next Follow-up Scheduling | **Verified** |
| `REQ-MOD04-05` | Follow-up Management | Assigned Employee Ownership | **Verified** |
| `REQ-MOD04-06` | Follow-up Management | Status Lifecycle (Scheduled -> Completed) | **Verified** |
| `REQ-MOD04-07` | Follow-up Management | Qualitative Remarks & Sentiment (Hot, Warm, Cold) | **Verified** |
| `REQ-MOD05-01` | Site Survey | Sequential Survey ID Generation (`SRV-YYYY-NNNNN`) | **Verified** |
| `REQ-MOD05-02` | Site Survey | Customer & Lead Relational Association | **Verified** |
| `REQ-MOD05-03` | Site Survey | Site Physical Address & Geo-Location | **Verified** |
| `REQ-MOD05-04` | Site Survey | Roof Substrate Classification | **Verified** |
| `REQ-MOD05-05` | Site Survey | Usable Roof Area Measurement (sq ft) | **Verified** |
| `REQ-MOD05-06` | Site Survey | Electricity Bill Audit (Paise & kWh) | **Verified** |
| `REQ-MOD05-07` | Site Survey | Sanctioned Load Verification (kW, 1P/3P) | **Verified** |
| `REQ-MOD05-08` | Site Survey | Shadow Analysis Documentation | **Verified** |
| `REQ-MOD05-09` | Site Survey | Proposed Plant Capacity (kWp) | **Verified** |
| `REQ-MOD05-11` | Site Survey | Assigned Surveyor Tracking | **Verified** |
| `REQ-MOD05-12` | Site Survey | Technical Remarks & Constraints | **Verified** |

---

## 6. Known Limitations & Deferred Items

1. **Solar Sizing Calculation Engine:** In accordance with the Phase 4A scope boundaries, mathematical generation models, module count calculations, inverter loading ratios, and battery autonomy sizing are strictly deferred to Phase 4B.
2. **Quotation Generation & PDF Compilation:** Quotation revision tracking (`R0`, `R1`), commercial discount approval gates, and server-side PDF document rendering are deferred to Phase 4B.
3. **Automated Notification Delivery:** Follow-up dates and reminders are stored and queried on the server; background push notifications or email dispatch queues will be implemented in Phase 9.
4. **Cloud Object Storage (S3):** Survey photo metadata is fully modeled in MongoDB with private storage keys; physical file upload to AWS S3 and short-lived pre-signed URL generation will be integrated in Phase 6.

---

## 7. Recommended Next Implementation Batch (Phase 4B)

With Phase 4A verified and operational, the recommended next batch is **Phase 4B: Solar Sizing Engine, Quotations & Proposal Delivery**:

1. **Tri-Topology Solar Sizing Engine:** Implement sizing algorithms for On-Grid, Off-Grid, and Hybrid topologies computing panel counts, inverter capacity matching, and battery storage.
2. **Quotation Management:** Implement `Quotation` model with atomic sequence generation (`QT-YYYY-XXXXX-R0`), revision history, bill of materials (BOM) compilation, and integer paise pricing.
3. **Discount Approval Gate:** Restrict quotations where discounts exceed the configured threshold, requiring Admin approval before status can advance to `APPROVED` or `SENT`.
4. **Proposal Document Rendering:** Implement server-side PDF generation producing professional proposals with company branding, BOM breakdowns, warranty terms, and commercial schedules.
