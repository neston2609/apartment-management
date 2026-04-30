-- =====================================================
-- Migration: payment status & late fees
-- =====================================================
-- Run once on the existing database:
--   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
--        -f database/migrations/002_add_payment_status.sql
--
-- Adds:
--   expense_settings.payment_due_day   -- day of the month rent is due (1-31)
--   expense_settings.late_fee_per_day  -- fine per day for late payment (THB)
--   bills.paid_at                      -- timestamp the bill was marked paid

ALTER TABLE expense_settings
    ADD COLUMN IF NOT EXISTS payment_due_day  INTEGER,
    ADD COLUMN IF NOT EXISTS late_fee_per_day DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bills_paid_at ON bills(paid_at);
