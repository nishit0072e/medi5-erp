-- Medi5 ERP — Stage 2B Migration: Inventory Persistence & Stock Movement Ledger
-- Migration: 20261017140000_inventory_persistence.sql
-- Description: Establishes medicines, suppliers, medicine_batches, and append-only stock_movements.
--              Enforces cross-tenant composite foreign keys, numeric precision for financial totals,
--              and atomic trusted receiving/adjustment operations.

-- ============================================================================
-- 1. TABLES & INVARIANTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: medicines (Master Catalog)
-- Stores clinical and packaging specifications. No direct stock quantities stored here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) >= 1),
  generic_name text,
  strength text,
  dosage_form text NOT NULL CHECK (length(trim(dosage_form)) >= 1),
  unit_label text NOT NULL DEFAULT 'Strips',        -- Unit of sale (e.g. 'Strips (10 tabs)', 'Bottles')
  package_size integer NOT NULL DEFAULT 1 CHECK (package_size >= 1),
  category text,
  low_stock_threshold integer NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  hsn_code text,                                    -- Indian GST HSN code (e.g. '3004')
  schedule_type text NOT NULL DEFAULT 'SCHEDULE_NONE' 
    CHECK (schedule_type IN ('SCHEDULE_NONE', 'SCHEDULE_H', 'SCHEDULE_H1', 'SCHEDULE_X')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate medicines with identical specification within the same store
  CONSTRAINT uq_medicine_identity UNIQUE (pharmacy_id, name, strength, dosage_form),
  -- Composite unique key to support composite foreign key constraints from child tables
  CONSTRAINT uq_medicine_tenant UNIQUE (pharmacy_id, id)
);

COMMENT ON TABLE public.medicines IS 'Master medicine catalog records, strictly scoped per pharmacy tenant';

-- ----------------------------------------------------------------------------
-- Table: suppliers
-- Vendor records for stock procurement
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) >= 1),
  phone text,
  email text,
  gstin text,
  dl_number text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_supplier_name_per_pharmacy UNIQUE (pharmacy_id, name),
  CONSTRAINT uq_supplier_tenant UNIQUE (pharmacy_id, id)
);

COMMENT ON TABLE public.suppliers IS 'Procurement suppliers, strictly scoped per pharmacy tenant';

-- ----------------------------------------------------------------------------
-- Table: medicine_batches
-- Physical inventory lots held by the pharmacy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL,
  supplier_id uuid,
  batch_number text NOT NULL CHECK (length(trim(batch_number)) >= 1),
  expiry_date date NOT NULL,                        -- Standardized to month-end calendar day
  purchase_cost numeric(10, 2) NOT NULL CHECK (purchase_cost >= 0),
  mrp numeric(10, 2) NOT NULL CHECK (mrp >= purchase_cost),
  quantity_received integer NOT NULL CHECK (quantity_received >= 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' 
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'QUARANTINED', 'DEPLETED')),
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- COMPOSITE FOREIGN KEYS: Mathematically prevents referencing medicines or suppliers from other tenants
  CONSTRAINT fk_batch_medicine_tenant FOREIGN KEY (pharmacy_id, medicine_id) 
    REFERENCES public.medicines(pharmacy_id, id) ON DELETE RESTRICT,

  CONSTRAINT fk_batch_supplier_tenant FOREIGN KEY (pharmacy_id, supplier_id) 
    REFERENCES public.suppliers(pharmacy_id, id) ON DELETE SET NULL,

  -- Scoped uniqueness: batch number is unique per pharmacy + medicine (allows reuse across different products)
  CONSTRAINT uq_batch_per_medicine UNIQUE (pharmacy_id, medicine_id, batch_number),
  -- Composite unique key to support composite foreign key constraints from stock_movements
  CONSTRAINT uq_batch_tenant UNIQUE (pharmacy_id, id)
);

COMMENT ON TABLE public.medicine_batches IS 'Physical batch stock records with composite tenant foreign keys';

-- Index for FEFO (First-Expired, First-Out) lookup on active stock
CREATE INDEX IF NOT EXISTS idx_batches_fefo_active 
  ON public.medicine_batches (pharmacy_id, medicine_id, expiry_date ASC, quantity_remaining)
  WHERE status = 'ACTIVE' AND quantity_remaining > 0;

