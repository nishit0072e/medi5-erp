import { describe, it, expect, beforeEach } from 'vitest';
import { MOCK_MEDICINES, MOCK_BATCHES } from '../data/mockInventory';
import {
  DEMO_STORAGE_KEY,
  DEMO_STORAGE_VERSION,
  getInitialSeedState,
  getTenantInventory,
  loadDemoInventory,
  processSaleCheckout,
  processStockAdjustment,
  processStockReceipt,
  resetDemoInventory,
  saveDemoInventory
} from '../data/demoRepository';
import { calculateMedicineSummary } from '../utils/inventoryCalculations';

const NANDAN = 'pharm-nandan-kolkata';
const DESHBANDHU = 'pharm-deshbandhu-siliguri';

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

describe('Frontend Tenant Isolation', () => {
  const refDate = new Date('2026-10-17T12:00:00Z');

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns only the requested pharmacy tenant inventory', () => {
    const state = getInitialSeedState();

    const nandan = getTenantInventory(state, NANDAN);
    expect(nandan.medicines).toHaveLength(6);
    expect(nandan.batches).toHaveLength(8);
    expect(nandan.movements).toHaveLength(6);
    expect(nandan.sales).toHaveLength(0);
    expect(nandan.medicines.every((m) => m.pharmacyId === NANDAN)).toBe(true);
    expect(nandan.batches.every((b) => b.pharmacyId === NANDAN)).toBe(true);

    const deshbandhu = getTenantInventory(state, DESHBANDHU);
    expect(deshbandhu.medicines).toHaveLength(3);
    expect(deshbandhu.batches).toHaveLength(3);
    expect(deshbandhu.movements).toHaveLength(6);
    expect(deshbandhu.sales).toHaveLength(0);
    expect(deshbandhu.medicines.every((m) => m.pharmacyId === DESHBANDHU)).toBe(true);
    expect(deshbandhu.batches.every((b) => b.pharmacyId === DESHBANDHU)).toBe(true);

    expect(state.medicines).toHaveLength(MOCK_MEDICINES.length);
    expect(state.batches).toHaveLength(MOCK_BATCHES.length);
  });

  it('calculates medicine totals without consuming another tenant\'s batches', () => {
    const medicine = MOCK_MEDICINES.find((m) => m.id === 'med-dolo-650')!;
    const ownBatch = MOCK_BATCHES.find((b) => b.id === 'batch-dolo-01')!;
    const foreignBatch = {
      ...ownBatch,
      id: 'batch-foreign-same-medicine',
      pharmacyId: DESHBANDHU,
      quantityReceived: 1000,
      quantityRemaining: 999
    };

    const summary = calculateMedicineSummary(medicine, [ownBatch, foreignBatch], refDate);

    expect(summary.batches).toHaveLength(1);
    expect(summary.totalQuantity).toBe(ownBatch.quantityRemaining);
    expect(summary.saleableQuantity).toBe(ownBatch.quantityRemaining);
  });

  it('rejects receiving stock against another tenant\'s medicine', () => {
    const state = getInitialSeedState();

    expect(() =>
      processStockReceipt(state, {
        medicineId: 'med-desh-atorva-10',
        batchNumber: 'CROSS-TENANT-RECEIPT',
        expiryDate: '2028-01',
        purchaseCost: 40,
        mrp: 60,
        quantity: 5
      }, 'Tester', NANDAN)
    ).toThrow(/not found in this pharmacy/i);
  });

  it('stamps new medicines, batches, and movements with the receiving tenant', () => {
    const state = getInitialSeedState();
    const nandanBatchIds = state.batches
      .filter((b) => b.pharmacyId === NANDAN)
      .map((b) => b.id)
      .sort();

    const result = processStockReceipt(state, {
      newMedicine: {
        name: 'Tenant Test Syrup',
        genericName: 'Test Generic',
        strength: '100 ml',
        dosageForm: 'Syrup',
        unitLabel: 'Bottles (100ml)',
        category: 'Test',
        lowStockThreshold: 5
      },
      batchNumber: 'DSH-NEW-01',
      expiryDate: '2028-04',
      purchaseCost: 40,
      mrp: 55,
      quantity: 25
    }, 'Tester', DESHBANDHU);

    const createdMedicine = result.nextState.medicines.find(
      (m) => m.id === result.affectedBatch.medicineId
    );

    expect(createdMedicine?.pharmacyId).toBe(DESHBANDHU);
    expect(result.affectedBatch.pharmacyId).toBe(DESHBANDHU);
    expect(result.newMovement.pharmacyId).toBe(DESHBANDHU);
    expect(result.nextState.batches.filter((b) => b.pharmacyId === NANDAN).map((b) => b.id).sort())
      .toEqual(nandanBatchIds);
  });

  it('does not reuse another tenant\'s medicine when receiving a same-name new medicine', () => {
    const state = getInitialSeedState();
    const receiptInput = {
      newMedicine: {
        name: 'Cross Tenant Brand',
        genericName: 'Test Generic',
        strength: '10 mg',
        dosageForm: 'Tablet' as const,
        unitLabel: 'Strips',
        category: 'Test',
        lowStockThreshold: 5
      },
      batchNumber: 'CT-BRAND-01',
      expiryDate: '2028-04',
      purchaseCost: 10,
      mrp: 15,
      quantity: 10
    };

    const deshReceipt = processStockReceipt(state, receiptInput, 'Tester', DESHBANDHU);
    const nandanReceipt = processStockReceipt(deshReceipt.nextState, receiptInput, 'Tester', NANDAN);

    expect(nandanReceipt.affectedBatch.medicineId).not.toBe(deshReceipt.affectedBatch.medicineId);
    const nandanMedicine = nandanReceipt.nextState.medicines.find(
      (m) => m.id === nandanReceipt.affectedBatch.medicineId
    );
    const deshMedicine = nandanReceipt.nextState.medicines.find(
      (m) => m.id === deshReceipt.affectedBatch.medicineId
    );
    expect(nandanMedicine?.pharmacyId).toBe(NANDAN);
    expect(deshMedicine?.pharmacyId).toBe(DESHBANDHU);
  });

  it('rejects adjusting another tenant\'s batch and stamps valid adjustments with the tenant', () => {
    const state = getInitialSeedState();

    expect(() =>
      processStockAdjustment(state, {
        batchId: 'batch-desh-shelcal-01',
        movementType: 'DAMAGE_WRITE_OFF',
        quantityChange: -1,
        reason: 'Cross-tenant attempt'
      }, 'Tester', NANDAN)
    ).toThrow(/not found in this pharmacy/i);

    const result = processStockAdjustment(state, {
      batchId: 'batch-desh-shelcal-01',
      movementType: 'DAMAGE_WRITE_OFF',
      quantityChange: -1,
      reason: 'Broken bottle'
    }, 'Tester', DESHBANDHU);

    expect(result.newMovement.pharmacyId).toBe(DESHBANDHU);
    expect(result.affectedBatch.pharmacyId).toBe(DESHBANDHU);
    expect(result.affectedBatch.quantityRemaining).toBe(43);
    expect(result.nextState.movements.filter((m) => m.pharmacyId === NANDAN).length)
      .toBe(state.movements.filter((m) => m.pharmacyId === NANDAN).length);
  });

  it('processes sales only from the active tenant and isolates idempotency tokens per tenant', () => {
    const state = getInitialSeedState();
    const nandanBatchQuantities = state.batches
      .filter((b) => b.pharmacyId === NANDAN)
      .map((b) => `${b.id}:${b.quantityRemaining}`);

    expect(() =>
      processSaleCheckout(state, {
        clientSaleToken: 'shared-checkout-token',
        cart: [{ medicineId: 'med-desh-atorva-10', quantity: 1 }],
        sellingBill: 58
      }, refDate, 'Tester', NANDAN)
    ).toThrow(/does not exist in this pharmacy/i);

    const deshSale = processSaleCheckout(state, {
      clientSaleToken: 'shared-checkout-token',
      cart: [{ medicineId: 'med-desh-atorva-10', quantity: 2 }],
      sellingBill: 116
    }, refDate, 'Tester', DESHBANDHU);

    expect(deshSale.sale.pharmacyId).toBe(DESHBANDHU);
    expect(deshSale.sale.items[0].medicineId).toBe('med-desh-atorva-10');
    expect(deshSale.movements).toHaveLength(1);
    expect(deshSale.movements[0].pharmacyId).toBe(DESHBANDHU);
    expect(deshSale.nextState.batches.filter((b) => b.pharmacyId === NANDAN)
      .map((b) => `${b.id}:${b.quantityRemaining}`)).toEqual(nandanBatchQuantities);
    expect(deshSale.nextState.batches.find((b) => b.id === 'batch-desh-atorva-01')?.quantityRemaining)
      .toBe(70);

    const replay = processSaleCheckout(deshSale.nextState, {
      clientSaleToken: 'shared-checkout-token',
      cart: [{ medicineId: 'med-desh-atorva-10', quantity: 2 }],
      sellingBill: 116
    }, refDate, 'Tester', DESHBANDHU);
    expect(replay.isIdempotentReplay).toBe(true);
    expect(replay.nextState).toBe(deshSale.nextState);

    const nandanSale = processSaleCheckout(deshSale.nextState, {
      clientSaleToken: 'shared-checkout-token',
      cart: [{ medicineId: 'med-dolo-650', quantity: 1 }],
      sellingBill: 34
    }, refDate, 'Tester', NANDAN);
    expect(nandanSale.isIdempotentReplay).toBeFalsy();
    expect(nandanSale.sale.pharmacyId).toBe(NANDAN);
    expect(nandanSale.movements[0].pharmacyId).toBe(NANDAN);
  });

  it('resets only the requested tenant demo data and preserves other tenants', () => {
    const initialState = getInitialSeedState();
    const deshSale = processSaleCheckout(initialState, {
      clientSaleToken: 'reset-desh-sale',
      cart: [{ medicineId: 'med-desh-atorva-10', quantity: 2 }],
      sellingBill: 116
    }, refDate, 'Tester', DESHBANDHU);
    const nandanSale = processSaleCheckout(deshSale.nextState, {
      clientSaleToken: 'reset-nandan-sale',
      cart: [{ medicineId: 'med-dolo-650', quantity: 1 }],
      sellingBill: 34
    }, refDate, 'Tester', NANDAN);
    saveDemoInventory(nandanSale.nextState);

    const resetDeshbandhu = resetDemoInventory(DESHBANDHU);

    expect(resetDeshbandhu.sales.filter((s) => s.pharmacyId === DESHBANDHU)).toHaveLength(0);
    expect(resetDeshbandhu.sales.filter((s) => s.pharmacyId === NANDAN)).toHaveLength(1);
    expect(resetDeshbandhu.medicines.filter((m) => m.pharmacyId === DESHBANDHU)).toHaveLength(3);
    expect(resetDeshbandhu.batches.filter((b) => b.pharmacyId === DESHBANDHU)).toHaveLength(3);
    expect(resetDeshbandhu.movements.filter((m) => m.pharmacyId === DESHBANDHU)).toHaveLength(6);
    expect(resetDeshbandhu.batches.find((b) => b.id === 'batch-desh-atorva-01')?.quantityRemaining)
      .toBe(72);
  });

  it('rejects persisted cross-tenant batch references during load', () => {
    const state = getInitialSeedState();
    const sourceBatch = state.batches.find((b) => b.pharmacyId === NANDAN)!;
    const crossTenantBatch = {
      ...sourceBatch,
      id: 'cross-tenant-persisted-batch',
      pharmacyId: DESHBANDHU
    };

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      version: DEMO_STORAGE_VERSION,
      medicines: state.medicines,
      batches: [...state.batches, crossTenantBatch],
      movements: state.movements,
      sales: [],
      pharmacies: state.pharmacies,
      activePharmacyId: state.activePharmacyId,
      lastUpdated: new Date().toISOString()
    }));

    const loaded = loadDemoInventory();
    expect(loaded.batches.some((b) => b.id === 'cross-tenant-persisted-batch')).toBe(false);

    const medicineById = new Map(loaded.medicines.map((m) => [m.id, m]));
    expect(loaded.batches.every((b) => medicineById.get(b.medicineId)?.pharmacyId === b.pharmacyId))
      .toBe(true);
  });
});
