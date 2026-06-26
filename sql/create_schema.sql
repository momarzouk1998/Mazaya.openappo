-- Mazaya Factory - PostgreSQL Schema
-- Matches the exact table/column names used by the code

DO $$ BEGIN
  CREATE SCHEMA IF NOT EXISTS mazaya;
  SET search_path TO mazaya;
END $$;

-- Users (replaces Supabase Auth)
CREATE TABLE IF NOT EXISTS mazaya.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'branch',
  branch_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Branches (المعارض/الفروع)
CREATE TABLE IF NOT EXISTS mazaya.branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE mazaya.users ADD FOREIGN KEY (branch_id) REFERENCES mazaya.branches(id);

-- Suppliers (الموردين)
CREATE TABLE IF NOT EXISTS mazaya.suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  payment_type VARCHAR(50) NOT NULL DEFAULT 'both',
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers (العملاء)
CREATE TABLE IF NOT EXISTS mazaya.customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  branch_id BIGINT REFERENCES mazaya.branches(id),
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders (الأوردرات)
CREATE TABLE IF NOT EXISTS mazaya.orders (
  id SERIAL PRIMARY KEY,
  order_name TEXT NOT NULL,
  customer_id BIGINT REFERENCES mazaya.customers(id),
  branch_id BIGINT REFERENCES mazaya.branches(id),
  order_type VARCHAR(50) NOT NULL DEFAULT 'new',
  parent_order_id BIGINT REFERENCES mazaya.orders(id),
  start_date DATE,
  end_date DATE,
  duration_days INT GENERATED ALWAYS AS (
    CASE WHEN end_date IS NOT NULL AND start_date IS NOT NULL
         THEN end_date - start_date ELSE NULL END
  ) STORED,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Boards Inventory (مخزون الألواح)
CREATE TABLE IF NOT EXISTS mazaya.boards_inventory (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  material_type VARCHAR(100),
  code TEXT NOT NULL,
  supplier_id BIGINT REFERENCES mazaya.suppliers(id),
  unit_price NUMERIC(10,2) NOT NULL,
  quantity_in INT NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity_in) STORED,
  date_added DATE DEFAULT CURRENT_DATE,
  linked_order_id BIGINT REFERENCES mazaya.orders(id),
  quantity_used INT DEFAULT 0,
  quantity_remaining INT GENERATED ALWAYS AS (quantity_in - quantity_used) STORED,
  CHECK (quantity_remaining >= 0),
  used_price NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (code, supplier_id)
);

-- Accessories Inventory (مخزون الاكسسوارات)
CREATE TABLE IF NOT EXISTS mazaya.accessories_inventory (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  type VARCHAR(100),
  code TEXT NOT NULL,
  supplier_id BIGINT REFERENCES mazaya.suppliers(id),
  unit_price NUMERIC(10,2) NOT NULL,
  quantity_in INT NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity_in) STORED,
  date_added DATE DEFAULT CURRENT_DATE,
  linked_order_id BIGINT REFERENCES mazaya.orders(id),
  quantity_used INT DEFAULT 0,
  quantity_remaining INT GENERATED ALWAYS AS (quantity_in - quantity_used) STORED,
  CHECK (quantity_remaining >= 0),
  used_price NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (code, supplier_id)
);

-- Order Materials (مواد الأوردر المستخدمة)
CREATE TABLE IF NOT EXISTS mazaya.order_materials (
  id SERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES mazaya.orders(id) ON DELETE CASCADE,
  item_category VARCHAR(50),
  item_id BIGINT,
  quantity_used INT NOT NULL,
  unit_price_snapshot NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) GENERATED ALWAYS AS (quantity_used * unit_price_snapshot) STORED,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order Costs (تكاليف الأوردر)
CREATE TABLE IF NOT EXISTS mazaya.order_costs (
  id SERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES mazaya.orders(id) ON DELETE CASCADE,
  boards_cost NUMERIC(10,2) DEFAULT 0,
  accessories_cost NUMERIC(10,2) DEFAULT 0,
  installation_cost NUMERIC(10,2) DEFAULT 0,
  installation_travel_days INT DEFAULT 0,
  internal_transport_cost NUMERIC(10,2) DEFAULT 0,
  external_transport_cost NUMERIC(10,2) DEFAULT 0,
  factory_commission NUMERIC(10,2) DEFAULT 0,
  order_total NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(boards_cost,0) + COALESCE(accessories_cost,0) +
    COALESCE(installation_cost,0) + COALESCE(internal_transport_cost,0) +
    COALESCE(external_transport_cost,0) + COALESCE(factory_commission,0)
  ) STORED,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contractors (المقاولين الخارجيين)
