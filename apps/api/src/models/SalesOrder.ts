/**
 * INS Solar Business Management Software — SalesOrder Model
 *
 * Confirmed customer sales contract converted from an approved, accepted quotation revision.
 * Locks the agreed line-item scope, pricing, integer paise totals, tax profile, and milestones.
 * Enforces database-level 1:1 binding to the originating quotation revision.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  OrderStatus,
  OrderReservationStatus,
  SolarTopology,
  QuotationItemType
} from '@ins-solar/shared';

export interface ISalesOrderLineItem {
  itemType: QuotationItemType;
  productId?: Types.ObjectId;
  skuSnapshot?: string;
  description: string;
  quantity: number;
  unit: string;
  unitRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  taxPaise: number;
  itemTotalPaise: number;
}

export interface ISalesOrderDocument extends Document {
  orderNumber: string;
  customerId: Types.ObjectId;
  quotationId: Types.ObjectId;
  quotationRevisionId: Types.ObjectId;
  solarDesignId?: Types.ObjectId;
  orderDate: Date;
  status: OrderStatus;
  systemTopology: SolarTopology;
  systemCapacityKwp: number;

  lineItems: ISalesOrderLineItem[];

  grossSubtotalPaise: number;
  additionalDiscountPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;

  taxProfile: {
    profileName: string;
    profileCode: string;
    effectiveDate: string;
    isInterState: boolean;
    accountingNotice: string;
  };

  paymentMilestones: Array<{
    name: string;
    percentage: number;
    description: string;
  }>;

  termsAndConditions: string[];
  reservationStatus: OrderReservationStatus;
  notes?: string;

  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;

  idempotencyKey?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SalesOrderLineItemSchema = new Schema<ISalesOrderLineItem>(
  {
    itemType: {
      type: String,
      enum: Object.values(QuotationItemType),
      required: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    skuSnapshot: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001
    },
    unit: {
      type: String,
      required: true,
      default: 'Nos'
    },
    unitRatePaise: {
      type: Number,
      required: true,
      min: 0
    },
    discountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    gstRateBasisPoints: {
      type: Number,
      required: true,
      min: 0,
      max: 2800
    },
    taxPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    itemTotalPaise: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const SalesOrderSchema = new Schema<ISalesOrderDocument>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
      required: true,
      index: true
    },
    quotationRevisionId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
      required: true,
      unique: true,
      index: true
    },
    solarDesignId: {
      type: Schema.Types.ObjectId,
      ref: 'SolarDesign',
      default: null
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.CONFIRMED,
      index: true
    },
    systemTopology: {
      type: String,
      enum: Object.values(SolarTopology),
      required: true
    },
    systemCapacityKwp: {
      type: Number,
      required: true,
      min: 0.1
    },
    lineItems: {
      type: [SalesOrderLineItemSchema],
      required: true,
      validate: [
        (v: ISalesOrderLineItem[]) => v.length > 0,
        'Order must contain at least one line item.'
      ]
    },
    grossSubtotalPaise: {
      type: Number,
      required: true,
      min: 0
    },
    additionalDiscountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    totalDiscountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    totalTaxPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    netTotalPaise: {
      type: Number,
      required: true,
      min: 0
    },
    taxProfile: {
      profileName: { type: String, required: true },
      profileCode: { type: String, required: true },
      effectiveDate: { type: String, required: true },
      isInterState: { type: Boolean, required: true, default: false },
      accountingNotice: { type: String, required: true }
    },
    paymentMilestones: [
      {
        name: { type: String, required: true },
        percentage: { type: Number, required: true },
        description: { type: String, required: true }
      }
    ],
    termsAndConditions: {
      type: [String],
      default: []
    },
    reservationStatus: {
      type: String,
      enum: Object.values(OrderReservationStatus),
      required: true,
      default: OrderReservationStatus.NONE,
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'sales_orders'
  }
);

SalesOrderSchema.index({ customerId: 1, status: 1 });
SalesOrderSchema.index({ status: 1, createdAt: -1 });

export const SalesOrder = mongoose.model<ISalesOrderDocument>('SalesOrder', SalesOrderSchema);
