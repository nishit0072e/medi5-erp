# Medi5 ERP — Stage 2 Tenancy, Authentication & Inventory Persistence Proposal

**Document Status:** Architecture Proposal for Review  
**Author:** Google Antigravity IDE (Primary Implementation Agent)  
**Target Repository:** `https://github.com/nishit0072e/medi5-erp`  
**Dependencies:** Reviewed against `PRD.md`, `ARCHITECTURE.md`, `AI_RULES.md`, and `QA_CHECKLIST.md`.  
**Scope Notice:** This document is an architectural proposal for founder and team review. It does **not** authorize or implement database migrations, live credentials, or backend mutations.

---

## Executive Summary

Stage 1 successfully delivered a verified, standalone React + Vite + TypeScript prototype proving the front-end inventory ledger, batch expansion, First-Expired, First-Out (FEFO) prioritization, and expired batch segregation.

Stage 2 transitions Medi5 from an in-memory prototype to an enterprise-grade, multi-tenant SaaS architecture powered by **Supabase PostgreSQL**, **Supabase Auth**, and **PostgreSQL Row-Level Security (RLS)**.

The primary objective of Stage 2 is to enforce **mathematical and database-level isolation** between independent pharmacies, ensuring that data security is governed by PostgreSQL constraints and server-enforced policies rather than UI filtering.

---

## 1. Identity and Tenancy Model

### 1.1 Core Tenancy Entity Relationship

```
+------------------+         +----------------------------+         +------------------+
|   auth.users     | 1     * |    pharmacy_memberships    | *     1 |    pharmacies    |
| (Supabase Auth)  |---------| (Roles & Membership Status)|---------| (Tenant Entity)  |
+------------------+         +----------------------------+         +------------------+
        | 1                                                                  | 1
        |                                                                    |
        | 1                                                                  | *
+------------------+                                                +------------------+
|     profiles     |                                                |   Tenant Data    |
| (App User Info)  |                                                | (Med, Batch, POS)|
+------------------+                                                +------------------+
```

### 1.2 Proposed Schema Specification

#### 1. `profiles`
Tracks user application-level metadata keyed directly to Supabase Auth.
```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### 2. `pharmacies`
The sovereign tenant entity representing an independent retail pharmacy.
```sql
CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                               -- Trade name (e.g., 'Nandan Pharmacy')
  legal_name text,                                  -- Registered business entity
  drug_license_number text,                         -- Form 20/21 Drug License No.
  gstin text,                                       -- Indian 15-digit GSTIN (optional for small retail)
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'West Bengal',
  pincode text NOT NULL,
  phone text NOT NULL,
  email text,
  currency text NOT NULL DEFAULT 'INR',
  expiry_threshold_days integer NOT NULL DEFAULT 60 CHECK (expiry_threshold_days >= 1),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### 3. `pharmacy_memberships`
Explicit, audited join record binding an authenticated identity to a pharmacy tenant with defined role and status.
```sql
CREATE TABLE public.pharmacy_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pharmacy_user UNIQUE (pharmacy_id, user_id)
);

CREATE INDEX idx_memberships_user ON public.pharmacy_memberships(user_id, status);
CREATE INDEX idx_memberships_pharmacy ON public.pharmacy_memberships(pharmacy_id, status);
```

### 1.3 Tenancy Rules & Invariants

1. **Identity vs. Entity Separation:**
   `pharmacy_id ≠ auth.uid()`. An auth user is a person; a pharmacy is an organization.
2. **Multi-Store Support (v1 Preparedness):**
   The schema naturally permits a single user (`auth.uid()`) to belong to multiple pharmacies (e.g. an owner with 2 branch stores). In the client, the active pharmacy context is held in state and passed via custom request headers or checked against authorized tenant memberships.
3. **Role Permission Matrix:**
   - **`OWNER`**: Full business ownership. Pharmacy profile updates, staff invitation, role promotion/demotion, billing/tax settings, financial leakage analytics, data export, store closure.
   - **`MANAGER`**: Daily store supervisor. Medicine catalog management, supplier order generation, batch receiving, manual audit corrections, customer refill management, view financial reports. Cannot remove owners or alter legal licensing data.
   - **`STAFF`**: Counter dispenser. POS checkout, medicine search, batch status lookup, patient refill reminders. Cannot edit purchase costs, cannot manually adjust inventory balances without approval, cannot access business net margin reports.
