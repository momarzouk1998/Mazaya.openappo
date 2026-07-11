-- ============================================
-- Mazaya Furniture Factory — PostgreSQL Schema
-- Version: 2.1 (PostgreSQL native, no Supabase)
-- Schema: mazaya
-- ============================================

DO $$ BEGIN
  CREATE SCHEMA IF NOT EXISTS mazaya;
END $$;

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE mazaya.user_role AS ENUM ('admin', 'branch_user');
  CREATE TYPE mazaya.order_status AS ENUM ('open', 'in_progress', 'completed', 'delivered');
  CREATE TYPE mazaya.order_type AS ENUM ('new', 'maintenance');
  CREATE TYPE mazaya.journal_entry_type AS ENUM ('purchase', 'incoming_from_branch', 'outgoing_to_supplier', 'transfer', 'overhead');
  CREATE TYPE mazaya.payment_method AS ENUM ('cash', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 1. Branches (المعارض / الفروع)
--     Defined BEFORE users — users.branch_id references branches(id)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  location VARCHAR(300),
  phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Users (Custom JWT auth — no Supabase)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt cost=10
  role mazaya.user_role NOT NULL DEFAULT 'branch_user',
  branch_id INT REFERENCES mazaya.branches(id),
  visible_modules TEXT[] DEFAULT ARRAY['dashboard', 'orders'],
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Suppliers (الموردين)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  payment_type VARCHAR(20) NOT NULL DEFAULT 'both',  -- cash / transfer / both
  phone VARCHAR(50),
  notes TEXT,
  deleted_at TIMESTAMPTZ,                           -- Soft Delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Customers (العملاء)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  branch_id INT REFERENCES mazaya.branches(id),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Orders (الأوردرات)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.orders (
  id SERIAL PRIMARY KEY,
  order_name VARCHAR(200) NOT NULL,
  customer_id INT REFERENCES mazaya.customers(id),
  branch_id INT REFERENCES mazaya.branches(id),
  order_type mazaya.order_type NOT NULL DEFAULT 'new',
  parent_order_id INT REFERENCES mazaya.orders(id),
  start_date DATE,
  end_date DATE,
  duration_days INT GENERATED ALWAYS AS (
    CASE WHEN end_date IS NOT NULL AND start_date IS NOT NULL
         THEN end_date - start_date ELSE NULL END
  ) STORED,
  status mazaya.order_status NOT NULL DEFAULT 'open',
  installation_cost NUMERIC(12,2) DEFAULT 0,
  internal_transport_cost NUMERIC(12,2) DEFAULT 0,
  external_transport_cost NUMERIC(12,2) DEFAULT 0,
  factory_commission NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by INT REFERENCES mazaya.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Boards Inventory (مخزون الألواح)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.boards_inventory (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(300) NOT NULL,
  material_type VARCHAR(100),
  code VARCHAR(100) NOT NULL,
  supplier_id INT REFERENCES mazaya.suppliers(id),
  unit_price NUMERIC(12,2) NOT NULL,
  quantity_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (unit_price * quantity_in) STORED,
  date_added DATE DEFAULT CURRENT_DATE,
  linked_order_id INT REFERENCES mazaya.orders(id),
  quantity_used NUMERIC(12,2) DEFAULT 0,
  quantity_remaining NUMERIC(12,2) GENERATED ALWAYS AS (quantity_in - quantity_used) STORED,
  used_price NUMERIC(12,2),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by INT REFERENCES mazaya.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (supplier_id, code)
);

-- ============================================
-- 7. Accessories Inventory (مخزون الاكسسوارات)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.accessories_inventory (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(300) NOT NULL,
  material_type VARCHAR(100),
  code VARCHAR(100) NOT NULL,
  supplier_id INT REFERENCES mazaya.suppliers(id),
  unit_price NUMERIC(12,2) NOT NULL,
  quantity_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (unit_price * quantity_in) STORED,
  date_added DATE DEFAULT CURRENT_DATE,
  linked_order_id INT REFERENCES mazaya.orders(id),
  quantity_used NUMERIC(12,2) DEFAULT 0,
  quantity_remaining NUMERIC(12,2) GENERATED ALWAYS AS (quantity_in - quantity_used) STORED,
  used_price NUMERIC(12,2),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by INT REFERENCES mazaya.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (supplier_id, code)
);

-- ============================================
-- 8. Order Materials (مواد الأوردر المستخدمة)
--     inventory_table: 'boards_inventory' or 'accessories_inventory'
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.order_materials (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES mazaya.orders(id) ON DELETE CASCADE,
  inventory_table VARCHAR(30) NOT NULL,
  item_id INT NOT NULL,
  quantity_used NUMERIC(12,2) NOT NULL,
  unit_price_snapshot NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity_used * unit_price_snapshot) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_inv_table CHECK (inventory_table IN ('boards_inventory', 'accessories_inventory'))
);

-- ============================================
-- 9. Contractors (المقاولين الخارجيين)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.contractors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  specialty VARCHAR(200),
  phone VARCHAR(50),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. Order External Work (الأعمال الخارجية للأوردر)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.order_external_work (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES mazaya.orders(id) ON DELETE CASCADE,
  contractor_id INT REFERENCES mazaya.contractors(id),
  description VARCHAR(300),
  cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. Journal Entries (اليومية المالية)
-- ============================================
CREATE TABLE IF NOT EXISTS mazaya.journal_entries (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  entry_type mazaya.journal_entry_type NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method mazaya.payment_method,
  party_type VARCHAR(20),                          -- 'supplier'

  party_id INT,
  order_id INT REFERENCES mazaya.orders(id),
  created_by INT REFERENCES mazaya.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Overhead Expenses
CREATE TABLE IF NOT EXISTS mazaya.overhead_expenses (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(100),
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method mazaya.payment_method,
  journal_entry_id INT REFERENCES mazaya.journal_entries(id),
  created_by INT REFERENCES mazaya.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Material Types
CREATE TABLE IF NOT EXISTS mazaya.material_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL DEFAULT 'board',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Audit Log
CREATE TABLE IF NOT EXISTS mazaya.audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES mazaya.users(id),
  action VARCHAR(10) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  row_id INT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted ON mazaya.suppliers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON mazaya.customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON mazaya.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON mazaya.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON mazaya.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON mazaya.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_deleted ON mazaya.orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_boards_supplier ON mazaya.boards_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_boards_remaining ON mazaya.boards_inventory(quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_boards_deleted ON mazaya.boards_inventory(deleted_at);
CREATE INDEX IF NOT EXISTS idx_accessories_supplier ON mazaya.accessories_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accessories_remaining ON mazaya.accessories_inventory(quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_accessories_deleted ON mazaya.accessories_inventory(deleted_at);
CREATE INDEX IF NOT EXISTS idx_order_materials_order ON mazaya.order_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON mazaya.journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_type ON mazaya.journal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_journal_party ON mazaya.journal_entries(party_id, party_type);
CREATE INDEX IF NOT EXISTS idx_overhead_date ON mazaya.overhead_expenses(date);
CREATE INDEX IF NOT EXISTS idx_audit_user ON mazaya.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON mazaya.audit_log(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON mazaya.users(username);

-- ============================================
-- VIEWS
-- ============================================
--
-- ملحوظة: v_order_totals و order_costs هنا معرّفين في
-- prisma/migrations/20260711_financial_sso_views/migration.sql
-- للحفاظ على الـ Single Source of Truth. لا تعدّلهم هنا
-- بدون تعديل المايقريشن.

CREATE OR REPLACE VIEW mazaya.v_inventory_value AS
SELECT
  'boards' AS inventory_type,
  b.id, b.item_name, b.code, b.supplier_id,
  b.unit_price, b.quantity_remaining,
  (b.unit_price * b.quantity_remaining) AS current_value,
  b.material_type
FROM mazaya.boards_inventory b
WHERE b.deleted_at IS NULL AND b.quantity_remaining > 0
UNION ALL
SELECT
  'accessories' AS inventory_type,
  a.id, a.item_name, a.code, a.supplier_id,
  a.unit_price, a.quantity_remaining,
  (a.unit_price * a.quantity_remaining) AS current_value,
  a.material_type
FROM mazaya.accessories_inventory a
WHERE a.deleted_at IS NULL AND a.quantity_remaining > 0;

CREATE OR REPLACE VIEW mazaya.v_order_totals AS
SELECT
  o.id AS order_id,
  o.order_name,
  o.customer_id,
  o.branch_id,
  o.status,
  COALESCE(boards.boards_cost, 0) AS boards_cost,
  COALESCE(acc.acc_cost, 0) AS accessories_cost,
  o.installation_cost,
  o.internal_transport_cost,
  o.external_transport_cost,
  o.factory_commission,
  (
    COALESCE(boards.boards_cost, 0) +
    COALESCE(acc.acc_cost, 0) +
    COALESCE(o.installation_cost, 0) +
    COALESCE(o.internal_transport_cost, 0) +
    COALESCE(o.external_transport_cost, 0) +
    COALESCE(o.factory_commission, 0)
  ) AS order_total
FROM mazaya.orders o
LEFT JOIN (
  SELECT order_id, SUM(line_total) AS boards_cost
  FROM mazaya.order_materials WHERE inventory_table = 'boards_inventory'
  GROUP BY order_id
) boards ON boards.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(line_total) AS acc_cost
  FROM mazaya.order_materials WHERE inventory_table = 'accessories_inventory'
  GROUP BY order_id
) acc ON acc.order_id = o.id
WHERE o.deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION mazaya.deduct_inventory()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.inventory_table = 'boards_inventory' THEN
    UPDATE mazaya.boards_inventory SET quantity_used = quantity_used + NEW.quantity_used WHERE id = NEW.item_id;
  ELSIF NEW.inventory_table = 'accessories_inventory' THEN
    UPDATE mazaya.accessories_inventory SET quantity_used = quantity_used + NEW.quantity_used WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON mazaya.order_materials;
CREATE TRIGGER trg_deduct_inventory AFTER INSERT ON mazaya.order_materials FOR EACH ROW EXECUTE FUNCTION mazaya.deduct_inventory();

CREATE OR REPLACE FUNCTION mazaya.restore_inventory()
RETURNS TRIGGER AS $func$
BEGIN
  IF OLD.inventory_table = 'boards_inventory' THEN
    UPDATE mazaya.boards_inventory SET quantity_used = quantity_used - OLD.quantity_used WHERE id = OLD.item_id;
  ELSIF OLD.inventory_table = 'accessories_inventory' THEN
    UPDATE mazaya.accessories_inventory SET quantity_used = quantity_used - OLD.quantity_used WHERE id = OLD.item_id;
  END IF;
  RETURN OLD;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restore_inventory ON mazaya.order_materials;
CREATE TRIGGER trg_restore_inventory AFTER DELETE ON mazaya.order_materials FOR EACH ROW EXECUTE FUNCTION mazaya.restore_inventory();

-- ============================================
-- Set search path
-- ============================================
ALTER DATABASE mazaya SET search_path TO mazaya, public;
