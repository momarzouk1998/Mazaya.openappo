-- =============================================
-- Mazaya Furniture - Full Database Schema
-- Run this ONCE in the Supabase SQL editor.
-- Safe to re-run (idempotent).
-- =============================================

-- 0. Schema + search path
CREATE SCHEMA IF NOT EXISTS mazaya;
SET search_path TO mazaya, public;

-- =============================================
-- Tables without external dependencies
-- =============================================

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'نقدي' CHECK (payment_type IN ('نقدي', 'تحويل', 'كلاهما')),
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accessory_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'أخرى' CHECK (type IN ('ألوميتال', 'تنجيد', 'أخرى')),
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Tables that depend on existing tables
-- =============================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_name TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL DEFAULT 'تصنيع جديد' CHECK (order_type IN ('تصنيع جديد', 'صيانة')),
  parent_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  duration_days INTEGER,
  status TEXT NOT NULL DEFAULT 'مفتوح' CHECK (status IN ('مفتوح', 'قيد التنفيذ', 'مكتمل', 'تم التسليم')),
  boards_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  accessories_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  installation_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  internal_transport_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  external_transport_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  factory_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_total DECIMAL(12,2) GENERATED ALWAYS AS (
    boards_cost + accessories_cost + installation_cost +
    internal_transport_cost + external_transport_cost + factory_commission
  ) STORED,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boards_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  quantity_in DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  linked_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_remaining DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, code)
);

CREATE TABLE IF NOT EXISTS accessories_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  accessory_type TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  quantity_in DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  linked_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_remaining DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, code)
);

CREATE TABLE IF NOT EXISTS order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_category TEXT NOT NULL CHECK (item_category IN ('board', 'accessory')),
  item_id UUID NOT NULL,
  quantity_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity_used * unit_price_snapshot) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_external_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL DEFAULT 'أخرى' CHECK (work_type IN ('ألوميتال', 'تنجيد', 'أخرى')),
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('مشتريات', 'دفعة واردة من معرض', 'دفعة صادرة لمورد', 'تحويل تمريري', 'نثريات')),
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل')),
  party_id UUID,
  party_type TEXT CHECK (party_type IN ('supplier', 'branch', 'contractor')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  is_pass_through BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS overhead_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'branch')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Admin permissions table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id uuid primary key references profiles(id) on delete cascade,
  perm_dashboard      boolean not null default true,
  perm_orders         boolean not null default true,
  perm_journal        boolean not null default true,
  perm_reports        boolean not null default true,
  perm_inventory      boolean not null default true,
  perm_suppliers      boolean not null default true,
  perm_customers      boolean not null default true,
  perm_branches       boolean not null default true,
  perm_contractors    boolean not null default true,
  perm_overhead       boolean not null default true,
  perm_admin_users    boolean not null default true,
  perm_material_types boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- Migration: fix existing tables (safe to re-run)
