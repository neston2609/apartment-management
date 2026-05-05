-- =====================================================
-- Migration: login activity log
-- =====================================================
-- Run once on the existing database:
--   psql ... -f database/migrations/003_add_login_logs.sql
--
-- Captures every login attempt (success and failure) for both
-- admin and tenant logins so super-admins can monitor activity.

CREATE TABLE IF NOT EXISTS login_logs (
    log_id        SERIAL PRIMARY KEY,
    user_kind     VARCHAR(20),                   -- 'admin' | 'tenant' | NULL when unknown
    user_id       INTEGER,                       -- admin_id or tenant_id (NULL on unknown user)
    identifier    TEXT,                          -- the username / national_id / room_number entered
    success       BOOLEAN NOT NULL,
    error_reason  TEXT,                          -- 'wrong_password', 'unknown_user', 'inactive', etc.
    ip            TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_user       ON login_logs(user_kind, user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_success    ON login_logs(success);
