-- =============================================
-- 002_rls_fix.sql
-- Fix Row Level Security so the role is read from mazaya.profiles
-- instead of auth.jwt() ->> 'role' (which is always NULL unless you
-- configured a custom Access Token Hook).
--
-- Run this AFTER 001_schema.sql in the Supabase SQL editor.
-- It is idempotent: safe to re-run.
-- =============================================

SET search_path TO mazaya, public;

-- =============================================
-- Helper functions (SECURITY DEFINER so they can read profiles
-- even when the caller is being checked by RLS).
-- =============================================

-- Returns TRUE if the current auth user is an admin.
CREATE OR REPLACE FUNCTION mazaya.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mazaya, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mazaya.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Returns the role of the current auth user, or NULL if no profile.
CREATE OR REPLACE FUNCTION mazaya.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mazaya, public
AS $$
  SELECT role
  FROM mazaya.profiles
  WHERE id = auth.uid();
$$;

-- Returns the branch_id of the current auth user.
CREATE OR REPLACE FUNCTION mazaya.current_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mazaya, public
AS $$
  SELECT branch_id
  FROM mazaya.profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION mazaya.is_admin()                  TO authenticated;
GRANT EXECUTE ON FUNCTION mazaya.current_user_role()         TO authenticated;
GRANT EXECUTE ON FUNCTION mazaya.current_user_branch_id()    TO authenticated;

-- =============================================
-- Drop ALL old policies (clean slate) and recreate.
-- =============================================

-- profiles
DROP POLICY IF EXISTS "Admin full access"        ON mazaya.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON mazaya.profiles;
DROP POLICY IF EXISTS "Users view own profile"   ON mazaya.profiles;
DROP POLICY IF EXISTS "Users update own profile"  ON mazaya.profiles;

CREATE POLICY "Admins manage profiles"
  ON mazaya.profiles FOR ALL
  USING       (is_admin())
  WITH CHECK  (is_admin());

CREATE POLICY "Users view own profile"
  ON mazaya.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON mazaya.profiles FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- A user is allowed to insert a profile for themselves
-- (covers sign-up flow). Admins are covered by the policy above.
CREATE POLICY "Users insert own profile"
  ON mazaya.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Generic helper to recreate "Admin full access" policies
-- across the rest of the tables.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'suppliers',
    'material_types',
    'accessory_types',
    'branches',
    'customers',
    'boards_inventory',
    'accessories_inventory',
    'orders',
    'order_materials',
    'contractors',
    'order_external_work',
    'journal_entries',
    'overhead_expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON mazaya.%I', t);
    EXECUTE format($f$
      CREATE POLICY "Admin full access" ON mazaya.%I
        FOR ALL
        USING      (is_admin())
        WITH CHECK (is_admin())
    $f$, t);
  END LOOP;
END $$;

-- =============================================
-- Branch user policies (read-only, scoped to their branch)
-- =============================================
DROP POLICY IF EXISTS "Branch view orders"    ON mazaya.orders;
DROP POLICY IF EXISTS "Branch view customers" ON mazaya.customers;
DROP POLICY IF EXISTS "Branch view branches"  ON mazaya.branches;

CREATE POLICY "Branch view orders"
  ON mazaya.orders FOR SELECT
  USING (
    current_user_role() = 'branch'
    AND branch_id = current_user_branch_id()
  );

CREATE POLICY "Branch view customers"
  ON mazaya.customers FOR SELECT
  USING (
    current_user_role() = 'branch'
    AND branch_id = current_user_branch_id()
  );

CREATE POLICY "Branch view branches"
  ON mazaya.branches FOR SELECT
  USING (
    current_user_role() = 'branch'
    AND id = current_user_branch_id()
  );

-- =============================================
-- Done. The schema is now self-consistent: profiles.role
-- is the single source of truth for permissions.
-- =============================================
