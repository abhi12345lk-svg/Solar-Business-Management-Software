import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPasswordResetTokenDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 } // MongoDB TTL index to auto-remove expired tokens
    },
    used: {
      type: Boolean,
      default: false,
      index: true
    },
    usedAt: {
      type: Date
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const PasswordResetToken: Model<IPasswordResetTokenDocument> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetTokenDocument>('PasswordResetToken', PasswordResetTokenSchema);
