import { describe, it, expect } from 'vitest';
import {
  SequenceEntityType,
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  SubsidyScheme,
  SubsidyStatus,
  DisbursementMode,
  ApplicationDocumentType,
  ApplicationDocumentStatus,
  AuditAction,
  UserRole,
  ROLE_DEFAULT_PERMISSIONS,
  createNetMeteringSchema,
  updateNetMeteringStatusSchema,
  scheduleInspectionSchema,
  recordInspectionOutcomeSchema,
  recordMeterInstallationSchema,
  updateFeasibilityDemandNoteSchema,
  uploadApplicationDocumentSchema,
  reviewApplicationDocumentSchema,
  createSubsidySchema,
  recordSanctionSchema,
  recordDisbursementSchema
} from '../index.js';

describe('Phase 7A: Shared Enums and Permissions', () => {
  it('should have NET_METERING and SUBSIDY sequence entity types', () => {
    expect(SequenceEntityType.NET_METERING).toBe('NET_METERING');
    expect(SequenceEntityType.SUBSIDY).toBe('SUBSIDY');
  });

  it('should define Net Metering and Subsidy lifecycle statuses', () => {
    expect(NetMeteringStatus.DRAFT).toBe('DRAFT');
    expect(NetMeteringStatus.READY_TO_SUBMIT).toBe('READY_TO_SUBMIT');
    expect(NetMeteringStatus.SUBMITTED).toBe('SUBMITTED');
    expect(NetMeteringStatus.INSPECTION_SCHEDULED).toBe('INSPECTION_SCHEDULED');
    expect(NetMeteringStatus.APPROVED).toBe('APPROVED');
    expect(NetMeteringStatus.REJECTED).toBe('REJECTED');

    expect(SubsidyStatus.ELIGIBLE).toBe('ELIGIBLE');
    expect(SubsidyStatus.DOCUMENTS_PENDING).toBe('DOCUMENTS_PENDING');
    expect(SubsidyStatus.APPLIED).toBe('APPLIED');
    expect(SubsidyStatus.SANCTIONED).toBe('SANCTIONED');
    expect(SubsidyStatus.PARTIALLY_DISBURSED).toBe('PARTIALLY_DISBURSED');
    expect(SubsidyStatus.FULLY_DISBURSED).toBe('FULLY_DISBURSED');
  });

  it('should define document types, document statuses, and disbursement modes', () => {
    expect(ApplicationDocumentType.ELECTRICITY_BILL).toBe('ELECTRICITY_BILL');
    expect(ApplicationDocumentType.BANK_PASSBOOK_CANCELLED_CHEQUE).toBe('BANK_PASSBOOK_CANCELLED_CHEQUE');
    expect(ApplicationDocumentType.SOLAR_SLD).toBe('SOLAR_SLD');

    expect(ApplicationDocumentStatus.REQUIRED).toBe('REQUIRED');
    expect(ApplicationDocumentStatus.ACCEPTED).toBe('ACCEPTED');
    expect(ApplicationDocumentStatus.REJECTED).toBe('REJECTED');

    expect(DisbursementMode.DIRECT_BENEFIT_TRANSFER).toBe('DIRECT_BENEFIT_TRANSFER');
    expect(DisbursementMode.VENDOR_ACCOUNT).toBe('VENDOR_ACCOUNT');
  });

  it('should define audit actions for net metering and subsidy lifecycle', () => {
    expect(AuditAction.NET_METERING_CREATED).toBe('NET_METERING_CREATED');
    expect(AuditAction.NET_METERING_INSPECTION_SCHEDULED).toBe('NET_METERING_INSPECTION_SCHEDULED');
    expect(AuditAction.NET_METERING_METER_INSTALLED).toBe('NET_METERING_METER_INSTALLED');
    expect(AuditAction.SUBSIDY_APPLICATION_CREATED).toBe('SUBSIDY_APPLICATION_CREATED');
    expect(AuditAction.SUBSIDY_DISBURSEMENT_RECORDED).toBe('SUBSIDY_DISBURSEMENT_RECORDED');
  });

  it('should configure RBAC default permissions for Net Metering and Subsidy', () => {
    const deptHeadPerms = ROLE_DEFAULT_PERMISSIONS[UserRole.DEPARTMENT_HEAD];
    expect(deptHeadPerms).toContain('net_metering:create');
    expect(deptHeadPerms).toContain('net_metering:update');
    expect(deptHeadPerms).toContain('subsidy:create');
    expect(deptHeadPerms).toContain('subsidy:disburse');

    const accountsPerms = ROLE_DEFAULT_PERMISSIONS[UserRole.ACCOUNTS_OFFICER];
    expect(accountsPerms).toContain('subsidy:read');
    expect(accountsPerms).toContain('subsidy:disburse');

    const crewPerms = ROLE_DEFAULT_PERMISSIONS[UserRole.INSTALLATION_CREW];
    expect(crewPerms).toContain('net_metering:read');
    expect(crewPerms).toContain('net_metering:update');
  });
});

