/**
 * INS Solar Business Management Software — Phase 6B Shared Unit Tests
 *
 * Validates dispatch, checklist, and evidence schemas:
 * - Line item quantity validation
 * - Cancellation reason length checks
 * - Checklist status transitions (FAILED requires failureReason, BLOCKED requires blockerReason)
 * - Evidence GPS coordinate boundaries (-90..90, -180..180)
 */

import { describe, it, expect } from 'vitest';
import {
  createMaterialDispatchSchema,
  cancelMaterialDispatchSchema,
  updateChecklistItemStatusSchema,
  uploadEvidenceMetadataSchema,
  ChecklistItemStatus
} from '../index.js';

describe('Phase 6B Shared Schemas', () => {
  const validObjectId = '507f1f77bcf86cd799439011';

  it('validates material dispatch creation successfully with valid data', () => {
    const input = {
      projectId: validObjectId,
      sourceWarehouseId: validObjectId,
      lineItems: [
        {
          productId: validObjectId,
          requestedQuantity: 10,
          serialNumbers: ['SN-001', 'sn-002']
        }
      ],
      vehicleNumber: 'GJ-01-AB-1234',
      driverName: 'Ramesh Patel',
      driverPhone: '+91 9876543210'
    };

    const parsed = createMaterialDispatchSchema.parse(input);
    expect(parsed.lineItems[0]!.serialNumbers).toEqual(['SN-001', 'SN-002']);
    expect(parsed.lineItems[0]!.requestedQuantity).toBe(10);
  });

  it('rejects dispatch creation with empty line items or negative quantities', () => {
    expect(() =>
      createMaterialDispatchSchema.parse({
        projectId: validObjectId,
        sourceWarehouseId: validObjectId,
        lineItems: []
      })
    ).toThrow();

    expect(() =>
      createMaterialDispatchSchema.parse({
        projectId: validObjectId,
        sourceWarehouseId: validObjectId,
        lineItems: [
          {
            productId: validObjectId,
            requestedQuantity: -5
          }
        ]
      })
    ).toThrow();
  });

  it('validates dispatch cancellation reason length requirement', () => {
    expect(() =>
      cancelMaterialDispatchSchema.parse({
        cancellationReason: 'bad'
      })
    ).toThrow(/at least 5 characters/);

    const valid = cancelMaterialDispatchSchema.parse({
      cancellationReason: 'Site access blocked due to heavy rain'
    });
    expect(valid.cancellationReason).toBe('Site access blocked due to heavy rain');
  });

  it('enforces failureReason when checklist item status is FAILED', () => {
    expect(() =>
      updateChecklistItemStatusSchema.parse({
        status: ChecklistItemStatus.FAILED
      })
    ).toThrow(/Failure reason is strictly required/);

    const valid = updateChecklistItemStatusSchema.parse({
      status: ChecklistItemStatus.FAILED,
      failureReason: 'Earth pit resistance measured at 8.5 Ohms (> 5 Ohm limit)'
    });
    expect(valid.status).toBe(ChecklistItemStatus.FAILED);
  });

  it('enforces blockerReason when checklist item status is BLOCKED', () => {
    expect(() =>
      updateChecklistItemStatusSchema.parse({
        status: ChecklistItemStatus.BLOCKED
      })
    ).toThrow(/Blocker reason is strictly required/);

    const valid = updateChecklistItemStatusSchema.parse({
      status: ChecklistItemStatus.BLOCKED,
      blockerReason: 'DISCOM inspector absent for bi-directional meter sync'
    });
    expect(valid.status).toBe(ChecklistItemStatus.BLOCKED);
  });

  it('validates evidence GPS coordinates boundary ranges', () => {
    expect(() =>
      uploadEvidenceMetadataSchema.parse({
        latitude: 95.0, // Invalid > 90
        longitude: 72.5
      })
    ).toThrow();

    expect(() =>
      uploadEvidenceMetadataSchema.parse({
        latitude: 23.0,
        longitude: 195.0 // Invalid > 180
      })
    ).toThrow();

    const valid = uploadEvidenceMetadataSchema.parse({
      caption: 'Inverter mounted on north-facing wall with IP65 gland seals',
      latitude: 23.0225,
      longitude: 72.5714
    });
    expect(valid.latitude).toBe(23.0225);
    expect(valid.longitude).toBe(72.5714);
  });
});
