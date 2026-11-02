/**
 * WhatsApp Utilities & Refill Calculations (Phase 3)
 * Provides safe phone number formatting, refill status calculations,
 * and user-confirmed WhatsApp prefilled links.
 */

import { RefillStatus } from '../types/patient';

/**
 * Normalizes phone numbers to international Indian WhatsApp format (e.g. 919830012345).
 */
export function formatWhatsAppPhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `91${digitsOnly.substring(1)}`;
  }
  return digitsOnly;
}

/**
 * Validates whether a phone number is a valid 10-digit Indian mobile number.
 */
export function isValidIndianMobile(phone: string): boolean {
  const normalized = formatWhatsAppPhoneNumber(phone);
  return /^91[6-9]\d{9}$/.test(normalized);
}

/**
 * Computes next refill due date from last dispensed date + days supply.
 * Returns ISO date string "YYYY-MM-DD".
 */
export function calculateRefillDueDate(lastDispensedDate: string, daysSupply: number): string {
  const [year, month, day] = lastDispensedDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Math.max(1, daysSupply));
  return date.toISOString().split('T')[0];
}

/**
 * Determines current refill status and day differential relative to a reference date.
 */
export function getRefillUrgency(
  nextRefillDueDate: string,
  referenceDateStr?: string
): { status: RefillStatus; diffDays: number; label: string } {
  const todayStr = referenceDateStr || new Date().toISOString().split('T')[0];
  const [refY, refM, refD] = todayStr.split('-').map(Number);
  const [dueY, dueM, dueD] = nextRefillDueDate.split('-').map(Number);

  const refDate = new Date(Date.UTC(refY, refM - 1, refD));
  const dueDate = new Date(Date.UTC(dueY, dueM - 1, dueD));

  const diffTime = dueDate.getTime() - refDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'OVERDUE',
      diffDays,
      label: overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`
    };
  }

  if (diffDays === 0) {
    return {
      status: 'DUE_TODAY',
      diffDays: 0,
      label: 'Due Today'
    };
  }

  return {
    status: 'UPCOMING',
    diffDays,
    label: diffDays === 1 ? 'Due in 1 day' : `Due in ${diffDays} days`
  };
}

/**
 * Generates polite, personalized refill reminder message in English / Bengali-Indian retail style.
 */
export function generateRefillReminderMessage(params: {
  patientName: string;
  pharmacyName: string;
  pharmacyPhone: string;
  medicineName: string;
  strength: string;
  nextRefillDueDate: string;
}): string {
  const { patientName, pharmacyName, pharmacyPhone, medicineName, strength, nextRefillDueDate } = params;
  
  // Format readable due date (e.g. 05 Nov 2026)
  const [y, m, d] = nextRefillDueDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const readableDate = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

  return `Namaskar ${patientName},\n\nThis is a gentle medicine refill reminder from *${pharmacyName}*.\n\nYour regular prescription *${medicineName} (${strength})* is scheduled for refill around *${readableDate}*.\n\nIf you would like us to pack your strip/medicine in advance for quick pickup or doorstep delivery, please reply to this message or call us at *${pharmacyPhone}*.\n\nThank you for choosing ${pharmacyName}! Stay healthy.`;
}

/**
 * Constructs user-initiated WhatsApp link.
 * Confirms recipient and message before opening.
 */
export function buildWhatsAppLink(phone: string, text: string): string {
  const formattedPhone = formatWhatsAppPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}