-- =============================================
DO $$ BEGIN ALTER TABLE boards_inventory      ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';       EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';       EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE boards_inventory      ALTER COLUMN total_price      DROP EXPRESSION;                EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE accessories_inventory ALTER COLUMN total_price      DROP EXPRESSION;                EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining DROP EXPRESSION;             EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining DROP EXPRESSION;             EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TABLE boards_inventory      ALTER COLUMN total_price      SET DEFAULT 0;                  EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE accessories_inventory ALTER COLUMN total_price      SET DEFAULT 0;                  EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining SET DEFAULT 0;               EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining SET DEFAULT 0;               EXCEPTION WHEN others THEN null; END $$;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_boards_inventory_supplier ON boards_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_boards_inventory_code ON boards_inventory(code);
CREATE INDEX IF NOT EXISTS idx_boards_inventory_material ON boards_inventory(material_type);
CREATE INDEX IF NOT EXISTS idx_accessories_inventory_supplier ON accessories_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accessories_inventory_code ON accessories_inventory(code);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_materials_order ON order_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_order_materials_item ON order_materials(item_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =============================================
-- Row Level Security — Enable on all tables
-- =============================================
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards_inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_external_work   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE overhead_expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions     ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS helper functions (SECURITY DEFINER)
-- =============================================

CREATE OR REPLACE FUNCTION mazaya.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = mazaya, public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION mazaya.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = mazaya, public
AS $$ SELECT role FROM profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION mazaya.current_user_branch_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = mazaya, public
AS $$ SELECT branch_id FROM profiles WHERE id = auth.uid(); $$;

GRANT EXECUTE ON FUNCTION mazaya.is_admin()               TO authenticated;
GRANT EXECUTE ON FUNCTION mazaya.current_user_role()      TO authenticated;
GRANT EXECUTE ON FUNCTION mazaya.current_user_branch_id() TO authenticated;

-- =============================================
-- RLS policies — use is_admin() instead of auth.jwt()
-- =============================================

-- profiles
DROP POLICY IF EXISTS "Admin full access"        ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users update own profile"  ON profiles;
DROP POLICY IF EXISTS "Admins manage profiles"   ON profiles;

CREATE POLICY "Admins manage profiles"   ON profiles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- admin_permissions
DROP POLICY IF EXISTS "Admin full access"             ON admin_permissions;
DROP POLICY IF EXISTS "Users view own permissions"     ON admin_permissions;

CREATE POLICY "Admin full access"            ON admin_permissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own permissions"   ON admin_permissions FOR SELECT USING (auth.uid() = user_id);

-- All other tables: admin full access
DO $$
DECLARE t TEXT; tables TEXT[] := ARRAY['suppliers','material_types','accessory_types','branches','customers','boards_inventory','accessories_inventory','orders','order_materials','contractors','order_external_work','journal_entries','overhead_expenses'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON %I', t);
    EXECUTE format($f$ CREATE POLICY "Admin full access" ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin()) $f$, t);
  END LOOP;
END $$;

-- Branch user policies (read-only, scoped to their branch)
DROP POLICY IF EXISTS "Branch view orders"    ON orders;
DROP POLICY IF EXISTS "Branch view customers" ON customers;
DROP POLICY IF EXISTS "Branch view branches"  ON branches;

CREATE POLICY "Branch view orders"    ON orders    FOR SELECT USING (current_user_role() = 'branch' AND branch_id = current_user_branch_id());
CREATE POLICY "Branch view customers" ON customers FOR SELECT USING (current_user_role() = 'branch' AND branch_id = current_user_branch_id());
CREATE POLICY "Branch view branches"  ON branches  FOR SELECT USING (current_user_role() = 'branch' AND id = current_user_branch_id());

-- =============================================
-- admin_permissions triggers + helper
-- =============================================

CREATE OR REPLACE FUNCTION mazaya.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN new.updated_at = now(); return new; END; $$;

DROP TRIGGER IF EXISTS trg_touch_admin_permissions ON admin_permissions;
CREATE TRIGGER trg_touch_admin_permissions
  BEFORE UPDATE ON admin_permissions
  FOR EACH ROW EXECUTE FUNCTION mazaya.touch_updated_at();

CREATE OR REPLACE FUNCTION mazaya.get_my_permissions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = mazaya, public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
      'dashboard', perm_dashboard, 'orders', perm_orders, 'journal', perm_journal,
      'reports', perm_reports, 'inventory', perm_inventory, 'suppliers', perm_suppliers,
      'customers', perm_customers, 'branches', perm_branches, 'contractors', perm_contractors,
      'overhead', perm_overhead, 'admin_users', perm_admin_users, 'material_types', perm_material_types
    ) FROM admin_permissions WHERE user_id = auth.uid()),
    jsonb_build_object(
      'dashboard',true,'orders',true,'journal',true,'reports',true,
      'inventory',true,'suppliers',true,'customers',true,'branches',true,
      'contractors',true,'overhead',true,'admin_users',true,'material_types',true)
  );
$$;

GRANT EXECUTE ON FUNCTION mazaya.get_my_permissions() TO authenticated;

-- =============================================
-- App functions & triggers
-- =============================================

