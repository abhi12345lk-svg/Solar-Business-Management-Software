import { describe, it, expect } from 'vitest';
import {
  createVendorSchema,
  createPurchaseOrderSchema,
  createGoodsReceiptSchema,
  createVendorInvoiceSchema,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  VendorInvoiceStatus,
  SequenceEntityType
} from '../index.js';

describe('Phase 5B — Shared Procurement Schemas', () => {
  it('validates a valid vendor creation payload', () => {
    const validVendor = {
      name: 'Adani Solar Manufacturing Ltd',
      contactPerson: 'Rajesh Sharma',
      email: 'sales@adanisolar.com',
      phone: '+919876543210',
      address: {
        addressLine1: 'Mundra SEZ',
        city: 'Kutch',
        state: 'Gujarat',
        postalCode: '370421',
        country: 'India'
      },
      gstin: '24AAACA1234A1Z5',
      pan: 'AAACA1234A',
      paymentTermsDays: 45
    };

    const result = createVendorSchema.safeParse(validVendor);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid GSTIN for a vendor', () => {
    const invalidVendor = {
      name: 'ABC Solar Ltd',
      gstin: 'INVALID_GSTIN_123'
    };

    const result = createVendorSchema.safeParse(invalidVendor);
    expect(result.success).toBe(false);
  });

  it('validates a purchase order with positive quantities and integer paise rates', () => {
    const validPO = {
      vendorId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439022',
      lineItems: [
        {
          productId: '507f1f77bcf86cd799439033',
          orderedQuantity: 20,
          unitPurchaseRatePaise: 1850000, // ₹18,500.00
          discountPaise: 0,
          gstRate: 12
        }
      ],
      isInterState: true
    };

    const result = createPurchaseOrderSchema.safeParse(validPO);
    expect(result.success).toBe(true);
  });

  it('rejects a purchase order with empty line items or negative purchase rate', () => {
    const emptyLineItems = {
      vendorId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439022',
      lineItems: []
    };
    expect(createPurchaseOrderSchema.safeParse(emptyLineItems).success).toBe(false);

    const negativeRate = {
      vendorId: '507f1f77bcf86cd799439011',
      destinationWarehouseId: '507f1f77bcf86cd799439022',
      lineItems: [
        {
          productId: '507f1f77bcf86cd799439033',
          orderedQuantity: 10,
          unitPurchaseRatePaise: -500
        }
      ]
    };
    expect(createPurchaseOrderSchema.safeParse(negativeRate).success).toBe(false);
  });

  it('validates Goods Receipt Note (GRN) input', () => {
    const validGRN = {
      purchaseOrderId: '507f1f77bcf86cd799439044',
      lineItems: [
        {
          productId: '507f1f77bcf86cd799439033',
          deliveredQuantity: 20,
          acceptedQuantity: 18,
          rejectedQuantity: 2,
          rejectionReason: 'Glass micro-cracks detected during visual QA',
          serialNumbers: ['MOD-2026-001', 'MOD-2026-002']
        }
      ],
      deliveryChallanNumber: 'DC-8891'
    };

    const result = createGoodsReceiptSchema.safeParse(validGRN);
    expect(result.success).toBe(true);
  });

  it('validates Vendor Invoice creation input', () => {
    const validInvoice = {
      vendorId: '507f1f77bcf86cd799439011',
      purchaseOrderId: '507f1f77bcf86cd799439044',
      vendorInvoiceNumber: 'INV-2026-9901',
      invoiceDate: new Date().toISOString(),
      subtotalPaise: 37000000,
      taxAmountPaise: 4440000,
      totalAmountPaise: 41440000
    };

    const result = createVendorInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it('verifies procurement enums exist', () => {
    expect(PurchaseOrderStatus.DRAFT).toBe('DRAFT');
    expect(PurchaseOrderStatus.APPROVED).toBe('APPROVED');
    expect(PurchaseOrderStatus.PARTIALLY_RECEIVED).toBe('PARTIALLY_RECEIVED');
    expect(PurchaseOrderStatus.FULLY_RECEIVED).toBe('FULLY_RECEIVED');
    expect(GoodsReceiptStatus.COMPLETED).toBe('COMPLETED');
    expect(VendorInvoiceStatus.RECONCILED).toBe('RECONCILED');
    expect(SequenceEntityType.VENDOR).toBe('VENDOR');
    expect(SequenceEntityType.GOODS_RECEIPT).toBe('GOODS_RECEIPT');
  });
});
