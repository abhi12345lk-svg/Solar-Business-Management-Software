import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { GoodsReceiptStatus } from '@ins-solar/shared';

export interface IGoodsReceiptLineItem {
  productId: Types.ObjectId;
  sku: string;
  productName: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  outstandingQuantityAfter: number;
  rejectionReason?: string;
  serialNumbers?: string[];
  stockMovementId?: Types.ObjectId;
}

export interface IGoodsReceiptDocument extends Document {
  _id: Types.ObjectId;
  grnNumber: string;
  purchaseOrderId: Types.ObjectId;
  vendorId: Types.ObjectId;
  destinationWarehouseId: Types.ObjectId;
  receiptDate: Date;
  lineItems: IGoodsReceiptLineItem[];
  deliveryChallanNumber?: string;
  vehicleNumber?: string;
  inspectionRemarks?: string;
  status: GoodsReceiptStatus;
  stockMovementIds: Types.ObjectId[];
  idempotencyKey?: string;
  receivedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GRNLineItemSchema = new Schema<IGoodsReceiptLineItem>(
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
      min: 0
    },
    deliveredQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    outstandingQuantityAfter: {
      type: Number,
      required: true,
      min: 0
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    serialNumbers: [
      {
        type: String,
        trim: true,
        uppercase: true
      }
    ],
    stockMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'StockMovement'
    }
  },
  { _id: false }
);

const GoodsReceiptSchema = new Schema<IGoodsReceiptDocument>(
  {
    grnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
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
    receiptDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    lineItems: {
      type: [GRNLineItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Goods receipt must have at least one line item']
    },
    deliveryChallanNumber: {
      type: String,
      trim: true
    },
    vehicleNumber: {
      type: String,
      trim: true
    },
    inspectionRemarks: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(GoodsReceiptStatus),
      default: GoodsReceiptStatus.COMPLETED,
      index: true
    },
    stockMovementIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'StockMovement'
      }
    ],
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

GoodsReceiptSchema.index({ purchaseOrderId: 1, createdAt: -1 });

export const GoodsReceipt: Model<IGoodsReceiptDocument> =
  mongoose.models.GoodsReceipt ||
  mongoose.model<IGoodsReceiptDocument>('GoodsReceipt', GoodsReceiptSchema);