-- ----------------------------------------------------------------------------
-- Table: stock_movements
-- Append-only audit ledger of every inventory alteration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'PURCHASE_RECEIPT', 
    'SALE_DISPENSE', 
    'CUSTOMER_RETURN', 
    'SUPPLIER_RETURN', 
    'EXPIRED_WRITE_OFF', 
    'DAMAGE_WRITE_OFF', 
    'AUDIT_CORRECTION'
  )),
  quantity_change integer NOT NULL CHECK (quantity_change != 0),
  balance_before integer NOT NULL CHECK (balance_before >= 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reference_id uuid,                                -- Optional link to future sale_id or po_id
  notes text,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Mathematical balance check
  CONSTRAINT chk_movement_math CHECK (balance_before + quantity_change = balance_after),

  -- COMPOSITE FOREIGN KEY: Guarantees movements cannot reference another tenant's batch
  CONSTRAINT fk_movement_batch_tenant FOREIGN KEY (pharmacy_id, batch_id) 
    REFERENCES public.medicine_batches(pharmacy_id, id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.stock_movements IS 'Append-only audit ledger of all inventory transactions';

CREATE INDEX IF NOT EXISTS idx_movements_pharmacy_batch_time 
  ON public.stock_movements (pharmacy_id, batch_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Trigger: Append-Only Enforcement for stock_movements
-- Rejects any direct UPDATE or DELETE on stock_movements, even by administrators
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_stock_movement_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Audit invariant violation: stock_movements is append-only; updates and deletions are strictly prohibited.'
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movement_append_only ON public.stock_movements;
CREATE TRIGGER trg_stock_movement_append_only
  BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stock_movement_append_only();

-- ============================================================================
-- 2. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Policies: medicines
-- ----------------------------------------------------------------------------
-- Active members of the pharmacy can read medicines
CREATE POLICY "medicines_select_member" 
  ON public.medicines 
  FOR SELECT 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_active_pharmacy_ids()));

-- Managers and Owners can insert/update medicines
CREATE POLICY "medicines_insert_manager_owner" 
  ON public.medicines 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()));

CREATE POLICY "medicines_update_manager_owner" 
  ON public.medicines 
  FOR UPDATE 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()))
  WITH CHECK (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()));

-- ----------------------------------------------------------------------------
-- Policies: suppliers
-- ----------------------------------------------------------------------------
CREATE POLICY "suppliers_select_member" 
  ON public.suppliers 
  FOR SELECT 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_active_pharmacy_ids()));

CREATE POLICY "suppliers_insert_manager_owner" 
  ON public.suppliers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()));

CREATE POLICY "suppliers_update_manager_owner" 
  ON public.suppliers 
  FOR UPDATE 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()))
  WITH CHECK (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()));

-- ----------------------------------------------------------------------------
-- Policies: medicine_batches
-- ----------------------------------------------------------------------------
-- Active members can read batches
CREATE POLICY "batches_select_member" 
  ON public.medicine_batches 
  FOR SELECT 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_active_pharmacy_ids()));

-- Direct client INSERT and UPDATE are DENIED via RLS and grants.
-- Stock changes are executed exclusively via trusted atomic RPCs.

-- ----------------------------------------------------------------------------
-- Policies: stock_movements
-- ----------------------------------------------------------------------------
-- Active members can view movement history
CREATE POLICY "movements_select_member" 
  ON public.stock_movements 
  FOR SELECT 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_active_pharmacy_ids()));

-- Direct client INSERT, UPDATE, DELETE are DENIED via RLS and grants.

