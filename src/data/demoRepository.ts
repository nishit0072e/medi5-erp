/**
 * Medi5 ERP - Local Demo Data Repository
 * 
 * Provides in-memory and localStorage persistence for the frontend prototype.
 * Invariants:
 * 1. Medicine-level quantities are strictly derived from child batches.
 * 2. Every stock change creates an immutable StockMovement where:
 *    balance_after = balance_before + quantity_change
 * 3. Never produces negative inventory.
 * 4. Gracefully recovers from missing or malformed localStorage data.
 * 5. Can be safely reset to initial synthetic seed data.
 */

import { 
  Medicine, 
  MedicineBatch, 
  StockMovement, 
  ReceiveStockInput, 
  AdjustStockInput,
  SaleRecord,
  ProcessSaleInput,
  SaleItemSummary
} from '../types/inventory';
import { PharmacyProfile, UpdatePharmacyInput, AddMemberInput, PharmacyMember } from '../types/pharmacy';
import { MOCK_MEDICINES, MOCK_BATCHES, MOCK_MOVEMENTS } from './mockInventory';
import { MOCK_PHARMACIES } from './mockPharmacies';
import { parseExpiryDate } from '../utils/dateUtils';
import { toPaise, fromPaise } from '../utils/moneyUtils';
import { calculateCartAllocations } from '../utils/fefoAllocation';

export const DEMO_STORAGE_KEY = 'medi5_demo_inventory_v1';
export const DEMO_STORAGE_VERSION = 2;

export interface StoredDemoData {
  version: number;
  medicines: Medicine[];
  batches: MedicineBatch[];
  movements: StockMovement[];
  sales?: SaleRecord[];
  pharmacies?: PharmacyProfile[];
  activePharmacyId?: string;
  lastUpdated: string;
}

export interface InventoryState {
  medicines: Medicine[];
  batches: MedicineBatch[];
  movements: StockMovement[];
  sales: SaleRecord[];
  pharmacies: PharmacyProfile[];
  activePharmacyId: string;
}

export function getTenantInventory(state: InventoryState, pharmacyId: string): InventoryState {
  return {
    ...state,
    medicines: state.medicines.filter((m) => m.pharmacyId === pharmacyId),
    batches: state.batches.filter((b) => b.pharmacyId === pharmacyId),
    movements: state.movements.filter((m) => m.pharmacyId === pharmacyId),
    sales: state.sales.filter((s) => s.pharmacyId === pharmacyId)
  };
}

function resolvePharmacyId(state: InventoryState, requestedPharmacyId?: string): string {
  const pharmacyId = requestedPharmacyId || state.activePharmacyId || state.pharmacies[0]?.id;
  if (!pharmacyId || !state.pharmacies.some((p) => p.id === pharmacyId)) {
    throw new Error('Tenant context error: A valid pharmacy tenant is required for this operation.');
  }
  return pharmacyId;
}

/**
 * Loads inventory state from localStorage or falls back safely to default synthetic seed.
 */
