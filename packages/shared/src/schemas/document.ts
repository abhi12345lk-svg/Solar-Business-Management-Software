import { z } from 'zod';
import {
  DocumentCategory,
  DocumentAccessClassification,
  DocumentReviewStatus
} from '../types/enums.js';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'text/csv'
] as const;

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const uploadDocumentMetadataSchema = z.object({
  originalFilename: z.string().min(1, 'Original filename is required').max(255),
  safeDisplayName: z.string().min(1, 'Display name is required').max(255),
  category: z.nativeEnum(DocumentCategory),
  accessClassification: z
    .nativeEnum(DocumentAccessClassification)
    .default(DocumentAccessClassification.INTERNAL_ONLY)
    .optional(),
  mimeType: z.string().refine(val => (ALLOWED_MIME_TYPES as readonly string[]).includes(val), {
    message:
      'Unsupported document MIME type. Allowed formats: PDF, JPEG, PNG, WEBP, XLSX, DOCX, TXT, CSV.'
  }),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_DOCUMENT_FILE_SIZE_BYTES, 'Document file size must not exceed 25MB'),
  checksumSha256: z.string().max(128).optional(),
  customerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  projectId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  expiryDate: z.coerce.date().optional(),
  metadata: z.record(z.any()).default({}).optional()
});

export const updateDocumentMetadataSchema = z.object({
  safeDisplayName: z.string().min(1).max(255).optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
  accessClassification: z.nativeEnum(DocumentAccessClassification).optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  metadata: z.record(z.any()).optional()
});

export const reviewDocumentSchema = z
  .object({
    reviewStatus: z.nativeEnum(DocumentReviewStatus),
    reviewNotes: z.string().max(1000).optional(),
    rejectionReason: z.string().max(1000).optional()
  })
  .superRefine((data, ctx) => {
    if (
      (data.reviewStatus === DocumentReviewStatus.REJECTED ||
        data.reviewStatus === DocumentReviewStatus.RESUBMISSION_REQUIRED) &&
      (!data.rejectionReason || data.rejectionReason.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message:
          'Rejection reason must be at least 5 characters when rejecting or requesting resubmission.'
      });
    }
  });

export const createDocumentVersionSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  safeDisplayName: z.string().min(1).max(255).optional(),
  mimeType: z.string().refine(val => (ALLOWED_MIME_TYPES as readonly string[]).includes(val)),
  fileSizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_FILE_SIZE_BYTES),
  checksumSha256: z.string().max(128).optional(),
  versionNotes: z.string().max(1000).optional(),
  expiryDate: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional()
});

export const documentFilterSchema = z.object({
  category: z.nativeEnum(DocumentCategory).optional(),
  accessClassification: z.nativeEnum(DocumentAccessClassification).optional(),
  reviewStatus: z.nativeEnum(DocumentReviewStatus).optional(),
  customerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  projectId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  isLatestVersion: z
    .string()
    .optional()
    .transform(val => (val === undefined ? undefined : val === 'true')),
  isArchived: z
    .string()
    .optional()
    .transform(val => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  sortBy: z
    .enum(['createdAt', 'safeDisplayName', 'fileSizeBytes', 'reviewStatus', 'category'])
    .default('createdAt')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
});

export type UploadDocumentMetadataInput = z.infer<typeof uploadDocumentMetadataSchema>;
export type UpdateDocumentMetadataInput = z.infer<typeof updateDocumentMetadataSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;
export type DocumentFilterInput = z.infer<typeof documentFilterSchema>;
