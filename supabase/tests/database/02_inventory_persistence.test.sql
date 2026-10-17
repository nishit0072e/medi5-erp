-- Medi5 ERP — Automated Inventory Persistence & Stock Invariant Test Suite
-- Target: supabase/migrations/20261017140000_inventory_persistence.sql
-- Runner: psql / Supabase test runner ('supabase test db')
-- Synthetic Entities:
--   Pharmacy A: 11111111-1111-1111-1111-111111111111 (Nandan Pharmacy)
--   Pharmacy B: 22222222-2222-2222-2222-222222222222 (Sadhana Medical)
--   User A (Owner of A): aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   User B (Staff of A): bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   User C (Owner of B): cccccccc-cccc-cccc-cccc-cccccccccccc

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

-- Setup synthetic IDs
\set med_a '33333333-3333-3333-3333-333333333333'
\set med_b '44444444-4444-4444-4444-444444444444'
\set sup_a '55555555-5555-5555-5555-555555555555'
\set sup_b '66666666-6666-6666-6666-666666666666'

-- ============================================================================
-- TEST 1: Authorized creation and reading of medicines
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT lives_ok(
  'INSERT INTO public.medicines (id, pharmacy_id, name, generic_name, strength, dosage_form, unit_label, low_stock_threshold)
   VALUES (''33333333-3333-3333-3333-333333333333'', ''11111111-1111-1111-1111-111111111111'', ''Dolo 650'', ''Paracetamol'', ''650 mg'', ''Tablet'', ''Strips'', 20)',
  'TEST 1: Owner of Pharmacy A can create a master medicine record'
);

-- ============================================================================
-- TEST 2: Cross-tenant medicine reading is rejected by RLS
-- ============================================================================
-- Switch to User C (Owner of Pharmacy B)
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc", "role": "authenticated"}';

SELECT is_empty(
  'SELECT id FROM public.medicines WHERE id = ''33333333-3333-3333-3333-333333333333''',
  'TEST 2: User C (Pharmacy B) cannot see Medicine from Pharmacy A'
);

-- ============================================================================
-- TEST 3: Cross-tenant batch creation referencing another tenant medicine is rejected
-- ============================================================================
-- Switch to superuser/admin to test constraint directly
RESET ROLE;

SELECT throws_ok(
  'INSERT INTO public.medicine_batches (pharmacy_id, medicine_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
   VALUES (''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''SYN-CROSS-01'', ''2027-12-31'', 20, 30, 50, 50)',
  '23503',
  'TEST 3: Composite foreign key blocks creating a batch in Pharmacy B referencing a medicine in Pharmacy A'
);

-- ============================================================================
-- TEST 4: Cross-tenant supplier references rejected
-- ============================================================================
-- Insert supplier in Pharmacy A
INSERT INTO public.suppliers (id, pharmacy_id, name)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Supplier A')
ON CONFLICT DO NOTHING;

-- Insert medicine in Pharmacy B
INSERT INTO public.medicines (id, pharmacy_id, name, generic_name, strength, dosage_form)
VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Augmentin', 'Amoxicillin', '625 mg', 'Tablet')
ON CONFLICT DO NOTHING;

-- Attempt to create a batch in Pharmacy B referencing Supplier A
SELECT throws_ok(
  'INSERT INTO public.medicine_batches (pharmacy_id, medicine_id, supplier_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
   VALUES (''22222222-2222-2222-2222-222222222222'', ''44444444-4444-4444-4444-444444444444'', ''55555555-5555-5555-5555-555555555555'', ''SYN-CROSS-SUP'', ''2027-12-31'', 100, 150, 10, 10)',
  '23503',
  'TEST 4: Composite foreign key blocks referencing Supplier A in Pharmacy B batch'
);

-- ============================================================================
-- TEST 5: Duplicate batch number within same medicine and pharmacy rejected
-- ============================================================================
-- Create legitimate batch 1 in Pharmacy A
INSERT INTO public.medicine_batches (id, pharmacy_id, medicine_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
VALUES ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'BATCH-DUP-01', '2027-10-31', 25, 35, 100, 100);

