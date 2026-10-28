# INS Solar Business Management Software — Phase 10A Baseline Report

**Document Reference:** `INS-DEV-P10A-BASE`  
**Execution Timestamp:** 2026-10-27T17:50:00+05:30  
**Git Commit Baseline:** `142b152` (`feat(operations): implement Phase 9B Employee/Team, Unified Tasks and Document Management`)  
**Git Branch:** `main` tracking `origin/main`  
**Monorepo Structure:** React 18 / TypeScript frontend (`apps/web`), Express 5 / Node.js 22 / TypeScript backend (`apps/api`), MongoDB 8 / Mongoose models, Shared contracts (`packages/shared`).

---

## 1. Executive Summary & Verification Objective

Phase 10A establishes an independent, empirical verification of the INS Solar Business Management Software repository following the completion of Phases 0 through 9B. In accordance with Phase 10A instructions, this baseline audits:
- Actual source code against claimed capabilities.
- Full monorepo test coverage, typecheck, linting, formatting, and production build.
- Requirement traceability reconciliation between reported counts and original atomic requirements.
- Cross-module end-to-end business workflows, financial invariants, stock movements, and customer isolation.
- Security hardening and production configuration readiness.

---

## 2. Empirical Baseline Test & Toolchain Results

Every test and validation gate was executed independently across workspaces. Results are recorded below:

| Target Package / Gate | Command Executed | Test Files / Modules | Tests Passed | Failures | Skipped | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **@ins-solar/shared** | `npm run test --workspace=@ins-solar/shared` | 12 files | 135 | 0 | 0 | **PASS** (1.20s) |
| **@ins-solar/api** | `npm run test --workspace=@ins-solar/api` | 20 files | 244 | 0 | 0 | **PASS** (10.09s) |
| **@ins-solar/web** | `npm run test --workspace=@ins-solar/web` | 13 files | 51 | 0 | 0 | **PASS** (5.41s) |
| **Complete Monorepo Test** | `npm run test` | **45 files** | **430** | **0** | **0** | **PASS** (16.2s total) |
| **Typecheck** | `npm run typecheck` | 3 workspaces | 3 / 3 | 0 | 0 | **PASS** (0 errors) |
| **Linter** | `npm run lint` | ESLint 9.21.0 | Monorepo | 0 errors | 43 warnings | **PASS** (warnings only) |
| **Formatting** | `npm run format:check` | Prettier 3.5.2 | Monorepo | 109 files | - | **NEEDS FIX** (`npm run format`) |
| **Production Build** | `npm run build` | Shared + API + Web | 3 / 3 | 0 | 0 | **PASS** (Vite: 3.77s) |

> [!NOTE]
> The full monorepo test count is **430 tests across 45 test files** (135 shared, 244 backend API, 51 frontend web), confirming 100% test pass rate with zero skipped tests.

---

## 3. Requirement Traceability Reconciliation

### Investigation of 361 vs 354 Requirements
The Phase 9B summary recorded a count of 361 entries (264 Verified and 97 Planned). An automated AST and line-by-line audit of `docs/requirements/feature-traceability-matrix.md` was conducted:

1. **Unique Atomic Requirement Count:** Exactly **354** unique atomic requirements exist across the register:
   - **Section 2 (Modules 1–30):** 317 atomic requirements (`REQ-MOD01-01` to `REQ-MOD30-12`).
   - **Section 3 (Role-Based Panels):** 7 atomic requirements (`REQ-PNL-01` to `REQ-PNL-07`).
   - **Section 4 (Confirmed Business Decisions):** 30 atomic requirements (`REQ-BIZ-01` to `REQ-BIZ-30`).
   - Total: `317 + 7 + 30 = 354`.
2. **Duplicate Requirement Check:** `0` duplicate requirement IDs exist in the file.
3. **Root Cause of the 361 Discrepancy:** The number 361 was an arithmetic artifact introduced in an intermediate summary line when 97 planned was added to 264 verified. The actual count of Planned requirements in the register is **90** (`264 + 90 = 354`).
4. **Reconciliation Outcome:** Section 1 summary has been corrected to reflect the true register count: **354 Total Requirements (264 Verified, 90 Planned)**. Zero valid requirements were altered or deleted.

---

## 4. Initial Audit Findings & Observations

### A. End-to-End Business Workflows
- **Sales to Project Execution:** Lead, survey, solar design, quotation revisioning, sales order, and project creation are linked. Project stages progress through defined states (`SURVEY_COMPLETED`, `DESIGN_APPROVED`, `STRUCTURE_INSTALLED`, `INVERTER_INSTALLED`, `COMMISSIONING_DONE`, etc.).
- **Procurement & Inventory:** Multi-location inventory supports physical stock and reservations. Atomic decrements with `$gte` guards prevent negative stock. POs enforce anti-self-approval.
- **Service & After-Sales:** Complaints, warranty claims, AMC contracts, and service visits maintain strict cross-customer validation. Service visits update AMC quotas. Project tasks are decoupled from milestone completions to prevent unauthorized auto-completion.
- **Payments & Costing:** Integer paise are used exclusively. Payments allocate against sales orders with collectible ceiling guards. Project costing derives actual landed cost from dispatched materials at standard rate + approved direct expenses.

### B. Security & Identity Boundary
- **Customer Portal Isolation:** Document, project, quotation, and complaint endpoints filter by authenticated customer ID. Customer portal document routes strictly block `INTERNAL_ONLY` documents with `403 Forbidden`.
- **Signed Storage Access:** HMAC-signed access URLs enforce a 15-minute TTL. Tampered or expired signatures are rejected.
- **CSRF & Rate Limiting:** All mutation routes enforce CSRF tokens on session/cookie authenticated requests. Rate limiters protect `/api/v1/auth/login` and `/api/v1/customer-auth/otp/verify`.
- **Audit Immutability:** Audit logs are append-only. No deletion or modification routes exist for audit records.

### C. Configuration & Production Readiness
- **Storage Boundary:** Document service safely detects absence of AWS S3 credentials and falls back to simulated storage in test/local environments. Production configuration requires explicit verification that `STORAGE_PROVIDER=s3` is validated against missing AWS credentials during boot.
- **Prettier Formatting:** 109 files require formatting normalization via Prettier.
- **ESLint Warnings:** 43 warnings exist (console logs in `seed-demo.ts` script and unused destructuring variables in service handlers).

---

## 5. Next Steps for Phase 10A Execution

1. Build comprehensive Phase 10A integration test suite (`apps/api/src/__tests__/phase10a.test.ts`) covering cross-module end-to-end workflows, concurrency edge cases, negative tests, and security penetration checks.
2. Verify production environment validation (strict S3 credential check, MongoDB connection settings, CORS, and HTTPS cookies).
3. Document operational backup and disaster recovery procedures (`docs/operations/backup-and-disaster-recovery.md`).
4. Address linter warnings and format all files cleanly.
5. Compile comprehensive `docs/development/phase-10a-report.md`.
