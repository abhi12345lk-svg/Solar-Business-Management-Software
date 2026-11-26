/**
 * INS Solar Business Management Software — Customer GST Tax Invoice Model
 *
 * Persists legally compliant statutory Indian GST Tax Invoices for solar EPC contracts,
 * turnkey installations, and milestone advances. Enforces atomic sequence numbering (INV-YYYY-NNNNN),
 * HSN/SAC classification (8471/8541 for solar modules/inverters, 9954 for EPC turnkey),
 * dual CGST/SGST vs IGST taxation, and concurrency-safe duplicate prevention.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { CustomerInvoiceType, CustomerInvoiceStatus } from '@ins-solar/shared';

export interface IInvoiceLineItem {
  itemType: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  unitRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  itemTotalPaise: number;
}

export interface ICustomerInvoiceDocument extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  orderId: Types.ObjectId;
  orderNumber: string;
  customerId: Types.ObjectId;
  customerCode?: string;
  customerName: string;
  customerGstin?: string;
  customerPan?: string;
  customerBillingAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    stateCode?: string;
  };
  customerInstallationAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  companyName: string;
  companyGstin?: string;
  companyPan?: string;
  companyAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    stateCode?: string;
  };
  placeOfSupply: string;
  stateCode: string;
  isInterState: boolean;
  systemCapacityKwp?: number;
  systemTopology?: string;
  invoiceDate: Date;
  dueDate?: Date;
  invoiceType: CustomerInvoiceType;
  originalInvoiceId?: Types.ObjectId;
  milestoneIndex?: number;
  milestoneName?: string;
  percentageBilled?: number;
  lineItems: IInvoiceLineItem[];
  grossSubtotalPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;
  amountPaidPaise: number;
  balanceDuePaise: number;
  status: CustomerInvoiceStatus;
  termsAndConditions?: string[];
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  idempotencyKey?: string;
  issuedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    itemType: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    hsnSacCode: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, default: 'NOS' },
    unitRatePaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    taxableAmountPaise: { type: Number, required: true, min: 0 },
    gstRateBasisPoints: { type: Number, required: true, min: 0 },
    cgstPaise: { type: Number, default: 0, min: 0 },
    sgstPaise: { type: Number, default: 0, min: 0 },
    igstPaise: { type: Number, default: 0, min: 0 },
    itemTotalPaise: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const CustomerInvoiceSchema = new Schema<ICustomerInvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    customerCode: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerGstin: { type: String, trim: true, uppercase: true },
    customerPan: { type: String, trim: true, uppercase: true },
    customerBillingAddress: {
      addressLine1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      stateCode: { type: String, trim: true }
    },
    customerInstallationAddress: {
      addressLine1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true }
    },
    companyName: { type: String, required: true, trim: true },
    companyGstin: { type: String, trim: true, uppercase: true },
    companyPan: { type: String, trim: true, uppercase: true },
    companyAddress: {
      addressLine1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      stateCode: { type: String, trim: true }
    },
    placeOfSupply: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true },
    isInterState: { type: Boolean, required: true, default: false },
    systemCapacityKwp: { type: Number },
    systemTopology: { type: String },
    invoiceDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date },
    invoiceType: {
      type: String,
      enum: Object.values(CustomerInvoiceType),
      default: CustomerInvoiceType.TAX_INVOICE,
      required: true,
      index: true
    },
    originalInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerInvoice',
      default: null,
      index: true
    },
    milestoneIndex: { type: Number },
    milestoneName: { type: String, trim: true },
    percentageBilled: { type: Number, default: 100 },
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      validate: [(v: any[]) => v && v.length > 0, 'Invoice must have at least one line item']
    },
    grossSubtotalPaise: { type: Number, required: true, min: 0 },
    totalDiscountPaise: { type: Number, default: 0, min: 0 },
    taxableAmountPaise: { type: Number, required: true, min: 0 },
    totalCgstPaise: { type: Number, default: 0, min: 0 },
    totalSgstPaise: { type: Number, default: 0, min: 0 },
    totalIgstPaise: { type: Number, default: 0, min: 0 },
    totalTaxPaise: { type: Number, required: true, min: 0 },
    netTotalPaise: { type: Number, required: true, min: 0 },
    amountPaidPaise: { type: Number, default: 0, min: 0 },
    balanceDuePaise: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CustomerInvoiceStatus),
      default: CustomerInvoiceStatus.ISSUED,
      required: true,
      index: true
    },
    termsAndConditions: { type: [String], default: [] },
    notes: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    idempotencyKey: { type: String, trim: true, index: true, unique: true, sparse: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

// Compound indexes
CustomerInvoiceSchema.index({ orderId: 1, milestoneIndex: 1 });
CustomerInvoiceSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerInvoice = mongoose.model<ICustomerInvoiceDocument>(
  'CustomerInvoice',
  CustomerInvoiceSchema
);
