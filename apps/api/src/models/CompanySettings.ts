import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { SequenceEntityType } from '@ins-solar/shared';

export interface ICompanySettingsDocument extends Document {
  _id: Types.ObjectId;
  key: string; // Singleton key: 'COMPANY_SETTINGS'
  companyName: string;
  legalEntityName?: string;
  gstin?: string;
  pan?: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  registeredAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    stateCode?: string;
    postalCode: string;
    country: string;
  };
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  sequencePrefixes: Record<string, string>;
  discountApprovalThresholdPercent: number;
  isDiscountThresholdConfirmedByOwner: boolean;
  poApprovalThresholdPaise: number;
  isPoThresholdConfirmedByOwner: boolean;
  expenseApprovalThresholdPaise: number;
  isExpenseThresholdConfirmedByOwner: boolean;
  isConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySettingsSchema = new Schema<ICompanySettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'COMPANY_SETTINGS'
    },
    companyName: {
      type: String,
      required: true,
      default: 'INS Solar',
      trim: true
    },
    legalEntityName: {
      type: String,
      trim: true
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true
    },
    contactPhone: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    website: {
      type: String,
      trim: true
    },
    registeredAddress: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      stateCode: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, default: 'India', trim: true }
    },
    defaultCurrency: {
      type: String,
      default: 'INR',
      trim: true
    },
    fiscalYearStartMonth: {
      type: Number,
      default: 4, // April
      min: 1,
      max: 12
    },
    sequencePrefixes: {
      type: Map,
      of: String,
      default: {
        [SequenceEntityType.CUSTOMER]: 'CUST',
        [SequenceEntityType.LEAD]: 'LEAD',
        [SequenceEntityType.SITE_SURVEY]: 'SRV',
        [SequenceEntityType.SOLAR_DESIGN]: 'DES',
        [SequenceEntityType.QUOTATION]: 'QT',
        [SequenceEntityType.ORDER]: 'ORD',
        [SequenceEntityType.PROJECT]: 'PRJ',
        [SequenceEntityType.PURCHASE_ORDER]: 'PO',
        [SequenceEntityType.INVOICE]: 'INV',
        [SequenceEntityType.PAYMENT_RECEIPT]: 'REC',
        [SequenceEntityType.SERVICE_TICKET]: 'TKT',
        [SequenceEntityType.AMC_CONTRACT]: 'AMC',
        [SequenceEntityType.STOCK_MOVEMENT]: 'STK',
        [SequenceEntityType.EXPENSE]: 'EXP'
      }
    },
    discountApprovalThresholdPercent: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 100
    },
    isDiscountThresholdConfirmedByOwner: {
      type: Boolean,
      default: false
    },
    poApprovalThresholdPaise: {
      type: Number,
      default: 2500000, // ₹25,000.00 in integer paise
      min: 0
    },
    isPoThresholdConfirmedByOwner: {
      type: Boolean,
      default: false
    },
    expenseApprovalThresholdPaise: {
      type: Number,
      default: 500000, // ₹5,000.00 in integer paise
      min: 0
    },
    isExpenseThresholdConfirmedByOwner: {
      type: Boolean,
      default: false
    },
    isConfigured: {
      type: Boolean,
      default: false
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

export const CompanySettings: Model<ICompanySettingsDocument> =
  mongoose.models.CompanySettings ||
  mongoose.model<ICompanySettingsDocument>('CompanySettings', CompanySettingsSchema);