export function loadDemoInventory(): InventoryState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getInitialSeedState();
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      return getInitialSeedState();
    }

    const parsed = JSON.parse(raw) as StoredDemoData;

    // Check version and structural validity
    if (
      !parsed || 
      parsed.version !== DEMO_STORAGE_VERSION || 
      !Array.isArray(parsed.medicines) || 
      !Array.isArray(parsed.batches) || 
      !Array.isArray(parsed.movements)
    ) {
      console.warn('[Medi5 Demo Repository] Malformed or outdated demo data detected. Falling back to default seed.');
      return getInitialSeedState();
    }

    const pharmacies: PharmacyProfile[] = Array.isArray(parsed.pharmacies) && parsed.pharmacies.length > 0
      ? parsed.pharmacies
      : JSON.parse(JSON.stringify(MOCK_PHARMACIES));
    const hasCorruptPharmacy = pharmacies.some(
      (p) => !p || typeof p.id !== 'string' || !p.id || !Array.isArray(p.members)
    );
    if (hasCorruptPharmacy) {
      console.warn('[Medi5 Demo Repository] Corrupted pharmacy tenant records detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }
    const pharmacyIdSet = new Set(pharmacies.map((p) => p.id));

    // Integrity check: medicines catalog must be explicitly tenant-owned
    const hasCorruptMedicine = parsed.medicines.some(
      (m) =>
        !m ||
        typeof m.id !== 'string' ||
        !m.id ||
        typeof m.name !== 'string' ||
        !m.name ||
        typeof m.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(m.pharmacyId)
    );
    if (hasCorruptMedicine) {
      console.warn('[Medi5 Demo Repository] Corrupted medicine catalog or missing tenant ownership detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    const medicineById = new Map(parsed.medicines.map((m) => [m.id, m]));

    // Integrity check: batches must be valid, tenant-owned, and reference a medicine in the SAME tenant.
    const hasCorruptBatch = parsed.batches.some((b) => {
      if (
        !b ||
        typeof b.id !== 'string' ||
        typeof b.medicineId !== 'string' ||
        typeof b.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(b.pharmacyId)
      ) return true;

      const parentMedicine = medicineById.get(b.medicineId);
      if (!parentMedicine || parentMedicine.pharmacyId !== b.pharmacyId) return true;

      return (
        typeof b.quantityRemaining !== 'number' ||
        !Number.isFinite(b.quantityRemaining) ||
        b.quantityRemaining < 0 ||
        typeof b.purchaseCost !== 'number' ||
        !Number.isFinite(b.purchaseCost) ||
        b.purchaseCost < 0 ||
        typeof b.mrp !== 'number' ||
        !Number.isFinite(b.mrp) ||
        b.mrp < 0
      );
    });
    if (hasCorruptBatch) {
      console.warn('[Medi5 Demo Repository] Corrupted batch quantities, invalid medicine references, or cross-tenant batch ownership detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    const batchById = new Map(parsed.batches.map((b) => [b.id, b]));

    // Integrity check: movements must be tenant-owned and reconcile with a batch in the SAME tenant.
    const validMovementTypes = new Set(['PURCHASE_RECEIPT', 'AUDIT_CORRECTION', 'DAMAGE_WRITE_OFF', 'EXPIRED_WRITE_OFF', 'SALE_DISPENSE']);
    const hasCorruptMovement = parsed.movements.some((m) => {
      if (
        !m ||
        typeof m.id !== 'string' ||
        typeof m.batchId !== 'string' ||
        typeof m.medicineId !== 'string' ||
        typeof m.pharmacyId !== 'string' ||
        !pharmacyIdSet.has(m.pharmacyId)
      ) return true;

      const batch = batchById.get(m.batchId);
      if (!batch || batch.pharmacyId !== m.pharmacyId || batch.medicineId !== m.medicineId) return true;

      if (!validMovementTypes.has(m.movementType)) return true;
      if (typeof m.quantityChange !== 'number' || !Number.isFinite(m.quantityChange) || m.quantityChange === 0) return true;
      if (typeof m.balanceBefore !== 'number' || !Number.isFinite(m.balanceBefore) || m.balanceBefore < 0) return true;
      if (typeof m.balanceAfter !== 'number' || !Number.isFinite(m.balanceAfter) || m.balanceAfter < 0) return true;
      if (m.balanceAfter !== m.balanceBefore + m.quantityChange) return true;
      return false;
    });
    if (hasCorruptMovement) {
      console.warn('[Medi5 Demo Repository] Corrupted stock movement ledger or cross-tenant movement detected in localStorage. Falling back to default seed.');
      return getInitialSeedState();
    }

    // Filter valid tenant-owned sales records.
    const validSales: SaleRecord[] = Array.isArray(parsed.sales)
      ? parsed.sales.filter(
          (s) =>
            s &&
            typeof s.id === 'string' &&
            typeof s.pharmacyId === 'string' &&
            pharmacyIdSet.has(s.pharmacyId) &&
            typeof s.clientSaleToken === 'string' &&
            Array.isArray(s.items) &&
            s.items.every(
              (item) =>
                item &&
                typeof item.medicineId === 'string' &&
                medicineById.get(item.medicineId)?.pharmacyId === s.pharmacyId
            ) &&
            typeof s.sellingBill === 'number' &&
            Number.isFinite(s.sellingBill) &&
            s.sellingBill >= 0 &&
            typeof s.totalBillMrp === 'number' &&
            Number.isFinite(s.totalBillMrp) &&
            typeof s.estimatedCogs === 'number' &&
            Number.isFinite(s.estimatedCogs)
        )
      : [];

    const activePharmacyId = typeof parsed.activePharmacyId === 'string' && pharmacyIdSet.has(parsed.activePharmacyId)
      ? parsed.activePharmacyId
      : pharmacies[0].id;

    return {
      medicines: parsed.medicines,
      batches: parsed.batches,
      movements: parsed.movements,
      sales: validSales,
      pharmacies,
      activePharmacyId
    };
  } catch (err) {
    console.error('[Medi5 Demo Repository] Failed to load localStorage demo data:', err);
    return getInitialSeedState();
  }
}

/**
 * Saves current inventory state into localStorage.
 * Returns true if successfully written, or false if storage is unavailable / quota exceeded.
 *
 * NOTE: localStorage is purely a client-side demo persistence layer for single-browser prototype exploration.
 * It does NOT provide authentication, authorization, multi-tenant isolation, cross-device synchronization,
 * or ACID database guarantees.
 */
export function saveDemoInventory(state: InventoryState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const payload: StoredDemoData = {
      version: DEMO_STORAGE_VERSION,
      medicines: state.medicines,
      batches: state.batches,
      movements: state.movements,
      sales: state.sales || [],
      pharmacies: state.pharmacies || [],
      activePharmacyId: state.activePharmacyId || (MOCK_PHARMACIES[0]?.id ?? ''),
      lastUpdated: new Date().toISOString()
    };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[Medi5 Demo Repository] Failed to save demo inventory:', err);
    return false;
  }
}

/**
 * Resets demo data back to the clean initial synthetic seed.
 *
 * With no pharmacyId, the whole demo dataset is purged (platform reset).
 * With a pharmacyId, only that tenant's medicines, batches, movements, and
 * sales are restored, leaving every other tenant untouched.
 */
export function resetDemoInventory(pharmacyId?: string): InventoryState {
  if (!pharmacyId) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    const initial = getInitialSeedState();
    saveDemoInventory(initial);
    return initial;
  }

  const current = loadDemoInventory();
  if (!current.pharmacies.some((p) => p.id === pharmacyId)) {
    throw new Error(`Pharmacy with ID "${pharmacyId}" not found.`);
  }

  const seed = getInitialSeedState();
  const scopedReset: InventoryState = {
    ...current,
    medicines: [
      ...current.medicines.filter((m) => m.pharmacyId !== pharmacyId),
      ...seed.medicines.filter((m) => m.pharmacyId === pharmacyId)
    ],
    batches: [
      ...current.batches.filter((b) => b.pharmacyId !== pharmacyId),
      ...seed.batches.filter((b) => b.pharmacyId === pharmacyId)
    ],
    movements: [
      ...current.movements.filter((m) => m.pharmacyId !== pharmacyId),
      ...seed.movements.filter((m) => m.pharmacyId === pharmacyId)
    ],
    sales: current.sales.filter((s) => s.pharmacyId !== pharmacyId)
  };

  saveDemoInventory(scopedReset);
  return scopedReset;
}

export function getInitialSeedState(): InventoryState {
  return {
    medicines: JSON.parse(JSON.stringify(MOCK_MEDICINES)),
    batches: JSON.parse(JSON.stringify(MOCK_BATCHES)),
    movements: JSON.parse(JSON.stringify(MOCK_MOVEMENTS)),
    sales: [],
    pharmacies: JSON.parse(JSON.stringify(MOCK_PHARMACIES)),
    activePharmacyId: MOCK_PHARMACIES[0].id
  };
}

/**
 * Pure operation: Receives stock for an existing or new medicine batch.
 * Validates inputs, handles duplicate detection, and appends an immutable PURCHASE_RECEIPT movement.
 */
export function processStockReceipt(
  arg1: InventoryState | ReceiveStockInput,
  arg2: InventoryState | ReceiveStockInput,
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): {
  nextState: InventoryState;
  newMovement: StockMovement;
  affectedBatch: MedicineBatch;
  isExistingBatch: boolean;
  updatedMedicines: Medicine[];
  updatedBatches: MedicineBatch[];
  updatedMovements: StockMovement[];
} {
  const currentState = ('medicines' in arg1 ? arg1 : arg2) as InventoryState;
  const input = ('medicines' in arg1 ? arg2 : arg1) as ReceiveStockInput;
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  // 1. Validation
  if (
    typeof input.quantity !== 'number' || 
    isNaN(input.quantity) || 
    !Number.isInteger(input.quantity) || 
    input.quantity <= 0
  ) {
    throw new Error('Validation error: Quantity received must be a positive integer.');
  }
  const quantity = input.quantity;

  const purchaseCost = fromPaise(toPaise(input.purchaseCost));
  const mrp = fromPaise(toPaise(input.mrp));

  if (purchaseCost < 0 || isNaN(purchaseCost)) {
    throw new Error('Validation error: Purchase cost must be a non-negative number.');
  }
  if (mrp < 0 || isNaN(mrp)) {
    throw new Error('Validation error: MRP must be a non-negative number.');
  }
  if (mrp < purchaseCost) {
    throw new Error(`Validation error: MRP (₹${mrp.toFixed(2)}) cannot be lower than purchase cost (₹${purchaseCost.toFixed(2)}).`);
  }

  const cleanBatchNumber = input.batchNumber ? input.batchNumber.trim().toUpperCase() : '';
  if (!cleanBatchNumber) {
    throw new Error('Validation error: Batch number is required.');
  }

  const cleanExpiry = input.expiryDate ? input.expiryDate.trim() : '';
  if (!cleanExpiry) {
    throw new Error('Validation error: Expiry date is required.');
  }
  const parsedExp = parseExpiryDate(cleanExpiry);
  if (isNaN(parsedExp.getTime())) {
    throw new Error('Validation error: Expiry date format is invalid.');
  }

  // 2. Resolve or create Medicine strictly within the active tenant.
  let targetMedicine: Medicine;
  const medicines = [...currentState.medicines];
  const tenantMedicines = medicines.filter((m) => m.pharmacyId === pharmacyId);

  if (input.medicineId) {
    const existingMed = tenantMedicines.find((m) => m.id === input.medicineId);
    if (!existingMed) {
      throw new Error(`Validation error: Medicine ID "${input.medicineId}" not found in this pharmacy.`);
    }
    targetMedicine = existingMed;
  } else if (input.newMedicine) {
    const { name, genericName, strength, dosageForm, unitLabel, category, lowStockThreshold } = input.newMedicine;
    if (!name || !name.trim()) throw new Error('Validation error: New medicine name is required.');
    if (!strength || !strength.trim()) throw new Error('Validation error: New medicine strength is required.');

    // Check duplicate medicine in this tenant's master catalog only.
    const dupMed = tenantMedicines.find(
      (m) => 
        m.name.trim().toLowerCase() === name.trim().toLowerCase() && 
        m.strength.trim().toLowerCase() === strength.trim().toLowerCase() &&
        m.dosageForm === dosageForm
    );
    if (dupMed) {
      targetMedicine = dupMed;
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
      const idBase = `med-${slug}-${Date.now().toString().slice(-6)}`;
      let newMedicineId = idBase;
      let idSuffix = 1;
      while (medicines.some((m) => m.id === newMedicineId)) {
        newMedicineId = `${idBase}-${idSuffix}`;
        idSuffix += 1;
      }
      targetMedicine = {
        id: newMedicineId,
        pharmacyId,
        name: name.trim(),
        genericName: genericName ? genericName.trim() : name.trim(),
        strength: strength.trim(),
        dosageForm: dosageForm || 'Tablet',
        unitLabel: unitLabel ? unitLabel.trim() : 'Strips (10 tabs)',
        category: category ? category.trim() : 'General',
        lowStockThreshold: Math.max(0, lowStockThreshold || 10)
      };
      medicines.push(targetMedicine);
    }
  } else {
    throw new Error('Validation error: Either medicineId or newMedicine details must be supplied.');
  }

  // 3. Batch conflict detection & resolution (tenant-scoped)
  const batches = [...currentState.batches];
  const existingBatchIndex = batches.findIndex(
    (b) =>
      b.pharmacyId === pharmacyId &&
      b.medicineId === targetMedicine.id &&
      b.batchNumber.toUpperCase() === cleanBatchNumber
  );

  let affectedBatch: MedicineBatch;
  let balanceBefore = 0;
  let balanceAfter = 0;

  if (existingBatchIndex >= 0) {
    const existing = batches[existingBatchIndex];

    // Normalize expiry strings for comparison (YYYY-MM vs YYYY-MM-DD)
    const existingExpTime = parseExpiryDate(existing.expiryDate).getTime();
    const newExpTime = parsedExp.getTime();

    const costDiff = Math.abs(toPaise(existing.purchaseCost) - toPaise(purchaseCost));
    const mrpDiff = Math.abs(toPaise(existing.mrp) - toPaise(mrp));

    // Conflict Check: If batch number matches, but expiry or cost/mrp differs
    if (existingExpTime !== newExpTime || costDiff > 0 || mrpDiff > 0) {
      throw new Error(
        `Conflicting batch details for "${cleanBatchNumber}". Existing batch for ${targetMedicine.name} ` +
        `expires on ${existing.expiryDate} (Cost ₹${existing.purchaseCost}, MRP ₹${existing.mrp}). ` +
        `Receiving conflicting specifications requires a distinct batch number suffix (e.g. "${cleanBatchNumber}-B") or staff review.`
      );
    }

    // Compatible Match: Increment existing batch
    balanceBefore = existing.quantityRemaining;
    balanceAfter = balanceBefore + quantity;

    affectedBatch = {
      ...existing,
      quantityReceived: existing.quantityReceived + quantity,
      quantityRemaining: balanceAfter,
      status: 'ACTIVE'
    };
    batches[existingBatchIndex] = affectedBatch;
  } else {
    // New Batch Record
    balanceBefore = 0;
    balanceAfter = quantity;

    const expYear = parsedExp.getFullYear();
    const expMonth = (parsedExp.getMonth() + 1).toString().padStart(2, '0');
    const expDay = parsedExp.getDate().toString().padStart(2, '0');
    const normalizedExpiry = `${expYear}-${expMonth}-${expDay}`;

    affectedBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pharmacyId,
      medicineId: targetMedicine.id,
      batchNumber: cleanBatchNumber,
      expiryDate: normalizedExpiry,
      purchaseCost,
      mrp,
      quantityReceived: quantity,
      quantityRemaining: quantity,
      supplierName: input.supplierName ? input.supplierName.trim() : 'Direct Purchase',
      status: 'ACTIVE',
      receivedDate: new Date().toISOString().split('T')[0]
    };
    batches.unshift(affectedBatch);
  }

  // 4. Record Immutable Stock Movement
  const newMovement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pharmacyId,
    batchId: affectedBatch.id,
    medicineId: targetMedicine.id,
    medicineName: `${targetMedicine.name} (${targetMedicine.strength})`,
    batchNumber: affectedBatch.batchNumber,
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: quantity,
    balanceBefore,
    balanceAfter,
    reason: input.notes ? input.notes.trim() : `Stock received from ${affectedBatch.supplierName}`,
    timestamp: new Date().toISOString(),
    performedBy: actingUser
  };

  const nextState: InventoryState = {
    medicines,
    batches,
    movements: [newMovement, ...currentState.movements],
    sales: currentState.sales || [],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || ''
  };

  return {
    nextState,
    newMovement,
    affectedBatch,
    isExistingBatch: existingBatchIndex >= 0,
    updatedMedicines: nextState.medicines,
    updatedBatches: nextState.batches,
    updatedMovements: nextState.movements
  };
}

