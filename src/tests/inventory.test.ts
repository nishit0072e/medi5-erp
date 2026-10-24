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
import { 
  getInitialSeedState, 
  processStockReceipt, 
  processStockAdjustment, 
  saveDemoInventory, 
  loadDemoInventory, 
  resetDemoInventory,
  DEMO_STORAGE_KEY 
} from '../data/demoRepository';
import { toPaise, fromPaise, addMoney, multiplyMoney, parseRupees, formatINR } from '../utils/moneyUtils';

class MockStorage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
  removeItem(key: string) { delete this.store[key]; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
}

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = new MockStorage();
}

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

describe('Stage 3A: Batch Receiving & Stock Ledger', () => {
  it('receives a new batch and logs an auditable PURCHASE_RECEIPT movement', () => {
    const state = getInitialSeedState();
    const doloInitialBatches = state.batches.filter((b) => b.medicineId === 'med-dolo-650');
    expect(doloInitialBatches.length).toBe(2);

    const result = processStockReceipt(state, {
      medicineId: 'med-dolo-650',
      batchNumber: 'SYN-NEW-2027',
      expiryDate: '2027-11',
      purchaseCost: 26.50,
      mrp: 35.00,
      quantity: 100,
      supplierName: 'East India Pharma Wholesalers',
      notes: 'Fresh consignment receipt'
    });

    expect(result.isExistingBatch).toBe(false);
    expect(result.affectedBatch.batchNumber).toBe('SYN-NEW-2027');
    expect(result.affectedBatch.quantityReceived).toBe(100);
    expect(result.affectedBatch.quantityRemaining).toBe(100);
    expect(result.affectedBatch.purchaseCost).toBe(26.50);
    expect(result.affectedBatch.mrp).toBe(35.00);

    // Ledger movement validation
    expect(result.newMovement.movementType).toBe('PURCHASE_RECEIPT');
    expect(result.newMovement.quantityChange).toBe(100);
    expect(result.newMovement.balanceBefore).toBe(0);
    expect(result.newMovement.balanceAfter).toBe(100);
    expect(result.newMovement.balanceAfter).toBe(result.newMovement.balanceBefore + result.newMovement.quantityChange);

    // Batch count increased
    const updatedDoloBatches = result.nextState.batches.filter((b) => b.medicineId === 'med-dolo-650');
    expect(updatedDoloBatches.length).toBe(3);
  });

  it('receives additional stock into an existing compatible batch without overwriting history', () => {
    const state = getInitialSeedState();
    const targetBatch = state.batches.find((b) => b.batchNumber === 'SYN-DL-24A');
    expect(targetBatch).toBeDefined();
    const priorRemaining = targetBatch!.quantityRemaining; // 18
    const priorReceived = targetBatch!.quantityReceived;   // 100

    const result = processStockReceipt(state, {
      medicineId: targetBatch!.medicineId,
      batchNumber: 'SYN-DL-24A',
      expiryDate: targetBatch!.expiryDate,
      purchaseCost: targetBatch!.purchaseCost,
      mrp: targetBatch!.mrp,
      quantity: 50,
      supplierName: targetBatch!.supplierName,
      notes: 'Supplemental stock arrival'
    });

    expect(result.isExistingBatch).toBe(true);
    expect(result.affectedBatch.quantityReceived).toBe(priorReceived + 50);
    expect(result.affectedBatch.quantityRemaining).toBe(priorRemaining + 50);

    // Movement must record accurate before/after progression
    expect(result.newMovement.balanceBefore).toBe(priorRemaining);
    expect(result.newMovement.balanceAfter).toBe(priorRemaining + 50);
    expect(result.newMovement.quantityChange).toBe(50);
    expect(result.newMovement.balanceAfter).toBe(result.newMovement.balanceBefore + result.newMovement.quantityChange);

    // Ensure total batch count did NOT increase
    const currentBatches = result.nextState.batches.filter((b) => b.medicineId === targetBatch!.medicineId);
    expect(currentBatches.length).toBe(state.batches.filter((b) => b.medicineId === targetBatch!.medicineId).length);
  });

  it('rejects conflicting duplicate batch details with an explicit error', () => {
    const state = getInitialSeedState();
    const existing = state.batches.find((b) => b.batchNumber === 'SYN-DL-24A')!;

    // 1. Conflicting expiry date
    expect(() => {
      processStockReceipt(state, {
        medicineId: existing.medicineId,
        batchNumber: 'SYN-DL-24A',
        expiryDate: '2029-01', // Existing is 2026-11-30
        purchaseCost: existing.purchaseCost,
        mrp: existing.mrp,
        quantity: 20
      });
    }).toThrow(/Conflicting batch details/i);

    // 2. Conflicting purchase cost
    expect(() => {
      processStockReceipt(state, {
        medicineId: existing.medicineId,
        batchNumber: 'SYN-DL-24A',
        expiryDate: existing.expiryDate,
        purchaseCost: 28.00, // Existing is 24.50
        mrp: 38.00,          // Valid non-negative MRP >= cost
        quantity: 20
      });
    }).toThrow(/Conflicting batch details/i);
  });

  it('updates derived medicine totals and summary KPIs after batch receiving', () => {
    const state = getInitialSeedState();
    const refDate = new Date('2026-10-17T12:00:00Z');

    const doloBefore = calculateMedicineSummary(
      state.medicines.find((m) => m.id === 'med-dolo-650')!,
      state.batches,
      refDate
    );
    expect(doloBefore.totalQuantity).toBe(158);

    const received = processStockReceipt(state, {
      medicineId: 'med-dolo-650',
      batchNumber: 'SYN-NEW-LOT',
      expiryDate: '2028-05',
      purchaseCost: 25.00,
      mrp: 35.00,
      quantity: 42
    });

    const doloAfter = calculateMedicineSummary(
      received.nextState.medicines.find((m) => m.id === 'med-dolo-650')!,
      received.nextState.batches,
      refDate
    );
    expect(doloAfter.totalQuantity).toBe(158 + 42);
    expect(doloAfter.saleableQuantity).toBe(158 + 42);
  });

  it('strictly validates the invariant balance_after = balance_before + quantity_change across all movements', () => {
    const state = getInitialSeedState();
    for (const mov of state.movements) {
      expect(mov.balanceAfter).toBe(mov.balanceBefore + mov.quantityChange);
    }
  });

  it('rejects stock adjustment that would produce a negative stock balance', () => {
    const state = getInitialSeedState();
    const batch = state.batches.find((b) => b.batchNumber === 'SYN-AG-62X')!; // remaining: 6

    expect(() => {
      processStockAdjustment(state, {
        batchId: batch.id,
        movementType: 'DAMAGE_WRITE_OFF',
        quantityChange: -10, // 6 - 10 = -4 (illegal)
        reason: 'Transit damage'
      });
    }).toThrow(/invariant violation.*negative stock/i);
  });

  it('writes off expired stock, preserves zero-quantity batch without deletion, and logs movement', () => {
    const state = getInitialSeedState();
    const cetzineBatch = state.batches.find((b) => b.batchNumber === 'SYN-CT-EXP01')!; // 15 expired units
    expect(cetzineBatch.quantityRemaining).toBe(15);

    const result = processStockAdjustment(state, {
      batchId: cetzineBatch.id,
      movementType: 'EXPIRED_WRITE_OFF',
      quantityChange: -15,
      reason: 'Segregated and incinerated expired stock'
    });

    // Invariant check
    expect(result.newMovement.quantityChange).toBe(-15);
    expect(result.newMovement.balanceBefore).toBe(15);
    expect(result.newMovement.balanceAfter).toBe(0);
    expect(result.newMovement.balanceAfter).toBe(result.newMovement.balanceBefore + result.newMovement.quantityChange);

    // Batch must NOT be silently deleted!
    const batchAfter = result.nextState.batches.find((b) => b.id === cetzineBatch.id);
    expect(batchAfter).toBeDefined();
    expect(batchAfter?.quantityRemaining).toBe(0);
    expect(batchAfter?.status).toBe('DEPLETED');
  });

  it('preserves ledger history through corrections without mutating old movements', () => {
    const state = getInitialSeedState();
    const initialMovementCount = state.movements.length;
    const initialFirstMovementId = state.movements[0].id;

    // Apply an audit correction (+5 physical recount)
    const result = processStockAdjustment(state, {
      batchId: state.batches[0].id,
      movementType: 'AUDIT_CORRECTION',
      quantityChange: 5,
      reason: 'Physical count found 5 extra units on back shelf'
    });

    // Append-only invariant
    expect(result.nextState.movements.length).toBe(initialMovementCount + 1);
    expect(result.nextState.movements[0].movementType).toBe('AUDIT_CORRECTION');
    // Prior movements unchanged
    expect(result.nextState.movements[1].id).toBe(initialFirstMovementId);
  });

  it('persists changes to localStorage and restores cleanly on reload', () => {
    const state = getInitialSeedState();
    const modifiedState = processStockReceipt(state, {
      medicineId: 'med-dolo-650',
      batchNumber: 'PERSIST-TEST-1',
      expiryDate: '2027-10',
      purchaseCost: 20,
      mrp: 30,
      quantity: 55
    }).nextState;

    saveDemoInventory(modifiedState);

    const reloaded = loadDemoInventory();
    expect(reloaded.batches.some((b) => b.batchNumber === 'PERSIST-TEST-1')).toBe(true);

    // Safe reset clears demo additions back to initial seed dataset
    const reset = resetDemoInventory();
    expect(reset.batches.some((b) => b.batchNumber === 'PERSIST-TEST-1')).toBe(false);
    expect(reset.medicines.length).toBe(MOCK_MEDICINES.length);
  });

  it('recovers gracefully from malformed or corrupted localStorage data', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEMO_STORAGE_KEY, '{ invalid json: [');
      const recovered = loadDemoInventory();
      expect(recovered.medicines.length).toBeGreaterThan(0);
      expect(recovered.batches.length).toBeGreaterThan(0);
      expect(recovered.movements.length).toBeGreaterThan(0);
    }
  });

  it('avoids floating point rounding issues using integer paise arithmetic', () => {
    expect(toPaise(24.50)).toBe(2450);
    expect(fromPaise(2450)).toBe(24.50);
    expect(addMoney(0.1, 0.2)).toBe(0.3); // standard float 0.1 + 0.2 is 0.30000000000000004
    expect(multiplyMoney(19.99, 3)).toBe(59.97);
  });
});

