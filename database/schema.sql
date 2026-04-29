-- =====================================================
-- Apartment Management System - Database Schema
-- PostgreSQL
-- =====================================================

-- Drop existing types/tables (idempotent for dev)
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS meter_readings CASCADE;
DROP TABLE IF EXISTS expense_settings CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TYPE  IF EXISTS room_status CASCADE;

-- =====================================================
-- ENUM Types
-- =====================================================
CREATE TYPE room_status AS ENUM (
    'occupied',
    'vacant',
    'maintenance',
    'common',
    'caretaker'
);

-- =====================================================
-- Table: apartments
-- =====================================================
CREATE TABLE apartments (
    apartment_id    SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    address         TEXT NOT NULL,
    contact_number  VARCHAR(20),
    floors_count    INTEGER NOT NULL DEFAULT 1,
    rooms_per_floor INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Table: rooms
-- =====================================================
CREATE TABLE rooms (
    room_id         SERIAL PRIMARY KEY,
    apartment_id    INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    floor_number    INTEGER NOT NULL,
    room_sequence   INTEGER NOT NULL,
    room_number     VARCHAR(20) NOT NULL,
    rental_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
    status          room_status NOT NULL DEFAULT 'vacant',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, room_number)
);

-- =====================================================
-- Table: tenants
-- =====================================================
CREATE TABLE tenants (
    tenant_id       SERIAL PRIMARY KEY,
    room_id         INTEGER REFERENCES rooms(room_id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(20),
    national_id     VARCHAR(20) UNIQUE NOT NULL,
    move_in_date    DATE NOT NULL,
    move_out_date   DATE,
    email           VARCHAR(255),
    password_hash   VARCHAR(255) NOT NULL,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Table: expense_settings
-- =====================================================
CREATE TABLE expense_settings (
    setting_id                  SERIAL PRIMARY KEY,
    apartment_id                INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    water_price_per_unit        DECIMAL(10,2) NOT NULL DEFAULT 0,
    water_max_units             INTEGER NOT NULL DEFAULT 9999,
    electricity_price_per_unit  DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_max_units       INTEGER NOT NULL DEFAULT 9999,
    invoice_footer_text         TEXT DEFAULT '',
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id)
);

-- =====================================================
-- Table: meter_readings
-- =====================================================
CREATE TABLE meter_readings (
    reading_id                  SERIAL PRIMARY KEY,
    room_id                     INTEGER NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    month                       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                        INTEGER NOT NULL,
    water_units_last            DECIMAL(10,2) NOT NULL DEFAULT 0,
    water_units_current         DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_units_last      DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_units_current   DECIMAL(10,2) NOT NULL DEFAULT 0,
    rollover_water              BOOLEAN DEFAULT FALSE,
    rollover_electricity        BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

-- =====================================================
-- Table: bills
-- =====================================================
CREATE TABLE bills (
    bill_id          SERIAL PRIMARY KEY,
    room_id          INTEGER NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    month            INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year             INTEGER NOT NULL,
    water_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    rent_cost        DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

-- =====================================================
-- Table: admin_users
-- =====================================================
CREATE TABLE admin_users (
    admin_id        SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    apartment_id    INTEGER REFERENCES apartments(apartment_id),
    is_super_admin  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_rooms_apartment_id        ON rooms(apartment_id);
CREATE INDEX idx_rooms_status              ON rooms(status);
CREATE INDEX idx_tenants_room_id           ON tenants(room_id);
CREATE INDEX idx_tenants_national_id       ON tenants(national_id);
CREATE INDEX idx_tenants_is_active         ON tenants(is_active);
CREATE INDEX idx_meter_readings_room_id    ON meter_readings(room_id);
CREATE INDEX idx_meter_readings_month_year ON meter_readings(month, year);
CREATE INDEX idx_bills_room_id             ON bills(room_id);
CREATE INDEX idx_bills_month_year          ON bills(month, year);
CREATE INDEX idx_expense_settings_apt      ON expense_settings(apartment_id);
