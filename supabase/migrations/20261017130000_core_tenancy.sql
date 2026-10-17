-- Medi5 ERP — Stage 2A Migration: Core Tenancy, Profiles, Memberships & Security
-- Migration: 20261017130000_core_tenancy.sql
-- Description: Establishes profiles, pharmacies, pharmacy_memberships with strict RLS,
--              least-privilege table grants, recursion-free security definer helpers,
--              and an atomic tenant onboarding RPC.

-- ============================================================================
-- 1. CORE SCHEMAS & TABLES
-- ============================================================================

-- Ensure pgcrypto or uuid extension is active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table: profiles
-- Application-level user profile linked to Supabase auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(trim(full_name)) >= 1),
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Application user profiles tied 1:1 with auth.users';

-- ----------------------------------------------------------------------------
-- Table: pharmacies
-- Sovereign tenant entity for an independent retail pharmacy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  legal_name text,
  drug_license_number text,
  gstin text,
  address_line1 text NOT NULL CHECK (length(trim(address_line1)) >= 2),
  address_line2 text,
  city text NOT NULL CHECK (length(trim(city)) >= 2),
  state text NOT NULL DEFAULT 'West Bengal',
  pincode text NOT NULL CHECK (length(trim(pincode)) >= 5),
  phone text NOT NULL CHECK (length(trim(phone)) >= 10),
  email text,
  currency text NOT NULL DEFAULT 'INR',
  expiry_threshold_days integer NOT NULL DEFAULT 60 CHECK (expiry_threshold_days >= 1),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pharmacies IS 'Tenant organization entity for independent pharmacies';

-- ----------------------------------------------------------------------------
-- Table: pharmacy_memberships
-- Explicit authorization join between an auth user and a pharmacy tenant
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_memberships (
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

COMMENT ON TABLE public.pharmacy_memberships IS 'Audited user memberships, roles, and status per pharmacy tenant';

-- Performance indexes for tenant and user lookup
CREATE INDEX IF NOT EXISTS idx_memberships_user_status 
  ON public.pharmacy_memberships(user_id, status);

CREATE INDEX IF NOT EXISTS idx_memberships_pharmacy_status 
  ON public.pharmacy_memberships(pharmacy_id, status);

-- ============================================================================
-- 2. RECURSION-FREE SECURITY DEFINER HELPERS
-- ============================================================================
-- These helpers query membership state under SECURITY DEFINER with a fixed search_path.
-- This guarantees zero RLS recursion when policies evaluate tenant membership.

-- Returns pharmacy IDs where the calling user has an ACTIVE membership
CREATE OR REPLACE FUNCTION public.get_user_active_pharmacy_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pharmacy_id
  FROM public.pharmacy_memberships
  WHERE user_id = auth.uid()
    AND status = 'ACTIVE';
$$;

COMMENT ON FUNCTION public.get_user_active_pharmacy_ids IS 'Returns active tenant pharmacy IDs for the current auth.uid()';

-- Returns pharmacy IDs where the calling user has an active OWNER or MANAGER role
CREATE OR REPLACE FUNCTION public.get_user_managed_pharmacy_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pharmacy_id
  FROM public.pharmacy_memberships
  WHERE user_id = auth.uid()
    AND role IN ('OWNER', 'MANAGER')
    AND status = 'ACTIVE';
$$;

COMMENT ON FUNCTION public.get_user_managed_pharmacy_ids IS 'Returns pharmacy IDs where current user is active OWNER or MANAGER';

-- Returns pharmacy IDs where the calling user is an active OWNER
CREATE OR REPLACE FUNCTION public.get_user_owner_pharmacy_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pharmacy_id
  FROM public.pharmacy_memberships
  WHERE user_id = auth.uid()
    AND role = 'OWNER'
    AND status = 'ACTIVE';
$$;

COMMENT ON FUNCTION public.get_user_owner_pharmacy_ids IS 'Returns pharmacy IDs where current user is an active OWNER';

-- ============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_memberships ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Policies for: profiles
-- ----------------------------------------------------------------------------
-- Any authenticated user can read their own profile
CREATE POLICY "profiles_select_own" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated 
  USING (id = auth.uid());

-- Any authenticated user can view profiles of co-workers in the same active pharmacy
CREATE POLICY "profiles_select_coworkers" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated 
  USING (
    id IN (
      SELECT m.user_id 
      FROM public.pharmacy_memberships m
      WHERE m.pharmacy_id IN (SELECT public.get_user_active_pharmacy_ids())
        AND m.status = 'ACTIVE'
    )
  );

-- Users can only insert their own profile
CREATE POLICY "profiles_insert_own" 
  ON public.profiles 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" 
  ON public.profiles 
  FOR UPDATE 
  TO authenticated 
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies for: pharmacies
-- ----------------------------------------------------------------------------
-- Active members can read their pharmacy details
CREATE POLICY "pharmacies_select_member" 
  ON public.pharmacies 
  FOR SELECT 
  TO authenticated 
  USING (id IN (SELECT public.get_user_active_pharmacy_ids()));

-- Only active owners can update their pharmacy details
CREATE POLICY "pharmacies_update_owner" 
  ON public.pharmacies 
  FOR UPDATE 
  TO authenticated 
  USING (id IN (SELECT public.get_user_owner_pharmacy_ids()))
  WITH CHECK (id IN (SELECT public.get_user_owner_pharmacy_ids()));

-- Direct INSERT and DELETE on pharmacies are prohibited via RLS (and grants below)
-- New pharmacies must be created through the atomic onboarding RPC

-- ----------------------------------------------------------------------------
-- Policies for: pharmacy_memberships
-- ----------------------------------------------------------------------------
-- Users can always view their own membership rows (recursion-free)
CREATE POLICY "memberships_select_own" 
  ON public.pharmacy_memberships 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- Managers and Owners can view all member records for their pharmacies
CREATE POLICY "memberships_select_manager_owner" 
  ON public.pharmacy_memberships 
  FOR SELECT 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_managed_pharmacy_ids()));

