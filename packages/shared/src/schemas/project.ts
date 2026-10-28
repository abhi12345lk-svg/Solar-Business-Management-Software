import { z } from 'zod';
import {
  ProjectStatus,
  ProjectStage,
  MilestoneStatus,
  ProjectPriority,
  ProjectTaskStatus,
  SolarTopology
} from '../types/enums.js';
import { PaginationQuerySchema } from './common.js';

export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * 1. Project Schemas
 */
export const createProjectSchema = z
  .object({
    name: z.string().trim().min(3, 'Project name must be at least 3 characters').max(150),
    customerId: z.string().trim().regex(OBJECT_ID_REGEX, 'Invalid customer ID'),
    orderId: z
      .string()
      .trim()
      .regex(OBJECT_ID_REGEX, 'Invalid order ID')
      .optional()
      .or(z.literal('')),
    quotationId: z
      .string()
      .trim()
      .regex(OBJECT_ID_REGEX, 'Invalid quotation ID')
      .optional()
      .or(z.literal('')),
    solarDesignId: z
      .string()
      .trim()
      .regex(OBJECT_ID_REGEX, 'Invalid solar design ID')
      .optional()
      .or(z.literal('')),
    projectManagerId: z
      .string()
      .trim()
      .regex(OBJECT_ID_REGEX, 'Invalid project manager ID')
      .optional()
      .or(z.literal('')),
    teamMemberIds: z
      .array(z.string().trim().regex(OBJECT_ID_REGEX, 'Invalid team member ID'))
      .optional(),
    siteAddress: z
      .object({
        addressLine1: z.string().trim().min(1, 'Address Line 1 is required'),
        addressLine2: z.string().trim().optional(),
        city: z.string().trim().min(1, 'City is required'),
        state: z.string().trim().min(1, 'State is required'),
        postalCode: z.string().trim().min(1, 'Postal code is required'),
        country: z.string().trim().default('India')
      })
      .optional(),
    systemCapacityKwp: z.number().positive('System capacity must be greater than 0').optional(),
    systemTopology: z.nativeEnum(SolarTopology).optional(),
    plannedStartDate: z
      .string()
      .or(z.date())
      .transform(val => new Date(val)),
    targetCompletionDate: z
      .string()
      .or(z.date())
      .transform(val => new Date(val)),
    priority: z.nativeEnum(ProjectPriority).optional().default(ProjectPriority.MEDIUM),
    notes: z.string().trim().max(2000).optional(),
    applyDefaultMilestones: z.boolean().optional().default(true)
  })
  .refine(
    data => {
      if (!data.plannedStartDate || !data.targetCompletionDate) return true;
      return data.targetCompletionDate.getTime() >= data.plannedStartDate.getTime();
    },
    {
      message: 'Target completion date must be on or after planned start date',
      path: ['targetCompletionDate']
    }
  );

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Project name must be at least 3 characters')
      .max(150)
      .optional(),
    projectManagerId: z
      .string()
      .trim()
      .regex(OBJECT_ID_REGEX, 'Invalid project manager ID')
      .optional()
      .or(z.literal(''))
      .nullable(),
    teamMemberIds: z
      .array(z.string().trim().regex(OBJECT_ID_REGEX, 'Invalid team member ID'))
      .optional(),
    siteAddress: z
      .object({
        addressLine1: z.string().trim().min(1, 'Address Line 1 is required'),
        addressLine2: z.string().trim().optional(),
        city: z.string().trim().min(1, 'City is required'),
        state: z.string().trim().min(1, 'State is required'),
        postalCode: z.string().trim().min(1, 'Postal code is required'),
        country: z.string().trim().default('India')
      })
      .optional(),
    systemCapacityKwp: z.number().positive('System capacity must be greater than 0').optional(),
    systemTopology: z.nativeEnum(SolarTopology).optional(),
    plannedStartDate: z
      .string()
      .or(z.date())
      .transform(val => new Date(val))
      .optional(),
    targetCompletionDate: z
      .string()
      .or(z.date())
      .transform(val => new Date(val))
      .optional(),
    priority: z.nativeEnum(ProjectPriority).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .refine(
    data => {
      if (data.plannedStartDate && data.targetCompletionDate) {
        return data.targetCompletionDate.getTime() >= data.plannedStartDate.getTime();
      }
      return true;
    },
    {
      message: 'Target completion date must be on or after planned start date',
      path: ['targetCompletionDate']
    }
  );

