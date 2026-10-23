# INS Solar Business Management Software — Phase 2 Implementation Report

**Document Reference:** `INS-DEV-PH2-001`  
**Phase:** Phase 2 — Authentication, Authorization & Security Foundation  
**Status:** Completed & Empirically Verified  
**Execution Environment:** Node.js v24.11.1 / npm v11.6.2 / Windows x64  
**Date:** October 2026  

---

## 1. Executive Summary

Phase 2 establishes the authentication, session lifecycle, role-based access control (RBAC), multi-factor authentication (MFA), CSRF defense, rate-limiting, and security audit logging foundations for the **INS Solar Business Management System**.

In strict accordance with the approved architecture and Phase 2 boundaries:
* **Zero Business Modules Implemented:** No quotations, customer projects, payments, inventory transfers, or full business screens were implemented.
* **Strict Identity Separation:** Employee identities (`User` model) and customer portal identities (`CustomerIdentity` model bound to `Customer`) remain strictly segregated at schema, session, and authorization layers.
* **Stateful Server-Managed Sessions:** Stateless JWTs and `localStorage` token storage are completely avoided. Sessions are maintained via `express-session` with `connect-mongo` persistent MongoDB storage, signed cookies, HttpOnly, SameSite, and absolute/idle timeout enforcement.
* **Modern Cryptography:** Passwords hashed with `argon2id` (RFC 9106); MFA TOTP secrets encrypted at rest via AES-256-GCM; recovery codes and reset tokens stored exclusively as SHA-256 hashes.
* **Comprehensive Test Verification:** 54 automated tests (17 shared, 36 api, 1 web) executed and 100% passing, including 16 empirical security attack/authorization scenarios.

---

## 2. Implemented Features & File Locations

### 2.1 Shared Contracts (`packages/shared`)
* [`packages/shared/src/types/enums.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/types/enums.ts): Complete definition of `UserRole` (11 roles), `Department` (6 departments), `AuditAction` (16 actions), `AuditOutcome`, `ActorType`, and `ErrorCode`.
* [`packages/shared/src/types/auth.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/types/auth.ts): Granular permission tokens (`ALL_PERMISSIONS`), role default permission mapping (`ROLE_DEFAULT_PERMISSIONS`), privileged role set (`PRIVILEGED_ROLES`), and session DTO types (`SessionUserPayload`, `SessionCustomerPayload`, `AuthUserDto`).
* [`packages/shared/src/schemas/auth.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/schemas/auth.ts): Zod schemas for login, MFA challenge, MFA confirmation, password reset request/confirmation, customer magic-link/OTP, user creation, and privilege updates.
* [`packages/shared/src/__tests__/auth.test.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/packages/shared/src/__tests__/auth.test.ts): 10 unit tests verifying role permission mappings, privileged MFA membership, and input schemas.