CREATE OR REPLACE FUNCTION update_order_costs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET
    boards_cost = (SELECT COALESCE(SUM(line_total), 0) FROM order_materials WHERE order_id = COALESCE(NEW.order_id, OLD.order_id) AND item_category = 'board'),
    accessories_cost = (SELECT COALESCE(SUM(line_total), 0) FROM order_materials WHERE order_id = COALESCE(NEW.order_id, OLD.order_id) AND item_category = 'accessory')
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_order_material_change ON order_materials;
CREATE TRIGGER after_order_material_change
  AFTER INSERT OR UPDATE OR DELETE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION update_order_costs();

CREATE OR REPLACE FUNCTION update_inventory_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_category = 'board' THEN
    UPDATE boards_inventory SET quantity_used = (SELECT COALESCE(SUM(quantity_used), 0) FROM order_materials WHERE item_id = NEW.item_id AND item_category = 'board')
    WHERE id = NEW.item_id;
  ELSIF NEW.item_category = 'accessory' THEN
    UPDATE accessories_inventory SET quantity_used = (SELECT COALESCE(SUM(quantity_used), 0) FROM order_materials WHERE item_id = NEW.item_id AND item_category = 'accessory')
    WHERE id = NEW.item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS after_order_material_usage ON order_materials;
CREATE TRIGGER after_order_material_usage
  AFTER INSERT OR UPDATE OR DELETE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION update_inventory_usage();

CREATE OR REPLACE FUNCTION check_inventory_availability()
RETURNS TRIGGER AS $$
DECLARE remaining DECIMAL(10,2);
BEGIN
  IF NEW.item_category = 'board' THEN
    SELECT quantity_remaining INTO remaining FROM boards_inventory WHERE id = NEW.item_id;
  ELSE
    SELECT quantity_remaining INTO remaining FROM accessories_inventory WHERE id = NEW.item_id;
  END IF;
  IF remaining < NEW.quantity_used THEN
    RAISE WARNING 'الكمية المستخدمة (%) تتجاوز المتبقي (%)', NEW.quantity_used, remaining;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_order_material_insert ON order_materials;
CREATE TRIGGER before_order_material_insert
  BEFORE INSERT OR UPDATE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION check_inventory_availability();

CREATE OR REPLACE FUNCTION auto_create_purchase_journal_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journal_entries (date, entry_type, description, amount, payment_method, party_id, party_type, notes)
  VALUES (NEW.date_added, 'مشتريات', 'شراء ' || NEW.item_name || ' - ' || (SELECT name FROM suppliers WHERE id = NEW.supplier_id), NEW.total_price, 'نقدي', NEW.supplier_id, 'supplier', 'تلقائي من المخزون');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Seed admin user
-- =============================================

set search_path to mazaya, public, auth, extensions;

do $$
declare
  v_user_id  uuid;
  v_email    constant text := 'backupapps1998@gmail.com';
  v_password constant text := '123456';
  v_hash     text;
begin
  select id into v_user_id from auth.users where email = v_email limit 1;

  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email, v_hash,
      now(), jsonb_build_object('provider','email','providers', array['email']),
      jsonb_build_object('name','Backup Admin'), now(), now(), '', '', '', '');

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  else
    update auth.users set encrypted_password = v_hash, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
    where id = v_user_id;
  end if;

  insert into profiles (id, name, email, role, branch_id)
  values (v_user_id, 'Backup Admin', v_email, 'admin', null)
  on conflict (id) do update set name = excluded.name, email = excluded.email, role = 'admin', branch_id = null;
end $$;

insert into admin_permissions (user_id, perm_dashboard, perm_orders, perm_journal, perm_reports,
  perm_inventory, perm_suppliers, perm_customers, perm_branches,
  perm_contractors, perm_overhead, perm_admin_users, perm_material_types)
select id, true, true, true, true, true, true, true, true, true, true, true, true
from profiles where email = 'backupapps1998@gmail.com'
on conflict (user_id) do nothing;

set search_path to mazaya, public;

-- =============================================
-- Seed data (オプション — delete or comment if not needed)
-- =============================================

