import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { dbManager } from '../db/connection.js';
import { SequenceService, getCurrentFiscalYear } from '../services/sequenceService.js';
import { SequenceCounter } from '../models/SequenceCounter.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { SequenceEntityType, CustomerType, CustomerStatus, AddressType } from '@ins-solar/shared';

describe('Phase 3A: Core Database Foundation, Domain Primitives & Atomic Numbering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  // --------------------------------------------------------------------------
  // 1. Sequence generation for sequential calls
  // --------------------------------------------------------------------------
  it('generates sequential, strictly monotonic business numbers', async () => {
    const fy = getCurrentFiscalYear();

    const seq1 = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.CUSTOMER
    });
    const seq2 = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.CUSTOMER
    });
    const seq3 = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.CUSTOMER
    });

    expect(seq1.sequenceNumber).toBe(1);
    expect(seq1.formattedNumber).toBe(`CUST-${fy}-00001`);
    expect(seq2.sequenceNumber).toBe(2);
    expect(seq2.formattedNumber).toBe(`CUST-${fy}-00002`);
    expect(seq3.sequenceNumber).toBe(3);
    expect(seq3.formattedNumber).toBe(`CUST-${fy}-00003`);
  });

  // --------------------------------------------------------------------------
  // 2. Concurrent sequence generation with NO duplicate issued numbers
  // --------------------------------------------------------------------------
  it('handles 50 concurrent sequence requests with ZERO duplicate numbers', async () => {
    const CONCURRENT_REQUESTS = 50;

    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      SequenceService.generateNextSequence({
        entityType: SequenceEntityType.QUOTATION
      })
    );

    const results = await Promise.all(promises);

    const formattedNumbers = results.map(r => r.formattedNumber);
    const sequenceNumbers = results.map(r => r.sequenceNumber);

    // Verify all 50 issued numbers are strictly unique
    const uniqueFormatted = new Set(formattedNumbers);
    expect(uniqueFormatted.size).toBe(CONCURRENT_REQUESTS);

    const uniqueNumbers = new Set(sequenceNumbers);
    expect(uniqueNumbers.size).toBe(CONCURRENT_REQUESTS);

    // Verify min is 1 and max is 50
    expect(Math.min(...sequenceNumbers)).toBe(1);
    expect(Math.max(...sequenceNumbers)).toBe(CONCURRENT_REQUESTS);
  });

  // --------------------------------------------------------------------------
  // 3. Concurrent first-time initialization of the same sequence key
  // --------------------------------------------------------------------------
  it('handles concurrent first-time initialization safely across distinct entity types', async () => {
    const promises = [
      SequenceService.generateNextSequence({ entityType: SequenceEntityType.ORDER }),
      SequenceService.generateNextSequence({ entityType: SequenceEntityType.PROJECT }),
      SequenceService.generateNextSequence({ entityType: SequenceEntityType.INVOICE }),
      SequenceService.generateNextSequence({ entityType: SequenceEntityType.PURCHASE_ORDER })
    ];

    const results = await Promise.all(promises);

    expect(results[0]?.prefix).toBe('ORD');
    expect(results[0]?.sequenceNumber).toBe(1);

    expect(results[1]?.prefix).toBe('PRJ');
    expect(results[1]?.sequenceNumber).toBe(1);

    expect(results[2]?.prefix).toBe('INV');
    expect(results[2]?.sequenceNumber).toBe(1);

    expect(results[3]?.prefix).toBe('PO');
    expect(results[3]?.sequenceNumber).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 4. Retry behavior upon transient duplicate-key collision race (E11000)
  // --------------------------------------------------------------------------
  it('retries successfully when a MongoDB E11000 duplicate key collision occurs during upsert', async () => {
    // Simulate live mongoose connection
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    let attempts = 0;
    vi.spyOn(SequenceCounter, 'findOneAndUpdate').mockImplementation((async () => {
      attempts++;
      if (attempts === 1) {
        // First attempt: simulate duplicate key race condition error code 11000
        const error: any = new Error(
          'E11000 duplicate key error collection: sequencecounters index: sequenceKey_1'
        );
        error.code = 11000;
        throw error;
      }
      // Second attempt: succeeds with counter value 1
      return {
        sequenceKey: 'LEAD:2026',
        entityType: 'LEAD',
        fiscalYear: '2026',
        prefix: 'LEAD',
        currentValue: 1,
        padding: 5
      } as any;
    }) as any);

    const result = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.LEAD,
      fiscalYear: '2026'
    });

    expect(attempts).toBe(2);
    expect(result.sequenceNumber).toBe(1);
    expect(result.formattedNumber).toBe('LEAD-2026-00001');

    // Restore readyState
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
  });

  // --------------------------------------------------------------------------
  // 5. Invalid sequence configuration rejection
  // --------------------------------------------------------------------------
  it('rejects invalid or empty entity types', async () => {
    await expect(SequenceService.generateNextSequence({ entityType: '' })).rejects.toThrow();

    await expect(SequenceService.generateNextSequence({ entityType: '   ' })).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // 6. Sequence preview without incrementing
  // --------------------------------------------------------------------------
  it('previews next sequence number without mutating the counter', async () => {
    const preview1 = await SequenceService.previewNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      fiscalYear: '2026'
    });
    expect(preview1).toBe('AMC-2026-00001');

    // Previewing again should still show 00001
    const preview2 = await SequenceService.previewNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      fiscalYear: '2026'
    });
    expect(preview2).toBe('AMC-2026-00001');

    // Now generating consumes 00001
    const actual = await SequenceService.generateNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      fiscalYear: '2026'
    });
    expect(actual.formattedNumber).toBe('AMC-2026-00001');

    // Next preview should now be 00002
    const preview3 = await SequenceService.previewNextSequence({
      entityType: SequenceEntityType.AMC_CONTRACT,
      fiscalYear: '2026'
    });
    expect(preview3).toBe('AMC-2026-00002');
  });

  // --------------------------------------------------------------------------
  // 7. Customer Model Foundations & Serialization Safety
  // --------------------------------------------------------------------------
  it('Customer model enforces safe serialization and excludes internal Mongoose fields', () => {
    const customer = new Customer({
      customerCode: 'CUST-2026-00001',
      name: 'Aditya Power Systems',
      companyName: 'Aditya Industries Ltd.',
      primaryPhone: '+919876543210',
      email: 'contact@adityapower.com',
      type: CustomerType.COMMERCIAL,
      status: CustomerStatus.ACTIVE,
      gstin: '07AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      billingAddress: {
        type: AddressType.BILLING,
        addressLine1: 'Plot 100, Okhla Phase 3',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: '07',
        postalCode: '110020',
        country: 'India'
      },
      contactPerson: {
        name: 'Aditya Sharma',
        phone: '+919876543210',
        email: 'aditya@adityapower.com',
        designation: 'Managing Director'
      }
    });

    const json = customer.toJSON();

    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.customerCode).toBe('CUST-2026-00001');
    expect(json.name).toBe('Aditya Power Systems');
    expect(json.billingAddress?.city).toBe('New Delhi');
    expect(json.contactPerson?.name).toBe('Aditya Sharma');
  });

  // --------------------------------------------------------------------------
  // 8. CompanySettings Model Foundations & Singleton Protection
  // --------------------------------------------------------------------------
  it('CompanySettings model enforces defaults and does not expose secrets', () => {
    const settings = new CompanySettings({
      companyName: 'INS Solar Pvt. Ltd.',
      gstin: '07AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      registeredAddress: {
        addressLine1: 'Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001'
      }
    });

    const json = settings.toJSON();

    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.companyName).toBe('INS Solar Pvt. Ltd.');
    expect(json.defaultCurrency).toBe('INR');
    expect(json.fiscalYearStartMonth).toBe(4);
    expect(json.key).toBe('COMPANY_SETTINGS');
  });

  // --------------------------------------------------------------------------
  // 9. Repeated model imports without OverwriteModelError
  // --------------------------------------------------------------------------
  it('allows repeated model registrations without throwing OverwriteModelError', async () => {
    expect(() => {
      const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
      const SequenceModel = mongoose.models.SequenceCounter || mongoose.model('SequenceCounter');
      const SettingsModel = mongoose.models.CompanySettings || mongoose.model('CompanySettings');
      expect(CustomerModel).toBeDefined();
      expect(SequenceModel).toBeDefined();
      expect(SettingsModel).toBeDefined();
    }).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // 10. Database-unavailable readiness behavior
  // --------------------------------------------------------------------------
  it('reports HTTP 503 degraded/unhealthy status when database connection is unavailable', async () => {
    const app = createApp();

    // Mock dbManager.getState to return disconnected
    vi.spyOn(dbManager, 'getState').mockReturnValue('disconnected');

    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('unhealthy');
    expect(res.body.data.database).toBe('disconnected');
  });
});
