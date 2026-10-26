import { Types } from 'mongoose';
import {
  CreateProjectTaskInput,
  UpdateProjectTaskParsed,
  ProjectTaskFilterInput,
  ProjectPriority,
  ProjectTaskStatus,
  UserRole,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import { ProjectTask, IProjectTaskDocument } from '../models/ProjectTask.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class ProjectTaskService {
  /**
   * 1. Create a Project Task
   */
  public static async createTask(
    projectId: string,
    input: CreateProjectTaskInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID '${projectId}' not found.`);
    }

    // Cross-project milestone guard: If milestoneId provided, verify it belongs to THIS project
    let milestoneId: Types.ObjectId | undefined;
    if (input.milestoneId && input.milestoneId.trim()) {
      if (!Types.ObjectId.isValid(input.milestoneId)) {
        throw AppError.validation(`Invalid milestone ID '${input.milestoneId}'.`);
      }
      const milestone = project.milestones.id(input.milestoneId);
      if (!milestone) {
        throw AppError.validation(
          `Milestone '${input.milestoneId}' does not belong to project ${project.projectCode}.`
        );
      }
      milestoneId = milestone._id;
    }

    // Verify assigned user if provided
    let assignedUserId: Types.ObjectId | undefined;
    if (input.assignedUserId && input.assignedUserId.trim()) {
      if (!Types.ObjectId.isValid(input.assignedUserId)) {
        throw AppError.validation(`Invalid assigned user ID '${input.assignedUserId}'.`);
      }
      const assigned = await User.findById(input.assignedUserId);
      if (!assigned || !assigned.isActive) {
        throw AppError.validation(`Assigned user '${input.assignedUserId}' not found or inactive.`);
      }
      assignedUserId = assigned._id;
    }

    // Generate atomic sequential task code (TSK-YYYY-NNNNN)
    const seq = await SequenceService.generateNumber(SequenceEntityType.TASK);
    const taskCode = seq.formattedNumber;

    const task = new ProjectTask({
      taskCode,
      projectId: project._id,
      milestoneId,
      title: input.title.trim(),
      description: input.description?.trim(),
      assignedUserId,
      priority: input.priority || ProjectPriority.MEDIUM,
      status: ProjectTaskStatus.TODO,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      createdBy: new Types.ObjectId(user.userId)
    });

    await task.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_TASK_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'task-create',
      targetEntity: 'ProjectTask',
      targetId: task._id.toString(),
      details: {
        taskCode: task.taskCode,
        projectId: project._id.toString(),
        title: task.title
      }
    });

    return task;
  }

  /**
   * 2. List Tasks with Filtering & Overdue Check
   */
  public static async getTasks(filter: ProjectTaskFilterInput): Promise<{
    tasks: IProjectTaskDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.projectId && Types.ObjectId.isValid(filter.projectId)) {
      query.projectId = new Types.ObjectId(filter.projectId);
    }
    if (filter.milestoneId && Types.ObjectId.isValid(filter.milestoneId)) {
      query.milestoneId = new Types.ObjectId(filter.milestoneId);
    }
    if (filter.assignedUserId && Types.ObjectId.isValid(filter.assignedUserId)) {
      query.assignedUserId = new Types.ObjectId(filter.assignedUserId);
    }
    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;

    // Overdue filter: due date is in the past and task is not finished
    if (filter.isOverdue) {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: [ProjectTaskStatus.COMPLETED, ProjectTaskStatus.CANCELLED] };
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { taskCode: searchRegex }];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortField]: sortOrder };

    const [tasks, total] = await Promise.all([
      ProjectTask.find(query)
        .populate('projectId', 'projectCode name status')
        .populate('assignedUserId', 'firstName lastName email employeeCode')
        .populate('completedBy', 'firstName lastName employeeCode')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      ProjectTask.countDocuments(query)
    ]);

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 3. Get Task by ID
   */
  public static async getTaskById(taskId: string): Promise<IProjectTaskDocument> {
    if (!Types.ObjectId.isValid(taskId)) {
      throw AppError.validation(`Invalid task ID '${taskId}'.`);
    }

    const task = await ProjectTask.findById(taskId)
      .populate('projectId', 'projectCode name status customerId')
      .populate('assignedUserId', 'firstName lastName email phone employeeCode')
      .populate('completedBy', 'firstName lastName employeeCode');

    if (!task) {
      throw AppError.notFound(`Task with ID '${taskId}' not found.`);
    }

    return task;
  }

  /**
   * 4. Update Task Attributes & Status
   */
  public static async updateTask(
    taskId: string,
    input: UpdateProjectTaskParsed,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    const task = await this.getTaskById(taskId);

    if (input.title) task.title = input.title.trim();
    if (input.description !== undefined) task.description = input.description?.trim();

    if (input.milestoneId !== undefined) {
      if (input.milestoneId && input.milestoneId.trim()) {
        const project = await Project.findById(task.projectId);
        if (!project || !project.milestones.id(input.milestoneId)) {
          throw AppError.validation(`Milestone does not belong to the task's project.`);
        }
        task.milestoneId = new Types.ObjectId(input.milestoneId);
      } else {
        task.milestoneId = undefined;
      }
    }

    if (input.assignedUserId !== undefined) {
      if (input.assignedUserId && input.assignedUserId.trim()) {
        const u = await User.findById(input.assignedUserId);
        if (!u || !u.isActive) {
          throw AppError.validation(`Assigned user '${input.assignedUserId}' not found or inactive.`);
        }
        task.assignedUserId = u._id;
      } else {
        task.assignedUserId = undefined;
      }
    }

    if (input.priority) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate || undefined;

    if (input.status) {
      const oldStatus = task.status;
      const newStatus = input.status;

      if (newStatus === ProjectTaskStatus.COMPLETED) {
        task.completedAt = new Date();
        task.completedBy = new Types.ObjectId(user.userId);
      } else if (oldStatus === ProjectTaskStatus.COMPLETED) {
        task.completedAt = undefined;
        task.completedBy = undefined;
      }

      task.status = newStatus;
    }

    task.updatedBy = new Types.ObjectId(user.userId);
    await task.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_TASK_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'task-update',
      targetEntity: 'ProjectTask',
      targetId: task._id.toString(),
      details: {
        taskCode: task.taskCode,
        status: task.status
      }
    });

    return task;
  }

  /**
   * 5. Delete Task
   */
  public static async deleteTask(
    taskId: string,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<void> {
    const task = await this.getTaskById(taskId);
    await task.deleteOne();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.PROJECT_TASK_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'task-delete',
      targetEntity: 'ProjectTask',
      targetId: taskId,
      details: {
        taskCode: task.taskCode,
        action: 'DELETED'
      }
    });
  }
}
