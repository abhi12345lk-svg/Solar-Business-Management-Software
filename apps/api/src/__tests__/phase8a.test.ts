/**
 * INS Solar Business Management Software — Phase 8A Integration Tests
 *
 * Comprehensive test suite for Customer Payments, Allocations, Receivables & Outstanding:
 * - Payment creation with atomic sequence generation (REC-YYYY-NNNNN) and positive paise validation
 * - Duplicate external transaction reference (UTR/Cheque) prevention within customer scope
 * - Idempotency key replay protection
 * - Payment verification lifecycle (RECORDED -> VERIFIED)
 * - Payment allocation to Sales Orders with atomic sequence (ALC-YYYY-NNNNN)
 * - Rejection of unverified payment allocation
 * - Rejection of cross-customer allocation
 * - Payment over-allocation prevention (exceeding unallocated balance)
 * - Order over-allocation prevention (exceeding order collectible amount)
 * - Order receivables calculation (UNPAID, PARTIALLY_PAID, PAID)
 * - Allocation reversal with payment balance restoration
 * - Payment reversal with cascading allocation reversal
 * - Refund from unallocated balance
 * - Customer receivables statement with aging breakdown
 * - Operational payment receipt generation with legal disclaimer
 * - Customer portal isolation and internal notes redaction
 * - 401 Unauthorized guards on secured routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  PaymentMethod,
  CustomerPaymentStatus,
  PaymentAllocationStatus,
  UserRole,
  OrderStatus
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Customer } from '../models/Customer.js';
import { User } from '../models/User.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { CustomerPayment } from '../models/CustomerPayment.js';
import { PaymentAllocation } from '../models/PaymentAllocation.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { PaymentService } from '../services/paymentService.js';
import { AuditService } from '../services/auditService.js';

describe('Phase 8A Integration: Customer Payments, Allocations & Receivables', () => {
  let app: any;
  const adminUserId = new Types.ObjectId().toString();
  const sampleCustomerId = new Types.ObjectId().toString();
  const foreignCustomerId = new Types.ObjectId().toString();
  const sampleOrderId = new Types.ObjectId().toString();

  const makePopulateQuery = (doc: any) => {
    const query: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(doc),
      exec: vi.fn().mockResolvedValue(doc)
    };
    query.then = (resolve: any) => Promise.resolve(doc).then(resolve);
    return query;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();

    // Default User mock
    vi.spyOn(User, 'findById').mockImplementation(((id: any) => {
      const uId = id?._id || id;
      const userDoc = {
        _id: new Types.ObjectId(uId?.toString() || adminUserId),
        firstName: 'Ananya',
        lastName: 'Iyer',
        email: 'accounts@inssolar.com',
        role: UserRole.ACCOUNTS_OFFICER,
        isActive: true
      };
      return makePopulateQuery(userDoc) as any;
    }) as any);

    // Default Customer mock
    vi.spyOn(Customer, 'findById').mockImplementation(((id: any) => {
      const custDoc = {
        _id: new Types.ObjectId(id?.toString() || sampleCustomerId),
        customerCode: 'CUST-2026-00001',
        name: 'Vikram Mehta',
        primaryPhone: '9876543210',
        email: 'vikram.mehta@example.com',
        billingAddress: {
          line1: '42 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001'
        }
      };
      return makePopulateQuery(custDoc) as any;
    }) as any);

    // Default CompanySettings mock
    vi.spyOn(CompanySettings, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        companyName: 'INS Solar Solutions Pvt Ltd',
        tradingName: 'INS Solar',
        cin: 'U40106DL2024PTC123456',
        pan: 'AAACI1234F',
        gstin: '07AAACI1234F1Z5',
        primaryEmail: 'info@inssolar.com',
        primaryPhone: '+91 80 1234 5678',
        registeredAddress: {
          line1: 'Unit 402, Green Energy Park',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          country: 'India'
        }
      })
    } as any);
  });

  // --------------------------------------------------------------------------
  // 1. Payment Creation with Atomic Sequence & Amount Validation
  // --------------------------------------------------------------------------
  it('records a customer payment with atomic sequence REC-YYYY-NNNNN and initializes unallocated quota', async () => {
    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      name: 'Vikram Mehta'
    };
    vi.spyOn(Customer, 'findById').mockReturnValue(makePopulateQuery(mockCustomer) as any);
    vi.spyOn(CustomerPayment, 'findOne').mockResolvedValue(null);

    vi.spyOn(CustomerPayment.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const payment = await PaymentService.recordPayment(
      {
        customerId: sampleCustomerId,
        amountPaise: 15000000, // Rs. 150,000.00
        paymentDate: new Date('2026-10-25'),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: 'NEFT2026102500123',
        notes: 'Advance for rooftop solar installation',
        internalNotes: 'Verified against HDFC Current Account credit'
      },
      { userId: adminUserId, role: UserRole.ACCOUNTS_OFFICER }
    );

    expect(payment.receiptNumber).toMatch(/^REC-\d{4}-\d{5}$/);
    expect(payment.status).toBe(CustomerPaymentStatus.RECORDED);
    expect(payment.amountPaise).toBe(15000000);
    expect(payment.unallocatedAmountPaise).toBe(15000000);
    expect(payment.allocatedAmountPaise).toBe(0);
    expect(payment.statusHistory.length).toBe(1);
    expect(payment.statusHistory[0]?.toStatus).toBe(CustomerPaymentStatus.RECORDED);
  });

  it('rejects recording a payment when customer does not exist', async () => {
    vi.spyOn(Customer, 'findById').mockReturnValue(makePopulateQuery(null) as any);

    await expect(
      PaymentService.recordPayment(
        {
          customerId: sampleCustomerId,
          amountPaise: 5000000,
          paymentDate: new Date(),
          paymentMethod: PaymentMethod.UPI,
          transactionReference: 'UPI123456789'
        },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/Customer.*not found/i);
  });

  // --------------------------------------------------------------------------
  // 2. Duplicate Transaction Reference & Idempotency Key
  // --------------------------------------------------------------------------
  it('rejects duplicate external transaction reference for the same customer', async () => {
    vi.spyOn(Customer, 'findById').mockReturnValue(
      makePopulateQuery({ _id: new Types.ObjectId(sampleCustomerId) }) as any
    );
    vi.spyOn(CustomerPayment, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      receiptNumber: 'REC-2026-00001',
      transactionReference: 'DUP-UTR-999'
    } as any);

    await expect(
      PaymentService.recordPayment(
        {
          customerId: sampleCustomerId,
          amountPaise: 5000000,
          paymentDate: new Date(),
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: 'DUP-UTR-999'
        },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/already been recorded/i);
  });

  it('safely replays existing payment when same idempotency key is submitted', async () => {
    const existingPayment = {
      _id: new Types.ObjectId(),
      receiptNumber: 'REC-2026-00005',
      idempotencyKey: 'IDEMP-PAY-12345',
      amountPaise: 5000000,
      status: CustomerPaymentStatus.RECORDED
    };

    vi.spyOn(Customer, 'findById').mockReturnValue(
      makePopulateQuery({ _id: new Types.ObjectId(sampleCustomerId) }) as any
    );
    vi.spyOn(CustomerPayment, 'findOne').mockResolvedValue(existingPayment as any);

    const result = await PaymentService.recordPayment(
      {
        customerId: sampleCustomerId,
        amountPaise: 5000000,
        paymentDate: new Date(),
        paymentMethod: PaymentMethod.UPI,
        idempotencyKey: 'IDEMP-PAY-12345'
      },
      { userId: adminUserId }
    );

    expect(result.receiptNumber).toBe('REC-2026-00005');
  });

  // --------------------------------------------------------------------------
  // 3. Payment Verification Lifecycle
  // --------------------------------------------------------------------------
  it('verifies a recorded payment and updates its status to VERIFIED', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      receiptNumber: 'REC-2026-00010',
      customerId: new Types.ObjectId(sampleCustomerId),
      amountPaise: 10000000,
      status: CustomerPaymentStatus.RECORDED,
      statusHistory: [],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      })
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    const recordEventSpy = vi.spyOn(AuditService, 'recordEvent').mockResolvedValue({} as any);

    const verified = await PaymentService.verifyPayment(
      mockPayment._id.toString(),
      {
        verificationNotes: 'Bank statement line item matched at 11:30 AM',
        verifiedDate: new Date()
      },
      { userId: adminUserId }
    );

    expect(verified.status).toBe(CustomerPaymentStatus.VERIFIED);
    expect(verified.verifiedBy).toBeDefined();
    expect(verified.verifiedAt).toBeDefined();
    expect(recordEventSpy).toHaveBeenCalled();
  });

  it('rejects verifying a payment that is not in RECORDED status', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      status: CustomerPaymentStatus.VERIFIED
    };
    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);

    await expect(
      PaymentService.verifyPayment(
        mockPayment._id.toString(),
        { verificationNotes: 'Already verified' },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/Only RECORDED payments can be verified/i);
  });

  // --------------------------------------------------------------------------
  // 4. Payment Allocation to Sales Orders & Validation Invariants
  // --------------------------------------------------------------------------
  it('allocates verified payment to an eligible sales order of the same customer', async () => {
    const paymentId = new Types.ObjectId().toString();
    const mockPayment = {
      _id: new Types.ObjectId(paymentId),
      receiptNumber: 'REC-2026-00020',
      customerId: new Types.ObjectId(sampleCustomerId),
      amountPaise: 10000000,
      unallocatedAmountPaise: 10000000,
      allocatedAmountPaise: 0,
      status: CustomerPaymentStatus.VERIFIED
    };

    const mockOrder = {
      _id: new Types.ObjectId(sampleOrderId),
      orderNumber: 'SO-2026-00001',
      customerId: new Types.ObjectId(sampleCustomerId),
      status: OrderStatus.CONFIRMED,
      netTotalPaise: 25000000
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
    vi.spyOn(PaymentAllocation, 'aggregate').mockResolvedValue([{ _id: null, total: 0 }]);

    vi.spyOn(PaymentAllocation.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    vi.spyOn(CustomerPayment, 'findOneAndUpdate').mockResolvedValue({
      ...mockPayment,
      unallocatedAmountPaise: 2000000,
      allocatedAmountPaise: 8000000
    } as any);

    const result = await PaymentService.allocatePayment(
      paymentId,
      {
        salesOrderId: sampleOrderId,
        allocatedAmountPaise: 8000000, // Rs. 80,000.00
        notes: 'Part payment for inverter and panels'
      },
      { userId: adminUserId }
    );

    expect(result.allocation.allocationNumber).toMatch(/^ALC-\d{4}-\d{5}$/);
    expect(result.allocation.allocatedAmountPaise).toBe(8000000);
    expect(result.allocation.status).toBe(PaymentAllocationStatus.ACTIVE);
    expect(result.remainingOrderCollectiblePaise).toBe(17000000); // 250k - 80k = 170k
  });

  it('rejects allocating an unverified (RECORDED) payment', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: CustomerPaymentStatus.RECORDED,
      unallocatedAmountPaise: 10000000
    };
    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);

    await expect(
      PaymentService.allocatePayment(
        mockPayment._id.toString(),
        { salesOrderId: sampleOrderId, allocatedAmountPaise: 5000000 },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/Only VERIFIED payments can be allocated/i);
  });

  it('rejects cross-customer allocation when payment and order belong to different customers', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: CustomerPaymentStatus.VERIFIED,
      unallocatedAmountPaise: 10000000
    };
    const foreignOrder = {
      _id: new Types.ObjectId(sampleOrderId),
      customerId: new Types.ObjectId(foreignCustomerId), // Different customer!
      status: OrderStatus.CONFIRMED,
      netTotalPaise: 10000000
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(foreignOrder as any);

    await expect(
      PaymentService.allocatePayment(
        mockPayment._id.toString(),
        { salesOrderId: sampleOrderId, allocatedAmountPaise: 5000000 },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/Cross-customer/i);
  });

  it('rejects allocation when amount exceeds payment unallocated balance', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: CustomerPaymentStatus.VERIFIED,
      amountPaise: 10000000,
      unallocatedAmountPaise: 2000000 // Only 20k left
    };
    const mockOrder = {
      _id: new Types.ObjectId(sampleOrderId),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: OrderStatus.CONFIRMED,
      netTotalPaise: 20000000
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
    vi.spyOn(CustomerPayment, 'findOneAndUpdate').mockResolvedValue(null); // Atomic condition fails

    await expect(
      PaymentService.allocatePayment(
        mockPayment._id.toString(),
        { salesOrderId: sampleOrderId, allocatedAmountPaise: 5000000 }, // Requesting 50k
        { userId: adminUserId }
      )
    ).rejects.toThrow(/exceeds available unallocated payment balance/i);
  });

  it('rejects allocation when amount exceeds order remaining collectible balance', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: CustomerPaymentStatus.VERIFIED,
      amountPaise: 20000000,
      unallocatedAmountPaise: 20000000
    };
    const mockOrder = {
      _id: new Types.ObjectId(sampleOrderId),
      customerId: new Types.ObjectId(sampleCustomerId),
      status: OrderStatus.CONFIRMED,
      netTotalPaise: 5000000 // Order net total is only 50k
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
    vi.spyOn(CustomerPayment, 'findOneAndUpdate').mockResolvedValue(mockPayment as any);
    vi.spyOn(CustomerPayment, 'findByIdAndUpdate').mockResolvedValue({} as any);
    // Already allocated 40k
    vi.spyOn(PaymentAllocation, 'aggregate').mockResolvedValue([{ _id: null, total: 4000000 }]);

    await expect(
      PaymentService.allocatePayment(
        mockPayment._id.toString(),
        { salesOrderId: sampleOrderId, allocatedAmountPaise: 2000000 }, // Asking for 20k, but remaining is only 10k
        { userId: adminUserId }
      )
    ).rejects.toThrow(/exceeds order collectible balance/i);
  });

  // --------------------------------------------------------------------------
  // 5. Allocation Reversal & Payment Balance Restoration
  // --------------------------------------------------------------------------
  it('reverses an active allocation, restores payment unallocated amount and updates status', async () => {
    const allocationId = new Types.ObjectId().toString();
    const paymentId = new Types.ObjectId().toString();

    const mockAllocation = {
      _id: new Types.ObjectId(allocationId),
      allocationNumber: 'ALC-2026-00001',
      paymentId: new Types.ObjectId(paymentId),
      salesOrderId: new Types.ObjectId(sampleOrderId),
      customerId: new Types.ObjectId(sampleCustomerId),
      allocatedAmountPaise: 5000000,
      status: PaymentAllocationStatus.ACTIVE,
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      })
    };

    vi.spyOn(PaymentAllocation, 'findById').mockResolvedValue(mockAllocation as any);
    vi.spyOn(CustomerPayment, 'findByIdAndUpdate').mockResolvedValue({} as any);

    const reversed = await PaymentService.reverseAllocation(
      allocationId,
      { reversalReason: 'Customer requested reallocation to battery order' },
      { userId: adminUserId }
    );

    expect(reversed.status).toBe(PaymentAllocationStatus.REVERSED);
    expect(reversed.reversalReason).toBe('Customer requested reallocation to battery order');
    expect(CustomerPayment.findByIdAndUpdate).toHaveBeenCalledWith(mockAllocation.paymentId, {
      $inc: {
        allocatedAmountPaise: -5000000,
        unallocatedAmountPaise: 5000000
      }
    });
  });

  it('rejects reversing an already reversed allocation', async () => {
    const mockAllocation = {
      _id: new Types.ObjectId(),
      status: PaymentAllocationStatus.REVERSED
    };
    vi.spyOn(PaymentAllocation, 'findById').mockResolvedValue(mockAllocation as any);

    await expect(
      PaymentService.reverseAllocation(
        mockAllocation._id.toString(),
        { reversalReason: 'Duplicate reversal attempt' },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/already been reversed/i);
  });

  // --------------------------------------------------------------------------
  // 6. Payment Reversal & Cascading Allocation Reversal
  // --------------------------------------------------------------------------
  it('reverses confirmed payment and cascades reversal to all active allocations', async () => {
    const paymentId = new Types.ObjectId().toString();
    const mockPayment = {
      _id: new Types.ObjectId(paymentId),
      receiptNumber: 'REC-2026-00099',
      status: CustomerPaymentStatus.VERIFIED,
      amountPaise: 10000000,
      allocatedAmountPaise: 6000000,
      unallocatedAmountPaise: 4000000,
      statusHistory: [],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      })
    };

    const activeAllocations: any[] = [
      {
        _id: new Types.ObjectId(),
        allocationNumber: 'ALC-2026-00010',
        allocatedAmountPaise: 6000000,
        status: PaymentAllocationStatus.ACTIVE,
        reversalReason: undefined,
        save: vi.fn().mockImplementation(async function (this: any) {
          return this;
        })
      }
    ];

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);
    vi.spyOn(PaymentAllocation, 'find').mockResolvedValue(activeAllocations as any);

    const reversed = await PaymentService.reversePayment(
      paymentId,
      { reversalReason: 'Cheque bounced due to signature mismatch' },
      { userId: adminUserId }
    );

    expect(reversed.status).toBe(CustomerPaymentStatus.REVERSED);
    expect(reversed.reversalReason).toBe('Cheque bounced due to signature mismatch');
    expect(activeAllocations[0]?.status).toBe(PaymentAllocationStatus.REVERSED);
    expect(activeAllocations[0]?.reversalReason).toMatch(/Payment.*reversed/i);
  });

  // --------------------------------------------------------------------------
  // 7. Customer Refund from Unallocated Balance
  // --------------------------------------------------------------------------
  it('refunds from unallocated payment funds and updates status', async () => {
    const paymentId = new Types.ObjectId().toString();
    const mockPayment = {
      _id: new Types.ObjectId(paymentId),
      receiptNumber: 'REC-2026-00050',
      status: CustomerPaymentStatus.VERIFIED,
      amountPaise: 4000000,
      unallocatedAmountPaise: 4000000,
      allocatedAmountPaise: 0,
      statusHistory: [],
      save: vi.fn().mockImplementation(async function (this: any) {
        return this;
      })
    };

    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);

    const refunded = await PaymentService.refundPayment(
      paymentId,
      {
        refundAmountPaise: 4000000, // Refund entire 40k
        refundReason: 'Order cancelled, project design rejected by DISCOM',
        refundReference: 'REFUND-HDFC-99128',
        refundDate: new Date()
      },
      { userId: adminUserId }
    );

    expect(refunded.status).toBe(CustomerPaymentStatus.REFUNDED);
    expect(refunded.unallocatedAmountPaise).toBe(0);
    expect(refunded.refundAmountPaise).toBe(4000000);
  });

  it('rejects refund when requested amount exceeds unallocated balance', async () => {
    const mockPayment = {
      _id: new Types.ObjectId(),
      status: CustomerPaymentStatus.VERIFIED,
      unallocatedAmountPaise: 1000000 // Only 10k unallocated
    };
    vi.spyOn(CustomerPayment, 'findById').mockResolvedValue(mockPayment as any);

    await expect(
      PaymentService.refundPayment(
        mockPayment._id.toString(),
        {
          refundAmountPaise: 3000000, // Asking for 30k
          refundReason: 'Excess refund request',
          refundReference: 'REF-ERR'
        },
        { userId: adminUserId }
      )
    ).rejects.toThrow(/exceeds unallocated/i);
  });

  // --------------------------------------------------------------------------
  // 8. Receivables & Aging Calculation
  // --------------------------------------------------------------------------
  it('calculates customer receivables statement with aging breakdown and credits', async () => {
    const mockCustomer = {
      _id: new Types.ObjectId(sampleCustomerId),
      customerCode: 'CUST-2026-00001',
      name: 'Vikram Mehta'
    };
    vi.spyOn(Customer, 'findById').mockReturnValue(makePopulateQuery(mockCustomer) as any);

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45); // 45 days ago -> falls into 31-60 days bucket

    const orders = [
      {
        _id: new Types.ObjectId(sampleOrderId),
        orderNumber: 'SO-2026-00001',
        customerId: new Types.ObjectId(sampleCustomerId),
        createdAt: oldDate,
        orderDate: oldDate,
        netTotalPaise: 30000000,
        status: OrderStatus.CONFIRMED
      }
    ];
    vi.spyOn(SalesOrder, 'find').mockReturnValue(makePopulateQuery(orders) as any);

    // 100k allocated
    vi.spyOn(PaymentAllocation, 'find').mockReturnValue(
      makePopulateQuery([
        {
          _id: new Types.ObjectId(),
          salesOrderId: new Types.ObjectId(sampleOrderId),
          allocatedAmountPaise: 10000000,
          status: PaymentAllocationStatus.ACTIVE
        }
      ]) as any
    );

    // 20k unallocated credit
    vi.spyOn(CustomerPayment, 'find').mockReturnValue(
      makePopulateQuery([
        {
          _id: new Types.ObjectId(),
          amountPaise: 12000000,
          unallocatedAmountPaise: 2000000,
          status: CustomerPaymentStatus.VERIFIED
        }
      ]) as any
    );

    const statement = await PaymentService.getCustomerReceivables(sampleCustomerId);

    expect(statement.totalOrderValuePaise).toBe(30000000);
    expect(statement.totalAllocatedPaise).toBe(10000000);
    expect(statement.totalOutstandingPaise).toBe(20000000); // 300k - 100k
    expect(statement.totalUnallocatedCreditPaise).toBe(2000000);
    expect(statement.aging.overdue31To60Paise).toBe(20000000); // Correctly placed in 31-60 days bucket
    expect(statement.aging.current0To30Paise).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 9. Printable Operational Receipt Document
  // --------------------------------------------------------------------------
  it('generates an operational receipt document with company details, allocation and legal disclaimer', async () => {
    const paymentId = new Types.ObjectId().toString();
    const mockPayment = {
      _id: new Types.ObjectId(paymentId),
      receiptNumber: 'REC-2026-00077',
      customerId: {
        _id: new Types.ObjectId(sampleCustomerId),
        name: 'Vikram Mehta',
        customerCode: 'CUST-2026-00001',
        primaryPhone: '9876543210',
        email: 'vikram.mehta@example.com'
      },
      paymentDate: new Date('2026-10-26'),
      amountPaise: 10000000,
      paymentMethod: PaymentMethod.NEFT_RTGS,
      transactionReference: 'HDFC-NEFT-998877',
      status: CustomerPaymentStatus.VERIFIED,
      unallocatedAmountPaise: 2000000,
      allocatedAmountPaise: 8000000,
      verifiedAt: new Date('2026-10-26'),
      notes: 'Initial payment for EPC agreement',
      internalNotes: 'SECRET_INTERNAL_NOTE_DO_NOT_LEAK'
    };

    const mockAllocations = [
      {
        allocationNumber: 'ALC-2026-00001',
        allocatedAmountPaise: 8000000,
        createdAt: new Date('2026-10-26'),
        salesOrderId: {
          _id: new Types.ObjectId(sampleOrderId),
          orderNumber: 'SO-2026-00001',
          netTotalPaise: 20000000
        }
      }
    ];

    vi.spyOn(CustomerPayment, 'findById').mockReturnValue(makePopulateQuery(mockPayment));
    vi.spyOn(PaymentAllocation, 'find').mockReturnValue(makePopulateQuery(mockAllocations));

    // 1. Staff view includes internal notes
    const staffDoc = await PaymentService.getReceiptDocument(paymentId, {
      userId: adminUserId,
      role: UserRole.ACCOUNTS_OFFICER
    });
    expect(staffDoc.receiptNumber).toBe('REC-2026-00077');
    expect(staffDoc.company.companyName).toBe('INS Solar Solutions Pvt Ltd');
    expect(staffDoc.disclaimer).toMatch(/operational payment receipt confirming realization/i);
    expect(staffDoc.disclaimer).toMatch(/does not constitute a statutory Tax Invoice/i);
    expect(staffDoc.internalNotes).toBe('SECRET_INTERNAL_NOTE_DO_NOT_LEAK');

    // 2. Customer view redacts internal notes
    const customerDoc = await PaymentService.getReceiptDocument(paymentId, {
      isCustomer: true,
      customerId: sampleCustomerId
    });
    expect(customerDoc.receiptNumber).toBe('REC-2026-00077');
    expect(customerDoc.internalNotes).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 10. Customer Portal Isolation & Boundary Protection
  // --------------------------------------------------------------------------
  it('blocks customer portal user from accessing another customer payment receipt', async () => {
    const paymentId = new Types.ObjectId().toString();
    const mockPayment = {
      _id: new Types.ObjectId(paymentId),
      customerId: new Types.ObjectId(sampleCustomerId) // Belongs to sampleCustomerId
    };

    vi.spyOn(CustomerPayment, 'findById').mockReturnValue(makePopulateQuery(mockPayment));

    await expect(
      PaymentService.getReceiptDocument(paymentId, {
        isCustomer: true,
        customerId: foreignCustomerId // Foreign customer attempting access
      })
    ).rejects.toThrow(/access denied/i);
  });

  // --------------------------------------------------------------------------
  // 11. Endpoint Authentication Guards (401 Unauthorized)
  // --------------------------------------------------------------------------
  it('returns 401 Unauthorized for unauthenticated staff and portal routes', async () => {
    const res1 = await request(app).get('/api/v1/payments');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get(`/api/v1/payments/${sampleOrderId}`);
    expect(res2.status).toBe(401);

    const res3 = await request(app).get(
      `/api/v1/payments/receivables/customers/${sampleCustomerId}`
    );
    expect(res3.status).toBe(401);

    const res4 = await request(app).get('/api/v1/customer-portal/payments');
    expect(res4.status).toBe(401);
  });
});
