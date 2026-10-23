import { describe, it, expect } from 'vitest';
import { parseEnv } from '../config/env.js';

describe('Environment Configuration Validation', () => {
  it('parses valid environment configurations with defaults', () => {
    const valid = parseEnv({
      NODE_ENV: 'test',
      PORT: '5000',
      SESSION_SECRET: 'test-secret-at-least-16-characters-long'
    });

    expect(valid.NODE_ENV).toBe('test');
    expect(valid.PORT).toBe(5000);
    expect(valid.API_PREFIX).toBe('/api/v1');
  });

  it('throws descriptive error on invalid PORT (e.g. non-numeric or out of range)', () => {
    expect(() => parseEnv({ PORT: '999999' })).toThrow(/Invalid environment configuration/);
    expect(() => parseEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment configuration/);
  });

  it('throws descriptive error on invalid NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'invalid-environment' as any })).toThrow(
      /Invalid environment configuration/
    );
  });

  it('throws descriptive error if SESSION_SECRET is too short (<32 chars)', () => {
    expect(() => parseEnv({ SESSION_SECRET: 'short' })).toThrow(
      /Invalid environment configuration/
    );
  });

  it('fails safely in production if MONGODB_URI is missing or default secrets are used', () => {
    // Missing MONGODB_URI in production
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a'.repeat(32),
        MFA_ENCRYPTION_KEY: 'b'.repeat(32),
        CSRF_SECRET: 'c'.repeat(32)
      })
    ).toThrow(/MONGODB_URI is required in production/);

    // Using default dev SESSION_SECRET in production
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/prod',
        SESSION_SECRET: 'development-session-secret-min-32-characters-required!',
        MFA_ENCRYPTION_KEY: 'b'.repeat(32),
        CSRF_SECRET: 'c'.repeat(32)
      })
    ).toThrow(/Default development session secret must not be used in production/);

    // Using default dev MFA_ENCRYPTION_KEY in production
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/prod',
        SESSION_SECRET: 'a'.repeat(32),
        MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        CSRF_SECRET: 'c'.repeat(32)
      })
    ).toThrow(/Default development MFA encryption key must not be used in production/);

    // Using default dev CSRF_SECRET in production
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://localhost:27017/prod',
        SESSION_SECRET: 'a'.repeat(32),
        MFA_ENCRYPTION_KEY: 'b'.repeat(32),
        CSRF_SECRET: 'development-csrf-secret-min-32-characters-required!'
      })
    ).toThrow(/Default development CSRF secret must not be used in production/);
  });
});
