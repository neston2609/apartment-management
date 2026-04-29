-- ============================================================
-- Migration 002 — room notes, system_settings, password reset
-- ============================================================

-- Room notes (per-room free text, e.g., มีปัญหาห้องน้ำ)
ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Tenant address (separate from current/notes)
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS address TEXT;

-- Key/value store for runtime config (SMTP, app URL, etc.)
CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One-time tokens for password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id    SERIAL PRIMARY KEY,
    token       VARCHAR(128) UNIQUE NOT NULL,
    user_kind   VARCHAR(20)  NOT NULL,  -- 'admin' or 'tenant'
    user_id     INTEGER      NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user  ON password_reset_tokens(user_kind, user_id);

-- Seed default SMTP keys (empty values; fill via the UI)
INSERT INTO system_settings (key, value) VALUES
    ('smtp_host',     ''),
    ('smtp_port',     '587'),
    ('smtp_secure',   'false'),
    ('smtp_user',     ''),
    ('smtp_password', ''),
    ('smtp_from',     ''),
    ('app_base_url',  'http://localhost:3000')
ON CONFLICT (key) DO NOTHING;