describe('Phase 7A: Net Metering Zod Schemas', () => {
  const validProjectId = '507f1f77bcf86cd799439011';
  const validCustomerId = '507f1f77bcf86cd799439012';

  it('should validate valid Net Metering application creation input', () => {
    const input = {
      projectId: validProjectId,
      customerId: validCustomerId,
      discomName: 'MSEDCL',
      division: 'Pune East',
      subdivision: 'Hadapsar',
      consumerNumber: '012345678901',
      sanctionedLoadKw: 5.0,
      proposedCapacityKw: 4.5,
      notes: 'Initial application for residential rooftop'
    };

    const parsed = createNetMeteringSchema.parse(input);
    expect(parsed.discomName).toBe('MSEDCL');
    expect(parsed.consumerNumber).toBe('012345678901');
    expect(parsed.proposedCapacityKw).toBe(4.5);
  });

  it('should reject invalid Net Metering input with missing discom or invalid ObjectId', () => {
    expect(() =>
      createNetMeteringSchema.parse({
        projectId: 'invalid-id',
        discomName: 'M',
        consumerNumber: '1'
      })
    ).toThrow();
  });

  it('should validate status change payload', () => {
    const input = {
      status: NetMeteringStatus.SUBMITTED,
      notes: 'Submitted on online DISCOM portal',
      reason: 'Standard workflow advance'
    };
    const parsed = updateNetMeteringStatusSchema.parse(input);
    expect(parsed.status).toBe(NetMeteringStatus.SUBMITTED);
    expect(parsed.notes).toBe('Submitted on online DISCOM portal');
  });

  it('should validate inspection scheduling and outcomes', () => {
    const scheduleInput = {
      scheduledDate: new Date('2026-11-01T10:00:00Z'),
      officerName: 'Mr. R. Sharma',
      officerContact: '+919876543210',
      notes: 'Site readiness confirmed'
    };
    const parsedSchedule = scheduleInspectionSchema.parse(scheduleInput);
    expect(parsedSchedule.officerName).toBe('Mr. R. Sharma');

    const outcomeInput = {
      outcome: NetMeteringInspectionOutcome.PASSED,
      inspectedDate: new Date('2026-11-01T11:30:00Z'),
      notes: 'Earthing and SLD verified without discrepancies'
    };
    const parsedOutcome = recordInspectionOutcomeSchema.parse(outcomeInput);
    expect(parsedOutcome.outcome).toBe(NetMeteringInspectionOutcome.PASSED);

    expect(() =>
      recordInspectionOutcomeSchema.parse({
        outcome: 'UNKNOWN'
      })
    ).toThrow();
  });

  it('should validate bi-directional meter installation and reading', () => {
    const meterInput = {
      meterNumber: 'MTR-987654321',
      installationDate: new Date('2026-11-05T09:00:00Z'),
      initialImportReadingKwh: 0,
      initialExportReadingKwh: 0,
      testedBy: 'A. Verma'
    };
    const parsed = recordMeterInstallationSchema.parse(meterInput);
    expect(parsed.meterNumber).toBe('MTR-987654321');
    expect(parsed.initialImportReadingKwh).toBe(0);

    expect(() =>
      recordMeterInstallationSchema.parse({
        meterNumber: '',
        installationDate: new Date()
      })
    ).toThrow();
  });

  it('should validate feasibility and demand note in integer paise', () => {
    const input = {
      isFeasible: true,
      feasibilityReference: 'FEAS-2026-99',
      demandNoteAmountPaise: 450000, // Rs. 4,500.00
      demandNotePaid: true,
      demandNoteReceiptNumber: 'RCPT-1234'
    };
    const parsed = updateFeasibilityDemandNoteSchema.parse(input);
    expect(parsed.demandNoteAmountPaise).toBe(450000);

    expect(() =>
      updateFeasibilityDemandNoteSchema.parse({
        demandNoteAmountPaise: -100
      })
    ).toThrow();
  });

  it('should validate document upload and review schemas', () => {
    const uploadInput = {
      documentType: ApplicationDocumentType.ELECTRICITY_BILL,
      title: 'Latest Electricity Bill Oct 2026',
      storageKey: 'evidence/documents/net-metering/proj1/bill.pdf',
      fileName: 'bill.pdf',
      fileSize: 1024 * 500,
      mimeType: 'application/pdf'
    };
    const parsedUpload = uploadApplicationDocumentSchema.parse(uploadInput);
    expect(parsedUpload.storageKey).toBe('evidence/documents/net-metering/proj1/bill.pdf');

    const reviewInput = {
      status: ApplicationDocumentStatus.ACCEPTED,
      reviewNotes: 'Verified consumer number and sanctioned load'
    };
    const parsedReview = reviewApplicationDocumentSchema.parse(reviewInput);
    expect(parsedReview.status).toBe(ApplicationDocumentStatus.ACCEPTED);
  });
});

