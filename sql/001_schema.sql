-- =============================================
-- Mazaya Furniture - Factory Management System
-- Database Schema for Supabase (PostgreSQL)
-- =============================================

-- 0. Create dedicated schema and set search path
CREATE SCHEMA IF NOT EXISTS mazaya;
SET search_path TO mazaya, public;

-- 0. Extensions (none required — gen_random_uuid is built-in)

-- =============================================
-- Tables without external dependencies (ordered first)
-- =============================================

-- 1. Branches (المعارض / الفروع)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Suppliers (الموردين)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'نقدي' CHECK (payment_type IN ('نقدي', 'تحويل', 'كلاهما')),
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Material Types (أنواع الخامات - قابلة للتعديل)
CREATE TABLE IF NOT EXISTS material_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Accessory Types (أنواع الاكسسوارات - قابلة للتعديل)
CREATE TABLE IF NOT EXISTS accessory_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. External Contractors (المقاولين الخارجيين)
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

-- 6. Customers (العملاء) — depends on branches
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

-- 7. Orders (الأوردرات) — depends on customers, branches
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
  -- Cost breakdown
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

-- 8. Boards Inventory (مخزون الألواح) — depends on suppliers, orders
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

-- 9. Accessories Inventory (مخزون الاكسسوارات) — depends on suppliers, orders
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

-- 10. Order Materials (مواد الأوردر - Many-to-Many) — depends on orders
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

-- 11. Order External Work (الأعمال الخارجية للأوردر) — depends on orders, contractors
CREATE TABLE IF NOT EXISTS order_external_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL DEFAULT 'أخرى' CHECK (work_type IN ('ألوميتال', 'تنجيد', 'أخرى')),
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Journal Entries (اليومية المالية) — depends on orders
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

-- 13. Overhead Expenses (النثريات) — depends on journal_entries
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

-- 14. Profiles (extends Supabase Auth users) — depends on branches
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
-- Migration: fix existing tables (safe to re-run)
-- =============================================
DO $$ BEGIN
  ALTER TABLE boards_inventory     ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE boards_inventory      ALTER COLUMN total_price      DROP EXPRESSION;
EXCEPTION WHEN OTHERS THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE accessories_inventory ALTER COLUMN total_price      DROP EXPRESSION;
EXCEPTION WHEN OTHERS THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining DROP EXPRESSION;
EXCEPTION WHEN OTHERS THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining DROP EXPRESSION;
EXCEPTION WHEN OTHERS THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE boards_inventory      ALTER COLUMN total_price      SET DEFAULT 0;
EXCEPTION WHEN others THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE accessories_inventory ALTER COLUMN total_price      SET DEFAULT 0;
EXCEPTION WHEN others THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining SET DEFAULT 0;
EXCEPTION WHEN others THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining SET DEFAULT 0;
EXCEPTION WHEN others THEN null;
END $$;

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
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_external_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE overhead_expenses ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "Admin full access" ON profiles;
CREATE POLICY "Admin full access" ON profiles FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
-- Authenticated users can insert/read/update their own profile
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (
  auth.uid() = id
);
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (
  auth.uid() = id
);
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id
);
DROP POLICY IF EXISTS "Admin full access" ON suppliers;
CREATE POLICY "Admin full access" ON suppliers FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON material_types;
CREATE POLICY "Admin full access" ON material_types FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON accessory_types;
CREATE POLICY "Admin full access" ON accessory_types FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON branches;
CREATE POLICY "Admin full access" ON branches FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON customers;
CREATE POLICY "Admin full access" ON customers FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON boards_inventory;
CREATE POLICY "Admin full access" ON boards_inventory FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON accessories_inventory;
CREATE POLICY "Admin full access" ON accessories_inventory FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON orders;
CREATE POLICY "Admin full access" ON orders FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON order_materials;
CREATE POLICY "Admin full access" ON order_materials FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON contractors;
CREATE POLICY "Admin full access" ON contractors FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON order_external_work;
CREATE POLICY "Admin full access" ON order_external_work FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON journal_entries;
CREATE POLICY "Admin full access" ON journal_entries FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
DROP POLICY IF EXISTS "Admin full access" ON overhead_expenses;
CREATE POLICY "Admin full access" ON overhead_expenses FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);

