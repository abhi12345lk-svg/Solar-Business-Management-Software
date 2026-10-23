# INS Solar Business Management Software — Implementation Roadmap

**Document Reference:** `INS-PLN-ROA-001`  
**Version:** `1.0.0`  
**Status:** Approved Phase Plan  
**Total Planned Phases:** 11 Phases (Phase 0 through Phase 10)  
**Methodology:** Incremental, Dependency-Gated, Test-Driven Modular Delivery  

---

## 1. Roadmap Overview & Dependency Flow

```mermaid
graph TD
    P0["Phase 0: Requirements Audit & Architecture Blueprint (Current)"]
    P1["Phase 1: Foundation, Toolchain, Standard Middleware, Logging, Testing Setup"]
    P2["Phase 2: Auth, Sessions, RBAC, MFA, CSRF & Audit Logger"]
    P3["Phase 3: Core Database Models, Numbering Engine & Shared Domain Services"]
    P4["Phase 4: CRM Pipeline (Leads, Customers, Surveys, Solar Design, Quotations, PDFs)"]
    P5["Phase 5: Supply Chain & Orders (Orders, Products, Multi-Location Inventory, Procurement, Vendors)"]
    P6["Phase 6: Execution & Field Ops (Projects, Installations, Checklists, Net Metering, Subsidy, Documents)"]
    P7["Phase 7: Financial Management (Payments, Expenses, Costing, Profitability, Analytics)"]
    P8["Phase 8: After-Sales & Teams (Employees, Teams, Tasks, Service Tickets, AMC, Visits)"]
    P9["Phase 9: Customer Portal, Notifications, Reminders & System Settings"]
    P10["Phase 10: Full Integration, E2E Testing, Security Hardening, Backup Drills & Production Go-Live"]

    P0 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 --> P6
    P6 --> P7
    P7 --> P8
    P8 --> P9
    P9 --> P10
```

---

## 2. Phase-by-Phase Execution Plan

### Phase 0: Requirements Audit & Master Blueprint (Current)
*   **Focus:** Workspace inspection, complete requirements inventory (all 30 modules, 6 panels, 30 business decisions), technical architecture, data design, API conventions, implementation roadmap, and risk register.
*   **Entry Criteria:** Clean workspace initialization.
*   **Deliverables:**
    1.  `docs/requirements/requirements-catalog.md`
    2.  `docs/requirements/feature-traceability-matrix.md`
    3.  `docs/architecture/system-architecture.md`
    4.  `docs/architecture/database-design.md`
    5.  `docs/architecture/api-conventions.md`
    6.  `docs/planning/implementation-roadmap.md`
    7.  `docs/planning/open-decisions-and-risks.md`
    8.  `docs/planning/phase-0-review-report.md`
*   **Acceptance Criteria:** 100% of required modules, panels, and business rules documented and mapped to testable criteria.
*   **Test Gate:** Independent architectural audit and verification sign-off.
*   **Deployment Gate:** No code written in this phase; ready for user review.

---

### Phase 1: Repository Foundation, Configuration, Quality & Toolchain
*   **Focus:** Monorepo or clean modular structure, Node.js 24 LTS, Vite, TypeScript strict configuration, Tailwind CSS, shadcn/ui foundation, ESLint, Prettier, Pino logger, unified Express error handler, and Vitest test runner.
*   **Entry Criteria:** Approval of Phase 0 Blueprint.
*   **Deliverables:**
    *   Package manifests (`package.json`, lockfiles) with verified, non-deprecated stable packages.
    *   Strict `tsconfig.json` for both server and client workspaces.
    *   Express 5 application shell with correlation ID middleware, Pino logging, and standard response helpers.
    *   Client shell with Vite, Tailwind CSS tokens, and initial `shadcn/ui` components.
    *   Automated test harness (Vitest, Supertest, Testing Library).
*   **Acceptance Criteria:** `npm run build`, `npm run lint`, and `npm run test` pass with 0 errors and 0 warnings.
*   **Test Gate:** Baseline health check endpoint (`/api/v1/health`) verified with automated integration tests.
*   **Deployment Gate:** CI pipeline passing on local and git runner.

---

### Phase 2: Authentication, Sessions, Roles, Permissions & Security
*   **Focus:** Server-managed stateful sessions, HttpOnly cookies, Argon2id password hashing, TOTP MFA for privileged roles, CSRF protection, RBAC permission middleware, customer isolation guard, and audit log emitter.
*   **Entry Criteria:** Phase 1 Foundation passing all tests.
*   **Deliverables:**
    *   `User`, `Session`, and `AuditLog` Mongoose schemas.
    *   Auth endpoints (`/api/v1/auth/login`, `/logout`, `/me`, `/mfa/setup`, `/mfa/verify`).
    *   Express auth middleware (`requireAuth`, `requireRole`, `requirePermission`).
    *   Client auth context, login interface, session persistence, and protected route wrappers.