describe('Stage 3A.1: Integrity Audit & Regression Coverage', () => {
  it('FEFO selection ignores batches with zero remaining quantity (depleted)', () => {
    const med: Medicine = {
      id: 'med-fefo-depleted-test',
      name: 'Depleted FEFO Test',
      genericName: 'Sample',
      strength: '500 mg',
      dosageForm: 'Tablet',
      unitLabel: 'Strips',
      category: 'Test',
      lowStockThreshold: 10
    };

    const batches: MedicineBatch[] = [
      {
        id: 'b-earlier-depleted',
        medicineId: 'med-fefo-depleted-test',
        batchNumber: 'DEPLETED-EARLIER',
        expiryDate: '2026-11-30', // Expires sooner, but remaining is 0!
        purchaseCost: 20,
        mrp: 30,
        quantityReceived: 100,
        quantityRemaining: 0,
        supplierName: 'Wholesaler A',
        status: 'ACTIVE',
        receivedDate: '2025-01-01'
      },
      {
        id: 'b-later-active',
        medicineId: 'med-fefo-depleted-test',
        batchNumber: 'ACTIVE-LATER',
        expiryDate: '2027-12-31', // Expires later, has 45 units available
        purchaseCost: 22,
        mrp: 32,
        quantityReceived: 50,
        quantityRemaining: 45,
        supplierName: 'Wholesaler B',
        status: 'ACTIVE',
        receivedDate: '2026-01-01'
      }
    ];

    const refDate = new Date('2026-10-17T12:00:00Z');
    const summary = calculateMedicineSummary(med, batches, refDate);

    // Saleable stock must be 45 (depleted batch contributes 0)
    expect(summary.saleableQuantity).toBe(45);
    // FEFO MUST pick the batch that actually has stock (ACTIVE-LATER), NOT the zero-stock batch!
    expect(summary.fefoEligibleBatch).not.toBeNull();
    expect(summary.fefoEligibleBatch?.batchNumber).toBe('ACTIVE-LATER');
    expect(summary.fefoEligibleBatch?.quantityRemaining).toBe(45);
  });

  it('formatDisplayDate safely formats both YYYY-MM, YYYY-MM-DD, and MM/YYYY without errors', () => {
    expect(formatDisplayDate('2027-11')).toBe('Nov 2027');
    expect(formatDisplayDate('2027-11-30')).toBe('30 Nov 2027');
    expect(formatDisplayDate('11/2027')).toBe('Nov 2027');
    expect(formatDisplayDate('11-2027')).toBe('Nov 2027');
    expect(formatDisplayDate('')).toBe('N/A');
  });

  it('parseRupees handles currency symbols, commas, and guards against invalid/negative values', () => {
    expect(parseRupees('₹ 1,250.50')).toBe(1250.50);
    expect(parseRupees('Rs. 24.50')).toBe(24.50);
    expect(parseRupees('35')).toBe(35.00);
    expect(parseRupees(42.8)).toBe(42.80);

    // Negative amounts must throw
    expect(() => parseRupees('-15.00')).toThrow(/Invalid monetary amount/i);
    expect(() => parseRupees(-10)).toThrow(/Invalid monetary amount/i);
    expect(() => parseRupees('abc')).toThrow(/Invalid monetary amount/i);
    expect(formatINR(1250.5)).toContain('1,250.50');
  });

  it('saveDemoInventory returns boolean and handles storage failure cleanly', () => {
    const state = getInitialSeedState();
    // Normal save succeeds
    const success = saveDemoInventory(state);
    expect(typeof success).toBe('boolean');

    // Test storage failure handling
    if (typeof window !== 'undefined' && window.localStorage) {
      const origSetItem = window.localStorage.setItem;
      window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const result = saveDemoInventory(state);
      expect(result).toBe(false); // Does not falsely claim data was saved!

      window.localStorage.setItem = origSetItem;
    }
  });

  it('processStockReceipt rejects non-integer/fractional quantities', () => {
    const state = getInitialSeedState();
    expect(() => {
      processStockReceipt(state, {
        medicineId: 'med-dolo-650',
        batchNumber: 'SYN-FRAC-1',
        expiryDate: '2027-10',
        purchaseCost: 20,
        mrp: 30,
        quantity: 12.5 // Fractional quantity not allowed
      });
    }).toThrow(/Quantity received must be a positive integer/i);
  });

  it('processStockAdjustment rejects non-integer/fractional adjustments', () => {
    const state = getInitialSeedState();
    const batch = state.batches[0];
    expect(() => {
      processStockAdjustment(state, {
        batchId: batch.id,
        movementType: 'AUDIT_CORRECTION',
        quantityChange: 2.5, // Fractional adjustment not allowed
        reason: 'Recount error'
      });
    }).toThrow(/Quantity change must be a non-zero integer/i);
  });

  it('scopes batch identity strictly to medicineId without collisions across different medicines', () => {
    const state = getInitialSeedState();
    // Receive batch "COMMON-LOT-1" for Dolo 650
    const res1 = processStockReceipt(state, {
      medicineId: 'med-dolo-650',
      batchNumber: 'COMMON-LOT-1',
      expiryDate: '2027-12',
      purchaseCost: 20,
      mrp: 30,
      quantity: 50
    });

    // Receive the SAME batch number "COMMON-LOT-1" for Augmentin 625 (different medicine)
    const res2 = processStockReceipt(res1.nextState, {
      medicineId: 'med-augmentin-625',
      batchNumber: 'COMMON-LOT-1',
      expiryDate: '2028-06',
      purchaseCost: 120,
      mrp: 160,
      quantity: 30
    });

    // Both batches must exist as separate batch records under their respective medicines
    const doloBatch = res2.nextState.batches.find(b => b.medicineId === 'med-dolo-650' && b.batchNumber === 'COMMON-LOT-1');
    const augBatch = res2.nextState.batches.find(b => b.medicineId === 'med-augmentin-625' && b.batchNumber === 'COMMON-LOT-1');

    expect(doloBatch).toBeDefined();
    expect(augBatch).toBeDefined();
    expect(doloBatch?.id).not.toBe(augBatch?.id);
    expect(doloBatch?.quantityRemaining).toBe(50);
    expect(augBatch?.quantityRemaining).toBe(30);
  });

  it('failed operations leave inventory and ledger completely unchanged', () => {
    const state = getInitialSeedState();
    const originalBatchCount = state.batches.length;
    const originalMovementCount = state.movements.length;

    // Trigger an invalid receipt (e.g. MRP < cost)
    expect(() => {
      processStockReceipt(state, {
        medicineId: 'med-dolo-650',
        batchNumber: 'SYN-FAIL-1',
        expiryDate: '2027-10',
        purchaseCost: 50,
        mrp: 20, // Illegal: MRP < cost
        quantity: 10
      });
    }).toThrow();

    // Verify initial state was not mutated
    expect(state.batches.length).toBe(originalBatchCount);
    expect(state.movements.length).toBe(originalMovementCount);
  });

  describe('Stage 3B.2: Monetary Precision & parseRupees Validation', () => {
    it('rejects sub-paise strings and numbers with more than 2 decimal places', () => {
      // Sub-paise strings
      expect(() => parseRupees('10.555')).toThrow(/Sub-paise precision/);
      expect(() => parseRupees('0.001')).toThrow(/Sub-paise precision/);
      expect(() => parseRupees('99.999')).toThrow(/Sub-paise precision/);

      // Sub-paise numbers
      expect(() => parseRupees(10.555)).toThrow(/Sub-paise precision/);
      expect(() => parseRupees(0.001)).toThrow(/Sub-paise precision/);
    });

    it('rejects negative numbers, non-numeric strings, and invalid values', () => {
      expect(() => parseRupees(-10)).toThrow(/Invalid monetary amount/);
      expect(() => parseRupees('-25.50')).toThrow(/Invalid monetary amount/);
      expect(() => parseRupees('abc')).toThrow(/Invalid monetary amount/);
      expect(() => parseRupees('')).toThrow(/Monetary amount cannot be empty/);
      expect(() => parseRupees(NaN)).toThrow(/Invalid monetary amount/);
      expect(() => parseRupees(Infinity)).toThrow(/Invalid monetary amount/);
    });

    it('accepts and correctly parses valid integer and two-decimal currency formats', () => {
      expect(parseRupees(0)).toBe(0);
      expect(parseRupees('0')).toBe(0);
      expect(parseRupees('0.00')).toBe(0);
      expect(parseRupees('25')).toBe(25);
      expect(parseRupees('25.5')).toBe(25.5);
      expect(parseRupees('25.50')).toBe(25.5);
      expect(parseRupees('₹ 1,250.75')).toBe(1250.75);
      expect(parseRupees('Rs. 499.00')).toBe(499);
      expect(parseRupees(125.45)).toBe(125.45);
    });
  });
});



