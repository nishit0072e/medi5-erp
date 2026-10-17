-- Medi5 ERP — Synthetic Seed Fixtures for Local Testing
-- WARNING: All data below is synthetic. Never use real patient or business records.

-- Synthetic UUIDs for test users (simulating auth.users)
-- User A: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (Owner of Pharmacy A)
-- User B: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb (Staff of Pharmacy A)
-- User C: cccccccc-cccc-cccc-cccc-cccccccccccc (Owner of Pharmacy B)
-- User D: dddddddd-dddd-dddd-dddd-dddddddddddd (Unaffiliated Authenticated User)
-- User E: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee (Revoked former member of Pharmacy A)

-- Insert synthetic profiles
INSERT INTO public.profiles (id, full_name, phone)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nandan Owner (Synthetic)', '+919800000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Subhas Staff (Synthetic)', '+919800000002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sadhana Owner (Synthetic)', '+919800000003'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Unaffiliated User (Synthetic)', '+919800000004'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Revoked Employee (Synthetic)', '+919800000005')
ON CONFLICT (id) DO NOTHING;

-- Insert synthetic pharmacies
-- Pharmacy A (11111111-1111-1111-1111-111111111111): Nandan Pharmacy, Kolkata
-- Pharmacy B (22222222-2222-2222-2222-222222222222): Sadhana Medical, Howrah
INSERT INTO public.pharmacies (
  id, name, legal_name, drug_license_number, gstin, address_line1, city, state, pincode, phone, status
) VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'Nandan Pharmacy',
    'Nandan Healthcare Retail LLP',
    'WB-KOL-20B-123456',
    '19AAACN1234A1Z5',
    '12 Bidhan Sarani',
    'Kolkata',
    'West Bengal',
    '700006',
    '+919830011111',
    'ACTIVE'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Sadhana Medical',
    'Sadhana Pharma Enterprise',
    'WB-HWH-20B-789012',
    '19AABCS5678B1Z2',
    '45 GT Road',
    'Howrah',
    'West Bengal',
    '711101',
    '+919830022222',
    'ACTIVE'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert synthetic memberships
INSERT INTO public.pharmacy_memberships (pharmacy_id, user_id, role, status, invited_by)
VALUES 
  -- User A is OWNER of Pharmacy A
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OWNER', 'ACTIVE', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- User B is STAFF of Pharmacy A
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'STAFF', 'ACTIVE', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- User C is OWNER of Pharmacy B
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'OWNER', 'ACTIVE', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  -- User E is REVOKED former staff of Pharmacy A
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'STAFF', 'REVOKED', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (pharmacy_id, user_id) DO UPDATE 
SET role = EXCLUDED.role, status = EXCLUDED.status;
