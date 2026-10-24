/**
 * Pure, Testable FEFO Allocation Engine for Medi5 ERP Counter Sales
 * 
 * Rules:
 * 1. Strictly excludes EXPIRED, QUARANTINED, and DEPLETED (0-stock) batches.
 * 2. Orders eligible batches by earliest expiry date boundary (First-Expired, First-Out).
 * 3. Allocates exact quantities across batches until the requested line quantity is fulfilled.
 * 4. Multi-batch splits maintain exact per-batch purchase costs and MRPs using integer paise math.
 */

import { Medicine, MedicineBatch, BatchAllocation, CartLineItem, CartLineAllocation } from '../types/inventory';
import { parseExpiryDate, getExpiryUrgency } from './dateUtils';
import { toPaise, fromPaise } from './moneyUtils';

/**
 * Filters and sorts batches eligible for dispensing under FEFO rules.
 */
export function getEligibleFefoBatches(
  medicineId: string,
  batches: MedicineBatch[],
  referenceDate: Date = new Date()
): MedicineBatch[] {
  return batches
    .filter((b) => {
      if (b.medicineId !== medicineId) return false;
      if (b.status !== 'ACTIVE') return false;
      if (b.quantityRemaining <= 0) return false;

      const urgency = getExpiryUrgency(b.expiryDate, 0, referenceDate);
      if (urgency === 'EXPIRED') return false;

      return true;
    })
    .sort((a, b) => {
      const timeA = parseExpiryDate(a.expiryDate).getTime();
      const timeB = parseExpiryDate(b.expiryDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // Secondary deterministic tie-breaker: batch number alphabetical
      return a.batchNumber.localeCompare(b.batchNumber);
    });
}

/**
 * Pure allocation function for a single medicine line under FEFO.
 */
export function allocateMedicineStockFEFO(
  medicineId: string,
  requestedQuantity: number,
  batches: MedicineBatch[],
  referenceDate: Date = new Date()
): {
  allocations: BatchAllocation[];
  unfulfilledQuantity: number;
  availableQuantity: number;
} {
  const eligible = getEligibleFefoBatches(medicineId, batches, referenceDate);
  const availableQuantity = eligible.reduce((acc, b) => acc + b.quantityRemaining, 0);

  let needed = requestedQuantity;
  const allocations: BatchAllocation[] = [];

  for (const b of eligible) {
    if (needed <= 0) break;

    const take = Math.min(b.quantityRemaining, needed);
    if (take > 0) {
      allocations.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        purchaseCost: b.purchaseCost,
        mrp: b.mrp,
        quantity: take
      });
      needed -= take;
    }
  }

  return {
    allocations,
    unfulfilledQuantity: Math.max(0, needed),
    availableQuantity
  };
}

/**
 * Evaluates an entire cart against current inventory without mutating stock.
 * Computes exact multi-batch MRP sum and COGS in integer paise.
 */
export function calculateCartAllocations(
  cart: CartLineItem[],
  medicines: Medicine[],
  batches: MedicineBatch[],
  referenceDate: Date = new Date()
): {
  lineAllocations: CartLineAllocation[];
  totalBillMrp: number;
  estimatedCogs: number;
  isFullyFulfillable: boolean;
  unfulfilledLines: { medicineName: string; missingQty: number }[];
} {
  const lineAllocations: CartLineAllocation[] = [];
  let totalBillPaise = 0;
  let totalCogsPaise = 0;
  let isFullyFulfillable = true;
  const unfulfilledLines: { medicineName: string; missingQty: number }[] = [];

  // Maintain isolated copy of batch balances to prevent double-allocation across multiple cart lines
  const runningBatches = batches.map((b) => ({ ...b }));

  for (const item of cart) {
    const med = medicines.find((m) => m.id === item.medicineId);
    if (!med) {
      throw new Error(`Medicine with ID "${item.medicineId}" not found in master catalog.`);
    }

    const { allocations, unfulfilledQuantity, availableQuantity } = allocateMedicineStockFEFO(
      item.medicineId,
      item.quantity,
      runningBatches,
      referenceDate
    );

    // Deduct allocated quantities from runningBatches for subsequent lines
    for (const alloc of allocations) {
      const matchBatch = runningBatches.find((rb) => rb.id === alloc.batchId);
      if (matchBatch) {
        matchBatch.quantityRemaining = Math.max(0, matchBatch.quantityRemaining - alloc.quantity);
        if (matchBatch.quantityRemaining === 0) {
          matchBatch.status = 'DEPLETED';
        }
      }
    }

    let lineMrpPaise = 0;
    let lineCogsPaise = 0;

    for (const alloc of allocations) {
      lineMrpPaise += toPaise(alloc.mrp) * alloc.quantity;
      lineCogsPaise += toPaise(alloc.purchaseCost) * alloc.quantity;
    }

    totalBillPaise += lineMrpPaise;
    totalCogsPaise += lineCogsPaise;

    const isFullyAllocated = unfulfilledQuantity === 0;
    if (!isFullyAllocated) {
      isFullyFulfillable = false;
      unfulfilledLines.push({
        medicineName: med.name,
        missingQty: unfulfilledQuantity
      });
    }

    lineAllocations.push({
      medicine: med,
      requestedQuantity: item.quantity,
      availableQuantity,
      isFullyAllocated,
      unfulfilledQuantity,
      allocations,
      lineTotalMrp: fromPaise(lineMrpPaise),
      lineTotalCogs: fromPaise(lineCogsPaise)
    });
  }

  return {
    lineAllocations,
    totalBillMrp: fromPaise(totalBillPaise),
    estimatedCogs: fromPaise(totalCogsPaise),
    isFullyFulfillable,
    unfulfilledLines
  };
}
