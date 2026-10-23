# INS Solar — Phase 4B Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-004B`  
**Version:** `1.0.0`  
**Date:** 2026-10-23  
**Status:** Complete & Verified Gate  
**Phase:** Phase 4B (Solar Sizing Engine & Quotation Management)  
**Parent Verification:** Phase 4A Verification (151 passing tests)

---

## 1. Executive Summary

Phase 4B of the **INS Solar Business Management System** has been implemented and verified. This phase introduces the core technical and commercial engines of the business:
1. **Tri-Topology Solar Sizing Engine (`SolarSizingService`):** Deterministic mathematical calculation engine evaluating On-Grid, Off-Grid, and Hybrid plants with explicit units, physical bounds, inverter DC:AC matching, battery sizing, yield estimation, and engineering warnings.
2. **Solar System Design Repository (`SolarDesign` model & `SolarDesignService`):** Persistent sizing records linked to Customer, Lead, and Site Survey with catalog hardware validation, atomic sequence numbering (`DES-YYYY-NNNNN`), and audit logging.
3. **Quotation & Revision Engine (`Quotation` model & `QuotationService`):** Multi-revision commercial proposals (`fullQuotationCode`: `QT-YYYY-NNNNN-R0`, `R1`, etc.) with immutable historical snapshots, integer paise monetary calculations, itemized Bill of Materials, and configurable date-effective tax profiles.
4. **Commercial Discount Approval Workflow:** Policy-driven threshold checks (> 5.0% unapproved default pending owner confirmation) with strict anti-self-approval rule enforcement, audit tracking, and approval invalidation upon material price edits.
5. **Customer Digital Acceptance Boundary:** Authenticated record-level customer portal API allowing external property owners to review, accept, or decline proposals with digital signature timestamps and IP audit logs.
6. **Server-Side Proposal Compiler (`ProposalCompilerService`):** Print-optimized HTML proposal document compiler with company profile, BOM, GST breakdown, payment milestones, and acceptance stamps.
7. **Operational Frontend Interfaces (`apps/web`):** Responsive `SolarDesignPage`, `QuotationsPage`, and `QuotationDetailPage` integrated into application routing and navigation.
8. **Automated Verification:** 186 automated unit and integration tests passing with 0 failures across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.

---

## 2. Models, Services, Routes & Screens Implemented

### 2.1 Backend Domain Models & Schemas

| Model / Schema | Location | Description |
| :--- | :--- | :--- |
| `SolarDesign` | `apps/api/src/models/SolarDesign.ts` | Technical design records with atomic sequence `DES-YYYY-NNNNN`, topology, module, inverter, battery specs, estimated yield, and engineering assumptions. |
| `Quotation` | `apps/api/src/models/Quotation.ts` | Commercial proposal documents with `fullQuotationCode` (`QT-YYYY-NNNNN-R0`), revision numbers, integer paise BOM, tax profiles, and customer acceptance status. |
| `CompanySettings` (updated) | `apps/api/src/models/CompanySettings.ts` | Added `discountApprovalThresholdPercent` (default: 5.0) and `isDiscountThresholdConfirmedByOwner` (default: false). |
| `solarDesign` Schemas | `packages/shared/src/schemas/solarDesign.ts` | Zod validation schemas: `OnGridSizingInputSchema`, `OffGridSizingInputSchema`, `HybridSizingInputSchema`, `SizingCalculationInputSchema`, `CreateSolarDesignInputSchema`, and `SolarDesignFilterSchema`. |
| `quotation` Schemas | `packages/shared/src/schemas/quotation.ts` | Zod validation schemas: `QuotationLineItemInputSchema`, `TaxProfileSnapshotSchema`, `CreateQuotationInputSchema`, `ReviseQuotationInputSchema`, `DiscountApprovalInputSchema`, `CustomerQuotationDecisionSchema`, and `QuotationFilterSchema`. |

### 2.2 Domain Services

| Service | Location | Key Responsibilities |
| :--- | :--- | :--- |
| `SolarSizingService` | `apps/api/src/services/solarSizingService.ts` | Pure mathematical sizing formulas for On-Grid, Off-Grid, and Hybrid plants. Computes module counts, DC kWp, inverter matching, battery Ah/kWh, yield estimates, and warnings. |
| `SolarDesignService` | `apps/api/src/services/solarDesignService.ts` | Orchestrates sizing previews, catalog product validation (`productType`), atomic numbering via `SequenceService`, and design persistence with audit logging. |
| `QuotationService` | `apps/api/src/services/quotationService.ts` | Full quotation lifecycle: R0 creation, successor revisions (R1, R2), integer paise financial arithmetic (`computeFinancials`), discount threshold validation, managerial approval with anti-self-approval enforcement, and customer acceptance. |
| `ProposalCompilerService` | `apps/api/src/services/proposalCompilerService.ts` | Compiles server-side branded proposal HTML documents with company header, BOM tables, GST tax breakdown, payment milestones, and digital signature stamps. |

