# INS Solar — Phase 3A Implementation Report: Core Database Foundation, Domain Primitives & Atomic Numbering

**Document Reference:** `INS-DEV-P3A-001`  
**Date:** October 23, 2026  
**Implementation Lead:** Lead Software Architect, Database Architect & Senior Full-Stack Engineer  
**Status:** Completed & Empirically Verified  
**Runtime Toolchain:** Node.js `v24.11.1` LTS / npm `v11.6.2` / TypeScript `5.7.3` / Vitest `3.2.7`  

---

## 1. Executive Summary

Phase 3A of the **INS Solar Business Management System** has been implemented, establishing the core domain primitives, strict integer-paise financial rules, atomic concurrency-safe business numbering engine, foundational customer and company settings schemas, and index synchronization capabilities without introducing business logic shortcuts or fake data.

All work strictly preserves the existing modular monolith architecture, MongoDB Atlas data layer, and Express middleware lifecycle.

---

## 2. Actual Files Added or Modified

### 2.1 Workspace: `@ins-solar/shared` (`packages/shared/`)
* **[enums.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/types/enums.ts):** Added `SequenceEntityType`, `AddressType`, `CustomerType`, `CustomerStatus`, and expanded `UnitOfMeasurement` (`KW`, `KWP`, `LTR`).
* **[money.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/schemas/money.ts):** Created integer-paise monetary schemas (`MoneyPaiseSchema`, `PositiveMoneyPaiseSchema`, `SignedMoneyPaiseSchema`) and exact arithmetic helpers (`rupeesToPaise`, `paiseToRupees`, `formatPaiseToInr`, `multiplyPaise`, `calculateTaxPaise`).
* **[domain.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/schemas/domain.ts):** Created reusable Zod schemas and TypeScript DTOs for `AddressSchema` (with Indian 6-digit PIN code regex), `ContactPersonSchema`, `QuantitySchema`, `GstinSchema` (15-char Indian GSTIN), `PanSchema` (10-char Indian PAN), `CustomerCodeSchema`, and `CompanySettingsSchema`.
* **[index.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/index.ts):** Re-exported new primitives.
* **[domain.test.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/__tests__/domain.test.ts):** 30 automated unit tests covering bounds, zero, negative, float rejections, and Indian currency formatting.

### 2.2 Workspace: `@ins-solar/api` (`apps/api/`)
* **[SequenceCounter.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/SequenceCounter.ts):** Created Mongoose model for sequence persistence with `{ sequenceKey: 1 }` unique index and `{ entityType: 1, fiscalYear: 1 }` compound unique index.
* **[Customer.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/Customer.ts):** Refined Customer model with structured subdocuments for billing address, installation site address, contact person, GSTIN/PAN, and safe serialization.
* **[CompanySettings.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/CompanySettings.ts):** Created singleton configuration model storing company profile, registered address, fiscal year start month, and default numbering prefixes (excluding any secrets).
* **[models/index.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/index.ts):** Exported `SequenceCounter` and `CompanySettings`.
* **[sequenceService.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/services/sequenceService.ts):** Implemented atomic business number generator using MongoDB `findOneAndUpdate` with `$inc`, race condition retry on E11000 duplicate key errors, and in-memory test fallback.
* **[connection.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/db/connection.ts):** Added non-destructive `syncIndexes()` method to `DatabaseManager`.
* **[phase3a.test.ts](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/__tests__/phase3a.test.ts):** 10 automated unit and integration tests covering parallel concurrency (50 requests), first-time upsert collision handling, sequence preview, serialization safety, repeated imports, and database unavailability.

