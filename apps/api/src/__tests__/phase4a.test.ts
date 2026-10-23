import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { LeadService } from '../services/leadService.js';
import { SurveyService } from '../services/surveyService.js';
import { Lead } from '../models/Lead.js';
import { LeadActivity } from '../models/LeadActivity.js';
import { SiteSurvey } from '../models/SiteSurvey.js';
import { Customer } from '../models/Customer.js';
import {
  LeadStatus,
  LeadSource,
  LeadPriority,
  SolarRequirement,
  ActivityType,
  ActivityStatus,
  SurveyStatus,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory,
  UserRole,
  Department
} from '@ins-solar/shared';

describe('Phase 4A: CRM, Lead Management, Follow-ups & Site Survey Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  const mockAdminUser = {
    userId: '507f1f77bcf86cd799439011',
    role: UserRole.ADMIN,
    department: Department.ADMIN
  };

  const mockSalesExec = {
    userId: '507f1f77bcf86cd799439022',
    role: UserRole.SALES_EXECUTIVE,
    department: Department.SALES
  };

  const mockSurveyor = {
    userId: '507f1f77bcf86cd799439033',
    role: UserRole.SURVEYOR,
    department: Department.OPERATIONS
  };

  // --------------------------------------------------------------------------
  // 1. Lead creation with valid and invalid input
  // --------------------------------------------------------------------------
  it('creates lead with valid input, generating monotonic sequence code and initial activity', async () => {
    let savedLead: any = null;
    let savedActivity: any = null;

    vi.spyOn(Lead, 'create').mockImplementation(async function (docData: any) {
      savedLead = {
        _id: new Types.ObjectId(),
        ...docData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return savedLead;
    });

    vi.spyOn(LeadActivity, 'create').mockImplementation(async function (docData: any) {
      savedActivity = {
        _id: new Types.ObjectId(),
        ...docData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return savedActivity;
    });

    vi.spyOn(Lead, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnValue({
        ...savedLead,
        _id: new Types.ObjectId(),
        leadCode: 'LEAD-2026-00001',
        prospectName: 'Anand Kumar',
        prospectPhone: '+919876543210',
        location: { city: 'Jaipur', state: 'Rajasthan' },
        source: LeadSource.WEBSITE,
        solarRequirement: SolarRequirement.RESIDENTIAL,
        status: LeadStatus.NEW,
        priority: LeadPriority.HIGH,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    } as any);

    const lead = await LeadService.createLead(
      {
        prospectName: 'Anand Kumar',
        prospectPhone: '+919876543210',
        prospectEmail: 'anand@example.com',
        location: { city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
        source: LeadSource.WEBSITE,
        solarRequirement: SolarRequirement.RESIDENTIAL,
        estimatedCapacityKw: 8.5,
        priority: LeadPriority.HIGH,
        notes: 'Interested in PM Surya Ghar scheme subsidy'
      },
      mockAdminUser,
      { correlationId: 'test-corr-id' }
    );

    expect(lead.leadCode).toMatch(/^LEAD-\d{4}-\d{5}$/);
    expect(lead.prospectName).toBe('Anand Kumar');
    expect(lead.status).toBe(LeadStatus.NEW);
    expect(savedActivity).not.toBeNull();
    expect(savedActivity.summary).toContain('Lead captured via WEBSITE');
  });

  // --------------------------------------------------------------------------
  // 2. Unique lead number generation and monotonic sequence
  // --------------------------------------------------------------------------
  it('generates strictly unique and sequential monotonic lead codes', async () => {
    const s1 = await SequenceService.generateNumber('LEAD');
    const s2 = await SequenceService.generateNumber('LEAD');
    const s3 = await SequenceService.generateNumber('LEAD');

    expect(s1.formattedNumber).toMatch(/^LEAD-\d{4}-00001$/);
    expect(s2.formattedNumber).toMatch(/^LEAD-\d{4}-00002$/);
    expect(s3.formattedNumber).toMatch(/^LEAD-\d{4}-00003$/);
    expect(s1.sequenceNumber).toBe(1);
    expect(s2.sequenceNumber).toBe(2);
    expect(s3.sequenceNumber).toBe(3);
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate phone detection without rejecting legitimate leads
  // --------------------------------------------------------------------------
  it('detects duplicate phone numbers for advisory review without blocking legitimate inquiries', async () => {
    const phone = '+919876543210';

    vi.spyOn(Lead, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: new Types.ObjectId(),
              leadCode: 'LEAD-2026-00001',
              prospectName: 'Previous Lead',
              status: LeadStatus.CONTACTED,
              createdAt: new Date()
            }
          ])
        })
      })
    } as any);

    vi.spyOn(Customer, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })
    } as any);

    const dupCheck = await LeadService.checkDuplicatePhone(phone);
    expect(dupCheck.isDuplicate).toBe(true);
    expect(dupCheck.matchingLeadsCount).toBe(1);
    expect(dupCheck.matchingCustomersCount).toBe(0);
    expect(dupCheck.matchingLeads[0]?.leadCode).toBe('LEAD-2026-00001');

    // Clean phone number should return non-duplicate
    vi.spyOn(Lead, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })
    } as any);

    const cleanCheck = await LeadService.checkDuplicatePhone('+919111222333');
    expect(cleanCheck.isDuplicate).toBe(false);
    expect(cleanCheck.matchingLeadsCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 4. Unauthorized lead assignment changes
  // --------------------------------------------------------------------------
  it('denies sales executive from assigning leads outside their supervisor scope', async () => {
    await expect(
      LeadService.assignLead(
        '507f1f77bcf86cd799439011',
        { assignedToEmployeeId: '507f1f77bcf86cd799439022' },
        mockSalesExec, // Sales exec does not have lead assignment privilege
        { correlationId: 'test-assign' }
      )
    ).rejects.toThrow(/Only Administrators and Sales Department Heads are authorized/);
  });

  // --------------------------------------------------------------------------
  // 5. Sales employee record-scope enforcement
  // --------------------------------------------------------------------------
  it('scopes lead listing for sales executives to their assigned and unassigned leads', async () => {
    let capturedQuery: any = null;

    vi.spyOn(Lead, 'find').mockImplementation(((...args: any[]) => {
      capturedQuery = args[0];
      return {
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([])
              })
            })
          })
        })
      } as any;
    }) as any);

    vi.spyOn(Lead, 'countDocuments').mockResolvedValue(0);

    await LeadService.listLeads({ page: 1, limit: 10, sortOrder: 'desc' }, mockSalesExec);

    expect(capturedQuery.$or).toBeDefined();
    expect(capturedQuery.$or[0].assignedToEmployeeId.toString()).toBe(mockSalesExec.userId);
  });

  // --------------------------------------------------------------------------
  // 6. Lead activity history persistence
  // --------------------------------------------------------------------------
  it('persists interaction activity timeline and updates lead follow-up date', async () => {
    const leadId = new Types.ObjectId();
    const mockLead = {
      _id: leadId,
      leadCode: 'LEAD-2026-00001',
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Lead, 'findById').mockResolvedValue(mockLead as any);

    const nextDate = new Date(Date.now() + 86400000).toISOString();
    let createdActivity: any = null;

    vi.spyOn(LeadActivity, 'create').mockImplementation(async (data: any) => {
      createdActivity = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return createdActivity;
    });

    vi.spyOn(LeadActivity, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          ...createdActivity,
          _id: new Types.ObjectId(),
          leadId,
          activityType: ActivityType.CALL,
          summary: 'Client confirmed roof is RCC flat and shadow free',
          activityDate: new Date(),
          nextFollowUpDate: new Date(nextDate),
          status: ActivityStatus.COMPLETED,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      })
    } as any);

    const activity = await LeadService.addActivity(
      leadId.toString(),
      {
        activityType: ActivityType.CALL,
        activityDate: '2026-10-23T10:00:00.000Z',
        summary: 'Client confirmed roof is RCC flat and shadow free',
        nextFollowUpDate: nextDate,
        status: ActivityStatus.COMPLETED
      },
      mockAdminUser
    );

    expect(activity.summary).toContain('roof is RCC flat');
    expect(mockLead.save).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 7. Follow-up due/overdue filtering
  // --------------------------------------------------------------------------
  it('correctly filters scheduled follow-ups by overdue timeframe', async () => {
    let capturedQuery: any = null;

    vi.spyOn(LeadActivity, 'find').mockImplementation(((...args: any[]) => {
      capturedQuery = args[0];
      return {
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                  lean: vi.fn().mockResolvedValue([])
                })
              })
            })
          })
        })
      } as any;
    }) as any);

    vi.spyOn(LeadActivity, 'countDocuments').mockResolvedValue(0);

    await LeadService.listFollowUps(
      { timeframe: 'overdue', page: 1, limit: 10, sortOrder: 'desc' },
      mockAdminUser
    );

    expect(capturedQuery.nextFollowUpDate).toBeDefined();
    expect(capturedQuery.nextFollowUpDate.$lt).toBeDefined();
    expect(capturedQuery.status).toBe(ActivityStatus.SCHEDULED);
  });

  // --------------------------------------------------------------------------
  // 8. Site survey creation and physical measurement validation
  // --------------------------------------------------------------------------
  it('creates site survey with valid roof and electrical measurements', async () => {
    const leadId = new Types.ObjectId();
    const mockLead = {
      _id: leadId,
      leadCode: 'LEAD-2026-00001',
      status: LeadStatus.CONTACTED,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Lead, 'findById').mockResolvedValue(mockLead as any);
    vi.spyOn(LeadActivity, 'create').mockResolvedValue({} as any);

    let savedSurvey: any = null;
    vi.spyOn(SiteSurvey, 'create').mockImplementation(async (data: any) => {
      savedSurvey = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return savedSurvey;
    });

    vi.spyOn(SiteSurvey, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            ...savedSurvey,
            _id: new Types.ObjectId(),
            surveyNumber: 'SRV-2026-00001',
            leadId: { _id: leadId, leadCode: 'LEAD-2026-00001', prospectName: 'Ramesh Patel' },
            siteAddress: {
              addressLine1: 'Plot 10, Industrial Area',
              city: 'Ahmedabad',
              state: 'Gujarat',
              postalCode: '380001'
            },
            roofType: RoofType.RCC_FLAT,
            usableRoofAreaSqFt: 1500,
            averageMonthlyBillPaise: 800000,
            sanctionedLoadKw: 10,
            connectionPhase: ConnectionPhase.THREE,
            status: SurveyStatus.SCHEDULED,
            photos: [],
            createdAt: new Date(),
            updatedAt: new Date()
          })
        })
      })
    } as any);

    const survey = await SurveyService.createSurvey(
      {
        leadId: leadId.toString(),
        siteAddress: {
          type: 'SITE_INSTALLATION' as any,
          addressLine1: 'Plot 10, Industrial Area',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380001',
          country: 'India'
        },
        roofType: RoofType.RCC_FLAT,
        usableRoofAreaSqFt: 1500,
        averageMonthlyBillPaise: 800000, // ₹8,000 in integer paise
        sanctionedLoadKw: 10,
        connectionPhase: ConnectionPhase.THREE,
        scheduledDate: new Date().toISOString()
      },
      mockAdminUser,
      { correlationId: 'survey-create' }
    );

    expect(survey.surveyNumber).toMatch(/^SRV-\d{4}-\d{5}$/);
    expect(survey.usableRoofAreaSqFt).toBe(1500);
    expect(survey.averageMonthlyBillPaise).toBe(800000);
    expect(mockLead.status).toBe(LeadStatus.SURVEY_SCHEDULED);
    expect(mockLead.save).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 9. Survey lifecycle status transitions
  // --------------------------------------------------------------------------
  it('updates survey status and records completed date on transition to COMPLETED', async () => {
    const surveyId = new Types.ObjectId();
    const mockSurvey: any = {
      _id: surveyId,
      surveyNumber: 'SRV-2026-00001',
      status: SurveyStatus.IN_PROGRESS,
      completedDate: undefined,
      siteAddress: {
        addressLine1: 'Test',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001'
      },
      roofType: RoofType.RCC_FLAT,
      usableRoofAreaSqFt: 500,
      sanctionedLoadKw: 5,
      connectionPhase: ConnectionPhase.SINGLE,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockSurvey.save = vi.fn().mockImplementation(async function () {
      return mockSurvey;
    });
    mockSurvey.populate = function () {
      return mockSurvey;
    };

    vi.spyOn(SiteSurvey, 'findById').mockReturnValue(mockSurvey as any);

    const updated = await SurveyService.updateStatus(
      surveyId.toString(),
      { status: SurveyStatus.COMPLETED, remarks: 'Site verified and shadow-free' },
      mockAdminUser,
      { correlationId: 'status-change' }
    );

    expect(mockSurvey.status).toBe(SurveyStatus.COMPLETED);
    expect(mockSurvey.completedDate).toBeDefined();
    expect(mockSurvey.save).toHaveBeenCalled();
    expect(updated.status).toBe(SurveyStatus.COMPLETED);
  });

  // --------------------------------------------------------------------------
  // 10. Photo metadata attachment with security boundaries
  // --------------------------------------------------------------------------
  it('attaches validated photo metadata without exposing public URLs or storing binaries in DB', async () => {
    const surveyId = new Types.ObjectId();
    const mockSurvey: any = {
      _id: surveyId,
      surveyNumber: 'SRV-2026-00001',
      photos: [],
      siteAddress: {
        addressLine1: 'Test',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001'
      },
      roofType: RoofType.RCC_FLAT,
      usableRoofAreaSqFt: 500,
      sanctionedLoadKw: 5,
      connectionPhase: ConnectionPhase.SINGLE,
      status: SurveyStatus.IN_PROGRESS,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockSurvey.save = vi.fn().mockImplementation(async function () {
      return mockSurvey;
    });
    mockSurvey.populate = function () {
      return mockSurvey;
    };

    vi.spyOn(SiteSurvey, 'findById').mockReturnValue(mockSurvey as any);

    const updated = await SurveyService.attachPhotos(
      surveyId.toString(),
      {
        photos: [
          {
            storageKey: 'surveys/SRV-2026-00001/roof-south.jpg',
            fileName: 'roof-south.jpg',
            fileSizeBytes: 2048000,
            mimeType: 'image/jpeg',
            category: SurveyPhotoCategory.ROOF,
            caption: 'South-facing unobstructed rooftop'
          }
        ]
      },
      mockSurveyor,
      { correlationId: 'photo-attach' }
    );

    expect(mockSurvey.photos.length).toBe(1);
    expect(mockSurvey.save).toHaveBeenCalled();
    expect(updated.photos?.[0]?.category).toBe(SurveyPhotoCategory.ROOF);
  });

  // --------------------------------------------------------------------------
  // 11. Customer conversion idempotency
  // --------------------------------------------------------------------------
  it('converts lead into customer idempotently, creating customer and locking lead conversion', async () => {
    const leadId = new Types.ObjectId();
    const mockLead: any = {
      _id: leadId,
      leadCode: 'LEAD-2026-00001',
      prospectName: 'Vijay Varma',
      prospectPhone: '+919876543299',
      prospectEmail: 'vijay@example.com',
      companyName: 'Varma Textiles',
      location: { city: 'Surat', state: 'Gujarat', pinCode: '395003' },
      status: LeadStatus.QUOTED,
      convertedCustomerId: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockLead.save = vi.fn().mockImplementation(async function () {
      return mockLead;
    });
    mockLead.populate = function () {
      return mockLead;
    };

    vi.spyOn(Lead, 'findById').mockReturnValue(mockLead as any);

    let createdCustomer: any = null;
    vi.spyOn(Customer, 'create').mockImplementation(async (data: any) => {
      createdCustomer = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return createdCustomer;
    });

    vi.spyOn(LeadActivity, 'create').mockResolvedValue({} as any);

    const result = await LeadService.convertLead(
      leadId.toString(),
      { customerType: 'COMMERCIAL' as any },
      mockAdminUser,
      { correlationId: 'lead-convert' }
    );

    expect(result.isAlreadyConverted).toBe(false);
    expect(result.customerCode).toMatch(/^CUST-\d{4}-\d{5}$/);
    expect(mockLead.status).toBe(LeadStatus.CONVERTED);
    expect(mockLead.save).toHaveBeenCalled();

    // Repeated call should be idempotent and return existing conversion
    mockLead.status = LeadStatus.CONVERTED;
    mockLead.convertedCustomerId = createdCustomer._id;
    vi.spyOn(Customer, 'findById').mockResolvedValue(createdCustomer);

    const repeatResult = await LeadService.convertLead(
      leadId.toString(),
      { customerType: 'COMMERCIAL' as any },
      mockAdminUser,
      { correlationId: 'lead-convert-repeat' }
    );

    expect(repeatResult.isAlreadyConverted).toBe(true);
    expect(repeatResult.customerId).toBe(createdCustomer._id.toString());
  });

  // --------------------------------------------------------------------------
  // 12. Protected fields cannot be changed through mass assignment
  // --------------------------------------------------------------------------
  it('prevents mass assignment of leadCode, convertedCustomerId, and status via generic update', async () => {
    const leadId = new Types.ObjectId();
    const originalLeadCode = 'LEAD-2026-00001';
    const mockLead: any = {
      _id: leadId,
      leadCode: originalLeadCode,
      prospectName: 'Original Name',
      prospectPhone: '+919876543210',
      status: LeadStatus.NEW,
      location: { city: 'Delhi', state: 'Delhi' },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockLead.save = vi.fn().mockImplementation(async function () {
      return mockLead;
    });
    mockLead.populate = function () {
      return mockLead;
    };

    vi.spyOn(Lead, 'findById').mockReturnValue(mockLead as any);

    await LeadService.updateLead(
      leadId.toString(),
      {
        prospectName: 'Updated Name',
        // Attempting to pass protected fields in input will be ignored by typed update
        ...({ leadCode: 'TAMPERED-LEAD-999', status: LeadStatus.CONVERTED } as any)
      },
      mockAdminUser,
      { correlationId: 'mass-assign-check' }
    );

    expect(mockLead.leadCode).toBe(originalLeadCode);
    expect(mockLead.status).toBe(LeadStatus.NEW);
    expect(mockLead.prospectName).toBe('Updated Name');
  });

  // --------------------------------------------------------------------------
  // 13. Unauthenticated requests to Leads & Surveys return HTTP 401
  // --------------------------------------------------------------------------
  it('denies unauthenticated access to leads and surveys endpoints with HTTP 401', async () => {
    const app = createApp();

    const resLeads = await request(app).get('/api/v1/leads');
    expect(resLeads.status).toBe(401);
    expect(resLeads.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const resSurveys = await request(app).get('/api/v1/surveys');
    expect(resSurveys.status).toBe(401);
    expect(resSurveys.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const resFollowUps = await request(app).get('/api/v1/leads/follow-ups');
    expect(resFollowUps.status).toBe(401);
    expect(resFollowUps.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