4. **Last-Owner Protection (Database Constraint/Trigger):**
   A database trigger enforces that a pharmacy must retain at least **one** active member with the `OWNER` role. An owner cannot demote themselves or revoke their own membership if they are the sole remaining owner.
5. **Instantaneous Revocation:**
   RLS policies evaluate `status = 'ACTIVE'` directly against `pharmacy_memberships` in every query. Revoking a user's membership takes effect on their very next database roundtrip without relying on client token invalidation or cache timeouts.

---

## 2. Batch-Level Inventory Persistence

### 2.1 Domain Schema Specification

```
+-----------------------+ 1     * +------------------------+
|      medicines        |---------|    medicine_batches    |
| (Master Catalog Item) |         | (Physical Stock Units) |
+-----------------------+         +------------------------+
           | 1                                | 1
           |                                  |
           | *                                | *
+----------------------------------------------------------+
|                     stock_movements                      |
|          (Append-Only Traceable Stock Ledger)            |
+----------------------------------------------------------+
```

#### 1. `medicines` (Master Catalog)
```sql
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL,                               -- Brand/Trade name (e.g. 'Dolo 650')
  generic_name text,                                -- Clinical generic (e.g. 'Paracetamol')
  strength text,                                    -- '650 mg'
  dosage_form text NOT NULL,                        -- 'Tablet', 'Syrup', etc.
  unit_label text NOT NULL DEFAULT 'Strips',        -- Unit of sale
  category text,                                    -- 'Antipyretic', 'Antibiotic'
  low_stock_threshold integer NOT NULL DEFAULT 15 CHECK (low_stock_threshold >= 0),
  hsn_code text,                                    -- Indian GST Harmonized System of Nomenclature (e.g. '3004')
  schedule_type text DEFAULT 'SCHEDULE_NONE' CHECK (schedule_type IN ('SCHEDULE_NONE', 'SCHEDULE_H', 'SCHEDULE_H1', 'SCHEDULE_X')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_medicine_per_pharmacy UNIQUE (pharmacy_id, name, strength, dosage_form)
);
```

#### 2. `suppliers`
```sql
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  gstin text,
  dl_number text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_per_pharmacy UNIQUE (pharmacy_id, name)
);
```

#### 3. `medicine_batches`
```sql
CREATE TABLE public.medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_number text NOT NULL,
  expiry_date date NOT NULL,                        -- Standardized to the calendar boundary (end-of-month if YYYY-MM)
  purchase_cost numeric(10, 2) NOT NULL CHECK (purchase_cost >= 0),
  mrp numeric(10, 2) NOT NULL CHECK (mrp >= purchase_cost),
  quantity_received integer NOT NULL CHECK (quantity_received >= 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'QUARANTINED', 'DEPLETED')),
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_batch_per_medicine UNIQUE (pharmacy_id, medicine_id, batch_number)
);

CREATE INDEX idx_batches_fefo ON public.medicine_batches (pharmacy_id, medicine_id, expiry_date, quantity_remaining)
  WHERE status = 'ACTIVE' AND quantity_remaining > 0;
```

#### 4. `stock_movements` (Immutable Audit Ledger)
Every single change to inventory must write an immutable row to this table. Direct updates to stock balances without a corresponding ledger entry are strictly prohibited.
```sql
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.medicine_batches(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'PURCHASE_RECEIPT', 
    'SALE_DISPENSE', 
    'CUSTOMER_RETURN', 
    'SUPPLIER_RETURN', 
    'EXPIRED_WRITE_OFF', 
    'DAMAGE_WRITE_OFF', 
    'AUDIT_CORRECTION'
  )),
  quantity_change integer NOT NULL,                 -- Positive for in-flow, negative for out-flow
  balance_before integer NOT NULL CHECK (balance_before >= 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reference_id uuid,                                -- Links to sales.id or purchase_orders.id
  notes text,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_pharmacy_batch ON public.stock_movements(pharmacy_id, batch_id, created_at DESC);
```