/**
 * Pure operation: Adjusts stock for audit correction, damage, or expired write-off.
 * Enforces non-negative balance and appends an immutable movement record.
 */
export function processStockAdjustment(
  arg1: InventoryState | AdjustStockInput,
  arg2: InventoryState | AdjustStockInput,
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): {
  nextState: InventoryState;
  newMovement: StockMovement;
  affectedBatch: MedicineBatch;
  updatedBatches: MedicineBatch[];
  updatedMovements: StockMovement[];
} {
  const currentState = ('batches' in arg1 && 'medicines' in arg1 ? arg1 : arg2) as InventoryState;
  const input = ('batches' in arg1 && 'medicines' in arg1 ? arg2 : arg1) as AdjustStockInput;
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  const batches = [...currentState.batches];
  const batchIndex = batches.findIndex(
    (b) => b.id === input.batchId && b.pharmacyId === pharmacyId
  );
  if (batchIndex < 0) {
    throw new Error(`Validation error: Batch ID "${input.batchId}" not found in this pharmacy.`);
  }

  const batch = batches[batchIndex];
  const medicine = currentState.medicines.find((m) => m.id === batch.medicineId);
  const medName = medicine ? `${medicine.name} (${medicine.strength})` : `Batch ${batch.batchNumber}`;

  if (
    typeof input.quantityChange !== 'number' || 
    isNaN(input.quantityChange) || 
    !Number.isInteger(input.quantityChange) || 
    input.quantityChange === 0
  ) {
    throw new Error('Validation error: Quantity change must be a non-zero integer.');
  }
  const qtyChange = input.quantityChange;

  const balanceBefore = batch.quantityRemaining;
  const balanceAfter = balanceBefore + qtyChange;

  if (balanceAfter < 0) {
    throw new Error(
      `Inventory invariant violation: Adjustment would result in negative stock balance (${balanceBefore} + ${qtyChange} = ${balanceAfter}).`
    );
  }

  // Update batch state
  const updatedBatch: MedicineBatch = {
    ...batch,
    quantityRemaining: balanceAfter,
    status: balanceAfter === 0 ? 'DEPLETED' : batch.status
  };
  batches[batchIndex] = updatedBatch;

  // Append movement
  const newMovement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pharmacyId,
    batchId: batch.id,
    medicineId: batch.medicineId,
    medicineName: medName,
    batchNumber: batch.batchNumber,
    movementType: input.movementType,
    quantityChange: qtyChange,
    balanceBefore,
    balanceAfter,
    reason: input.reason ? input.reason.trim() : `${input.movementType.replace('_', ' ')} adjustment`,
    timestamp: new Date().toISOString(),
    performedBy: actingUser
  };

  const nextState: InventoryState = {
    medicines: currentState.medicines,
    batches,
    movements: [newMovement, ...currentState.movements],
    sales: currentState.sales || [],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || ''
  };

  return {
    nextState,
    newMovement,
    affectedBatch: updatedBatch,
    updatedBatches: nextState.batches,
    updatedMovements: nextState.movements
  };
}