*   **Acceptance Criteria:** Secure session lifecycle; instant session revocation on logout/deactivation; passwords hashed with Argon2id; MFA enforced for Admin/Accounts roles.
*   **Test Gate:** Comprehensive Supertest suite covering brute-force protection, invalid passwords, expired sessions, CSRF rejections, and unauthorized route access.

---

### Phase 3: Database Models, Numbering Engine & Shared Domain Services
*   **Focus:** Core database connections (MongoDB Atlas), Mongoose schema definitions, compound indexes, sequential document numbering engine (`SequenceService`), integer paise financial primitives, product catalog, categories, and multi-location warehouses.
*   **Entry Criteria:** Phase 2 Auth passing all tests.
*   **Phase 3A Status (Completed & Verified):**
    *   Shared domain primitives and validation conventions (`@ins-solar/shared`): `MoneyPaiseSchema`, `PositiveMoneyPaiseSchema`, `SignedMoneyPaiseSchema`, Indian Rupees-to-Paise helpers, `AddressSchema`, `ContactPersonSchema`, `QuantitySchema`, `GstinSchema`, `PanSchema`, `CustomerCodeSchema`.
    *   Atomic `SequenceService` utilizing MongoDB atomic `$inc` with upsert collision retry, producing formatted sequential IDs (`CUST-2026-00001`, `QT-2026-00001`, `ORD-2026-00001`, etc.).
    *   Foundational Mongoose models: `SequenceCounter`, refined `Customer` (with addresses, GST/PAN, contact info), and `CompanySettings` singleton profile.
    *   Index management: explicit `syncIndexes()` method on `DatabaseManager` without destructive drops.
*   **Phase 3B Status (Completed & Verified):**
    *   `ProductCategory` model: Hierarchical categories with bounded cycle detection and deactivation constraints.
    *   `Product` model: Master hardware catalog with integer paise purchase/selling rates, normalized case-insensitive SKU uniqueness (`skuNormalized`), and decoupled balance design.
    *   `Warehouse` model: Multi-location foundation (Central Depot, Transit, Installation Site, Employee Custody) with unique location codes and non-destructive deactivation.
    *   `SequenceService` Production Guard: Strict safety check refusing in-memory fallback in production when disconnected (HTTP 503).
    *   Minimal service layer and authorized API routes (`/api/v1/catalog`, `/api/v1/warehouses`).
    *   Future Inventory Integrity Contract documented in database design.
*   **Acceptance Criteria:** Atomic sequence generator tested under high concurrent load with zero duplicate keys; master hardware catalog decoupled from stock ledger; case-insensitive SKU uniqueness enforced.
*   **Test Gate:** 13 test suites, 120 automated tests passing with 0 errors across all workspaces.

---

### Phase 4: CRM Pipeline (Leads, Customers, Surveys, Solar Design, Quotations & PDFs)
*   **Focus:** Lead management, customer directory, site profiles, feasibility surveys, tri-topology solar design (On-Grid, Off-Grid, Hybrid), quotation generator, discount approval gates, and server-side PDF proposal compiler.
*   **Entry Criteria:** Phase 3 Core Data & Services verified.
*   **Phase 4A Status (Completed & Verified):**
    *   `Lead` Mongoose model and shared schemas (`@ins-solar/shared`): atomic `LEAD-YYYY-NNNNN` generation, prospect contact details, requirement classification, advisory duplicate phone lookup (non-unique index, non-destructive), supervisory assignment RBAC, and lifecycle status machine.
    *   `LeadActivity` Mongoose model: chronological interaction timeline (calls, meetings, site visits, follow-ups), sentiment tracking (`HOT`, `WARM`, `COLD`), and automated next follow-up scheduling.
    *   Idempotent Lead-to-Customer conversion: verifies lead is not already converted, allocates sequential `CUST-YYYY-NNNNN` customer record, binds `convertedCustomerId`, logs audit activity, and permanently preserves lead history.
    *   `SiteSurvey` Mongoose model: atomic `SRV-YYYY-NNNNN` allocation, customer/lead relational linkage, roof substrate classification, positive physical measurements (usable roof area in sq ft, integer paise average monthly electricity bill, utility sanctioned load in kW), shadow analysis notes, and private photo metadata attachment.
    *   Minimal operational UI (`apps/web`): Responsive directories, search filters, and detail dialogs for Leads (`LeadsPage`, `LeadDetailPage`), Follow-ups (`FollowUpsPage`), and Site Surveys (`SurveysPage`).
    *   Automated test suite: 14 test suites, 151 automated tests passing with 0 errors across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.
