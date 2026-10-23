import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { SequenceEntityType } from '@ins-solar/shared';

export interface ISequenceCounterDocument extends Document {
  _id: Types.ObjectId;
  sequenceKey: string;
  entityType: SequenceEntityType | string;
  fiscalYear: string;
  prefix: string;
  currentValue: number;
  padding: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SequenceCounterSchema = new Schema<ISequenceCounterDocument>(
  {
    sequenceKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    fiscalYear: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    currentValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'currentValue must be an integer'
      }
    },
    padding: {
      type: Number,
      required: true,
      default: 5,
      min: 3,
      max: 10
    },
    description: {
      type: String,
      trim: true
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

// Compound index guaranteeing uniqueness per entity and fiscal year
SequenceCounterSchema.index({ entityType: 1, fiscalYear: 1 }, { unique: true });

export const SequenceCounter: Model<ISequenceCounterDocument> =
  mongoose.models.SequenceCounter ||
  mongoose.model<ISequenceCounterDocument>('SequenceCounter', SequenceCounterSchema);