describe('Phase 7A: Subsidy Zod Schemas', () => {
  const validProjectId = '507f1f77bcf86cd799439011';

  it('should validate valid Subsidy application creation with integer paise amounts', () => {
    const input = {
      projectId: validProjectId,
      schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
      schemeVersion: 'v2024.1',
      systemCapacityKw: 3.0,
      estimatedAmountPaise: 7800000, // Rs. 78,000
      requestedAmountPaise: 7800000,
      portalApplicationNumber: 'PMSG-2026-987654'
    };
    const parsed = createSubsidySchema.parse(input);
    expect(parsed.estimatedAmountPaise).toBe(7800000);
    expect(parsed.requestedAmountPaise).toBe(7800000);
    expect(parsed.systemCapacityKw).toBe(3.0);
  });

  it('should reject negative amounts or non-integer amounts in Subsidy', () => {
    expect(() =>
      createSubsidySchema.parse({
        projectId: validProjectId,
        schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
        systemCapacityKw: 3.0,
        estimatedAmountPaise: -5000,
        requestedAmountPaise: 7800000
      })
    ).toThrow();

    expect(() =>
      createSubsidySchema.parse({
        projectId: validProjectId,
        schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
        systemCapacityKw: 3.0,
        estimatedAmountPaise: 78000.5,
        requestedAmountPaise: 7800000
      })
    ).toThrow();
  });

  it('should validate sanction record input', () => {
    const input = {
      sanctionReference: 'SANC-MNRE-2026-88',
      sanctionDate: new Date('2026-11-10T10:00:00Z'),
      approvedAmountPaise: 7800000,
      notes: 'Approved under rooftop category'
    };
    const parsed = recordSanctionSchema.parse(input);
    expect(parsed.approvedAmountPaise).toBe(7800000);
    expect(parsed.sanctionReference).toBe('SANC-MNRE-2026-88');
  });

  it('should validate disbursement record with idempotency key and strictly positive integer paise', () => {
    const input = {
      disbursementReference: 'UTR2026112000012345',
      amountPaise: 7800000,
      disbursedAt: new Date('2026-11-20T12:00:00Z'),
      paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
      recipientAccount: 'SBI-XXXXX9876',
      idempotencyKey: 'IDEMP-DISB-SUB-2026-00001-1',
      notes: 'Direct DBT subsidy credited to customer bank account'
    };
    const parsed = recordDisbursementSchema.parse(input);
    expect(parsed.disbursementReference).toBe('UTR2026112000012345');
    expect(parsed.amountPaise).toBe(7800000);
    expect(parsed.idempotencyKey).toBe('IDEMP-DISB-SUB-2026-00001-1');

    expect(() =>
      recordDisbursementSchema.parse({
        ...input,
        amountPaise: 0
      })
    ).toThrow();

    expect(() =>
      recordDisbursementSchema.parse({
        ...input,
        idempotencyKey: ''
      })
    ).toThrow();
  });
});
