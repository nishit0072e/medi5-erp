/**
 * Money and Monetary Precision Utilities for Medi5 ERP
 * 
 * Invariants:
 * 1. To prevent IEEE 754 floating-point rounding errors in financial transactions and inventory valuation,
 *    monetary calculations are performed using integer paise (1 INR = 100 paise).
 * 2. Financial totals must never silently drop precision or allow negative prices.
 */

/**
 * Converts rupees to integer paise (e.g. 24.50 -> 2450)
 */
export function toPaise(rupees: number): number {
  if (isNaN(rupees) || !isFinite(rupees)) {
    throw new Error('Invalid monetary value: value must be a finite number.');
  }
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise back to rupees (e.g. 2450 -> 24.50)
 */
export function fromPaise(paise: number): number {
  if (isNaN(paise) || !isFinite(paise)) {
    throw new Error('Invalid paise value: value must be a finite number.');
  }
  return paise / 100;
}

/**
 * Safely parses any user or string representation of Indian Rupees (e.g. "₹ 1,250.50", "Rs. 25", "45.00").
 * Returns a clean float number rounded to 2 decimal places.
 */
export function parseRupees(value: string | number): number {
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value) || value < 0) {
      throw new Error(`Invalid monetary amount: ${value}`);
    }
    const paise = toPaise(value);
    if (Math.abs(fromPaise(paise) - value) > 0.0001) {
      throw new Error(`Invalid monetary amount: ${value}. Sub-paise precision (more than 2 decimal places) is not permitted.`);
    }
    return fromPaise(paise);
  }

  if (typeof value !== 'string') {
    throw new Error('Monetary amount must be a string or number.');
  }

  // Remove currency symbols (₹, Rs, Rs.), commas, and whitespace
  const sanitized = value.replace(/[₹\s,]|rs\.?/gi, '').trim();
  if (!sanitized) {
    throw new Error('Monetary amount cannot be empty.');
  }

  // Reject strings with more than 2 decimal places (sub-paise amounts)
  if (/\.\d{3,}$/.test(sanitized)) {
    throw new Error(`Invalid monetary amount: "${value}". Sub-paise precision (more than 2 decimal places) is not permitted.`);
  }

  const parsed = parseFloat(sanitized);
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid monetary amount: "${value}". Must be a non-negative number.`);
  }

  return fromPaise(toPaise(parsed));
}

/**
 * Safely adds two monetary amounts in rupees using integer paise.
 */
export function addMoney(a: number, b: number): number {
  return fromPaise(toPaise(a) + toPaise(b));
}

/**
 * Safely subtracts b from a in rupees using integer paise.
 */
export function subtractMoney(a: number, b: number): number {
  return fromPaise(toPaise(a) - toPaise(b));
}

/**
 * Safely multiplies a monetary amount by a quantity using integer paise.
 */
export function multiplyMoney(unitAmount: number, quantity: number): number {
  return fromPaise(toPaise(unitAmount) * quantity);
}

/**
 * Formats a currency amount in Indian Rupees (₹).
 */
export function formatINR(amount: number): string {
  const safeAmount = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(safeAmount);
}