truncate table order_external_work  restart identity cascade;
truncate table order_materials      restart identity cascade;
truncate table journal_entries      restart identity cascade;
truncate table overhead_expenses    restart identity cascade;
truncate table orders               restart identity cascade;
truncate table boards_inventory     restart identity cascade;
truncate table accessories_inventory restart identity cascade;
truncate table customers            restart identity cascade;
truncate table contractors          restart identity cascade;
truncate table suppliers            restart identity cascade;
truncate table branches             restart identity cascade;
truncate table material_types       restart identity cascade;
truncate table accessory_types      restart identity cascade;

insert into material_types (name) values
  ('MDF عادي/ساده'), ('MDF أخضر'), ('MDF مطلي / مكثف'), ('كونتر ساده'),
  ('كونتر مونيدج'), ('بيروديوم'), ('سندوتش')
on conflict (name) do nothing;

insert into accessory_types (name) values
  ('مفصلات - بلوم (Blum)'), ('مفصلات - عادي'), ('سكك دُرج'), ('مجاري دُرج'),
  ('جوانب / قواعد'), ('كاوتش (مطاطات)'), ('أخرى')
on conflict (name) do nothing;

insert into branches (id, name, location, phone) values
  ('11111111-1111-1111-1111-111111111111', 'معرض دمياط',       'دمياط - شارع الكورنيش',   '057-222-1001'),
  ('22222222-2222-2222-2222-222222222222', 'معرض القاهرة',     'القاهرة - مدينة نصر',       '02-244-22002'),
  ('33333333-3333-3333-3333-333333333333', 'معرض الإسكندرية',  'الإسكندرية - سموحة',       '03-422-33003'),
  ('44444444-4444-4444-4444-444444444444', 'معرض المنصورة',    'المنصورة - شارع الجمهورية', '050-233-44004')
on conflict (id) do nothing;

insert into suppliers (id, name, payment_type, phone, notes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'مورد الألواح الذهبي',   'تحويل',  '0100-111-1001', 'مورد رئيسي للألواح'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'مؤسسة الإكسسوارات',      'نقدي',   '0100-222-2002', 'إكسسوارات متنوعة'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'الشركة المصرية للأخشاب', 'كلاهما', '0100-333-3003', 'مورد كونتر ومونة'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'مورد الكاوتش',           'نقدي',   '0100-444-4004', ''),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'مورد الحديد',            'تحويل',  '0100-555-5005', '')
on conflict (id) do nothing;

insert into customers (id, name, branch_id, phone, address) values
  ('10000001-0000-0000-0000-000000000001', 'أحمد محمد علي',        '11111111-1111-1111-1111-111111111111', '0100-901-1001', 'دمياط - حي ثان'),
  ('10000002-0000-0000-0000-000000000002', 'محمود السيد إبراهيم',   '11111111-1111-1111-1111-111111111111', '0100-901-1002', 'دمياط - حي أول'),
  ('10000003-0000-0000-0000-000000000003', 'سامي عبد الرحمن',        '22222222-2222-2222-2222-222222222222', '0100-901-1003', 'القاهرة - التجمع'),
  ('10000004-0000-0000-0000-000000000004', 'كريم حسن',              '22222222-2222-2222-2222-222222222222', '0100-901-1004', 'القاهرة - الشروق'),
  ('10000005-0000-0000-0000-000000000005', 'يوسف ناجي',             '33333333-3333-3333-3333-333333333333', '0100-901-1005', 'الإسكندرية - سيدي جابر'),
  ('10000006-0000-0000-0000-000000000006', 'خالد عبد الله',         '44444444-4444-4444-4444-444444444444', '0100-901-1006', 'المنصورة - حي الجامعة'),
  ('10000007-0000-0000-0000-000000000007', 'عمر طارق',              '11111111-1111-1111-1111-111111111111', '0100-901-1007', 'دمياط - راس البر'),
  ('10000008-0000-0000-0000-000000000008', 'حسام مصطفى',            '33333333-3333-3333-3333-333333333333', '0100-901-1008', 'الإسكندرية - المنتزه')
on conflict (id) do nothing;

