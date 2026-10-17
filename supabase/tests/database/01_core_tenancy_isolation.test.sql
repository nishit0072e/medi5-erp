-- Medi5 ERP — Automated Tenant Isolation & Security Test Suite
-- Target: supabase/migrations/20261017130000_core_tenancy.sql
-- Runner: psql / Supabase test runner ('supabase test db')
-- Synthetic Users:
--   User A (Owner A):       aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   User B (Staff A):       bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   User C (Owner B):       cccccccc-cccc-cccc-cccc-cccccccccccc
--   User D (Unaffiliated):  dddddddd-dddd-dddd-dddd-dddddddddddd
--   User E (Revoked A):     eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
--   User F (Co-Owner A):    ffffffff-ffff-ffff-ffff-ffffffffffff (for multi-owner tests)

BEGIN;

-- Load pgTAP if available in test runner
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(18);

-- ============================================================================
-- TEST 1: Anonymous users cannot access protected tenant data
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{}';

SELECT is_empty(
  'SELECT id, name FROM public.pharmacies',
  'TEST 1: Anonymous users must receive 0 rows from pharmacies'
);

-- ============================================================================
-- TEST 2: Unaffiliated authenticated users cannot access tenant data
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';

SELECT is_empty(
  'SELECT id, name FROM public.pharmacies',
  'TEST 2: Unaffiliated authenticated user (User D) cannot read any pharmacy'
);

-- ============================================================================
-- TEST 3: Pharmacy A members cannot access Pharmacy B's protected records
-- ============================================================================
-- Switch to User A (Owner of Pharmacy A)
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT is_empty(
  'SELECT id FROM public.pharmacies WHERE id = ''22222222-2222-2222-2222-222222222222''',
  'TEST 3a: User A (Pharmacy A) cannot read Pharmacy B'
);

-- Switch to User B (Staff of Pharmacy A)
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

SELECT is_empty(
  'SELECT id FROM public.pharmacies WHERE id = ''22222222-2222-2222-2222-222222222222''',
  'TEST 3b: User B (Staff A) cannot read Pharmacy B'
);

-- ============================================================================
-- TEST 4: Direct client insert on memberships to self-promote is rejected
-- ============================================================================
-- User D attempts to insert an OWNER membership for themselves in Pharmacy A
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';

SELECT throws_ok(
  'INSERT INTO public.pharmacy_memberships (pharmacy_id, user_id, role, status) VALUES (''11111111-1111-1111-1111-111111111111'', ''dddddddd-dddd-dddd-dddd-dddddddddddd'', ''OWNER'', ''ACTIVE'')',
  'TEST 4: Direct client insert on pharmacy_memberships must be rejected by RLS / grant'
);

-- ============================================================================
-- TEST 5: Revoked members lose access under the defined policy
-- ============================================================================
-- Switch to User E (Revoked former member of Pharmacy A)
SET LOCAL "request.jwt.claims" = '{"sub": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}';

SELECT is_empty(
  'SELECT id FROM public.pharmacies WHERE id = ''11111111-1111-1111-1111-111111111111''',
  'TEST 5: Revoked user (User E) receives 0 rows from Pharmacy A'
);

-- ============================================================================
-- TEST 6: Staff cannot perform owner-only operations (e.g. updating pharmacy)
-- ============================================================================
-- Switch to User B (Staff)
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

UPDATE public.pharmacies 
SET name = 'Illegally Renamed By Staff' 
WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT isnt(
  (SELECT name FROM public.pharmacies WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Illegally Renamed By Staff',
  'TEST 6: Staff member cannot update pharmacy details (update rejected by RLS)'
);

-- ============================================================================
-- TEST 7: Direct unauthorized tenant insertion is rejected
-- ============================================================================
-- Direct INSERT on pharmacies bypassing RPC
SELECT throws_ok(
  'INSERT INTO public.pharmacies (name, address_line1, city, pincode, phone) VALUES (''Bypassed Store'', ''Street'', ''Kolkata'', ''700001'', ''+919800000000'')',
  'TEST 7: Direct client INSERT on pharmacies table must be rejected'
);

-- ============================================================================
-- TEST 8: Tenant onboarding RPC produces exactly one authorized owner
-- ============================================================================
-- Switch to User D (unaffiliated) and invoke onboarding RPC
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';

SELECT lives_ok(
  'SELECT public.create_pharmacy_with_owner(
     ''New Sunrise Chemist'',
     ''99 College Street'',
     ''Kolkata'',
     ''700073'',
     ''+919830099999''
   )',
  'TEST 8: Onboarding RPC successfully creates pharmacy and owner binding for auth.uid()'
);

