import { describe, it, expect } from 'vitest';
import { PhoneSchema, EmailSchema, PaginationQuerySchema } from '../schemas/common.js';

describe('Shared Common Schemas', () => {
  describe('PhoneSchema', () => {
    it('accepts valid E.164 phone numbers', () => {
      expect(PhoneSchema.parse('+919876543210')).toBe('+919876543210');
      expect(PhoneSchema.parse('+14155552671')).toBe('+14155552671');
    });

    it('rejects invalid or non-E.164 phone numbers', () => {
      expect(() => PhoneSchema.parse('9876543210')).toThrow();
      expect(() => PhoneSchema.parse('invalid')).toThrow();
      expect(() => PhoneSchema.parse('+0123')).toThrow();
    });
  });

  describe('EmailSchema', () => {
    it('accepts and normalizes valid emails', () => {
      expect(EmailSchema.parse('Test.User@example.com')).toBe('test.user@example.com');
      expect(EmailSchema.parse('  admin@inssolar.com  ')).toBe('admin@inssolar.com');
    });

    it('rejects invalid emails', () => {
      expect(() => EmailSchema.parse('not-an-email')).toThrow();
      expect(() => EmailSchema.parse('@missinguser.com')).toThrow();
    });
  });

  describe('PaginationQuerySchema', () => {
    it('applies defaults when values are omitted', () => {
      const parsed = PaginationQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortOrder).toBe('desc');
    });

    it('coerces string numbers correctly', () => {
      const parsed = PaginationQuerySchema.parse({ page: '3', limit: '50' });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);
    });

    it('rejects negative pages or limit over 100', () => {
      expect(() => PaginationQuerySchema.parse({ page: '-1' })).toThrow();
      expect(() => PaginationQuerySchema.parse({ limit: '101' })).toThrow();
    });
  });
});