export interface ProcessSaleResult {
  nextState: InventoryState;
  sale: SaleRecord;
  movements: StockMovement[];
  isIdempotentReplay?: boolean;
}

/**
 * Pure operation: Processes a walk-in counter sale atomically under FEFO allocation.
 *
 * Invariants:
 * 1. Checks idempotency token: if exact retry, returns existing sale without stock mutation;
 *    if token exists with different payload, rejects immediately.
 * 2. Pure FEFO allocation excludes expired, quarantined, and depleted batches.
 * 3. Enforces integer paise math for Total Bill (MRP), Selling Bill, Discount, COGS, and Gross Profit.
 * 4. Below-cost checkout (Selling Bill < COGS) requires explicit confirmedBelowCost.
 * 5. Atomic state update: Decrements allocated batch quantities, transitions depleted batches,
 *    and appends immutable SALE_DISPENSE movements.
 * 6. Never mutates input state; returns completely isolated nextState.
 */
export function processSaleCheckout(
  currentState: InventoryState,
  input: ProcessSaleInput,
  referenceDate: Date = new Date(),
  actingUser: string = 'Nandan Owner (Demo)',
  requestedPharmacyId?: string
): ProcessSaleResult {
  const pharmacyId = resolvePharmacyId(currentState, requestedPharmacyId || input.pharmacyId);

  // 1. Idempotency Token Validation (scoped to the active tenant)
  const token = input.clientSaleToken ? input.clientSaleToken.trim() : '';
  if (!token) {
    throw new Error('Validation error: Checkout idempotency token is required.');
  }

  const existingSales = currentState.sales || [];
  const tenantSales = existingSales.filter((s) => s.pharmacyId === pharmacyId);
  const existingSale = tenantSales.find((s) => s.clientSaleToken === token);
  if (existingSale) {
    // Check if the sale parameters match the existing sale (using aggregate quantity per medicine)
    const inputCart = input.cart || [];
    const getCartMap = (items: { medicineId: string; quantity: number }[]) => {
      const map = new Map<string, number>();
      for (const item of items) {
        map.set(item.medicineId, (map.get(item.medicineId) || 0) + item.quantity);
      }
      return map;
    };

    const inputMap = getCartMap(inputCart);
    const existingMap = getCartMap(existingSale.items);

    const sameItems = inputMap.size === existingMap.size &&
      Array.from(inputMap.entries()).every(([medId, qty]) => existingMap.get(medId) === qty);
    const sameSellingBill = toPaise(input.sellingBill) === toPaise(existingSale.sellingBill);
    const sameTender = (input.tenderType || 'CASH') === existingSale.tenderType;
    const sameConfirmedBelowCost = Boolean(input.confirmedBelowCost) === Boolean(existingSale.confirmedBelowCost);

    if (sameItems && sameSellingBill && sameTender && sameConfirmedBelowCost) {
      // Idempotent retry: do not deduct stock again or create duplicate movement
      return {
        nextState: currentState,
        sale: existingSale,
        movements: [],
        isIdempotentReplay: true
      };
    } else {
      // Different payload with same token: reject immediately
      throw new Error(
        `Idempotency violation: A sale has already been processed with token "${token}" but with different contents or selling bill (or tender/confirmation).`
      );
    }
  }

  // 2. Cart Content Validation
  if (!input.cart || !Array.isArray(input.cart) || input.cart.length === 0) {
    throw new Error('Validation error: Cart cannot be empty for checkout.');
  }

  for (const item of input.cart) {
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      isNaN(item.quantity) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error('Validation error: Requested quantities must be positive whole packaging units.');
    }

    const med = currentState.medicines.find(
      (m) => m.id === item.medicineId && m.pharmacyId === pharmacyId
    );
    if (!med) {
      throw new Error(`Validation error: Medicine ID "${item.medicineId}" does not exist in this pharmacy's catalog.`);
    }
  }

  const tenantMedicines = currentState.medicines.filter((m) => m.pharmacyId === pharmacyId);
  const tenantBatches = currentState.batches.filter((b) => b.pharmacyId === pharmacyId);

  // 3. Selling Bill Validation
  if (
    typeof input.sellingBill !== 'number' ||
    !Number.isFinite(input.sellingBill) ||
    isNaN(input.sellingBill) ||
    input.sellingBill < 0
  ) {
    throw new Error('Validation error: Selling Bill must be a valid, non-negative monetary amount.');
  }

  // Validate that Selling Bill does not contain invalid fractional paise (more than 2 decimal places)
  const sellingBillPaise = toPaise(input.sellingBill);
  if (Math.abs(fromPaise(sellingBillPaise) - input.sellingBill) > 0.0001) {
    throw new Error('Validation error: Selling Bill cannot contain fractional paise (more than 2 decimal places).');
  }

  // 4. Pure FEFO Allocation Evaluation
  const {
    lineAllocations,
    totalBillMrp,
    estimatedCogs,
    isFullyFulfillable,
    unfulfilledLines
  } = calculateCartAllocations(input.cart, tenantMedicines, tenantBatches, referenceDate);

  if (!isFullyFulfillable) {
    const missingDesc = unfulfilledLines
      .map((l) => `"${l.medicineName}" (missing ${l.missingQty} units)`)
      .join(', ');
    throw new Error(
      `Validation error: Insufficient eligible stock to fulfill checkout: ${missingDesc}.`
    );
  }

  const totalBillMrpPaise = toPaise(totalBillMrp);
  const totalCogsPaise = toPaise(estimatedCogs);

  // 5. Below-Cost Safety Interlock
  if (sellingBillPaise < totalCogsPaise && !input.confirmedBelowCost) {
    throw new Error(
      `Validation error: Selling Bill (₹${fromPaise(sellingBillPaise).toFixed(2)}) is below estimated COGS (₹${fromPaise(totalCogsPaise).toFixed(2)}). Deliberate confirmation is required before proceeding.`
    );
  }

  // 6. Compute Financials
  const discountPaise = totalBillMrpPaise - sellingBillPaise;
  const grossProfitPaise = sellingBillPaise - totalCogsPaise;

  // 7. Generate Stable Unique Sale ID
  const year = referenceDate.getFullYear();
  const sequenceNum = (tenantSales.length + 1).toString().padStart(4, '0');
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const saleId = `INV-${year}-${sequenceNum}-${randSuffix}`;

  // 8. Construct Sale Item Summaries & Apply Batch Deductions
  const updatedBatches = [...currentState.batches];
  const newMovements: StockMovement[] = [];
  const saleItems: SaleItemSummary[] = [];

  for (const line of lineAllocations) {
    saleItems.push({
      medicineId: line.medicine.id,
      medicineName: line.medicine.name,
      genericName: line.medicine.genericName,
      strength: line.medicine.strength,
      dosageForm: line.medicine.dosageForm,
      unitLabel: line.medicine.unitLabel,
      quantity: line.requestedQuantity,
      lineTotalMrp: line.lineTotalMrp,
      lineTotalCogs: line.lineTotalCogs,
      allocations: line.allocations
    });

    for (const alloc of line.allocations) {
      const bIndex = updatedBatches.findIndex((b) => b.id === alloc.batchId);
      if (bIndex < 0) {
        throw new Error(`Inventory invariant error: Batch "${alloc.batchNumber}" unexpectedly missing.`);
      }

      const currentBatch = updatedBatches[bIndex];
      const balanceBefore = currentBatch.quantityRemaining;
      const balanceAfter = balanceBefore - alloc.quantity;

      if (balanceAfter < 0) {
        throw new Error(
          `Inventory invariant violation: Batch "${currentBatch.batchNumber}" cannot have negative stock (${balanceBefore} - ${alloc.quantity} = ${balanceAfter}).`
        );
      }

      const updatedBatch: MedicineBatch = {
        ...currentBatch,
        quantityRemaining: balanceAfter,
        status: balanceAfter === 0 ? 'DEPLETED' : currentBatch.status
      };
      updatedBatches[bIndex] = updatedBatch;

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pharmacyId,
        batchId: currentBatch.id,
        medicineId: currentBatch.medicineId,
        medicineName: `${line.medicine.name} (${line.medicine.strength})`,
        batchNumber: currentBatch.batchNumber,
        movementType: 'SALE_DISPENSE',
        quantityChange: -alloc.quantity,
        balanceBefore,
        balanceAfter,
        reason: `Counter Sale ${saleId}`,
        referenceId: saleId,
        timestamp: referenceDate.toISOString(),
        performedBy: input.staffUser || actingUser
      };
      newMovements.push(movement);
    }
  }

  // 9. Create Completed Sale Record
  const newSale: SaleRecord = {
    id: saleId,
    pharmacyId,
    clientSaleToken: token,
    timestamp: referenceDate.toISOString(),
    items: saleItems,
    totalBillMrp,
    sellingBill: fromPaise(sellingBillPaise),
    discount: fromPaise(discountPaise),
    estimatedCogs,
    estimatedGrossProfit: fromPaise(grossProfitPaise),
    tenderType: input.tenderType || 'CASH',
    staffUser: input.staffUser || actingUser,
    confirmedBelowCost: !!input.confirmedBelowCost
  };

  const nextState: InventoryState = {
    medicines: currentState.medicines,
    batches: updatedBatches,
    movements: [...newMovements, ...currentState.movements],
    sales: [newSale, ...existingSales],
    pharmacies: currentState.pharmacies || [],
    activePharmacyId: currentState.activePharmacyId || ''
  };

  return {
    nextState,
    sale: newSale,
    movements: newMovements
  };
}

