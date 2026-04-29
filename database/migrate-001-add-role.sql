-- ============================================================
-- Migration 001 — add `role` to admin_users
-- Roles:
--   super_admin     — full access + user management
--   admin           — full access (no user management)
--   property_manager — only list/print invoices
-- ============================================================

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'admin';

-- Backfill existing super-admin flag into the role column
UPDATE admin_users
   SET role = 'super_admin'
 WHERE is_super_admin = TRUE
   AND role <> 'super_admin';

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
