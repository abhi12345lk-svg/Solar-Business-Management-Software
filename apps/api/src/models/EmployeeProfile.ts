import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { Department, EmploymentStatus, EmployeeAvailability } from '@ins-solar/shared';

export interface IEmployeeProfileDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  employeeCode: string;
  designation: string;
  department: Department;
  teamId?: Types.ObjectId;
  isTeamLead: boolean;
  employmentStatus: EmploymentStatus;
  availability: EmployeeAvailability;
  joiningDate?: Date;
  skills: string[];
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  workload: {
    activeTasks: number;
    activeProjects: number;
    activeVisits: number;
  };
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeProfileSchema = new Schema<IEmployeeProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: true,
      index: true
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true
    },
    isTeamLead: {
      type: Boolean,
      default: false
    },
    employmentStatus: {
      type: String,
      enum: Object.values(EmploymentStatus),
      default: EmploymentStatus.ACTIVE,
      index: true
    },
    availability: {
      type: String,
      enum: Object.values(EmployeeAvailability),
      default: EmployeeAvailability.AVAILABLE,
      index: true
    },
    joiningDate: {
      type: Date
    },
    skills: {
      type: [String],
      default: []
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true }
    },
    workload: {
      activeTasks: { type: Number, default: 0 },
      activeProjects: { type: Number, default: 0 },
      activeVisits: { type: Number, default: 0 }
    },
    notes: {
      type: String,
      maxlength: 2000
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'employee_profiles'
  }
);

EmployeeProfileSchema.index({ department: 1, isActive: 1 });
EmployeeProfileSchema.index({ teamId: 1, isActive: 1 });
EmployeeProfileSchema.index({ employmentStatus: 1, availability: 1 });

export const EmployeeProfile: Model<IEmployeeProfileDocument> =
  mongoose.models.EmployeeProfile ||
  mongoose.model<IEmployeeProfileDocument>('EmployeeProfile', EmployeeProfileSchema);
