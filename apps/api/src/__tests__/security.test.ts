import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { SecurityAuditLog } from '../models/SecurityAuditLog.js';
import { hashPassword, hashToken, encryptAesGcm } from '../utils/crypto.js';
import { Department, UserRole, AuditAction, AuditOutcome, ActorType } from '@ins-solar/shared';
import mongoose from 'mongoose';

// Utility to convert set-cookie array to a clean Cookie header string
function extractCookieHeader(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

describe('Security & Authorization Foundation Test Suite', () => {
  let app: ReturnType<typeof createApp>;
  let precomputedHash: string;

  beforeAll(async () => {
    // Precompute once for fast execution across tests
    precomputedHash = await hashPassword('ValidPassword123!');
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Unauthenticated requests are denied on protected routes
  // --------------------------------------------------------------------------
  it('Scenario 1: denies unauthenticated requests on protected routes with HTTP 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Successful employee authentication creates a server-managed session
  // --------------------------------------------------------------------------
  it('Scenario 2: creates server-managed session with HttpOnly cookie upon successful login', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0101',
      firstName: 'Ramesh',
      lastName: 'Kumar',
      email: 'ramesh.kumar@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.SALES,
      role: UserRole.SALES_EXECUTIVE,
      permissions: ['lead:read'],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => ['lead:read'],
      toJSON: () => ({
        id: 'user-0101',
        employeeCode: 'EMP-0101',
        email: 'ramesh.kumar@inssolar.com',
        role: UserRole.SALES_EXECUTIVE,
        department: Department.SALES
      })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'ramesh.kumar@inssolar.com',
      password: 'ValidPassword123!'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('ramesh.kumar@inssolar.com');

    // Assert session cookie set with HttpOnly and SameSite=Lax
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    const sessionCookie = setCookie.find(c => c.startsWith('ins_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Logout invalidates the session
  // --------------------------------------------------------------------------
  it('Scenario 3: logout destroys session and clears session cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    const sessionCleared = setCookie.some(
      c => c.startsWith('ins_session=;') || c.includes('Expires=Thu, 01 Jan 1970')
    );
    expect(sessionCleared).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Expired, revoked, or deactivated-account sessions cannot access protected routes
  // --------------------------------------------------------------------------
  it('Scenario 4: deactivated account session is rejected on protected routes and destroyed', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0102',
      firstName: 'Deactivated',
      lastName: 'User',
      email: 'inactive@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.OPERATIONS,
      role: UserRole.TECHNICIAN,
      permissions: [],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => [],
      toJSON: () => ({ id: 'inactive-user', email: 'inactive@inssolar.com' })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);

    // 1. Log in to establish cookie
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'inactive@inssolar.com',
      password: 'ValidPassword123!'
    });
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);

    // 2. Mock user database query returning isActive = false
    vi.spyOn(User, 'findById').mockResolvedValue({
      ...mockUser,
      isActive: false
    } as any);

    // 3. Subsequent request with cookie should be rejected
    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.message).toMatch(/Account is deactivated/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Login failures do not reveal whether an account exists
  // --------------------------------------------------------------------------
  it('Scenario 5: login failure message is identical for nonexistent accounts and wrong passwords', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    // Nonexistent user
    const resNonexistent = await request(app).post('/api/v1/auth/login').send({
      email: 'does.not.exist@inssolar.com',
      password: 'RandomPassword123!'
    });

    expect(resNonexistent.status).toBe(401);
    expect(resNonexistent.body.error.message).toBe('Invalid email or password.');

    // Existing user with wrong password
    vi.spyOn(User, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      email: 'real.user@inssolar.com',
      passwordHash: precomputedHash,
      isActive: true
    } as any);

    const resWrongPass = await request(app).post('/api/v1/auth/login').send({
      email: 'real.user@inssolar.com',
      password: 'WrongPassword123!'
    });

    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.error.message).toBe('Invalid email or password.');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: CSRF-protected mutations reject missing or invalid CSRF tokens
  // --------------------------------------------------------------------------
  it('Scenario 6: mutating requests reject missing or invalid CSRF tokens', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0103',
      firstName: 'Sunil',
      lastName: 'Verma',
      email: 'sunil@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.SALES,
      role: UserRole.SALES_EXECUTIVE,
      permissions: [],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => [],
      toJSON: () => ({ id: 'sunil-01', email: 'sunil@inssolar.com' })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);
    vi.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

    // Log in
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'sunil@inssolar.com',
      password: 'ValidPassword123!'
    });

    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);

    // Mutating request without X-CSRF-Token header
    const mutationWithoutCsrf = await request(app)
      .post('/api/v1/test-guard/anti-self-approval')
      .set('Cookie', cookie)
      .send({ ownerUserId: 'other-user' });

    expect(mutationWithoutCsrf.status).toBe(403);
    expect(mutationWithoutCsrf.body.error.message).toMatch(/Invalid or missing CSRF token/i);

    // Mutating request with bogus X-CSRF-Token header
    const mutationWithBadCsrf = await request(app)
      .post('/api/v1/test-guard/anti-self-approval')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', 'bogus.token.signature')
      .send({ ownerUserId: 'other-user' });

    expect(mutationWithBadCsrf.status).toBe(403);
    expect(mutationWithBadCsrf.body.error.message).toMatch(/Invalid or missing CSRF token/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Credentialed CORS rejects untrusted origins
  // --------------------------------------------------------------------------
  it('Scenario 7: rejects requests from untrusted origins', async () => {
    const res = await request(app)
      .get('/api/v1/health/live')
      .set('Origin', 'http://malicious-phishing-site.com');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/CORS blocked/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Privileged actions require MFA where policy requires it
  // --------------------------------------------------------------------------
  it('Scenario 8: privileged action requires MFA verification', async () => {
    const mockAdmin = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0001',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.ADMIN,
      role: UserRole.ADMIN,
      permissions: [],
      isActive: true,
      mfaEnabled: true,
      mfaSecretEncrypted: encryptAesGcm('JBSWY3DPEHPK3PXP'),
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => [],
      toJSON: () => ({ id: 'admin-001', role: UserRole.ADMIN })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockAdmin as any);
    vi.spyOn(User, 'findById').mockResolvedValue(mockAdmin as any);

    // Login without TOTP code triggers challenge
    const challengeRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@inssolar.com',
      password: 'ValidPassword123!'
    });

    expect(challengeRes.status).toBe(200);
    expect(challengeRes.body.data.requiresMfa).toBe(true);

    // Cookie has not completed MFA; accessing privileged route should be blocked
    const cookie = extractCookieHeader(challengeRes.headers['set-cookie']);
    const privilegedRes = await request(app)
      .get('/api/v1/test-guard/privileged-mfa')
      .set('Cookie', cookie);

    expect(privilegedRes.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: A user cannot grant themselves higher privileges
  // --------------------------------------------------------------------------
  it('Scenario 9: prevents ordinary employees from updating user privileges', async () => {
    const mockSales = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0104',
      firstName: 'Sales',
      lastName: 'Rep',
      email: 'rep@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.SALES,
      role: UserRole.SALES_EXECUTIVE,
      permissions: [],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => [],
      toJSON: () => ({ id: 'sales-rep', role: UserRole.SALES_EXECUTIVE })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockSales as any);
    vi.spyOn(User, 'findById').mockResolvedValue(mockSales as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'rep@inssolar.com',
      password: 'ValidPassword123!'
    });
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);
    const csrfToken = loginRes.body.data.csrfToken;

    // Attempting privilege escalation
    const patchRes = await request(app)
      .patch(`/api/v1/auth/users/${mockSales._id}/privileges`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ role: UserRole.SUPERADMIN });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.message).toMatch(/Role 'SALES_EXECUTIVE' is not authorized/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: An ordinary user cannot approve their own approval-controlled action
  // --------------------------------------------------------------------------
  it('Scenario 10: Anti-Self-Approval guard prevents user from approving their own item', async () => {
    const userId = new mongoose.Types.ObjectId();
    const mockUser = {
      _id: userId,
      employeeCode: 'EMP-0105',
      firstName: 'Lead',
      lastName: 'Engineer',
      email: 'engineer@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.ENGINEERING,
      role: UserRole.DEPARTMENT_HEAD,
      permissions: ['quote:discount_approve'],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => ['quote:discount_approve'],
      toJSON: () => ({ id: userId.toString(), role: UserRole.DEPARTMENT_HEAD })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);
    vi.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'engineer@inssolar.com',
      password: 'ValidPassword123!'
    });
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);
    const csrfToken = loginRes.body.data.csrfToken;

    // Approving record where ownerUserId === engineer's own ID
    const approvalRes = await request(app)
      .post('/api/v1/test-guard/anti-self-approval')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ ownerUserId: userId.toString() });

    expect(approvalRes.status).toBe(403);
    expect(approvalRes.body.error.message).toMatch(/Anti-Self-Approval Violation/i);

    // Approving record created by someone else succeeds
    const validApprovalRes = await request(app)
      .post('/api/v1/test-guard/anti-self-approval')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ ownerUserId: 'different-user-id' });

    expect(validApprovalRes.status).toBe(200);
    expect(validApprovalRes.body.data.approved).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 11 & 12: Customer identity isolation and cross-customer access denial
  // --------------------------------------------------------------------------
  it('Scenarios 11 & 12: Customer session isolation denies access to another customer resource', async () => {
    const customerIdA = new mongoose.Types.ObjectId();
    const customerIdB = new mongoose.Types.ObjectId();

    const mockIdentityA = {
      _id: new mongoose.Types.ObjectId(),
      customerId: customerIdA,
      name: 'Customer A',
      phone: '+919876543210',
      otpHash: hashToken('123456'),
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      otpAttempts: 0,
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue(mockIdentityA as any);
    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: customerIdA,
      customerCode: 'CUST-001'
    } as any);

    // Verify OTP to obtain Customer A session
    const otpVerifyRes = await request(app).post('/api/v1/customer-auth/otp/verify').send({
      phone: '+919876543210',
      otp: '123456'
    });

    expect(otpVerifyRes.status).toBe(200);
    const cookie = extractCookieHeader(otpVerifyRes.headers['set-cookie']);
    const csrfToken = otpVerifyRes.body.data.csrfToken;

    // 1. Customer A requests Customer A resource -> Allowed
    const resCustomerA = await request(app)
      .post('/api/v1/test-guard/customer-resource')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ resourceCustomerId: customerIdA.toString() });

    expect(resCustomerA.status).toBe(200);
    expect(resCustomerA.body.data.customerData).toBe('confidential');

    // 2. Customer A attempts to access Customer B resource -> 403 Forbidden
    const resCustomerB = await request(app)
      .post('/api/v1/test-guard/customer-resource')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ resourceCustomerId: customerIdB.toString() });

    expect(resCustomerB.status).toBe(403);
    expect(resCustomerB.body.error.message).toMatch(/You cannot view or modify another customer/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Recovery tokens expire and cannot be reused
  // --------------------------------------------------------------------------
  it('Scenario 13: password reset tokens cannot be reused once consumed', async () => {
    const userId = new mongoose.Types.ObjectId();
    const rawToken = 'a'.repeat(32);
    const tokenHash = hashToken(rawToken);

    const mockTokenRecord = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      tokenHash,
      used: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      save: vi.fn().mockResolvedValue(true)
    };

    const mockUser = {
      _id: userId,
      passwordHash: 'oldHash',
      sessionVersion: 1,
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PasswordResetToken, 'findOne')
      .mockResolvedValueOnce(mockTokenRecord as any) // First attempt: found
      .mockResolvedValueOnce(null); // Second attempt: already used/null

    vi.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

    // First use: Success
    const firstRes = await request(app).post('/api/v1/auth/password-reset/confirm').send({
      token: rawToken,
      newPassword: 'BrandNewSecurePassword123!'
    });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    // Second use (replay): Rejected
    const replayRes = await request(app).post('/api/v1/auth/password-reset/confirm').send({
      token: rawToken,
      newPassword: 'AnotherPassword123!'
    });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.error.message).toMatch(/token is invalid or has expired/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Customer OTP enforces attempt limit lockout
  // --------------------------------------------------------------------------
  it('Scenario 14: customer OTP enforces 3-attempt limit lockout', async () => {
    const mockIdentity = {
      _id: new mongoose.Types.ObjectId(),
      phone: '+919876543211',
      otpHash: hashToken('999999'),
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      otpAttempts: 3, // Already reached limit
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue(mockIdentity as any);

    const res = await request(app).post('/api/v1/customer-auth/otp/verify').send({
      phone: '+919876543211',
      otp: '999999'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Maximum OTP attempts exceeded/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Sensitive audit records do not expose credentials or tokens
  // --------------------------------------------------------------------------
  it('Scenario 15: security audit logger redacts passwords, tokens, and hashes', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
    const createSpy = vi.spyOn(SecurityAuditLog, 'create').mockResolvedValue({} as any);

    const { AuditService } = await import('../services/auditService.js');
    await AuditService.recordEvent({
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.AUTH_LOGIN_SUCCESS,
      outcome: AuditOutcome.SUCCESS,
      correlationId: 'audit-redaction-test',
      details: {
        password: 'PlaintextPassword123!',
        token: 'secret-auth-token',
        totpCode: '123456',
        recoveryCode: 'ABCD1234EF',
        nested: {
          mfaSecretEncrypted: 'enc-secret',
          safeKey: 'safeValue'
        }
      }
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const passedDetails = (createSpy.mock.calls[0]![0] as any).details;

    expect(passedDetails.password).toBe('[REDACTED]');
    expect(passedDetails.token).toBe('[REDACTED]');
    expect(passedDetails.totpCode).toBe('[REDACTED]');
    expect(passedDetails.recoveryCode).toBe('[REDACTED]');
    expect(passedDetails.nested.mfaSecretEncrypted).toBe('[REDACTED]');
    expect(passedDetails.nested.safeKey).toBe('safeValue');
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Audit events cannot be modified or deleted
  // --------------------------------------------------------------------------
  it('Scenario 16: SecurityAuditLog model throws error on mutation or deletion attempts', async () => {
    await expect(
      SecurityAuditLog.updateOne({ eventId: '123' }, { outcome: AuditOutcome.SUCCESS })
    ).rejects.toThrow(/Security audit logs are append-only/i);

    await expect(SecurityAuditLog.deleteOne({ eventId: '123' })).rejects.toThrow(
      /Security audit logs are append-only/i
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 18: Department supervisory scope prevents cross-department actions
  // --------------------------------------------------------------------------
  it('Scenario 18: Department Head supervisory scope blocks access outside assigned department', async () => {
    const mockSalesHead = {
      _id: new mongoose.Types.ObjectId(),
      employeeCode: 'EMP-0106',
      firstName: 'Sales',
      lastName: 'Manager',
      email: 'saleshead@inssolar.com',
      passwordHash: precomputedHash,
      department: Department.SALES,
      role: UserRole.DEPARTMENT_HEAD,
      permissions: [],
      isActive: true,
      mfaEnabled: false,
      sessionVersion: 1,
      save: vi.fn().mockResolvedValue(true),
      getEffectivePermissions: () => [],
      toJSON: () => ({ id: 'sales-head', role: UserRole.DEPARTMENT_HEAD })
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockSalesHead as any);
    vi.spyOn(User, 'findById').mockResolvedValue(mockSalesHead as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'saleshead@inssolar.com',
      password: 'ValidPassword123!'
    });
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);
    const csrfToken = loginRes.body.data.csrfToken;

    // 1. Access within SALES department -> Allowed
    const salesDeptRes = await request(app)
      .post('/api/v1/test-guard/department-scoped')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ targetDepartment: Department.SALES });

    expect(salesDeptRes.status).toBe(200);
    expect(salesDeptRes.body.data.authorized).toBe(true);

    // 2. Access in ACCOUNTS department -> Blocked (403)
    const accountsDeptRes = await request(app)
      .post('/api/v1/test-guard/department-scoped')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ targetDepartment: Department.ACCOUNTS });

    expect(accountsDeptRes.status).toBe(403);
    expect(accountsDeptRes.body.error.message).toMatch(/Supervisory access denied/i);
  });
});