CREATE TABLE IF NOT EXISTS mazaya.contractors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type VARCHAR(100),
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order External Work (الأعمال الخارجية للأوردر)
CREATE TABLE IF NOT EXISTS mazaya.order_external_work (
  id SERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES mazaya.orders(id) ON DELETE CASCADE,
  work_type VARCHAR(100),
  contractor_id BIGINT REFERENCES mazaya.contractors(id),
  amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Journal Entries (اليومية المالية)
CREATE TABLE IF NOT EXISTS mazaya.journal_entries (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  entry_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(50),
  party_id BIGINT,
  party_type VARCHAR(50),
  order_id BIGINT REFERENCES mazaya.orders(id),
  is_pass_through BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Overhead Expenses (النثريات)
CREATE TABLE IF NOT EXISTS mazaya.overhead_expenses (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  journal_entry_id BIGINT REFERENCES mazaya.journal_entries(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Material Types (لوحة: أنواع خامات الألواح)
CREATE TABLE IF NOT EXISTS mazaya.material_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Accessory Types (لوحة: أنواع الاكسسوارات)
CREATE TABLE IF NOT EXISTS mazaya.accessory_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin Permissions (صلاحيات المديرين)
CREATE TABLE IF NOT EXISTS mazaya.admin_permissions (
  user_id BIGINT PRIMARY KEY REFERENCES mazaya.users(id),
  perm_dashboard BOOLEAN DEFAULT TRUE,
  perm_orders BOOLEAN DEFAULT TRUE,
  perm_journal BOOLEAN DEFAULT TRUE,
  perm_reports BOOLEAN DEFAULT TRUE,
  perm_inventory BOOLEAN DEFAULT TRUE,
  perm_suppliers BOOLEAN DEFAULT TRUE,
  perm_customers BOOLEAN DEFAULT TRUE,
  perm_branches BOOLEAN DEFAULT TRUE,
  perm_contractors BOOLEAN DEFAULT TRUE,
  perm_overhead BOOLEAN DEFAULT TRUE,
  perm_admin_users BOOLEAN DEFAULT TRUE,
  perm_material_types BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lookup Lists (قوائم الاختيارات القابلة للتوسيع)
CREATE TABLE IF NOT EXISTS mazaya.lookup_lists (
  id SERIAL PRIMARY KEY,
  list_key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (list_key, value)
);

-- Profile view (مشاهدة للمستخدمين)
CREATE OR REPLACE VIEW mazaya.profiles AS
  SELECT id, name, email, role, branch_id, created_at
  FROM mazaya.users;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_branch ON mazaya.customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON mazaya.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON mazaya.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON mazaya.orders(status);
CREATE INDEX IF NOT EXISTS idx_boards_supplier ON mazaya.boards_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_boards_remaining ON mazaya.boards_inventory(quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_accessories_supplier ON mazaya.accessories_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accessories_remaining ON mazaya.accessories_inventory(quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_journal_date ON mazaya.journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_type ON mazaya.journal_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_journal_party ON mazaya.journal_entries(party_id, party_type);

-- Triggers: deduct inventory on material insert
CREATE OR REPLACE FUNCTION mazaya.deduct_inventory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_category = 'board' THEN
    UPDATE mazaya.boards_inventory SET quantity_used = quantity_used + NEW.quantity_used WHERE id = NEW.item_id;
  ELSIF NEW.item_category = 'accessory' THEN
    UPDATE mazaya.accessories_inventory SET quantity_used = quantity_used + NEW.quantity_used WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON mazaya.order_materials;
CREATE TRIGGER trg_deduct_inventory
  AFTER INSERT ON mazaya.order_materials
  FOR EACH ROW EXECUTE FUNCTION mazaya.deduct_inventory();

-- Restore inventory on material delete
CREATE OR REPLACE FUNCTION mazaya.restore_inventory() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.item_category = 'board' THEN
    UPDATE mazaya.boards_inventory SET quantity_used = quantity_used - OLD.quantity_used WHERE id = OLD.item_id;
  ELSIF OLD.item_category = 'accessory' THEN
    UPDATE mazaya.accessories_inventory SET quantity_used = quantity_used - OLD.quantity_used WHERE id = OLD.item_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restore_inventory ON mazaya.order_materials;
CREATE TRIGGER trg_restore_inventory
  AFTER DELETE ON mazaya.order_materials
  FOR EACH ROW EXECUTE FUNCTION mazaya.restore_inventory();

-- RPC function for admin permissions (returns empty by default - admin sees all)
CREATE OR REPLACE FUNCTION mazaya.get_my_permissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NULL;
END;
$$;

-- Set search path for connections
ALTER DATABASE mazaya_factory SET search_path TO mazaya, public;
