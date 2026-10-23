import crypto from 'node:crypto';
import argon2 from 'argon2';
import { config } from '../config/env.js';

/**
 * Derives a 32-byte Buffer from a given key string (either 64-char hex or UTF-8).
 */
function getDerivedKey(keyString: string): Buffer {
  if (keyString.length === 64 && /^[0-9a-fA-F]+$/.test(keyString)) {
    return Buffer.from(keyString, 'hex');
  }
  // Otherwise derive a deterministic 32-byte key via SHA-256
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptAesGcm(plaintext: string, secretKey = config.MFA_ENCRYPTION_KEY): string {
  const key = getDerivedKey(secretKey);
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a packed AES-256-GCM ciphertext string (<iv_hex>:<authTag_hex>:<ciphertext_hex>).
 */
export function decryptAesGcm(
  packedCiphertext: string,
  secretKey = config.MFA_ENCRYPTION_KEY
): string {
  const parts = packedCiphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  const key = getDerivedKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a cryptographically secure random token (e.g. for reset tokens, magic links).
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token using SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hashes an employee password using Argon2id with OWASP-recommended parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1
  });
}

/**
 * Verifies a candidate password against an Argon2id password hash.
 */
export async function verifyPassword(hash: string, candidate: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}
