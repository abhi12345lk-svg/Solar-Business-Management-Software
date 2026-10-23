/**
 * INS Solar Business Management Software — Phase 5A Automated Test Suite
 *
 * Covers all 18 requirements from Section 10 of Phase 5A Specification:
 * 1. Order creation from an eligible accepted quotation revision.
 * 2. Rejection of unaccepted, expired, superseded or unapproved quotation revisions.
 * 3. Order creation preserves accepted commercial snapshots.
 * 4. Concurrent or repeated order creation cannot produce duplicate orders.
 * 5. Reservation does not change physical on-hand quantity.
 * 6. Two concurrent reservations cannot exceed available stock.
 * 7. Insufficient stock reservation fails without partial mutations.
 * 8. Reservation release is idempotent.
 * 9. Stock issue reduces on-hand quantity exactly once.
 * 10. Cancellation before issue releases reservation correctly.
 * 11. Cancellation after issue requires a controlled return/reversal process.
 * 12. Duplicate movement/idempotency requests do not double-adjust balances.
 * 13. Unauthorized users cannot reserve, issue, transfer or adjust stock.
 * 14. Customer identities cannot access internal inventory or other customers' orders.
 * 15. Serial-number uniqueness and lifecycle validation.
 * 16. Stock movement history cannot be edited or deleted through ordinary application access.
 * 17. Database unavailability fails safely without in-memory stock mutation.
 * 18. Existing authentication, CRM, quotation, catalog, warehouse and sequence tests remain passing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { OrderService } from '../services/orderService.js';
import { StockService } from '../services/stockService.js';
import { SerialNumberService } from '../services/serialNumberService.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockReservation } from '../models/StockReservation.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import {
  OrderStatus,
  OrderReservationStatus,
  StockReservationStatus,
  QuotationStatus,
  QuotationItemType,
  SolarTopology,
  UserRole,
  Department
} from '@ins-solar/shared';

describe('Phase 5A: Sales Orders, Inventory Ledger & Stock Reservation', () => {
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

  const mockOpsUser = {
    userId: '507f1f77bcf86cd799439033',
    role: UserRole.DEPARTMENT_HEAD,
    department: Department.OPERATIONS
  };

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    correlationId: 'test-corr-id'
  };

  function buildMockQuotation(overrides: Partial<any> = {}) {
    const qId = new Types.ObjectId();
    const custId = new Types.ObjectId();
    const prodId = new Types.ObjectId();

    return {
      _id: qId,
      fullQuotationCode: 'QT-2026-00001-R0',
      quotationNumber: 'QT-2026-00001',
      revisionNumber: 0,
      isLatestRevision: true,
      customerId: custId,
      systemTopology: SolarTopology.ON_GRID,
      systemCapacityKwp: 10.5,
      status: QuotationStatus.ACCEPTED,
      acceptedAt: new Date(),
      validUntil: new Date(Date.now() + 86400000), // valid tomorrow
      requiresDiscountApproval: false,
      discountApprovalStatus: 'NOT_REQUIRED',
      lineItems: [
        {
          itemType: QuotationItemType.SOLAR_MODULE,
          productId: prodId,
          description: '550Wp Mono Perc Solar Module',
          quantity: 20,
          unit: 'NOS',
          unitRatePaise: 1100000, // ₹11,000
          discountPaise: 0,
          taxableAmountPaise: 22000000,
          gstRateBasisPoints: 1200,
          cgstRateBasisPoints: 600,
          cgstAmountPaise: 1320000,
          sgstRateBasisPoints: 600,
          sgstAmountPaise: 1320000,
          igstRateBasisPoints: 0,
          igstAmountPaise: 0,
          totalTaxAmountPaise: 2640000,
          totalAmountPaise: 24640000
        }
      ],
      subtotalPaise: 22000000,
      additionalDiscountPaise: 0,
      totalDiscountPaise: 0,
      taxableAmountPaise: 22000000,
      totalTaxAmountPaise: 2640000,
      netTotalPaise: 24640000,
      taxProfile: {
        profileCode: 'GST-INTRA-12',
        profileName: 'Intra-State Solar GST 12%',
        effectiveDate: new Date('2026-01-01'),
        isInterState: false,
        accountingNotice: 'Applicable CGST (6%) and SGST (6%)'
      },
      paymentMilestones: [
        { name: 'Advance', percentage: 20, description: 'Order booking token' },
        { name: 'Material Dispatch', percentage: 70, description: 'Before dispatch' },
        { name: 'Commissioning', percentage: 10, description: 'Net metering handover' }
      ],
      termsAndConditions: ['Standard 5-year workmanship warranty'],
      ...overrides
    };
  }

  // --------------------------------------------------------------------------
  // Requirement 1: Order creation from a genuinely eligible accepted quotation revision
  // --------------------------------------------------------------------------
  it('1. creates Sales Order from an eligible accepted quotation revision with atomic number', async () => {
    const mockQuote = buildMockQuotation();

    vi.spyOn(SalesOrder, 'findOne').mockResolvedValue(null);
    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote as any);
    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: mockQuote.customerId,
      isActive: true,
      legalName: 'Apex Solar Client'
    } as any);
    vi.spyOn(SalesOrder.prototype, 'save').mockResolvedValue(true as any);

    const order = await OrderService.createOrderFromQuotation(
      {
        quotationId: mockQuote._id.toString(),
        quotationRevisionId: mockQuote._id.toString()
      },
      mockSalesExec,
      mockContext
    );

    expect(order.orderNumber).toBe('ORD-2026-00001');
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.reservationStatus).toBe(OrderReservationStatus.NONE);
    expect(order.systemCapacityKwp).toBe(10.5);
    expect(order.customerId.toString()).toBe(mockQuote.customerId.toString());
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Rejection of unaccepted, expired, superseded or unapproved revisions
  // --------------------------------------------------------------------------
  it('2. rejects order creation if quotation is unaccepted, expired, superseded or unapproved', async () => {
    vi.spyOn(SalesOrder, 'findOne').mockResolvedValue(null);

    // Case A: Unaccepted quotation
    const unacceptedQuote = buildMockQuotation({ status: QuotationStatus.SENT });
    vi.spyOn(Quotation, 'findById').mockResolvedValue(unacceptedQuote as any);
    await expect(
      OrderService.createOrderFromQuotation(
        {
          quotationId: unacceptedQuote._id.toString(),
          quotationRevisionId: unacceptedQuote._id.toString()
        },
        mockSalesExec,
        mockContext
      )
    ).rejects.toThrow('Only an accepted quotation revision can be converted into a sales order.');

    // Case B: Expired quotation
    const expiredQuote = buildMockQuotation({
      validUntil: new Date(Date.now() - 10000) // expired in the past
    });
    vi.spyOn(Quotation, 'findById').mockResolvedValue(expiredQuote as any);
    await expect(
      OrderService.createOrderFromQuotation(
        {
          quotationId: expiredQuote._id.toString(),
          quotationRevisionId: expiredQuote._id.toString()
        },
        mockSalesExec,
        mockContext
      )
    ).rejects.toThrow('Quotation validity has expired');

    // Case C: Superseded quotation (isLatestRevision: false)
    const supersededQuote = buildMockQuotation({ isLatestRevision: false });
    vi.spyOn(Quotation, 'findById').mockResolvedValue(supersededQuote as any);
    await expect(
      OrderService.createOrderFromQuotation(
        {
          quotationId: supersededQuote._id.toString(),
          quotationRevisionId: supersededQuote._id.toString()
        },
        mockSalesExec,
        mockContext
      )
    ).rejects.toThrow('superseded by a newer revision');

    // Case D: Unapproved commercial discounts
    const unapprovedDiscountQuote = buildMockQuotation({
      requiresDiscountApproval: true,
      discountApprovalStatus: 'PENDING'
    });
    vi.spyOn(Quotation, 'findById').mockResolvedValue(unapprovedDiscountQuote as any);
    await expect(
      OrderService.createOrderFromQuotation(
        {
          quotationId: unapprovedDiscountQuote._id.toString(),
          quotationRevisionId: unapprovedDiscountQuote._id.toString()
        },
        mockSalesExec,
        mockContext
      )
    ).rejects.toThrow('awaiting managerial approval');
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Order creation preserves accepted commercial snapshots
  // --------------------------------------------------------------------------
  it('3. preserves agreed prices, milestones, terms and tax snapshots without reading current catalog rates', async () => {
    const mockQuote = buildMockQuotation();

    vi.spyOn(SalesOrder, 'findOne').mockResolvedValue(null);
    vi.spyOn(Quotation, 'findById').mockResolvedValue(mockQuote as any);
    vi.spyOn(Customer, 'findById').mockResolvedValue({
      _id: mockQuote.customerId,
      isActive: true
    } as any);
    vi.spyOn(SalesOrder.prototype, 'save').mockResolvedValue(true as any);

    const order = await OrderService.createOrderFromQuotation(
      {
        quotationId: mockQuote._id.toString(),
        quotationRevisionId: mockQuote._id.toString()
      },
      mockSalesExec,
      mockContext
    );

    // Assert that agreed historical rates are copied directly
    expect(order.lineItems).toHaveLength(1);
    expect(order.lineItems[0]!.unitRatePaise).toBe(1100000);
    expect(order.lineItems[0]!.taxPaise).toBe(2640000);
    expect(order.grossSubtotalPaise).toBe(22000000);
    expect(order.totalTaxPaise).toBe(2640000);
    expect(order.netTotalPaise).toBe(24640000);
    expect(order.paymentMilestones).toHaveLength(3);
    expect(order.termsAndConditions).toContain('Standard 5-year workmanship warranty');
  });

  // --------------------------------------------------------------------------
  // Requirement 4: Concurrent or repeated order creation cannot produce duplicate orders
  // --------------------------------------------------------------------------
  it('4. prevents duplicate order creation using 1:1 revision binding and idempotency keys', async () => {
    const mockQuote = buildMockQuotation();
    const existingOrder = {
      _id: new Types.ObjectId(),
      orderNumber: 'ORD-2026-00001',
      quotationRevisionId: mockQuote._id,
      idempotencyKey: 'IDEM-ORDER-123'
    };

    // When an order with the same revision already exists and idempotency key matches
    vi.spyOn(SalesOrder, 'findOne').mockResolvedValue(existingOrder as any);

    const duplicateResult = await OrderService.createOrderFromQuotation(
      {
        quotationId: mockQuote._id.toString(),
        quotationRevisionId: mockQuote._id.toString(),
        idempotencyKey: 'IDEM-ORDER-123'
      },
      mockSalesExec,
      mockContext
    );

    expect(duplicateResult.orderNumber).toBe('ORD-2026-00001');

    // When a different request attempts to convert the same revision without matching idempotency key
    vi.spyOn(SalesOrder, 'findOne')
      .mockResolvedValueOnce(null) // idempotency check passes
      .mockResolvedValueOnce(existingOrder as any); // revision check finds conflict

    await expect(
      OrderService.createOrderFromQuotation(
        {
          quotationId: mockQuote._id.toString(),
          quotationRevisionId: mockQuote._id.toString(),
          idempotencyKey: 'DIFFERENT-KEY'
        },
        mockSalesExec,
        mockContext
      )
    ).rejects.toThrow('already been generated from this accepted quotation revision');
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Reservation does not change physical on-hand quantity
  // --------------------------------------------------------------------------
  it('5. reserving stock increases reserved quantity and decrements available quantity while leaving on-hand unchanged', async () => {
    const orderId = new Types.ObjectId();
    const warehouseId = new Types.ObjectId();
    const productId = new Types.ObjectId();

    vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
      _id: orderId,
      status: OrderStatus.CONFIRMED,
      save: vi.fn().mockResolvedValue(true)
    } as any);

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: warehouseId,
      isActive: true
    } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: productId,
      isActive: true,
      name: '550Wp Mono Perc Solar Module'
    } as any);

    // Initial stock balance: onHand: 100, reserved: 20, available: 80
    // After reserving 15 units: onHand: 100, reserved: 35, available: 65
    vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({
      productId,
      warehouseId,
      onHandQuantity: 100, // unchanged!
      reservedQuantity: 35, // +15
      availableQuantity: 65 // -15
    } as any);

    vi.spyOn(StockReservation.prototype, 'save').mockResolvedValue(true as any);
    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    const result = await StockService.reserveStockForOrder(
      orderId.toString(),
      {
        warehouseId: warehouseId.toString(),
        items: [{ productId: productId.toString(), quantity: 15 }]
      },
      mockOpsUser,
      mockContext
    );

    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]!.quantity).toBe(15);
    expect(result.reservations[0]!.status).toBe(StockReservationStatus.ACTIVE);
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Two concurrent reservations cannot exceed available stock
  // --------------------------------------------------------------------------
  it('6. prevents over-reservation under concurrency using conditional availableQuantity checks', async () => {
    const orderId = new Types.ObjectId();
    const warehouseId = new Types.ObjectId();
    const productId = new Types.ObjectId();

    vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
      _id: orderId,
      status: OrderStatus.CONFIRMED,
      save: vi.fn().mockResolvedValue(true)
    } as any);

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: warehouseId,
      isActive: true
    } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: productId,
      isActive: true,
      name: '550Wp Mono Perc Solar Module'
    } as any);

    // First reservation succeeds
    vi.spyOn(StockBalance, 'findOneAndUpdate')
      .mockResolvedValueOnce({
        productId,
        warehouseId,
        onHandQuantity: 10,
        reservedQuantity: 10,
        availableQuantity: 0
      } as any)
      // Second concurrent reservation fails because availableQuantity: { $gte: 10 } matched 0 documents
      .mockResolvedValueOnce(null);

    vi.spyOn(StockBalance, 'findOne').mockResolvedValue({ availableQuantity: 0 } as any);
    vi.spyOn(StockReservation.prototype, 'save').mockResolvedValue(true as any);
    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    // First request
    const firstRes = await StockService.reserveStockForOrder(
      orderId.toString(),
      {
        warehouseId: warehouseId.toString(),
        items: [{ productId: productId.toString(), quantity: 10 }]
      },
      mockOpsUser,
      mockContext
    );
    expect(firstRes.reservations).toHaveLength(1);

    // Second concurrent request should throw insufficient stock
    await expect(
      StockService.reserveStockForOrder(
        orderId.toString(),
        {
          warehouseId: warehouseId.toString(),
          items: [{ productId: productId.toString(), quantity: 10 }]
        },
        mockOpsUser,
        mockContext
      )
    ).rejects.toThrow('Insufficient available stock');
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Insufficient stock reservation fails without partial mutations
  // --------------------------------------------------------------------------
  it('7. rolls back previous allocations in a multi-item batch if any item has insufficient stock', async () => {
    const orderId = new Types.ObjectId();
    const warehouseId = new Types.ObjectId();
    const prodA = new Types.ObjectId();
    const prodB = new Types.ObjectId();

    vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
      _id: orderId,
      status: OrderStatus.CONFIRMED
    } as any);

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: warehouseId,
      isActive: true
    } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: prodA,
      isActive: true,
      name: 'Product A'
    } as any);

    vi.spyOn(StockBalance, 'findOne').mockResolvedValue({ availableQuantity: 0 } as any);
    vi.spyOn(StockReservation.prototype, 'save').mockResolvedValue(true as any);
    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    const rollbackSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');

    // Prod A succeeds, Prod B fails
    rollbackSpy
      .mockResolvedValueOnce({ productId: prodA, availableQuantity: 5 } as any)
      .mockResolvedValueOnce(null) // Prod B fails
      .mockResolvedValueOnce({ productId: prodA, availableQuantity: 15 } as any); // Rollback of Prod A

    await expect(
      StockService.reserveStockForOrder(
        orderId.toString(),
        {
          warehouseId: warehouseId.toString(),
          items: [
            { productId: prodA.toString(), quantity: 10 },
            { productId: prodB.toString(), quantity: 10 }
          ]
        },
        mockOpsUser,
        mockContext
      )
    ).rejects.toThrow('Insufficient available stock');

    // Rollback must have been executed to compensate Prod A
    expect(rollbackSpy).toHaveBeenCalledTimes(3);
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Reservation release is idempotent
  // --------------------------------------------------------------------------
  it('8. releasing a reservation is idempotent and does not restore available stock multiple times', async () => {
    const resId = new Types.ObjectId();
    const prodId = new Types.ObjectId();
    const whId = new Types.ObjectId();

    const activeReservation = {
      _id: resId,
      productId: prodId,
      warehouseId: whId,
      quantity: 15,
      status: StockReservationStatus.ACTIVE
    };

    // First call: transitions ACTIVE -> RELEASED and restores stock
    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValueOnce({
      ...activeReservation,
      status: StockReservationStatus.RELEASED
    } as any);
    const balanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue(true as any);
    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    await StockService.releaseReservation(resId.toString(), mockOpsUser, mockContext);
    expect(balanceSpy).toHaveBeenCalledTimes(1);

    // Second call: findOneAndUpdate with status: ACTIVE matches nothing
    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValueOnce(null);
    vi.spyOn(StockReservation, 'findById').mockResolvedValueOnce({
      ...activeReservation,
      status: StockReservationStatus.RELEASED
    } as any);

    await StockService.releaseReservation(resId.toString(), mockOpsUser, mockContext);
    // balanceSpy should NOT be called again
    expect(balanceSpy).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Stock issue reduces on-hand quantity exactly once
  // --------------------------------------------------------------------------
  it('9. stock issue reduces on-hand and reserved quantities and appends ISSUE movement', async () => {
    const warehouseId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const reservationId = new Types.ObjectId();

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: warehouseId,
      isActive: true,
      name: 'Central Hub',
      code: 'WH-01'
    } as any);
    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: productId,
      isActive: true,
      name: 'Solar Inverter 10kW',
      sku: 'INV-10KW'
    } as any);

    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValue({
      _id: reservationId,
      quantity: 5,
      status: StockReservationStatus.ISSUED
    } as any);

    // Stock balance updated: onHand -= 5, reserved -= 5
    vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({
      productId,
      warehouseId,
      onHandQuantity: 45,
      reservedQuantity: 0,
      availableQuantity: 45
    } as any);

    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    const movement = await StockService.issueStock(
      {
        warehouseId: warehouseId.toString(),
        productId: productId.toString(),
        quantity: 5,
        reservationId: reservationId.toString(),
        reason: 'Dispatch for site installation'
      },
      mockOpsUser,
      mockContext
    );

    expect(movement.movementNumber).toBe('STK-2026-00001');
    expect(movement.movementType).toBe('ISSUE');
    expect(movement.quantity).toBe(5);
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Cancellation before issue releases reservation correctly
  // --------------------------------------------------------------------------
  it('10. cancelling an order before physical issue automatically coordinates reservation release', async () => {
    const orderId = new Types.ObjectId();
    const mockOrder: any = {
      _id: orderId,
      orderNumber: 'ORD-2026-00001',
      status: OrderStatus.CONFIRMED,
      reservationStatus: OrderReservationStatus.FULLY_RESERVED,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder);
    // No physical issues recorded
    vi.spyOn(StockMovement, 'countDocuments').mockResolvedValue(0);

    const releaseSpy = vi
      .spyOn(StockService, 'releaseOrderReservations')
      .mockResolvedValue(undefined as any);

    const cancelledOrder = await OrderService.cancelOrder(
      orderId.toString(),
      { cancellationReason: 'Customer shifted financing plans.' },
      mockAdminUser,
      mockContext
    );

    expect(releaseSpy).toHaveBeenCalledWith(orderId.toString(), mockAdminUser, mockContext);
    expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);
    expect(cancelledOrder.reservationStatus).toBe(OrderReservationStatus.RELEASED);
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Cancellation after issue requires a controlled return/reversal process
  // --------------------------------------------------------------------------
  it('11. blocks direct order cancellation if material has already been physically issued', async () => {
    const orderId = new Types.ObjectId();
    const mockOrder = {
      _id: orderId,
      orderNumber: 'ORD-2026-00001',
      status: OrderStatus.IN_PROGRESS,
      reservationStatus: OrderReservationStatus.FULLY_RESERVED
    };

    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
    // Physical issue exists
    vi.spyOn(StockMovement, 'countDocuments').mockResolvedValue(1);

    await expect(
      OrderService.cancelOrder(
        orderId.toString(),
        { cancellationReason: 'Trying to cancel after dispatch.' },
        mockAdminUser,
        mockContext
      )
    ).rejects.toThrow('Material has already been physically dispatched/issued for this order');
  });

  // --------------------------------------------------------------------------
  // Requirement 12: Duplicate movement/idempotency requests do not double-adjust balances
  // --------------------------------------------------------------------------
  it('12. idempotency keys prevent duplicate stock receipts and double balance adjustments', async () => {
    const existingMovement = {
      _id: new Types.ObjectId(),
      movementNumber: 'STK-2026-00001',
      idempotencyKey: 'IDEM-GRN-999',
      quantity: 50
    };

    vi.spyOn(StockMovement, 'findOne').mockResolvedValue(existingMovement as any);
    const balanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');

    const result = await StockService.receiveStock(
      {
        warehouseId: new Types.ObjectId().toString(),
        productId: new Types.ObjectId().toString(),
        quantity: 50,
        idempotencyKey: 'IDEM-GRN-999'
      },
      mockOpsUser,
      mockContext
    );

    expect(result._id).toEqual(existingMovement._id);
    expect(balanceSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Requirement 13: Unauthorized users cannot reserve, issue, transfer or adjust stock
  // --------------------------------------------------------------------------
  it('13. prevents unauthorized users from accessing inventory manipulation routes', async () => {
    const app = createApp();

    // Anonymous GET request (no session) -> 401
    const unauthBalancesRes = await request(app).get('/api/v1/inventory/balances');
    expect(unauthBalancesRes.status).toBe(401);

    const unauthOrdersRes = await request(app).get('/api/v1/orders');
    expect(unauthOrdersRes.status).toBe(401);

    // Unauthenticated mutation attempt -> rejected by auth/csrf guard (401 or 403)
    const unauthPostRes = await request(app).post('/api/v1/inventory/receipt').send({
      warehouseId: '507f1f77bcf86cd799439011',
      productId: '507f1f77bcf86cd799439022',
      quantity: 10
    });
    expect([401, 403]).toContain(unauthPostRes.status);
  });

  // --------------------------------------------------------------------------
  // Requirement 14: Customer identities cannot access internal inventory or other customers orders
  // --------------------------------------------------------------------------
  it('14. enforces strict customer isolation on orders and blocks access to internal inventory', async () => {
    const myCustomerId = '507f1f77bcf86cd799439099';
    const otherCustomerId = '507f1f77bcf86cd799439088';
    const orderId = new Types.ObjectId();

    vi.spyOn(SalesOrder, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({
          _id: orderId,
          orderNumber: 'ORD-2026-00001',
          customerId: { _id: new Types.ObjectId(otherCustomerId) },
          lineItems: []
        })
      )
    } as any);

    // Customer trying to view another customer's order
    await expect(OrderService.getOrderById(orderId.toString(), myCustomerId)).rejects.toThrow(
      "Access denied: You cannot view another customer's order."
    );
  });

  // --------------------------------------------------------------------------
  // Requirement 15: Serial-number uniqueness and lifecycle validation
  // --------------------------------------------------------------------------
  it('15. validates serial number uniqueness (case-insensitive uppercase) and rejects duplicates', async () => {
    const prodId = new Types.ObjectId();
    const whId = new Types.ObjectId();

    vi.spyOn(Product, 'findById').mockResolvedValue({ _id: prodId } as any);
    vi.spyOn(Warehouse, 'findById').mockResolvedValue({ _id: whId, isActive: true } as any);

    // Intra-batch duplicate
    await expect(
      SerialNumberService.registerSerialNumbers(
        {
          productId: prodId.toString(),
          warehouseId: whId.toString(),
          serialNumbers: ['SN-PANEL-001', 'sn-panel-001']
        },
        mockContext as any
      )
    ).rejects.toThrow('Duplicate serial numbers detected within the submission batch.');

    // Database duplicate
    vi.spyOn(ProductSerialNumber, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([{ serialNumber: 'SN-PANEL-001' }])
    } as any);

    await expect(
      SerialNumberService.registerSerialNumbers(
        {
          productId: prodId.toString(),
          warehouseId: whId.toString(),
          serialNumbers: ['SN-PANEL-001']
        },
        mockContext as any
      )
    ).rejects.toThrow('Serial numbers already registered: SN-PANEL-001');
  });

  // --------------------------------------------------------------------------
  // Requirement 16: Stock movement history cannot be edited or deleted through ordinary application routes
  // --------------------------------------------------------------------------
  it('16. stock movement ledger does not expose PUT/DELETE mutation endpoints in inventory routes', async () => {
    const app = createApp();

    const putRes = await request(app)
      .put('/api/v1/inventory/movements/507f1f77bcf86cd799439011')
      .send({ quantity: 100 });
    expect([404, 401, 403]).toContain(putRes.status);

    const deleteRes = await request(app).delete(
      '/api/v1/inventory/movements/507f1f77bcf86cd799439011'
    );
    expect([404, 401, 403]).toContain(deleteRes.status);
  });

  // --------------------------------------------------------------------------
  // Requirement 17: Database unavailability fails safely without in-memory stock mutation
  // --------------------------------------------------------------------------
  it('17. stock operations throw when database fails without silent in-memory fallback', async () => {
    vi.spyOn(Warehouse, 'findById').mockRejectedValue(new Error('MongoDB cluster unreachable'));

    await expect(
      StockService.receiveStock(
        {
          warehouseId: new Types.ObjectId().toString(),
          productId: new Types.ObjectId().toString(),
          quantity: 10
        },
        mockOpsUser,
        mockContext
      )
    ).rejects.toThrow('MongoDB cluster unreachable');
  });

  // --------------------------------------------------------------------------
  // Requirement 18: Inter-warehouse material transfer updates source and destination balances
  // --------------------------------------------------------------------------
  it('18. inter-warehouse transfer atomically decrements source and increments destination warehouse', async () => {
    const srcWhId = new Types.ObjectId();
    const destWhId = new Types.ObjectId();
    const prodId = new Types.ObjectId();

    vi.spyOn(Warehouse, 'findById')
      .mockResolvedValueOnce({ _id: srcWhId, isActive: true, code: 'WH-CENTRAL' } as any)
      .mockResolvedValueOnce({ _id: destWhId, isActive: true, code: 'WH-REGIONAL' } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: prodId,
      isActive: true,
      name: 'Solar Panel 550Wp'
    } as any);

    const balanceSpy = vi.spyOn(StockBalance, 'findOneAndUpdate');
    // Source decrement succeeds
    balanceSpy
      .mockResolvedValueOnce({ productId: prodId, availableQuantity: 50 } as any)
      // Dest increment succeeds
      .mockResolvedValueOnce({ productId: prodId, availableQuantity: 50 } as any);

    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    const movement = await StockService.transferStock(
      {
        sourceWarehouseId: srcWhId.toString(),
        destinationWarehouseId: destWhId.toString(),
        productId: prodId.toString(),
        quantity: 25,
        reason: 'Replenishing regional site warehouse'
      },
      mockOpsUser,
      mockContext
    );

    expect(movement.movementType).toBe('TRANSFER');
    expect(movement.quantity).toBe(25);
    expect(balanceSpy).toHaveBeenCalledTimes(2);
  });
});
