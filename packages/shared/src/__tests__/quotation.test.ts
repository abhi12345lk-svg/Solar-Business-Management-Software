import { describe, it, expect } from 'vitest';
import {
  QuotationItemType,
  SolarTopology,
  QuotationLineItemInputSchema,
  CreateQuotationInputSchema,
  ReviseQuotationInputSchema,
  DiscountApprovalInputSchema,
  CustomerQuotationDecisionSchema,
  TAX_DISCLAIMER_TEXT
} from '../index.js';

describe('Quotation & Proposal Shared Schemas', () => {
  describe('QuotationLineItemInputSchema', () => {
    it('accepts valid line item with integer paise', () => {
      const item = {
        itemType: QuotationItemType.SOLAR_MODULE,
        productId: '507f1f77bcf86cd799439011',
        description: 'Mono PERC 550Wp Half-Cut Solar Panel',
        quantity: 20,
        unit: 'NOS',
        unitRatePaise: 1100000, // ₹11,000.00
        discountPaise: 50000, // ₹500.00
        gstRateBasisPoints: 1200 // 12%
      };

      const parsed = QuotationLineItemInputSchema.parse(item);
      expect(parsed.unitRatePaise).toBe(1100000);
      expect(parsed.gstRateBasisPoints).toBe(1200);
    });

    it('rejects floating-point paise in unit rates or discounts', () => {
      expect(() =>
        QuotationLineItemInputSchema.parse({
          itemType: QuotationItemType.INVERTER,
          description: '10kW Grid-Tie Inverter',
          quantity: 1,
          unitRatePaise: 50000.75 // Invalid float
        })
      ).toThrow(/must be an integer/);
    });

    it('rejects zero or negative quantities', () => {
      expect(() =>
        QuotationLineItemInputSchema.parse({
          itemType: QuotationItemType.INVERTER,
          description: '10kW Grid-Tie Inverter',
          quantity: 0,
          unitRatePaise: 5000000
        })
      ).toThrow(/greater than zero/);
    });
  });

  describe('CreateQuotationInputSchema', () => {
    it('validates a complete commercial proposal input', () => {
      const quotationInput = {
        customerId: '507f1f77bcf86cd799439011',
        systemTopology: SolarTopology.ON_GRID,
        systemCapacityKwp: 10,
        lineItems: [
          {
            itemType: QuotationItemType.SOLAR_MODULE,
            description: '550Wp Solar Panels (x18)',
            quantity: 18,
            unit: 'NOS',
            unitRatePaise: 1100000,
            discountPaise: 0,
            gstRateBasisPoints: 1200
          },
          {
            itemType: QuotationItemType.INVERTER,
            description: '10kW Three-Phase Inverter',
            quantity: 1,
            unit: 'NOS',
            unitRatePaise: 6500000,
            discountPaise: 0,
            gstRateBasisPoints: 1800
          }
        ],
        additionalDiscountPaise: 100000, // ₹1,000 additional discount
        termsAndConditions: [
          'Supply, installation and grid liaison included.',
          'Quotation valid for 30 days.'
        ]
      };

      const parsed = CreateQuotationInputSchema.parse(quotationInput);
      expect(parsed.lineItems.length).toBe(2);
      expect(parsed.additionalDiscountPaise).toBe(100000);
      expect(TAX_DISCLAIMER_TEXT).toContain('Commercial quotation estimate only');
    });

    it('rejects quotation with empty line items array', () => {
      expect(() =>
        CreateQuotationInputSchema.parse({
          customerId: '507f1f77bcf86cd799439011',
          systemTopology: SolarTopology.ON_GRID,
          systemCapacityKwp: 10,
          lineItems: []
        })
      ).toThrow(/at least one line item/);
    });
  });

  describe('ReviseQuotationInputSchema', () => {
    it('validates revision creation and requires a descriptive reason', () => {
      const revision = {
        reasonForRevision: 'Customer requested 580Wp TopCon modules upgrade and structure change',
        additionalDiscountPaise: 50000
      };

      const parsed = ReviseQuotationInputSchema.parse(revision);
      expect(parsed.reasonForRevision).toContain('TopCon modules');
    });

    it('rejects revision with too short reason', () => {
      expect(() =>
        ReviseQuotationInputSchema.parse({
          reasonForRevision: 'up'
        })
      ).toThrow(/at least 5 characters/);
    });
  });

  describe('DiscountApprovalInputSchema', () => {
    it('validates approval decisions', () => {
      const approve = DiscountApprovalInputSchema.parse({
        action: 'APPROVE',
        remarks: 'Approved by Sales Director as festive promotion'
      });
      expect(approve.action).toBe('APPROVE');

      const reject = DiscountApprovalInputSchema.parse({
        action: 'REJECT',
        rejectionReason: 'Discount exceeds allowable gross margin threshold'
      });
      expect(reject.action).toBe('REJECT');
    });
  });

  describe('CustomerQuotationDecisionSchema', () => {
    it('validates customer accept/reject decisions', () => {
      const accept = CustomerQuotationDecisionSchema.parse({
        action: 'ACCEPT',
        notes: 'Confirmed and accepted quotation terms'
      });
      expect(accept.action).toBe('ACCEPT');

      const reject = CustomerQuotationDecisionSchema.parse({
        action: 'REJECT',
        rejectionReason: 'Selected competitor offer with battery package'
      });
      expect(reject.action).toBe('REJECT');
    });
  });
});
