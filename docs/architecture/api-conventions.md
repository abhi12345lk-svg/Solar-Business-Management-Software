# INS Solar Business Management Software — API Conventions & Standards

**Document Reference:** `INS-ARC-API-001`  
**Version:** `1.0.0`  
**Status:** Approved Standard  
**API Style:** Pragmatic RESTful JSON API over HTTPS  
**Current API Version:** `/api/v1`  
**API Specification Standard:** OpenAPI 3.1 (Interactive Swagger UI / Scalar at `/api/docs`)  

---

## 1. Core Architectural API Principles

All HTTP endpoints in the **INS Solar Business Management Software** must adhere to the standardized API contracts described herein:

1.  **Predictable Resource URIs:** Endpoints represent nouns in plural form (e.g., `/api/v1/customers`, `/api/v1/quotations`, `/api/v1/inventory/items`).
2.  **Standard HTTP Verbs:**
    *   `GET`: Retrieve a single resource or paginated collection. Safe and idempotent.
    *   `POST`: Create a new resource or execute an explicit action (e.g., `/quotations/:id/approve-discount`).
    *   `PUT`: Complete replacement of a mutable resource.
    *   `PATCH`: Partial update of specified resource attributes.
    *   `DELETE`: Soft-delete or deactivation of a resource (returns HTTP 200/204).
3.  **Strict Runtime Validation:** Inbound requests are validated against TypeScript-backed Zod schemas before reaching business logic controllers.
4.  **Uniform JSON Envelopes:** All responses (both 2xx successes and 4xx/5xx failures) conform to standardized top-level JSON structures.
5.  **Strict Session-Based Security:** Endpoints enforce HttpOnly cookie authentication, anti-CSRF checks on mutations, and granular role/record-level authorization.

---

## 2. Global Response Envelopes

Every API endpoint must return a predictable JSON envelope. Direct unstructured array or object responses are strictly prohibited.

### 2.1 Standard Success Response (Single Resource)
HTTP Status: `200 OK` or `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "66f38a7c1b2c4d001e9a4f21",
    "customerCode": "CUST-2026-00042",
    "name": "Apex Engineering Works",
    "primaryPhone": "+919876543210",
    "status": "ACTIVE",
    "createdAt": "2026-10-23T06:30:00.000Z",
    "updatedAt": "2026-10-23T06:30:00.000Z"
  },
  "meta": {
    "timestamp": "2026-10-23T06:30:01.120Z",
    "correlationId": "req-987f2e1a-4c21-4f9e-bc3d-5e8a7f1b2c3d"
  }
}
```

### 2.2 Standard Success Response (Paginated Collection)
HTTP Status: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "66f38a7c1b2c4d001e9a4f21",
      "customerCode": "CUST-2026-00042",
      "name": "Apex Engineering Works",
      "primaryPhone": "+919876543210",
      "status": "ACTIVE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 142,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "meta": {
    "timestamp": "2026-10-23T06:30:01.120Z",
    "correlationId": "req-987f2e1a-4c21-4f9e-bc3d-5e8a7f1b2c3d"
  }
}
```

### 2.3 Standard Error Response
HTTP Status: `4xx Client Error` or `5xx Server Error`
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted payload failed schema validation.",
    "details": [
      {
        "field": "primaryPhone",
        "issue": "Invalid phone number format. Must be E.164 compliant (e.g. +919876543210)."
      },
      {
        "field": "usableRoofAreaSqFt",
        "issue": "Expected number, received string."
      }
    ],
    "correlationId": "req-987f2e1a-4c21-4f9e-bc3d-5e8a7f1b2c3d",
    "timestamp": "2026-10-23T06:30:01.125Z"
  }
}
```

---

## 3. Standard HTTP Status & Error Codes

| HTTP Status | Error `code` String | Scenario & Semantics |
| :--- | :--- | :--- |
| **`400 Bad Request`** | `VALIDATION_FAILED` | Inbound payload failed Zod schema parsing. |
| **`400 Bad Request`** | `BUSINESS_RULE_VIOLATION` | Logical contradiction (e.g., advance exceeds total project value). |
| **`400 Bad Request`** | `INSUFFICIENT_STOCK` | Requested material exceeds available inventory balance. |
| **`401 Unauthorized`** | `AUTHENTICATION_REQUIRED` | Missing, invalid, or expired session cookie. |
| **`403 Forbidden`** | `PERMISSION_DENIED` | Authenticated user lacks required RBAC permission or tenant scope. |
| **`404 Not Found`** | `RESOURCE_NOT_FOUND` | Target entity does not exist or has been soft-deleted. |
| **`409 Conflict`** | `DUPLICATE_RESOURCE` | Resource already exists (e.g. duplicate mobile number or GSTIN). |
| **`409 Conflict`** | `CONCURRENCY_CONFLICT` | Version conflict / optimistic locking collision. |
| **`422 Unprocessable`** | `INVALID_STATE_TRANSITION` | Attempted invalid workflow state transition (e.g. `Draft` to `Completed`). |
| **`429 Too Many Req`**| `RATE_LIMIT_EXCEEDED` | Client exceeded IP or user rate limit quota. |
| **`500 Internal Error`**| `INTERNAL_SERVER_ERROR` | Uncaught backend runtime failure; details sanitized for security. |

