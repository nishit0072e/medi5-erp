/**
 * Medi5 ERP - Inventory Domain Logic & Invariant Tests
 * 
 * Tests:
 * 1. Month-end expiry convention (YYYY-MM maps to final calendar day at 23:59:59).
 * 2. Dynamic batch calculation (totals, saleable, expired segregation).
 * 3. FEFO (First-Expired, First-Out) priority selection among valid batches.
 * 4. Exclusion of expired batches from saleable stock.
 * 5. Low-stock and out-of-stock threshold evaluation.
 */

import { describe, it, expect } from 'vitest';

import { parseExpiryDate, getExpiryUrgency, formatDisplayDate } from '../utils/dateUtils';
import { calculateMedicineSummary, calculateAllSummaries, calculateInventoryKpis } from '../utils/inventoryCalculations';
import { MOCK_MEDICINES, MOCK_BATCHES } from '../data/mockInventory';
import { Medicine, MedicineBatch } from '../types/inventory';

describe('Date & Expiry Convention', () => {
  it('normalizes YYYY-MM to the final calendar day of that month', () => {
    // Leap year Feb 2024 -> 29 days
    const febLeap = parseExpiryDate('2024-02');
    expect(febLeap.getFullYear()).toBe(2024);
    expect(febLeap.getMonth()).toBe(1); // February (0-indexed)
    expect(febLeap.getDate()).toBe(29);
    expect(febLeap.getHours()).toBe(23);
    expect(febLeap.getMinutes()).toBe(59);

    // Non-leap year Feb 2025 -> 28 days
    const febNonLeap = parseExpiryDate('2025-02');
    expect(febNonLeap.getDate()).toBe(28);

    // October 2026 -> 31 days
    const oct2026 = parseExpiryDate('2026-10');
    expect(oct2026.getDate()).toBe(31);
  });

  it('correctly categorizes EXPIRED, EXPIRING_SOON, and VALID against reference date', () => {
    const referenceDate = new Date('2026-10-17T12:00:00Z');

    // Expired in past (Aug 2026)
    expect(getExpiryUrgency('2026-08-31', 60, referenceDate)).toBe('EXPIRED');

    // Expiring soon (< 60 days: Nov 2026 is ~44 days)
    expect(getExpiryUrgency('2026-11-30', 60, referenceDate)).toBe('EXPIRING_SOON');

    // Valid (> 60 days: Dec 2027 is ~440 days)
    expect(getExpiryUrgency('2027-12-31', 60, referenceDate)).toBe('VALID');
  });

  it('formats display dates clearly', () => {
    expect(formatDisplayDate('2026-11-30')).toBe('30 Nov 2026');
    expect(formatDisplayDate('2026-11')).toBe('Nov 2026');
  });
});

