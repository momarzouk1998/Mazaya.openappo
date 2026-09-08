-- ============================================================
-- Migration: 20260908_add_worker_wage_on_overhead
-- Purpose: Add a per-worker flag so a worker's wage entries
--          (weekly settlement + advances/payouts) are booked as
--          'نثريات' instead of 'أجور عمال' and surface on the
--          overhead (النثريات) screen. Cleaning / administrative
--          staff are operating overhead, not production labour.
-- Non-destructive: single additive column with a safe default.
-- ============================================================

ALTER TABLE "mazaya"."workers"
  ADD COLUMN IF NOT EXISTS "wage_on_overhead" BOOLEAN NOT NULL DEFAULT false;
