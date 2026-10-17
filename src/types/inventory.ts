/**
 * Medi5 ERP - Inventory Domain Types
 * 
 * Strict separation between Medicine Master records and Physical Inventory Batches.
 * Invariants:
 * 1. Medicine-level quantities are ALWAYS dynamically derived from child batches.
 * 2. Expired or Quarantined batches are strictly excluded from saleable quantity.
 * 3. Expiry date convention: If YYYY-MM is provided, the final calendar day of that month
 *    at 23:59:59 is used as the official expiry boundary.
 */

export type DosageForm = 
  | 'Tablet' 
  | 'Capsule' 
  | 'Syrup' 
  | 'Suspension'
  | 'Injection' 
  | 'Ointment' 
  | 'Eye Drops';

export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'QUARANTINED';

export type ExpiryUrgency = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

/**
 * Master catalog representation of a medicine.
 * Does not contain quantities, costs, or batch numbers directly.
 */
export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  unitLabel: string; // e.g. "Strips", "Bottles", "Vials"
  category: string;  // e.g. "Analgesic", "Antibiotic", "Antacid"
  lowStockThreshold: number; // in unitLabel units
  notes?: string;
}

/**
 * Concrete physical batch of medicine held in stock.
 */
export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string; // ISO 'YYYY-MM-DD' or 'YYYY-MM' (normalized to end of month)
  purchaseCost: number; // in INR (₹)
  mrp: number; // in INR (₹)
  quantityReceived: number;
  quantityRemaining: number;
  supplierName: string;
  status: BatchStatus;
  receivedDate: string;
}

/**
 * Computed inventory summary for a medicine, derived from all its batches.
 * Never stored as an editable record.
 */
export interface MedicineInventorySummary {
  medicine: Medicine;
  batches: MedicineBatch[];
  totalQuantity: number;       // All remaining units regardless of status
  saleableQuantity: number;    // Non-expired, active remaining units only
  expiredQuantity: number;     // Remaining units in expired batches
  quarantinedQuantity: number; // Remaining units in quarantined batches
  isLowStock: boolean;         // saleableQuantity <= medicine.lowStockThreshold
  isOutOfStock: boolean;       // saleableQuantity === 0
  hasExpiredBatches: boolean;
  hasExpiringSoonBatches: boolean;
  earliestExpiryDate: string | null; // For FEFO prioritization
  fefoEligibleBatch: MedicineBatch | null; // Next batch that would be picked by FEFO
  averageCost: number;         // Weighted average purchase cost of saleable stock
}

/**
 * Filter options for the inventory view.
 */
export type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type ExpiryFilter = 'ALL' | 'EXPIRING_SOON' | 'EXPIRED' | 'VALID';
