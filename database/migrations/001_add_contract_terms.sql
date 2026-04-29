-- =====================================================
-- Migration: add contract_terms column to expense_settings
-- =====================================================
-- Run once on the existing database:
--   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
--        -f database/migrations/001_add_contract_terms.sql

ALTER TABLE expense_settings
    ADD COLUMN IF NOT EXISTS contract_terms TEXT DEFAULT '';