### 2.2 Inventory Ledger Integrity Rules

- **Restocking Behavior:** Inbound stock with an existing batch number and identical cost/expiry adds to `quantity_remaining` and appends a `PURCHASE_RECEIPT` movement. If cost or expiry differs, a distinct batch suffix/record is mandated.
- **Expiry Quarantine Process:** When a batch passes its expiry date, a background routine or trigger transitions its status to `EXPIRED`. Manual quarantine for damaged or recalled stock transitions status to `QUARANTINED`. Both states immediately prevent POS deduction.
- **Zero Silent Stock Writes:** A database trigger ensures that `medicine_batches.quantity_remaining` can only be updated if a matching `stock_movements` row is inserted in the exact same transaction.

---

## 3. PostgreSQL Security & Row-Level Security (RLS)

### 3.1 Security Foundation & Grants

PostgreSQL security comprises two distinct layers:
1. **Table Privileges (`GRANT`):** Defines whether a role can issue `SELECT`, `INSERT`, `UPDATE`, or `DELETE` at all.
2. **Row-Level Security (`RLS`):** Filters and validates which specific rows the role can read or mutate.

#### Least-Privilege Role Grants:
- The `anon` role receives **zero** grants on business tables.
- The `authenticated` role receives `SELECT` on all tenant tables, but **strictly restricted `INSERT`/`UPDATE`** rights.
- Destructive operations (`DELETE`) are **revoked entirely** on `stock_movements`, `sales`, and `sale_items`. Historical ERP records are voided or corrected, never silently deleted.

### 3.2 Security Helper Function

To avoid repeating complex multi-table joins in every RLS policy, we define a cached security helper:

```sql
CREATE OR REPLACE FUNCTION public.current_user_has_pharmacy_role(
  p_pharmacy_id uuid, 
  p_minimum_role text DEFAULT 'STAFF'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.pharmacy_memberships
  WHERE pharmacy_id = p_pharmacy_id
    AND user_id = auth.uid()
    AND status = 'ACTIVE';

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_minimum_role = 'STAFF' THEN
    RETURN v_role IN ('STAFF', 'MANAGER', 'OWNER');
  ELSIF p_minimum_role = 'MANAGER' THEN
    RETURN v_role IN ('MANAGER', 'OWNER');
  ELSIF p_minimum_role = 'OWNER' THEN
    RETURN v_role = 'OWNER';
  END IF;

  RETURN false;
END;
$$;
```

### 3.3 RLS Policy Matrix

| User Role / State | `pharmacies` | `medicines` & `batches` (Read) | `medicines` & `batches` (Write) | `stock_movements` (Read) | `stock_movements` (Write) |
|---|---|---|---|---|---|
| **Anonymous (Unauthenticated)** | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) |
| **Auth User (No Membership)** | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) |
| **Revoked Member** | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) |
| **Cross-Tenant User (Different Pharmacy)** | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) | DENIED (all) |
| **Active STAFF** | `SELECT` own | `SELECT` own | DENIED (direct) | `SELECT` own | DENIED (RPC only) |
| **Active MANAGER** | `SELECT` own | `SELECT` own | `INSERT`/`UPDATE` own | `SELECT` own | DENIED (RPC only) |
| **Active OWNER** | `SELECT`, `UPDATE` own | `SELECT` own | `INSERT`/`UPDATE` own | `SELECT` own | DENIED (RPC only) |

### 3.4 Hardening Trusted Database RPCs

Direct client mutations to `stock_movements` or batch quantities could allow malicious client injection. Therefore, inventory operations execute exclusively through **Trusted Stored Functions (RPCs)**:

- `SET search_path = public, pg_temp;` (Mitigates search path hijacking).
- Explicit validation of `auth.uid()` and membership.
- Execution in a single atomic database transaction.

---

## 4. Sales & Stock Consistency (POS Architecture)

### 4.1 Sales Data Model

