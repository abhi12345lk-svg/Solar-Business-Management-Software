/**
 * INS Solar Business Management Software — Project Budget Validation Schemas
 *
 * Enforces integer-paise financial validation, category budgets, approval workflows,
 * and version revision reasons.
 */

import { z } from 'zod';
import { MoneyPaiseSchema } from './money.js';

export const createProjectBudgetSchema = z.object({
  projectId: z.string().min(1, 'Project reference is required.'),
  materialsBudgetPaise: MoneyPaiseSchema.optional().default(0),
  laborBudgetPaise: MoneyPaiseSchema.optional().default(0),
  logisticsBudgetPaise: MoneyPaiseSchema.optional().default(0),
  civilBudgetPaise: MoneyPaiseSchema.optional().default(0),
  miscBudgetPaise: MoneyPaiseSchema.optional().default(0),
  contingencyBudgetPaise: MoneyPaiseSchema.optional().default(0),
  notes: z.string().trim().max(1000).optional(),
  revisionReason: z.string().trim().max(500).optional()
});

export const approveProjectBudgetSchema = z.object({
  notes: z.string().trim().max(500).optional()
});

export const rejectProjectBudgetSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'A valid rejection reason is required.').max(500)
});

export type CreateProjectBudgetInput = z.input<typeof createProjectBudgetSchema>;
export type ApproveProjectBudgetInput = z.input<typeof approveProjectBudgetSchema>;
export type RejectProjectBudgetInput = z.input<typeof rejectProjectBudgetSchema>;