-- ============================================================================
-- 3. TRUSTED INVENTORY OPERATIONS (RPCs)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC: receive_inventory_stock
-- Atomically receives new batch inventory and writes a PURCHASE_RECEIPT movement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_inventory_stock(
  p_pharmacy_id uuid,
  p_medicine_id uuid,
  p_batch_number text,
  p_expiry_date date,
  p_purchase_cost numeric,
  p_mrp numeric,
  p_quantity integer,
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_batch_id uuid;
  v_existing_rem integer;
  v_balance_before integer := 0;
  v_balance_after integer;
  v_movement_id uuid;
BEGIN
  -- 1. Authorization check: caller must be active OWNER or MANAGER
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT (p_pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids())) THEN
    RAISE EXCEPTION 'Authorization required: Only active Owners and Managers can receive inventory'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Input validation
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Validation error: Quantity received must be greater than zero' USING ERRCODE = '22000';
  END IF;
  IF p_mrp < p_purchase_cost THEN
    RAISE EXCEPTION 'Validation error: MRP cannot be lower than purchase cost' USING ERRCODE = '22000';
  END IF;
  IF trim(p_batch_number) IS NULL OR length(trim(p_batch_number)) < 1 THEN
    RAISE EXCEPTION 'Validation error: Batch number is required' USING ERRCODE = '22000';
  END IF;

  -- 3. Lock medicine record to verify existence and serialize concurrent additions
  PERFORM 1 FROM public.medicines WHERE id = p_medicine_id AND pharmacy_id = p_pharmacy_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Medicine % does not exist in pharmacy %', p_medicine_id, p_pharmacy_id
      USING ERRCODE = '23503';
  END IF;

  -- 4. Check if batch already exists for this medicine in this pharmacy
  SELECT id, quantity_remaining 
  INTO v_batch_id, v_existing_rem
  FROM public.medicine_batches
  WHERE pharmacy_id = p_pharmacy_id 
    AND medicine_id = p_medicine_id 
    AND batch_number = trim(p_batch_number)
  FOR UPDATE;

  IF FOUND THEN
    -- Increment existing batch
    v_balance_before := v_existing_rem;
    v_balance_after := v_existing_rem + p_quantity;

    UPDATE public.medicine_batches
    SET quantity_received = quantity_received + p_quantity,
        quantity_remaining = v_balance_after,
        updated_at = now()
    WHERE id = v_batch_id;
  ELSE
    -- Insert new batch record
    v_balance_before := 0;
    v_balance_after := p_quantity;

    INSERT INTO public.medicine_batches (
      pharmacy_id,
      medicine_id,
      supplier_id,
      batch_number,
      expiry_date,
      purchase_cost,
      mrp,
      quantity_received,
      quantity_remaining,
      status
    ) VALUES (
      p_pharmacy_id,
      p_medicine_id,
      p_supplier_id,
      trim(p_batch_number),
      p_expiry_date,
      p_purchase_cost,
      p_mrp,
      p_quantity,
      v_balance_after,
      'ACTIVE'
    )
    RETURNING id INTO v_batch_id;
  END IF;

  -- 5. Record immutable stock movement
  INSERT INTO public.stock_movements (
    pharmacy_id,
    batch_id,
    movement_type,
    quantity_change,
    balance_before,
    balance_after,
    notes,
    performed_by
  ) VALUES (
    p_pharmacy_id,
    v_batch_id,
    'PURCHASE_RECEIPT',
    p_quantity,
    v_balance_before,
    v_balance_after,
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'movement_id', v_movement_id,
    'quantity_added', p_quantity,
    'balance_after', v_balance_after
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: adjust_inventory_stock
-- Atomically adjusts batch quantity for audit correction, damage, or write-off
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_pharmacy_id uuid,
  p_batch_id uuid,
  p_quantity_change integer,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_movement_type text;
  v_movement_id uuid;
BEGIN
  -- 1. Authorization: caller must be active OWNER or MANAGER
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT (p_pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids())) THEN
    RAISE EXCEPTION 'Authorization required: Only active Owners and Managers can adjust inventory'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Input validation
  IF p_quantity_change = 0 THEN
    RAISE EXCEPTION 'Validation error: Quantity change cannot be zero' USING ERRCODE = '22000';
  END IF;

  IF p_reason IN ('DAMAGE', 'DAMAGE_WRITE_OFF') THEN
    v_movement_type := 'DAMAGE_WRITE_OFF';
  ELSIF p_reason IN ('EXPIRED', 'EXPIRED_WRITE_OFF') THEN
    v_movement_type := 'EXPIRED_WRITE_OFF';
  ELSE
    v_movement_type := 'AUDIT_CORRECTION';
  END IF;

  -- 3. Lock batch record for update
  SELECT quantity_remaining 
  INTO v_balance_before
  FROM public.medicine_batches
  WHERE id = p_batch_id AND pharmacy_id = p_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation error: Batch % does not exist in pharmacy %', p_batch_id, p_pharmacy_id
      USING ERRCODE = '23503';
  END IF;

  v_balance_after := v_balance_before + p_quantity_change;

  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'Inventory invariant violation: Adjustment would result in negative stock balance (% -> %)', 
      v_balance_before, v_balance_after
      USING ERRCODE = '23514';
  END IF;

  -- 4. Update batch record
  UPDATE public.medicine_batches
  SET quantity_remaining = v_balance_after,
      status = CASE 
        WHEN v_balance_after = 0 THEN 'DEPLETED'
        ELSE status 
      END,
      updated_at = now()
  WHERE id = p_batch_id;

  -- 5. Record movement in audit ledger
  INSERT INTO public.stock_movements (
    pharmacy_id,
    batch_id,
    movement_type,
    quantity_change,
    balance_before,
    balance_after,
    notes,
    performed_by
  ) VALUES (
    p_pharmacy_id,
    p_batch_id,
    v_movement_type,
    p_quantity_change,
    v_balance_before,
    v_balance_after,
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'movement_id', v_movement_id,
    'quantity_change', p_quantity_change,
    'balance_after', v_balance_after
  );
END;
$$;

-- ============================================================================
-- 4. LEAST-PRIVILEGE GRANTS
-- ============================================================================

-- Revoke public access
REVOKE ALL ON TABLE public.medicines FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.suppliers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.medicine_batches FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.stock_movements FROM PUBLIC, anon;

-- anon receives no access
-- authenticated receives selective access
GRANT SELECT, INSERT, UPDATE ON TABLE public.medicines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.suppliers TO authenticated;
GRANT SELECT ON TABLE public.medicine_batches TO authenticated;
GRANT SELECT ON TABLE public.stock_movements TO authenticated;

-- Direct mutation grants on batches and movements are revoked from clients
REVOKE INSERT, UPDATE, DELETE ON TABLE public.medicine_batches FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.stock_movements FROM authenticated;
REVOKE DELETE ON TABLE public.medicines FROM authenticated;
REVOKE DELETE ON TABLE public.suppliers FROM authenticated;

-- Function execution grants
GRANT EXECUTE ON FUNCTION public.receive_inventory_stock(uuid, uuid, text, date, numeric, numeric, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, uuid, integer, text, text) TO authenticated;
