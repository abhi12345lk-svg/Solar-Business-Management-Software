/**
 * INS Solar Business Management Software — Atomic Sequence Service
 *
 * Generates unique, strictly monotonic business numbers for enterprise records
 * (e.g. CUST-2026-00001, QT-2026-00001, ORD-2026-00001).
 *
 * CONCURRENCY GUARANTEES:
 * 1. ZERO read-then-increment logic. Uses atomic MongoDB `findOneAndUpdate` with `$inc: { currentValue: 1 }`.
 * 2. Race-Condition Defense: Catches E11000 duplicate key errors on concurrent first-time upserts and retries with exponential backoff & jitter.
 * 3. Never decrements or reuses committed numbers. Gaps are acceptable under aborted transactions to prevent duplicate key collisions.
 */

import mongoose from 'mongoose';
import { SequenceCounter } from '../models/SequenceCounter.js';
import { SequenceEntityType } from '@ins-solar/shared';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';

export interface NextSequenceOptions {
  entityType: SequenceEntityType | string;
  fiscalYear?: string;
  customPrefix?: string;
  padding?: number;
}

export interface GeneratedSequenceResult {
  formattedNumber: string;
  sequenceNumber: number;
  sequenceKey: string;
  prefix: string;
  fiscalYear: string;
}

const DEFAULT_PREFIXES: Record<string, string> = {
  [SequenceEntityType.CUSTOMER]: 'CUST',
  [SequenceEntityType.LEAD]: 'LEAD',
  [SequenceEntityType.SITE_SURVEY]: 'SRV',
  [SequenceEntityType.SOLAR_DESIGN]: 'DES',
  [SequenceEntityType.QUOTATION]: 'QT',
  [SequenceEntityType.ORDER]: 'ORD',
  [SequenceEntityType.PROJECT]: 'PRJ',
  [SequenceEntityType.PURCHASE_ORDER]: 'PO',
  [SequenceEntityType.INVOICE]: 'INV',
  [SequenceEntityType.PAYMENT_RECEIPT]: 'REC',
  [SequenceEntityType.SERVICE_TICKET]: 'TKT',
  [SequenceEntityType.AMC_CONTRACT]: 'AMC',
  [SequenceEntityType.STOCK_MOVEMENT]: 'STK',
  [SequenceEntityType.STOCK_RESERVATION]: 'RES',
  [SequenceEntityType.PRODUCT]: 'PROD',
  [SequenceEntityType.WAREHOUSE]: 'WH',
  [SequenceEntityType.VENDOR]: 'VEN',
  [SequenceEntityType.GOODS_RECEIPT]: 'GRN',
  [SequenceEntityType.VENDOR_INVOICE]: 'VINV',
  [SequenceEntityType.TASK]: 'TSK',
  [SequenceEntityType.MATERIAL_DISPATCH]: 'DSP',
  [SequenceEntityType.NET_METERING]: 'NMA',
  [SequenceEntityType.SUBSIDY]: 'SUB',
  [SequenceEntityType.SERVICE_VISIT]: 'VIS',
  [SequenceEntityType.WARRANTY_CLAIM]: 'CLM',
  [SequenceEntityType.PAYMENT_ALLOCATION]: 'ALC',
  [SequenceEntityType.EXPENSE]: 'EXP',
  [SequenceEntityType.NOTIFICATION]: 'NTF'
};

const DEFAULT_PADDING = 5;
const MAX_RETRIES = 5;

// In-memory atomic fallback store for isolated test suites or offline dev
const inMemoryCounters = new Map<string, number>();

/**
 * Calculates standard Indian Fiscal Year string (e.g. "2026" for FY 2026-27 starting 1st April).
 */
export function getCurrentFiscalYear(date: Date = new Date(), startMonth = 4): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed (1 to 12)
  const fyYear = month >= startMonth ? year : year - 1;
  return fyYear.toString();
}

/**
 * Formats sequence string: <PREFIX>-<FISCAL_YEAR>-<PADDED_NUMBER>
 * e.g. CUST-2026-00042
 */
export function formatSequence(
  prefix: string,
  fiscalYear: string,
  num: number,
  padding: number
): string {
  const padded = String(num).padStart(padding, '0');
  return `${prefix}-${fiscalYear}-${padded}`;
}

export class SequenceService {
  /**
   * Clears the in-memory counter store (used strictly between isolated unit tests).
   */
  public static resetInMemoryCounters(): void {
    inMemoryCounters.clear();
  }

  /**
   * Convenience shortcut to generate the next formatted business sequence number.
   */
  public static async generateNumber(
    entityType: SequenceEntityType | string,
    customPrefix?: string
  ): Promise<GeneratedSequenceResult> {
    return SequenceService.generateNextSequence({ entityType, customPrefix });
  }

