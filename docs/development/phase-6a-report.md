# INS Solar — Phase 6A Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-006A`  
**Version:** `1.0.0`  
**Date:** 2026-10-26  
**Status:** Complete & Verified Gate  
**Phase:** Phase 6A (Project Management & Installation Milestones)  
**Parent Verification:** Phase 5B Verification (245 passing tests)  
**Current Test Suite:** 271 passing tests across all workspaces (100% green, 0 failures)

---

## 1. Executive Summary

Phase 6A of the **INS Solar Business Management System** has been designed, implemented, and verified. This phase establishes the core project management and installation lifecycle foundation for confirmed solar orders, seamlessly connecting sales orders, customer sites, field milestones, team task delegations, and stage progression:

1. **Pre-Implementation Audit:** Verified actual presence of Phase 5A (`SalesOrder`, `StockBalance`, `StockMovement`, `StockReservation`) and Phase 5B (`Vendor`, `PurchaseOrder`, `GoodsReceipt`, `VendorInvoice`, `ProductSerialNumber`) models and services. Confirmed that order management exists and supports 1:1 project generation.
2. **Project Domain Model (`Project` & `ProjectService`):** Controlled lifecycle for customer projects with unique sequence numbers (`PRJ-YYYY-NNNNN`), customer and site binding, project manager/team allocation, topology (`ON_GRID`, `OFF_GRID`, `HYBRID`), capacity (kWp), planned vs actual completion dates, and audit metadata.
3. **1:1 Order-to-Project Guard:** Enforced via MongoDB sparse unique compound indexing on `orderId` and pre-save database validation. Multiple active projects cannot be instantiated from the same sales order.
4. **10-Stage Installation Progression Engine:** Formalized stage gates (`STAGE_1_ENGINEERING_DESIGN` through `STAGE_10_COMMISSION_HANDOVER`) tracking chronological transitions, transitioning actors, timestamps, and handover notes.
5. **Quality Installation Milestones:** Configurable milestone subdocument array with default 10-milestone template initialization. Validated state transitions (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`), mandatory blocker reasons when blocked, and audit sign-off metadata (completion actor and timestamp).
6. **Project Task Engine (`ProjectTask` & `ProjectTaskService`):** Scoped task management with atomic sequence codes (`TSK-YYYY-NNNNN`), assignment, priorities, due dates, and cross-project validation (strictly blocks assigning a task to a milestone belonging to another project). Includes overdue task query filters.
7. **Customer Portal Isolation:** Added customer-facing project endpoints (`/api/v1/customer-portal/projects`) enforcing strict multi-tenant boundary checks (customers can only view projects linked to their authenticated session customer ID).
8. **Operational Web Interface (`apps/web`):**
   - `ProjectsPage`: Metrics counters (Total, In Progress, Planning, Completed, On Hold), search bar, priority/status dropdowns, 10-stage pipeline progress bar, and "New Project" modal with order auto-population.
   - `ProjectDetailPage`: Visual 10-stage progression stepper, overview cards (customer, order, site address, technical specifications, schedule), quality milestone checklist with blocker/sign-off controls, project task delegation with overdue alerts, and stage history timeline.
9. **Automated Verification:** 271 automated tests passing with 0 failures across `@ins-solar/shared` (113 tests), `@ins-solar/api` (138 tests), and `@ins-solar/web` (20 tests).

---

## 2. Implemented Models, Schemas & Services

### 2.1 Backend Domain Models

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `Project` | `projects` | Installation lifecycle for confirmed customer solar installations | `projectCode` (unique `PRJ-YYYY-NNNNN`), `name`, `customerId` (indexed), `orderId` (sparse unique index), `siteAddress`, `systemCapacityKwp`, `systemTopology`, `projectManagerId`, `teamMemberIds`, `currentStage`, `stageHistory`, `milestones`, `status`, `priority`, `plannedStartDate`, `targetCompletionDate`, `actualCompletionDate`. |
| `ProjectTask` | `project_tasks` | Action items and field tasks scoped to project and milestone | `taskCode` (unique `TSK-YYYY-NNNNN`), `projectId` (indexed), `milestoneId`, `title`, `description`, `priority`, `status`, `dueDate`, `blockerReason`, `assignedUserId` (indexed), `completedAt`, `completedBy`. |

### 2.2 Core Business Services

| Service | File | Responsibilities |
| :--- | :--- | :--- |
| `ProjectService` | `apps/api/src/services/projectService.ts` | Project creation with atomic `PRJ-YYYY-NNNNN` sequences; customer validation; duplicate order project rejection; automatic 10-milestone template initialization; lifecycle state machine (`PLANNING` → `IN_PROGRESS` → `COMPLETED` / `ON_HOLD` / `CANCELLED`); stage-gate advancement; milestone CRUD and status transitions with mandatory blocker reason validation. |
| `ProjectTaskService` | `apps/api/src/services/projectTaskService.ts` | Task creation with atomic `TSK-YYYY-NNNNN` sequences; cross-project milestone guard (rejects milestone ID from differing project); assignee validation; overdue status query filtering; status transitions. |
| `SequenceService` (extended) | `apps/api/src/services/sequenceService.ts` | Extended with `SequenceEntityType.TASK` (`TSK-YYYY-NNNNN`). `SequenceEntityType.PROJECT` (`PRJ-YYYY-NNNNN`) already supported. |

### 2.3 10 Standard Installation Milestone Templates

Every new project initialized with `applyDefaultMilestones: true` automatically receives the standard 10 quality gates:

1. **Site Readiness & Structural Assessment** (Order: 1)
2. **DISCOM Net-Metering Application Submission** (Order: 2)
3. **Procurement Readiness & Material Inbound Verification** (Order: 3)
4. **Civil Foundations & Module Mounting Structure (MMS)** (Order: 4)
5. **Solar Module Mounting & String DC Cabling** (Order: 5)
6. **Inverter Mounting, DCDB & ACDB Electrical Termination** (Order: 6)
7. **Chemical Earthing Pit Installation & Lightning Arrestor (LA)** (Order: 7)
8. **Pre-Commissioning Insulation & String Voc/Isc Testing** (Order: 8)
9. **DISCOM Bi-Directional Net-Meter Installation & Sync** (Order: 9)
10. **Plant Commissioning, Handover & Documentation Pack** (Order: 10)

---

## 3. Versioned REST API Routes

Mounted under `/api/v1`:

| Router | Mount Path | Methods & Paths | Permissions / Guards |
| :--- | :--- | :--- | :--- |
| `projectRouter` | `/api/v1/projects` | `POST /`<br>`GET /`<br>`GET /:id`<br>`PUT /:id`<br>`POST /:id/status`<br>`POST /:id/stage`<br>`POST /:id/milestones`<br>`PUT /:id/milestones/:milestoneId`<br>`POST /:id/milestones/:milestoneId/status`<br>`GET /:id/tasks`<br>`POST /:id/tasks` | `project:create`<br>`project:read`<br>`project:read`<br>`project:update`<br>`project:update`<br>`project:stage_advance`<br>`project:update`<br>`project:update`<br>`project:update`<br>`project:read`<br>`project:update` |
| `projectTaskRouter` | `/api/v1/tasks` | `GET /`<br>`GET /:id`<br>`PUT /:id`<br>`DELETE /:id` | `project:read`<br>`project:read`<br>`project:update`<br>`project:update` |
| `customerProjectRouter` | `/api/v1/customer-portal/projects` | `GET /`<br>`GET /:id` | `requireCustomerAuth` (Strictly scoped to session customer ID) |

---

## 4. Frontend Operational Screens (`apps/web`)

| Page | Route | Description |
| :--- | :--- | :--- |
| `ProjectsPage` | `/projects` | Project directory table, search by project code/name/customer, status filter (`PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED`), priority filter, 10-stage mini progress bar, and "New Project" modal with customer & order selection. |
| `ProjectDetailPage` | `/projects/:id` | Full operational project console: visual 10-stage pipeline stepper, status transition action controls (`Start Project`, `Advance Stage`, `Hold`, `Complete`, `Cancel`), and 4-tab interface: <br>1. **Overview:** Customer details, linked sales order, technical capacity, site address, and schedule.<br>2. **Milestones:** Checklist of 10 gates with status badges, blocker alerts, and sign-off timestamps/actors.<br>3. **Tasks:** Scoped tasks list, priority badges, due dates, overdue highlights, quick status updates, and "New Task" modal.<br>4. **Activity History:** Chronological stage transition log and audit events. |

---

## 5. Security & Data Integrity Validations

1. **Anti-Duplicate Project Guard:** A unique sparse index on `orderId` in MongoDB ensures that only one project can ever be bound to an order. The service explicitly catches pre-existing links and rejects attempts with HTTP 409 (`AppError.duplicateResource`).
2. **Cross-Project Milestone Isolation:** In `ProjectTaskService.createTask`, when a `milestoneId` is provided, the service verifies that the milestone belongs to the target project (`project.milestones.id(input.milestoneId)`). If not found, the operation is rejected with HTTP 400.
3. **Mandatory Blocker Reason:** Transitioning any milestone to `BLOCKED` strictly requires a non-empty `blockerReason`. Leaving it blank is rejected by both Zod schema validation and service-level rules.
4. **Terminal State Immutability:** Once a project is in a terminal status (`COMPLETED` or `CANCELLED`), further status transitions, stage advancements, or milestone modifications are blocked.
5. **Customer Multi-Tenant Isolation:** Customer portal endpoints `/api/v1/customer-portal/projects` strictly append `customerId: req.session.customer.customerId` to all MongoDB queries, preventing unauthorized cross-tenant data access.

---

## 6. Automated Verification Matrix

| Workspace | Test Suite File | Tests | Key Focus Areas | Status |
| :--- | :--- | :---: | :--- | :---: |
| `@ins-solar/shared` | `__tests__/project.test.ts` | 5 | Zod schema validation for projects, milestones, tasks, date rules, and blocker reason enforcement | **PASS** |
| `@ins-solar/api` | `__tests__/phase6a.test.ts` | 17 | Atomic sequence uniqueness (`PRJ-YYYY-NNNNN`, `TSK-YYYY-NNNNN`), duplicate order guard, status lifecycle state machine, blocker reason enforcement, cross-project milestone rejection, overdue filtering, customer isolation, 401 unauthenticated access | **PASS** |
| `@ins-solar/web` | `__tests__/projectPages.test.tsx` | 4 | `ProjectsPage` directory rendering, metric cards, `ProjectDetailPage` 10-stage progression stepper, Overview tab, Milestones blocker display, Tasks overdue badge | **PASS** |
| **Monorepo Total** | **26 Test Suites** | **271** | **All shared, backend, security, and web frontend test suites passing with 0 failures** | **PASS** |

---

## 7. Deferred Items (Phase 6B Scope)

The following capabilities were intentionally excluded from Phase 6A as specified in the scope requirements, and are deferred to Phase 6B:

- **Installation Checklists with Geotagged Photos:** Mandatory 5-category inspection checklists (Civil, Structural, Electrical, Safety, Commissioning) with photo upload verification.
- **Physical Stock Issue Workflows:** Site dispatch of reserved stock and technician custody handover slips.
- **DISCOM Net-Metering Application Document Tracking:** Tracking utility liaison documents and bi-directional meter test certificates.
- **Subsidy Tracking:** Central and state subsidy portal application progress and disbursement ledgers.
- **Private S3 Document Storage:** Pre-signed S3 URL generation for engineering drawings and warranties.

---

## 8. Unresolved Decisions & Blockers

- **Blockers:** None. All 271 unit, integration, and UI tests execute cleanly. Typecheck, ESLint, and production Vite bundles build without errors.
- **Decisions:** Implemented 10 default milestone templates matching the 10 project stages. These serve as planning gates and require explicit user/technician sign-off rather than auto-completing.
