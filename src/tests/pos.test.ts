/**
 * Medi5 ERP - Stage 3B: Interactive Counter Sales / POS Domain & FEFO Tests
 * 
 * Comprehensive tests verifying:
 * 1. Cart line manipulation and quantity validation
 * 2. Search and unavailable stock detection
 * 3. Pure FEFO allocation across multiple batches
 * 4. Strict exclusion of expired, quarantined, and depleted batches
 * 5. Multi-batch pricing math (distinct MRPs and purchase costs in integer paise)
 * 6. Financial calculations (Total Bill MRP, Selling Bill, Discount, COGS, Gross Profit)
 * 7. Below-cost warning and mandatory confirmation enforcement
 * 8. Atomic checkout execution, batch balance deductions, and SALE_DISPENSE ledger logging
 * 9. Checkout idempotency token handling (same-token retry replay vs. different-payload rejection)
 * 10. Failure isolation (inventory, ledger, and sales history left completely untouched on error)
 * 11. Local persistence failure handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Medicine, MedicineBatch, CartLineItem } from '../types/inventory';
import { 
  getEligibleFefoBatches, 
  allocateMedicineStockFEFO, 
  calculateCartAllocations 
} from '../utils/fefoAllocation';
import { 
  getInitialSeedState, 
  processSaleCheckout, 
  saveDemoInventory, 
  loadDemoInventory,
  resetDemoInventory,
  InventoryState,
  DEMO_STORAGE_KEY,
  DEMO_STORAGE_VERSION
} from '../data/demoRepository';

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

describe('Stage 3B: FEFO Allocation Engine', () => {
  const refDate = new Date('2026-10-17T12:00:00Z');

  const testMedicine: Medicine = {
    id: 'med-paracetamol-500',
    name: 'Paracetamol 500',
    genericName: 'Paracetamol',
    strength: '500 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (10 tabs)',
    category: 'Analgesic',
    lowStockThreshold: 10
  };

  const testBatches: MedicineBatch[] = [
    // Batch 1: Expired (Oct 10, 2026) -> Should be excluded
    {
      id: 'batch-exp-01',
      medicineId: 'med-paracetamol-500',
      batchNumber: 'LOT-EXPIRED',
      expiryDate: '2026-10-10',
      purchaseCost: 15.00,
      mrp: 25.00,
      quantityReceived: 50,
      quantityRemaining: 20,
      supplierName: 'Vendor A',
      status: 'ACTIVE',
      receivedDate: '2025-01-01'
    },
    // Batch 2: Quarantined -> Should be excluded
    {
      id: 'batch-quarantine-01',
      medicineId: 'med-paracetamol-500',
      batchNumber: 'LOT-QUARANTINE',
      expiryDate: '2027-05-31',
      purchaseCost: 16.00,
      mrp: 26.00,
      quantityReceived: 50,
      quantityRemaining: 15,
      supplierName: 'Vendor B',
      status: 'QUARANTINED',
      receivedDate: '2025-02-01'
    },
    // Batch 3: Depleted (0 units remaining) -> Should be excluded
    {
      id: 'batch-depleted-01',
      medicineId: 'med-paracetamol-500',
      batchNumber: 'LOT-DEPLETED',
      expiryDate: '2027-01-31',
      purchaseCost: 14.00,
      mrp: 24.00,
      quantityReceived: 50,
      quantityRemaining: 0,
      supplierName: 'Vendor C',
      status: 'DEPLETED',
      receivedDate: '2025-01-15'
    },
    // Batch 4: Valid, Earliest Expiry (Nov 30, 2026) -> Should be picked first
    {
      id: 'batch-early-01',
      medicineId: 'med-paracetamol-500',
      batchNumber: 'LOT-EARLY',
      expiryDate: '2026-11-30',
      purchaseCost: 18.50,
      mrp: 28.00,
      quantityReceived: 50,
      quantityRemaining: 10,
      supplierName: 'Vendor D',
      status: 'ACTIVE',
      receivedDate: '2025-03-01'
    },
    // Batch 5: Valid, Later Expiry (Dec 31, 2027) -> Should be picked second
    {
      id: 'batch-late-01',
      medicineId: 'med-paracetamol-500',
      batchNumber: 'LOT-LATE',
      expiryDate: '2027-12-31',
      purchaseCost: 20.00,
      mrp: 30.00,
      quantityReceived: 100,
      quantityRemaining: 40,
      supplierName: 'Vendor E',
      status: 'ACTIVE',
      receivedDate: '2025-04-01'
    }
  ];

  it('filters out expired, quarantined, and depleted batches, returning only valid batches sorted by FEFO', () => {
    const eligible = getEligibleFefoBatches('med-paracetamol-500', testBatches, refDate);
    expect(eligible).toHaveLength(2);
    expect(eligible[0].batchNumber).toBe('LOT-EARLY'); // expires 2026-11-30
    expect(eligible[1].batchNumber).toBe('LOT-LATE');  // expires 2027-12-31
  });

  it('allocates quantities across multiple batches under FEFO with multi-batch split', () => {
    // Request 15 units: LOT-EARLY has 10 units, LOT-LATE has 40 units
    const { allocations, unfulfilledQuantity, availableQuantity } = allocateMedicineStockFEFO(
      'med-paracetamol-500',
      15,
      testBatches,
      refDate
    );

    expect(availableQuantity).toBe(50); // 10 + 40
    expect(unfulfilledQuantity).toBe(0);
    expect(allocations).toHaveLength(2);

    expect(allocations[0].batchNumber).toBe('LOT-EARLY');
    expect(allocations[0].quantity).toBe(10);
    expect(allocations[0].mrp).toBe(28.00);
    expect(allocations[0].purchaseCost).toBe(18.50);

    expect(allocations[1].batchNumber).toBe('LOT-LATE');
    expect(allocations[1].quantity).toBe(5);
    expect(allocations[1].mrp).toBe(30.00);
    expect(allocations[1].purchaseCost).toBe(20.00);
  });

  it('computes exact multi-batch Total Bill (MRP) and COGS without guessing averages', () => {
    // 10 units @ MRP ₹28 (Cost ₹18.50) = MRP ₹280.00, Cost ₹185.00
    // 5 units @ MRP ₹30 (Cost ₹20.00) = MRP ₹150.00, Cost ₹100.00
    // Total MRP = ₹430.00, Total COGS = ₹285.00
    const cart: CartLineItem[] = [{ medicineId: 'med-paracetamol-500', quantity: 15 }];
    const evalResult = calculateCartAllocations(cart, [testMedicine], testBatches, refDate);

    expect(evalResult.isFullyFulfillable).toBe(true);
    expect(evalResult.totalBillMrp).toBe(430.00);
    expect(evalResult.estimatedCogs).toBe(285.00);
    expect(evalResult.lineAllocations[0].allocations).toHaveLength(2);
  });

  it('detects insufficient stock and marks line as unfulfilled', () => {
    // Request 60 units when only 50 are eligible
    const cart: CartLineItem[] = [{ medicineId: 'med-paracetamol-500', quantity: 60 }];
    const evalResult = calculateCartAllocations(cart, [testMedicine], testBatches, refDate);

    expect(evalResult.isFullyFulfillable).toBe(false);
    expect(evalResult.unfulfilledLines).toHaveLength(1);
    expect(evalResult.unfulfilledLines[0].missingQty).toBe(10);
    expect(evalResult.lineAllocations[0].unfulfilledQuantity).toBe(10);
  });
});

describe('Stage 3B: Atomic Counter Sale Checkout Operation', () => {
  let initialState: InventoryState;
  const refDate = new Date('2026-10-17T14:30:00Z');

  beforeEach(() => {
    initialState = getInitialSeedState();
  });

  it('validates cart line items: rejects empty cart and invalid quantities', () => {
    // Empty cart
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-1',
        cart: [],
        sellingBill: 100
      }, refDate);
    }).toThrow(/Cart cannot be empty/);

    // Negative or zero quantity
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-2',
        cart: [{ medicineId: 'med-dolo-650', quantity: 0 }],
        sellingBill: 100
      }, refDate);
    }).toThrow(/positive whole packaging units/);

    // Non-integer fractional quantity
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-3',
        cart: [{ medicineId: 'med-dolo-650', quantity: 2.5 }],
        sellingBill: 100
      }, refDate);
    }).toThrow(/positive whole packaging units/);

    // Non-existent medicine ID
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-4',
        cart: [{ medicineId: 'med-does-not-exist', quantity: 5 }],
        sellingBill: 100
      }, refDate);
    }).toThrow(/does not exist in the catalog/);
  });

  it('validates Selling Bill: rejects negative or NaN values', () => {
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-5',
        cart: [{ medicineId: 'med-dolo-650', quantity: 2 }],
        sellingBill: -50
      }, refDate);
    }).toThrow(/Selling Bill must be a valid, non-negative monetary amount/);

    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-6',
        cart: [{ medicineId: 'med-dolo-650', quantity: 2 }],
        sellingBill: NaN
      }, refDate);
    }).toThrow(/Selling Bill must be a valid, non-negative monetary amount/);
  });

  it('rejects checkout if requested stock exceeds eligible batches, leaving inventory untouched', () => {
    const batchesBefore = JSON.stringify(initialState.batches);
    const movementsBefore = initialState.movements.length;

    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-oversell',
        cart: [{ medicineId: 'med-dolo-650', quantity: 9999 }], // Dolo has 45 units in synthetic seed
        sellingBill: 1000
      }, refDate);
    }).toThrow(/Insufficient eligible stock to fulfill checkout/);

    // Assert working tree / state is untouched
    expect(JSON.stringify(initialState.batches)).toBe(batchesBefore);
    expect(initialState.movements.length).toBe(movementsBefore);
  });

  it('enforces below-cost safety confirmation if Selling Bill < estimated COGS', () => {
    // In seed data: Dolo has Batch 1 (18 units @ Cost ₹24.50, MRP ₹34.00)
    // 5 units Dolo cost = 5 * 24.50 = ₹122.50
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 5 }];

    // Selling below cost (₹100 < ₹122.50) without confirmedBelowCost should throw
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-below-cost-reject',
        cart,
        sellingBill: 100.00,
        confirmedBelowCost: false
      }, refDate);
    }).toThrow(/below estimated COGS.*Deliberate confirmation is required/);

    // With confirmedBelowCost: true, checkout succeeds
    const result = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-below-cost-confirm',
      cart,
      sellingBill: 100.00,
      confirmedBelowCost: true
    }, refDate);

    expect(result.sale.confirmedBelowCost).toBe(true);
    expect(result.sale.sellingBill).toBe(100.00);
    expect(result.sale.estimatedCogs).toBe(122.50);
    expect(result.sale.estimatedGrossProfit).toBe(-22.50);
  });

  it('performs successful sale: decreases batches, records movements, and calculates discount cleanly', () => {
    // Dolo 650: Batch 1 has 18 units @ MRP 34, Cost 24.50. Batch 2 has 27 units @ MRP 35, Cost 25.80.
    // Request 25 units: FEFO allocates 18 from Batch 1 (depleting it), 7 from Batch 2.
    // Total MRP = (18 * 34) + (7 * 35) = 612 + 245 = ₹857.00
    // Total COGS = (18 * 24.50) + (7 * 25.80) = 441 + 180.60 = ₹621.60
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 25 }];
    const sellingBill = 800.00; // ₹57 discount

    const result = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-success-01',
      cart,
      sellingBill,
      tenderType: 'UPI',
      staffUser: 'Nandan Staff (Demo)'
    }, refDate);

    // 1. Sale record assertions
    const sale = result.sale;
    expect(sale.id).toMatch(/^INV-2026-\d{4}-[A-Z0-9]+$/);
    expect(sale.totalBillMrp).toBe(857.00);
    expect(sale.sellingBill).toBe(800.00);
    expect(sale.discount).toBe(57.00); // 857 - 800
    expect(sale.estimatedCogs).toBe(621.60);
    expect(sale.estimatedGrossProfit).toBe(178.40); // 800 - 621.60
    expect(sale.tenderType).toBe('UPI');

    // 2. Batch quantity deductions
    const b1 = result.nextState.batches.find((b) => b.id === 'batch-dolo-01');
    const b2 = result.nextState.batches.find((b) => b.id === 'batch-dolo-02');
    expect(b1?.quantityRemaining).toBe(0);
    expect(b1?.status).toBe('DEPLETED');
    expect(b2?.quantityRemaining).toBe(133); // 140 - 7

    // 3. Movement ledger entries
    expect(result.movements).toHaveLength(2);
    const [m1, m2] = result.movements;
    expect(m1.movementType).toBe('SALE_DISPENSE');
    expect(m1.quantityChange).toBe(-18);
    expect(m1.balanceBefore).toBe(18);
    expect(m1.balanceAfter).toBe(0);
    expect(m1.referenceId).toBe(sale.id);

    expect(m2.movementType).toBe('SALE_DISPENSE');
    expect(m2.quantityChange).toBe(-7);
    expect(m2.balanceBefore).toBe(140);
    expect(m2.balanceAfter).toBe(133);
    expect(m2.referenceId).toBe(sale.id);

    // 4. Prior movements and sales preserved
    expect(result.nextState.movements.length).toBe(initialState.movements.length + 2);
    expect(result.nextState.sales).toHaveLength(1);
    expect(result.nextState.sales[0].id).toBe(sale.id);
  });

  it('enforces idempotency: same token with same payload returns existing sale without double deduction', () => {
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 5 }];

    // First checkout
    const result1 = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-idempotent-01',
      cart,
      sellingBill: 170.00
    }, refDate);

    expect(result1.isIdempotentReplay).toBeUndefined();
    expect(result1.sale.id).toBeDefined();

    const doloBatchAfterFirst = result1.nextState.batches.find((b) => b.id === 'batch-dolo-01')?.quantityRemaining;
    expect(doloBatchAfterFirst).toBe(13); // 18 - 5

    // Second checkout with the SAME token and SAME payload
    const result2 = processSaleCheckout(result1.nextState, {
      clientSaleToken: 'tok-idempotent-01',
      cart,
      sellingBill: 170.00
    }, refDate);

    expect(result2.isIdempotentReplay).toBe(true);
    expect(result2.sale.id).toBe(result1.sale.id);
    expect(result2.movements).toHaveLength(0); // No duplicate ledger movements!
    const doloBatchAfterSecond = result2.nextState.batches.find((b) => b.id === 'batch-dolo-01')?.quantityRemaining;
    expect(doloBatchAfterSecond).toBe(13); // Stock remains unchanged!
  });

  it('enforces idempotency: same token with DIFFERENT payload is strictly rejected', () => {
    const cart1: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 5 }];
    const cart2: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 10 }]; // Different quantity

    const result1 = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-conflict-01',
      cart: cart1,
      sellingBill: 170.00
    }, refDate);

    // Retry with different quantity
    expect(() => {
      processSaleCheckout(result1.nextState, {
        clientSaleToken: 'tok-conflict-01',
        cart: cart2,
        sellingBill: 170.00
      }, refDate);
    }).toThrow(/Idempotency violation.*different contents or selling bill/);

    // Retry with same items but different selling bill
    expect(() => {
      processSaleCheckout(result1.nextState, {
        clientSaleToken: 'tok-conflict-01',
        cart: cart1,
        sellingBill: 150.00 // Different selling bill
      }, refDate);
    }).toThrow(/Idempotency violation.*different contents or selling bill/);
  });

  it('handles browser storage failure cleanly without claiming false success', () => {
    const originalSetItem = window.localStorage.setItem;
    try {
      window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError: Local storage limit reached');
      };

      const saveOk = saveDemoInventory(initialState);
      expect(saveOk).toBe(false);
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('Stage 3B.1: POS & Inventory End-to-End Integrity Audit Tests', () => {
  let initialState: InventoryState;
  const refDate = new Date('2026-10-17T16:00:00Z');

  beforeEach(() => {
    initialState = getInitialSeedState();
    window.localStorage.clear();
  });

  it('multi-line cart with duplicate medicine entries does not double-allocate from same batch', () => {
    // Single batch with 15 units available
    const singleMed: Medicine = {
      id: 'med-single-batch',
      name: 'Test Med Single',
      genericName: 'Test Generic',
      strength: '100mg',
      dosageForm: 'Tablet',
      unitLabel: 'Strips',
      category: 'General',
      lowStockThreshold: 5
    };
    const singleBatch: MedicineBatch = {
      id: 'b-single-1',
      medicineId: 'med-single-batch',
      batchNumber: 'LOT-S1',
      expiryDate: '2027-10-31',
      purchaseCost: 10,
      mrp: 20,
      quantityReceived: 15,
      quantityRemaining: 15,
      supplierName: 'Vendor S',
      status: 'ACTIVE',
      receivedDate: '2026-01-01'
    };

    // Case 1: Total requested across duplicate lines exceeds available (10 + 8 = 18 > 15)
    const oversellCart: CartLineItem[] = [
      { medicineId: 'med-single-batch', quantity: 10 },
      { medicineId: 'med-single-batch', quantity: 8 }
    ];
    const oversellResult = calculateCartAllocations(oversellCart, [singleMed], [singleBatch], refDate);
    expect(oversellResult.isFullyFulfillable).toBe(false);
    expect(oversellResult.unfulfilledLines).toHaveLength(1);
    expect(oversellResult.unfulfilledLines[0].missingQty).toBe(3); // 18 requested - 15 available

    // Case 2: Total requested exactly matches available across two lines (8 + 7 = 15)
    const exactCart: CartLineItem[] = [
      { medicineId: 'med-single-batch', quantity: 8 },
      { medicineId: 'med-single-batch', quantity: 7 }
    ];
    const exactResult = calculateCartAllocations(exactCart, [singleMed], [singleBatch], refDate);
    expect(exactResult.isFullyFulfillable).toBe(true);
    expect(exactResult.lineAllocations[0].allocations[0].quantity).toBe(8);
    expect(exactResult.lineAllocations[1].allocations[0].quantity).toBe(7);
    expect(exactResult.totalBillMrp).toBe(300.00); // 15 * 20
  });

  it('rejects Selling Bill containing sub-paise fractions (more than 2 decimal places) or Infinity', () => {
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 2 }];

    // Sub-paise / 3 decimal places (e.g. 10.555)
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-sub-paise',
        cart,
        sellingBill: 10.555
      }, refDate);
    }).toThrow(/fractional paise/);

    // Infinity
    expect(() => {
      processSaleCheckout(initialState, {
        clientSaleToken: 'tok-infinity',
        cart,
        sellingBill: Infinity
      }, refDate);
    }).toThrow(/valid, non-negative monetary amount/);
  });

  it('idempotency token comparison handles identical items in different order as safe replay', () => {
    const cartOrdered: CartLineItem[] = [
      { medicineId: 'med-dolo-650', quantity: 2 },
      { medicineId: 'med-augmentin-625', quantity: 1 }
    ];
    const cartReordered: CartLineItem[] = [
      { medicineId: 'med-augmentin-625', quantity: 1 },
      { medicineId: 'med-dolo-650', quantity: 2 }
    ];

    const result1 = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-order-replay',
      cart: cartOrdered,
      sellingBill: 250.00
    }, refDate);

    // Replay with reordered items but identical purchase contents and price
    const result2 = processSaleCheckout(result1.nextState, {
      clientSaleToken: 'tok-order-replay',
      cart: cartReordered,
      sellingBill: 250.00
    }, refDate);

    expect(result2.isIdempotentReplay).toBe(true);
    expect(result2.sale.id).toBe(result1.sale.id);
    expect(result2.movements).toHaveLength(0);
  });

  it('movement ledger balances strictly reconcile with batch quantities for all completed sales', () => {
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 25 }];
    const result = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-reconcile-01',
      cart,
      sellingBill: 857.00
    }, refDate);

    // For every SALE_DISPENSE movement, balanceAfter must match the resulting batch quantityRemaining
    for (const mov of result.movements) {
      expect(mov.movementType).toBe('SALE_DISPENSE');
      expect(mov.balanceAfter).toBe(mov.balanceBefore + mov.quantityChange);

      const affectedBatch = result.nextState.batches.find((b) => b.id === mov.batchId);
      expect(affectedBatch).toBeDefined();
      expect(affectedBatch!.quantityRemaining).toBe(mov.balanceAfter);
    }
  });

  it('loadDemoInventory() detects corrupted batch quantities and falls back to clean seed', () => {
    const corruptPayload = {
      version: DEMO_STORAGE_VERSION,
      medicines: initialState.medicines,
      batches: [
        {
          ...initialState.batches[0],
          quantityRemaining: -99 // Illegal negative inventory!
        }
      ],
      movements: initialState.movements,
      sales: [],
      lastUpdated: new Date().toISOString()
    };

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(corruptPayload));
    const loaded = loadDemoInventory();

    // Must gracefully recover and not allow negative stock
    expect(loaded.batches[0].quantityRemaining).toBeGreaterThanOrEqual(0);
    expect(loaded.medicines.length).toBe(initialState.medicines.length);
  });

  it('loadDemoInventory() filters out malformed sales records while preserving valid ones', () => {
    const validSale = {
      id: 'INV-2026-0001-TEST',
      clientSaleToken: 'tok-valid',
      timestamp: new Date().toISOString(),
      items: [],
      totalBillMrp: 100,
      sellingBill: 100,
      discount: 0,
      estimatedCogs: 70,
      estimatedGrossProfit: 30,
      tenderType: 'CASH',
      staffUser: 'Tester',
      confirmedBelowCost: false
    };

    const corruptSale = {
      id: 12345, // Invalid ID type!
      clientSaleToken: null, // Corrupt token!
      items: 'not-an-array'
    };

    const payload = {
      version: DEMO_STORAGE_VERSION,
      medicines: initialState.medicines,
      batches: initialState.batches,
      movements: initialState.movements,
      sales: [validSale, corruptSale, null],
      lastUpdated: new Date().toISOString()
    };

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    const loaded = loadDemoInventory();

    expect(loaded.sales).toHaveLength(1);
    expect(loaded.sales[0].id).toBe('INV-2026-0001-TEST');
  });

  it('Reset Demo restores initial seed state consistently across medicines, batches, movements, and sales', () => {
    // 1. Process a sale to dirty the state
    const saleResult = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-dirty-state',
      cart: [{ medicineId: 'med-dolo-650', quantity: 5 }],
      sellingBill: 170.00
    }, refDate);

    saveDemoInventory(saleResult.nextState);
    expect(saleResult.nextState.sales).toHaveLength(1);

    // 2. Perform Reset Demo
    const resetState = resetDemoInventory();
    expect(resetState.sales).toHaveLength(0);
    expect(resetState.batches.find((b) => b.id === 'batch-dolo-01')?.quantityRemaining).toBe(18);
    expect(resetState.movements.length).toBe(initialState.movements.length);

    // 3. Reload from localStorage to ensure persistence matches reset
    const reloaded = loadDemoInventory();
    expect(reloaded.sales).toHaveLength(0);
    expect(reloaded.batches.find((b) => b.id === 'batch-dolo-01')?.quantityRemaining).toBe(18);
  });

  it('retains full audit trail: original transaction can be reconstructed from SaleRecord and its BatchAllocations', () => {
    const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 20 }];
    const result = processSaleCheckout(initialState, {
      clientSaleToken: 'tok-audit-trail',
      cart,
      sellingBill: 680.00
    }, refDate);

    const sale = result.sale;
    expect(sale.id).toBeDefined();
    expect(sale.items).toHaveLength(1);

    const doloItem = sale.items[0];
    expect(doloItem.medicineId).toBe('med-dolo-650');
    expect(doloItem.quantity).toBe(20);
    expect(doloItem.allocations).toHaveLength(2);

    // Total quantity in allocations must equal requested item quantity
    const allocatedSum = doloItem.allocations.reduce((acc, a) => acc + a.quantity, 0);
    expect(allocatedSum).toBe(20);

    // Total MRP in allocations must reconcile with lineTotalMrp
    const allocMrpSum = doloItem.allocations.reduce((acc, a) => acc + a.quantity * a.mrp, 0);
    expect(doloItem.lineTotalMrp).toBe(allocMrpSum);
  });

  describe('Stage 3B.2: Final POS Integrity Hardening Regression Suite', () => {
    it('idempotency: same token with DIFFERENT tenderType is strictly rejected', () => {
      const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 5 }];

      const initialCheckout = processSaleCheckout(initialState, {
        clientSaleToken: 'tok-tender-test',
        cart,
        sellingBill: 170.00,
        tenderType: 'CASH'
      }, refDate);

      expect(initialCheckout.sale.tenderType).toBe('CASH');

      // Replaying with identical items and price but tenderType CARD must be rejected
      expect(() => {
        processSaleCheckout(initialCheckout.nextState, {
          clientSaleToken: 'tok-tender-test',
          cart,
          sellingBill: 170.00,
          tenderType: 'CARD'
        }, refDate);
      }).toThrow(/Idempotency violation.*different contents or selling bill/);
    });

    it('idempotency: same token with DIFFERENT confirmedBelowCost status is strictly rejected', () => {
      const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 5 }];

      // Initial checkout at regular price
      const initialCheckout = processSaleCheckout(initialState, {
        clientSaleToken: 'tok-below-cost-flag',
        cart,
        sellingBill: 170.00,
        confirmedBelowCost: false
      }, refDate);

      // Replay with confirmedBelowCost = true must be rejected
      expect(() => {
        processSaleCheckout(initialCheckout.nextState, {
          clientSaleToken: 'tok-below-cost-flag',
          cart,
          sellingBill: 170.00,
          confirmedBelowCost: true
        }, refDate);
      }).toThrow(/Idempotency violation.*different contents or selling bill/);
    });

    it('idempotency: cart line order permutation behaves consistently as an idempotent replay', () => {
      const cartA: CartLineItem[] = [
        { medicineId: 'med-dolo-650', quantity: 2 },
        { medicineId: 'med-augmentin-625', quantity: 1 }
      ];
      const cartB: CartLineItem[] = [
        { medicineId: 'med-augmentin-625', quantity: 1 },
        { medicineId: 'med-dolo-650', quantity: 2 }
      ];

      const checkoutA = processSaleCheckout(initialState, {
        clientSaleToken: 'tok-permute-test',
        cart: cartA,
        sellingBill: 248.00
      }, refDate);

      // Replay with reversed line order
      const checkoutB = processSaleCheckout(checkoutA.nextState, {
        clientSaleToken: 'tok-permute-test',
        cart: cartB,
        sellingBill: 248.00
      }, refDate);

      expect(checkoutB.isIdempotentReplay).toBe(true);
      expect(checkoutB.sale.id).toBe(checkoutA.sale.id);
      expect(checkoutB.movements).toHaveLength(0);
    });

    it('zero-value selling bill: rejects without confirmation, succeeds atomically with confirmation', () => {
      const cart: CartLineItem[] = [{ medicineId: 'med-dolo-650', quantity: 2 }];

      // 1. Without confirmation: rejected
      expect(() => {
        processSaleCheckout(initialState, {
          clientSaleToken: 'tok-zero-bill',
          cart,
          sellingBill: 0,
          confirmedBelowCost: false
        }, refDate);
      }).toThrow(/Selling Bill \(₹0.00\) is below estimated COGS/);

      // 2. With confirmation: succeeds atomically
      const result = processSaleCheckout(initialState, {
        clientSaleToken: 'tok-zero-bill',
        cart,
        sellingBill: 0,
        confirmedBelowCost: true
      }, refDate);

      expect(result.sale.sellingBill).toBe(0);
      expect(result.sale.discount).toBe(result.sale.totalBillMrp); // 100% discount
      expect(result.sale.estimatedGrossProfit).toBe(-result.sale.estimatedCogs); // Loss equals COGS
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].movementType).toBe('SALE_DISPENSE');
      expect(result.movements[0].quantityChange).toBe(-2);
    });

    it('failed checkout preserves complete immutability of in-memory state', () => {
      const stateBefore = JSON.parse(JSON.stringify(initialState));

      // Attempt invalid checkouts (sub-paise, missing stock, negative bill)
      expect(() => {
        processSaleCheckout(initialState, {
          clientSaleToken: 'tok-fail-1',
          cart: [{ medicineId: 'med-dolo-650', quantity: 5 }],
          sellingBill: 100.555 // Sub-paise invalid
        }, refDate);
      }).toThrow(/fractional paise/);

      expect(() => {
        processSaleCheckout(initialState, {
          clientSaleToken: 'tok-fail-2',
          cart: [{ medicineId: 'med-dolo-650', quantity: 9999 }], // Insufficient stock
          sellingBill: 500
        }, refDate);
      }).toThrow(/Insufficient eligible stock/);

      // In-memory state remains strictly identical
      expect(initialState.batches).toEqual(stateBefore.batches);
      expect(initialState.movements).toEqual(stateBefore.movements);
      expect(initialState.sales).toEqual(stateBefore.sales);
    });

    it('loadDemoInventory() detects broken ledger balance relationships and recovers safely', () => {
      // Create corrupt movement where balanceAfter != balanceBefore + quantityChange
      const corruptLedgerPayload = {
        version: DEMO_STORAGE_VERSION,
        medicines: initialState.medicines,
        batches: initialState.batches,
        movements: [
          {
            id: 'mov-corrupt-01',
            batchId: 'batch-dolo-01',
            medicineId: 'med-dolo-650',
            medicineName: 'Dolo 650',
            batchNumber: 'DL-2024-A1',
            movementType: 'SALE_DISPENSE',
            quantityChange: -5,
            balanceBefore: 18,
            balanceAfter: 999, // Invariant violation: 18 + (-5) != 999!
            reason: 'Tampered ledger',
            timestamp: new Date().toISOString(),
            performedBy: 'Hacker'
          }
        ],
        sales: [],
        lastUpdated: new Date().toISOString()
      };

      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(corruptLedgerPayload));
      const loaded = loadDemoInventory();

      // Must fall back to clean seed and not accept broken ledger
      expect(loaded.movements[0].balanceAfter).toBe(
        loaded.movements[0].balanceBefore + loaded.movements[0].quantityChange
      );
      expect(loaded.movements.length).toBe(initialState.movements.length);
    });

    it('loadDemoInventory() detects dangling batch medicine references and recovers to clean seed', () => {
      const corruptBatchPayload = {
        version: DEMO_STORAGE_VERSION,
        medicines: initialState.medicines,
        batches: [
          {
            id: 'batch-orphan-01',
            medicineId: 'med-non-existent-999', // Dangling reference!
            batchNumber: 'ORPHAN-01',
            expiryDate: '2027-12-31',
            purchaseCost: 10,
            mrp: 20,
            quantityReceived: 50,
            quantityRemaining: 50,
            supplierName: 'Vendor',
            status: 'ACTIVE',
            receivedDate: '2026-01-01'
          }
        ],
        movements: initialState.movements,
        sales: [],
        lastUpdated: new Date().toISOString()
      };

      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(corruptBatchPayload));
      const loaded = loadDemoInventory();

      // Must fall back to default seed state
      expect(loaded.batches.every((b) => loaded.medicines.some((m) => m.id === b.medicineId))).toBe(true);
    });
  });
});


