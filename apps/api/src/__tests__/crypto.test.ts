import { describe, it, expect } from 'vitest';
import {
  encryptAesGcm,
  decryptAesGcm,
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken
} from '../utils/crypto.js';
import {
  generateMfaSetup,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  consumeRecoveryCode
} from '../utils/mfa.js';
import { generateSync } from 'otplib';

describe('Cryptographic & MFA Utilities', () => {
  describe('AES-256-GCM Encryption / Decryption', () => {
    it('encrypts and decrypts secrets correctly with authenticated tag', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptAesGcm(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = decryptAesGcm(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('fails decryption if ciphertext or auth tag is tampered with', () => {
      const plaintext = 'SecretTOTPKey';
      const encrypted = encryptAesGcm(plaintext);
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      const tampered = `${parts[0]}:${parts[1]}:bad${parts[2]?.slice(3)}`;

      expect(() => decryptAesGcm(tampered)).toThrow();
    });
  });

  describe('Argon2id Password Hashing & Verification', () => {
    it('generates an Argon2id hash starting with $argon2id$', async () => {
      const password = 'CorrectHorseBatteryStaple123!';
      const hash = await hashPassword(password);
      expect(hash.startsWith('$argon2id$')).toBe(true);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword(hash, 'WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Random Tokens & Hashing', () => {
    it('generates high entropy 64-character hex tokens', () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('hashes tokens deterministically with SHA-256', () => {
      const token = 'sample-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('TOTP & Recovery Codes', () => {
    it('generates MFA setup with QR code and verifies valid TOTP codes', async () => {
      const setup = await generateMfaSetup('admin@inssolar.com');
      expect(setup.secret).toBeTruthy();
      expect(decodeURIComponent(setup.otpauthUri)).toContain('admin@inssolar.com');
      expect(setup.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);

      // Generate matching TOTP code
      const validCode = generateSync({ secret: setup.secret });
      expect(verifyTotpCode(validCode, setup.secret)).toBe(true);
      expect(verifyTotpCode('000000', setup.secret)).toBe(false);
    });

    it('generates and consumes recovery codes only once', () => {
      const codes = generateRecoveryCodes(5);
      expect(codes).toHaveLength(5);
      codes.forEach(c => expect(c).toHaveLength(10));

      const storedHashes = codes.map(hashRecoveryCode);
      expect(storedHashes).toHaveLength(5);

      // Consume first code
      const result1 = consumeRecoveryCode(codes[0]!, storedHashes);
      expect(result1.valid).toBe(true);
      expect(result1.remainingHashes).toHaveLength(4);

      // Attempt to reuse same code against updated hashes
      const result2 = consumeRecoveryCode(codes[0]!, result1.remainingHashes);
      expect(result2.valid).toBe(false);
      expect(result2.remainingHashes).toHaveLength(4);
    });
  });
});
