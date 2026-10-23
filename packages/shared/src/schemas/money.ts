/**
 * INS Solar Business Management Software — Monetary Primitives & Integer Paise Helpers
 *
 * CRITICAL RULE: Zero JavaScript floating-point arithmetic for authoritative financial calculations.
 * All financial amounts across the system are stored and calculated as Integer Paise (1 INR = 100 Paise).
 */

import { z } from 'zod';

export const MAX_SAFE_PAISE = Number.MAX_SAFE_INTEGER; // 9,007,199,254,740,991 Paise (~90,071 Crore INR)

/**
 * Standard non-negative monetary amount in integer paise (e.g. prices, bill line items, taxes).
 * Rejects decimals, negative values, and numbers exceeding Number.MAX_SAFE_INTEGER.
 */
export const MoneyPaiseSchema = z
  .number({
    invalid_type_error: 'Monetary amount must be an integer representing paise.'
  })
  .int({
    message: 'Monetary amount must be an integer (paise); floating-point amounts are prohibited.'
  })
  .min(0, { message: 'Monetary amount cannot be negative.' })
  .max(MAX_SAFE_PAISE, { message: 'Monetary amount exceeds maximum safe integer capacity.' });

/**
 * Strictly positive monetary amount in integer paise (> 0).
 */
export const PositiveMoneyPaiseSchema = z
  .number({
    invalid_type_error: 'Monetary amount must be an integer representing paise.'
  })
  .int({
    message: 'Monetary amount must be an integer (paise); floating-point amounts are prohibited.'
  })
  .min(1, { message: 'Monetary amount must be strictly greater than zero.' })
  .max(MAX_SAFE_PAISE, { message: 'Monetary amount exceeds maximum safe integer capacity.' });

/**
 * Signed monetary amount in integer paise (can be negative for adjustments, refunds, reversals).
 */
export const SignedMoneyPaiseSchema = z
  .number({
    invalid_type_error: 'Monetary amount must be an integer representing paise.'
  })
  .int({
    message: 'Monetary amount must be an integer (paise); floating-point amounts are prohibited.'
  })
  .min(-MAX_SAFE_PAISE, { message: 'Monetary amount exceeds minimum safe integer capacity.' })
  .max(MAX_SAFE_PAISE, { message: 'Monetary amount exceeds maximum safe integer capacity.' });

/**
 * Converts a rupee number (which may have up to 2 decimal places) into exact integer paise.
 * Rejects numbers with more than 2 fractional decimal places.
 * Throws an Error on invalid input to prevent silent rounding errors.
 */
export function rupeesToPaise(rupees: number): number {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    throw new TypeError('Rupees value must be a finite number.');
  }

  // Check decimal places: allow at most 2 decimal places
  const str = rupees.toString();
  const dotIndex = str.indexOf('.');
  if (dotIndex !== -1) {
    const decimals = str.slice(dotIndex + 1);
    if (decimals.length > 2) {
      throw new RangeError(
        `Invalid rupee amount '${rupees}'. Indian Rupees cannot have more than 2 decimal places.`
      );
    }
  }

  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError('Resulting paise amount exceeds maximum safe integer.');
  }

  return paise;
}

/**
 * Converts integer paise into fractional rupees (for display or reporting purposes only).
 */
export function paiseToRupees(paise: number): number {
  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new TypeError(`Paise must be an integer. Received: ${paise}`);
  }
  return paise / 100;
}

/**
 * Formats integer paise as standard Indian Currency format (e.g. "₹1,23,456.78" or "₹1,23,456").
 */
export function formatPaiseToInr(
  paise: number,
  options: { showPaise?: boolean; showSymbol?: boolean } = {}
): string {
  const { showPaise = true, showSymbol = true } = options;

  if (typeof paise !== 'number' || !Number.isInteger(paise)) {
    throw new TypeError(`Paise must be an integer. Received: ${paise}`);
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupeesPart = Math.floor(absPaise / 100);
  const paisePart = absPaise % 100;

  // Format integer portion with Indian numbering system (Lakhs & Crores)
  const rupeesStr = rupeesPart.toString();
  let formattedRupees = '';

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.slice(-3);
    const otherNumbers = rupeesStr.slice(0, -3);
    const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${withCommas},${lastThree}`;
  }

  let result = showSymbol ? '₹' : '';
  if (isNegative) {
    result = `-${result}`;
  }

  result += formattedRupees;

  if (showPaise) {
    result += `.${paisePart.toString().padStart(2, '0')}`;
  }

  return result;
}

/**
 * Multiplies an integer paise amount by a quantity or factor, returning integer paise rounded half-up.
 */
export function multiplyPaise(amountInPaise: number, factor: number): number {
  if (!Number.isInteger(amountInPaise)) {
    throw new TypeError(`amountInPaise must be an integer. Received: ${amountInPaise}`);
  }
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) {
    throw new TypeError(`factor must be a non-negative finite number. Received: ${factor}`);
  }

  const result = Math.round(amountInPaise * factor);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Multiplied paise amount exceeds maximum safe integer.');
  }
  return result;
}

/**
 * Calculates tax in integer paise given a taxable paise amount and tax rate in basis points.
 * 1% = 100 basis points. (e.g., 18% GST = 1800 basis points, 12% = 1200 basis points).
 */
export function calculateTaxPaise(taxableAmountInPaise: number, rateBasisPoints: number): number {
  if (!Number.isInteger(taxableAmountInPaise)) {
    throw new TypeError(
      `taxableAmountInPaise must be an integer. Received: ${taxableAmountInPaise}`
    );
  }
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new TypeError(
      `rateBasisPoints must be a non-negative integer. Received: ${rateBasisPoints}`
    );
  }

  return Math.round((taxableAmountInPaise * rateBasisPoints) / 10000);
}
