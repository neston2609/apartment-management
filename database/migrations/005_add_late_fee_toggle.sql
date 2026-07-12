-- 005: Add an on/off switch for late-fee charging, per apartment.
--      When FALSE, overdue bills still show "เกินกำหนด" but no late fee
--      is computed or charged, regardless of late_fee_per_day.

ALTER TABLE expense_settings
    ADD COLUMN IF NOT EXISTS late_fee_enabled BOOLEAN NOT NULL DEFAULT TRUE;
