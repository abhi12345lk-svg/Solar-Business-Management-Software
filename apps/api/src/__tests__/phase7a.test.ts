/**
 * INS Solar Business Management Software — Phase 7A Integration Tests
 *
 * Comprehensive test suite for Net Metering & Subsidy Tracking:
 * - Net Metering application creation & atomic sequence generation (NMA-YYYY-NNNNN)
 * - Cross-project customer reference rejection
 * - Missing/rejected document blocking rules for READY_TO_SUBMIT
 * - Permitted status transitions & document completeness gate
 * - DISCOM field inspection scheduling & deduplicated reminders
 * - Inspection outcome recording (PASSED / FAILED)
 * - Meter installation prerequisites (inspection passed & approved)
 * - Subsidy application creation with integer paise amounts & SUB-YYYY-NNNNN sequence
 * - Subsidy sanction invariant (approved <= requested)
 * - Partial and full disbursement ledger tracking with idempotency protection
 * - Prevention of disbursement exceeding approved amount
 * - Customer portal isolation & access boundaries
 * - 401 Unauthorized guards on secured endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  SubsidyStatus,
  SubsidyScheme,
  DisbursementMode,
  ApplicationDocumentType,
  ApplicationDocumentStatus,
  UserRole
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Project } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { NetMeteringApplication } from '../models/NetMeteringApplication.js';
import { SubsidyApplication } from '../models/SubsidyApplication.js';
import { NetMeteringService } from '../services/netMeteringService.js';
import { SubsidyService } from '../services/subsidyService.js';
import { NotificationReminderService } from '../services/notificationReminderService.js';

describe('Phase 7A Integration: Net Metering & Subsidy Tracking', () => {
  let app: any;
  const adminUser = { userId: new Types.ObjectId().toString(), role: UserRole.ADMIN };
  const sampleProjectId = new Types.ObjectId().toString();
  const sampleCustomerId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
    NotificationReminderService.clearRegistry();
    app = createApp();
  });

  // --------------------------------------------------------------------------
  // 1. Net Metering Application Creation & Atomic Sequence Generation
  // --------------------------------------------------------------------------
  it('creates a net metering application with atomic sequence (NMA-YYYY-NNNNN) and default required documents', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001',
      customerId: new Types.ObjectId(sampleCustomerId),
      systemCapacityKw: 6.0
    };

    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      customerCode: 'CUST-2026-00001',
      name: 'Ramesh Patel'
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(NetMeteringApplication.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const application = await NetMeteringService.createApplication(
      {
        projectId: sampleProjectId,
        discomName: 'MSEDCL',
        division: 'Pune East',
        subdivision: 'Hadapsar',
        consumerNumber: '012345678901',
        sanctionedLoadKw: 7.0,
        proposedCapacityKw: 6.0,
        notes: 'Initial solar net metering filing'
      },
      adminUser
    );

    expect(application.applicationNumber).toMatch(/^NMA-\d{4}-\d{5}$/);
    expect(application.status).toBe(NetMeteringStatus.DRAFT);
    expect(application.discomName).toBe('MSEDCL');
    expect(application.consumerNumber).toBe('012345678901');
    expect(application.documents.length).toBe(5);

    const electricityDoc = application.documents.find(
      d => d.documentType === ApplicationDocumentType.ELECTRICITY_BILL
    );
    expect(electricityDoc).toBeDefined();
    expect(electricityDoc!.isRequired).toBe(true);
    expect(electricityDoc!.status).toBe(ApplicationDocumentStatus.REQUIRED);
  });

  // --------------------------------------------------------------------------
  // 2. Reject Cross-Project Customer References
  // --------------------------------------------------------------------------
  it('strictly rejects cross-project customer mismatch during application creation', async () => {
    const intruderCustomerId = new Types.ObjectId().toString();
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId) // Bound to sampleCustomerId
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);

    await expect(
      NetMeteringService.createApplication(
        {
          projectId: sampleProjectId,
          customerId: intruderCustomerId, // Mismatched customer ID
          discomName: 'BESCOM',
          consumerNumber: '9988776655'
        },
        adminUser
      )
    ).rejects.toThrow(/does not match the project's customer/);
  });

  // --------------------------------------------------------------------------
  // 3. Document Verification Gate: Block Transition to READY_TO_SUBMIT
  // --------------------------------------------------------------------------
  it('blocks transition to READY_TO_SUBMIT when required documents are missing or rejected', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      status: NetMeteringStatus.DRAFT,
      documents: [
        {
          id: 'doc-1',
          documentType: ApplicationDocumentType.ELECTRICITY_BILL,
          title: 'Electricity Bill',
          isRequired: true,
          status: ApplicationDocumentStatus.REQUIRED, // NOT uploaded
          storageKey: undefined
        },
        {
          id: 'doc-2',
          documentType: ApplicationDocumentType.SOLAR_SLD,
          title: 'Solar SLD',
          isRequired: true,
          status: ApplicationDocumentStatus.REJECTED, // REJECTED
          storageKey: 'evidence/sld.pdf'
        }
      ],
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    await expect(
      NetMeteringService.transitionStatus(
        mockApplication._id.toString(),
        {
          status: NetMeteringStatus.READY_TO_SUBMIT
        },
        adminUser
      )
    ).rejects.toThrow(/Required documents are missing or rejected/);
  });

  // --------------------------------------------------------------------------
  // 4. Permitted Status Transitions with Uploaded Documents
  // --------------------------------------------------------------------------
  it('allows transition to READY_TO_SUBMIT when all required documents are uploaded or accepted', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      status: NetMeteringStatus.DOCUMENTS_PENDING,
      documents: [
        {
          id: 'doc-1',
          documentType: ApplicationDocumentType.ELECTRICITY_BILL,
          title: 'Electricity Bill',
          isRequired: true,
          status: ApplicationDocumentStatus.ACCEPTED,
          storageKey: 'evidence/bill.pdf'
        },
        {
          id: 'doc-2',
          documentType: ApplicationDocumentType.SOLAR_SLD,
          title: 'Solar SLD',
          isRequired: true,
          status: ApplicationDocumentStatus.UPLOADED,
          storageKey: 'evidence/sld.pdf'
        }
      ],
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    const updated = await NetMeteringService.transitionStatus(
      mockApplication._id.toString(),
      {
        status: NetMeteringStatus.READY_TO_SUBMIT,
        notes: 'All documents verified'
      },
      adminUser
    );

    expect(updated.status).toBe(NetMeteringStatus.READY_TO_SUBMIT);
    expect(mockApplication.save).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 5. DISCOM Inspection Scheduling & Deduplicated Reminders
  // --------------------------------------------------------------------------
  it('schedules DISCOM field inspection and registers deduplicated reminder', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      consumerNumber: '012345678901',
      status: NetMeteringStatus.SUBMITTED,
      inspectionSchedule: {
        outcome: NetMeteringInspectionOutcome.PENDING
      },
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    const inspectionDate = new Date('2026-11-15T10:00:00Z');
    const updated = await NetMeteringService.scheduleInspection(
      mockApplication._id.toString(),
      {
        scheduledDate: inspectionDate,
        officerName: 'Mr. Arvind Shinde',
        officerContact: '+919876543210',
        notes: 'Customer notified to keep main switch accessible'
      },
      adminUser
    );

    expect(updated.status).toBe(NetMeteringStatus.INSPECTION_SCHEDULED);
    expect(updated.inspectionSchedule.officerName).toBe('Mr. Arvind Shinde');

    // Verify reminder deduplication
    const reminders = NotificationReminderService.getRemindersForEntity(
      'NetMeteringApplication',
      mockApplication._id.toString()
    );
    expect(reminders.length).toBe(1);
    expect(reminders[0]!.payload.reminderType).toBe('UPCOMING_INSPECTION');
    expect(reminders[0]!.status).toBe('SIMULATED_LOG_ONLY');

    // Attempting duplicate scheduling for same date does not create redundant reminder
    await NotificationReminderService.scheduleOrSendReminder({
      reminderType: 'UPCOMING_INSPECTION',
      entityType: 'NetMeteringApplication',
      entityId: mockApplication._id.toString(),
      subject: 'Duplicate attempt',
      message: 'Duplicate test',
      scheduledFor: inspectionDate
    });

    const dedupedReminders = NotificationReminderService.getRemindersForEntity(
      'NetMeteringApplication',
      mockApplication._id.toString()
    );
    expect(dedupedReminders.length).toBe(1); // Deduped!
  });

  // --------------------------------------------------------------------------
  // 6. Inspection Outcome Recording (PASSED / FAILED)
  // --------------------------------------------------------------------------
  it('records inspection outcome and advances status to APPROVED when PASSED', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      status: NetMeteringStatus.INSPECTION_SCHEDULED,
      inspectionSchedule: {
        scheduledDate: new Date('2026-11-15T10:00:00Z'),
        outcome: NetMeteringInspectionOutcome.PENDING
      },
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    const updated = await NetMeteringService.recordInspectionOutcome(
      mockApplication._id.toString(),
      {
        outcome: NetMeteringInspectionOutcome.PASSED,
        officerName: 'Mr. Arvind Shinde',
        notes: 'All safety standards and earth resistance below 2 ohms verified'
      },
      adminUser
    );

    expect(updated.status).toBe(NetMeteringStatus.APPROVED);
    expect(updated.inspectionSchedule.outcome).toBe(NetMeteringInspectionOutcome.PASSED);
    expect(updated.approvalDate).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 7. Meter Installation Gate: Prevents Installation Before Inspection Passes
  // --------------------------------------------------------------------------
  it('prevents meter installation before inspection has PASSED and application is APPROVED', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      status: NetMeteringStatus.INSPECTION_SCHEDULED,
      inspectionSchedule: {
        outcome: NetMeteringInspectionOutcome.PENDING // Still pending!
      },
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    await expect(
      NetMeteringService.recordMeterInstallation(
        mockApplication._id.toString(),
        {
          meterNumber: 'MTR-DISCOM-998877',
          installationDate: new Date()
        },
        adminUser
      )
    ).rejects.toThrow(/Cannot record bi-directional meter installation before inspection has PASSED/);
  });

  // --------------------------------------------------------------------------
  // 8. Meter Installation Recording
  // --------------------------------------------------------------------------
  it('records bi-directional meter installation and initial readings when approved', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'NMA-2026-00001',
      status: NetMeteringStatus.APPROVED,
      inspectionSchedule: {
        outcome: NetMeteringInspectionOutcome.PASSED
      },
      meterInstallation: {
        meterInstalled: false
      },
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(NetMeteringApplication, 'findById').mockResolvedValue(mockApplication);

    const updated = await NetMeteringService.recordMeterInstallation(
      mockApplication._id.toString(),
      {
        meterNumber: 'MTR-L&T-2026-001',
        installationDate: new Date('2026-11-20T11:00:00Z'),
        initialImportReadingKwh: 120.5,
        initialExportReadingKwh: 0.0,
        testedBy: 'V. Kadam'
      },
      adminUser
    );

    expect(updated.meterInstallation.meterInstalled).toBe(true);
    expect(updated.meterInstallation.meterNumber).toBe('MTR-L&T-2026-001');
    expect(updated.meterInstallation.initialImportReadingKwh).toBe(120.5);
  });

  // --------------------------------------------------------------------------
  // 9. Subsidy Application Creation & Integer Paise Rigor
  // --------------------------------------------------------------------------
  it('creates a Subsidy application with atomic sequence (SUB-YYYY-NNNNN) and integer paise amounts', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };
    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      name: 'Sunita Sharma'
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(SubsidyApplication.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const application = await SubsidyService.createApplication(
      {
        projectId: sampleProjectId,
        schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
        systemCapacityKw: 3.0,
        estimatedAmountPaise: 7800000, // ₹78,000.00
        requestedAmountPaise: 7800000,
        portalApplicationNumber: 'PMSG-2026-004455'
      },
      adminUser
    );

    expect(application.applicationNumber).toMatch(/^SUB-\d{4}-\d{5}$/);
    expect(application.status).toBe(SubsidyStatus.ELIGIBLE);
    expect(application.estimatedAmountPaise).toBe(7800000);
    expect(application.requestedAmountPaise).toBe(7800000);
    expect(application.approvedAmountPaise).toBe(0);
    expect(application.disbursedAmountPaise).toBe(0);
    expect(application.documents.length).toBe(5);
  });

  // --------------------------------------------------------------------------
  // 10. Subsidy Sanction & Amount Invariant (approved <= requested)
  // --------------------------------------------------------------------------
  it('records subsidy sanction and rejects if approved amount exceeds requested amount', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'SUB-2026-00001',
      requestedAmountPaise: 7800000, // ₹78,000 max requested
      approvedAmountPaise: 0,
      status: SubsidyStatus.CLAIM_SUBMITTED,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(SubsidyApplication, 'findById').mockResolvedValue(mockApplication);

    // Violation: Approved exceeds requested
    await expect(
      SubsidyService.recordSanction(
        mockApplication._id.toString(),
        {
          sanctionReference: 'SANC-2026-MNRE-01',
          sanctionDate: new Date('2026-11-25T10:00:00Z'),
          approvedAmountPaise: 8000000 // ₹80,000 > ₹78,000
        },
        adminUser
      )
    ).rejects.toThrow(/cannot exceed requested amount/);

    // Valid sanction <= requested
    const sanctioned = await SubsidyService.recordSanction(
      mockApplication._id.toString(),
      {
        sanctionReference: 'SANC-2026-MNRE-01',
        sanctionDate: new Date('2026-11-25T10:00:00Z'),
        approvedAmountPaise: 7800000
      },
      adminUser
    );

    expect(sanctioned.status).toBe(SubsidyStatus.SANCTIONED);
    expect(sanctioned.approvedAmountPaise).toBe(7800000);
    expect(sanctioned.sanctionReference).toBe('SANC-2026-MNRE-01');
  });

  // --------------------------------------------------------------------------
  // 11. Partial & Full Disbursement Ledger with Monotonic Balance Protection
  // --------------------------------------------------------------------------
  it('records partial disbursement and prevents total disbursement exceeding approved balance', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'SUB-2026-00001',
      requestedAmountPaise: 7800000,
      approvedAmountPaise: 7800000,
      disbursedAmountPaise: 0,
      status: SubsidyStatus.SANCTIONED,
      disbursements: [],
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(SubsidyApplication, 'findById').mockResolvedValue(mockApplication);

    // Partial disbursement 1: ₹30,000
    const partialApp = await SubsidyService.recordDisbursement(
      mockApplication._id.toString(),
      {
        disbursementReference: 'UTR202611250001',
        amountPaise: 3000000, // ₹30,000
        disbursedAt: new Date('2026-11-25T12:00:00Z'),
        paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
        recipientAccount: 'SBI-XXXX9901',
        idempotencyKey: 'IDEMP-TRANCHE-1'
      },
      adminUser
    );

    expect(partialApp.status).toBe(SubsidyStatus.PARTIALLY_DISBURSED);
    expect(partialApp.disbursedAmountPaise).toBe(3000000);
    expect(partialApp.disbursements.length).toBe(1);

    // Violation: Attempting second tranche of ₹50,000 (total ₹80,000 > ₹78,000 approved)
    await expect(
      SubsidyService.recordDisbursement(
        mockApplication._id.toString(),
        {
          disbursementReference: 'UTR202611250002',
          amountPaise: 5000000, // ₹50,000 exceeds ₹48,000 remaining
          disbursedAt: new Date('2026-11-26T12:00:00Z'),
          paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
          recipientAccount: 'SBI-XXXX9901',
          idempotencyKey: 'IDEMP-TRANCHE-2-EXCESS'
        },
        adminUser
      )
    ).rejects.toThrow(/exceeds remaining approved balance/);

    // Valid remaining tranche: ₹48,000 -> sets FULLY_DISBURSED
    const fullyDisbursedApp = await SubsidyService.recordDisbursement(
      mockApplication._id.toString(),
      {
        disbursementReference: 'UTR202611250003',
        amountPaise: 4800000, // Exactly remaining ₹48,000
        disbursedAt: new Date('2026-11-26T12:00:00Z'),
        paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
        recipientAccount: 'SBI-XXXX9901',
        idempotencyKey: 'IDEMP-TRANCHE-2-EXACT'
      },
      adminUser
    );

    expect(fullyDisbursedApp.status).toBe(SubsidyStatus.FULLY_DISBURSED);
    expect(fullyDisbursedApp.disbursedAmountPaise).toBe(7800000);
    expect(fullyDisbursedApp.disbursements.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 12. Duplicate Disbursement Prevention (Idempotency Key & UTR)
  // --------------------------------------------------------------------------
  it('detects and rejects duplicate disbursement attempts with same idempotencyKey or UTR', async () => {
    const mockApplication: any = {
      _id: new Types.ObjectId(),
      applicationNumber: 'SUB-2026-00001',
      approvedAmountPaise: 7800000,
      disbursedAmountPaise: 3000000,
      status: SubsidyStatus.PARTIALLY_DISBURSED,
      disbursements: [
        {
          disbursementId: 'disb-1',
          disbursementReference: 'UTR202611250001',
          amountPaise: 3000000,
          idempotencyKey: 'IDEMP-TRANCHE-1'
        }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(SubsidyApplication, 'findById').mockResolvedValue(mockApplication);

    // Same idempotency key
    await expect(
      SubsidyService.recordDisbursement(
        mockApplication._id.toString(),
        {
          disbursementReference: 'UTR202611250099',
          amountPaise: 1000000,
          disbursedAt: new Date(),
          paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
          recipientAccount: 'SBI-XXXX9901',
          idempotencyKey: 'IDEMP-TRANCHE-1' // Duplicate!
        },
        adminUser
      )
    ).rejects.toThrow(/Duplicate disbursement detected/);

    // Same UTR
    await expect(
      SubsidyService.recordDisbursement(
        mockApplication._id.toString(),
        {
          disbursementReference: 'UTR202611250001', // Duplicate UTR!
          amountPaise: 1000000,
          disbursedAt: new Date(),
          paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
          recipientAccount: 'SBI-XXXX9901',
          idempotencyKey: 'IDEMP-TRANCHE-UNIQUE'
        },
        adminUser
      )
    ).rejects.toThrow(/Duplicate disbursement detected/);
  });

  // --------------------------------------------------------------------------
  // 13. Customer Multi-Tenant Isolation
  // --------------------------------------------------------------------------
  it('enforces customer multi-tenant isolation and rejects access to foreign customer documents', async () => {
    const ownerCustomerId = new Types.ObjectId().toString();
    const intruderCustomerId = new Types.ObjectId().toString();

    const mockApplication: any = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(ownerCustomerId),
      documents: [
        {
          id: 'doc-secret',
          documentType: ApplicationDocumentType.BANK_PASSBOOK_CANCELLED_CHEQUE,
          storageKey: 'evidence/subsidies/private-cheque.pdf'
        }
      ]
    };

    vi.spyOn(SubsidyApplication, 'findById').mockResolvedValue(mockApplication);

    await expect(
      SubsidyService.getAuthorizedDocumentAccess(
        mockApplication._id.toString(),
        'doc-secret',
        { customerId: intruderCustomerId } // Foreign customer
      )
    ).rejects.toThrow(/Access denied: You may only access documents for your own subsidy applications/);
  });

  // --------------------------------------------------------------------------
  // 14. 401 Rejection for Unauthenticated Endpoints
  // --------------------------------------------------------------------------
  it('returns 401 Unauthorized when accessing net-metering or subsidy routes without authentication', async () => {
    const res1 = await request(app).get('/api/v1/net-metering');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/v1/subsidies');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get(`/api/v1/net-metering/${sampleProjectId}`);
    expect(res3.status).toBe(401);

    const res4 = await request(app).get(`/api/v1/subsidies/${sampleProjectId}`);
    expect(res4.status).toBe(401);
  });
});