-- Duplicate batch insertion should fail with unique violation 23505
SELECT throws_ok(
  'INSERT INTO public.medicine_batches (pharmacy_id, medicine_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''33333333-3333-3333-3333-333333333333'', ''BATCH-DUP-01'', ''2027-10-31'', 25, 35, 50, 50)',
  '23505',
  'TEST 5: Scoped unique constraint blocks duplicate batch number within same medicine'
);

-- ============================================================================
-- TEST 6: Same batch number allowed for different medicine or pharmacy
-- ============================================================================
-- Insert batch with same number 'BATCH-DUP-01' into Pharmacy B's medicine
SELECT lives_ok(
  'INSERT INTO public.medicine_batches (pharmacy_id, medicine_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
   VALUES (''22222222-2222-2222-2222-222222222222'', ''44444444-4444-4444-4444-444444444444'', ''BATCH-DUP-01'', ''2027-10-31'', 120, 160, 20, 20)',
  'TEST 6: Same batch number is allowed for a different medicine or pharmacy tenant'
);

-- ============================================================================
-- TEST 7: Invalid negative quantities rejected
-- ============================================================================
SELECT throws_ok(
  'INSERT INTO public.medicine_batches (pharmacy_id, medicine_id, batch_number, expiry_date, purchase_cost, mrp, quantity_received, quantity_remaining)
   VALUES (''11111111-1111-1111-1111-111111111111'', ''33333333-3333-3333-3333-333333333333'', ''BATCH-NEG'', ''2027-10-31'', 20, 30, 50, -5)',
  '23514',
  'TEST 7: Check constraint rejects negative remaining stock'
);

-- ============================================================================
-- TEST 8: Direct client modification of batch quantities is revoked
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT throws_ok(
  'UPDATE public.medicine_batches SET quantity_remaining = 999 WHERE id = ''77777777-7777-7777-7777-777777777777''',
  'TEST 8: Direct client UPDATE on medicine_batches must be denied (grants revoked)'
);

-- ============================================================================
-- TEST 9: Direct client deletion or alteration of stock_movements is rejected
-- ============================================================================
SELECT throws_ok(
  'DELETE FROM public.stock_movements',
  'TEST 9: Direct client DELETE on stock_movements is prohibited'
);

-- ============================================================================
-- TEST 10: Authorized receiving RPC updates batch and records movement atomically
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT lives_ok(
  'SELECT public.receive_inventory_stock(
     ''11111111-1111-1111-1111-111111111111'',
     ''33333333-3333-3333-3333-333333333333'',
     ''BATCH-RPC-01'',
     ''2028-06-30''::date,
     30.00,
     45.00,
     80,
     NULL,
     ''Initial stock receipt via trusted RPC''
   )',
  'TEST 10: Owner can receive stock via trusted receive_inventory_stock RPC'
);

-- Verify stock movement was recorded
SELECT results_eq(
  'SELECT movement_type, quantity_change, balance_after 
   FROM public.stock_movements 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' AND notes = ''Initial stock receipt via trusted RPC''',
  'VALUES (''PURCHASE_RECEIPT''::text, 80, 80)',
  'TEST 11: Movement ledger records PURCHASE_RECEIPT with balance_after = 80'
);

-- ============================================================================
-- TEST 12: Adjustment RPC fails if resulting quantity would be negative
-- ============================================================================
SELECT throws_ok(
  'SELECT public.adjust_inventory_stock(
     ''11111111-1111-1111-1111-111111111111'',
     ''77777777-7777-7777-7777-777777777777'',
     -500, -- Attempting to deduct 500 when only 100 remain!
     ''DAMAGE'',
     ''Accidental over-reduction''
   )',
  '23514',
  'TEST 12: Adjustment RPC rejects deduction that would cause negative balance'
);

SELECT * FROM finish();
ROLLBACK;