-- Branch users can only view orders & customers of their branch
DROP POLICY IF EXISTS "Branch view orders" ON orders;
CREATE POLICY "Branch view orders" ON orders FOR SELECT USING (
  auth.jwt() ->> 'role' = 'branch'
  AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Branch view customers" ON customers;
CREATE POLICY "Branch view customers" ON customers FOR SELECT USING (
  auth.jwt() ->> 'role' = 'branch'
  AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Branch view branches" ON branches;
CREATE POLICY "Branch view branches" ON branches FOR SELECT USING (
  auth.jwt() ->> 'role' = 'branch'
  AND id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);

-- =============================================
-- Seed Data: Initial Material & Accessory Types
-- =============================================
INSERT INTO material_types (name) VALUES
  ('MDF عادي/ساده'),
  ('MDF أخضر'),
  ('MDF مطلي / مكثف'),
  ('كونتر ساده'),
  ('كونتر مونيدج'),
  ('بيروديوم'),
  ('سندوتش')
ON CONFLICT (name) DO NOTHING;

INSERT INTO accessory_types (name) VALUES
  ('مفصلات - بلوم (Blum)'),
  ('مفصلات - عادي'),
  ('سكك دُرج'),
  ('مجاري دُرج'),
  ('جوانب / قواعد'),
  ('كاوتش (مطاطات)'),
  ('أخرى')
ON CONFLICT (name) DO NOTHING;

-- Seed: Initial 4 Branches
INSERT INTO branches (name, location)
SELECT * FROM (VALUES
  ('معرض دمياط', 'دمياط'),
  ('معرض القاهرة', 'القاهرة'),
  ('معرض الإسكندرية', 'الإسكندرية'),
  ('معرض المنصورة', 'المنصورة')
) AS v(name, location)
WHERE NOT EXISTS (SELECT 1 FROM branches);

-- =============================================
-- Functions
-- =============================================

-- Function to update order costs when materials change
CREATE OR REPLACE FUNCTION update_order_costs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET
    boards_cost = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM order_materials
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        AND item_category = 'board'
    ),
    accessories_cost = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM order_materials
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        AND item_category = 'accessory'
    )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_order_material_change
  AFTER INSERT OR UPDATE OR DELETE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION update_order_costs();

-- Function to update inventory quantity_used
CREATE OR REPLACE FUNCTION update_inventory_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_category = 'board' THEN
    UPDATE boards_inventory SET quantity_used = (
      SELECT COALESCE(SUM(quantity_used), 0)
      FROM order_materials
      WHERE item_id = NEW.item_id AND item_category = 'board'
    ) WHERE id = NEW.item_id;
  ELSIF NEW.item_category = 'accessory' THEN
    UPDATE accessories_inventory SET quantity_used = (
      SELECT COALESCE(SUM(quantity_used), 0)
      FROM order_materials
      WHERE item_id = NEW.item_id AND item_category = 'accessory'
    ) WHERE id = NEW.item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_order_material_usage
  AFTER INSERT OR UPDATE OR DELETE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION update_inventory_usage();

-- Function to check quantity_remaining before insert/update
CREATE OR REPLACE FUNCTION check_inventory_availability()
RETURNS TRIGGER AS $$
DECLARE
  remaining DECIMAL(10,2);
BEGIN
  IF NEW.item_category = 'board' THEN
    SELECT quantity_remaining INTO remaining
    FROM boards_inventory WHERE id = NEW.item_id;
  ELSE
    SELECT quantity_remaining INTO remaining
    FROM accessories_inventory WHERE id = NEW.item_id;
  END IF;

  IF remaining < NEW.quantity_used THEN
    RAISE WARNING 'الكمية المستخدمة (%) تتجاوز المتبقي (%)', NEW.quantity_used, remaining;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER before_order_material_insert
  BEFORE INSERT OR UPDATE ON order_materials
  FOR EACH ROW EXECUTE FUNCTION check_inventory_availability();

-- Function to auto-create journal entry for purchases
CREATE OR REPLACE FUNCTION auto_create_purchase_journal_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journal_entries (date, entry_type, description, amount, payment_method, party_id, party_type, notes)
  VALUES (
    NEW.date_added,
    'مشتريات',
    'شراء ' || NEW.item_name || ' - ' || (SELECT name FROM suppliers WHERE id = NEW.supplier_id),
    NEW.total_price,
    'نقدي',
    NEW.supplier_id,
    'supplier',
    'تلقائي من المخزون'
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