### 2.3 Express API Routes

| Router | Path Prefix | Endpoints | Security & Auth |
| :--- | :--- | :--- | :--- |
| `solarDesignRouter` | `/api/v1/solar-designs` | `POST /calculate` (preview)<br>`POST /` (create)<br>`GET /` (list with filters)<br>`GET /:id` (detail) | `requireAuth`<br>`requirePermission('design:create' \| 'design:read')` |
| `quotationRouter` | `/api/v1/quotations` | `POST /` (create R0)<br>`GET /` (list with filters)<br>`GET /:id` (detail)<br>`POST /:id/revisions` (create R1)<br>`POST /:id/approve-discount`<br>`POST /:id/reject-discount`<br>`POST /:id/send`<br>`GET /:id/pdf` | `requireAuth`<br>`requirePermission('quotation:create' \| 'quotation:read' \| 'quotation:approve_discount')`<br>Anti-Self-Approval guard |
| `customerQuotationRouter` | `/api/v1/customer-portal/quotations` | `GET /` (list customer quotes)<br>`GET /:id` (view quote)<br>`POST /:id/accept`<br>`POST /:id/reject`<br>`GET /:id/pdf` | `requireAuth`<br>Customer session isolation (`req.session.customer.customerId`) |

### 2.4 Frontend Operational Screens (`apps/web`)

| Screen / Component | Route | Key Capabilities |
| :--- | :--- | :--- |
| `SolarDesignPage` | `/solar-designs` | Interactive solar sizing calculator (On-Grid, Off-Grid, Hybrid), live technical preview, engineering warning indicators, MNRE disclaimer banner, and saved design directory. |
| `QuotationsPage` | `/quotations` | Proposals directory, status tabs (`All`, `Discount Approval Queue`, `Sent`, `Accepted`, `Drafts`), full quotation codes (`QT-YYYY-NNNNN-R0`), discount percentage indicators, and proposal generator modal. |
| `QuotationDetailPage` | `/quotations/:id` | Full proposal view: customer details, linked solar design, itemized BOM, integer paise financial breakdown, GST component tables, CA legal notice, managerial discount approval card with anti-self-approval rules, and customer digital acceptance simulation. |

---

## 3. Sizing Formulas, Units, Assumptions & Limitations

### 3.1 Physical Units
All calculations in `SolarSizingService` use explicit, standardized physical units:
- **Module Wattage:** Watt-peak ($W_p$)
- **DC System Capacity:** Kilowatt-peak ($kW_p$)
- **Inverter Capacity:** Kilowatt ($kW$)
- **Battery Storage Energy:** Kilowatt-hours ($kWh$)
- **Battery Capacity:** Ampere-hours ($Ah$)
- **System DC Bus Voltage:** Volts DC ($V$)
- **Energy Generation Yield:** Kilowatt-hours ($kWh$/day, $kWh$/month, $kWh$/year)
- **Specific Yield:** Kilowatt-hours per kilowatt-peak ($kWh/kW_p$)

### 3.2 Formulas by Topology

#### A. On-Grid (Grid-Tied) Topology
1. **Module Quantity:**
   $$\text{Panel Quantity} = \left\lceil \frac{\text{Target Capacity } (kW_p) \times 1000}{\text{Module Wattage } (W_p)} \right\rceil$$
2. **Actual DC Capacity:**
   $$\text{Actual DC Capacity } (kW_p) = \frac{\text{Panel Quantity} \times \text{Module Wattage } (W_p)}{1000}$$
3. **Recommended Inverter Capacity:**
   $$\text{Recommended Inverter } (kW) = \frac{\text{Actual DC Capacity } (kW_p)}{\text{Target DC:AC Ratio}}$$
4. **Actual DC:AC Loading Ratio:**
   $$\text{Actual DC:AC Ratio} = \frac{\text{Actual DC Capacity } (kW_p)}{\text{Selected Inverter Capacity } (kW)}$$
