/**
 * Date and Expiry Calculation Utilities for Medi5 ERP
 * 
 * Expiry Convention:
 * - If only month/year is provided (e.g. "2026-10"), the expiry boundary is set to the
 *   final calendar day of that month at 23:59:59.
 * - Stock is considered EXPIRED as soon as current time exceeds that boundary.
 * - Batches with <= 60 days remaining are flagged as EXPIRING_SOON.
 */

import { ExpiryUrgency } from '../types/inventory';

/**
 * Normalizes an expiry string (YYYY-MM or YYYY-MM-DD) into a standard JavaScript Date object
 * pointing to the end of the specified calendar day (23:59:59.999).
 */
export function parseExpiryDate(dateStr: string): Date {
  const parts = dateStr.trim().split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-12

  if (parts.length === 2) {
    // Format: YYYY-MM -> last day of this month (month index in JS is 0-11, so passing month gives day 0 of next month)
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, lastDayOfMonth, 23, 59, 59, 999);
  }

  const day = parseInt(parts[2], 10);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/**
 * Returns the number of calendar days between now and the target date.
 * Positive number = days in the future.
 * Negative number = days in the past (expired).
 */
export function getDaysUntilExpiry(expiryDateStr: string, referenceDate: Date = new Date()): number {
  const expiry = parseExpiryDate(expiryDateStr);
  const diffMs = expiry.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates the urgency tier of an expiry date.
 */
export function getExpiryUrgency(
  expiryDateStr: string, 
  thresholdDays: number = 60, 
  referenceDate: Date = new Date()
): ExpiryUrgency {
  const days = getDaysUntilExpiry(expiryDateStr, referenceDate);
  if (days <= 0) return 'EXPIRED';
  if (days <= thresholdDays) return 'EXPIRING_SOON';
  return 'VALID';
}

/**
 * Formats a date string into human-readable Indian format: "DD MMM YYYY" or "MMM YYYY"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const parts = dateStr.trim().split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month - 1] || '';

  if (parts.length === 2) {
    return `${monthName} ${year}`;
  }

  const day = parseInt(parts[2], 10);
  return `${day.toString().padStart(2, '0')} ${monthName} ${year}`;
}

/**
 * Formats days remaining into friendly badge text.
 */
export function formatExpiryBadge(expiryDateStr: string, referenceDate: Date = new Date()): {
  label: string;
  urgency: ExpiryUrgency;
  days: number;
} {
  const days = getDaysUntilExpiry(expiryDateStr, referenceDate);
  const urgency = getExpiryUrgency(expiryDateStr, 60, referenceDate);

  if (urgency === 'EXPIRED') {
    const daysAgo = Math.abs(days);
    return {
      label: daysAgo === 0 ? 'Expires today' : `Expired ${daysAgo}d ago`,
      urgency,
      days
    };
  }

  if (urgency === 'EXPIRING_SOON') {
    return {
      label: `Expires in ${days}d`,
      urgency,
      days
    };
  }

  const months = Math.floor(days / 30);
  return {
    label: `${months}m remaining`,
    urgency,
    days
  };
}

/**
 * Formats a currency amount in Indian Rupees (₹).
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
}
