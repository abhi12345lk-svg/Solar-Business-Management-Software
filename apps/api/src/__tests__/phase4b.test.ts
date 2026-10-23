import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { SolarSizingService } from '../services/solarSizingService.js';
import { QuotationService } from '../services/quotationService.js';
import { ProposalCompilerService } from '../services/proposalCompilerService.js';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import {
  SolarTopology,
  QuotationStatus,
  QuotationItemType,
  UserRole,
  Department
} from '@ins-solar/shared';

describe('Phase 4B: Solar Sizing Engine & Quotation Management', () => {
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

  const mockCustomerSession = {
    customerId: '507f1f77bcf86cd799439099',
    identityId: '507f1f77bcf86cd799439088',
    phone: '+919876543210'
  };

  // --------------------------------------------------------------------------
  // 1. Solar sizing formulas and documented assumptions
  // --------------------------------------------------------------------------
  it('calculates on-grid PV array sizing, inverter matching, and generation estimates', () => {
    const result = SolarSizingService.calculateOnGrid({
      topology: SolarTopology.ON_GRID,
      targetCapacityKwp: 10,
      moduleWattageWp: 550,
      peakSunHoursPerDay: 5.0,
      performanceRatioPercent: 75.0,
      targetDcAcRatio: 1.2
    });

    // 10kWp / 550Wp = 18.18 -> 19 panels
    expect(result.panelQuantity).toBe(19);
    // 19 * 550Wp = 10,450 Wp = 10.45 kWp
    expect(result.actualDcCapacityKwp).toBe(10.45);
    // Recommended inverter: 10.45 / 1.2 = 8.71 kW
    expect(result.recommendedInverterKw).toBe(8.71);
    // Daily generation = 10.45 * 5.0 * 0.75 = 39.19 kWh/day
    expect(result.estimatedGeneration.dailyGenerationKwh).toBe(39.19);
    expect(result.estimatedGeneration.annualGenerationKwh).toBe(14304.35);
    expect(result.disclaimer).toContain('Preliminary technical sizing calculation');
  });

  // --------------------------------------------------------------------------
  // 2. Missing/invalid inputs and unsupported equipment combinations
  // --------------------------------------------------------------------------
  it('rejects invalid or missing inputs and flags high DC:AC clipping warning', () => {
    expect(() =>
      SolarSizingService.calculateOnGrid({
        topology: SolarTopology.ON_GRID,
        targetCapacityKwp: -5, // Invalid negative
        moduleWattageWp: 550,
        peakSunHoursPerDay: 4.8,
        performanceRatioPercent: 75
      })
    ).toThrow(/greater than 0 kWp/);

    // Warning for high clipping ratio (> 1.35)
    const clippingResult = SolarSizingService.calculateOnGrid({
      topology: SolarTopology.ON_GRID,
      targetCapacityKwp: 10,
      moduleWattageWp: 550,
      peakSunHoursPerDay: 5.0,
      performanceRatioPercent: 75.0,
      selectedInverterRatedKw: 7.0 // 10.45 kWp / 7 kW = 1.49 DC:AC
    });

    expect(clippingResult.actualDcAcRatio).toBe(1.49);
    expect(clippingResult.warnings.length).toBeGreaterThan(0);
    expect(clippingResult.warnings[0]).toContain('exceeds 1.35');
  });

  // --------------------------------------------------------------------------
  // 3. Topology-specific validation: Off-Grid and Hybrid Sizing
  // --------------------------------------------------------------------------
  it('sizes battery bank (Ah and kWh) and PV coverage for off-grid and hybrid topology', () => {
    const offGrid = SolarSizingService.calculateOffGrid({
      topology: SolarTopology.OFF_GRID,
      dailyEnergyDemandKwh: 20,
      autonomyDays: 2,
      depthOfDischargePercent: 80,
      systemVoltageV: 48,
      moduleWattageWp: 550,
      batteryUnitVoltageV: 48,
      batteryUnitAh: 100,
      peakSunHoursPerDay: 4.8,
      performanceRatioPercent: 75
    });

    // Storage needed: (20 kWh * 2) / 0.8 = 50 kWh
    expect(offGrid.batteryStorage?.requiredStorageKwh).toBe(50);
    // Ah required: (50 * 1000) / 48V = 1041.7 Ah
    expect(offGrid.batteryStorage?.requiredCapacityAh).toBe(1041.7);
    expect(offGrid.batteryStorage?.batteryQuantity).toBe(11);

    const hybrid = SolarSizingService.calculateHybrid({
      topology: SolarTopology.HYBRID,
      gridTieCapacityKwp: 10,
      criticalLoadDemandKwh: 12,
      backupHours: 4,
      depthOfDischargePercent: 80,
      systemVoltageV: 48,
      moduleWattageWp: 550,
      peakSunHoursPerDay: 4.8,
      performanceRatioPercent: 75
    });

    expect(hybrid.batteryStorage?.autonomyDuration).toBe('4 backup hour(s)');
    expect(hybrid.batteryStorage?.requiredStorageKwh).toBe(2.5); // (12/24 * 4) / 0.8 = 2.5 kWh
  });

  // --------------------------------------------------------------------------
  // 4. Money arithmetic, discount calculation, and rounding boundaries
  // --------------------------------------------------------------------------
  it('computes integer paise subtotal, line discounts, GST components, and net total cleanly', () => {
    const items = [
      {
        itemType: QuotationItemType.SOLAR_MODULE,
        description: 'Solar Panels 550Wp',
        quantity: 18,
        unitRatePaise: 1100000, // ₹11,000.00 each = 18 * 11000 = ₹1,98,000.00 = 19800000 Paise
        discountPaise: 800000, // ₹8,000.00 line discount
        gstRateBasisPoints: 1200 // 12% GST = 6% CGST + 6% SGST
      },
      {
        itemType: QuotationItemType.INVERTER,
        description: '10kW Grid-Tie Inverter',
        quantity: 1,
        unitRatePaise: 6500000, // ₹65,000.00 = 6500000 Paise
        discountPaise: 0,
        gstRateBasisPoints: 1800 // 18% GST = 9% CGST + 9% SGST
      }
    ];

    const result = QuotationService.computeFinancials(items, 200000, false); // ₹2,000 extra discount

    // Subtotal = 19800000 + 6500000 = 26300000 Paise (₹2,63,000.00)
    expect(result.subtotalPaise).toBe(26300000);
    // Line discounts = 800000, additional = 200000 -> Total discount = 1000000 Paise (₹10,000.00)
    expect(result.totalDiscountPaise).toBe(1000000);
    // Discount percentage = (1000000 / 26300000) * 100 = 3.8%
    expect(result.discountPercent).toBe(3.8);

    // Intra-state split: CGST + SGST
    expect(result.cgstAmountPaise).toBeGreaterThan(0);
    expect(result.sgstAmountPaise).toBe(result.cgstAmountPaise);
    expect(result.igstAmountPaise).toBe(0);
    expect(result.netTotalPaise).toBe(result.taxableAmountPaise + result.totalTaxAmountPaise);
  });

  // --------------------------------------------------------------------------
  // 5. Configurable tax-profile application and immutable quotation tax snapshots
  // --------------------------------------------------------------------------
  it('applies inter-state IGST profile without splitting into CGST/SGST', () => {
    const items = [
      {
        itemType: QuotationItemType.SOLAR_MODULE,
        description: 'Solar Panels',
        quantity: 10,
        unitRatePaise: 1000000, // ₹1,00,000
        discountPaise: 0,
        gstRateBasisPoints: 1800
      }
    ];

    const intraState = QuotationService.computeFinancials(items, 0, false);
    expect(intraState.cgstAmountPaise).toBe(900000); // 9% of 10000000 = 900000
    expect(intraState.sgstAmountPaise).toBe(900000); // 9% of 10000000 = 900000
    expect(intraState.igstAmountPaise).toBe(0);

    const interState = QuotationService.computeFinancials(items, 0, true);
    expect(interState.cgstAmountPaise).toBe(0);
    expect(interState.sgstAmountPaise).toBe(0);
    expect(interState.igstAmountPaise).toBe(1800000); // 18% of 10000000 = 1800000
    expect(interState.totalTaxAmountPaise).toBe(1800000);
  });

  // --------------------------------------------------------------------------
  // 6. Quotation creation with atomic numbering (QT-YYYY-NNNNN-R0)
  // --------------------------------------------------------------------------
  it('creates initial quotation R0 with unique sequence number and validates customer', async () => {
    const customerId = new Types.ObjectId();
    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: customerId,
      legalName: 'Adani Energy Corp'
    } as any);

    vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
      discountApprovalThresholdPercent: 5.0
    } as any);

    vi.spyOn(Quotation.prototype, 'save').mockResolvedValue(true as any);

    const quote = await QuotationService.createQuotation(
      {
        customerId: customerId.toString(),
        systemTopology: SolarTopology.ON_GRID,
        systemCapacityKwp: 10,
        lineItems: [
          {
            itemType: QuotationItemType.SOLAR_MODULE,
            description: '550Wp Bifacial Solar Panels',
            quantity: 18,
            unit: 'NOS',
            unitRatePaise: 1100000,
            discountPaise: 0,
            gstRateBasisPoints: 1200
          }
        ],
        additionalDiscountPaise: 0,
        termsAndConditions: ['Standard payment terms']
      },
      mockSalesExec
    );

    expect(quote.quotationNumber).toBe('QT-2026-00001');
    expect(quote.revisionNumber).toBe(0);
    expect(quote.fullQuotationCode).toBe('QT-2026-00001-R0');
    expect(quote.isLatestRevision).toBe(true);
    expect(quote.status).toBe(QuotationStatus.DRAFT);
  });

  // --------------------------------------------------------------------------
  // 7. Revision creation without overwriting historical issued revisions
  // --------------------------------------------------------------------------
  it('creates revision R1, marks R0 as revised, and increments full quotation code', async () => {
    const customerId = new Types.ObjectId();
    const mockR0: any = {
      _id: new Types.ObjectId(),
      quotationNumber: 'QT-2026-00001',
      revisionNumber: 0,
      fullQuotationCode: 'QT-2026-00001-R0',
      status: QuotationStatus.SENT,
      isLatestRevision: true,
      customerId,
      systemTopology: SolarTopology.ON_GRID,
      systemCapacityKwp: 10,
      lineItems: [
        {
          itemType: QuotationItemType.SOLAR_MODULE,
          description: '550Wp Panels',
          quantity: 18,
          unit: 'NOS',
          unitRatePaise: 1100000,
          discountPaise: 0,
          gstRateBasisPoints: 1200
        }
      ],
      additionalDiscountPaise: 0,
      taxProfile: { isInterState: false },
      termsAndConditions: ['Standard warranty'],
      paymentMilestones: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockR0);
    vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
      discountApprovalThresholdPercent: 5.0
    } as any);
    vi.spyOn(Quotation.prototype, 'save').mockResolvedValue(true as any);

    const revised = await QuotationService.reviseQuotation(
      mockR0._id.toString(),
      {
        reasonForRevision: 'Customer requested discount negotiation',
        additionalDiscountPaise: 50000 // ₹500
      },
      mockSalesExec
    );

    expect(mockR0.isLatestRevision).toBe(false);
    expect(mockR0.status).toBe(QuotationStatus.REVISED);
    expect(mockR0.save).toHaveBeenCalled();

    expect(revised.revisionNumber).toBe(1);
    expect(revised.fullQuotationCode).toBe('QT-2026-00001-R1');
    expect(revised.isLatestRevision).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Discount threshold enforcement (> 5% triggers PENDING_APPROVAL)
  // --------------------------------------------------------------------------
  it('flags discount approval requirement when discount exceeds configured threshold', async () => {
    const customerId = new Types.ObjectId();
    vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: customerId } as any);
    vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
      discountApprovalThresholdPercent: 5.0
    } as any);
    vi.spyOn(Quotation.prototype, 'save').mockResolvedValue(true as any);

    // 10% discount on ₹1,00,000 subtotal
    const quote = await QuotationService.createQuotation(
      {
        customerId: customerId.toString(),
        systemTopology: SolarTopology.ON_GRID,
        systemCapacityKwp: 5,
        lineItems: [
          {
            itemType: QuotationItemType.SOLAR_MODULE,
            description: 'Solar Panels',
            quantity: 10,
            unit: 'NOS',
            unitRatePaise: 1000000,
            discountPaise: 0,
            gstRateBasisPoints: 1200
          }
        ],
        additionalDiscountPaise: 1000000, // 10% discount (₹10,000 on ₹1,00,000)
        termsAndConditions: ['Standard terms']
      },
      mockSalesExec
    );

    expect(quote.discountPercent).toBe(10);
    expect(quote.requiresDiscountApproval).toBe(true);
    expect(quote.discountApprovalStatus).toBe('PENDING');
    expect(quote.status).toBe(QuotationStatus.PENDING_APPROVAL);
  });

  // --------------------------------------------------------------------------
  // 9. Anti-self-approval enforcement
  // --------------------------------------------------------------------------
  it('prevents creator from approving discounts on their own quotation', async () => {
    const quoteId = new Types.ObjectId();
    const mockQuote: any = {
      _id: quoteId,
      createdBy: new Types.ObjectId(mockSalesExec.userId), // Created by mockSalesExec
      discountApprovalStatus: 'PENDING',
      save: vi.fn()
    };

    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote);

    // mockSalesExec attempts to approve their own quotation
    await expect(
      QuotationService.approveDiscount(
        quoteId.toString(),
        { action: 'APPROVE', remarks: 'Self approval attempt' },
        mockSalesExec
      )
    ).rejects.toThrow(/Anti-Self-Approval Violation/);
  });

  // --------------------------------------------------------------------------
  // 10. Discount approval by authorized supervisor
  // --------------------------------------------------------------------------
  it('permits authorized admin to approve pending discount', async () => {
    const quoteId = new Types.ObjectId();
    const mockQuote: any = {
      _id: quoteId,
      createdBy: new Types.ObjectId(mockSalesExec.userId),
      discountApprovalStatus: 'PENDING',
      discountPercent: 8.5,
      fullQuotationCode: 'QT-2026-00001-R0',
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote);

    const approved = await QuotationService.approveDiscount(
      quoteId.toString(),
      { action: 'APPROVE', remarks: 'Approved for festival discount' },
      mockAdminUser
    );

    expect(approved.isDiscountApproved).toBe(true);
    expect(approved.discountApprovalStatus).toBe('APPROVED');
    expect(approved.status).toBe(QuotationStatus.APPROVED);
    expect(mockQuote.save).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 11. Customer quotation acceptance and record-level isolation
  // --------------------------------------------------------------------------
  it('permits customer to accept quotation and enforces customer isolation', async () => {
    const quoteId = new Types.ObjectId();
    const customerId = new Types.ObjectId(mockCustomerSession.customerId);

    const mockQuote: any = {
      _id: quoteId,
      customerId,
      status: QuotationStatus.SENT,
      validUntil: new Date(Date.now() + 86400000), // Valid tomorrow
      fullQuotationCode: 'QT-2026-00001-R0',
      netTotalPaise: 25000000,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote);

    // Customer A cannot accept Customer B's quotation
    await expect(
      QuotationService.customerDecision(
        quoteId.toString(),
        { action: 'ACCEPT' },
        '507f1f77bcf86cd799439999' // Different customer ID
      )
    ).rejects.toThrow(/Access denied: You cannot review or decide/);

    // True owner accepts
    const accepted = await QuotationService.customerDecision(
      quoteId.toString(),
      { action: 'ACCEPT', notes: 'Approved the proposal' },
      mockCustomerSession.customerId
    );

    expect(accepted.status).toBe(QuotationStatus.ACCEPTED);
    expect(accepted.acceptedAt).toBeDefined();
    expect(mockQuote.save).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 12. Idempotent customer acceptance
  // --------------------------------------------------------------------------
  it('handles duplicate customer acceptance requests safely and idempotently', async () => {
    const quoteId = new Types.ObjectId();
    const customerId = new Types.ObjectId(mockCustomerSession.customerId);

    const mockQuote: any = {
      _id: quoteId,
      customerId,
      status: QuotationStatus.ACCEPTED, // Already accepted
      acceptedAt: new Date(),
      fullQuotationCode: 'QT-2026-00001-R0',
      save: vi.fn()
    };

    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote);

    const retryResult = await QuotationService.customerDecision(
      quoteId.toString(),
      { action: 'ACCEPT' },
      mockCustomerSession.customerId
    );

    expect(retryResult.status).toBe(QuotationStatus.ACCEPTED);
    expect(mockQuote.save).not.toHaveBeenCalled(); // No unnecessary rewrite
  });

  // --------------------------------------------------------------------------
  // 13. Proposal document HTML compilation uses persisted server data
  // --------------------------------------------------------------------------
  it('compiles proposal document HTML containing persisted company and quotation data', async () => {
    const quoteId = new Types.ObjectId();
    const customerId = new Types.ObjectId();

    vi.spyOn(Quotation, 'findById').mockResolvedValue({
      _id: quoteId,
      customerId,
      fullQuotationCode: 'QT-2026-00001-R0',
      systemCapacityKwp: 10.45,
      systemTopology: SolarTopology.ON_GRID,
      subtotalPaise: 26300000,
      totalDiscountPaise: 1000000,
      discountPercent: 3.8,
      taxableAmountPaise: 25300000,
      totalTaxAmountPaise: 3036000,
      cgstAmountPaise: 1518000,
      sgstAmountPaise: 1518000,
      igstAmountPaise: 0,
      netTotalPaise: 28336000,
      status: QuotationStatus.SENT,
      validUntil: new Date('2026-11-20'),
      createdAt: new Date('2026-10-23'),
      taxProfile: { isInterState: false },
      lineItems: [
        {
          description: 'Mono PERC 550Wp Solar Panels',
          sku: 'MOD-550',
          quantity: 19,
          unit: 'NOS',
          unitRatePaise: 1100000,
          taxableAmountPaise: 20900000,
          gstRateBasisPoints: 1200,
          totalAmountPaise: 23408000
        }
      ],
      termsAndConditions: ['30 days validity'],
      paymentMilestones: [{ milestoneName: 'Advance', percentage: 20 }]
    } as any);

    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: customerId,
      legalName: 'Reliance Retail Ltd',
      primaryPhone: '+919876543210'
    } as any);

    vi.spyOn(CompanySettings, 'findOne').mockResolvedValue({
      companyName: 'INS Solar Engineering Pvt Ltd',
      gstin: '24AAACI1234A1Z5'
    } as any);

    const html = await ProposalCompilerService.compileProposalHtml(quoteId.toString());

    expect(html).toContain('QT-2026-00001-R0');
    expect(html).toContain('Reliance Retail Ltd');
    expect(html).toContain('INS Solar Engineering Pvt Ltd');
    expect(html).toContain('Mono PERC 550Wp Solar Panels');
    expect(html).toContain('₹2,83,360.00'); // Formatted Net Total
  });

  // --------------------------------------------------------------------------
  // 14. Unauthenticated access guard
  // --------------------------------------------------------------------------
  it('blocks unauthenticated requests to solar designs and quotations endpoints with HTTP 401', async () => {
    const app = createApp();

    const designRes = await request(app).get('/api/v1/solar-designs');
    expect(designRes.status).toBe(401);

    const quoteRes = await request(app).get('/api/v1/quotations');
    expect(quoteRes.status).toBe(401);

    const custQuoteRes = await request(app).get('/api/v1/customer-portal/quotations');
    expect(custQuoteRes.status).toBe(401);
  });
});
