import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Department, UserRole, Permission, ROLE_DEFAULT_PERMISSIONS } from '@ins-solar/shared';

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  department: Department;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecretEncrypted?: string;
  mfaRecoveryCodesHashed?: string[];
  sessionVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  getEffectivePermissions(): Permission[];
}

const UserSchema = new Schema<IUserDocument>(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true
    },
    permissions: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaSecretEncrypted: {
      type: String
    },
    mfaRecoveryCodesHashed: {
      type: [String],
      default: []
    },
    sessionVersion: {
      type: Number,
      default: 1
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.mfaSecretEncrypted;
        delete ret.mfaRecoveryCodesHashed;
        delete ret.sessionVersion;
        return ret;
      }
    }
  }
);

// Compound index for department and role lookups
UserSchema.index({ department: 1, role: 1 });

/**
 * Returns merged effective permissions: role default permissions + custom assigned permissions.
 */
UserSchema.methods.getEffectivePermissions = function (this: IUserDocument): Permission[] {
  const defaults = ROLE_DEFAULT_PERMISSIONS[this.role] || [];
  const combined = new Set<Permission>([
    ...defaults,
    ...((this.permissions as Permission[]) || [])
  ]);
  return Array.from(combined);
};

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
