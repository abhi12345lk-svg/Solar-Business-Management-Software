import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { PurchaseOrderStatus, UnitOfMeasurement } from '@ins-solar/shared';

export interface IPurchaseOrderLineItem {
  productId: Types.ObjectId;
  sku: string;
  productName: string;
  orderedQuantity: number;
  uom: UnitOfMeasurement;
  unitPurchaseRatePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRate: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  totalAmountPaise: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  outstandingQuantity: number;
  notes?: string;
}

export interface IPurchaseOrderDocument extends Document {
  _id: Types.ObjectId;
  poNumber: string;
  vendorId: Types.ObjectId;
  destinationWarehouseId: Types.ObjectId;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  lineItems: IPurchaseOrderLineItem[];
  isInterState: boolean;
  subtotalPaise: number;
  totalDiscountPaise: number;
  totalTaxPaise: number;
  totalAmountPaise: number;
  status: PurchaseOrderStatus;
  approval: {
    requiresApproval: boolean;
    approvalThresholdPaise: number;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    rejectionReason?: string;
    rejectedBy?: Types.ObjectId;
    rejectedAt?: Date;
  };
  cancellationReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  revision: number;
  termsAndConditions?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const POLineItemSchema = new Schema<IPurchaseOrderLineItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    sku: {
      type: String,
      required: true,
      trim: true
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: [0.001, 'Ordered quantity must be positive']
    },
    uom: {
      type: String,
      enum: Object.values(UnitOfMeasurement),
      default: UnitOfMeasurement.NOS
    },
    unitPurchaseRatePaise: {
      type: Number,
      required: true,
      min: [0, 'Purchase rate cannot be negative']
    },
    discountPaise: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    gstRate: {
      type: Number,
      required: true,
      default: 12,
      min: 0,
      max: 100
    },
    cgstAmountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    sgstAmountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    igstAmountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTaxPaise: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    outstandingQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrderDocument>(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    },
    destinationWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    expectedDeliveryDate: {
      type: Date
    },
    lineItems: {
      type: [POLineItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Purchase order must have at least one line item']
    },
    isInterState: {
      type: Boolean,
      default: false
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 0
    },
    totalDiscountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTaxPaise: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(PurchaseOrderStatus),
      default: PurchaseOrderStatus.DRAFT,
      index: true
    },
    approval: {
      requiresApproval: {
        type: Boolean,
        default: false
      },
      approvalThresholdPaise: {
        type: Number,
        default: 2500000 // ₹25,000 in paise
      },
      approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: {
        type: Date
      },
      rejectionReason: {
        type: String,
        trim: true
      },
      rejectedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectedAt: {
        type: Date
      }
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    revision: {
      type: Number,
      default: 1,
      min: 1
    },
    termsAndConditions: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

PurchaseOrderSchema.index({ vendorId: 1, status: 1 });
PurchaseOrderSchema.index({ destinationWarehouseId: 1, status: 1 });
PurchaseOrderSchema.index({ status: 1, createdAt: -1 });

export const PurchaseOrder: Model<IPurchaseOrderDocument> =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrderDocument>('PurchaseOrder', PurchaseOrderSchema);
