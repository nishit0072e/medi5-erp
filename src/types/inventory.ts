/**
 * Medi5 ERP - Inventory Domain Types
 * 
 * Strict separation between Medicine Master records and Physical Inventory Batches.
 * Invariants:
 * 1. Medicine-level quantities are ALWAYS dynamically derived from child batches.
 * 2. Expired or Quarantined batches are strictly excluded from saleable quantity.
 * 3. Expiry date convention: If YYYY-MM is provided, the final calendar day of that month
 *    at 23:59:59 is used as the official expiry boundary.
 * 4. Every stock adjustment writes an immutable StockMovement ensuring:
 *    balance_after = balance_before + quantity_change
 */

export type DosageForm = 
  | 'Tablet' 
  | 'Capsule' 
  | 'Syrup' 
  | 'Suspension'
  | 'Injection' 
  | 'Ointment' 
  | 'Eye Drops';

export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'QUARANTINED' | 'DEPLETED';

export type ExpiryUrgency = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export type MovementType = 
  | 'PURCHASE_RECEIPT' 
  | 'SALE_DISPENSE' 
  | 'CUSTOMER_RETURN' 
  | 'SUPPLIER_RETURN' 
  | 'EXPIRED_WRITE_OFF' 
  | 'DAMAGE_WRITE_OFF' 
  | 'AUDIT_CORRECTION';

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
  unitLabel: string; // e.g. "Strips (10 tabs)", "Bottles (100ml)", "Vials"
  packageSize?: number;
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

export type BatchRecord = MedicineBatch;

/**
 * Immutable stock movement record in the audit ledger.
 */
export interface StockMovement {
  id: string;
  batchId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  movementType: MovementType;
  quantityChange: number; // Positive for inflow, negative for outflow
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  timestamp: string; // ISO string
  performedBy: string;
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

/**
 * Input for receiving stock into inventory
 */
export interface ReceiveStockInput {
  medicineId?: string;
  newMedicine?: {
    name: string;
    genericName: string;
    strength: string;
    dosageForm: DosageForm;
    unitLabel: string;
    category: string;
    lowStockThreshold: number;
  };
  supplierName?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM or YYYY-MM-DD
  purchaseCost: number;
  mrp: number;
  quantity: number;
  notes?: string;
}

/**
 * Input for adjusting inventory stock
 */
export interface AdjustStockInput {
  batchId: string;
  batchNumber?: string;
  movementType: 'AUDIT_CORRECTION' | 'DAMAGE_WRITE_OFF' | 'EXPIRED_WRITE_OFF';
  quantityChange: number; // negative for reduction
  reason: string;
  notes?: string;
}

/**
 * ========================================================
 * Stage 3B: Point of Sale (POS) Counter Sales Domain Models
 * ========================================================
 */

/**
 * Concrete allocation of stock from a specific batch to a cart line item.
 */
export interface BatchAllocation {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  purchaseCost: number; // in INR (₹)
  mrp: number;          // in INR (₹)
  quantity: number;     // whole packaging units
}

/**
 * Line item in the active POS cart.
 */
export interface CartLineItem {
  medicineId: string;
  quantity: number; // requested units
}

/**
 * Pre-checkout evaluation of a cart line item across eligible batches.
 */
export interface CartLineAllocation {
  medicine: Medicine;
  requestedQuantity: number;
  availableQuantity: number;
  isFullyAllocated: boolean;
  unfulfilledQuantity: number;
  allocations: BatchAllocation[];
  lineTotalMrp: number;  // in INR (₹)
  lineTotalCogs: number; // in INR (₹)
}

/**
 * Summary of a line item as recorded in a completed sale.
 */
export interface SaleItemSummary {
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  unitLabel: string;
  quantity: number;
  lineTotalMrp: number; // sum of allocation mrp * qty
  lineTotalCogs: number; // sum of allocation cost * qty
  allocations: BatchAllocation[];
}

/**
 * Completed counter-sale record in demo repository history.
 */
export interface SaleRecord {
  id: string; // e.g. "INV-2026-0001"
  clientSaleToken: string; // Idempotency token
  timestamp: string; // ISO string
  items: SaleItemSummary[];
  totalBillMrp: number;           // Standard MRP sum
  sellingBill: number;            // Actual amount charged
  discount: number;               // Total Bill (MRP) - Selling Bill
  estimatedCogs: number;          // Total batch purchase cost
  estimatedGrossProfit: number;   // Selling Bill - estimatedCogs
  tenderType: 'CASH' | 'UPI' | 'CARD';
  staffUser: string;
  confirmedBelowCost: boolean;
}

/**
 * Input for atomic counter-sale checkout operation.
 */
export interface ProcessSaleInput {
  clientSaleToken: string;
  cart: CartLineItem[];
  sellingBill: number;
  tenderType?: 'CASH' | 'UPI' | 'CARD';
  staffUser?: string;
  confirmedBelowCost?: boolean;
}
