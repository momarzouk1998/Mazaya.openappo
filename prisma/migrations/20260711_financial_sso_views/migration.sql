-- ============================================================
-- Migration: 20260711_financial_sso_views
-- Purpose: Establish a single source of truth for financial
--          calculations (F1, F2, F3, F4, F5, F7, F8 from audit)
-- ============================================================
--
-- هذه الـ views هي المصدر الموثوق للأرقام المالية في النظام كله.
-- أي صفحة أو API لازم تقرأ منها بدل ما تحسب في JavaScript.

-- ------------------------------------------------------------
-- 1) v_order_totals — بديل موحد لعمود order_total
--    الـ view ده بيحسب order_total صح من order_materials.line_total
--    + كل التكاليف الثابتة على الأوردر. عمود order_total في جدول
--    orders بيفضل null (F3, F5, F13) فالـ view هو اللي بيغذّي
--    كل القوائم والتقارير.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW mazaya.v_order_totals AS
SELECT
  o.id            AS order_id,
  o.order_name,
  o.customer_id,
  o.branch_id,
  o.status,
  o.order_type,
  o.start_date,
  o.end_date,
  o.created_at,
  o.deleted_at,
  COALESCE(boards.boards_cost, 0)        AS boards_cost,
  COALESCE(acc.acc_cost, 0)              AS accessories_cost,
  COALESCE(o.installation_cost, 0)        AS installation_cost,
  COALESCE(o.internal_transport_cost, 0)  AS internal_transport_cost,
  COALESCE(o.external_transport_cost, 0)  AS external_transport_cost,
  COALESCE(o.factory_commission, 0)       AS factory_commission,
  COALESCE(extras.extra_costs_total, 0)   AS extra_costs_total,
  (
    COALESCE(boards.boards_cost, 0) +
    COALESCE(acc.acc_cost, 0) +
    COALESCE(o.installation_cost, 0) +
    COALESCE(o.internal_transport_cost, 0) +
    COALESCE(o.external_transport_cost, 0) +
    COALESCE(o.factory_commission, 0) +
    COALESCE(extras.extra_costs_total, 0)
  ) AS order_total
FROM mazaya.orders o
LEFT JOIN (
  SELECT order_id, SUM(COALESCE(line_total, quantity_used * unit_price_snapshot)) AS boards_cost
  FROM mazaya.order_materials
  WHERE item_category = 'boards_inventory'
  GROUP BY order_id
) boards ON boards.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(COALESCE(line_total, quantity_used * unit_price_snapshot)) AS acc_cost
  FROM mazaya.order_materials
  WHERE item_category = 'accessories_inventory'
  GROUP BY order_id
) acc ON acc.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(amount) AS extra_costs_total
  FROM mazaya.order_extra_costs
  GROUP BY order_id
) extras ON extras.order_id = o.id
WHERE o.deleted_at IS NULL;

-- ------------------------------------------------------------
-- 2) order_costs — الـ view اللي كان مفقود وبيكسر profit-loss
--    (F4 من الـ audit). الـ view ده بيربط تكلفة المواد بالأوردر
--    بالاعتماد على item_category (مش inventory_table القديم).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW mazaya.order_costs AS
SELECT
  o.id              AS order_id,
  o.created_at,
  o.start_date,
  o.status,
  COALESCE(boards.boards_cost, 0)        AS boards_cost,
  COALESCE(acc.acc_cost, 0)              AS accessories_cost,
  COALESCE(o.installation_cost, 0)        AS installation_cost,
  COALESCE(o.internal_transport_cost, 0)  AS internal_transport_cost,
  COALESCE(o.external_transport_cost, 0)  AS external_transport_cost,
  COALESCE(o.factory_commission, 0)       AS factory_commission,
  COALESCE(extras.extra_costs_total, 0)   AS extra_costs_total,
  (
    COALESCE(boards.boards_cost, 0) +
    COALESCE(acc.acc_cost, 0) +
    COALESCE(o.installation_cost, 0) +
    COALESCE(o.internal_transport_cost, 0) +
    COALESCE(o.external_transport_cost, 0) +
    COALESCE(o.factory_commission, 0) +
    COALESCE(extras.extra_costs_total, 0)
  ) AS total_cost
FROM mazaya.orders o
LEFT JOIN (
  SELECT order_id, SUM(COALESCE(line_total, quantity_used * unit_price_snapshot)) AS boards_cost
  FROM mazaya.order_materials
  WHERE item_category = 'boards_inventory'
  GROUP BY order_id
) boards ON boards.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(COALESCE(line_total, quantity_used * unit_price_snapshot)) AS acc_cost
  FROM mazaya.order_materials
  WHERE item_category = 'accessories_inventory'
  GROUP BY order_id
) acc ON acc.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(amount) AS extra_costs_total
  FROM mazaya.order_extra_costs
  GROUP BY order_id
) extras ON extras.order_id = o.id
WHERE o.deleted_at IS NULL;

-- ------------------------------------------------------------
-- 3) v_journal_kpis — بديل موحد لفلترة اليومية على مستوى الـ DB
--    بيدي نفس الأرقام اللي الـ journal page كانت بتحسبها في JS
--    (todayIncome/todayExpense/totalNet). الـ rows اللي بـ
--    is_pass_through = true بتتشال من كل المجاميع.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW mazaya.v_journal_kpis AS
SELECT
  date,
  SUM(CASE
        WHEN entry_type = 'دفعة واردة من معرض' AND is_pass_through = false
        THEN amount ELSE 0 END) AS day_in,
  SUM(CASE
        WHEN entry_type IN ('مشتريات', 'نثريات')
        THEN amount ELSE 0 END) AS day_expense,
  SUM(CASE
        WHEN entry_type = 'دفعة صادرة لمورد' AND is_pass_through = false
        THEN amount ELSE 0 END) AS day_payout,
  SUM(CASE
        WHEN entry_type = 'دفعة واردة من معرض' AND is_pass_through = false THEN amount
        WHEN entry_type IN ('مشتريات', 'نثريات') THEN -amount
        WHEN entry_type = 'دفعة صادرة لمورد' AND is_pass_through = false THEN -amount
        ELSE 0 END) AS day_net
