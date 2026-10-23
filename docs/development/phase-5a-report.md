# INS Solar — Phase 5A Implementation & Verification Report

**Document Reference:** `INS-DEV-REP-005A`  
**Version:** `1.0.0`  
**Date:** 2026-10-23  
**Status:** Complete & Verified Gate  
**Phase:** Phase 5A (Sales Orders, Inventory Ledger & Stock Reservation)  
**Parent Verification:** Phase 4B Verification (186 passing tests)  
**Current Test Suite:** 215 passing tests across all workspaces (100% green, 0 failures)

---

## 1. Executive Summary

Phase 5A of the **INS Solar Business Management System** has been implemented, validated, and verified. This phase bridges customer commercial acceptance with inventory operations through a robust, concurrency-safe material ledger:

1. **Sales Order Engine (`SalesOrder` model & `OrderService`):** Controlled conversion of genuinely accepted quotation revisions into official sales orders (`ORD-YYYY-NNNNN`) with immutable commercial snapshots, payment milestones, and strict 1:1 binding per revision to prevent duplicate order generation.
2. **Order Lifecycle & Cancellation Controls:** State-machine enforced transitions (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`). Coordinates automated atomic reservation release if cancelled prior to dispatch; strictly rejects direct cancellation if materials have already been physically issued.
3. **Multi-Location Stock Balance Projections (`StockBalance` model):** Location-scoped projections tracking on-hand, reserved, and available quantities with compound uniqueness `{ productId, warehouseId }` and database-level non-negative quantity guarantees.
4. **Append-Oriented Stock Movement Ledger (`StockMovement` model):** Append-only audit ledger recording every receipt, issue, transfer, return, and authorized opening balance (`STK-YYYY-NNNNN`). Never exposes direct update or deletion endpoints; compensating reversals required for adjustments.
5. **Race-Condition-Free Stock Reservation Engine (`StockService`):** Atomic conditional single-document updates (`availableQuantity: { $gte: quantity }`) ensuring two concurrent orders cannot reserve the same final physical stock unit, while leaving physical on-hand inventory unchanged.
6. **Hardware Serialization Tracking (`ProductSerialNumber` & `SerialNumberService`):** Tracks high-value serialized assets (solar panels, inverters, batteries) with normalized uppercase uniqueness, warehouse custody, and complete movement history.
7. **Secure Endpoints & Operational Frontend (`apps/web`):** Responsive `OrdersPage`, `OrderDetailPage`, and multi-tab `InventoryPage` with real persisted API integrations, CSRF protection, and customer portal isolation.
8. **Automated Verification:** 215 automated tests passing with 0 failures across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`.

---

## 2. Implemented Models, Services, Routes & Screens

### 2.1 Backend Domain Models

| Model | Collection | Primary Responsibility | Key Fields & Indexes |
| :--- | :--- | :--- | :--- |
| `SalesOrder` | `sales_orders` | Official order entity derived from accepted quotation | `orderNumber` (unique), `quotationRevisionId` (unique 1:1), `customerId`, `lineItems`, integer paise financials, `paymentMilestones`, `reservationStatus`, `status`. |
| `StockBalance` | `stock_balances` | Multi-location material balance projections | `{ productId: 1, warehouseId: 1 }` (compound unique), `onHandQuantity`, `reservedQuantity`, `availableQuantity` (all `min: 0`). |
| `StockMovement` | `stock_movements` | Immutable append-only material transaction ledger | `movementNumber` (unique `STK-YYYY-NNNNN`), `movementType`, `sourceWarehouseId`, `destinationWarehouseId`, `orderId`, `reservationId`, `serialNumbers`, `performedBy`. |
| `StockReservation` | `stock_reservations` | Pre-allocation of stock to sales orders | `reservationNumber` (unique `RES-YYYY-NNNNN`), `orderId`, `productId`, `warehouseId`, `quantity`, `status` (`ACTIVE`, `ISSUED`, `RELEASED`, `CANCELLED`). |
| `ProductSerialNumber` | `product_serial_numbers` | Unit-level serialized asset tracking | `serialNumber` (unique uppercase), `productId`, `warehouseId`, `status` (`IN_STOCK`, `RESERVED`, `ISSUED`, `INSTALLED`, `RETURNED`, `DEFECTIVE`), `movementHistory`. |

### 2.2 Core Business Services

| Service | File | Responsibilities |
| :--- | :--- | :--- |
| `OrderService` | `apps/api/src/services/orderService.ts` | Validates accepted quotation eligibility (non-expired, non-superseded, discount approved), snapshots agreed commercial line items, manages 1:1 revision binding, generates `ORD-YYYY-NNNNN`, coordinates order cancellation and reservation release. |
| `StockService` | `apps/api/src/services/stockService.ts` | Atomic conditional reservation (`$gte: quantity`), multi-item batch compensation/rollback on insufficient stock, idempotent reservation release, physical issue (`onHand -= Q, reserved -= Q`), receipts, inter-warehouse transfers, returns, authorized opening balances, and projection listings. |
| `SerialNumberService` | `apps/api/src/services/serialNumberService.ts` | Batch registration of uppercase-normalized serial numbers, duplicate conflict detection, location custody tracking, and lifecycle audit history. |
| `SequenceService` (extended) | `apps/api/src/services/sequenceService.ts` | Added `STOCK_RESERVATION` support (`RES-YYYY-NNNNN`). |

### 2.3 Versioned REST API Routes

| Router | Mount Path | Methods & Paths | Permissions / Guards |
| :--- | :--- | :--- | :--- |
| `orderRouter` | `/api/v1/orders` | `POST /`<br>`GET /`<br>`GET /:id`<br>`POST /:id/cancel`<br>`POST /:id/reserve-stock` | `order:create`<br>`order:read`<br>`order:read`<br>`order:cancel`<br>`inv:reserve` |
| `inventoryRouter` | `/api/v1/inventory` | `GET /balances`<br>`GET /movements`<br>`POST /receipt`<br>`POST /issue`<br>`POST /transfer`<br>`POST /return`<br>`POST /opening-balance`<br>`POST /serials`<br>`GET /serials`<br>`GET /serials/:serialNumber` | `inv:read`<br>`inv:read`<br>`inv:receive`<br>`inv:issue`<br>`inv:transfer`<br>`inv:return`<br>`inv:adjust`<br>`inv:receive`<br>`inv:read`<br>`inv:read` |
| `customerOrderRouter` | `/api/v1/customer-portal/orders` | `GET /`<br>`GET /:id` | Strictly customer-scoped session (`req.session.customer.customerId`). Strips internal warehouse, cost, and ledger data. |

### 2.4 Frontend Operational Screens (`apps/web`)

| Page | Route | Description |
| :--- | :--- | :--- |
| `OrdersPage` | `/orders` | Sales orders directory, status filters (`CONFIRMED`, `IN_PROGRESS`, etc.), reservation filters, metric cards, and "Create Order from Quotation" modal. |
| `OrderDetailPage` | `/orders/:id` | Full order review: customer details, snapshotted line items table, financial summary in INR, payment milestone breakdown, stock reservation modal, and cancellation dialog. |
| `InventoryPage` | `/inventory` | Multi-tab dashboard: **Stock Balances** (on-hand, reserved, available), **Movement Ledger** (append-only audit log), and **Serialized Hardware**; action modals for Receipt (GRN), Issue, Transfer, Return, Serial Registration, and Opening Stock. |

---

## 3. Architecture Deep-Dive

### 3.1 Order-to-Quotation Revision Relationship
- Sales orders are created strictly from an accepted, approved, and non-superseded quotation revision.
- A unique database index on `{ quotationRevisionId: 1 }` guarantees that a single accepted quotation revision cannot produce duplicate orders.
- Commercial line items, unit rates, tax rates, payment milestones, and terms are immutably copied into the sales order document at booking time. Current catalog prices are never referenced to overwrite agreed historical figures.

### 3.2 Two-Phase Inventory Semantics: Reservation vs. Physical Issue
1. **Stock Reservation:**
   - Pre-allocates material to a confirmed order without removing it from warehouse shelves.
   - Updates: `reservedQuantity += Q`, `availableQuantity -= Q`.
   - Invariant: `onHandQuantity` remains completely unchanged.
2. **Physical Stock Issue:**
   - Material is physically dispatched from warehouse custody.
   - Updates: `onHandQuantity -= Q`, `reservedQuantity -= Q`.
   - Invariant: `availableQuantity` is unaffected because it was already deducted during reservation.
3. **Cancellation Before Issue:**
   - Reverses allocation: `reservedQuantity -= Q`, `availableQuantity += Q`.
   - Returns reserved units back to available pool.
4. **Cancellation After Issue:**
   - Direct order cancellation is strictly forbidden. A formal return movement (`RETURN`) must be executed to return physical custody back into inventory.

### 3.3 Concurrency & Idempotency Guarantees
- **Atomic Concurrency:** Standalone and replica set MongoDB deployments both support single-document atomicity. The conditional write:
  ```ts
  StockBalance.findOneAndUpdate(
    { productId, warehouseId, availableQuantity: { $gte: quantity } },
    { $inc: { reservedQuantity: quantity, availableQuantity: -quantity } }
  )
  ```
  ensures that competing concurrent requests cannot over-reserve stock. If insufficient stock is available, zero documents match and the operation safely aborts.
- **Batch Compensation:** If an order requires multiple line items and item $N$ fails after items $1 \dots N-1$ were allocated, `StockService` executes compensating rollback operations to restore the exact allocations from that batch before rejecting the request.
- **Idempotency Protection:** Both `idempotencyKey` indices and unique document constraints prevent network retries or repeated submissions from creating duplicate orders, duplicate stock receipts, or double-adjusting balances.

### 3.4 MongoDB Deployment Assumptions & Fallback Safety
- Single-document conditional writes (`$gte`) provide rock-solid atomicity across all MongoDB topologies (standalone, replica sets, Atlas).
- Multi-document transactions (`session.withTransaction`) require a replica set topology.
- In-memory stock balance fallbacks are strictly prohibited in production. If MongoDB is disconnected, all stock mutations fail safely with standard operational errors.

---

## 4. Automated Test Results

| Test Suite | File | Tests | Result |
| :--- | :--- | :--- | :--- |
| `@ins-solar/shared` | `packages/shared/src/__tests__/*` | 101 | Passing |
| `@ins-solar/api` | `apps/api/src/__tests__/*` (including `phase5a.test.ts`) | 103 | Passing |
| `@ins-solar/web` | `apps/web/src/__tests__/*` (including `orderPages.test.tsx`) | 11 | Passing |
| **Total Monorepo Tests** | **All Workspaces** | **215** | **100% Passing** |

All 18 required tests from Section 10 of the Phase 5A Specification were implemented and passed:
1. Order creation from an eligible accepted quotation revision.
2. Rejection of unaccepted, expired, superseded or unapproved revisions.
3. Order creation preserves agreed commercial snapshots.
4. Concurrent or repeated order creation cannot produce duplicate orders.
5. Reservation does not change physical on-hand quantity.
6. Two concurrent reservations cannot exceed available stock.
7. Insufficient stock reservation fails without partial mutations.
8. Reservation release is idempotent.
9. Stock issue reduces on-hand quantity exactly once.
10. Cancellation before issue releases reservation correctly.
11. Cancellation after issue requires a controlled return/reversal process.
12. Duplicate movement/idempotency requests do not double-adjust balances.
13. Unauthorized users cannot reserve, issue, transfer or adjust stock.
14. Customer identities cannot access internal inventory or other customers' orders.
15. Serial-number uniqueness and lifecycle validation.
16. Stock movement history cannot be edited or deleted through ordinary application routes.
17. Database unavailability fails safely without in-memory stock mutation.
18. Inter-warehouse transfer updates source and destination balances atomically.

---

## 5. Scope Boundaries Preserved

As strictly mandated for Phase 5A:
- **No vendor procurement** or purchase orders implemented.
- **No vendor invoices** or accounts payable implemented.
- **No payment collection** or gateway integration implemented.
- **No installation project execution** automatically triggered.
- **No subsidy processing** or DISCOM application workflows implemented.
- **No AMC maintenance** modules implemented.

---

## 6. Next Recommended Phase

**Phase 5B: Procurement, Vendor Management & Inbound Purchase Receipts** or **Phase 6A: Payment Collection, Project Scheduling & Installation Milestone Handover**.
