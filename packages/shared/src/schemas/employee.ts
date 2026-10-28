import { z } from 'zod';
import { Department, EmploymentStatus, EmployeeAvailability } from '../types/enums.js';

export const createEmployeeProfileSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  designation: z.string().min(2, 'Designation must be at least 2 characters').max(100),
  department: z.nativeEnum(Department),
  teamId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid team ID format')
    .optional(),
  isTeamLead: z.boolean().default(false).optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).default(EmploymentStatus.ACTIVE).optional(),
  availability: z
    .nativeEnum(EmployeeAvailability)
    .default(EmployeeAvailability.AVAILABLE)
    .optional(),
  joiningDate: z.coerce.date().optional(),
  skills: z.array(z.string().min(1).max(50)).default([]).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(100).optional(),
      relationship: z.string().min(2).max(50).optional(),
      phone: z.string().min(8).max(20).optional()
    })
    .optional(),
  notes: z.string().max(2000).optional()
});

export const updateEmployeeProfileSchema = z.object({
  designation: z.string().min(2).max(100).optional(),
  department: z.nativeEnum(Department).optional(),
  teamId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .nullable()
    .optional(),
  isTeamLead: z.boolean().optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  availability: z.nativeEnum(EmployeeAvailability).optional(),
  joiningDate: z.coerce.date().optional(),
  skills: z.array(z.string().min(1).max(50)).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(100).optional(),
      relationship: z.string().min(2).max(50).optional(),
      phone: z.string().min(8).max(20).optional()
    })
    .optional(),
  notes: z.string().max(2000).optional()
});

export const employeeFilterSchema = z.object({
  department: z.nativeEnum(Department).optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  availability: z.nativeEnum(EmployeeAvailability).optional(),
  teamId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform(val => (val === undefined ? undefined : val === 'true')),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export const createTeamSchema = z.object({
  name: z.string().min(3, 'Team name must be at least 3 characters').max(100),
  department: z.nativeEnum(Department),
  purpose: z.string().min(3, 'Team purpose is required').max(500),
  teamLeadId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid team lead user ID format'),
  memberUserIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .default([])
    .optional(),
  skills: z.array(z.string().min(1).max(50)).default([]).optional(),
  eligibility: z
    .object({
      projectTasks: z.boolean().default(true),
      serviceVisits: z.boolean().default(true)
    })
    .default({ projectTasks: true, serviceVisits: true })
    .optional()
});

export const updateTeamSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  department: z.nativeEnum(Department).optional(),
  purpose: z.string().min(3).max(500).optional(),
  teamLeadId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  memberUserIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  skills: z.array(z.string().min(1).max(50)).optional(),
  eligibility: z
    .object({
      projectTasks: z.boolean().optional(),
      serviceVisits: z.boolean().optional()
    })
    .optional(),
  isActive: z.boolean().optional()
});

export const teamFilterSchema = z.object({
  department: z.nativeEnum(Department).optional(),
  isActive: z
    .string()
    .optional()
    .transform(val => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export type CreateEmployeeProfileInput = z.infer<typeof createEmployeeProfileSchema>;
export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;
export type EmployeeFilterInput = z.infer<typeof employeeFilterSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamFilterInput = z.infer<typeof teamFilterSchema>;
