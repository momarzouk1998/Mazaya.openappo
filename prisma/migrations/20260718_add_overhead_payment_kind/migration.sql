-- ============================================================
-- Migration: 20260718_add_overhead_payment_kind
-- Purpose: إضافة payment_kind لـ overhead_expenses عشان نفرّق
--          بين القبض والسلفة في أجور العمال.
--          القيم المسموحة: 'قبض' (افتراضي) أو 'سلفة'.
--          Nullable عشان السجلات القديمة.
-- ============================================================

ALTER TABLE "mazaya"."overhead_expenses"
  ADD COLUMN IF NOT EXISTS "payment_kind" Text;
