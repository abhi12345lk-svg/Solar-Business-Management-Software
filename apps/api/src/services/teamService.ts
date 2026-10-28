import { Types } from 'mongoose';
import {
  CreateTeamInput,
  UpdateTeamInput,
  TeamFilterInput,
  AuditAction,
  AuditOutcome,
  ActorType,
  SequenceEntityType
} from '@ins-solar/shared';
import { Team, ITeamDocument } from '../models/Team.js';
import { User } from '../models/User.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class TeamService {
  /**
   * 1. List teams with active member count and task load.
   */
  public static async listTeams(filter: TeamFilterInput): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.department) query.department = filter.department;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { teamCode: searchRegex }, { purpose: searchRegex }];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Team.find(query)
        .populate('teamLeadId', 'firstName lastName email phone role employeeCode')
        .populate('memberUserIds', 'firstName lastName email phone role employeeCode')
        .sort({ teamCode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Team.countDocuments(query)
    ]);

    // Attach active task count for each team
    const enriched = await Promise.all(
      items.map(async team => {
        const activeTasks = await ProjectTask.countDocuments({
          teamId: team._id,
          status: { $nin: ['COMPLETED', 'CANCELLED'] }
        });
        return {
          ...team,
          activeTasks
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
   * 2. Get team details by ID.
   */
  public static async getTeamById(id: string): Promise<any> {
    const isObjectId = Types.ObjectId.isValid(id);
    const team = isObjectId
      ? await Team.findById(id)
          .populate('teamLeadId', 'firstName lastName email phone role employeeCode')
          .populate('memberUserIds', 'firstName lastName email phone role employeeCode')
      : await Team.findOne({ teamCode: id.toUpperCase() })
          .populate('teamLeadId', 'firstName lastName email phone role employeeCode')
          .populate('memberUserIds', 'firstName lastName email phone role employeeCode');

    if (!team) {
      throw AppError.notFound(`Team '${id}' not found.`);
    }

    const activeTasks = await ProjectTask.countDocuments({
      teamId: team._id,
      status: { $nin: ['COMPLETED', 'CANCELLED'] }
    });

    const res: any = team.toObject();
    res.activeTasks = activeTasks;
    return res;
  }

  /**
   * 3. Create Team.
   */
  public static async createTeam(
    input: CreateTeamInput,
    actor: {
      userId: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<ITeamDocument> {
    // Verify team lead exists and is active
    if (!Types.ObjectId.isValid(input.teamLeadId)) {
      throw AppError.validation(`Invalid team lead ID format '${input.teamLeadId}'.`);
    }

    const lead = await User.findById(input.teamLeadId);
    if (!lead || !lead.isActive) {
      throw AppError.validation(`Team lead '${input.teamLeadId}' not found or inactive.`);
    }

    // Verify member IDs if provided
    const validMemberIds: Types.ObjectId[] = [];
    if (input.memberUserIds && input.memberUserIds.length > 0) {
      for (const mId of input.memberUserIds) {
        if (!Types.ObjectId.isValid(mId)) {
          throw AppError.validation(`Invalid member user ID format '${mId}'.`);
        }
        const member = await User.findById(mId);
        if (!member || !member.isActive) {
          throw AppError.validation(`Team member '${mId}' not found or inactive.`);
        }
        validMemberIds.push(member._id);
      }
    }

    // Generate atomic sequential team code (TEM-YYYY-NNNNN)
    const seq = await SequenceService.generateNumber(SequenceEntityType.TEAM);
    const teamCode = seq.formattedNumber;

    const team = new Team({
      teamCode,
      name: input.name.trim(),
      department: input.department,
      purpose: input.purpose.trim(),
      teamLeadId: lead._id,
      memberUserIds: validMemberIds,
      skills: input.skills || [],
      eligibility: input.eligibility || { projectTasks: true, serviceVisits: true },
      isActive: true,
      createdBy: new Types.ObjectId(actor.userId)
    });

    await team.save();

    await AuditService.recordEvent({
      action: AuditAction.TEAM_CREATED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Team',
      targetId: team._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        teamCode: team.teamCode,
        name: team.name,
        department: team.department,
        teamLeadId: team.teamLeadId.toString(),
        memberCount: validMemberIds.length
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || 'team-create'
    });

    logger.info(
      { teamCode: team.teamCode, name: team.name },
      '[TeamService] Team created successfully.'
    );

    return team;
  }

  /**
   * 4. Update Team.
   */
  public static async updateTeam(
    id: string,
    input: UpdateTeamInput,
    actor: {
      userId: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<ITeamDocument> {
    const team = await Team.findById(id);
    if (!team) {
      throw AppError.notFound(`Team '${id}' not found.`);
    }

    if (input.name !== undefined) team.name = input.name.trim();
    if (input.department !== undefined) team.department = input.department;
    if (input.purpose !== undefined) team.purpose = input.purpose.trim();

    if (input.teamLeadId !== undefined) {
      if (!Types.ObjectId.isValid(input.teamLeadId)) {
        throw AppError.validation(`Invalid team lead ID format '${input.teamLeadId}'.`);
      }
      const lead = await User.findById(input.teamLeadId);
      if (!lead || !lead.isActive) {
        throw AppError.validation(`Team lead '${input.teamLeadId}' not found or inactive.`);
      }
      team.teamLeadId = lead._id;
    }

    if (input.memberUserIds !== undefined) {
      const validMemberIds: Types.ObjectId[] = [];
      for (const mId of input.memberUserIds) {
        if (!Types.ObjectId.isValid(mId)) {
          throw AppError.validation(`Invalid member user ID format '${mId}'.`);
        }
        const member = await User.findById(mId);
        if (!member || !member.isActive) {
          throw AppError.validation(`Team member '${mId}' not found or inactive.`);
        }
        validMemberIds.push(member._id);
      }
      team.memberUserIds = validMemberIds;
    }

    if (input.skills !== undefined) team.skills = input.skills;
    if (input.eligibility !== undefined) {
      team.eligibility = {
        projectTasks: input.eligibility.projectTasks ?? team.eligibility.projectTasks,
        serviceVisits: input.eligibility.serviceVisits ?? team.eligibility.serviceVisits
      };
    }
    if (input.isActive !== undefined) team.isActive = input.isActive;

    team.updatedBy = new Types.ObjectId(actor.userId);
    await team.save();

    await AuditService.recordEvent({
      action: AuditAction.TEAM_UPDATED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Team',
      targetId: team._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        teamCode: team.teamCode,
        updates: Object.keys(input)
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || 'team-update'
    });

    return team;
  }

  /**
   * 5. Toggle Team Status (Deactivate or Activate).
   */
  public static async toggleTeamStatus(
    id: string,
    isActive: boolean,
    reason: string | undefined,
    actor: {
      userId: string;
      role?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    }
  ): Promise<ITeamDocument> {
    const team = await Team.findById(id);
    if (!team) {
      throw AppError.notFound(`Team '${id}' not found.`);
    }

    team.isActive = isActive;
    team.updatedBy = new Types.ObjectId(actor.userId);
    await team.save();

    await AuditService.recordEvent({
      action: isActive ? AuditAction.TEAM_UPDATED : AuditAction.TEAM_DEACTIVATED,
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      targetEntity: 'Team',
      targetId: team._id.toString(),
      outcome: AuditOutcome.SUCCESS,
      details: {
        teamCode: team.teamCode,
        action: isActive ? 'ACTIVATED' : 'DEACTIVATED',
        reason
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || 'team-toggle'
    });

    return team;
  }
}
