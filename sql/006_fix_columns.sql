-- 006_fix_columns.sql
-- Adds missing columns and fixes generated columns for existing tables.
-- Run this ONCE before 005_seed_data.sql if tables already exist.

SET search_path TO mazaya, public;

-- Add unit column
ALTER TABLE boards_inventory      ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
ALTER TABLE accessories_inventory ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';

-- Drop generated expression on total_price and quantity_remaining
ALTER TABLE boards_inventory      ALTER COLUMN total_price      DROP EXPRESSION;
ALTER TABLE accessories_inventory ALTER COLUMN total_price      DROP EXPRESSION;
ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining DROP EXPRESSION;
ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining DROP EXPRESSION;

-- Set defaults for the now-regular columns
ALTER TABLE boards_inventory      ALTER COLUMN total_price      SET DEFAULT 0;
ALTER TABLE accessories_inventory ALTER COLUMN total_price      SET DEFAULT 0;
ALTER TABLE boards_inventory      ALTER COLUMN quantity_remaining SET DEFAULT 0;
ALTER TABLE accessories_inventory ALTER COLUMN quantity_remaining SET DEFAULT 0;