/**
 * Updates an existing pharmacy profile's legal details, address, and operational thresholds.
 */
export function updatePharmacyProfile(
  currentState: InventoryState,
  pharmacyId: string,
  input: UpdatePharmacyInput
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const index = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (index < 0) {
    throw new Error(`Pharmacy with ID "${pharmacyId}" not found.`);
  }

  if (!input.name || !input.name.trim()) {
    throw new Error('Pharmacy name cannot be empty.');
  }
  if (!input.drugLicenseNumber || !input.drugLicenseNumber.trim()) {
    throw new Error('Drug License Number (Form 20/21) is required.');
  }
  if (!input.city || !input.city.trim()) {
    throw new Error('City is required.');
  }
  if (!input.phone || !input.phone.trim()) {
    throw new Error('Contact phone number is required.');
  }

  const existing = pharmacies[index];
  const updated: PharmacyProfile = {
    ...existing,
    name: input.name.trim(),
    legalName: input.legalName ? input.legalName.trim() : input.name.trim(),
    drugLicenseNumber: input.drugLicenseNumber.trim().toUpperCase(),
    gstin: input.gstin ? input.gstin.trim().toUpperCase() : undefined,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2 ? input.addressLine2.trim() : undefined,
    city: input.city.trim(),
    state: input.state ? input.state.trim() : 'West Bengal',
    pincode: input.pincode.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    expiryThresholdDays: Math.max(1, input.expiryThresholdDays || 60),
    lowStockThresholdDefault: Math.max(1, input.lowStockThresholdDefault || 15),
    updatedAt: new Date().toISOString()
  };

  pharmacies[index] = updated;

  return {
    ...currentState,
    pharmacies
  };
}

