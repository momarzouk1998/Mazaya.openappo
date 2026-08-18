-- ============================================================
-- Migration: 20260818_unify_road_expenses
-- Purpose: Unify all road expenses into journal_entries and overhead_expenses
--          as the single source of truth, migrating any legacy records
--          from worker_travel_expenses.
-- ============================================================

-- 1) Migrate any legacy worker_travel_expenses into journal_entries
INSERT INTO mazaya.journal_entries (id, date, entry_type, description, amount, payment_method, order_id, notes, created_by, created_at)
SELECT
  wte.id,
  wte.expense_date,
  'مصاريف طريق',
  CASE
    WHEN wte.description IS NOT NULL AND wte.description != '' THEN wte.description
    ELSE '[مصاريف طريق] مصاريف طريق مرتبطة بأوردر'
  END,
  wte.amount,
  COALESCE(wte.payment_method, 'نقدي'),
  wte.order_id,
  wte.notes,
  wte.created_by,
  COALESCE(wte.created_at, NOW())
FROM mazaya.worker_travel_expenses wte
WHERE NOT EXISTS (
  SELECT 1 FROM mazaya.journal_entries je
  WHERE je.id = wte.id
     OR (je.order_id = wte.order_id AND je.amount = wte.amount AND je.date = wte.expense_date AND je.entry_type IN ('مصاريف طريق', 'مصاريف الطريق'))
)
ON CONFLICT (id) DO NOTHING;

-- 2) Ensure matching overhead_expenses records exist for all road journal entries
INSERT INTO mazaya.overhead_expenses (id, date, category, description, amount, payment_method, journal_entry_id, notes, created_by, created_at)
SELECT
  gen_random_uuid(),
  je.date,
  'مصاريف طريق',
  je.description,
  je.amount,
  je.payment_method,
  je.id,
  je.notes,
  je.created_by,
  je.created_at
FROM mazaya.journal_entries je
WHERE je.entry_type IN ('مصاريف طريق', 'مصاريف الطريق')
  AND NOT EXISTS (
    SELECT 1 FROM mazaya.overhead_expenses oe
    WHERE oe.journal_entry_id = je.id
  );
