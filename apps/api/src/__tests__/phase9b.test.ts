/**
 * INS Solar Business Management Software — Phase 9B Integration Tests
 *
 * Comprehensive test suite for Employee/Team, Unified Tasks & Document Management:
 * 1. Employee Profile & 1:1 Identity Linkage without duplicate credentials
 * 2. Employee Workload, Availability, and Safe Deactivation without history loss
 * 3. Team Management with crew code generation, eligibility, and status toggle
 * 4. Unified Task Management with atomic sequence (TSK-YYYY-NNNNN), priority, and due dates
 * 5. Task Status transitions (COMPLETED completion notes, BLOCKED blocker reasons)
 * 6. Task Reassignment with mandatory audit reason and historical tracking
 * 7. Server-side Overdue filter consistency
 * 8. Cross-customer project linkage rejection guards
 * 9. Document Vault metadata registration with MIME and file size (<= 25MB) validation
 * 10. Document Review workflow requiring rejection reasons (min 5 chars)
 * 11. Document Versioning (v1 -> v2) preserving previousVersionId and isLatestVersion
 * 12. Cryptographic HMAC Signed URL generation with expiration enforcement
 * 13. Customer Portal document isolation: strictly customer's own CUSTOMER_VISIBLE files;
 *     internal-only and foreign tenant documents return 403 Forbidden
 * 14. RBAC enforcement on employee, team, task, and document management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  UserRole,
  Department,
  TaskCategory,
  ProjectPriority,
  ProjectTaskStatus,
  DocumentCategory,
  DocumentAccessClassification,
  DocumentReviewStatus,
  DocumentStorageStatus
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { EmployeeProfile } from '../models/EmployeeProfile.js';
import { Team } from '../models/Team.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { CustomerIdentity } from '../models/CustomerIdentity.js';
import { Customer } from '../models/Customer.js';
import { Project } from '../models/Project.js';
import { SequenceService } from '../services/sequenceService.js';
import { hashToken, hashPassword } from '../utils/crypto.js';

describe('Phase 9B Integration: Employee/Team, Unified Tasks & Private Document Vault', () => {
  let app: any;

  const adminUserId = new Types.ObjectId();
  const staffUserIdA = new Types.ObjectId();
  const staffUserIdB = new Types.ObjectId();
  const customerIdA = new Types.ObjectId();
  const customerIdB = new Types.ObjectId();

  const makePopulateQuery = (doc: any) => {
    const query: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    query.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return query;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();

    // Default Sequence Mock
    vi.spyOn(SequenceService, 'generateNumber').mockImplementation(async (entityType: any) => {
      const typeStr = String(entityType).toUpperCase();
      let prefix = 'DOC';
      if (typeStr.includes('EMP')) prefix = 'EMP';
      else if (typeStr.includes('TEAM') || typeStr.includes('TEM')) prefix = 'TEM';
      else if (typeStr.includes('TASK') || typeStr.includes('TSK')) prefix = 'TSK';
      return {
        formattedNumber: `${prefix}-2026-00001`,
        sequenceNumber: 1,
        sequenceKey: `${prefix}:2026`,
        prefix,
        fiscalYear: '2026'
      };
    });

    vi.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({} as any);

    // Smart User Store to prevent requireAuth mock collisions
    userRegistry.clear();
    vi.spyOn(User, 'findById').mockImplementation((id: any) => {
      const doc = userRegistry.get(id?.toString());
      return Promise.resolve(doc || null) as any;
    });
    vi.spyOn(User, 'findOne').mockImplementation((query: any) => {
      if (query?.email) {
        for (const u of userRegistry.values()) {
          if (u.email?.toLowerCase() === query.email.toLowerCase()) {
            return Promise.resolve(u) as any;
          }
        }
      }
      return Promise.resolve(null) as any;
    });
  });

  const userRegistry = new Map<string, any>();

  const registerMockUser = (userDoc: any) => {
    const fullDoc = {
      isActive: true,
      sessionVersion: 1,
      mfaEnabled: false,
      permissions: [],
      save: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ id: userDoc._id?.toString(), email: userDoc.email }),
      getEffectivePermissions: () =>
        userDoc.permissions || [
          'employee:read',
          'employee:manage',
          'team:read',
          'team:manage',
          'task:read',
          'task:create',
          'task:update',
          'task:assign',
          'task:delete',
          'document:read',
          'document:upload',
          'document:review',
          'document:archive'
        ],
      ...userDoc
    };
    userRegistry.set(userDoc._id?.toString(), fullDoc);
    return fullDoc;
  };

  const extractCookieHeader = (setCookie: string | string[] | undefined): string => {
    if (!setCookie) return '';
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies.map(c => c.split(';')[0]).join('; ');
  };

  // Login helper for employee/admin
  const loginEmployee = async (userId: Types.ObjectId, role: UserRole = UserRole.ADMIN, customPermissions?: string[]) => {
    const rawPassword = 'ValidPassword123!';
    const passwordHash = await hashPassword(rawPassword);

    const mockUser = registerMockUser({
      _id: userId,
      email: `user-${userId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      passwordHash,
      role,
      department: Department.OPERATIONS,
      isActive: true,
      sessionVersion: 1,
      mfaEnabled: false,
      permissions: customPermissions
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: mockUser.email, password: rawPassword });

    expect(loginRes.status).toBe(200);
    const cookie = extractCookieHeader(loginRes.headers['set-cookie']);
    const csrfToken = loginRes.body?.data?.csrfToken || '';
    return { cookie, csrfToken, user: mockUser };
  };

  // Login helper for customer
  const loginCustomer = async (cid: Types.ObjectId, phone = '+919876543210') => {
    const identityId = new Types.ObjectId();
    const rawOtp = '123456';

    vi.spyOn(CustomerIdentity, 'findOne').mockResolvedValue({
      _id: identityId,
      customerId: cid,
      phone,
      otpHash: hashToken(rawOtp),
      otpExpiresAt: new Date(Date.now() + 600000),
      isActive: true,
      save: vi.fn().mockResolvedValue(true)
    } as any);

    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: cid,
      fullName: 'Customer Test',
      primaryPhone: phone,
      email: 'customer@test.com',
      isActive: true
    } as any);

    const otpRes = await request(app)
      .post('/api/v1/customer-auth/otp/verify')
      .send({ phone, otp: rawOtp });

    expect(otpRes.status).toBe(200);
    const cookie = extractCookieHeader(otpRes.headers['set-cookie']);
    const csrfToken = otpRes.body?.data?.csrfToken || '';
    return { cookie, csrfToken };
  };

  // =========================================================================
  // 1. Employee Profile & Team Management
  // =========================================================================
  describe('Module 24: Employee & Team Management', () => {
    it('creates an employee profile linked to an existing User without duplicating credentials', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);

      registerMockUser({
        _id: staffUserIdA,
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul@example.com',
        role: UserRole.INSTALLATION_CREW,
        department: Department.OPERATIONS,
        isActive: true
      });

      vi.spyOn(EmployeeProfile, 'findOne').mockResolvedValue(null);
      vi.spyOn(EmployeeProfile.prototype, 'save').mockResolvedValue({
        _id: new Types.ObjectId(),
        employeeCode: 'EMP-2026-00001',
        designation: 'Solar Installation Lead',
        department: Department.OPERATIONS
      } as any);

      const res = await request(app)
        .post('/api/v1/employees')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          userId: staffUserIdA.toString(),
          designation: 'Solar Installation Lead',
          department: Department.OPERATIONS,
          skills: ['DC-Cabling', 'Inverter-Commissioning']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employeeCode).toBe('EMP-2026-00001');
    });

    it('rejects duplicate employee profile creation for the same User account (1:1 constraint)', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);

      registerMockUser({
        _id: staffUserIdA,
        firstName: 'Rahul',
        lastName: 'Sharma',
        isActive: true
      });

      vi.spyOn(EmployeeProfile, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        employeeCode: 'EMP-2026-00001',
        userId: staffUserIdA
      } as any);

      const res = await request(app)
        .post('/api/v1/employees')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          userId: staffUserIdA.toString(),
          designation: 'Duplicate Profile Attempt',
          department: Department.OPERATIONS
        });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
    });

    it('deactivates an employee safely without deleting records and reassigns active tasks', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const profileId = new Types.ObjectId();

      const mockProfile = {
        _id: profileId,
        userId: staffUserIdA,
        employeeCode: 'EMP-2026-00001',
        isActive: true,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(EmployeeProfile, 'findById').mockResolvedValue(mockProfile as any);
      registerMockUser({
        _id: staffUserIdA,
        isActive: true
      });
      registerMockUser({
        _id: staffUserIdB,
        isActive: true
      });

      vi.spyOn(ProjectTask, 'updateMany').mockResolvedValue({ modifiedCount: 3 } as any);
      const mockTasks = [1, 2, 3].map(() => ({
        _id: new Types.ObjectId(),
        assignedUserId: staffUserIdA,
        reassignmentHistory: [],
        save: vi.fn().mockResolvedValue(true)
      }));
      vi.spyOn(ProjectTask, 'find').mockResolvedValue(mockTasks as any);

      const res = await request(app)
        .patch(`/api/v1/employees/${profileId}/deactivate`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          reassignToUserId: staffUserIdB.toString(),
          deactivationReason: 'Resigned on personal grounds'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockProfile.isActive).toBe(false);
      expect(res.body.data.reassignedTasksCount).toBe(3);
    });

    it('creates a crew team with atomic TEM-YYYY-NNNNN and sets eligibility flags', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);

      registerMockUser({
        _id: staffUserIdA,
        isActive: true
      });

      vi.spyOn(Team.prototype, 'save').mockResolvedValue({
        _id: new Types.ObjectId(),
        teamCode: 'TEM-2026-00001',
        name: 'South Delhi Installation Crew',
        eligibility: { projectTasks: true, serviceVisits: true }
      } as any);

      const res = await request(app)
        .post('/api/v1/teams')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'South Delhi Installation Crew',
          department: Department.OPERATIONS,
          purpose: 'Turnkey residential solar installation',
          teamLeadId: staffUserIdA.toString(),
          eligibility: { projectTasks: true, serviceVisits: true }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teamCode).toBe('TEM-2026-00001');
    });

    it('toggles team active status with audited reason', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const teamId = new Types.ObjectId();

      const mockTeam = {
        _id: teamId,
        teamCode: 'TEM-2026-00001',
        name: 'Squad Beta',
        isActive: true,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Team, 'findById').mockResolvedValue(mockTeam as any);

      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}/status`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          isActive: false,
          reason: 'Seasonal restructuring'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockTeam.isActive).toBe(false);
    });
  });

  // =========================================================================
  // 2. Unified Task Management
  // =========================================================================
  describe('Module 25: Unified Task Management', () => {
    it('creates a unified task with atomic TSK-YYYY-NNNNN code', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);

      vi.spyOn(ProjectTask.prototype, 'save').mockResolvedValue({
        _id: new Types.ObjectId(),
        taskCode: 'TSK-2026-00001',
        taskNumber: 'TSK-2026-00001',
        title: 'Perform Megger insulation test on DC bus',
        category: TaskCategory.INSTALLATION_CHECKLIST,
        priority: ProjectPriority.HIGH,
        status: ProjectTaskStatus.TODO
      } as any);

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Perform Megger insulation test on DC bus',
          category: TaskCategory.INSTALLATION_CHECKLIST,
          priority: ProjectPriority.HIGH,
          dueDate: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskCode || res.body.data.taskNumber).toBe('TSK-2026-00001');
    });

    it('rejects cross-customer integrity violations between project and customer', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const projId = new Types.ObjectId();

      vi.spyOn(Project, 'findById').mockResolvedValue({
        _id: projId,
        customerId: customerIdA
      } as any);

      vi.spyOn(CustomerIdentity, 'findById').mockResolvedValue({
        _id: customerIdB
      } as any);

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Tampered task cross-customer',
          projectId: projId.toString(),
          customerId: customerIdB.toString() // Mismatch!
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cross-customer integrity violation');
    });

    it('requires a blocker reason when updating task status to BLOCKED', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const taskId = new Types.ObjectId();

      const mockTask = {
        _id: taskId,
        status: ProjectTaskStatus.IN_PROGRESS,
        statusHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectTask, 'findById').mockReturnValue(makePopulateQuery(mockTask));

      // Attempt BLOCKED without reason
      const failRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ status: 'BLOCKED' });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.message).toContain('blockerReason is required');

      // Attempt BLOCKED with valid reason
      const passRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          status: 'BLOCKED',
          blockerReason: 'DISCOM testing equipment unavailable until Monday'
        });

      expect(passRes.status).toBe(200);
      expect(passRes.body.success).toBe(true);
      expect(mockTask.status).toBe('BLOCKED');
    });

    it('reassigns task with mandatory reason and updates history', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const taskId = new Types.ObjectId();

      const mockTask = {
        _id: taskId,
        assignedUserId: staffUserIdA,
        reassignmentHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectTask, 'findById').mockReturnValue(makePopulateQuery(mockTask));
      registerMockUser({
        _id: staffUserIdB,
        isActive: true
      });

      // Attempt without reason -> fails Zod validation
      const failRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/reassign`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ assignedUserId: staffUserIdB.toString() });

      expect(failRes.status).toBe(400);

      // Attempt with valid reason
      const passRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/reassign`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          assignedUserId: staffUserIdB.toString(),
          reason: 'Technician A on medical leave'
        });

      expect(passRes.status).toBe(200);
      expect(mockTask.assignedUserId).toEqual(staffUserIdB);
      expect(mockTask.reassignmentHistory.length).toBe(1);
    });

    it('filters overdue tasks consistently using dueDate < now and status != COMPLETED', async () => {
      const { cookie } = await loginEmployee(adminUserId);

      const findSpy = vi.spyOn(ProjectTask, 'find').mockReturnValue(
        makePopulateQuery([
          {
            _id: new Types.ObjectId(),
            taskNumber: 'TSK-2026-00001',
            dueDate: new Date(Date.now() - 86400000),
            status: ProjectTaskStatus.TODO
          }
        ])
      );
      vi.spyOn(ProjectTask, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/tasks?isOverdue=true')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $nin: ['COMPLETED', 'CANCELLED'] },
          dueDate: expect.objectContaining({ $lt: expect.any(Date) })
        })
      );
    });
  });

  // =========================================================================
  // 3. Private Document Management & Access Boundaries
  // =========================================================================
  describe('Module 26: Private Document Management & Access Boundaries', () => {
    it('registers document metadata with strict MIME type and size validation', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);

      // 1. Reject executable / unauthorized MIME
      const failMimeRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          originalFilename: 'malware.exe',
          safeDisplayName: 'Malicious Executable',
          category: DocumentCategory.CUSTOMER_KYC,
          mimeType: 'application/x-msdownload',
          fileSizeBytes: 1024
        });

      expect(failMimeRes.status).toBe(400);
      expect(failMimeRes.body.error.message).toContain('Unsupported document');

      // 2. Reject file exceeding 25MB
      const failSizeRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          originalFilename: 'giant_video.pdf',
          safeDisplayName: 'Huge File',
          category: DocumentCategory.CUSTOMER_KYC,
          mimeType: 'application/pdf',
          fileSizeBytes: 30 * 1024 * 1024 // 30 MB
        });

      expect(failSizeRes.status).toBe(400);

      // 3. Successfully register valid PDF
      vi.spyOn(DocumentModel.prototype, 'save').mockResolvedValue({
        _id: new Types.ObjectId(),
        documentNumber: 'DOC-2026-00001',
        category: DocumentCategory.ENGINEERING_DRAWING,
        storageKey: 'documents/engineering_drawing/2026/DOC-2026-00001_sld.pdf',
        storageStatus: DocumentStorageStatus.SIMULATED_STORAGE_ONLY
      } as any);

      const passRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          originalFilename: 'sld.pdf',
          safeDisplayName: 'Single Line Diagram 10kWp',
          category: DocumentCategory.ENGINEERING_DRAWING,
          accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
          mimeType: 'application/pdf',
          fileSizeBytes: 524288 // 512 KB
        });

      expect(passRes.status).toBe(201);
      expect(passRes.body.data.documentNumber).toBe('DOC-2026-00001');
      expect(passRes.body.data.storageStatus).toBe(DocumentStorageStatus.SIMULATED_STORAGE_ONLY);
    });

    it('requires minimum 5-character reason when reviewing document as REJECTED or RESUBMISSION_REQUIRED', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const docId = new Types.ObjectId();

      const mockDoc = {
        _id: docId,
        documentNumber: 'DOC-2026-00001',
        reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
        isArchived: false,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      // Attempt REJECTED with empty or short reason
      const failRes = await request(app)
        .post(`/api/v1/documents/${docId}/review`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          reviewStatus: DocumentReviewStatus.REJECTED,
          rejectionReason: 'Bad' // Less than 5 chars
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.message).toContain('at least 5 characters');

      // Attempt REJECTED with valid reason
      const passRes = await request(app)
        .post(`/api/v1/documents/${docId}/review`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          reviewStatus: DocumentReviewStatus.REJECTED,
          rejectionReason: 'Earthing pit resistance test report not signed by chartered engineer'
        });

      expect(passRes.status).toBe(200);
      expect(mockDoc.reviewStatus).toBe(DocumentReviewStatus.REJECTED);
    });

    it('creates superseding document version (v1 -> v2) preserving previousVersionId', async () => {
      const { cookie, csrfToken } = await loginEmployee(adminUserId);
      const v1Id = new Types.ObjectId();

      const mockV1 = {
        _id: v1Id,
        documentNumber: 'DOC-2026-00001',
        version: 1,
        isLatestVersion: true,
        category: DocumentCategory.ENGINEERING_DRAWING,
        accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
        isArchived: false,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockV1 as any);
      vi.spyOn(DocumentModel.prototype, 'save').mockResolvedValue({
        _id: new Types.ObjectId(),
        documentNumber: 'DOC-2026-00001',
        version: 2,
        previousVersionId: v1Id,
        isLatestVersion: true
      } as any);

      const res = await request(app)
        .post(`/api/v1/documents/${v1Id}/new-version`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          originalFilename: 'sld_v2_revised.pdf',
          safeDisplayName: 'Single Line Diagram v2',
          mimeType: 'application/pdf',
          fileSizeBytes: 600000
        });

      expect(res.status).toBe(201);
      expect(mockV1.isLatestVersion).toBe(false);
      expect(res.body.data.version).toBe(2);
      expect(res.body.data.previousVersionId).toBe(v1Id.toString());
    });

    it('generates short-lived cryptographic HMAC signed URL and enforces expiration', async () => {
      const { cookie } = await loginEmployee(adminUserId);
      const docId = new Types.ObjectId();

      const mockDoc = {
        _id: docId,
        documentNumber: 'DOC-2026-00001',
        originalFilename: 'contract.pdf',
        safeDisplayName: 'Signed EPC Contract',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        storageKey: 'documents/contract/2026/DOC-2026-00001_contract.pdf',
        storageStatus: DocumentStorageStatus.SIMULATED_STORAGE_ONLY,
        accessClassification: DocumentAccessClassification.INTERNAL_ONLY,
        version: 1,
        isArchived: false,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      // Generate signed access URL
      const urlRes = await request(app)
        .get(`/api/v1/documents/${docId}/access-url?expiresIn=600`)
        .set('Cookie', cookie);

      expect(urlRes.status).toBe(200);
      expect(urlRes.body.data.downloadUrl).toContain('/api/v1/documents/');
      expect(urlRes.body.data.downloadUrl).toContain('token=');
      expect(urlRes.body.data.expiresInSeconds).toBe(600);

      // Download content using valid signed link
      const downloadRes = await request(app).get(urlRes.body.data.downloadUrl);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toContain('application/pdf');
      expect(downloadRes.headers['content-disposition']).toContain('attachment');

      // Expired signed token simulation
      const expiredUrl = urlRes.body.data.downloadUrl.replace(/expires=\d+/, 'expires=1000000000000');
      const expiredRes = await request(app).get(expiredUrl);
      expect(expiredRes.status).toBe(403);
      expect(expiredRes.body.error.message).toContain('expired');
    });

    it('strictly isolates customer documents: customer can ONLY view own CUSTOMER_VISIBLE files', async () => {
      // Login Customer A
      const { cookie: custACookie } = await loginCustomer(customerIdA, '+919999911111');
      const docCustAVisibleId = new Types.ObjectId();
      const docCustAInternalId = new Types.ObjectId();
      const docCustBId = new Types.ObjectId();

      // 1. Listing documents for customer A
      const findSpy = vi.spyOn(DocumentModel, 'find').mockReturnValue(
        makePopulateQuery([
          {
            _id: docCustAVisibleId,
            documentNumber: 'DOC-2026-00001',
            safeDisplayName: 'Solar Commissioning Certificate',
            category: DocumentCategory.COMMISSIONING_REPORT,
            accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
            fileSizeBytes: 2048,
            customerId: customerIdA
          }
        ])
      );
      vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValue(1);

      const listRes = await request(app)
        .get('/api/v1/customer-portal/documents')
        .set('Cookie', custACookie);

      expect(listRes.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: customerIdA,
          accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
          isArchived: false
        })
      );

      // 2. Customer A attempts to access their own INTERNAL_ONLY document -> 403 Forbidden
      vi.spyOn(DocumentModel, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: docCustAInternalId,
          customerId: customerIdA,
          accessClassification: DocumentAccessClassification.INTERNAL_ONLY,
          isArchived: false
        })
      );

      const internalAccessRes = await request(app)
        .get(`/api/v1/customer-portal/documents/${docCustAInternalId}`)
        .set('Cookie', custACookie);

      expect(internalAccessRes.status).toBe(403);
      expect(internalAccessRes.body.error.message).toContain('not customer-accessible');

      // 3. Customer A attempts to access Customer B's document -> 403 Forbidden
      vi.spyOn(DocumentModel, 'findById').mockReturnValue(
        makePopulateQuery({
          _id: docCustBId,
          customerId: customerIdB,
          accessClassification: DocumentAccessClassification.CUSTOMER_VISIBLE,
          isArchived: false
        })
      );

      const foreignAccessRes = await request(app)
        .get(`/api/v1/customer-portal/documents/${docCustBId}`)
        .set('Cookie', custACookie);

      expect(foreignAccessRes.status).toBe(403);
      expect(foreignAccessRes.body.error.message).toContain('Access denied');
    });

    it('enforces RBAC on unauthorized employee attempting document review', async () => {
      // Login an employee with unauthorized role / lacking 'document:review' permission
      const { cookie, csrfToken } = await loginEmployee(staffUserIdA, UserRole.SALES_EXECUTIVE, ['lead:read']);
      const docId = new Types.ObjectId();

      const res = await request(app)
        .post(`/api/v1/documents/${docId}/review`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          reviewStatus: DocumentReviewStatus.ACCEPTED
        });

      // Lacks 'document:review' permission
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