describe('Inventory Calculation Invariants', () => {
  const refDate = new Date('2026-10-17T12:00:00Z');

  it('strictly excludes expired batches from saleable quantity', () => {
    const med: Medicine = {
      id: 'med-test-1',
      name: 'Test Antihistamine',
      genericName: 'Cetirizine',
      strength: '10mg',
      dosageForm: 'Tablet',
      unitLabel: 'Strips',
      category: 'Antihistamine',
      lowStockThreshold: 10
    };

    const batches: MedicineBatch[] = [
      {
        id: 'b-1',
        medicineId: 'med-test-1',
        batchNumber: 'B-EXPIRED',
        expiryDate: '2026-08-31', // Expired
        purchaseCost: 10,
        mrp: 20,
        quantityReceived: 50,
        quantityRemaining: 15, // Expired 15 units
        supplierName: 'Test Supplier',
        status: 'EXPIRED',
        receivedDate: '2025-01-01'
      },
      {
        id: 'b-2',
        medicineId: 'med-test-1',
        batchNumber: 'B-ACTIVE',
        expiryDate: '2027-08-31', // Valid
        purchaseCost: 12,
        mrp: 22,
        quantityReceived: 50,
        quantityRemaining: 30, // Valid 30 units
        supplierName: 'Test Supplier',
        status: 'ACTIVE',
        receivedDate: '2026-01-01'
      }
    ];

    const summary = calculateMedicineSummary(med, batches, refDate);

    // Total quantity should include all remaining physical units (15 + 30 = 45)
    expect(summary.totalQuantity).toBe(45);
    // Saleable quantity MUST only be 30 (expired units excluded!)
    expect(summary.saleableQuantity).toBe(30);
    expect(summary.expiredQuantity).toBe(15);
    expect(summary.hasExpiredBatches).toBe(true);
    expect(summary.isLowStock).toBe(false); // 30 > threshold 10
  });

  it('selects the earliest expiring valid batch under FEFO rule', () => {
    const med: Medicine = {
      id: 'med-test-fefo',
      name: 'Test Paracetamol',
      genericName: 'Paracetamol',
      strength: '500mg',
      dosageForm: 'Tablet',
      unitLabel: 'Strips',
      category: 'Analgesic',
      lowStockThreshold: 10
    };

    const batches: MedicineBatch[] = [
      {
        id: 'b-later',
        medicineId: 'med-test-fefo',
        batchNumber: 'BATCH-2028',
        expiryDate: '2028-12-31', // Later expiry
        purchaseCost: 20,
        mrp: 30,
        quantityReceived: 100,
        quantityRemaining: 80,
        supplierName: 'Supplier A',
        status: 'ACTIVE',
        receivedDate: '2026-06-01'
      },
      {
        id: 'b-sooner',
        medicineId: 'med-test-fefo',
        batchNumber: 'BATCH-2026-NOV',
        expiryDate: '2026-11-30', // Earlier expiry -> FEFO winner
        purchaseCost: 18,
        mrp: 28,
        quantityReceived: 50,
        quantityRemaining: 12,
        supplierName: 'Supplier B',
        status: 'ACTIVE',
        receivedDate: '2025-06-01'
      }
    ];

    const summary = calculateMedicineSummary(med, batches, refDate);

    expect(summary.totalQuantity).toBe(92);
    expect(summary.saleableQuantity).toBe(92);
    expect(summary.fefoEligibleBatch).toBeDefined();
    expect(summary.fefoEligibleBatch?.batchNumber).toBe('BATCH-2026-NOV');
    expect(summary.earliestExpiryDate).toBe('2026-11-30');
  });

  it('correctly evaluates low-stock and out-of-stock states', () => {
    const summaries = calculateAllSummaries(MOCK_MEDICINES, MOCK_BATCHES, refDate);
    const kpis = calculateInventoryKpis(summaries);

    // Dolo 650: 18 + 140 = 158 units (threshold 25) -> In Stock
    const dolo = summaries.find(s => s.medicine.id === 'med-dolo-650');
    expect(dolo).toBeDefined();
    expect(dolo?.saleableQuantity).toBe(158);
    expect(dolo?.isLowStock).toBe(false);

    // Augmentin 625: 6 units (threshold 15) -> Low Stock
    const augmentin = summaries.find(s => s.medicine.id === 'med-augmentin-625');
    expect(augmentin).toBeDefined();
    expect(augmentin?.saleableQuantity).toBe(6);
    expect(augmentin?.isLowStock).toBe(true);

    // Glycomet: 0 units -> Out of Stock
    const glycomet = summaries.find(s => s.medicine.id === 'med-glycomet-500');
    expect(glycomet).toBeDefined();
    expect(glycomet?.saleableQuantity).toBe(0);
    expect(glycomet?.isOutOfStock).toBe(true);

    // KPI verification
    expect(kpis.totalMedicines).toBe(6);
    expect(kpis.lowStockCount).toBe(1); // Augmentin
    expect(kpis.outOfStockCount).toBe(1); // Glycomet
    expect(kpis.expiredBatchesCount).toBe(1); // Cetzine expired batch
  });
});