/**
 * Switches the active pharmacy tenant context in the application.
 */
export function switchPharmacyTenant(
  currentState: InventoryState,
  targetPharmacyId: string
): InventoryState {
  const target = currentState.pharmacies.find((p) => p.id === targetPharmacyId);
  if (!target) {
    throw new Error(`Target pharmacy tenant "${targetPharmacyId}" does not exist.`);
  }

  return {
    ...currentState,
    activePharmacyId: targetPharmacyId
  };
}

/**
 * Creates and registers a new pharmacy tenant in the system.
 */
export function createPharmacyTenant(
  currentState: InventoryState,
  input: UpdatePharmacyInput & { ownerName: string; ownerPhone: string; ownerEmail: string }
): InventoryState {
  if (!input.name || !input.name.trim()) {
    throw new Error('Pharmacy name is required.');
  }

  const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
  const newId = `pharm-${slug}-${Date.now().toString().slice(-4)}`;

  const newPharmacy: PharmacyProfile = {
    id: newId,
    name: input.name.trim(),
    legalName: input.legalName ? input.legalName.trim() : input.name.trim(),
    drugLicenseNumber: input.drugLicenseNumber.trim().toUpperCase(),
    gstin: input.gstin ? input.gstin.trim().toUpperCase() : undefined,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2 ? input.addressLine2.trim() : undefined,
    city: input.city.trim(),
    state: input.state ? input.state.trim() : 'West Bengal',
    pincode: input.pincode.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    currency: 'INR',
    expiryThresholdDays: Math.max(1, input.expiryThresholdDays || 60),
    lowStockThresholdDefault: Math.max(1, input.lowStockThresholdDefault || 15),
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: `user-owner-${Date.now().toString().slice(-4)}`,
        name: input.ownerName.trim() || 'Store Owner',
        email: input.ownerEmail.trim() || input.email.trim(),
        phone: input.ownerPhone.trim() || input.phone.trim(),
        role: 'OWNER',
        status: 'ACTIVE',
        joinedDate: new Date().toISOString().split('T')[0]
      }
    ]
  };

  const pharmacies = [...currentState.pharmacies, newPharmacy];

  return {
    ...currentState,
    pharmacies,
    activePharmacyId: newPharmacy.id
  };
}