export const updateProjectStatusSchema = z
  .object({
    status: z.nativeEnum(ProjectStatus),
    reason: z.string().trim().max(500).optional()
  })
  .refine(
    data => {
      if (
        (data.status === ProjectStatus.ON_HOLD || data.status === ProjectStatus.CANCELLED) &&
        (!data.reason || data.reason.trim().length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Reason is required when placing a project on hold or cancelling',
      path: ['reason']
    }
  );

export const updateProjectStageSchema = z.object({
  stage: z.nativeEnum(ProjectStage),
  notes: z.string().trim().max(1000).optional()
});

export const projectFilterSchema = PaginationQuerySchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  currentStage: z.nativeEnum(ProjectStage).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  customerId: z.string().trim().optional(),
  projectManagerId: z.string().trim().optional()
});

/**
 * 2. Milestone Schemas
 */
export const createMilestoneSchema = z.object({
  name: z.string().trim().min(2, 'Milestone name must be at least 2 characters').max(150),
  description: z.string().trim().max(1000).optional(),
  displayOrder: z.number().int().min(0).optional(),
  plannedStartDate: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .optional(),
  dueDate: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .optional(),
  assignedUserId: z
    .string()
    .trim()
    .regex(OBJECT_ID_REGEX, 'Invalid user ID')
    .optional()
    .or(z.literal(''))
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

export const updateMilestoneStatusSchema = z
  .object({
    status: z.nativeEnum(MilestoneStatus),
    blockerReason: z.string().trim().max(500).optional(),
    completionNotes: z.string().trim().max(1000).optional()
  })
  .refine(
    data => {
      if (
        data.status === MilestoneStatus.BLOCKED &&
        (!data.blockerReason || data.blockerReason.trim().length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Blocker reason is required when marking a milestone as BLOCKED',
      path: ['blockerReason']
    }
  );

/**
 * 3. Project Task Schemas
 */
export const createProjectTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title must be at least 2 characters').max(200),
  description: z.string().trim().max(2000).optional(),
  milestoneId: z
    .string()
    .trim()
    .regex(OBJECT_ID_REGEX, 'Invalid milestone ID')
    .optional()
    .or(z.literal('')),
  assignedUserId: z
    .string()
    .trim()
    .regex(OBJECT_ID_REGEX, 'Invalid assigned user ID')
    .optional()
    .or(z.literal('')),
  priority: z.nativeEnum(ProjectPriority).optional().default(ProjectPriority.MEDIUM),
  dueDate: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .optional()
});

export const updateProjectTaskSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  milestoneId: z.string().trim().regex(OBJECT_ID_REGEX).optional().nullable(),
  assignedUserId: z.string().trim().regex(OBJECT_ID_REGEX).optional().nullable(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  status: z.nativeEnum(ProjectTaskStatus).optional(),
  dueDate: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .optional()
    .nullable()
});

export const projectTaskFilterSchema = PaginationQuerySchema.extend({
  projectId: z.string().trim().optional(),
  milestoneId: z.string().trim().optional(),
  assignedUserId: z.string().trim().optional(),
  status: z.nativeEnum(ProjectTaskStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  isOverdue: z.coerce.boolean().optional()
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectParsed = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type UpdateProjectParsed = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type UpdateProjectStageInput = z.infer<typeof updateProjectStageSchema>;
export type ProjectFilterInput = z.infer<typeof projectFilterSchema>;

export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type CreateMilestoneParsed = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;
export type UpdateMilestoneParsed = z.infer<typeof updateMilestoneSchema>;
export type UpdateMilestoneStatusInput = z.infer<typeof updateMilestoneStatusSchema>;

export type CreateProjectTaskInput = z.input<typeof createProjectTaskSchema>;
export type CreateProjectTaskParsed = z.infer<typeof createProjectTaskSchema>;
export type UpdateProjectTaskInput = z.input<typeof updateProjectTaskSchema>;
export type UpdateProjectTaskParsed = z.infer<typeof updateProjectTaskSchema>;
export type ProjectTaskFilterInput = z.infer<typeof projectTaskFilterSchema>;
