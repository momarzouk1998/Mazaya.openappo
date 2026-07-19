-- ============================================================
-- Migration: 20260719_add_overhead_to_order_view
-- Purpose: Add overhead_total (نثريات) as a separate column in
--          v_order_totals so the orders list page can display it.
-- extra_costs_total stays as the sum of ALL extra costs (unchanged).
-- ============================================================
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
  COALESCE(overhead.overhead_total, 0)    AS overhead_total,
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
LEFT JOIN (
  SELECT order_id, SUM(amount) AS overhead_total
  FROM mazaya.order_extra_costs
  WHERE cost_type = 'نثريات'
  GROUP BY order_id
) overhead ON overhead.order_id = o.id
WHERE o.deleted_at IS NULL;
