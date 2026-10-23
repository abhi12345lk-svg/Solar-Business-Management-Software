import { describe, it, expect } from 'vitest';
import {
  CreateOrderFromQuotationInputSchema,
  CancelOrderInputSchema,
  ReserveStockForOrderInputSchema,
  StockReceiptInputSchema,
  StockTransferInputSchema,
  StockReturnInputSchema,
  OpeningBalanceInputSchema,
  RegisterSerialNumberInputSchema,
  OrderStatus,
  OrderReservationStatus,
  StockMovementType
} from '../index.js';

describe('Phase 5A Shared Schemas & Enums', () => {
  it('validates OrderStatus, OrderReservationStatus, and StockMovementType enums', () => {
    expect(OrderStatus.CONFIRMED).toBe('CONFIRMED');
    expect(OrderStatus.CANCELLED).toBe('CANCELLED');
    expect(OrderReservationStatus.FULLY_RESERVED).toBe('FULLY_RESERVED');
    expect(StockMovementType.RECEIPT).toBe('RECEIPT');
    expect(StockMovementType.ISSUE).toBe('ISSUE');
  });

  it('validates StockReceiptInputSchema and StockReturnInputSchema', () => {
    const receiptValid = StockReceiptInputSchema.safeParse({
      warehouseId: '507f1f77bcf86cd799439011',
      productId: '507f1f77bcf86cd799439022',
      quantity: 100,
      reference: 'GRN-2026-001'
    });
    expect(receiptValid.success).toBe(true);

    const returnValid = StockReturnInputSchema.safeParse({
      sourceWarehouseId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439099',
      productId: '507f1f77bcf86cd799439022',
      quantity: 5,
      reason: 'Surplus panels returned to central warehouse post commissioning'
    });
    expect(returnValid.success).toBe(true);
  });
  it('validates CreateOrderFromQuotationInputSchema correctly', () => {
    const valid = CreateOrderFromQuotationInputSchema.safeParse({
      quotationId: '507f1f77bcf86cd799439011',
      quotationRevisionId: '507f1f77bcf86cd799439022',
      idempotencyKey: 'idem-order-12345',
      notes: 'Initial confirmed sales order'
    });

    expect(valid.success).toBe(true);

    const invalid = CreateOrderFromQuotationInputSchema.safeParse({
      quotationId: 'invalid-id',
      quotationRevisionId: '507f1f77bcf86cd799439022'
    });
    expect(invalid.success).toBe(false);
  });

  it('validates CancelOrderInputSchema requires non-empty reason', () => {
    const valid = CancelOrderInputSchema.safeParse({
      cancellationReason: 'Customer requested cancellation due to site structural constraints'
    });
    expect(valid.success).toBe(true);

    const invalid = CancelOrderInputSchema.safeParse({
      cancellationReason: 'no'
    });
    expect(invalid.success).toBe(false);
  });

  it('validates ReserveStockForOrderInputSchema with positive quantities', () => {
    const valid = ReserveStockForOrderInputSchema.safeParse({
      warehouseId: '507f1f77bcf86cd799439011',
      items: [
        { productId: '507f1f77bcf86cd799439022', quantity: 20 },
        { productId: '507f1f77bcf86cd799439033', quantity: 1 }
      ]
    });
    expect(valid.success).toBe(true);

    const invalid = ReserveStockForOrderInputSchema.safeParse({
      warehouseId: '507f1f77bcf86cd799439011',
      items: [{ productId: '507f1f77bcf86cd799439022', quantity: -5 }]
    });
    expect(invalid.success).toBe(false);
  });

  it('validates StockTransferInputSchema rejects same source and destination warehouse', () => {
    const sameWarehouse = StockTransferInputSchema.safeParse({
      sourceWarehouseId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439011',
      productId: '507f1f77bcf86cd799439022',
      quantity: 10
    });
    expect(sameWarehouse.success).toBe(false);
    if (!sameWarehouse.success) {
      expect(sameWarehouse.error.issues[0]?.message).toContain(
        'Source and destination warehouses must be different.'
      );
    }

    const diffWarehouse = StockTransferInputSchema.safeParse({
      sourceWarehouseId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439099',
      productId: '507f1f77bcf86cd799439022',
      quantity: 10
    });
    expect(diffWarehouse.success).toBe(true);
  });

  it('validates OpeningBalanceInputSchema requires justification reason', () => {
    const valid = OpeningBalanceInputSchema.safeParse({
      warehouseId: '507f1f77bcf86cd799439011',
      productId: '507f1f77bcf86cd799439022',
      quantity: 50,
      reason: 'Physical inventory count signed off by auditor'
    });
    expect(valid.success).toBe(true);

    const invalid = OpeningBalanceInputSchema.safeParse({
      warehouseId: '507f1f77bcf86cd799439011',
      productId: '507f1f77bcf86cd799439022',
      quantity: 50,
      reason: 'ok' // too short
    });
    expect(invalid.success).toBe(false);
  });

  it('validates RegisterSerialNumberInputSchema rejects empty serial list', () => {
    const valid = RegisterSerialNumberInputSchema.safeParse({
      productId: '507f1f77bcf86cd799439022',
      warehouseId: '507f1f77bcf86cd799439011',
      serialNumbers: ['SN-MOD-2026-0001', 'SN-MOD-2026-0002']
    });
    expect(valid.success).toBe(true);

    const empty = RegisterSerialNumberInputSchema.safeParse({
      productId: '507f1f77bcf86cd799439022',
      warehouseId: '507f1f77bcf86cd799439011',
      serialNumbers: []
    });
    expect(empty.success).toBe(false);
  });
});
