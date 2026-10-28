/**
 * INS Solar Business Management Software — Phase 7B Integration Tests
 *
 * Comprehensive test suite for Service, Warranty, AMC & Service Visits:
 * - Service complaint creation with atomic sequence generation (CMP-YYYY-NNNNN)
 * - Cross-project customer reference validation
 * - Validated complaint state machine (OPEN -> TRIAGED -> ASSIGNED -> VISIT_SCHEDULED -> IN_PROGRESS -> RESOLVED -> CLOSED)
 * - Reopen complaint workflow with audit reason
 * - Customer portal isolation and internal notes confidentiality
 * - Hardware serial warranty tracking & dynamic status calculation
 * - Warranty claim submission with atomic sequence (CLM-YYYY-NNNNN)
 * - Duplicate active claim prevention and claim approval/rejection decisions
 * - AMC creation with integer paise amounts, validation & AMC-YYYY-NNNNN sequence
 * - Overlapping active AMC prevention for same project/equipment
 * - AMC approval and atomic included-visit consumption (within quota vs chargeable over-consumption)
 * - AMC renewal chaining with predecessor/successor linking
 * - Service visit scheduling with atomic sequence (VIS-YYYY-NNNNN)
 * - Service visit rescheduling, cancellation, and execution completion
 * - Follow-up / revisit linking
 * - Honest notification reminder delivery status (SIMULATED_LOG_ONLY)
 * - 401 Unauthorized guards on secured endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintSource,
  WarrantyStatus,
  WarrantyClaimStatus,
  WarrantyClaimResolution,
  AmcPlanType,
  AmcStatus,
  AmcVisitCadence,
  AmcBillingCadence,
  ServiceVisitType,
  ServiceVisitStatus,
  UserRole,
  ProjectPriority
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Project } from '../models/Project.js';
import { Customer } from '../models/Customer.js';
import { User } from '../models/User.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { ServiceComplaint } from '../models/ServiceComplaint.js';
import { WarrantyClaim } from '../models/WarrantyClaim.js';
import { AnnualMaintenanceContract } from '../models/AnnualMaintenanceContract.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { ServiceComplaintService } from '../services/serviceComplaintService.js';
import { WarrantyService } from '../services/warrantyService.js';
import { AmcService } from '../services/amcService.js';
import { ServiceVisitService } from '../services/serviceVisitService.js';
import { NotificationReminderService } from '../services/notificationReminderService.js';

describe('Phase 7B Integration: Service, Warranty, AMC & Service Visits', () => {
  let app: any;
  const adminUser = { userId: new Types.ObjectId().toString(), role: UserRole.ADMIN };
  const technicianUserId = new Types.ObjectId().toString();
  const technicianUser = { userId: technicianUserId, role: UserRole.SERVICE_TECHNICIAN };
  const sampleProjectId = new Types.ObjectId().toString();
  const sampleCustomerId = new Types.ObjectId().toString();
  const foreignCustomerId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
    NotificationReminderService.clearRegistry();
    app = createApp();

    // Default User mock so services querying actor or technician resolve promptly
    vi.spyOn(User, 'findById').mockImplementation(((id: any) => {
      const uId = id?._id || id;
      return Promise.resolve({
        _id: new Types.ObjectId(uId?.toString() || undefined),
        firstName: 'Ravi',
        lastName: 'Kumar',
        email: 'ravi.kumar@inssolar.com',
        role: UserRole.SERVICE_TECHNICIAN,
        isActive: true
      } as any);
    }) as any);

    // Default Customer mock
    vi.spyOn(Customer, 'findById').mockImplementation(((id: any) => {
      return Promise.resolve({
        _id: new Types.ObjectId(id?.toString() || sampleCustomerId),
        customerCode: 'CUST-2026-00001',
        name: 'Aditi Sharma',
        primaryPhone: '9876543210',
        email: 'aditi.sharma@example.com'
      } as any);
    }) as any);

    // Default mocks to prevent unmocked findOne queries from buffering
    vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null);
    vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(null);
  });

  // --------------------------------------------------------------------------
  // 1. Service Complaint Creation & Atomic Sequence Generation
  // --------------------------------------------------------------------------
  it('creates a service complaint with atomic sequence (CMP-YYYY-NNNNN) and validated defaults', async () => {
    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      customerCode: 'CUST-2026-00001',
      name: 'Aditi Sharma'
    };
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001',
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(ServiceComplaint.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const complaint = await ServiceComplaintService.createComplaint(
      {
        customerId: sampleCustomerId,
        projectId: sampleProjectId,
        title: 'Inverter Grid Synchronization Failure',
        description:
          'Red fault LED blinking continuously and zero generation recorded on mobile app.',
        category: ComplaintCategory.INVERTER_FAULT,
        priority: ProjectPriority.HIGH,
        severity: ComplaintSeverity.MAJOR,
        source: ComplaintSource.CUSTOMER_PORTAL,
        preferredVisitTime: 'Morning (9 AM - 12 PM)',
        contactPreference: 'PHONE'
      },
      { customerId: sampleCustomerId }
    );

    expect(complaint.complaintNumber).toMatch(/^CMP-\d{4}-\d{5}$/);
    expect(complaint.status).toBe(ComplaintStatus.OPEN);
    expect(complaint.category).toBe(ComplaintCategory.INVERTER_FAULT);
    expect(complaint.severity).toBe(ComplaintSeverity.MAJOR);
    expect(complaint.statusHistory.length).toBe(1);
    expect(complaint.statusHistory?.[0]?.status).toBe(ComplaintStatus.OPEN);
  });

  // --------------------------------------------------------------------------
  // 2. Cross-Project Customer Reference Validation
  // --------------------------------------------------------------------------
  it('rejects complaint creation when project does not belong to the customer', async () => {
    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      name: 'Aditi Sharma'
    };
    const foreignProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(foreignCustomerId) // Mismatched customer!
    };

    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(foreignProject as any);

    await expect(
      ServiceComplaintService.createComplaint(
        {
          customerId: sampleCustomerId,
          projectId: sampleProjectId,
          title: 'Panel hot spot observed',
          description: 'Visible burn mark on panel #4',
          category: ComplaintCategory.PHYSICAL_DAMAGE,
          priority: ProjectPriority.MEDIUM,
          severity: ComplaintSeverity.MAJOR,
          source: ComplaintSource.INTERNAL_STAFF
        },
        adminUser
      )
    ).rejects.toThrow(/does not match the provided customer ID/);
  });

  // --------------------------------------------------------------------------
  // 3. Complaint Lifecycle State Machine & Reopening
  // --------------------------------------------------------------------------
  it('enforces complaint status transition rules and allows reopening from resolved state', async () => {
    const complaintDoc: any = {
      _id: new Types.ObjectId(),
      complaintNumber: 'CMP-2026-00001',
      customerId: new Types.ObjectId(sampleCustomerId),
      projectId: new Types.ObjectId(sampleProjectId),
      status: ComplaintStatus.OPEN,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(ServiceComplaint, 'findById').mockResolvedValue(complaintDoc);

    // Triage complaint
    const triaged = await ServiceComplaintService.updateStatus(
      complaintDoc._id.toString(),
      ComplaintStatus.TRIAGED,
      { notes: 'Initial remote diagnostics performed; firmware reboot failed.' },
      adminUser
    );
    expect(triaged.status).toBe(ComplaintStatus.TRIAGED);

    // Assign technician
    const assigned = await ServiceComplaintService.assignTechnician(
      complaintDoc._id.toString(),
      technicianUserId,
      'Dispatching field engineer for on-site diagnosis.',
      adminUser
    );
    expect(assigned.status).toBe(ComplaintStatus.ASSIGNED);
    expect(assigned.assignedTechnicianId?.toString()).toBe(technicianUserId);

    // Resolving requires resolution summary
    assigned.status = ComplaintStatus.IN_PROGRESS;
    const resolved = await ServiceComplaintService.updateStatus(
      complaintDoc._id.toString(),
      ComplaintStatus.RESOLVED,
      {
        notes: 'Inverter DC isolator replaced and generation restored to 5.2 kW.',
        resolutionSummary: 'Replaced DC switch and verified MPPT tracking voltage.'
      },
      adminUser
    );
    expect(resolved.status).toBe(ComplaintStatus.RESOLVED);
    expect(resolved.resolutionSummary).toBeDefined();

    // Reopening with audit reason
    const reopened = await ServiceComplaintService.reopenComplaint(
      complaintDoc._id.toString(),
      'Issue re-occurred next morning after sunrise.',
      adminUser
    );
    expect(reopened.status).toBe(ComplaintStatus.REOPENED);
    expect(reopened.reopenReason).toBe('Issue re-occurred next morning after sunrise.');
  });

  // --------------------------------------------------------------------------
  // 4. Customer Portal Isolation & Internal Notes Confidentiality
  // --------------------------------------------------------------------------
  it('hides internal confidential notes from customer portal views and prevents cross-customer access', async () => {
    const ownerCustomerId = new Types.ObjectId().toString();
    const intruderCustomerId = new Types.ObjectId().toString();

    const mockComplaint: any = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(ownerCustomerId),
      complaintNumber: 'CMP-2026-00002',
      title: 'Generation lower than benchmark',
      status: ComplaintStatus.IN_PROGRESS,
      customerUpdates: [
        { message: 'Technician visit scheduled for tomorrow 10am', timestamp: new Date() }
      ],
      internalNotes: [
        {
          note: 'Customer called 5 times aggressively; warranty expired on panels.',
          timestamp: new Date()
        }
      ]
    };

    const mockChainable = {
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockComplaint)
    };

    vi.spyOn(ServiceComplaint, 'findById').mockReturnValue(mockChainable as any);

    // Intruder customer cannot view
    await expect(
      ServiceComplaintService.getComplaintById(mockComplaint._id.toString(), {
        isCustomer: true,
        customerId: intruderCustomerId
      })
    ).rejects.toThrow(/Access denied: You cannot view another customer's complaint/);

    // Legitimate customer views complaint -> internalNotes stripped
    const visibleData = await ServiceComplaintService.getComplaintById(
      mockComplaint._id.toString(),
      {
        isCustomer: true,
        customerId: ownerCustomerId
      }
    );
    expect(visibleData.internalNotes).toBeUndefined();
    expect(visibleData.customerUpdates.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 5. Hardware Warranty Tracking & Expiry Determination
  // --------------------------------------------------------------------------
  it('correctly determines warranty status based on actual commissioning dates and warranty periods', async () => {
    const activeSerialNumber: any = {
      _id: new Types.ObjectId(),
      serialNumber: 'INV-SOLAX-2026-9901',
      warrantyStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      warrantyEndDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000), // 335 days left
      supplierWarrantyReference: 'SOLAX-5YR-STD'
    };

    const expiredSerialNumber: any = {
      _id: new Types.ObjectId(),
      serialNumber: 'INV-SOLAX-2020-0012',
      warrantyStartDate: new Date('2020-01-01'),
      warrantyEndDate: new Date('2025-01-01'), // Expired
      supplierWarrantyReference: 'SOLAX-5YR-STD'
    };

    const activeStatus = WarrantyService.calculateWarrantyStatus(activeSerialNumber);
    expect(activeStatus).toBe(WarrantyStatus.ACTIVE);

    const expiredStatus = WarrantyService.calculateWarrantyStatus(expiredSerialNumber);
    expect(expiredStatus).toBe(WarrantyStatus.EXPIRED);
  });

  // --------------------------------------------------------------------------
  // 6. Warranty Claim Submission & Rejection/Approval Outcomes
  // --------------------------------------------------------------------------
  it('submits warranty claims with CLM sequence and enforces decision recording rules', async () => {
    const mockProductId = new Types.ObjectId();
    const mockSerial: any = {
      _id: new Types.ObjectId(),
      serialNumber: 'SOL-MOD-400W-8812',
      productId: mockProductId,
      projectId: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId),
      warrantyStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      warrantyEndDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      supplierWarrantyReference: 'TIER1-MFG-WAR',
      save: vi.fn().mockResolvedValue(true)
    };

    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(mockSerial);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(WarrantyClaim, 'findOne').mockResolvedValue(null); // No existing pending claim
    vi.spyOn(WarrantyClaim.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    // 1. Submit claim
    const claim = await WarrantyService.submitClaim(
      {
        serialNumber: mockSerial.serialNumber,
        productId: mockProductId.toString(),
        projectId: sampleProjectId,
        customerId: sampleCustomerId,
        manufacturerName: 'Tier1 Solar',
        issueDescription: 'Internal bypass diode short circuited causing hot spot.'
      },
      adminUser
    );

    expect(claim.claimNumber).toMatch(/^CLM-\d{4}-\d{5}$/);
    expect(claim.status).toBe(WarrantyClaimStatus.SUBMITTED);

    // 2. Reject claim with reason
    const claimId = new Types.ObjectId();
    const claimDoc: any = {
      _id: claimId,
      claimNumber: 'CLM-2026-00001',
      serialNumber: mockSerial.serialNumber,
      status: WarrantyClaimStatus.SUBMITTED,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue(claimDoc);

    const rejected = await WarrantyService.decideClaim(
      claimDoc._id.toString(),
      {
        status: WarrantyClaimStatus.REJECTED,
        decisionNotes:
          'Physical mechanical impact damage observed on glass surface; not covered under warranty.',
        resolutionType: WarrantyClaimResolution.REJECTED
      },
      adminUser
    );

    expect(rejected.status).toBe(WarrantyClaimStatus.REJECTED);
    expect(rejected.statusHistory?.[0]?.notes).toContain('Physical mechanical impact damage');
  });

  // --------------------------------------------------------------------------
  // 7. Duplicate Claim Prevention on Same Serial Number
  // --------------------------------------------------------------------------
  it('prevents filing duplicate warranty claims for an item with an existing pending claim', async () => {
    const mockSerial: any = {
      _id: new Types.ObjectId(),
      serialNumber: 'SOL-MOD-400W-8812',
      productId: new Types.ObjectId(),
      projectId: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId),
      warrantyStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      warrantyEndDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000)
    };

    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(ProductSerialNumber, 'findOne').mockResolvedValue(mockSerial);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(WarrantyClaim, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      claimNumber: 'CLM-2026-00001',
      status: WarrantyClaimStatus.UNDER_REVIEW
    } as any);

    await expect(
      WarrantyService.submitClaim(
        {
          serialNumber: mockSerial.serialNumber,
          productId: mockSerial.productId.toString(),
          projectId: sampleProjectId,
          customerId: sampleCustomerId,
          manufacturerName: 'Tier1 Solar',
          issueDescription: 'Duplicate claim submission attempt'
        },
        adminUser
      )
    ).rejects.toThrow(/already in progress/);
  });

  // --------------------------------------------------------------------------
  // 8. AMC Management: Integer Paise, Overlap Prevention & Approval
  // --------------------------------------------------------------------------
  it('creates AMC with atomic sequence, rejects overlapping active contracts and processes approval', async () => {
    const mockCustomer = { _id: new Types.ObjectId(sampleCustomerId) };
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null); // No overlap
    vi.spyOn(AnnualMaintenanceContract.prototype, 'save').mockImplementation(async function (
      this: any
    ) {
      this._id = new Types.ObjectId();
      return this;
    });

    const startDate = new Date('2026-04-01');
    const endDate = new Date('2027-03-31');

    // Create AMC proposal
    const amc = await AmcService.createAmc(
      {
        projectId: sampleProjectId,
        customerId: sampleCustomerId,
        planType: AmcPlanType.COMPREHENSIVE,
        capacityKwp: 5.5,
        startDate,
        endDate,
        contractAmountPaise: 2500000, // ₹25,000 integer paise
        visitCadence: AmcVisitCadence.QUARTERLY,
        includedVisits: 4,
        billingCadence: AmcBillingCadence.ANNUAL,
        scopeOfWork: 'Includes 4 quarterly deep-cleaning & thermography inspections.'
      },
      adminUser
    );

    expect(amc.amcNumber).toMatch(/^AMC-\d{4}-\d{5}$/);
    expect(amc.status).toBe(AmcStatus.DRAFT);
    expect(amc.contractAmountPaise).toBe(2500000);
    expect(amc.includedVisits).toBe(4);
    expect(amc.consumedVisits).toBe(0);

    // Overlapping contract rejection test
    vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      amcNumber: amc.amcNumber,
      status: AmcStatus.ACTIVE
    } as any);

    await expect(
      AmcService.createAmc(
        {
          projectId: sampleProjectId,
          customerId: sampleCustomerId,
          planType: AmcPlanType.COMPREHENSIVE,
          capacityKwp: 5.5,
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          contractAmountPaise: 1500000,
          visitCadence: AmcVisitCadence.SEMI_ANNUAL,
          includedVisits: 2
        },
        adminUser
      )
    ).rejects.toThrow(/already covers this project/);

    // Approval workflow
    vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null);
    const amcDoc: any = {
      ...amc,
      _id: new Types.ObjectId(),
      status: AmcStatus.PENDING_APPROVAL,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(amcDoc);

    const approved = await AmcService.approveAmc(
      amcDoc._id.toString(),
      'Approved as per annual commercial rate chart.',
      adminUser
    );
    expect(approved.status).toBe(AmcStatus.ACTIVE);
    expect(approved.approvedBy).toBeDefined();
    expect(approved.approvedAt).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 9. AMC Atomic Visit Quota Deduction & Over-Quota Tracking
  // --------------------------------------------------------------------------
  it('deducts AMC included visits atomically and flags visits exceeding quota as chargeable', async () => {
    // 1. Within quota consumption
    const mockAmcWithinQuota: any = {
      _id: new Types.ObjectId(),
      amcNumber: 'AMC-2026-00001',
      includedVisits: 4,
      consumedVisits: 2,
      chargeableVisits: 0,
      status: AmcStatus.ACTIVE
    };

    vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(mockAmcWithinQuota);
    vi.spyOn(AnnualMaintenanceContract, 'findOneAndUpdate').mockResolvedValue({
      ...mockAmcWithinQuota,
      consumedVisits: 3,
      chargeableVisits: 0
    });

    const quotaResult = await AmcService.consumeVisit(mockAmcWithinQuota._id.toString());
    expect(quotaResult.isChargeable).toBe(false);
    expect(quotaResult.consumedVisits).toBe(3);

    // 2. Over quota consumption: includedVisits = 4, consumedVisits = 4
    const mockAmcExhausted: any = {
      _id: new Types.ObjectId(),
      amcNumber: 'AMC-2026-00001',
      includedVisits: 4,
      consumedVisits: 4,
      chargeableVisits: 0,
      status: AmcStatus.ACTIVE
    };

    vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(mockAmcExhausted);
    vi.spyOn(AnnualMaintenanceContract, 'findOneAndUpdate')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...mockAmcExhausted,
        chargeableVisits: 1
      });

    const overQuotaResult = await AmcService.consumeVisit(mockAmcExhausted._id.toString());
    expect(overQuotaResult.isChargeable).toBe(true);
    expect(overQuotaResult.chargeableVisits).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 10. AMC Contract Renewal Chaining
  // --------------------------------------------------------------------------
  it('chains renewed AMC contracts by linking predecessor and successor contract references', async () => {
    const originalContract: any = {
      _id: new Types.ObjectId(),
      amcNumber: 'AMC-2025-00001',
      customerId: new Types.ObjectId(sampleCustomerId),
      projectId: new Types.ObjectId(sampleProjectId),
      planType: AmcPlanType.COMPREHENSIVE,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      contractAmountPaise: 2400000,
      includedVisits: 4,
      consumedVisits: 4,
      status: AmcStatus.ACTIVE,
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(AnnualMaintenanceContract, 'findById').mockResolvedValue(originalContract);
    vi.spyOn(AnnualMaintenanceContract, 'findOne').mockResolvedValue(null);
    vi.spyOn(AnnualMaintenanceContract.prototype, 'save').mockImplementation(async function (
      this: any
    ) {
      this._id = new Types.ObjectId();
      return this;
    });

    const renewal = await AmcService.renewAmc(
      originalContract._id.toString(),
      {
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        contractAmountPaise: 2600000,
        includedVisits: 4
      },
      adminUser
    );

    expect(renewal.amcNumber).toMatch(/^AMC-\d{4}-\d{5}$/);
    expect(renewal.previousAmcId?.toString()).toBe(originalContract._id.toString());
    expect(originalContract.status).toBe(AmcStatus.RENEWED);
    expect(originalContract.successorAmcId?.toString()).toBe(renewal._id.toString());
  });

  // --------------------------------------------------------------------------
  // 11. Service Visit Scheduling, Rescheduling & Execution
  // --------------------------------------------------------------------------
  it('schedules service visits with VIS sequence, supports rescheduling and records execution checklist', async () => {
    const mockCustomer = { _id: new Types.ObjectId(sampleCustomerId) };
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(Customer, 'findById').mockResolvedValue(mockCustomer as any);
    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(ServiceVisit.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const scheduledDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Schedule visit
    const visit = await ServiceVisitService.scheduleVisit(
      {
        customerId: sampleCustomerId,
        projectId: sampleProjectId,
        visitType: ServiceVisitType.BREAK_FIX_COMPLAINT,
        scheduledDate,
        scheduledTimeSlot: '10:00 - 13:00',
        assignedTechnicianId: technicianUserId,
        purpose: 'Inspect inverter DC bus voltage and grounding'
      },
      adminUser
    );

    expect(visit.visitNumber).toMatch(/^VIS-\d{4}-\d{5}$/);
    expect(visit.status).toBe(ServiceVisitStatus.SCHEDULED);
    expect(visit.assignedTechnicianId?.toString()).toBe(technicianUserId);

    // Reschedule visit
    const visitId = new Types.ObjectId();
    const visitDoc: any = {
      _id: visitId,
      visitNumber: 'VIS-2026-00001',
      schedulingHistory: [],
      statusHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(ServiceVisit, 'findById').mockResolvedValue(visitDoc);

    const newDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const rescheduled = await ServiceVisitService.rescheduleVisit(
      visitDoc._id.toString(),
      newDate,
      '14:00 - 17:00',
      'Customer requested afternoon slot due to business hours',
      adminUser
    );

    expect(rescheduled.status).toBe(ServiceVisitStatus.RESCHEDULED);
    expect(rescheduled.rescheduleReason).toContain('Customer requested afternoon slot');
    expect(rescheduled.statusHistory.length).toBe(1);
    expect(rescheduled.statusHistory?.[0]?.reason).toContain('Customer requested afternoon slot');

    // Complete visit
    const completed = await ServiceVisitService.completeVisit(
      visitDoc._id.toString(),
      {
        workPerformed:
          'Re-crimped loose MC4 connector on array string #2 and torqued DC switch terminals.',
        observations: 'Ambient temperature 42C, array open circuit voltage 680V DC within spec.',
        checklist: [
          { item: 'Array Voc verification', status: 'PASSED', notes: '680V DC nominal' },
          { item: 'Ground resistance check', status: 'PASSED', notes: '3.8 Ohms passed' },
          { item: 'Inverter error log download', status: 'PASSED' }
        ],
        partsRequiredOrUsed: [
          { name: 'MC4 Male/Female Connector Pair', quantity: 2, isWarrantyCovered: true }
        ],
        customerFeedback: 'Technician arrived promptly and solved the issue quickly.'
      },
      technicianUser
    );

    expect(completed.status).toBe(ServiceVisitStatus.COMPLETED);
    expect(completed.workPerformed).toContain('Re-crimped loose MC4 connector');
    expect(completed.checklist.length).toBe(3);
    expect(completed.partsRequiredOrUsed?.length).toBe(1);
    expect(completed.completedAt).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 12. Follow-up / Revisit Linking
  // --------------------------------------------------------------------------
  it('links follow-up revisit to original visit when additional on-site work is required', async () => {
    const parentVisitId = new Types.ObjectId();
    const parentVisitDoc: any = {
      _id: parentVisitId,
      visitNumber: 'VIS-2026-00001',
      customerId: new Types.ObjectId(sampleCustomerId),
      projectId: new Types.ObjectId(sampleProjectId),
      status: ServiceVisitStatus.IN_PROGRESS,
      save: vi.fn().mockResolvedValue(true)
    };

    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(sampleCustomerId)
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(ServiceVisit, 'findById').mockResolvedValue(parentVisitDoc);
    vi.spyOn(ServiceVisit.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const revisit = await ServiceVisitService.scheduleVisit(
      {
        customerId: sampleCustomerId,
        projectId: sampleProjectId,
        visitType: ServiceVisitType.BREAK_FIX_COMPLAINT,
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        scheduledTimeSlot: '11:00 - 14:00',
        assignedTechnicianId: technicianUserId,
        purpose: 'Replace SPD module after surge damage',
        revisitRequired: true,
        parentVisitId: parentVisitDoc._id.toString()
      },
      adminUser
    );

    expect(revisit.visitNumber).toMatch(/^VIS-\d{4}-\d{5}$/);
    expect(revisit.parentVisitId?.toString()).toBe(parentVisitDoc._id.toString());
  });

  // --------------------------------------------------------------------------
  // 13. Proactive Reminders & Honest Delivery Status (SIMULATED_LOG_ONLY)
  // --------------------------------------------------------------------------
  it('records honest notification reminder delivery status as SIMULATED_LOG_ONLY and deduplicates keys', async () => {
    const entityId = new Types.ObjectId().toString();

    const reminderResult = await NotificationReminderService.scheduleOrSendReminder({
      recipientEmail: 'tech@inssolar.com',
      entityType: 'ServiceVisit',
      entityId,
      reminderType: 'UPCOMING_SERVICE_VISIT',
      subject: 'Field Visit Scheduled: PRJ-2026-00001',
      message: 'You have a scheduled solar plant service visit tomorrow at 10 AM.',
      scheduledFor: new Date()
    });

    expect(reminderResult.reminderId).toMatch(/^REM-/);
    expect(reminderResult.status).toBe('SIMULATED_LOG_ONLY');

    // Attempting same reminder key is deduplicated returning the same record
    const duplicateReminder = await NotificationReminderService.scheduleOrSendReminder({
      recipientEmail: 'tech@inssolar.com',
      entityType: 'ServiceVisit',
      entityId,
      reminderType: 'UPCOMING_SERVICE_VISIT',
      subject: 'Field Visit Scheduled: PRJ-2026-00001',
      message: 'Duplicate alert',
      scheduledFor: new Date()
    });

    expect(duplicateReminder.reminderId).toBe(reminderResult.reminderId);
  });

  // --------------------------------------------------------------------------
  // 14. 401 Rejection for Unauthenticated Endpoints
  // --------------------------------------------------------------------------
  it('returns 401 Unauthorized when accessing complaints, warranties, amc or service visits without authentication', async () => {
    const res1 = await request(app).get('/api/v1/complaints');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/v1/warranties');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get('/api/v1/amc');
    expect(res3.status).toBe(401);

    const res4 = await request(app).get('/api/v1/service-visits');
    expect(res4.status).toBe(401);

    const res5 = await request(app).get('/api/v1/customer-portal/service/complaints');
    expect(res5.status).toBe(401);
  });
});