---

## 4. Query Parameters: Pagination, Filtering & Sorting

All collection endpoints support standard query parameters:

### 4.1 Pagination Parameters
*   `page`: 1-indexed page number (default: `1`, minimum: `1`).
*   `limit`: Number of items per page (default: `20`, maximum: `100`).

### 4.2 Sorting Parameters
*   `sortBy`: Field name to sort on (e.g. `createdAt`, `customerCode`, `grossTotalPaise`).
*   `sortOrder`: Sort direction (`asc` or `desc`, default: `desc`).

### 4.3 Search & Filtering Parameters
*   `search`: Text search string across indexed search fields (name, phone, document code).
*   `status`: Filter by status enum (e.g., `?status=ACTIVE`).
*   `dateFrom` & `dateTo`: ISO 8601 timestamps for date range bounds.
*   `assignedTo`: Filter by assigned employee `ObjectId`.

**Example Full Query:**  
`GET /api/v1/leads?page=1&limit=25&sortBy=createdAt&sortOrder=desc&status=NEW&search=Apex`

---

## 5. Security & Authentication Conventions

1.  **Session Credentials:** Transmitted automatically via browser cookie named `ins_session_id` marked `HttpOnly`, `Secure`, and `SameSite=Lax`.
2.  **Anti-CSRF Header:** State-altering HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) require a matching `X-CSRF-Token` header supplied by the frontend from a non-HttpOnly CSRF meta-cookie.
3.  **Traceability Header:** Clients may transmit `X-Correlation-ID`. If absent, Express middleware generates a unique UUIDv4 and attaches it to `res.setHeader('X-Correlation-ID', ...)`.
4.  **Customer Isolation Guard:** For customer portal endpoints, the customer ID is resolved strictly from the authenticated session context (`req.session.customerId`), never trusted from URL route parameters or request bodies.

---

## 6. Idempotency & Concurrency Safeguards

### 6.1 Idempotent Financial Mutations
All non-idempotent financial creation endpoints (`POST /api/v1/payments`, `POST /api/v1/orders`) require the client to supply an `Idempotency-Key` header containing a client-generated UUIDv4:

```
POST /api/v1/payments
Idempotency-Key: 7b3e5c94-1a2f-48d1-93e1-34e8f190b21a
Content-Type: application/json
```

1.  **Duplicate Key Check:** If an operation with the same `Idempotency-Key` is received within 24 hours, the server returns the cached response of the initial successful operation without re-executing the payment.
2.  **In-Flight Guard:** If an identical key is currently executing, the server returns `409 Conflict` (`CONCURRENT_OPERATION_IN_PROGRESS`) instructing the client to wait.

### 6.2 Optimistic Concurrency Control
For state-critical documents (Quotations, Orders, Stock Balances), updates check the `version` or `updatedAt` timestamp:

```typescript
// Zod schema for optimistic update
const UpdateQuotationSchema = z.object({
  version: z.number().int().min(0),
  lineItems: z.array(LineItemSchema)
});
```
If `version` does not match the database document's current `version`, the server aborts the write with `409 Conflict` (`CONCURRENCY_CONFLICT`).

---

## 7. OpenAPI 3.1 & TypeScript Contract Synchronization

1.  **Single Source of Truth:** API contracts are declared using Zod schemas (`@asteasolutions/zod-to-openapi`).
2.  **Automated Specification Generation:** An automated build script compiles all Zod route schemas into an `openapi.json` definition file at build time.
3.  **Interactive Documentation:** Rendered at `/api/docs` via Swagger UI or Scalar in development and staging environments.
4.  **Client Typings Export:** TypeScript interfaces for frontend consumption are exported directly from the shared domain Zod schemas, guaranteeing complete end-to-end type safety between frontend and backend.
