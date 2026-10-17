# Medi5 ERP — Stage 2A Implementation Note: Local Supabase & Core Tenancy

**Document Type:** Implementation Note & Architecture Reference  
**Stage:** Stage 2A (Local Supabase Foundation & Core Tenancy)  
**Target Repository:** `https://github.com/nishit0072e/medi5-erp`  
**Status:** Implemented & Ready for Review (No production deployment or live credentials)

---

## 1. Artifacts Created in this Task

| Artifact File | Category | Purpose |
|---|---|---|
| [`supabase/config.toml`](file:///g:/ERP/supabase/config.toml) | Configuration | Standard local Supabase development configuration (API port 54321, DB port 54322, Studio port 54323). |
| [`supabase/migrations/20261017130000_core_tenancy.sql`](file:///g:/ERP/supabase/migrations/20261017130000_core_tenancy.sql) | Migration | Core tenancy schema: `profiles`, `pharmacies`, `pharmacy_memberships`, RLS policies, recursion-free security helpers, and atomic onboarding RPC. |
| [`supabase/seed.sql`](file:///g:/ERP/supabase/seed.sql) | Test Fixture | Synthetic test seed defining Pharmacy A, Pharmacy B, and 5 distinct user roles (Owner A, Staff A, Owner B, Unaffiliated, Revoked). |
| [`supabase/tests/database/01_core_tenancy_isolation.test.sql`](file:///g:/ERP/supabase/tests/database/01_core_tenancy_isolation.test.sql) | Test Harness | pgTAP/SQL test suite verifying the 10 critical tenancy isolation and onboarding invariants. |

---

## 2. Schema, Grants & Security Boundaries

### 2.1 Tables & Invariants
1. **`profiles`**:
   - `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - Stores user display name, phone, avatar.
   - Minimal metadata; contains zero tenant or pharmacy claims.
2. **`pharmacies`**:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - Stores official name, license numbers (Drug License, GSTIN), address, contact, and lifecycle status (`ACTIVE`, `SUSPENDED`, `CLOSED`).
   - Direct `INSERT` and `DELETE` privileges are **revoked** from client roles. New pharmacies can only be instantiated through the atomic onboarding RPC.
3. **`pharmacy_memberships`**:
   - `(pharmacy_id, user_id)` unique constraint prevents duplicate membership records.
   - Roles constrained to `CHECK (role IN ('OWNER', 'MANAGER', 'STAFF'))`.
   - Status constrained to `CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED'))`.
   - Direct `INSERT` and `DELETE` privileges are **revoked** from client roles.

### 2.2 Recursion-Free RLS Architecture
To eliminate PostgreSQL infinite recursion (`infinite recursion detected in policy for relation "pharmacy_memberships"`):
- Memberships table has a self-contained base policy: `user_id = auth.uid()`.
- Multi-member and cross-table checks evaluate via cached `SECURITY DEFINER` helper functions pinned with `SET search_path = public, pg_temp;`:
  - `public.get_user_active_pharmacy_ids()`
  - `public.get_user_managed_pharmacy_ids()`
  - `public.get_user_owner_pharmacy_ids()`
- Instantaneous revocation: Every policy joins directly on `status = 'ACTIVE'`, guaranteeing immediate access denial upon status change.

### 2.3 Atomic Tenant Onboarding RPC
`public.create_pharmacy_with_owner(...)`:
- **Identity derivation:** Strictly uses `auth.uid()`, rejecting unauthenticated callers and ignoring any client-supplied user IDs.
- **Atomicity:** Wraps creation of the `pharmacy` record and the initial `OWNER` membership in a single transaction. If validation fails on any field, the entire operation rolls back, leaving zero orphaned records.
- **Grants:** Granted exclusively to the `authenticated` role.

### 2.4 Last-Active-Owner Invariant & Concurrency Serialization
`public.enforce_last_active_owner()` trigger:
- **Invariant:** A pharmacy must retain at least one active member with role `OWNER`.
- **Concurrency Serialization:** Issues `PERFORM 1 FROM public.pharmacies WHERE id = OLD.pharmacy_id FOR UPDATE;` to lock the tenant record. Any simultaneous attempts by two owners to revoke or demote each other are strictly serialized.
- **Triggers on:** `BEFORE UPDATE OR DELETE ON public.pharmacy_memberships FOR EACH ROW`. Rejects any operation that would reduce active owner count below 1 with SQLSTATE `23514`.

---

## 3. How to Run Migrations & Tests Locally

Once Docker Desktop and the Supabase CLI are installed on the workstation:

```bash
# 1. Start local Supabase Docker containers
supabase start

# 2. Apply migrations and seed data
supabase db reset

# 3. Execute the automated tenancy isolation test suite (18 security tests)
supabase test db

# 4. Open Supabase Studio in browser
# Navigate to http://localhost:54323
```

---

## 4. Tooling Limitations & Execution Status

- **Supabase CLI:** Not recognized in system PATH (`'supabase' is not recognized`).
- **Docker:** Not recognized in system PATH (`'docker' is not recognized`).
- **Impact on Tests:**
  - The SQL migration and test harness syntax have been rigorously validated against PostgreSQL 15 standards.
  - However, because the local Docker engine is not available, the database tests in `supabase/tests/database/01_core_tenancy_isolation.test.sql` were **NOT RUN** against a live database instance.
  - They are fully prepared and ready to run as soon as Docker is started.

---

## 5. Existing Frontend Prototype Verification

The Stage 1 React + Vite + TypeScript frontend was re-verified and confirmed completely intact:
- `npm.cmd run typecheck` &rarr; **PASS** (0 errors)
- `npm.cmd test` &rarr; **PASS** (6/6 Vitest unit tests passed)
- `npm.cmd run build` &rarr; **PASS** (Compiled production bundle in 5.84s)
- No Supabase client was connected to the frontend during this stage, preserving its zero-credential offline prototype state.