*   **Phase 4B Status (Completed & Verified):**
    *   `SolarDesign` Mongoose model & pure `SolarSizingService`: tri-topology mathematical calculation engine (On-Grid, Off-Grid, Hybrid) computing explicit physical units (panel quantity, actual DC kWp, inverter matching, battery Ah/kWh/units, and daily/monthly/annual kWh generation yields) with MNRE disclaimer notices and engineering warnings.
    *   `Quotation` Mongoose model: immutable revision snapshots (`fullQuotationCode`: `QT-YYYY-NNNNN-R0`, `R1`, etc.), integer-paise financial engine, itemized Bill of Materials with catalog product validation, and configurable date-effective tax profiles with basis-point calculations.
    *   Managerial Discount Approval Workflow: automatic threshold enforcement (> 5.0% unapproved default pending owner confirmation) with strict anti-self-approval rule prevention, audit logging, and prior approval invalidation upon material price/discount changes.
    *   Customer Review & Digital Acceptance: authenticated record-level customer portal boundary allowing customers to review their own proposals, download PDF documents, and digitally accept/reject specific revisions with idempotent state handling and IP/timestamp capture.
    *   Server-Side Proposal Compiler: `ProposalCompilerService` compiling professional, print-optimized proposal documents with company branding, BOM, financial breakdown, milestone schedules, and legal terms.
    *   Operational Web Interface (`apps/web`): Interactive `SolarDesignPage` sizing calculator & design directory, `QuotationsPage` proposals directory with discount approval queue filters, and `QuotationDetailPage` comprehensive revision viewer with anti-self-approval managerial controls and digital acceptance simulation.
*   **Acceptance Criteria:** Complete sales flow from lead capture and site survey to technical solar design, quotation revisioning, discount approval control, and customer digital acceptance.
*   **Test Gate:** 186 automated tests passing across 20 test suites with 0 errors across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.

---

