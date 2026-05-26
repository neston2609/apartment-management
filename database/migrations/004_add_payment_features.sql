-- 004: Add bank transfer info + QR code to expense_settings,
--      and payment slip tracking to bills.

ALTER TABLE expense_settings
    ADD COLUMN IF NOT EXISTS bank_name            VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bank_account_number  VARCHAR(50)  NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bank_account_name    VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS qr_code_path         TEXT;

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS payment_slip_path        TEXT,
    ADD COLUMN IF NOT EXISTS payment_slip_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_slip_status      VARCHAR(20);
-- payment_slip_status values: NULL (no slip) | 'pending' | 'confirmed'

CREATE INDEX IF NOT EXISTS idx_bills_slip_status ON bills(payment_slip_status);
