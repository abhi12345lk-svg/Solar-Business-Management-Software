/**
 * INS Solar Business Management Software — Shared Common Zod Schemas
 */

import { z } from 'zod';

export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, {
    message: 'Mobile number must be in E.164 format (e.g. +919876543210).'
  });

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Must be a valid email address.' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional()
});

export type PaginationQueryParams = z.infer<typeof PaginationQuerySchema>;
