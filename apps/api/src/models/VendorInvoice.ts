import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { VendorInvoiceStatus } from '@ins-solar/shared';

export interface IVendorInvoiceDocument extends Document {
  _id: Types.ObjectId;
  vendorInvoiceNumber: string;
  vendorId: Types.ObjectId;
  purchaseOrderId?: Types.ObjectId;
  goodsReceiptIds: Types.ObjectId[];
  invoiceDate: Date;
  dueDate?: Date;
  subtotalPaise: number;
  taxAmountPaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balancePayablePaise: number;
  status: VendorInvoiceStatus;
  reconciliationNotes?: string;
  discrepancyAmountPaise: number;
  documentUrl?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VendorInvoiceSchema = new Schema<IVendorInvoiceDocument>(
  {
    vendorInvoiceNumber: {
      type: String,
      required: true,
      trim: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      index: true
    },
    goodsReceiptIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'GoodsReceipt'
      }
    ],
    invoiceDate: {
      type: Date,
      required: true
    },
    dueDate: {
      type: Date
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    balancePayablePaise: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(VendorInvoiceStatus),
      default: VendorInvoiceStatus.RECORDED,
      index: true
    },
    reconciliationNotes: {
      type: String,
      trim: true
    },
    discrepancyAmountPaise: {
      type: Number,
      default: 0
    },
    documentUrl: {
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

// Prevent duplicate invoice number for the same vendor
VendorInvoiceSchema.index({ vendorId: 1, vendorInvoiceNumber: 1 }, { unique: true });
VendorInvoiceSchema.index({ status: 1, createdAt: -1 });

export const VendorInvoice: Model<IVendorInvoiceDocument> =
  mongoose.models.VendorInvoice ||
  mongoose.model<IVendorInvoiceDocument>('VendorInvoice', VendorInvoiceSchema);
