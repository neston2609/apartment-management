-- =====================================================
-- Apartment Management System - Seed Data
-- =====================================================
-- NOTE: All password_hash values are bcrypt hashes generated
-- with salt rounds = 10.
--   admin1234   -> $2b$10$rXJ0eWv0Q6h7pK5qN9e8WuO5bD3F4r4cP9aG3T1nB6mC7yL2jK0qK
--   3101900012345 -> bcrypt hash of national_id (per business rules)
-- These hashes are placeholders; the seed.js script regenerates real ones.
-- =====================================================

-- Reset
TRUNCATE TABLE bills, meter_readings, expense_settings, tenants, rooms, apartments, admin_users RESTART IDENTITY CASCADE;

-- =====================================================
-- Sample Apartment
-- =====================================================
INSERT INTO apartments (name, address, contact_number, floors_count, rooms_per_floor)
VALUES (
    'อพาร์ทเมนต์สุขสันต์',
    '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    '02-123-4567',
    5,
    8
);

-- =====================================================
-- Sample Rooms (5 floors x 8 rooms = 40 rooms)
-- Room number = floor + LPAD(seq, 2, '0')
-- =====================================================
DO $$
DECLARE
    f INT;
    s INT;
    rn VARCHAR(20);
BEGIN
    FOR f IN 1..5 LOOP
        FOR s IN 1..8 LOOP
            rn := f::TEXT || LPAD(s::TEXT, 2, '0');
            INSERT INTO rooms (apartment_id, floor_number, room_sequence, room_number, rental_price, status)
            VALUES (1, f, s, rn, 3500.00, 'vacant');
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- Mark some rooms as occupied / maintenance / common / caretaker
-- =====================================================
UPDATE rooms SET status = 'occupied'    WHERE room_number IN ('101','103','205','307','410');
UPDATE rooms SET status = 'maintenance' WHERE room_number = '208';
UPDATE rooms SET status = 'common'      WHERE room_number = '108';
UPDATE rooms SET status = 'caretaker'   WHERE room_number = '501';

-- =====================================================
-- Sample Expense Settings
-- =====================================================
INSERT INTO expense_settings
    (apartment_id, water_price_per_unit, water_max_units,
     electricity_price_per_unit, electricity_max_units, invoice_footer_text)
VALUES (
    1, 18.00, 9999, 7.50, 9999,
    E'กรุณาชำระค่าเช่าภายในวันที่ 15 ของทุกเดือน\nหากชำระล่าช้าจะมีค่าปรับ 100 บาท/วัน'
);

-- =====================================================
-- NOTE: Tenants, admin_users, meter_readings, bills are
-- inserted by database/seed.js so that bcrypt hashes are
-- generated programmatically (cannot be done in SQL).
-- =====================================================
