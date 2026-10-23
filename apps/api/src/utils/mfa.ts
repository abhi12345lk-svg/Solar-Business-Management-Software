import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'node:crypto';
import { hashToken } from './crypto.js';

export interface MfaSetupData {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

/**
 * Generates a new TOTP secret, otpauth URI, and QR code Data URL for employee enrollment.
 */
export async function generateMfaSetup(email: string): Promise<MfaSetupData> {
  const secret = generateSecret();
  const otpauthUri = generateURI({
    issuer: 'INS Solar',
    label: email,
    secret
  });

  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256
  });

  return {
    secret,
    otpauthUri,
    qrCodeDataUrl
  };
}

/**
 * Verifies a 6-digit TOTP code against a plaintext secret.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    const result = verifySync({
      token: code,
      secret
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generates an array of single-use, 10-character alphanumeric recovery codes.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 5 bytes produces 10 uppercase hex characters
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hashes a recovery code for secure database storage.
 */
export function hashRecoveryCode(code: string): string {
  // Normalize code by removing whitespace and converting to uppercase
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  return hashToken(`RECOVERY_CODE:${normalized}`);
}

/**
 * Verifies and consumes a recovery code against an array of stored recovery code hashes.
 * Returns the updated array of remaining hashes if valid, or null if invalid.
 */
export function consumeRecoveryCode(
  candidateCode: string,
  storedHashes: string[]
): { valid: boolean; remainingHashes: string[] } {
  const candidateHash = hashRecoveryCode(candidateCode);
  const matchIndex = storedHashes.indexOf(candidateHash);

  if (matchIndex === -1) {
    return { valid: false, remainingHashes: storedHashes };
  }

  // Remove the consumed code
  const remainingHashes = [...storedHashes];
  remainingHashes.splice(matchIndex, 1);
  return { valid: true, remainingHashes };
}
