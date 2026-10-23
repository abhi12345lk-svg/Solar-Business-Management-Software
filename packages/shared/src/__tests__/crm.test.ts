import { describe, it, expect } from 'vitest';
import {
  LeadCodeSchema,
  SurveyCodeSchema,
  CreateLeadInputSchema,
  UpdateLeadStatusInputSchema,
  CreateLeadActivityInputSchema,
  CreateSiteSurveyInputSchema,
  SurveyPhotoMetadataSchema,
  ConvertLeadInputSchema
} from '../schemas/crm.js';
import {
  LeadStatus,
  LeadSource,
  SolarRequirement,
  RoofType,
  ConnectionPhase,
  SurveyPhotoCategory,
  ActivityType,
  ActivityStatus
} from '../types/enums.js';

describe('Shared CRM & Site Survey Schemas', () => {
  describe('LeadCodeSchema', () => {
    it('accepts valid LEAD-YYYY-NNNNN identifiers', () => {
      expect(LeadCodeSchema.parse('LEAD-2026-00001')).toBe('LEAD-2026-00001');
      expect(LeadCodeSchema.parse('lead-2026-00456')).toBe('LEAD-2026-00456');
    });

    it('rejects invalid lead codes', () => {
      expect(() => LeadCodeSchema.parse('LD-2026-01')).toThrow();
      expect(() => LeadCodeSchema.parse('LEAD-26-00001')).toThrow();
      expect(() => LeadCodeSchema.parse('INVALID_LEAD')).toThrow();
    });
  });

  describe('SurveyCodeSchema', () => {
    it('accepts valid SRV-YYYY-NNNNN identifiers', () => {
      expect(SurveyCodeSchema.parse('SRV-2026-00012')).toBe('SRV-2026-00012');
    });

    it('rejects invalid survey codes', () => {
      expect(() => SurveyCodeSchema.parse('SURV-2026-00012')).toThrow();
    });
  });

  describe('CreateLeadInputSchema', () => {
    it('validates a complete and correct lead input', () => {
      const valid = {
        prospectName: 'Sunita Sharma',
        prospectPhone: '+919876543210',
        prospectEmail: 'sunita@example.com',
        location: {
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: '302001'
        },
        source: LeadSource.WEBSITE,
        solarRequirement: SolarRequirement.RESIDENTIAL,
        estimatedCapacityKw: 5.5
      };

      const parsed = CreateLeadInputSchema.parse(valid);
      expect(parsed.prospectName).toBe('Sunita Sharma');
      expect(parsed.prospectPhone).toBe('+919876543210');
      expect(parsed.estimatedCapacityKw).toBe(5.5);
    });

    it('rejects invalid phone numbers that do not match E.164', () => {
      const invalid = {
        prospectName: 'Sunita Sharma',
        prospectPhone: '9876543210', // Missing +
        location: {
          city: 'Jaipur',
          state: 'Rajasthan'
        }
      };

      expect(() => CreateLeadInputSchema.parse(invalid)).toThrow(/E\.164/);
    });

    it('rejects negative or zero capacity', () => {
      const invalid = {
        prospectName: 'Sunita Sharma',
        prospectPhone: '+919876543210',
        location: {
          city: 'Jaipur',
          state: 'Rajasthan'
        },
        estimatedCapacityKw: -3
      };

      expect(() => CreateLeadInputSchema.parse(invalid)).toThrow();
    });
  });

  describe('UpdateLeadStatusInputSchema', () => {
    it('allows valid transitions to active statuses without lostReason', () => {
      expect(
        UpdateLeadStatusInputSchema.parse({
          status: LeadStatus.CONTACTED
        }).status
      ).toBe(LeadStatus.CONTACTED);
    });

    it('requires lostReason when transitioning to LOST', () => {
      expect(() =>
        UpdateLeadStatusInputSchema.parse({
          status: LeadStatus.LOST
        })
      ).toThrow(/reason is required/i);

      const withReason = UpdateLeadStatusInputSchema.parse({
        status: LeadStatus.LOST,
        lostReason: 'Customer decided on grid-tied without battery elsewhere'
      });
      expect(withReason.lostReason).toContain('Customer decided');
    });
  });

  describe('CreateLeadActivityInputSchema', () => {
    it('validates an activity follow-up record', () => {
      const activity = {
        activityType: ActivityType.CALL,
        summary: 'Discussed 10kW rooftop net metering requirements',
        status: ActivityStatus.COMPLETED,
        remarks: 'Client requested physical site survey this Saturday'
      };

      const parsed = CreateLeadActivityInputSchema.parse(activity);
      expect(parsed.activityType).toBe(ActivityType.CALL);
      expect(parsed.status).toBe(ActivityStatus.COMPLETED);
    });
  });

  describe('CreateSiteSurveyInputSchema', () => {
    const validAddress = {
      addressLine1: 'Plot 42, Sitapura Industrial Area',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302022'
    };

    it('validates a complete site survey with non-negative measurements and integer paise bill', () => {
      const survey = {
        leadId: '507f1f77bcf86cd799439011',
        siteAddress: validAddress,
        roofType: RoofType.RCC_FLAT,
        usableRoofAreaSqFt: 1200,
        monthlyUnitsKwh: 650,
        averageMonthlyBillPaise: 450000, // Rs. 4,500.00
        sanctionedLoadKw: 8,
        connectionPhase: ConnectionPhase.THREE,
        proposedCapacityKw: 6.5
      };

      const parsed = CreateSiteSurveyInputSchema.parse(survey);
      expect(parsed.usableRoofAreaSqFt).toBe(1200);
      expect(parsed.averageMonthlyBillPaise).toBe(450000);
      expect(parsed.connectionPhase).toBe(ConnectionPhase.THREE);
    });

    it('rejects negative roof area and non-integer bill paise', () => {
      const invalidArea = {
        leadId: '507f1f77bcf86cd799439011',
        siteAddress: validAddress,
        roofType: RoofType.RCC_FLAT,
        usableRoofAreaSqFt: -100,
        sanctionedLoadKw: 5
      };
      expect(() => CreateSiteSurveyInputSchema.parse(invalidArea)).toThrow();

      const invalidBill = {
        leadId: '507f1f77bcf86cd799439011',
        siteAddress: validAddress,
        roofType: RoofType.RCC_FLAT,
        usableRoofAreaSqFt: 500,
        sanctionedLoadKw: 5,
        averageMonthlyBillPaise: 450.5 // Non-integer
      };
      expect(() => CreateSiteSurveyInputSchema.parse(invalidBill)).toThrow();
    });
  });

  describe('SurveyPhotoMetadataSchema', () => {
    it('validates photo metadata attachments', () => {
      const photo = {
        storageKey: 'surveys/SRV-2026-00001/roof-01.jpg',
        fileName: 'roof_south_view.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048500,
        category: SurveyPhotoCategory.ROOF,
        caption: 'South-facing unobstructed shadow-free zone'
      };

      const parsed = SurveyPhotoMetadataSchema.parse(photo);
      expect(parsed.storageKey).toBe('surveys/SRV-2026-00001/roof-01.jpg');
      expect(parsed.category).toBe(SurveyPhotoCategory.ROOF);
    });

    it('rejects unallowed MIME types or files exceeding size limits', () => {
      const invalidMime = {
        storageKey: 'surveys/SRV-2026-00001/executable.exe',
        fileName: 'test.exe',
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1024
      };
      expect(() => SurveyPhotoMetadataSchema.parse(invalidMime)).toThrow();
    });
  });

  describe('ConvertLeadInputSchema', () => {
    it('validates customer conversion input', () => {
      const input = {
        customerType: 'INDIVIDUAL' as any,
        pan: 'ABCDE1234F',
        notes: 'Converted following accepted survey'
      };
      const parsed = ConvertLeadInputSchema.parse(input);
      expect(parsed.pan).toBe('ABCDE1234F');
    });
  });
});
