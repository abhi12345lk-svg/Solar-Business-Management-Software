import { z } from 'zod';
import { ProjectPriority, ProjectTaskStatus, TaskCategory } from '../types/enums.js';

export const createUnifiedTaskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional(),
  category: z.nativeEnum(TaskCategory).default(TaskCategory.GENERAL).optional(),
  priority: z.nativeEnum(ProjectPriority).default(ProjectPriority.MEDIUM).optional(),
  assignedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format').optional(),
  teamId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid team ID format').optional(),
  dueDate: z.coerce.date().optional(),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  milestoneId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
});

export const updateUnifiedTaskSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  assignedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  teamId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(ProjectTaskStatus).optional(),
  blockerReason: z.string().max(1000).optional(),
  completionNotes: z.string().max(1000).optional(),
  followUpDate: z.coerce.date().optional()
});

export const reassignTaskSchema = z.object({
  assignedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignee user ID format'),
  reason: z.string().min(3, 'Reassignment reason must be at least 3 characters').max(500)
});

export const updateTaskStatusSchema = z
  .object({
    status: z.nativeEnum(ProjectTaskStatus),
    completionNotes: z.string().max(1000).optional(),
    blockerReason: z.string().max(1000).optional(),
    followUpDate: z.coerce.date().optional()
  })
  .refine(
    data => {
      if (data.status === ProjectTaskStatus.BLOCKED && (!data.blockerReason || !data.blockerReason.trim())) {
        return false;
      }
      return true;
    },
    {
      message: 'blockerReason is required when marking a task as BLOCKED.',
      path: ['blockerReason']
    }
  );

export const unifiedTaskFilterSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  milestoneId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  assignedUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  teamId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.nativeEnum(ProjectTaskStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  isOverdue: z
    .string()
    .optional()
    .transform(val => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export type CreateUnifiedTaskInput = z.infer<typeof createUnifiedTaskSchema>;
export type UpdateUnifiedTaskInput = z.infer<typeof updateUnifiedTaskSchema>;
export type ReassignTaskInput = z.infer<typeof reassignTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type UnifiedTaskFilterInput = z.infer<typeof unifiedTaskFilterSchema>;