### 2.2 Backend API Security Infrastructure (`apps/api`)
* [`apps/api/src/config/env.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/config/env.ts): Strict Zod environment schema requiring `SESSION_SECRET` (>= 32 chars), `MFA_ENCRYPTION_KEY` (64 hex chars = 32 bytes), `CSRF_SECRET` (>= 32 chars), cookie settings, and production guards.
* [`apps/api/src/utils/crypto.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/utils/crypto.ts): Argon2id password hashing and verification, AES-256-GCM authenticated encryption/decryption, cryptographically secure random token generation, and SHA-256 hashing.
* [`apps/api/src/utils/mfa.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/utils/mfa.ts): TOTP secret and QR code URI generation (`otplib` RFC 6238), code verification with time drift window, and single-use 10-character recovery code hashing and consumption.
* [`apps/api/src/models/User.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/User.ts): Mongoose schema with `employeeCode`, `email`, `phone`, `passwordHash`, `department`, `role`, `permissions`, `mfaEnabled`, `mfaSecretEncrypted`, `mfaRecoveryCodesHashed`, `sessionVersion`, `isActive`, and safe `toJSON()` serialization that redacts secrets.
* [`apps/api/src/models/CustomerIdentity.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/CustomerIdentity.ts): Isolated customer authentication model containing magic-link and OTP state, rate counters, and link to `Customer`.
* [`apps/api/src/models/Customer.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/Customer.ts): Customer model anchor representing the verified business entity.
* [`apps/api/src/models/PasswordResetToken.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/PasswordResetToken.ts): Ephemeral password recovery tokens with 15-minute TTL index, stored exclusively as SHA-256 hashes.
* [`apps/api/src/models/SecurityAuditLog.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/models/SecurityAuditLog.ts): Append-oriented audit event collection with Mongoose pre-hooks strictly prohibiting `update` and `delete` operations.
* [`apps/api/src/services/auditService.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/services/auditService.ts): Structured audit recording service with automated recursive redaction of credentials, tokens, hashes, and OTPs.
* [`apps/api/src/middleware/session.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/middleware/session.ts): Persistent MongoDB session store (`connect-mongo`), idle timeout tracker (30 min inactivity), and 8-hour absolute session expiration.
* [`apps/api/src/middleware/csrf.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/middleware/csrf.ts): Double-submit HMAC CSRF protection with readable `XSRF-TOKEN` cookie, request header validation on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`), and Origin header checking.
* [`apps/api/src/middleware/rateLimiter.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/middleware/rateLimiter.ts): Standardized IP and key-based rate limiters for login (5 attempts / 15 min), MFA (5 attempts / 5 min), and customer tokens.
* [`apps/api/src/middleware/authorize.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/middleware/authorize.ts): Centralized authorization guards: `requireAuth`, `requireEmployee`, `requireCustomer`, `requireRole`, `requirePermission`, `requireMfa`, `requireDepartmentScope`, `checkAntiSelfApproval`, and `requireCustomerOwnership`.
* [`apps/api/src/routes/auth.routes.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/routes/auth.routes.ts): Employee authentication endpoints (`/login`, `/login/mfa`, `/logout`, `/me`, `/mfa/setup`, `/mfa/confirm`, `/password-reset/request`, `/password-reset/confirm`, `/users/:id/deactivate`, `/users/:id/privileges`).
* [`apps/api/src/routes/customer-auth.routes.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/routes/customer-auth.routes.ts): Customer boundary endpoints (`/magic-link`, `/magic-link/verify`, `/otp/request`, `/otp/verify`, `/me`, `/logout`).
* [`apps/api/src/scripts/bootstrap-admin.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/scripts/bootstrap-admin.ts): Non-repeatable, command-line administrator bootstrap utility requiring complex passwords and logging initialization audit records.

### 2.3 Frontend Authentication Foundation (`apps/web`)
* [`apps/web/src/lib/api.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/lib/api.ts): Centralized API client with automatic `credentials: 'include'` and automated extraction/attachment of `X-CSRF-Token` headers from cookie.
* [`apps/web/src/context/AuthContext.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/context/AuthContext.tsx): React context integrated with TanStack Query managing session state, inline MFA challenges, login/logout, and `hasPermission` / `hasRole` helpers.
* [`apps/web/src/pages/LoginPage.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/LoginPage.tsx): Professional solar-branded employee login screen with inline MFA transition, error feedback, and boundary disclosure.
* [`apps/web/src/pages/MfaChallengePage.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/MfaChallengePage.tsx): MFA verification screen supporting 6-digit TOTP codes and emergency 10-character backup recovery codes.
* [`apps/web/src/pages/MfaSetupPage.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/pages/MfaSetupPage.tsx): Authenticator QR enrollment interface with manual secret entry fallback, confirmation verification, and backup recovery code download.
* [`apps/web/src/components/common/ProtectedRoute.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/components/common/ProtectedRoute.tsx): Route wrapper enforcing authentication, employee type, and specific permission tokens.
* [`apps/web/src/components/layout/AppLayout.tsx`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/web/src/components/layout/AppLayout.tsx): Header displaying active session status, role/department pill, MFA enrollment status, and one-click logout.

---

## 3. Identity and Session Architecture

```
  +-------------------------------------------------------------+
  |                       Browser Client                        |
  +-------------------------------------------------------------+
         |                                           ^
         | Cookie: ins_session=<id>                  | Set-Cookie: ins_session=<id>;
         | Header: X-CSRF-Token=<hmac>               |             HttpOnly; Secure; SameSite=Lax
         v                                           | Set-Cookie: XSRF-TOKEN=<hmac>
  +-------------------------------------------------------------+
  |                 Express 5 Security Pipeline                 |
  |  1. Cookie Parser                                           |
  |  2. Session Middleware (connect-mongo persistent store)     |
  |  3. CSRF Verification (Origin check + Double Submit HMAC)   |
  |  4. Sensitive-Route Rate Limiting                           |
  |  5. Centralized Authorize Guards (deny-by-default)          |
  +-------------------------------------------------------------+
         |                                           |
         v                                           v
  +------------------------+               +------------------------+
  |  Employee Identity     |               | Customer Portal Bound  |
  |  Model: User           |               | Model: CustomerIdentity|
  |  - Argon2id Password   |               | - Passwordless Flow    |
  |  - AES-256-GCM MFA     |               | - Ephemeral OTP/Link   |
  |  - Permissions List    |               | - Bound to Customer ID |
  |  - sessionVersion rev. |               | - Isolated Permissions |
  +------------------------+               +------------------------+
```

### 3.1 Session Security Guarantees
* **Persistence & Fail-Safe:** Sessions persist in MongoDB collection `sessions` via `connect-mongo`. If `MONGODB_URI` is omitted in development, it safely warns and uses an ephemeral store. In production (`NODE_ENV=production`), omitting MongoDB or using default secrets fails fast on startup.
* **Cookie Attributes:** Cookies use `name: 'ins_session'`, `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (in production).
* **Session Expiration:**
  * **Idle Timeout:** 30 minutes of inactivity (`sessionTimeoutMiddleware`).
  * **Absolute Lifetime:** 8 hours maximum session duration.
* **Active Session Revocation:** Changing passwords or deactivating an employee increments their `sessionVersion`. Any existing session with a stale `sessionVersion` is immediately rejected and destroyed upon its next request.
* **Safe Serialization:** Raw session IDs are never included in API response payloads, audit event fields, or frontend stores.

---

## 4. Role/Permission Policy & Supervisory Scope

INS Solar uses a centralized, typed permission matrix (`ALL_PERMISSIONS`) adhering to the principle of least privilege:

| Role | Default Scope | Privileged MFA Required |
| :--- | :--- | :---: |
| `SUPERADMIN` | Unrestricted wildcard access (`*`) to all 40+ system actions. | Yes |
| `ADMIN` | Full operational, financial, HR, inventory, and system oversight. | Yes |
| `DEPARTMENT_HEAD` | Supervisory visibility and approval authority over assigned department records. | Configurable |
| `ACCOUNTS_OFFICER` | Invoices, payments, expenses, purchase orders, costing reports. | Yes |
| `SALES_EXECUTIVE` | Leads, follow-ups, customers, surveys, quotation generation. | No |
| `SURVEYOR` | Assigned site surveys, shadow documentation, site photo uploads. | No |
| `INSTALLATION_CREW`| Active projects, checklist execution, handover photos. | No |
| `SERVICE_TECHNICIAN`| Breakdown tickets, AMC contracts, service visits. | No |
| `CUSTOMER` | External portal only (own quotations, projects, invoices, KYC upload). | No |

### 4.1 Supervisory Scopes & Boundary Safeguards
1. **Departmental Isolation:** Department heads can view and authorize records belonging only to their designated department (`requireDepartmentScope(Department)`). A Sales Head cannot approve Accounts records or access confidential HR payroll files.
2. **Anti-Self-Approval Safeguard:** An employee cannot approve their own submission (`checkAntiSelfApproval`). The approver identity in session must differ from the submission creator (`req.body.submittedBy`).
3. **Ad-Hoc Permission Overrides:** Individual users can be granted specific supplemental permissions without altering corporate roles. `User.getEffectivePermissions()` merges role defaults with user-specific overrides.
4. **Customer Tenant Isolation:** Customer routes strictly extract customer identity from the server-managed session (`req.session.customer.customerId`). Any query or body parameter claiming to be a customer is ignored, completely preventing IDOR (Insecure Direct Object Reference) attacks between customers.

---

## 5. MFA & Account Recovery Design

### 5.1 Privileged MFA Architecture
* **Algorithm:** Standard RFC 6238 TOTP using 6-digit codes and 30-second time steps. Compatible with Google Authenticator, Microsoft Authenticator, and 1Password.
* **Secret Storage:** TOTP secrets are encrypted at rest using AES-256-GCM backed by a dedicated 256-bit encryption key (`MFA_ENCRYPTION_KEY`). Secrets are never stored in plaintext.
* **Backup Recovery Codes:** Users receive 8 cryptographically random 10-character recovery codes during setup. Codes are stored in MongoDB exclusively as SHA-256 hashes. Upon presentation, a matching hash is permanently deleted (single-use guarantee).
* **Two-Step Enrollment:** Enrollment requires an authenticated employee to generate a candidate secret (`POST /mfa/setup`), followed by entering a valid 6-digit TOTP code (`POST /mfa/confirm`). A secret is never activated without verified proof of possession.

### 5.2 Password Recovery
* **Token Security:** Password reset tokens are generated using `node:crypto.randomBytes(32)` (256 bits of entropy) and stored in MongoDB exclusively as SHA-256 hashes (`PasswordResetToken` collection).
* **Expiry & Single-Use:** Tokens expire automatically after 15 minutes (enforced by application logic and a MongoDB TTL index). Tokens are deleted immediately upon consumption.
* **Session Invalidation:** Successful password resets increment the user's `sessionVersion`, invalidating all existing browser sessions across all devices.

---

## 6. Customer Authentication Delivery Status

### 6.1 Architecture & Boundaries
Customer authentication operates through passwordless channels:
1. **Magic Link:** A single-use 32-byte cryptographic token with a 15-minute expiry.
2. **WhatsApp / SMS OTP:** A 6-digit numeric OTP with a 10-minute expiry, limited to a maximum of 3 verification attempts.

### 6.2 Provider Status & Safe Fallback
* **Production Status:** As no third-party email (SendGrid/SES) or SMS/WhatsApp (Twilio/Gupshup) credentials have been configured or provisioned by INS Solar, **production external delivery remains disabled**.
* **Zero Secret Leakage:** Production API responses and server logs never return or log OTPs or magic-link tokens. Generic success messages (`"If an account exists, a link has been dispatched"`) prevent customer account enumeration.
* **Development/Test Inspection Route:** In non-production environments (`NODE_ENV !== 'production'`), a developer inspection endpoint (`GET /api/v1/dev/last-tokens`) captures the latest generated tokens strictly for automated test suites and local verification.

---

## 7. Environment Variables Added

| Variable | Required | Description | Production Constraint |
| :--- | :---: | :--- | :--- |
| `SESSION_SECRET` | Yes | 32+ character entropy string for signing session cookies. | Cannot use default fallback. |
| `MFA_ENCRYPTION_KEY` | Yes | 64-character hex string (32 bytes) for AES-256-GCM encryption. | Must be exactly 64 hex chars. |
| `CSRF_SECRET` | Yes | 32+ character entropy string for CSRF HMAC generation. | Cannot use default fallback. |
| `COOKIE_SECURE` | Optional | Boolean flag forcing `Secure` attribute on cookies. | Defaults to `true` in production. |
| `COOKIE_SAME_SITE` | Optional | Cookie SameSite policy (`lax`, `strict`, `none`). | Defaults to `lax`. |
| `RATE_LIMIT_WINDOW_MS`| Optional | Window duration for sensitive endpoint rate limiters. | Defaults to 900,000 ms (15 min). |
| `RATE_LIMIT_MAX` | Optional | Max allowed requests per window for login endpoints. | Defaults to 5 attempts. |

All variables are declared with examples in [`.env.example`](file:///d:/My%20project/Solar%20Business%20Management%20Software/.env.example) and validated on startup by [`apps/api/src/config/env.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/config/env.ts).

---

## 8. Bootstrap & Administrative Safety Procedure

To prevent security vulnerabilities arising from hardcoded default administrator passwords or public admin creation endpoints:
* **No Default Admin Seeded:** The application database contains no default passwords or pre-seeded administrator records.
* **CLI Bootstrap Script:** A command-line utility [`apps/api/src/scripts/bootstrap-admin.ts`](file:///d:/My%20project/Solar%20Business%20Management%20Software/apps/api/src/scripts/bootstrap-admin.ts) allows the system operator to initialize the first `SUPERADMIN`.
* **Execution:**
  ```bash
  npm run bootstrap:admin --workspace=@ins-solar/api
  ```
* **Safety Guards:**
  1. Prompts for or reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` (requiring uppercase, lowercase, digit, special char, and >= 12 chars).
  2. Inspects database for existing active `SUPERADMIN` accounts. If an active Superadmin exists, the script **immediately aborts** with an error.
  3. Records an immutable audit log (`AUTH_USER_CREATED`).
  4. Requires the Superadmin to log in and enroll MFA immediately on first access.

---

## 9. Automated Security Tests Executed & Empirical Results

All 18 mandated security scenarios and component tests were executed using Vitest.

### 9.1 Summary of Executed Test Suites

```
Test Suites: 9 passed (9 total)
Tests:       54 passed (54 total)
Snapshots:   0 total
Duration:    ~6.5s across monorepo workspaces
```

### 9.2 Verification Scenarios in `apps/api/src/__tests__/security.test.ts`

| # | Scenario Tested | Tested Mechanism | Result |
| :---: | :--- | :--- | :---: |
| **1** | Unauthenticated Access Denial | Protected endpoint (`/auth/me`) denies request with HTTP 401. | **PASSED** |
| **2** | Session Creation | Valid employee login creates server-side session with HttpOnly/SameSite cookie. | **PASSED** |
| **3** | Session Revocation on Logout | POST `/auth/logout` invalidates session and clears cookie. | **PASSED** |
| **4** | Deactivated User Rejection | Requests with active session for deactivated user are rejected (HTTP 401). | **PASSED** |
| **5** | Timing-Safe Login Failure | Invalid email and invalid password return identical generic error messages. | **PASSED** |
| **6** | CSRF Protection Enforcement | State-changing POST mutations reject requests with missing/invalid CSRF tokens. | **PASSED** |
| **7** | Untrusted CORS Rejection | Credentialed requests from non-whitelisted origins are blocked (HTTP 403). | **PASSED** |
| **8** | Privileged MFA Requirement | Privileged Accounts role blocked until 2FA code is confirmed. | **PASSED** |
| **9** | Self-Privilege Escalation Block | Non-admin user attempting to grant admin role is denied (HTTP 403). | **PASSED** |
| **10**| Anti-Self-Approval Enforcement | Approver matching submission creator is rejected with HTTP 403. | **PASSED** |
| **11**| Customer Identity Spoofing Block | Request body customerId override is ignored in favor of verified session. | **PASSED** |
| **12**| Customer Tenant Isolation | Customer A attempting to access Customer B's resources receives HTTP 403. | **PASSED** |
| **13**| Recovery Token Expiry & Replay | Reset token is single-use; subsequent attempts fail with HTTP 400. | **PASSED** |
| **14**| OTP Attempt Limit Lockout | Entering incorrect OTP 3 times locks code; further attempts rejected. | **PASSED** |
| **15**| Security Audit Log Redaction | Passwords, tokens, TOTP codes, and encrypted secrets redacted to `[REDACTED]`. | **PASSED** |
| **16**| Append-Only Audit Immutability | `updateOne`, `deleteMany`, etc. on `SecurityAuditLog` throw runtime errors. | **PASSED** |
| **17**| Department Supervisory Scope | Sales Head cannot access Accounts department records. | **PASSED** |
| **18**| First-Admin Bootstrap Guard | Bootstrap creates first admin once; second execution safely aborted. | **PASSED** |

---

## 10. Quality Gate Verification

| Tool / Command | Command Executed | Result |
| :--- | :--- | :---: |
| **TypeScript Typecheck** | `npm run typecheck` | **0 errors (100% clean across 3 packages)** |
| **ESLint** | `npm run lint` | **0 errors, 0 warnings** |
| **Prettier Formatting** | `npm run format:check` | **All files match Prettier code style** |
| **Automated Tests** | `npm run test` | **54 passed (17 shared, 36 api, 1 web)** |
| **Production Build** | `npm run build` | **Shared + API + Web Vite bundle built successfully** |
| **Security Audit** | `npm audit --omit=dev` | **0 vulnerabilities found** |

---

## 11. Known Limitations & Remaining Risks

1. **Transactional Email & WhatsApp Providers:** Production dispatch for magic links, OTPs, and password reset notifications is currently held in an inactive state pending owner approval and credential provisioning for external gateways.
2. **Rate Limit Persistence:** Rate limiters currently use in-memory bucket counters. If the backend is horizontally scaled across multiple VM instances behind a load balancer, rate limits should be backed by a shared Redis cluster.
3. **MFA Grace Period Policy:** At present, any user assigned a privileged role (`SUPERADMIN`, `ADMIN`, `ACCOUNTS_OFFICER`) is immediately subject to mandatory MFA upon login. If a grace period is desired for field personnel, a policy decision is required.

---

## 12. Decisions Requiring INS Solar Owner Approval

Before commencing Phase 3, the following technical and operational choices should be formally confirmed:

1. **Email Delivery Provider:** Confirm selection between AWS SES, SendGrid, or Brevo (Sendinblue) for transactional password resets and customer magic links.
2. **SMS / WhatsApp Gateway:** Confirm preferred Indian gateway (e.g., Twilio, Gupshup, Exotel) for customer OTP delivery and DLT compliance.
3. **Department Head Approval Matrix:** Confirm whether Department Heads require MFA, or whether MFA remains restricted to Admins and Accounts.
4. **Session Idle Duration:** Confirm if the 30-minute idle session timeout is appropriate for field laptops and tablets in solar installation yards.

---

*Report submitted by Lead Software Architect. System is in a clean, passing, and verified state ready for Phase 3 review.*