### 2.3 Documentation Updated
* **[database-design.md](file:///d:/My%20project/Solar%20Business%20Management%20Software/docs/architecture/database-design.md):** Appended Section 6 containing the comprehensive, dependency-ordered model implementation plan for all 30 modules.
* **[implementation-roadmap.md](file:///d:/My%20project/Solar%20Business%20Management%20Software/docs/planning/implementation-roadmap.md):** Updated Phase 3 status with Phase 3A completed deliverables and Phase 3B scope.

---

## 3. Sequence Allocation Algorithm & Concurrency Guarantees

### 3.1 Concurrency Architecture
To ensure business number uniqueness across concurrent requests:
1. **Zero Read-Then-Increment:** The service does **not** query a document, increment in JavaScript memory, and write it back. This pattern causes duplicate numbers under concurrent requests.
2. **Atomic MongoDB Mutation:** Utilizes `findOneAndUpdate` with `$inc: { currentValue: 1 }` and `upsert: true` directly in the database engine:
   ```ts
   const doc = await SequenceCounter.findOneAndUpdate(
     { sequenceKey },
     {
       $inc: { currentValue: 1 },
       $setOnInsert: { entityType, fiscalYear, prefix, padding, createdAt: new Date() }
     },
     { new: true, upsert: true, setDefaultsOnInsert: true }
   );
   ```
3. **Collision Race Recovery:** If two parallel threads execute the first-ever allocation for an entity simultaneously, MongoDB's unique index on `sequenceKey` will allow one to create the document and reject the second with an `E11000` duplicate key error. `SequenceService` intercepts `E11000`, backs off with randomized jitter (`10ms * 2^attempt + jitter`), and retries up to 5 times.
4. **Monotonicity & Gap Policy:** Allocated sequences are strictly non-decreasing. If a downstream business transaction is aborted, the sequence number is recorded as voided rather than decrementing the database counter, ensuring zero risk of duplicate key re-issuance.

---

## 4. Monetary Representation & Arithmetic Policy

1. **Integer Base Units:** All financial values (unit rates, taxable amounts, CGST, SGST, IGST, invoice totals, payment receipts, refunds, and customer balances) are stored as **Integer Paise** (1 INR = 100 Paise).
2. **Zero Floating-Point Representation:** JavaScript IEEE 754 floating-point numbers (`0.1 + 0.2 = 0.30000000000000004`) are strictly banned from authoritative calculations.
3. **Conversion Safeguards:** `rupeesToPaise` validates that input amounts have at most 2 decimal places. Passing `12.345` throws an explicit `RangeError` rather than silently truncating or rounding pennies.
4. **Formatting Helper:** `formatPaiseToInr` formats integer paise using the Indian numbering grouping system (`₹1,23,456.78` — grouping thousands, lakhs, and crores).

---

## 5. Automated Verification Results

All available workspace verification commands were executed from the repository root:

| Command | Exit Code | Result |
| :--- | :---: | :--- |
| `npm run typecheck` | **`0`** | `tsc --noEmit` passed across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`. |
| `npm run lint` | **`0`** | ESLint 9 executed across all monorepo files with 0 errors and 0 warnings. |
| `npm run format:check` | **`0`** | Prettier verified 100% adherence to monorepo code style. |
| `npm run test` | **`0`** | **11 test files, 94 tests passed (100% pass rate).** |
| `npm run build` | **`0`** | Clean production build of shared library, API bundle, and Vite frontend. |
| `npm run ci` | **`0`** | Complete continuous integration pipeline passed. |

### Test Suite Summary
* **`@ins-solar/shared`:** 3 test files, 47 tests passed.
  * `schemas.test.ts` (7 tests): Base validators, phone, email, pagination.
  * `domain.test.ts` (30 tests): Integer paise, bounds, Indian formatting, address, quantity, GSTIN, PAN.
  * `auth.test.ts` (10 tests): Role hierarchies, permission matrices.
* **`@ins-solar/api`:** 7 test files, 46 tests passed.
  * `phase3a.test.ts` (10 tests): Sequential generation, 50-thread concurrent numbering with 0 duplicates, collision race retry, preview, Customer and CompanySettings serialization, repeated model imports, database-unavailable readiness.
  * `security.test.ts` (16 tests): Negative security scenarios (MFA, RBAC, CSRF, Session, Rate Limiting).
  * `crypto.test.ts`, `env.test.ts`, `bootstrap.test.ts`, `errors.test.ts`, `health.test.ts` (20 tests).
* **`@ins-solar/web`:** 1 test file, 1 test passed (`App.test.tsx`).

---

## 6. Database Setup & Index Management Instructions

1. **Development Environment:**
   * Mongoose automatically registers indexes via `autoIndex: true` when running in `development` or `test` mode.
2. **Production Environment:**
   * In production (`NODE_ENV=production`), `autoIndex` is disabled to prevent database startup performance hits.
   * Run explicit index synchronization via `await dbManager.syncIndexes()`, which iterates over registered models and builds missing indexes in background mode without dropping existing collections.

---

## 7. Remaining Decisions & Next Implementation Batch

### 7.1 Outstanding Operational Decisions
* **DEC-01 (70:30 Solar Tax Split):** Reconfirmed that tax configurations remain date-effective profiles and must receive qualified chartered accountant signoff before production invoice generation in Phase 7.
* **DEC-04 (Approval Thresholds):** Configured in `CompanySettings` defaults (Discounts > 5%, Expenses > ₹5,000, POs > ₹25,000).

### 7.2 Proposed Next Batch: Phase 3B
* **Scope:** Master Catalog Schemas & Repository Services:
  1. `Product` & `ProductCategory` schemas with pricing in integer paise, specifications, and SKU uniqueness.
  2. `Warehouse` schema (depots, transit sites).
  3. Shared domain services for catalog retrieval and stock location assignment.

---

*Phase 3A complete. System verified and awaiting owner approval before initiating Phase 3B.*