FROM mazaya.journal_entries
GROUP BY date;

-- ------------------------------------------------------------
-- 4) v_running_balance — رصيد جاري دقيق لكل يوم
--    بيشمل الوارد والمصروف والدفوع (F1, F2) — الـ closing
--    balance لأي يوم = SUM(day_net) لكل الأيام <= ذلك اليوم.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW mazaya.v_running_balance AS
SELECT
  date,
  day_in,
  day_expense,
  day_payout,
  day_net,
  SUM(day_net) OVER (ORDER BY date) AS running_balance
FROM mazaya.v_journal_kpis;

-- ------------------------------------------------------------
-- 5) Backfill order_materials.line_total (F5) — لو الـ DB
--    القديمة كانت بتستخدم GENERATED column، نضمن إن كل صف
--    عنده قيمة محسوبة. بعد البيلد الأول، الـ trigger في الأسفل
--    بيحافظ على الـ consistency تلقائياً.
-- ------------------------------------------------------------
UPDATE mazaya.order_materials
SET line_total = quantity_used * unit_price_snapshot
WHERE line_total IS NULL;

-- ------------------------------------------------------------
-- 6) توحيد منطق تحديث المخزون (F7) — trigger يحسب
--    quantity_remaining و total_price تلقائياً بعد كل تعديل
--    على boards_inventory / accessories_inventory. الـ app code
--    بعد كده يقدر يبعت quantity_used و quantity_in فقط.
-- ------------------------------------------------------------

-- أ) إعادة بناء الـ function بشكل idempotent
CREATE OR REPLACE FUNCTION mazaya.recompute_inventory_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- دائماً quantity_remaining = quantity_in - quantity_used
  NEW.quantity_remaining := GREATEST(NEW.quantity_in - NEW.quantity_used, 0);
  -- total_price = quantity_remaining * unit_price
  NEW.total_price := NEW.quantity_remaining * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ب) نمسح أي trigger قديم على الـ inventory tables
DROP TRIGGER IF EXISTS trg_recompute_boards ON mazaya.boards_inventory;
DROP TRIGGER IF EXISTS trg_recompute_accessories ON mazaya.accessories_inventory;

-- ج) نعمل trigger جديد على الـ BEFORE INSERT/UPDATE
CREATE TRIGGER trg_recompute_boards
BEFORE INSERT OR UPDATE ON mazaya.boards_inventory
FOR EACH ROW EXECUTE FUNCTION mazaya.recompute_inventory_totals();

CREATE TRIGGER trg_recompute_accessories
BEFORE INSERT OR UPDATE ON mazaya.accessories_inventory
FOR EACH ROW EXECUTE FUNCTION mazaya.recompute_inventory_totals();

-- ------------------------------------------------------------
-- 7) Indexes مفقودة (من audit section: Missing indexes)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON mazaya.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON mazaya.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch_deleted ON mazaya.orders(branch_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_journal_entry_type_date ON mazaya.journal_entries(entry_type, date);
CREATE INDEX IF NOT EXISTS idx_journal_order_id ON mazaya.journal_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_materials_item ON mazaya.order_materials(item_id, item_category);
CREATE INDEX IF NOT EXISTS idx_boards_material_type ON mazaya.boards_inventory(material_type);
CREATE INDEX IF NOT EXISTS idx_accessories_material_type ON mazaya.accessories_inventory(material_type);

-- ------------------------------------------------------------
-- 8) Data normalization (F8) — تطبيع entry_type لقيم موحدة عربية
--    كل الكود يقرأ/يكتب 'نثريات'، 'مشتريات'، 'دفعة واردة من معرض'،
--    'دفعة صادرة لمورد'، 'تحويل تمريري'. أي قيمة قديمة بالإنجليزي
--    بتتحوّل للقيمة العربية الموافقة (idempotent).
-- ------------------------------------------------------------
UPDATE mazaya.journal_entries SET entry_type = 'نثريات' WHERE entry_type = 'overhead';
UPDATE mazaya.journal_entries SET entry_type = 'مشتريات' WHERE entry_type = 'purchase';
UPDATE mazaya.journal_entries SET entry_type = 'دفعة واردة من معرض' WHERE entry_type = 'incoming_from_branch';
UPDATE mazaya.journal_entries SET entry_type = 'دفعة صادرة لمورد' WHERE entry_type = 'outgoing_to_supplier';
UPDATE mazaya.journal_entries SET entry_type = 'تحويل تمريري' WHERE entry_type = 'transfer';
UPDATE mazaya.journal_entries SET entry_type = 'نثريات' WHERE entry_type = 'expense';
UPDATE mazaya.journal_entries SET entry_type = 'دفعة واردة من معرض' WHERE entry_type = 'income';

-- ------------------------------------------------------------
-- 9) إضافة عمود installation_travel_days للأوردرات (F6)
--    الحقل بيتحسب في الفورم لكن مش بيتخزن. نضيفه ونسمح بتعديله
--    من PATCH /api/orders/:id.
-- ------------------------------------------------------------
ALTER TABLE mazaya.orders
  ADD COLUMN IF NOT EXISTS installation_travel_days INTEGER DEFAULT 0;