insert into contractors (id, name, type, phone) values
  ('c1111111-1111-1111-1111-111111111111', 'ورشة الألوميتال الحديثة', 'ألوميتال', '0111-111-1001'),
  ('c2222222-2222-2222-2222-222222222222', 'مقاول التنجيد أبو خالد',  'تنجيد',    '0111-222-2002'),
  ('c3333333-3333-3333-3333-333333333333', 'ورشة القصارة',             'أخرى',     '0111-333-3003')
on conflict (id) do nothing;

insert into boards_inventory (item_name, material_type, unit, code, supplier_id, unit_price, quantity_in, total_price, quantity_used, quantity_remaining, date_added, notes) values
  ('لوح MDF أبيض 18 مم',     'MDF عادي/ساده',   'لوح', 'BRD-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 850,  120,  102000, 0, 120, current_date - 30, ''),
  ('لوح MDF أخضر 18 مم',     'MDF أخضر',        'لوح', 'BRD-002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1050,  80,   84000, 0,  80, current_date - 28, ''),
  ('لوح كونتر ساده 18 مم',   'كونتر ساده',      'لوح', 'BRD-003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1450,  60,   87000, 0,  60, current_date - 25, ''),
  ('لوح كونتر مونيدج 18 مم', 'كونتر مونيدج',    'لوح', 'BRD-004', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1750,  40,   70000, 0,  40, current_date - 20, ''),
  ('لوح MDF مطلي أبيض',      'MDF مطلي / مكثف', 'لوح', 'BRD-005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1200,  50,   60000, 0,  50, current_date - 18, ''),
  ('لوح بيروديوم',           'بيروديوم',        'لوح', 'BRD-006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2200,  25,   55000, 0,  25, current_date - 15, ''),
  ('لوح سندوتش 16 مم',       'سندوتش',          'لوح', 'BRD-007', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 900,   70,   63000, 0,  70, current_date - 10, '')
on conflict (supplier_id, code) do nothing;

insert into accessories_inventory (item_name, accessory_type, unit, code, supplier_id, unit_price, quantity_in, total_price, quantity_used, quantity_remaining, date_added, notes) values
  ('مفصلة بلوم هيدرو 110 درجة', 'مفصلات - بلوم (Blum)', 'قطعة', 'ACC-001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 95,  200,  19000, 0, 200, current_date - 30, ''),
  ('سكك درج 45 سم',             'سكك دُرج',             'قطعة', 'ACC-002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 220,  60,  13200, 0,  60, current_date - 28, ''),
  ('مجاري درج تلسكوبى 45 سم',   'مجاري دُرج',           'قطعة', 'ACC-003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 350,  45,  15750, 0,  45, current_date - 25, ''),
  ('مفصلة عادي 35 مم',          'مفصلات - عادي',        'قطعة', 'ACC-004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 18,  300,   5400, 0, 300, current_date - 22, ''),
  ('كاوتش باب',                 'كاوتش (مطاطات)',       'قطعة', 'ACC-005', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 8,   150,   1200, 0, 150, current_date - 20, ''),
  ('قاعدة دولاب',                'جوانب / قواعد',        'قطعة', 'ACC-006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 180,  40,   7200, 0,  40, current_date - 15, ''),
  ('مقبض معدن 128 مم',          'أخرى',                 'قطعة', 'ACC-007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 45,  100,   4500, 0, 100, current_date - 12, '')
on conflict (supplier_id, code) do nothing;

insert into orders (id, order_name, customer_id, branch_id, order_type, start_date, status,
    installation_cost, internal_transport_cost, external_transport_cost, factory_commission, notes) values
  ('a0000001-0000-0000-0000-000000000001', 'مطبخ أحمد محمد - دمياط',  '10000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 25, 'مكتمل',      3000, 500, 800, 4500, ''),
  ('a0000002-0000-0000-0000-000000000002', 'دولاب محمود السيد',       '10000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 20, 'قيد التنفيذ', 2500, 400, 600, 3800, ''),
  ('a0000003-0000-0000-0000-000000000003', 'مطبخ سامي - التجمع',      '10000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'تصنيع جديد', current_date - 18, 'مكتمل',      5000, 700, 1200, 6500, ''),
  ('a0000004-0000-0000-0000-000000000004', 'غرفة نوم كريم',           '10000004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'تصنيع جديد', current_date - 15, 'مفتوح',      4000, 500, 900, 5200, ''),
  ('a0000005-0000-0000-0000-000000000005', 'مكتب يوسف - سيدي جابر',  '10000005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'تصنيع جديد', current_date - 12, 'مكتمل',      3500, 400, 700, 4200, ''),
  ('a0000006-0000-0000-0000-000000000006', 'صيانة خالد - المنصورة',   '10000006-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444444', 'صيانة',     current_date - 10, 'تم التسليم', 1500, 300, 400, 1800, 'صيانة دورية'),
  ('a0000007-0000-0000-0000-000000000007', 'مطبخ عمر - راس البر',     '10000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 8,  'قيد التنفيذ', 4500, 600, 1000, 5500, ''),
  ('a0000008-0000-0000-0000-000000000008', 'مكتبة حسام - المنتزه',    '10000008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'تصنيع جديد', current_date - 5,  'مفتوح',      2000, 300, 500, 2500, '')
on conflict (id) do nothing;

insert into order_materials (order_id, item_category, item_id, quantity_used, unit_price_snapshot) values
  ('a0000001-0000-0000-0000-000000000001', 'board',     (select id from boards_inventory     where code='BRD-001' limit 1), 18, 850),
  ('a0000001-0000-0000-0000-000000000001', 'board',     (select id from boards_inventory     where code='BRD-005' limit 1), 8, 1200),
  ('a0000001-0000-0000-0000-000000000001', 'accessory', (select id from accessories_inventory where code='ACC-001' limit 1), 60, 95),
  ('a0000002-0000-0000-0000-000000000002', 'board',     (select id from boards_inventory     where code='BRD-002' limit 1), 10, 1050),
  ('a0000002-0000-0000-0000-000000000002', 'accessory', (select id from accessories_inventory where code='ACC-002' limit 1), 12, 220),
  ('a0000003-0000-0000-0000-000000000003', 'board',     (select id from boards_inventory     where code='BRD-003' limit 1), 15, 1450),
  ('a0000003-0000-0000-0000-000000000003', 'board',     (select id from boards_inventory     where code='BRD-004' limit 1), 6, 1750),
  ('a0000003-0000-0000-0000-000000000003', 'accessory', (select id from accessories_inventory where code='ACC-001' limit 1), 80, 95),
  ('a0000003-0000-0000-0000-000000000003', 'accessory', (select id from accessories_inventory where code='ACC-003' limit 1), 18, 350),
  ('a0000004-0000-0000-0000-000000000004', 'board',     (select id from boards_inventory     where code='BRD-005' limit 1), 4, 1200),
  ('a0000004-0000-0000-0000-000000000004', 'accessory', (select id from accessories_inventory where code='ACC-004' limit 1), 50, 18),
  ('a0000005-0000-0000-0000-000000000005', 'board',     (select id from boards_inventory     where code='BRD-006' limit 1), 5, 2200),
  ('a0000005-0000-0000-0000-000000000005', 'accessory', (select id from accessories_inventory where code='ACC-007' limit 1), 20, 45),
  ('a0000006-0000-0000-0000-000000000006', 'board',     (select id from boards_inventory     where code='BRD-007' limit 1), 4, 900),
  ('a0000006-0000-0000-0000-000000000006', 'accessory', (select id from accessories_inventory where code='ACC-005' limit 1), 10, 8),
  ('a0000007-0000-0000-0000-000000000007', 'board',     (select id from boards_inventory     where code='BRD-001' limit 1), 12, 850),
  ('a0000007-0000-0000-0000-000000000007', 'board',     (select id from boards_inventory     where code='BRD-002' limit 1), 6, 1050),
  ('a0000007-0000-0000-0000-000000000007', 'accessory', (select id from accessories_inventory where code='ACC-001' limit 1), 40, 95),
  ('a0000008-0000-0000-0000-000000000008', 'board',     (select id from boards_inventory     where code='BRD-005' limit 1), 3, 1200),
  ('a0000008-0000-0000-0000-000000000008', 'accessory', (select id from accessories_inventory where code='ACC-004' limit 1), 30, 18);

insert into order_external_work (order_id, contractor_id, work_type, amount, notes) values
  ('a0000001-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 2500, 'شبابيك ألوميتال للمطبخ'),
  ('a0000003-0000-0000-0000-000000000003', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 3800, 'واجهة ألوميتال'),
  ('a0000003-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'تنجيد',    1800, 'تنجيد كنبة'),
  ('a0000004-0000-0000-0000-000000000004', 'c3333333-3333-3333-3333-333333333333', 'أخرى',     1200, 'قصارة حوائط'),
  ('a0000007-0000-0000-0000-000000000007', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 2200, 'شبابيك ألوميتال');

insert into journal_entries (date, entry_type, description, amount, payment_method, party_id, party_type) values
  (current_date - 30, 'مشتريات',             'شراء ألواح MDF أبيض - مورد الألواح الذهبي', -102000, 'تحويل', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'supplier'),
  (current_date - 28, 'مشتريات',             'شراء ألواح MDF أخضر',                          -84000, 'تحويل', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'supplier'),
  (current_date - 25, 'مشتريات',             'شراء كونتر ساده',                              -87000, 'نقدي',  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'supplier'),
  (current_date - 20, 'مشتريات',             'شراء كونتر مونيدج',                            -70000, 'نقدي',  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'supplier'),
  (current_date - 30, 'مشتريات',             'شراء إكسسوارات متنوعة',                       -19000, 'نقدي',  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'supplier'),
  (current_date - 18, 'دفعة واردة من معرض',  'دفعة من العميل أحمد محمد',                     25000,  'نقدي',  '10000001-0000-0000-0000-000000000001', null),
  (current_date - 16, 'دفعة واردة من معرض',  'دفعة من العميل سامي عبد الرحمن',               40000,  'تحويل', '10000003-0000-0000-0000-000000000003', null),
  (current_date - 10, 'دفعة واردة من معرض',  'دفعة من العميل يوسف ناجي',                    18000,  'نقدي',  '10000005-0000-0000-0000-000000000005', null),
  (current_date - 6,  'دفعة واردة من معرض',  'دفعة من العميل عمر طارق',                     15000,  'نقدي',  '10000007-0000-0000-0000-000000000007', null),
  (current_date - 15, 'نثريات',              'رواتب العمال - نصف الشهر',                    -45000, 'تحويل', null, null),
  (current_date - 1,  'نثريات',              'رواتب العمال - نهاية الشهر',                  -45000, 'تحويل', null, null),
  (current_date - 12, 'نثريات',              'فاتورة كهرباء المصنع',                        -3500,  'نقدي',  null, null),
  (current_date - 8,  'نثريات',              'فاتورة مياه',                                  -800,   'نقدي',  null, null),
  (current_date - 5,  'نثريات',              'صيانة ماكينة',                                -2200,  'نقدي',  null, null),
  (current_date - 3,  'نثريات',              'انتقالات ووقود',                              -1500,  'نقدي',  null, null);

insert into overhead_expenses (date, description, amount, notes) values
  (current_date - 12, 'فاتورة كهرباء المصنع', 3500,  ''),
  (current_date - 8,  'فاتورة مياه',           800,   ''),
  (current_date - 5,  'صيانة ماكينة',         2200,  ''),
  (current_date - 3,  'انتقالات ووقود',       1500,  ''),
  (current_date - 15, 'رواتب - نصف الشهر',   45000,  'شامل كل الأقسام'),
  (current_date - 1,  'رواتب - نهاية الشهر', 45000,  'شامل كل الأقسام');

-- =============================================
-- Verify
-- =============================================
select 'فروع' as نوع, count(*) as العدد from branches
union all select 'موردين',     count(*) from suppliers
union all select 'عملاء',      count(*) from customers
union all select 'ألواح',      count(*) from boards_inventory
union all select 'إكسسوارات',  count(*) from accessories_inventory
union all select 'أوردرات',    count(*) from orders
union all select 'مواد أوردر', count(*) from order_materials
union all select 'يومية',      count(*) from journal_entries
union all select 'نثريات',     count(*) from overhead_expenses;