-- Owners can update member status (e.g. revoke) or role
CREATE POLICY "memberships_update_owner" 
  ON public.pharmacy_memberships 
  FOR UPDATE 
  TO authenticated 
  USING (pharmacy_id IN (SELECT public.get_user_owner_pharmacy_ids()))
  WITH CHECK (pharmacy_id IN (SELECT public.get_user_owner_pharmacy_ids()));

-- Direct INSERT and DELETE on memberships are prohibited via RLS
-- Memberships are created via onboarding RPC or verified invite RPC

-- ----------------------------------------------------------------------------
-- Trigger Function: enforce_last_active_owner
-- Invariant: Every pharmacy must retain at least one active OWNER.
-- Concurrency: Serializes ownership changes by locking the parent pharmacy row FOR UPDATE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_last_active_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining_owners integer;
BEGIN
  -- Evaluate only when an ACTIVE OWNER row is being demoted, revoked, suspended, or deleted
  IF (OLD.role = 'OWNER' AND OLD.status = 'ACTIVE') THEN
    IF (TG_OP = 'DELETE' OR NEW.role != 'OWNER' OR NEW.status != 'ACTIVE') THEN
      -- Serialize concurrent owner modifications for this tenant
      PERFORM 1 FROM public.pharmacies WHERE id = OLD.pharmacy_id FOR UPDATE;

      -- Count remaining active owners in this pharmacy excluding the affected row
      SELECT count(*) INTO v_remaining_owners
      FROM public.pharmacy_memberships
      WHERE pharmacy_id = OLD.pharmacy_id
        AND role = 'OWNER'
        AND status = 'ACTIVE'
        AND id != OLD.id;

      IF v_remaining_owners < 1 THEN
        RAISE EXCEPTION 'Tenancy invariant violation: Cannot revoke, suspend, or demote the last active OWNER of pharmacy %', OLD.pharmacy_id
          USING ERRCODE = '23514'; -- check_violation
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_last_active_owner IS 'Prevents revoking, suspending, or demoting the final active OWNER of a pharmacy, serializing concurrent updates';

DROP TRIGGER IF EXISTS trg_enforce_last_active_owner ON public.pharmacy_memberships;
CREATE TRIGGER trg_enforce_last_active_owner
  BEFORE UPDATE OR DELETE ON public.pharmacy_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_last_active_owner();