```sql
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,                     -- e.g. 'INV-2026-0042'
  idempotency_key text NOT NULL,                    -- Client-generated UUID preventing duplicate sales on retry
  subtotal_mrp numeric(10, 2) NOT NULL CHECK (subtotal_mrp >= 0),
  total_discount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
  final_amount numeric(10, 2) NOT NULL CHECK (final_amount >= 0),
  total_cogs numeric(10, 2) NOT NULL CHECK (total_cogs >= 0),
  gross_profit numeric(10, 2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'UPI', 'CARD', 'CREDIT')),
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED', 'RETURNED')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sale_idempotency UNIQUE (pharmacy_id, idempotency_key),
  CONSTRAINT uq_sale_invoice UNIQUE (pharmacy_id, invoice_number)
);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.medicine_batches(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_mrp numeric(10, 2) NOT NULL CHECK (unit_mrp >= 0),
  unit_selling_price numeric(10, 2) NOT NULL CHECK (unit_selling_price >= 0),
  unit_purchase_cost numeric(10, 2) NOT NULL CHECK (unit_purchase_cost >= 0),
  total_mrp numeric(10, 2) NOT NULL,
  total_selling_price numeric(10, 2) NOT NULL,
  total_cost numeric(10, 2) NOT NULL
);
```

### 4.2 Financial Integrity & Pricing Rules

Indian independent pharmacy retail requires distinguishing list retail pricing from actual customer billing:
- **Total Bill (MRP):** `sum(item.quantity * item.unit_mrp)`.
- **Selling Bill (Actual Charged):** `sum(item.quantity * item.unit_selling_price)`.
- **Discount Amount:** `Total Bill (MRP) - Selling Bill`.
- **Cost of Goods Sold (COGS):** `sum(item.quantity * batch.purchase_cost)`.
- **Gross Profit:** `Selling Bill - Total COGS`.
- **Gross Margin %:** `(Gross Profit / Selling Bill) * 100`.

### 4.3 Transactional Checkout RPC (`record_pos_sale`)

When a cashier taps "Complete Sale" on their smartphone:
1. **Idempotency Guard:** Checks if `(pharmacy_id, idempotency_key)` already exists. If yes, returns the previously completed sale record without reprocessing.
2. **Batch Locking (`SELECT ... FOR UPDATE`):** Locks the specific candidate batch rows in PostgreSQL, serializing concurrent checkouts and preventing race conditions.
3. **FEFO Allocation & Verification:** 
   - Checks that candidate batches have `status = 'ACTIVE'`.
   - Re-checks that current timestamp has not crossed `expiry_date`.
   - If stock across eligible batches is insufficient, immediately aborts the transaction with `ERR_INSUFFICIENT_STOCK`.
4. **Atomic Updates:**
   - Deducts `quantity_remaining` on each allocated batch.
   - Writes `stock_movements` record for each deduction (`movement_type = 'SALE_DISPENSE'`).
   - Inserts `sales` and `sale_items` rows.
5. All operations commit together. If any item fails, the entire transaction rolls back completely.

---

## 5. Automated Security & Tenancy Testing Plan

A dedicated test suite (`tests/security/tenancy.test.ts`) must run against a local Supabase test instance in CI before any code can merge to `main`.

### Negative Security Test Matrix (Release Blockers)