/**
 * Adds an authorized staff member or manager to a pharmacy tenant.
 */
export function addPharmacyStaffMember(
  currentState: InventoryState,
  pharmacyId: string,
  input: AddMemberInput
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const pIndex = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (pIndex < 0) throw new Error('Pharmacy tenant not found.');

  if (!input.name || !input.name.trim()) throw new Error('Staff member name is required.');
  if (!input.phone || !input.phone.trim()) throw new Error('Staff phone number is required.');

  const pharmacy = pharmacies[pIndex];
  const newMember: PharmacyMember = {
    id: `user-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim(),
    email: input.email ? input.email.trim() : `${input.name.toLowerCase().replace(/\s+/g, '.')}@pharmacy.in`,
    phone: input.phone.trim(),
    role: input.role || 'STAFF',
    status: 'ACTIVE',
    joinedDate: new Date().toISOString().split('T')[0]
  };

  pharmacies[pIndex] = {
    ...pharmacy,
    members: [...pharmacy.members, newMember],
    updatedAt: new Date().toISOString()
  };

  return {
    ...currentState,
    pharmacies
  };
}

/**
 * Removes a staff member while strictly enforcing the last-active-owner invariant.
 */
export function removePharmacyStaffMember(
  currentState: InventoryState,
  pharmacyId: string,
  memberId: string
): InventoryState {
  const pharmacies = [...currentState.pharmacies];
  const pIndex = pharmacies.findIndex((p) => p.id === pharmacyId);
  if (pIndex < 0) throw new Error('Pharmacy tenant not found.');

  const pharmacy = pharmacies[pIndex];
  const targetMember = pharmacy.members.find((m) => m.id === memberId);
  if (!targetMember) throw new Error('Member not found.');

  if (targetMember.role === 'OWNER') {
    const remainingActiveOwners = pharmacy.members.filter(
      (m) => m.role === 'OWNER' && m.status === 'ACTIVE' && m.id !== memberId
    );
    if (remainingActiveOwners.length === 0) {
      throw new Error('Tenancy security violation: A pharmacy must retain at least one active OWNER.');
    }
  }

  pharmacies[pIndex] = {
    ...pharmacy,
    members: pharmacy.members.filter((m) => m.id !== memberId),
    updatedAt: new Date().toISOString()
  };

  return {
    ...currentState,
    pharmacies
  };
}
