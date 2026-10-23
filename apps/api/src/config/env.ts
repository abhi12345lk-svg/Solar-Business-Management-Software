import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file if present
dotenv.config();

const DEFAULT_DEV_SESSION_SECRET = 'development-session-secret-min-32-characters-required!';
const DEFAULT_DEV_MFA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const DEFAULT_DEV_CSRF_SECRET = 'development-csrf-secret-min-32-characters-required!';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
    API_PREFIX: z.string().default('/api/v1'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MONGODB_URI: z.string().optional(),
    SESSION_SECRET: z.string().min(32).default(DEFAULT_DEV_SESSION_SECRET),
    SESSION_MAX_AGE_MS: z.coerce.number().int().min(60000).default(86400000), // 24 hours
    SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().min(60000).default(7200000), // 2 hours
    MFA_ENCRYPTION_KEY: z.string().min(32).default(DEFAULT_DEV_MFA_KEY),
    CSRF_SECRET: z.string().min(32).default(DEFAULT_DEV_CSRF_SECRET),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000), // 15 mins
    RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
    COOKIE_SECURE: z
      .string()
      .optional()
      .transform(val => (val === undefined ? undefined : val === 'true')),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax')
  })
  .superRefine((data, ctx) => {
    // In production, enforce strict security rules
    if (data.NODE_ENV === 'production') {
      if (!data.MONGODB_URI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGODB_URI'],
          message: 'MONGODB_URI is required in production environment'
        });
      }
      if (data.SESSION_SECRET === DEFAULT_DEV_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'Default development session secret must not be used in production'
        });
      }
      if (data.MFA_ENCRYPTION_KEY === DEFAULT_DEV_MFA_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MFA_ENCRYPTION_KEY'],
          message: 'Default development MFA encryption key must not be used in production'
        });
      }
      if (data.CSRF_SECRET === DEFAULT_DEV_CSRF_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CSRF_SECRET'],
          message: 'Default development CSRF secret must not be used in production'
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env): EnvConfig {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.errors
      .map(err => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

export const config = parseEnv(process.env);
