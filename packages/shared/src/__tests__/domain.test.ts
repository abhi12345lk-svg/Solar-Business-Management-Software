import { describe, it, expect } from 'vitest';
import {
  MoneyPaiseSchema,
  PositiveMoneyPaiseSchema,
  SignedMoneyPaiseSchema,
  rupeesToPaise,
  paiseToRupees,
  formatPaiseToInr,
  multiplyPaise,
  calculateTaxPaise,
  MAX_SAFE_PAISE
} from '../schemas/money.js';
import {
  AddressSchema,
  QuantitySchema,
  GstinSchema,
  PanSchema,
  CustomerCodeSchema,
  GenericBusinessNumberSchema
} from '../schemas/domain.js';
import { UnitOfMeasurement, AddressType } from '../types/enums.js';

describe('Shared Monetary Primitives & Arithmetic Helpers', () => {
  describe('MoneyPaiseSchema', () => {
    it('accepts valid zero and positive integer paise', () => {
      expect(MoneyPaiseSchema.parse(0)).toBe(0);
      expect(MoneyPaiseSchema.parse(100)).toBe(100);
      expect(MoneyPaiseSchema.parse(500000)).toBe(500000);
      expect(MoneyPaiseSchema.parse(MAX_SAFE_PAISE)).toBe(MAX_SAFE_PAISE);
    });

    it('rejects floating-point numbers', () => {
      expect(() => MoneyPaiseSchema.parse(10.5)).toThrow(/floating-point amounts are prohibited/i);
      expect(() => MoneyPaiseSchema.parse(0.01)).toThrow(/floating-point amounts are prohibited/i);
    });

    it('rejects negative numbers', () => {
      expect(() => MoneyPaiseSchema.parse(-1)).toThrow(/cannot be negative/i);
      expect(() => MoneyPaiseSchema.parse(-500)).toThrow(/cannot be negative/i);
    });

    it('rejects numbers exceeding MAX_SAFE_PAISE', () => {
      expect(() => MoneyPaiseSchema.parse(Number.MAX_SAFE_INTEGER + 1000)).toThrow();
    });
  });

  describe('PositiveMoneyPaiseSchema', () => {
    it('accepts strictly positive integers', () => {
      expect(PositiveMoneyPaiseSchema.parse(1)).toBe(1);
      expect(PositiveMoneyPaiseSchema.parse(99999)).toBe(99999);
    });

    it('rejects zero and negative amounts', () => {
      expect(() => PositiveMoneyPaiseSchema.parse(0)).toThrow(/strictly greater than zero/i);
      expect(() => PositiveMoneyPaiseSchema.parse(-10)).toThrow();
    });
  });

  describe('SignedMoneyPaiseSchema', () => {
    it('accepts both negative, zero, and positive integers', () => {
      expect(SignedMoneyPaiseSchema.parse(-5000)).toBe(-5000);
      expect(SignedMoneyPaiseSchema.parse(0)).toBe(0);
      expect(SignedMoneyPaiseSchema.parse(12500)).toBe(12500);
    });

    it('rejects floating-point numbers', () => {
      expect(() => SignedMoneyPaiseSchema.parse(-10.25)).toThrow(
        /floating-point amounts are prohibited/i
      );
    });
  });

  describe('rupeesToPaise', () => {
    it('converts exact integers and valid 2-decimal rupee amounts', () => {
      expect(rupeesToPaise(100)).toBe(10000);
      expect(rupeesToPaise(12.34)).toBe(1234);
      expect(rupeesToPaise(0.05)).toBe(5);
      expect(rupeesToPaise(0)).toBe(0);
    });

    it('rejects numbers with more than 2 decimal places to prevent silent rounding', () => {
      expect(() => rupeesToPaise(12.345)).toThrow(/cannot have more than 2 decimal places/i);
      expect(() => rupeesToPaise(0.001)).toThrow(/cannot have more than 2 decimal places/i);
    });

    it('rejects non-finite values', () => {
      expect(() => rupeesToPaise(NaN)).toThrow(TypeError);
      expect(() => rupeesToPaise(Infinity)).toThrow(TypeError);
    });
  });

  describe('paiseToRupees', () => {
    it('converts integer paise to rupees correctly', () => {
      expect(paiseToRupees(1234)).toBe(12.34);
      expect(paiseToRupees(10000)).toBe(100);
      expect(paiseToRupees(5)).toBe(0.05);
      expect(paiseToRupees(0)).toBe(0);
    });

    it('rejects non-integer paise', () => {
      expect(() => paiseToRupees(12.5)).toThrow(TypeError);
    });
  });

  describe('formatPaiseToInr', () => {
    it('formats Indian currency with standard Lakhs and Crores commas', () => {
      expect(formatPaiseToInr(0)).toBe('₹0.00');
      expect(formatPaiseToInr(10000)).toBe('₹100.00');
      expect(formatPaiseToInr(12345678)).toBe('₹1,23,456.78');
      expect(formatPaiseToInr(1000000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });

    it('supports options without paise and without currency symbol', () => {
      expect(formatPaiseToInr(12345678, { showPaise: false })).toBe('₹1,23,456');
      expect(formatPaiseToInr(12345678, { showSymbol: false })).toBe('1,23,456.78');
      expect(formatPaiseToInr(-500000, { showSymbol: true })).toBe('-₹5,000.00');
    });

    it('rejects non-integer paise', () => {
      expect(() => formatPaiseToInr(100.5)).toThrow(TypeError);
    });
  });

  describe('multiplyPaise & calculateTaxPaise', () => {
    it('multiplies integer paise by quantity rounding half-up', () => {
      expect(multiplyPaise(1000, 3)).toBe(3000);
      expect(multiplyPaise(105, 1.5)).toBe(158); // 157.5 rounded to 158
      expect(multiplyPaise(0, 5)).toBe(0);
    });

    it('calculates tax in paise using basis points', () => {
      // 18% GST (1800 basis points) on ₹1000.00 (100,000 paise) = ₹180.00 (18,000 paise)
      expect(calculateTaxPaise(100000, 1800)).toBe(18000);
      // 12% GST (1200 basis points) on ₹555.55 (55,555 paise) = 6666.6 -> 6667 paise
      expect(calculateTaxPaise(55555, 1200)).toBe(6667);
      // 0% GST
      expect(calculateTaxPaise(55555, 0)).toBe(0);
    });

    it('rejects invalid inputs to arithmetic helpers', () => {
      expect(() => multiplyPaise(10.5, 2)).toThrow(TypeError);
      expect(() => multiplyPaise(100, -1)).toThrow(TypeError);
      expect(() => calculateTaxPaise(100.5, 1800)).toThrow(TypeError);
      expect(() => calculateTaxPaise(100, -50)).toThrow(TypeError);
    });
  });
});

describe('Shared Domain Schemas', () => {
  describe('AddressSchema', () => {
    it('accepts valid Indian addresses', () => {
      const validAddress = {
        type: AddressType.BILLING,
        addressLine1: 'Plot 42, Sector 18, Industrial Area',
        city: 'Gurugram',
        state: 'Haryana',
        stateCode: '06',
        postalCode: '122015',
        country: 'India'
      };
      const parsed = AddressSchema.parse(validAddress);
      expect(parsed.postalCode).toBe('122015');
      expect(parsed.state).toBe('Haryana');
    });

    it('rejects invalid Indian PIN codes', () => {
      const invalidAddress = {
        addressLine1: 'Road 1',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '012345' // Leading 0 invalid
      };
      expect(() => AddressSchema.parse(invalidAddress)).toThrow(/PIN code/i);

      expect(() =>
        AddressSchema.parse({
          ...invalidAddress,
          postalCode: '12345' // 5 digits
        })
      ).toThrow(/PIN code/i);
    });

    it('rejects invalid state codes', () => {
      expect(() =>
        AddressSchema.parse({
          addressLine1: 'Main St',
          city: 'Noida',
          state: 'UP',
          stateCode: '999', // Must be 2 digits
          postalCode: '201301'
        })
      ).toThrow(/State Code/i);
    });
  });

  describe('QuantitySchema', () => {
    it('accepts valid quantities with UOM', () => {
      const parsed = QuantitySchema.parse({ value: 25, uom: UnitOfMeasurement.NOS });
      expect(parsed.value).toBe(25);
      expect(parsed.uom).toBe('NOS');
    });

    it('rejects non-positive quantities or invalid UOM', () => {
      expect(() => QuantitySchema.parse({ value: 0, uom: UnitOfMeasurement.NOS })).toThrow();
      expect(() => QuantitySchema.parse({ value: -5, uom: UnitOfMeasurement.NOS })).toThrow();
      expect(() => QuantitySchema.parse({ value: 10, uom: 'TONS' })).toThrow();
    });
  });

  describe('GstinSchema & PanSchema', () => {
    it('validates correct Indian GSTIN format', () => {
      expect(GstinSchema.parse('07AAAAA0000A1Z5')).toBe('07AAAAA0000A1Z5');
      expect(GstinSchema.parse('  06BPLPK1234C1ZB  ')).toBe('06BPLPK1234C1ZB'); // Normalizes trim & uppercase
    });

    it('rejects invalid GSTIN format', () => {
      expect(() => GstinSchema.parse('INVALID_GSTIN')).toThrow(/GSTIN/i);
      expect(() => GstinSchema.parse('07AAAAA0000A1')).toThrow(/GSTIN/i); // Too short
    });

    it('validates correct Indian PAN format', () => {
      expect(PanSchema.parse('ABCDE1234F')).toBe('ABCDE1234F');
      expect(PanSchema.parse('  xyzpe9876k  ')).toBe('XYZPE9876K'); // Normalizes trim & uppercase
    });

    it('rejects invalid PAN format', () => {
      expect(() => PanSchema.parse('12345ABCDE')).toThrow(/PAN/i);
      expect(() => PanSchema.parse('ABCDE1234')).toThrow(/PAN/i);
    });
  });

  describe('Business Number Formats', () => {
    it('validates customer code format', () => {
      expect(CustomerCodeSchema.parse('CUST-2026-00042')).toBe('CUST-2026-00042');
      expect(() => CustomerCodeSchema.parse('CUST-26-42')).toThrow(/Customer code/i);
    });

    it('validates generic business numbers', () => {
      expect(GenericBusinessNumberSchema.parse('QT-2026-00120')).toBe('QT-2026-00120');
      expect(GenericBusinessNumberSchema.parse('ORD-2026-00001')).toBe('ORD-2026-00001');
      expect(GenericBusinessNumberSchema.parse('INV-2026-99999')).toBe('INV-2026-99999');
      expect(() => GenericBusinessNumberSchema.parse('invalid-num')).toThrow(/Business number/i);
    });
  });
});
