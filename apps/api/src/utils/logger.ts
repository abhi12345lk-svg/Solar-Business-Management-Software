import pino from 'pino';
import { config } from '../config/env.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.headers["x-csrf-token"]',
      'password',
      'newPassword',
      'passwordHash',
      'token',
      'tokenHash',
      'secret',
      'sessionId',
      'challengeToken',
      'totpCode',
      'recoveryCode',
      'otp',
      'otpHash',
      'magicLinkTokenHash',
      'mfaSecretEncrypted',
      'mfaRecoveryCodesHashed',
      'connectionString',
      '*.password',
      '*.newPassword',
      '*.secret',
      '*.token',
      '*.tokenHash',
      '*.totpCode',
      '*.recoveryCode',
      '*.otp',
      '*.otpHash',
      '*.magicLinkTokenHash',
      '*.mfaSecretEncrypted',
      '*.mfaRecoveryCodesHashed'
    ],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: label => ({ level: label })
  }
});
