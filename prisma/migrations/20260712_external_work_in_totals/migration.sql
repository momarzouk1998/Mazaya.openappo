-- ============================================================
-- Migration: 20260712_external_work_in_totals
-- Purpose: ضمّ الأعمال الخارجية في إجمالي الأوردر.
--          العميل عايز الأعمال الخارجية تدخل في حسابات الأوردر
--          والفاتورة (مش مجرد "تتبع فقط").
--
--          كمان الـ profit-loss كان بيحسب الأعمال الخارجية كـ
--          "تكلفة" منفصلة — فلو ضفناها للإيراد هتتكير مرتين.
--          التعديل ده في الـ view بس؛ الكود في profit-loss بيتعدل
--          من غير sql عشان يشيل الاستعلام المنفصل.
-- ============================================================

-- ------------------------------------------------------------
-- 1) إعادة تعريف v_order_totals لتشمل external_work_total
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
  COALESCE(extwork.external_work_total, 0) AS external_work_total,
  (
    COALESCE(boards.boards_cost, 0) +
    COALESCE(acc.acc_cost, 0) +
    COALESCE(o.installation_cost, 0) +
    COALESCE(o.internal_transport_cost, 0) +
    COALESCE(o.external_transport_cost, 0) +
    COALESCE(o.factory_commission, 0) +
    COALESCE(extras.extra_costs_total, 0) +
    COALESCE(extwork.external_work_total, 0)
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
LEFT JOIN (
  SELECT order_id, SUM(amount) AS external_work_total
  FROM mazaya.order_external_work
  GROUP BY order_id
) extwork ON extwork.order_id = o.id
WHERE o.deleted_at IS NULL;

-- ------------------------------------------------------------
-- 2) إعادة تعريف order_costs بنفس المنطق (لتظل متوافقة)
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
  COALESCE(extwork.external_work_total, 0) AS external_work_total,
  (
    COALESCE(boards.boards_cost, 0) +
    COALESCE(acc.acc_cost, 0) +
    COALESCE(o.installation_cost, 0) +
    COALESCE(o.internal_transport_cost, 0) +
    COALESCE(o.external_transport_cost, 0) +
    COALESCE(o.factory_commission, 0) +
    COALESCE(extras.extra_costs_total, 0) +
    COALESCE(extwork.external_work_total, 0)
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
LEFT JOIN (
  SELECT order_id, SUM(amount) AS external_work_total
  FROM mazaya.order_external_work
  GROUP BY order_id
) extwork ON extwork.order_id = o.id
WHERE o.deleted_at IS NULL;