-- ============================================================================
-- 4. ATOMIC TENANT ONBOARDING RPC
-- ============================================================================
-- Securely bootstraps a new pharmacy and binds the calling user as initial OWNER.
-- Executable only by authenticated users; derives identity strictly from auth.uid().

CREATE OR REPLACE FUNCTION public.create_pharmacy_with_owner(
  p_name text,
  p_address_line1 text,
  p_city text,
  p_pincode text,
  p_phone text,
  p_state text DEFAULT 'West Bengal',
  p_address_line2 text DEFAULT NULL,
  p_drug_license_number text DEFAULT NULL,
  p_gstin text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_pharmacy_id uuid;
  v_membership_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Validate authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: Must be signed in to create a pharmacy'
      USING ERRCODE = '28000';
  END IF;

  -- 2. Input validation
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Validation error: Pharmacy name must be at least 2 characters'
      USING ERRCODE = '22000';
  END IF;

  IF p_address_line1 IS NULL OR length(trim(p_address_line1)) < 2 THEN
    RAISE EXCEPTION 'Validation error: Address line 1 is required'
      USING ERRCODE = '22000';
  END IF;

  IF p_city IS NULL OR length(trim(p_city)) < 2 THEN
    RAISE EXCEPTION 'Validation error: City is required'
      USING ERRCODE = '22000';
  END IF;

  IF p_pincode IS NULL OR length(trim(p_pincode)) < 5 THEN
    RAISE EXCEPTION 'Validation error: Valid postal pincode is required'
      USING ERRCODE = '22000';
  END IF;

  IF p_phone IS NULL OR length(trim(p_phone)) < 10 THEN
    RAISE EXCEPTION 'Validation error: Valid 10-digit phone number is required'
      USING ERRCODE = '22000';
  END IF;

  -- 3. Atomic pharmacy insertion
  INSERT INTO public.pharmacies (
    name,
    address_line1,
    address_line2,
    city,
    state,
    pincode,
    phone,
    email,
    drug_license_number,
    gstin,
    status
  ) VALUES (
    trim(p_name),
    trim(p_address_line1),
    trim(p_address_line2),
    trim(p_city),
    trim(coalesce(p_state, 'West Bengal')),
    trim(p_pincode),
    trim(p_phone),
    trim(p_email),
    trim(p_drug_license_number),
    trim(p_gstin),
    'ACTIVE'
  )
  RETURNING id INTO v_pharmacy_id;

  -- 4. Atomic owner membership insertion
  INSERT INTO public.pharmacy_memberships (
    pharmacy_id,
    user_id,
    role,
    status,
    invited_by
  ) VALUES (
    v_pharmacy_id,
    v_user_id,
    'OWNER',
    'ACTIVE',
    v_user_id
  )
  RETURNING id INTO v_membership_id;

  -- 5. Return confirmed payload
  v_result := jsonb_build_object(
    'success', true,
    'pharmacy_id', v_pharmacy_id,
    'membership_id', v_membership_id,
    'role', 'OWNER',
    'status', 'ACTIVE'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_pharmacy_with_owner IS 'Atomically bootstraps a pharmacy tenant and designates auth.uid() as the sole initial OWNER';

-- ============================================================================
-- 5. LEAST-PRIVILEGE GRANTS
-- ============================================================================

-- Revoke all public privileges
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.pharmacies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.pharmacy_memberships FROM PUBLIC, anon;

-- anon receives no access
-- authenticated receives selective access governed by RLS
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.pharmacies TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.pharmacy_memberships TO authenticated;

-- Direct DELETE is revoked for authenticated users on tenancy tables
REVOKE DELETE ON TABLE public.pharmacies FROM authenticated;
REVOKE DELETE ON TABLE public.pharmacy_memberships FROM authenticated;

-- Function execution grants
GRANT EXECUTE ON FUNCTION public.get_user_active_pharmacy_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_managed_pharmacy_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_owner_pharmacy_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pharmacy_with_owner(text, text, text, text, text, text, text, text, text, text) TO authenticated;