-- ============================================================================
-- TEST 9: Newly created membership is strictly OWNER and ACTIVE
-- ============================================================================
SELECT results_eq(
  'SELECT role, status FROM public.pharmacy_memberships WHERE user_id = ''dddddddd-dddd-dddd-dddd-dddddddddddd'' AND status = ''ACTIVE''',
  'VALUES (''OWNER''::text, ''ACTIVE''::text)',
  'TEST 9: Newly created membership is strictly OWNER and ACTIVE'
);

-- ============================================================================
-- TEST 10: Failed onboarding input validation aborts atomically
-- ============================================================================
-- Invalid phone number (less than 10 digits) should raise an exception and roll back
SELECT throws_ok(
  'SELECT public.create_pharmacy_with_owner(
     ''Invalid Store'',
     ''Street'',
     ''Kolkata'',
     ''700073'',
     ''123'' -- Invalid phone!
   )',
  '22000',
  'TEST 10: Onboarding with invalid input fails and leaves no orphaned pharmacy'
);

-- ============================================================================
-- TEST 11: Cross-tenant pharmacy update by User A against Pharmacy B affects 0 rows
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

UPDATE public.pharmacies 
SET name = 'Hacked Sadhana Medical' 
WHERE id = '22222222-2222-2222-2222-222222222222';

SELECT isnt(
  (SELECT name FROM public.pharmacies WHERE id = '22222222-2222-2222-2222-222222222222'),
  'Hacked Sadhana Medical',
  'TEST 11: User A cannot update Pharmacy B (RLS prevents cross-tenant update)'
);

-- ============================================================================
-- TEST 12: Last-owner self-revocation is rejected by trigger (23514)
-- ============================================================================
-- User A is the sole active OWNER of Pharmacy A
SELECT throws_ok(
  'UPDATE public.pharmacy_memberships 
   SET status = ''REVOKED'' 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' 
     AND user_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '23514',
  'TEST 12: Trigger blocks revoking the sole active OWNER of Pharmacy A'
);

-- ============================================================================
-- TEST 13: Last-owner demotion (OWNER -> STAFF) is rejected by trigger (23514)
-- ============================================================================
SELECT throws_ok(
  'UPDATE public.pharmacy_memberships 
   SET role = ''STAFF'' 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' 
     AND user_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '23514',
  'TEST 13: Trigger blocks demoting the sole active OWNER of Pharmacy A'
);

-- ============================================================================
-- TEST 14: Last-owner suspension is rejected by trigger (23514)
-- ============================================================================
SELECT throws_ok(
  'UPDATE public.pharmacy_memberships 
   SET status = ''SUSPENDED'' 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' 
     AND user_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '23514',
  'TEST 14: Trigger blocks suspending the sole active OWNER of Pharmacy A'
);

-- ============================================================================
-- TEST 15: Revocation succeeds when another active owner exists
-- ============================================================================
-- Temporarily add a second active owner (User F) to Pharmacy A under admin privileges
INSERT INTO public.profiles (id, full_name, phone)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Co-Owner F (Synthetic)', '+919800000006')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pharmacy_memberships (pharmacy_id, user_id, role, status, invited_by)
VALUES ('11111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'OWNER', 'ACTIVE', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Now User A revokes User F (permitted because User A remains an active OWNER)
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT lives_ok(
  'UPDATE public.pharmacy_memberships 
   SET status = ''REVOKED'' 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' 
     AND user_id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''',
  'TEST 15a: Revoking a co-owner is permitted when at least one active owner remains'
);

-- But now User A cannot revoke themselves because they are again the sole active owner
SELECT throws_ok(
  'UPDATE public.pharmacy_memberships 
   SET status = ''REVOKED'' 
   WHERE pharmacy_id = ''11111111-1111-1111-1111-111111111111'' 
     AND user_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '23514',
  'TEST 15b: Self-revocation is again blocked now that User A is the sole remaining owner'
);

-- ============================================================================
-- TEST 16: Anonymous execution of onboarding RPC is rejected (28000)
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{}';

SELECT throws_ok(
  'SELECT public.create_pharmacy_with_owner(
     ''Anon Chemist'',
     ''99 Street'',
     ''Kolkata'',
     ''700001'',
     ''+919800000000''
   )',
  '28000',
  'TEST 16: Anonymous caller cannot invoke create_pharmacy_with_owner (requires authenticated identity)'
);

-- ============================================================================
-- TEST 17: Staff cannot alter membership roles
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

UPDATE public.pharmacy_memberships 
SET role = 'OWNER' 
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT isnt(
  (SELECT role FROM public.pharmacy_memberships WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'OWNER',
  'TEST 17: Staff member cannot elevate their role to OWNER (RLS policy rejects update)'
);

-- ============================================================================
-- TEST 18: Security helper functions return empty set for unaffiliated user
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';

SELECT is_empty(
  'SELECT * FROM public.get_user_active_pharmacy_ids()',
  'TEST 18: Security helper get_user_active_pharmacy_ids returns 0 rows for unaffiliated user'
);

SELECT * FROM finish();
ROLLBACK;
