/**
 * INS Solar Business Management Software — Installation Checklist & Evidence Schemas
 */

import { z } from 'zod';
import { ChecklistCategory, ChecklistItemStatus } from '../types/enums.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const checklistTemplateItemSchema = z.object({
  itemCode: z.string().trim().min(2).max(50),
  description: z.string().trim().min(3).max(500),
  isRequired: z.boolean().default(true),
  requiresEvidence: z.boolean().default(false)
});

export const checklistTemplateCategorySchema = z.object({
  category: z.nativeEnum(ChecklistCategory),
  title: z.string().trim().min(3).max(200),
  items: z.array(checklistTemplateItemSchema).min(1, 'Category must have at least one checklist item')
});

export const createChecklistTemplateSchema = z.object({
  templateCode: z.string().trim().min(3).max(50),
  title: z.string().trim().min(3).max(200),
  categories: z.array(checklistTemplateCategorySchema).min(1, 'Template must contain at least one category')
});

export const generateProjectChecklistSchema = z.object({
  templateCode: z.string().trim().optional(),
  templateId: z.string().regex(OBJECT_ID_REGEX).optional()
});

export const updateChecklistItemStatusSchema = z
  .object({
    status: z.nativeEnum(ChecklistItemStatus),
    failureReason: z.string().trim().max(1000).optional(),
    blockerReason: z.string().trim().max(1000).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .superRefine((data, ctx) => {
    if (data.status === ChecklistItemStatus.FAILED && (!data.failureReason || !data.failureReason.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failureReason'],
        message: 'Failure reason is strictly required when checklist item status is FAILED'
      });
    }
    if (data.status === ChecklistItemStatus.BLOCKED && (!data.blockerReason || !data.blockerReason.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blockerReason'],
        message: 'Blocker reason is strictly required when checklist item status is BLOCKED'
      });
    }
  });

export const uploadEvidenceMetadataSchema = z.object({
  caption: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

export type ChecklistTemplateItemInput = z.input<typeof checklistTemplateItemSchema>;
export type ChecklistTemplateItemParsed = z.infer<typeof checklistTemplateItemSchema>;

export type ChecklistTemplateCategoryInput = z.input<typeof checklistTemplateCategorySchema>;
export type ChecklistTemplateCategoryParsed = z.infer<typeof checklistTemplateCategorySchema>;

export type CreateChecklistTemplateInput = z.input<typeof createChecklistTemplateSchema>;
export type CreateChecklistTemplateParsed = z.infer<typeof createChecklistTemplateSchema>;

export type GenerateProjectChecklistInput = z.input<typeof generateProjectChecklistSchema>;
export type GenerateProjectChecklistParsed = z.infer<typeof generateProjectChecklistSchema>;

export type UpdateChecklistItemStatusInput = z.input<typeof updateChecklistItemStatusSchema>;
export type UpdateChecklistItemStatusParsed = z.infer<typeof updateChecklistItemStatusSchema>;

export type UploadEvidenceMetadataInput = z.input<typeof uploadEvidenceMetadataSchema>;
export type UploadEvidenceMetadataParsed = z.infer<typeof uploadEvidenceMetadataSchema>;