  /**
   * Atomically increments and returns the next unique business sequence number.
   * Concurrency-safe under heavy parallel loads.
   */
  public static async generateNextSequence(
    options: NextSequenceOptions
  ): Promise<GeneratedSequenceResult> {
    const { entityType, customPrefix } = options;

    if (!entityType || typeof entityType !== 'string' || entityType.trim() === '') {
      throw AppError.validation([
        { field: 'entityType', issue: 'Entity type is required to allocate sequence.' }
      ]);
    }

    const cleanEntityType = entityType.trim().toUpperCase();
    const prefix = (
      customPrefix ||
      DEFAULT_PREFIXES[cleanEntityType] ||
      cleanEntityType.substring(0, 4)
    ).toUpperCase();
    const fiscalYear = options.fiscalYear || getCurrentFiscalYear();
    const padding =
      options.padding && options.padding >= 3 && options.padding <= 10
        ? options.padding
        : DEFAULT_PADDING;

    const sequenceKey = `${cleanEntityType}:${fiscalYear}`;

    // 1. If MongoDB is connected, execute atomic MongoDB findOneAndUpdate with retry
    if (mongoose.connection.readyState === 1) {
      return await SequenceService.executeMongoSequence(
        sequenceKey,
        cleanEntityType,
        fiscalYear,
        prefix,
        padding
      );
    }

    // 2. Production safety guard: In-memory fallback is strictly FORBIDDEN in production
    const isProduction = process.env.NODE_ENV === 'production' || config.NODE_ENV === 'production';
    if (isProduction) {
      logger.error(
        { sequenceKey, entityType: cleanEntityType },
        'Attempted to generate business sequence number in production while MongoDB is disconnected. Blocked.'
      );
      throw AppError.database(
        `Database connection unavailable. Sequence generation for '${sequenceKey}' is strictly rejected in production to prevent counter desynchronization or duplicate number issuance.`
      );
    }

    // 3. For non-production: restrict in-memory fallback to test environment or explicit dev flag
    const isTest = process.env.NODE_ENV === 'test' || config.NODE_ENV === 'test';
    const isDevExplicit = process.env.ALLOW_IN_MEMORY_SEQUENCE === 'true';

    if (!isTest && !isDevExplicit) {
      throw AppError.database(
        `Database connection unavailable. In-memory sequence fallback is disabled in development unless ALLOW_IN_MEMORY_SEQUENCE='true' is explicitly set.`
      );
    }

    // 4. Otherwise use atomic in-memory counter (for isolated unit testing without live MongoDB)
    return SequenceService.executeInMemorySequence(
      sequenceKey,
      cleanEntityType,
      fiscalYear,
      prefix,
      padding
    );
  }

  /**
   * Atomic MongoDB execution with retry backoff for E11000 upsert collision races.
   */
  private static async executeMongoSequence(
    sequenceKey: string,
    entityType: string,
    fiscalYear: string,
    prefix: string,
    padding: number
  ): Promise<GeneratedSequenceResult> {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        const doc = await SequenceCounter.findOneAndUpdate(
          { sequenceKey },
          {
            $inc: { currentValue: 1 },
            $setOnInsert: {
              entityType,
              fiscalYear,
              prefix,
              padding,
              createdAt: new Date()
            }
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );

        if (!doc) {
          throw new Error('Failed to retrieve incremented sequence document.');
        }

        const formattedNumber = formatSequence(prefix, fiscalYear, doc.currentValue, padding);
        return {
          formattedNumber,
          sequenceNumber: doc.currentValue,
          sequenceKey,
          prefix,
          fiscalYear
        };
      } catch (err: any) {
        const isDuplicateKey =
          err?.code === 11000 ||
          (err?.name === 'MongoServerError' && err?.message?.includes('E11000'));
        if (isDuplicateKey && attempt < MAX_RETRIES) {
          // Concurrent first-time insert collision: back off with jitter and retry
          const backoffMs = 10 * Math.pow(2, attempt) + Math.floor(Math.random() * 20);
          logger.warn(
            { sequenceKey, attempt, backoffMs },
            'Encountered first-time upsert collision in SequenceService; retrying with backoff.'
          );
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        logger.error({ err: err?.message, sequenceKey, attempt }, 'Sequence generation failed.');
        throw new AppError(500, `Database error generating sequence number for '${sequenceKey}'.`);
      }
    }

    throw new AppError(500, `Exhausted retries generating sequence for '${sequenceKey}'.`);
  }

  /**
   * Atomic in-memory execution fallback.
   */
  private static executeInMemorySequence(
    sequenceKey: string,
    _entityType: string,
    fiscalYear: string,
    prefix: string,
    padding: number
  ): GeneratedSequenceResult {
    const current = inMemoryCounters.get(sequenceKey) || 0;
    const nextVal = current + 1;
    inMemoryCounters.set(sequenceKey, nextVal);

    const formattedNumber = formatSequence(prefix, fiscalYear, nextVal, padding);
    return {
      formattedNumber,
      sequenceNumber: nextVal,
      sequenceKey,
      prefix,
      fiscalYear
    };
  }

  /**
   * Read-only preview of the next sequence number without incrementing the counter.
   * Useful for showing draft preview in sales UI (clearly non-authoritative).
   */
  public static async previewNextSequence(options: NextSequenceOptions): Promise<string> {
    const { entityType, customPrefix } = options;
    const cleanEntityType = entityType.trim().toUpperCase();
    const prefix = (
      customPrefix ||
      DEFAULT_PREFIXES[cleanEntityType] ||
      cleanEntityType.substring(0, 4)
    ).toUpperCase();
    const fiscalYear = options.fiscalYear || getCurrentFiscalYear();
    const padding = options.padding || DEFAULT_PADDING;
    const sequenceKey = `${cleanEntityType}:${fiscalYear}`;

    let currentValue = 0;
    if (mongoose.connection.readyState === 1) {
      const counter = await SequenceCounter.findOne({ sequenceKey });
      currentValue = counter?.currentValue ?? 0;
    } else {
      const isProduction =
        process.env.NODE_ENV === 'production' || config.NODE_ENV === 'production';
      if (isProduction) {
        throw AppError.database(
          `Database connection unavailable. Sequence preview is disabled in production without an active MongoDB connection.`
        );
      }
      currentValue = inMemoryCounters.get(sequenceKey) ?? 0;
    }

    return formatSequence(prefix, fiscalYear, currentValue + 1, padding);
  }
}