5. **Generation Estimation:**
   $$\text{Daily Generation } (kWh/\text{day}) = \text{Actual DC Capacity } (kW_p) \times \text{PSH} \times \left( \frac{\text{PR}}{100} \right)$$
   $$\text{Annual Generation } (kWh/\text{year}) = \text{Daily Generation } (kWh/\text{day}) \times 365$$
   $$\text{Specific Yield } (kWh/kW_p) = \frac{\text{Annual Generation}}{\text{Actual DC Capacity}}$$

#### B. Off-Grid (Autonomous) Topology
1. **Required Usable Storage:**
   $$\text{Required Storage } (kWh) = \frac{\text{Daily Energy Demand } (kWh) \times \text{Autonomy Days}}{\text{Depth of Discharge } (DoD)}$$
2. **Battery Bank Capacity ($Ah$):**
   $$\text{Required Capacity } (Ah) = \frac{\text{Required Storage } (kWh) \times 1000}{\text{System Bus Voltage } (V)}$$
3. **Battery Units Count:**
   $$\text{Battery Quantity} = \left\lceil \frac{\text{Required Capacity } (Ah)}{\text{Unit Battery } Ah} \times \frac{\text{System Bus Voltage } (V)}{\text{Unit Battery } V} \right\rceil$$
4. **Array Sizing for Autonomy & Recharging:**
   $$\text{Target PV Capacity } (kW_p) = \frac{\text{Daily Demand } (kWh) \times 1.25}{\text{PSH} \times (\text{PR}/100)}$$

#### C. Hybrid (Grid + Critical Backup) Topology
1. **Grid-Tie Array:** Sized using On-Grid formulation for daytime demand and net-metered grid export.
2. **Critical Load Reserve Storage:**
   $$\text{Storage Needed } (kWh) = \frac{\left( \frac{\text{Critical Load Daily Demand } (kWh)}{24} \right) \times \text{Backup Hours}}{DoD}$$

### 3.3 Engineering Warnings & Disclaimers
- **Oversized Inverter Warning:** Triggered if DC:AC ratio is $< 1.05$.
- **Clipping Warning:** Triggered if DC:AC ratio is $> 1.35$.
- **Standard Disclaimer Notice:** Automatically attached to every sizing output:
  > *"Preliminary technical sizing calculation based on standardized mathematical formulas and operator assumptions. This is not a certified structural engineering design or guaranteed solar generation yield. Site-specific shading, local grid voltage fluctuations, and temperature coefficients require qualified engineering audit before commercial commissioning."*

---

## 4. Quotation Revision & Acceptance Invariants

1. **Atomic Code Structure:** Every quotation code follows `QT-YYYY-NNNNN-R[revision]`. For example: `QT-2026-00001-R0`.
2. **Immutable Revisions:** Once created, an issued quotation revision is never overwritten. Updates create a successor revision (`R1`, `R2`) that references the `parentQuotationId`.
3. **Historical Isolation:** Revising a quotation sets `isLatestRevision = false` on the previous revision and `isLatestRevision = true` on the new revision. The original lines, rates, discounts, and taxes remain untouched for historical audit.
4. **Revision-Specific Customer Acceptance:** Customer digital acceptance binds strictly to the exact revision (`QT-2026-00001-R0`). If an amended quote `R1` is subsequently generated, `R0` becomes superseded (`status: REVISED`) and cannot be accepted.
5. **Idempotent Acceptance:** Re-submitting acceptance for an already accepted revision returns the accepted record with no state mutation or duplicate events.
6. **No Automatic Order Creation:** In accordance with Phase 4B boundaries, quotation acceptance does NOT automatically create orders, allocate inventory, or initiate dispatch.

---

## 5. Monetary Arithmetic & Tax Configuration Policy

### 5.1 Integer-Paise Arithmetic
- All monetary fields (`grossSubtotalPaise`, `additionalDiscountPaise`, `totalDiscountPaise`, `taxableAmountPaise`, `taxPaise`, `netTotalPaise`, `unitRatePaise`) are strictly stored and computed as 64-bit integer paise.
- Zero JavaScript floating-point arithmetic is permitted for monetary totals.
- Rates are validated via `@ins-solar/shared` integer schemas.
- Displayed rupees ($\text{INR } ₹$) are strictly formatted at the presentation layer by dividing paise by 100.

