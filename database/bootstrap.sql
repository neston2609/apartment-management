-- Run this once as the postgres superuser to create the database.
-- It's idempotent: safe to run again, will just no-op if the DB exists.
SELECT 'CREATE DATABASE apartment_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'apartment_db')\gexec
