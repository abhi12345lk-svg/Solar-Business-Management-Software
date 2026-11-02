/**
 * INS Solar ERP — Role-Based Dashboard Utility Helpers
 * High-precision financial formatters, date boundary filters, and statistical aggregators.
 */

export type DateFilterRange =
  'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'PREV_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';

export interface DateFilterOption {
  value: DateFilterRange;
  label: string;
}

export const DATE_FILTER_OPTIONS: DateFilterOption[] = [
  { value: 'ALL', label: 'All Time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'PREV_MONTH', label: 'Previous Month' },
  { value: 'THIS_QUARTER', label: 'This Quarter' },
  { value: 'THIS_YEAR', label: 'This Year' }
];

/**
 * Validates if an ISO string, timestamp, or Date object falls inside the chosen DateFilterRange.
 */
export function isWithinDateRange(
  dateValue: string | Date | undefined | null,
  range: DateFilterRange
): boolean {
  if (range === 'ALL') return true;
  if (!dateValue) return false;

  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  switch (range) {
    case 'TODAY': {
      return (
        d.getFullYear() === currentYear &&
        d.getMonth() === currentMonth &&
        d.getDate() === currentDate
      );
    }
    case 'THIS_WEEK': {
      // Start of current week (Monday at 00:00:00)
      const dayOfWeek = now.getDay(); // 0 is Sunday
      const diffToMonday = (dayOfWeek + 6) % 7;
      const startOfWeek = new Date(
        currentYear,
        currentMonth,
        currentDate - diffToMonday,
        0,
        0,
        0,
        0
      );
      return d >= startOfWeek && d <= now;
    }
    case 'THIS_MONTH': {
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }
    case 'PREV_MONTH': {
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    }
    case 'THIS_QUARTER': {
      const currentQuarter = Math.floor(currentMonth / 3);
      const recordQuarter = Math.floor(d.getMonth() / 3);
      return d.getFullYear() === currentYear && recordQuarter === currentQuarter;
    }
    case 'THIS_YEAR': {
      return d.getFullYear() === currentYear;
    }
    default:
      return true;
  }
}

/**
 * Converts integer paise to standard Indian Rupees (INR) with optional compact abbreviation.
 */
export function formatPaiseToInr(
  paise: number | undefined | null,
  options?: { compact?: boolean; hideSymbol?: boolean }
): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return options?.hideSymbol ? '0' : '₹0';
  }

  const rupees = Math.round(paise / 100);
  const symbol = options?.hideSymbol ? '' : '₹';

  if (options?.compact) {
    const abs = Math.abs(rupees);
    if (abs >= 10000000) {
      return `${symbol}${(rupees / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${symbol}${(rupees / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${symbol}${(rupees / 1000).toFixed(1)} K`;
    }
  }

  return `${symbol}${rupees.toLocaleString('en-IN')}`;
}

/**
 * Formats standard date to human-readable Indian format: "DD MMM YYYY".
 */
export function formatShortDate(dateValue: string | Date | undefined | null): string {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Returns a human-friendly relative or timestamp string.
 */
export function formatRelativeTime(dateValue: string | Date | undefined | null): string {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return '—';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diffSec < 172800) return 'Yesterday';
  return formatShortDate(d);
}
