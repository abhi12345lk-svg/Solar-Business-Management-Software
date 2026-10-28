import { Types } from 'mongoose';
import {
  EmploymentStatus,
  EmployeeAvailability,
  CreateEmployeeProfileInput,
  UpdateEmployeeProfileInput,
  EmployeeFilterInput,
  AuditAction,
  AuditOutcome,
  ActorType,
  SequenceEntityType
} from '@ins-solar/shared';
import { EmployeeProfile, IEmployeeProfileDocument } from '../models/EmployeeProfile.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { Project } from '../models/Project.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class EmployeeService {
  /**
   * 1. List employees with filters and workload counters.
   */
  public static async listEmployees(filter: EmployeeFilterInput): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.department) query.department = filter.department;
    if (filter.employmentStatus) query.employmentStatus = filter.employmentStatus;
    if (filter.availability) query.availability = filter.availability;
    if (filter.teamId && Types.ObjectId.isValid(filter.teamId)) {
      query.teamId = new Types.ObjectId(filter.teamId);
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ employeeCode: searchRegex }, { designation: searchRegex }];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      EmployeeProfile.find(query)
        .populate('userId', 'firstName lastName email phone role department isActive lastLoginAt')
        .populate('teamId', 'name teamCode purpose')
        .sort({ employeeCode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmployeeProfile.countDocuments(query)
    ]);

    // Attach real-time active task and visit workloads
    const enriched = await Promise.all(
      items.map(async emp => {
        const [activeTasks, activeVisits] = await Promise.all([
          emp.userId?._id
            ? ProjectTask.countDocuments({
                assignedUserId: emp.userId._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] }
              })
            : 0,
          emp.userId?._id
            ? ServiceVisit.countDocuments({
                assignedTechnicianId: emp.userId._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] }
              })
            : 0
        ]);

        return {
          ...emp,
          workload: {
            activeTasks,
            activeVisits,
            activeProjects: emp.workload?.activeProjects || 0
          }
        };
      })
    );

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 2. Get Employee Profile by ID or User ID with full workload metrics.
   */
  public static async getEmployeeById(id: string): Promise<any> {
    const isObjectId = Types.ObjectId.isValid(id);
    const emp = isObjectId
      ? await EmployeeProfile.findOne({
          $or: [{ _id: new Types.ObjectId(id) }, { userId: new Types.ObjectId(id) }]
        })
          .populate('userId', 'firstName lastName email phone role department isActive lastLoginAt')
          .populate('teamId', 'name teamCode purpose skills')
      : await EmployeeProfile.findOne({ employeeCode: id.toUpperCase() })
          .populate('userId', 'firstName lastName email phone role department isActive lastLoginAt')
          .populate('teamId', 'name teamCode purpose skills');

    if (!emp) {
      throw AppError.notFound(`Employee profile '${id}' not found.`);
    }

    const userObjId = (emp.userId as any)?._id || emp.userId;
    const [activeTasks, activeVisits, activeProjects] = await Promise.all([
      userObjId
        ? ProjectTask.countDocuments({
            assignedUserId: userObjId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] }
          })
        : 0,
      userObjId
        ? ServiceVisit.countDocuments({
            assignedTechnicianId: userObjId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] }
          })
        : 0,
      userObjId
        ? Project.countDocuments({
            projectManagerId: userObjId,
            status: { $nin: ['COMMISSIONED', 'CANCELLED'] }
          })
        : 0
    ]);

    const res = emp.toObject();
    res.workload = {
      activeTasks,
      activeVisits,
      activeProjects
    };

    return res;
  }

  /**
   * 3. Create or extend employee profile linked to an existing User.
   * Does NOT store passwords, MFA secrets, or alter RBAC permissions.
   */
  public static async createProfile(
    input: CreateEmployeeProfileInput,
    actor?: {
      userId?: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<IEmployeeProfileDocument> {
    if (!Types.ObjectId.isValid(input.userId)) {
      throw AppError.validation(`Invalid User ID format '${input.userId}'.`);
    }

    const user = await User.findById(input.userId);
    if (!user) {
      throw AppError.notFound(`User with ID '${input.userId}' not found.`);
    }

    // 1:1 Association rule: prevent duplicate employee profiles for the same User
    const existing = await EmployeeProfile.findOne({ userId: user._id });
    if (existing) {
      throw AppError.conflict(
        `Employee profile already exists for user ${user.firstName} ${user.lastName} (${existing.employeeCode}).`
      );
    }

    // Validate team if assigned
    if (input.teamId) {
      const team = await Team.findById(input.teamId);
      if (!team || !team.isActive) {
        throw AppError.validation(`Assigned team '${input.teamId}' not found or inactive.`);
      }
    }

    // Use User's existing employeeCode or generate via sequence service
    let employeeCode = user.employeeCode;
    if (!employeeCode || !employeeCode.trim()) {
      const seq = await SequenceService.generateNumber(SequenceEntityType.EMPLOYEE);
      employeeCode = seq.formattedNumber;
      user.employeeCode = employeeCode;
      await user.save();
    }

    const profile = new EmployeeProfile({
      userId: user._id,
      employeeCode,
      designation: input.designation.trim(),
      department: input.department || user.department,
      teamId: input.teamId ? new Types.ObjectId(input.teamId) : undefined,
      isTeamLead: input.isTeamLead || false,
      employmentStatus: input.employmentStatus || EmploymentStatus.ACTIVE,
      availability: input.availability || EmployeeAvailability.AVAILABLE,
      joiningDate: input.joiningDate || new Date(),
      skills: input.skills || [],
      emergencyContact: input.emergencyContact,
      notes: input.notes?.trim(),
      isActive: true
    });

    await profile.save();

    await AuditService.recordEvent({
      action: AuditAction.EMPLOYEE_PROFILE_CREATED,
      actorId: actor?.userId || user._id.toString(),
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'EmployeeProfile',
      targetId: profile._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        employeeCode: profile.employeeCode,
        userId: user._id.toString(),
        designation: profile.designation,
        department: profile.department
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      correlationId: actor?.correlationId || 'employee-create'
    });

    logger.info(
      { employeeCode: profile.employeeCode, userId: user._id.toString() },
      '[EmployeeService] Employee profile created successfully.'
    );

    return profile;
  }

  /**
   * 4. Update employee profile.
   */
  public static async updateProfile(
    id: string,
    input: UpdateEmployeeProfileInput,
    actor?: {
      userId?: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<IEmployeeProfileDocument> {
    const profile = await EmployeeProfile.findById(id);
    if (!profile) {
      throw AppError.notFound(`Employee profile '${id}' not found.`);
    }

    if (input.designation !== undefined) profile.designation = input.designation.trim();
    if (input.department !== undefined) profile.department = input.department;

    if (input.teamId !== undefined) {
      if (input.teamId) {
        const team = await Team.findById(input.teamId);
        if (!team || !team.isActive) {
          throw AppError.validation(`Assigned team '${input.teamId}' not found or inactive.`);
        }
        profile.teamId = team._id;
      } else {
        profile.teamId = undefined;
      }
    }

    if (input.isTeamLead !== undefined) profile.isTeamLead = input.isTeamLead;
    if (input.employmentStatus !== undefined) profile.employmentStatus = input.employmentStatus;
    if (input.availability !== undefined) profile.availability = input.availability;
    if (input.joiningDate !== undefined) profile.joiningDate = input.joiningDate;
    if (input.skills !== undefined) profile.skills = input.skills;
    if (input.emergencyContact !== undefined) profile.emergencyContact = input.emergencyContact;
    if (input.notes !== undefined) profile.notes = input.notes?.trim();

    await profile.save();

    await AuditService.recordEvent({
      action: AuditAction.EMPLOYEE_PROFILE_UPDATED,
      actorId: actor?.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'EmployeeProfile',
      targetId: profile._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        employeeCode: profile.employeeCode,
        updates: Object.keys(input)
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      correlationId: actor?.correlationId || 'employee-update'
    });

    return profile;
  }

  /**
   * 5. Deactivate employee with optional reassignment of pending tasks.
   * Historical tasks, visits, and audit entries are strictly preserved.
   */
  public static async deactivateEmployee(
    id: string,
    options?: {
      reassignToUserId?: string;
      reassignmentReason?: string;
    },
    actor?: {
      userId?: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<{ profile: IEmployeeProfileDocument; reassignedTasksCount: number }> {
    const profile = await EmployeeProfile.findById(id);
    if (!profile) {
      throw AppError.notFound(`Employee profile '${id}' not found.`);
    }

    // Deactivate profile and underlying User
    profile.isActive = false;
    profile.employmentStatus = EmploymentStatus.TERMINATED;
    profile.availability = EmployeeAvailability.BUSY;
    await profile.save();

    await User.findByIdAndUpdate(profile.userId, { isActive: false });

    let reassignedTasksCount = 0;
    if (options?.reassignToUserId && Types.ObjectId.isValid(options.reassignToUserId)) {
      const replacementUser = await User.findById(options.reassignToUserId);
      if (!replacementUser || !replacementUser.isActive) {
        throw AppError.validation(
          `Replacement user '${options.reassignToUserId}' not found or inactive.`
        );
      }

      const activeTasks = await ProjectTask.find({
        assignedUserId: profile.userId,
        status: { $nin: ['COMPLETED', 'CANCELLED'] }
      });

      for (const task of activeTasks) {
        task.reassignmentHistory.push({
          fromUserId: profile.userId,
          toUserId: replacementUser._id,
          reassignedAt: new Date(),
          reassignedBy: new Types.ObjectId(actor?.userId || replacementUser._id.toString()),
          reason:
            options.reassignmentReason ||
            `Automatic reassignment upon deactivation of ${profile.employeeCode}.`
        });
        task.assignedUserId = replacementUser._id;
        task.updatedBy = new Types.ObjectId(actor?.userId || replacementUser._id.toString());
        await task.save();
        reassignedTasksCount++;
      }
    }

    await AuditService.recordEvent({
      action: AuditAction.EMPLOYEE_DEACTIVATED,
      actorId: actor?.userId || 'system',
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'EmployeeProfile',
      targetId: profile._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        employeeCode: profile.employeeCode,
        userId: profile.userId.toString(),
        reassignedTasksCount
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
      correlationId: actor?.correlationId || 'employee-deactivate'
    });

    logger.info(
      { employeeCode: profile.employeeCode, reassignedTasksCount },
      '[EmployeeService] Employee profile deactivated.'
    );

    return { profile, reassignedTasksCount };
  }
}
