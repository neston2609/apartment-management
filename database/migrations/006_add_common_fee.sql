-- 006: Add "ค่าบริการไฟส่วนกลาง" (common-area electricity service fee).
--      Charged per electricity unit the room consumes:
--          common_fee = common_fee_per_unit × electricity_usage
--      Configured per apartment in expense_settings, with an on/off switch.
--      When enabled, the fee is added to every room's bill and shown as its
--      own line item; when disabled it is neither charged nor displayed.

ALTER TABLE expense_settings
    ADD COLUMN IF NOT EXISTS common_fee_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS common_fee_enabled  BOOLEAN      NOT NULL DEFAULT FALSE;

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS common_fee DECIMAL(10,2) NOT NULL DEFAULT 0;
