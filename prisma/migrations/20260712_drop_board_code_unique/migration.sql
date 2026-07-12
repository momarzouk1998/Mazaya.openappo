-- ============================================================
-- Migration: 20260712_drop_board_code_unique
-- Purpose: السماح بتكرار كود اللوح لنفس المورد.
--          العميل عايز يضيف نفس الكود أكتر من مرة بدون قيد.
--          بنشيل الـ unique constraint من (supplier_id, code).
-- ============================================================

-- Prisma بيسمّي الـ constraint ده "<table>_<columns>_key".
-- نشيله IF EXISTS عشان الـ migration يكون idempotent.
ALTER TABLE mazaya.boards_inventory
  DROP CONSTRAINT IF EXISTS boards_inventory_supplier_id_code_key;