### Phase 5: Supply Chain & Orders (Orders, Multi-Location Inventory, Stock Reservation, Procurement & Vendors)
*   **Focus:** Order confirmation locking accepted quotation terms, multi-location inventory projections (Warehouse, Site, Transit), append-oriented stock movement ledger, race-condition-free reservations, serialized hardware tracking, purchase orders, and vendor ledgers.
*   **Entry Criteria:** Phase 4 CRM Pipeline verified.
*   **Phase 5A Status (Completed & Verified):**
    *   `SalesOrder` model & `OrderService`: Controlled order creation from eligible accepted quotation revisions with atomic sequence numbering (`ORD-YYYY-NNNNN`), immutable agreed commercial snapshots, payment milestones, and unique 1:1 revision binding preventing duplicate orders.
    *   Order lifecycle & cancellation controls: State-machine transitions (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`); automated atomic reservation release if cancelled before issue; direct cancellation strictly forbidden after physical issue.
    *   `StockBalance` model: Location-scoped material projections (`productId`, `warehouseId`, `onHandQuantity`, `reservedQuantity`, `availableQuantity`) with compound uniqueness and negative quantity prevention.
    *   `StockMovement` model: Immutable append-only material transaction ledger (`STK-YYYY-NNNNN`) tracking receipts, issues, transfers, returns, and authorized opening balances. No direct updates/deletions permitted.
    *   `StockReservation` model & atomic reservation engine: Conditional single-document database updates (`availableQuantity: { $gte: quantity }`) eliminating over-reservation under high concurrency, leaving physical on-hand quantity untouched, with batch compensation rollback on partial failures.
    *   `ProductSerialNumber` model & `SerialNumberService`: High-value hardware serialization (solar panels, inverters) with uppercase-normalized uniqueness and full custody history.
    *   Operational Web Interface (`apps/web`): Responsive `OrdersPage` (with quotation-to-order converter), `OrderDetailPage` (with commercial snapshot review and reservation controls), and `InventoryPage` (multi-location balances, movement ledger, serial asset database, and operation action modals).
    *   Automated test suite: 215 automated tests passing with 0 errors across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.
*   **Phase 5B Scope (Next Pending Implementation Batch):**
    *   Vendor master catalog, purchase orders (PO), inbound GRN receipt linking, and vendor accounts payable ledgers.
*   **Acceptance Criteria:** Stock cannot fall below zero; physical issue is hard-blocked on shortages; order locks prices permanently against catalog changes; reservations and physical issues strictly decoupled.
*   **Test Gate:** 215 automated tests passing across 21 test suites with 0 errors across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.

---

### Phase 6: Field Execution & Operations (Projects, Installations, Checklists, Net Metering & Documents)
*   **Focus:** Project management (10 linear stages), daily installation tracking, mandatory 5-category installation checklists with geotagged photos, pre-commissioning electrical testing, DISCOM net metering tracking, subsidy tracking, and secure object storage document management.
*   **Entry Criteria:** Phase 5 Supply Chain verified.
*   **Deliverables:**
    *   Modules 14, 15, 16, 17, 26 implemented end-to-end.
    *   Project stage-gate progression engine.
    *   Installation checklist submission requiring photos for each category before approval.
    *   Private S3 document storage with short-lived pre-signed URLs.
    *   Installation Panel interface for field crews and project managers.
*   **Acceptance Criteria:** Projects advance strictly through valid stage gates; checklist approval requires verified photos; documents secured behind authenticated signed URLs.
*   **Test Gate:** Stage transition validation tests; checklist rejection on missing photos; S3 upload/download authorization tests.

---

### Phase 7: Financial Management (Payments, Expenses, Costing, Profitability & Reports)
*   **Focus:** Cash collections (advances, partial payments), duplicate payment submission prevention, payment receipt PDF vouchers, project-level expense logging with tiered approvals, real-time project costing and gross margin analytics, and exportable business reports.
*   **Entry Criteria:** Phase 6 Operations verified.
*   **Deliverables:**
    *   Modules 1, 18, 19, 20, 27 implemented end-to-end.
    *   Payment ledger with idempotency safeguards and running balance tracking.
    *   Project costing engine computing actual landed hardware + labor + expense costs.
    *   Cost variance analysis (Estimated BOM vs Actual Cost).
    *   Executive Dashboard and Reports & Analytics module with CSV/Excel exports.
    *   Accounts Panel interface for finance staff.
*   **Acceptance Criteria:** Duplicate payments prevented via idempotency keys; project profit and margin percentages accurately calculated; reports export valid CSV/Excel.
*   **Test Gate:** Financial ledger reconciliation unit tests; idempotency concurrency tests; report calculation accuracy tests.

---

### Phase 8: After-Sales & Team Management (Employees, Teams, Tasks, Break-Fix, Warranty, AMC & Visits)
*   **Focus:** Employee directory, team composition, task Kanban board, break-fix service tickets, warranty tracking (panel barcodes, inverter serials), recurring AMC contracts, and scheduled preventive maintenance visit logging.
*   **Entry Criteria:** Phase 7 Financials verified.
*   **Deliverables:**
    *   Modules 21, 22, 23, 24, 25 implemented end-to-end.
    *   Service complaint ticketing with SLA tracking and spare parts logging.
    *   AMC schedule generator batch-creating quarterly/periodic visit records.
    *   Field service visit report with customer signature capture.
    *   Service Panel interface for maintenance technicians.
*   **Acceptance Criteria:** AMC batch generator correctly provisions future service visits; spare parts consumed update inventory balances.
*   **Test Gate:** Service ticket lifecycle tests; AMC visit batch scheduling unit test; warranty claim linkage test.

---

### Phase 9: Customer Portal, Notifications, Reminders & System Settings
*   **Focus:** External Customer Portal (isolated project tracker, quotation acceptance, bill upload, invoices), in-app notification center, transactional emails, configurable WhatsApp templates, automated chron-based reminder engine, and global settings/masters console.
*   **Entry Criteria:** Phase 8 After-Sales verified.
*   **Deliverables:**
    *   Modules 28, 29, 30 and Customer Portal (`REQ-PNL-07`) implemented end-to-end.
    *   Customer portal interface with magic link or credential authentication.
    *   In-app notification center and database-backed job runner for reminders.
    *   Global settings console for brands, pricing slabs, tax rules, and approval limits.
*   **Acceptance Criteria:** Customers can only view their own projects/quotations; customer quotation acceptance triggers operational order alert; background reminders trigger reliably.
*   **Test Gate:** Customer isolation security tests; notification event dispatch tests; reminder cron execution tests.

---

### Phase 10: Full Integration, End-to-End Verification, Hardening & Production Go-Live
*   **Focus:** Complete panel integration (Admin, Sales, Installation, Accounts, Service, Inventory), end-to-end Playwright tests, performance testing, security vulnerability scans, backup/restore disaster recovery drills, staging deployment, and production release.
*   **Entry Criteria:** All Modules 1–30 and Panels implemented.
*   **Deliverables:**
    *   Automated Playwright E2E suite covering critical user journeys (Lead $\rightarrow$ Quote $\rightarrow$ Order $\rightarrow$ Project $\rightarrow$ Install $\rightarrow$ Payment $\rightarrow$ Commissioning).
    *   Security audit report (OWASP Top 10 check, dependency vulnerability audit).
    *   Documented disaster recovery drill log (Atlas restore + application boot).
    *   Production deployment configuration (Docker / systemd, Nginx reverse proxy, TLS, backup cron).
*   **Acceptance Criteria:** 100% of traceability matrix requirements verified; zero high/critical vulnerabilities; 100% of test suites passing.
*   **Release Gate:** Executive sign-off for production deployment.
