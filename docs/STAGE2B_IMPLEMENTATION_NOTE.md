# Medi5 ERP — Stage 2B Implementation Note: Inventory Persistence & Stock Movements

**Document Type:** Implementation Note & Architecture Reference  
**Stage:** Stage 2B (Inventory Persistence & Append-Only Stock Movements)  
**Target Repository:** `https://github.com/nishit0072e/medi5-erp`  
**Migration:** `supabase/migrations/20261017140000_inventory_persistence.sql`  
**Status:** Drafted & Verified against Schema Standards

---

## 1. Schema Architecture & Tenant Integrity

### 1.1 Tables Created
1. **`medicines` (Master Catalog):**
   - Strictly decoupled from physical batch lots. Stores name, generic name, strength, dosage form, package size, unit label, low-stock threshold, HSN code, and schedule type (`SCHEDULE_NONE`, `SCHEDULE_H`, `SCHEDULE_H1`, `SCHEDULE_X`).
   - Composite unique key: `(pharmacy_id, name, strength, dosage_form)` prevents duplicate specifications in the same pharmacy.
   - Composite key: `(pharmacy_id, id)` enables composite foreign keys from child tables.
2. **`suppliers`:**
   - Vendor entity scoped per pharmacy: `(pharmacy_id, name)` unique constraint.
3. **`medicine_batches`:**
   - Physical lots with batch number, month-end standardized expiry date, purchase cost (`numeric(10, 2)`), MRP (`numeric(10, 2)`), received quantity, remaining quantity, and status (`ACTIVE`, `EXPIRED`, `QUARANTINED`, `DEPLETED`).
   - **Cross-Tenant Prevention:** Uses composite foreign key `(pharmacy_id, medicine_id) REFERENCES medicines(pharmacy_id, id)`. A batch in Pharmacy A cannot reference a medicine from Pharmacy B.
   - **Scoped Batch Uniqueness:** `(pharmacy_id, medicine_id, batch_number)` guarantees batch uniqueness per medicine and pharmacy, permitting different medicines or pharmacies to use identical manufacturer lot numbers without conflict.
4. **`stock_movements` (Immutable Audit Ledger):**
   - Append-only ledger recording all stock movements (`PURCHASE_RECEIPT`, `SALE_DISPENSE`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `EXPIRED_WRITE_OFF`, `DAMAGE_WRITE_OFF`, `AUDIT_CORRECTION`).
   - Mathematical check: `balance_before + quantity_change = balance_after`.
   - **Append-only trigger:** `trg_stock_movement_append_only` rejects any direct `UPDATE` or `DELETE` attempt even by database administrators.

---

## 2. Write-Access & Trusted Operations (RPCs)

Direct client mutations to `medicine_batches` and `stock_movements` are **strictly revoked**:
- Clients cannot arbitrarily rewrite remaining quantities.
- Stock changes are executed exclusively via atomic trusted stored procedures:

### A. `receive_inventory_stock(...)`
1. Validates caller has active `OWNER` or `MANAGER` role for the pharmacy.
2. Validates inputs (positive quantity, MRP >= cost, valid batch number).
3. Locks the medicine record (`FOR UPDATE`) to serialize concurrent writes.
4. Checks if the batch already exists:
   - If yes: increments `quantity_received` and `quantity_remaining`.
   - If no: inserts a new batch record.
5. Writes an immutable `PURCHASE_RECEIPT` record to `stock_movements` in the same transaction.

### B. `adjust_inventory_stock(...)`
1. Validates caller has active `OWNER` or `MANAGER` role.
2. Locks the target batch record (`FOR UPDATE`).
3. Computes `balance_after = balance_before + quantity_change`.
4. Rejects with check violation if `balance_after < 0`.
5. Updates batch quantity (and marks `DEPLETED` if 0).
6. Writes corresponding movement row (`AUDIT_CORRECTION`, `DAMAGE_WRITE_OFF`, or `EXPIRED_WRITE_OFF`).

---

## 3. Unit Conventions & Indian Pharmacy Domain Notes

1. **Unit Convention:**
   - `unit_label` describes the physical dispensable unit (e.g. `Strips (10 tabs)`, `Bottles (100ml)`, `Vials`).
   - In retail pharmacy in West Bengal, tablets and capsules are almost universally purchased and dispensed by **Strips** rather than individual loose tablets, unless cut-strip dispensing is authorized.
   - Stock quantities in `medicine_batches` and `stock_movements` are counted in units of `unit_label` to ensure exact parity with physical packaging.
2. **Schedule H / H1 Flag:**
   - `medicines.schedule_type` supports future compliance requirements under the Drugs and Cosmetics Rules for recording dispensing doctor details.
3. **Monetary Precision:**
   - All financial figures use `numeric(10, 2)` preventing IEEE 754 floating-point inaccuracies.

---

## 4. Test Harness

The test suite in [`supabase/tests/database/02_inventory_persistence.test.sql`](file:///g:/ERP/supabase/tests/database/02_inventory_persistence.test.sql) defines 12 rigorous checks covering:
- Cross-tenant medicine rejection.
- Cross-tenant composite foreign key rejection (batches and suppliers).
- Scoped batch number uniqueness.
- Negative quantity check constraint.
- Denial of direct client updates/deletions on batches and movement ledger.
- Atomic execution and balance tracking of `receive_inventory_stock` and `adjust_inventory_stock`.
