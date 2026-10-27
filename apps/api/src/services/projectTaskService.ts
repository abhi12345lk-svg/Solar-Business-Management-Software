import { Types } from 'mongoose';
import {
  CreateProjectTaskInput,
  UpdateProjectTaskParsed,
  ProjectTaskFilterInput,
  CreateUnifiedTaskInput,
  UpdateUnifiedTaskInput,
  ReassignTaskInput,
  UpdateTaskStatusInput,
  UnifiedTaskFilterInput,
  ProjectPriority,
  ProjectTaskStatus,
  TaskCategory,
  UserRole,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  NotificationCategory,
  NotificationRecipientType
} from '@ins-solar/shared';
import { ProjectTask, IProjectTaskDocument } from '../models/ProjectTask.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { ServiceComplaint } from '../models/ServiceComplaint.js';
import { ServiceVisit } from '../models/ServiceVisit.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { NotificationCenterService } from './notificationCenterService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class ProjectTaskService {
  /**
   * 1. Create a Project Task (Phase 6A compatibility method).
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

    const seq = await SequenceService.generateNumber(SequenceEntityType.TASK);
    const taskCode = seq.formattedNumber;

    const task = new ProjectTask({
      taskCode,
      projectId: project._id,
      milestoneId,
      customerId: project.customerId,
      category: TaskCategory.PROJECT,
      relatedEntityType: 'Project',
      relatedEntityId: project._id,
      title: input.title.trim(),
      description: input.description?.trim(),
      assignedUserId,
      priority: input.priority || ProjectPriority.MEDIUM,
      status: ProjectTaskStatus.TODO,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      statusHistory: [
        {
          fromStatus: 'NONE',
          toStatus: ProjectTaskStatus.TODO,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          reason: 'Initial task creation'
        }
      ],
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
   * 2. Create a Unified Task (Phase 9B unified method).
   * Can link to Projects, Milestones, Complaints, Visits, Checklists, or stand alone.
   */
  public static async createUnifiedTask(
    input: CreateUnifiedTaskInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    let projectDoc: any = null;
    let customerId: Types.ObjectId | undefined;

    // Validate project if specified
    if (input.projectId && input.projectId.trim()) {
      if (!Types.ObjectId.isValid(input.projectId)) {
        throw AppError.validation(`Invalid project ID format '${input.projectId}'.`);
      }
      projectDoc = await Project.findById(input.projectId);
      if (!projectDoc) {
        throw AppError.notFound(`Project with ID '${input.projectId}' not found.`);
      }
      customerId = projectDoc.customerId;
    }

    // Validate milestone if specified
    let milestoneId: Types.ObjectId | undefined;
    if (input.milestoneId && input.milestoneId.trim()) {
      if (!projectDoc) {
        throw AppError.validation('Milestone ID requires a valid project ID.');
      }
      const m = projectDoc.milestones?.id(input.milestoneId);
      if (!m) {
        throw AppError.validation(
          `Milestone '${input.milestoneId}' does not belong to project ${projectDoc.projectCode}.`
        );
      }
      milestoneId = m._id;
    }

    // Validate customer if specified
    if (input.customerId && input.customerId.trim()) {
      if (!Types.ObjectId.isValid(input.customerId)) {
        throw AppError.validation(`Invalid customer ID format '${input.customerId}'.`);
      }
      const passedCustId = new Types.ObjectId(input.customerId);
      if (customerId && customerId.toString() !== passedCustId.toString()) {
        throw AppError.validation(
          `Cross-customer integrity violation: Project belongs to customer ${customerId}, but task specified customer ${passedCustId}.`
        );
      }
      customerId = passedCustId;
    }

    // Validate assignee if specified
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

    // Validate team if specified
    let teamId: Types.ObjectId | undefined;
    if (input.teamId && input.teamId.trim()) {
      if (!Types.ObjectId.isValid(input.teamId)) {
        throw AppError.validation(`Invalid team ID '${input.teamId}'.`);
      }
      const team = await Team.findById(input.teamId);
      if (!team || !team.isActive) {
        throw AppError.validation(`Assigned team '${input.teamId}' not found or inactive.`);
      }
      teamId = team._id;
    }

    // Validate related entities
    let relatedEntityId: Types.ObjectId | undefined;
    if (input.relatedEntityId && input.relatedEntityId.trim()) {
      if (!Types.ObjectId.isValid(input.relatedEntityId)) {
        throw AppError.validation(`Invalid related entity ID '${input.relatedEntityId}'.`);
      }
      relatedEntityId = new Types.ObjectId(input.relatedEntityId);

      // Verify specific entity types if supplied
      if (input.relatedEntityType === 'ServiceComplaint') {
        const complaint = await ServiceComplaint.findById(relatedEntityId);
        if (!complaint) throw AppError.notFound(`Service complaint '${input.relatedEntityId}' not found.`);
        if (!customerId) customerId = complaint.customerId;
      } else if (input.relatedEntityType === 'ServiceVisit') {
        const visit = await ServiceVisit.findById(relatedEntityId);
        if (!visit) throw AppError.notFound(`Service visit '${input.relatedEntityId}' not found.`);
        if (!customerId) customerId = visit.customerId;
      }
    }

    // Generate atomic sequence number (TSK-YYYY-NNNNN)
    const seq = await SequenceService.generateNumber(SequenceEntityType.TASK);
    const taskCode = seq.formattedNumber;

    const task = new ProjectTask({
      taskCode,
      projectId: projectDoc ? projectDoc._id : undefined,
      milestoneId,
      customerId,
      category: input.category || TaskCategory.GENERAL,
      teamId,
      relatedEntityType: input.relatedEntityType || (projectDoc ? 'Project' : undefined),
      relatedEntityId: relatedEntityId || (projectDoc ? projectDoc._id : undefined),
      title: input.title.trim(),
      description: input.description?.trim(),
      assignedUserId,
      priority: input.priority || ProjectPriority.MEDIUM,
      status: ProjectTaskStatus.TODO,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      statusHistory: [
        {
          fromStatus: 'NONE',
          toStatus: ProjectTaskStatus.TODO,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          reason: 'Initial task creation'
        }
      ],
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
        category: task.category,
        title: task.title,
        assignedUserId: assignedUserId?.toString()
      }
    });

    // Notify assignee if assigned to an individual
    if (assignedUserId && assignedUserId.toString() !== user.userId) {
      NotificationCenterService.createNotification(
        {
          recipientId: assignedUserId.toString(),
          recipientType: NotificationRecipientType.EMPLOYEE,
          category: NotificationCategory.SYSTEM,
          eventType: 'TASK_ASSIGNED',
          title: `New Task Assigned: ${task.taskCode}`,
          message: `You have been assigned task "${task.title}". Priority: ${task.priority}.`,
          entityType: 'ProjectTask',
          entityId: task._id.toString(),
          linkUrl: `/tasks?selected=${task.taskCode}`
        },
        { userId: user.userId }
      ).catch(err => logger.warn({ err }, '[ProjectTaskService] Failed to emit task assignment notification.'));
    }

    return task;
  }

  /**
   * 3. List Unified Tasks with Comprehensive Filtering & Overdue Check.
   */
  public static async getTasks(filter: UnifiedTaskFilterInput | ProjectTaskFilterInput): Promise<{
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
    if ((filter as any).teamId && Types.ObjectId.isValid((filter as any).teamId)) {
      query.teamId = new Types.ObjectId((filter as any).teamId);
    }
    if ((filter as any).customerId && Types.ObjectId.isValid((filter as any).customerId)) {
      query.customerId = new Types.ObjectId((filter as any).customerId);
    }
    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;
    if ((filter as any).category) query.category = (filter as any).category;
    if ((filter as any).relatedEntityType) query.relatedEntityType = (filter as any).relatedEntityType;
    if ((filter as any).relatedEntityId && Types.ObjectId.isValid((filter as any).relatedEntityId)) {
      query.relatedEntityId = new Types.ObjectId((filter as any).relatedEntityId);
    }

    // Overdue filter: due date is in the past and task is not completed or cancelled
    if (filter.isOverdue) {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: [ProjectTaskStatus.COMPLETED, ProjectTaskStatus.CANCELLED] };
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { taskCode: searchRegex }, { description: searchRegex }];
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortField]: sortOrder };

    const [tasks, total] = await Promise.all([
      ProjectTask.find(query)
        .populate('projectId', 'projectCode name status customerId')
        .populate('teamId', 'name teamCode')
        .populate('assignedUserId', 'firstName lastName email employeeCode phone')
        .populate('completedBy', 'firstName lastName employeeCode')
        .populate('createdBy', 'firstName lastName employeeCode')
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
   * 4. Get Task by ID.
   */
  public static async getTaskById(taskId: string): Promise<IProjectTaskDocument> {
    const isObjectId = Types.ObjectId.isValid(taskId);
    const task = isObjectId
      ? await ProjectTask.findById(taskId)
          .populate('projectId', 'projectCode name status customerId')
          .populate('teamId', 'name teamCode purpose skills')
          .populate('assignedUserId', 'firstName lastName email phone employeeCode')
          .populate('completedBy', 'firstName lastName employeeCode')
          .populate('createdBy', 'firstName lastName employeeCode')
          .populate('reassignmentHistory.fromUserId', 'firstName lastName employeeCode')
          .populate('reassignmentHistory.toUserId', 'firstName lastName employeeCode')
      : await ProjectTask.findOne({ taskCode: taskId.toUpperCase() })
          .populate('projectId', 'projectCode name status customerId')
          .populate('teamId', 'name teamCode purpose skills')
          .populate('assignedUserId', 'firstName lastName email phone employeeCode')
          .populate('completedBy', 'firstName lastName employeeCode')
          .populate('createdBy', 'firstName lastName employeeCode')
          .populate('reassignmentHistory.fromUserId', 'firstName lastName employeeCode')
          .populate('reassignmentHistory.toUserId', 'firstName lastName employeeCode');

    if (!task) {
      throw AppError.notFound(`Task '${taskId}' not found.`);
    }

    return task;
  }

  /**
   * 5. Reassign Task with Audit Reason & Notification.
   */
  public static async reassignTask(
    taskId: string,
    input: ReassignTaskInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    const task = await this.getTaskById(taskId);

    if (!Types.ObjectId.isValid(input.assignedUserId)) {
      throw AppError.validation(`Invalid replacement user ID '${input.assignedUserId}'.`);
    }

    const newAssignee = await User.findById(input.assignedUserId);
    if (!newAssignee || !newAssignee.isActive) {
      throw AppError.validation(`Replacement assignee '${input.assignedUserId}' not found or inactive.`);
    }

    const previousAssigneeId = task.assignedUserId;

    task.reassignmentHistory.push({
      fromUserId: previousAssigneeId,
      toUserId: newAssignee._id,
      reassignedAt: new Date(),
      reassignedBy: new Types.ObjectId(user.userId),
      reason: input.reason.trim()
    });

    task.assignedUserId = newAssignee._id;
    task.updatedBy = new Types.ObjectId(user.userId);
    await task.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.TASK_REASSIGNED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'task-reassign',
      targetEntity: 'ProjectTask',
      targetId: task._id.toString(),
      details: {
        taskCode: task.taskCode,
        fromUserId: previousAssigneeId?.toString(),
        toUserId: newAssignee._id.toString(),
        reason: input.reason
      }
    });

    // Notify new assignee
    if (newAssignee._id.toString() !== user.userId) {
      NotificationCenterService.createNotification(
        {
          recipientId: newAssignee._id.toString(),
          recipientType: NotificationRecipientType.EMPLOYEE,
          category: NotificationCategory.SYSTEM,
          eventType: 'TASK_REASSIGNED',
          title: `Task Reassigned: ${task.taskCode}`,
          message: `Task "${task.title}" has been reassigned to you. Reason: ${input.reason}`,
          entityType: 'ProjectTask',
          entityId: task._id.toString(),
          linkUrl: `/tasks?selected=${task.taskCode}`
        },
        { userId: user.userId }
      ).catch(err => logger.warn({ err }, '[ProjectTaskService] Failed to emit reassignment notification.'));
    }

    return task;
  }

  /**
   * 6. Update Task Status with History & Completion Notes.
   */
  public static async updateTaskStatus(
    taskId: string,
    input: UpdateTaskStatusInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    const task = await this.getTaskById(taskId);
    const oldStatus = task.status;
    const newStatus = input.status;

    if (newStatus === ProjectTaskStatus.COMPLETED) {
      task.completedAt = new Date();
      task.completedBy = new Types.ObjectId(user.userId);
      if (input.completionNotes) task.completionNotes = input.completionNotes.trim();
    } else if (oldStatus === ProjectTaskStatus.COMPLETED) {
      task.completedAt = undefined;
      task.completedBy = undefined;
    }

    if (newStatus === ProjectTaskStatus.BLOCKED) {
      if (!input.blockerReason || !input.blockerReason.trim()) {
        throw AppError.validation('blockerReason is required when marking a task as BLOCKED.');
      }
      task.blockerReason = input.blockerReason.trim();
    }

    if (input.followUpDate) task.followUpDate = input.followUpDate;

    task.status = newStatus;
    if (!task.statusHistory) {
      task.statusHistory = [];
    }
    task.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(user.userId),
      reason: input.completionNotes || input.blockerReason
    });

    task.updatedBy = new Types.ObjectId(user.userId);
    await task.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.TASK_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'task-status',
      targetEntity: 'ProjectTask',
      targetId: task._id.toString(),
      details: {
        taskCode: task.taskCode,
        fromStatus: oldStatus,
        toStatus: newStatus
      }
    });

    return task;
  }

  /**
   * 7. Update Task Attributes (Backward compatibility + extended fields).
   */
  public static async updateTask(
    taskId: string,
    input: UpdateProjectTaskParsed | UpdateUnifiedTaskInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IProjectTaskDocument> {
    const task = await this.getTaskById(taskId);

    if (input.title) task.title = input.title.trim();
    if (input.description !== undefined) task.description = input.description?.trim();

    if ((input as any).category) task.category = (input as any).category;
    if ((input as any).teamId !== undefined) {
      task.teamId = (input as any).teamId ? new Types.ObjectId((input as any).teamId) : undefined;
    }

    const inputAny = input as any;
    if (inputAny.milestoneId !== undefined) {
      if (inputAny.milestoneId && inputAny.milestoneId.trim() && task.projectId) {
        const project = await Project.findById(task.projectId);
        if (!project || !project.milestones.id(inputAny.milestoneId)) {
          throw AppError.validation(`Milestone does not belong to the task's project.`);
        }
        task.milestoneId = new Types.ObjectId(inputAny.milestoneId);
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
        if (task.assignedUserId?.toString() !== u._id.toString()) {
          task.reassignmentHistory.push({
            fromUserId: task.assignedUserId,
            toUserId: u._id,
            reassignedAt: new Date(),
            reassignedBy: new Types.ObjectId(user.userId),
            reason: 'Task attribute update'
          });
        }
        task.assignedUserId = u._id;
      } else {
        task.assignedUserId = undefined;
      }
    }

    if (input.priority) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate || undefined;
    if ((input as any).followUpDate !== undefined) task.followUpDate = (input as any).followUpDate;
    if ((input as any).blockerReason !== undefined) task.blockerReason = (input as any).blockerReason;
    if ((input as any).completionNotes !== undefined) task.completionNotes = (input as any).completionNotes;

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
      task.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: newStatus,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(user.userId)
      });
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
   * 8. Delete Task.
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
