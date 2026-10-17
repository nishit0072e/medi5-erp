/**
 * Inventory Calculation Engine for Medi5 ERP
 * 
 * Invariants:
 * 1. Medicine-level quantities are ALWAYS calculated dynamically from underlying batches.
 * 2. Any batch past its expiry date or with status !== 'ACTIVE' is strictly excluded from saleable stock.
 * 3. FEFO (First-Expired, First-Out) selects the earliest valid expiring batch for dispensing.
 */

import { Medicine, MedicineBatch, MedicineInventorySummary } from '../types/inventory';
import { parseExpiryDate, getExpiryUrgency } from './dateUtils';

/**
 * Derives an individual medicine's inventory summary by aggregating its physical batches.
 */
export function calculateMedicineSummary(
  medicine: Medicine,
  batches: MedicineBatch[],
  referenceDate: Date = new Date()
): MedicineInventorySummary {
  // Filter batches belonging to this medicine
  const medicineBatches = batches.filter((b) => b.medicineId === medicine.id);

  let totalQuantity = 0;
  let saleableQuantity = 0;
  let expiredQuantity = 0;
  let quarantinedQuantity = 0;
  let totalSaleableCost = 0;

  let hasExpiredBatches = false;
  let hasExpiringSoonBatches = false;

  // Track eligible batches for FEFO priority
  const eligibleBatches: MedicineBatch[] = [];

  for (const batch of medicineBatches) {
    const qty = Math.max(0, batch.quantityRemaining);
    totalQuantity += qty;

    const urgency = getExpiryUrgency(batch.expiryDate, 60, referenceDate);
    const isPastExpiry = urgency === 'EXPIRED';

    if (isPastExpiry || batch.status === 'EXPIRED') {
      expiredQuantity += qty;
      hasExpiredBatches = true;
    } else if (batch.status === 'QUARANTINED') {
      quarantinedQuantity += qty;
    } else if (batch.status === 'ACTIVE') {
      // Saleable stock
      saleableQuantity += qty;
      totalSaleableCost += qty * batch.purchaseCost;
      eligibleBatches.push(batch);

      if (urgency === 'EXPIRING_SOON') {
        hasExpiringSoonBatches = true;
      }
    }
  }

  // Sort eligible batches by earliest expiry date (FEFO rule)
  eligibleBatches.sort((a, b) => {
    const timeA = parseExpiryDate(a.expiryDate).getTime();
    const timeB = parseExpiryDate(b.expiryDate).getTime();
    return timeA - timeB;
  });

  const fefoEligibleBatch = eligibleBatches.length > 0 ? eligibleBatches[0] : null;
  const earliestExpiryDate = fefoEligibleBatch ? fefoEligibleBatch.expiryDate : null;

  const averageCost = saleableQuantity > 0 ? totalSaleableCost / saleableQuantity : 0;

  return {
    medicine,
    batches: medicineBatches,
    totalQuantity,
    saleableQuantity,
    expiredQuantity,
    quarantinedQuantity,
    isLowStock: saleableQuantity > 0 && saleableQuantity <= medicine.lowStockThreshold,
    isOutOfStock: saleableQuantity === 0,
    hasExpiredBatches,
    hasExpiringSoonBatches,
    earliestExpiryDate,
    fefoEligibleBatch,
    averageCost
  };
}

/**
 * Aggregates all medicines into inventory summaries.
 */
export function calculateAllSummaries(
  medicines: Medicine[],
  batches: MedicineBatch[],
  referenceDate: Date = new Date()
): MedicineInventorySummary[] {
  return medicines.map((m) => calculateMedicineSummary(m, batches, referenceDate));
}

/**
 * Computes high-level KPI counts for the dashboard header.
 */
export interface InventoryKpis {
  totalMedicines: number;
  totalBatches: number;
  totalSellableUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredBatchesCount: number;
  totalInventoryValue: number; // Value of sellable stock based on purchase cost
}

export function calculateInventoryKpis(
  summaries: MedicineInventorySummary[]
): InventoryKpis {
  let totalBatches = 0;
  let totalSellableUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let expiringSoonCount = 0;
  let expiredBatchesCount = 0;
  let totalInventoryValue = 0;

  for (const s of summaries) {
    totalBatches += s.batches.length;
    totalSellableUnits += s.saleableQuantity;
    totalInventoryValue += s.saleableQuantity * s.averageCost;

    if (s.isOutOfStock) {
      outOfStockCount++;
    } else if (s.isLowStock) {
      lowStockCount++;
    }

    if (s.hasExpiringSoonBatches) {
      expiringSoonCount++;
    }

    for (const b of s.batches) {
      if (b.status === 'EXPIRED' || getExpiryUrgency(b.expiryDate, 0) === 'EXPIRED') {
        expiredBatchesCount++;
      }
    }
  }

  return {
    totalMedicines: summaries.length,
    totalBatches,
    totalSellableUnits,
    lowStockCount,
    outOfStockCount,
    expiringSoonCount,
    expiredBatchesCount,
    totalInventoryValue
  };
}