### 5.2 Configurable Tax Engine (Basis Points)
- Tax rates are represented in integer basis points ($1\% = 100 \text{ bps}$, $12\% = 1200 \text{ bps}$, $18\% = 1800 \text{ bps}$).
- Intra-state transactions calculate CGST (50% of rate) and SGST (50% of rate). Inter-state transactions calculate IGST (100% of rate).
- Tax components and applied profile metadata (`profileCode`, `profileName`, `effectiveDate`, `accountingNotice`) are snapshotted inside the quotation document.
- **Mandatory Chartered Accountant Notice:** Every quotation proposal explicitly embeds:
  > *"Pre-commercial quotation; final GST classification must be confirmed by qualified chartered accountant."*

---

## 6. Discount Approval Rules & Owner Decisions

### 6.1 Approval Policy
- **Discount Threshold:** Standard commercial discount threshold is set to **$5.0\%$**. Discounts exceeding $5.0\%$ automatically set `requiresDiscountApproval = true` and `status = PENDING_APPROVAL`.
- **Anti-Self-Approval Enforcement:** A sales executive or creator cannot approve their own discount submission (`req.user.userId === quotation.createdBy.toString()`). The server throws `AppError.permissionDenied` and logs an audit violation.
- **Material Change Invalidation:** When revising a quotation, any prior approval is invalidated, requiring re-evaluation against the current discount percentage.

### 6.2 Owner Confirmation Status
- **Pending Decision:** The $5.0\%$ threshold is stored in `CompanySettings.discountApprovalThresholdPercent` with `isDiscountThresholdConfirmedByOwner = false`.
- **Recommendation:** INS Solar leadership should confirm or adjust the discount ceiling (e.g., $5.0\%$ vs $7.5\%$) before production roll-out.

---

## 7. Document Generation & Storage Status

### 7.1 Server Proposal Compiler (`ProposalCompilerService`)
- The proposal compiler generates complete, self-contained HTML documents with embedded print media CSS (`@media print`), ensuring consistent layout across browsers and branch office printers.
- Includes company letterhead from `CompanySettings`, customer billing snapshot, itemized BOM, integer paise financials, milestone schedules, and cryptographic digital acceptance stamps.

### 7.2 Storage Boundary
- In accordance with the Phase 4B boundary, generated proposal HTML documents are streamed directly over authenticated Express endpoints (`GET /api/v1/quotations/:id/pdf` and `GET /api/v1/customer-portal/quotations/:id/pdf`).
- Cloud object storage (e.g., AWS S3 / Cloudflare R2) and headless browser PDF rendering (e.g., Puppeteer) are reserved for the dedicated document service in Phase 7/9 without simulating fake uploads.

---

## 8. Verification Results

All tests, lint checks, type checks, and production builds completed successfully:

### 8.1 Automated Test Execution Summary
```
Test Files  20 passed (20)
Tests       186 passed (186)
Time        7.2s
```
- `@ins-solar/shared`: 7 test files, **93 tests passed**
- `@ins-solar/api`: 10 test files, **85 tests passed**
- `@ins-solar/web`: 3 test files, **8 tests passed**

### 8.2 Root Commands Executed
| Command | Result | Notes |
| :--- | :--- | :--- |
| `npm run typecheck` | **PASS (0 errors)** | Full typecheck across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`. |
| `npm run lint` | **PASS (0 errors)** | ESLint verification across all source files. |
| `npm run format:check` | **PASS (0 errors)** | Prettier style verification across all files. |
| `npm run test` | **PASS (186/186)** | All unit and integration test suites pass. |
| `npm run build` | **PASS (0 errors)** | Production build of shared library, Express API, and Vite web client. |
| `npm run ci` | **PASS (0 errors)** | Automated pipeline executing typecheck, test, and build sequentially. |

---

## 9. Known Limitations & Recommendations for Phase 5

1. **No Automatic Order Execution:** Phase 4B purposefully stops at customer quotation acceptance. Converting an accepted quotation revision into an active Project Order (`ORD-YYYY-NNNNN`) is the explicit scope of **Phase 5**.
2. **No Inventory Reservation:** Phase 4B quotations do not lock stock balances or create warehouse ledger entries. Stock allocation and procurement requisitioning will be implemented in Phase 5.
3. **Owner Confirmation on Approval Thresholds:** The operational discount limit default ($5.0\%$) should be reviewed and confirmed by INS Solar management.
4. **Headless PDF Binary Compiler:** Transitioning the print-ready server proposal HTML into binary PDF via a dedicated Chromium headless worker should be integrated alongside cloud document storage.

---

## 10. Conclusion & Stop Gate

Phase 4B has met all functional and non-functional requirements without regressions. The repository is clean, documented, and fully verified. In accordance with instructions, work stops here for user review before proceeding to Phase 5.