| Test ID | Test Scenario | Expected Outcome | Severity |
|---|---|---|---|
| **SEC-01** | Anonymous user queries `medicines` or `batches` | Denied (401 Unauthorized / empty result) | Critical (Blocker) |
| **SEC-02** | User authenticated with Tenant A attempts to `SELECT` medicines from Tenant B | 0 rows returned (RLS filtered) | Critical (Blocker) |
| **SEC-03** | User in Tenant A attempts to `INSERT` a medicine with Tenant B's `pharmacy_id` | Denied (RLS policy violation) | Critical (Blocker) |
| **SEC-04** | User in Tenant A attempts to `UPDATE` batch quantity belonging to Tenant B | Denied (0 rows affected / error) | Critical (Blocker) |
| **SEC-05** | User whose membership was set to `REVOKED` issues API query | Denied immediately | Critical (Blocker) |
| **SEC-06** | Staff member attempts to alter pharmacy license details or delete an audit ledger row | Denied (403 Forbidden) | High |
| **SEC-07** | Composite FK forgery: Creating a sale item in Tenant A referencing a batch in Tenant B | Rejected by database constraint | Critical (Blocker) |
| **SEC-08** | Concurrent checkout of the last 5 units by two cashiers simultaneously | Exactly one succeeds; second receives insufficient stock error. Zero negative stock. | Critical (Blocker) |
| **SEC-09** | Re-sending the identical sale request with the same `idempotency_key` | Returns existing invoice without deducting stock twice | High |
| **SEC-10** | Attempting POS sale against an expired or quarantined batch | Rejected by `record_pos_sale` RPC | Critical (Blocker) |
| **SEC-11** | Attempting to revoke, suspend, or demote the last remaining active OWNER | Rejected by `enforce_last_active_owner` trigger (`23514`) | Critical (Blocker) |
| **SEC-12** | Attempting to insert a batch referencing a medicine or supplier from another tenant | Rejected by composite foreign key (`23503`) | Critical (Blocker) |

---

## 6. Migration and Environment Strategy

### 6.1 Versioned Migration Plan
Database evolution will strictly follow sequential versioned migrations in `supabase/migrations/`:

```
supabase/migrations/
├── 20261018000001_core_tenancy_and_profiles.sql
├── 20261018000002_inventory_catalog_and_batches.sql
├── 20261018000003_stock_movements_and_invariants.sql
├── 20261018000004_rls_policies_and_security_helpers.sql
├── 20261018000005_pos_sales_and_fefo_rpc.sql
└── 20261018000006_synthetic_seed_data.sql
```

### 6.2 Environments
- **Local Dev:** Local Supabase container managed via `supabase start`. No external internet or live credentials needed.
- **Staging:** Isolated Supabase project for developer integration, multi-user mobile testing, and automated end-to-end tests.
- **Production:** High-availability managed Supabase PostgreSQL instance with automated backups, point-in-time recovery (PITR), and restricted IP access.

---

## 7. Decision Register

### 7.1 Established Decisions (Recorded in Foundation Docs)
- [x] Multi-tenancy is enforced via a shared PostgreSQL database using Row-Level Security.
- [x] `pharmacy_id ≠ auth.uid()`. Explicit memberships govern authorization.
- [x] Medicine master catalog is strictly decoupled from physical batches.
- [x] Expired stock is segregated and excluded from saleable inventory.
- [x] FEFO is the mandatory dispensing rule.
- [x] Stock movement history is append-only.

### 7.2 Technical Recommendations Requiring Founder Approval
1. **Uniqueness Scope for Medicines:** We recommend enforcing `UNIQUE (pharmacy_id, name, strength, dosage_form)`. Does the founder agree that two items with identical name, strength, and form should share a master record, handling different pack sizes through unit labels?
2. **Indian Timezone Standardization:** We recommend standardizing all database date operations to Indian Standard Time (IST, UTC+05:30) midnight boundaries to prevent midnight timezone rollover discrepancies on local Android devices.
3. **Idempotency Strategy:** We recommend requiring client-side UUIDs for all checkout requests to guarantee zero accidental double-charges on slow 3G/4G connections.

### 7.3 Open Product, Operational & Compliance Questions
1. **Multi-Store Switching in UI:** While the database schema supports multi-pharmacy memberships, should the Phase 1/2 UI include a pharmacy switcher dropdown, or remain locked to a single active store?
2. **Indian Schedule H / H1 Regulations:** Retail pharmacies in India are required under the Drugs and Cosmetics Rules to maintain a separate register for Schedule H1 antibiotics (recording patient name, prescriber, and batch). Should Medi5 prompt for doctor/patient details when dispensing Schedule H/H1 drugs?
3. **GST Invoicing Requirements:** Is GST invoice generation required in Phase 2, or is simple thermal-slip / WhatsApp digital receipt adequate for initial testing?

---

*End of Proposal — Awaiting Founder and Team Review before implementation.*
