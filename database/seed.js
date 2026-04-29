/**
 * Database seed runner.
 * 1. Runs database/seed.sql (apartments, rooms, expense_settings).
 * 2. Inserts admin_users + tenants with REAL bcrypt password hashes.
 * 3. Inserts sample meter_readings + bills for current month.
 *
 * Usage:
 *   node database/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const SALT_ROUNDS = 10;

async function main() {
    const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
    const pool = new Pool({
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT, 10),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      useSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
    });

    const seedPath = path.resolve(__dirname, 'seed.sql');
    const seedSql  = fs.readFileSync(seedPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log('[seed] Running seed.sql ...');
        await client.query(seedSql);

        // ----- Admin user -----
        const adminHash = await bcrypt.hash('admin1234', SALT_ROUNDS);
        await client.query(
            `INSERT INTO admin_users (username, password_hash, full_name, email, is_super_admin)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO UPDATE
             SET password_hash = EXCLUDED.password_hash`,
            ['admin', adminHash, 'ผู้ดูแลระบบ', 'admin@example.com', true]
        );
        console.log('[seed] Admin user created (username: admin / password: admin1234)');

        // ----- Tenants for the 5 occupied rooms -----
        const tenants = [
            { room: '101', name: 'นายสมชาย ใจดี',     nid: '1100100100011', phone: '081-111-1111' },
            { room: '103', name: 'นางสาวสมหญิง รักดี', nid: '1100100100022', phone: '081-222-2222' },
            { room: '205', name: 'นายวิชัย พากเพียร', nid: '1100100100033', phone: '081-333-3333' },
            { room: '307', name: 'นางนภา สุขใจ',      nid: '1100100100044', phone: '081-444-4444' },
            { room: '410', name: 'นายธนา มั่งมี',     nid: '1100100100055', phone: '081-555-5555' },
        ];

        for (const t of tenants) {
            const hash = await bcrypt.hash(t.nid, SALT_ROUNDS);
            const { rows } = await client.query(
                `SELECT room_id FROM rooms WHERE room_number = $1 AND apartment_id = 1`,
                [t.room]
            );
            if (!rows.length) continue;
            await client.query(
                `INSERT INTO tenants
                 (room_id, full_name, phone_number, national_id, move_in_date, password_hash, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                 ON CONFLICT (national_id) DO NOTHING`,
                [rows[0].room_id, t.name, t.phone, t.nid, '2024-01-01', hash]
            );
        }
        console.log(`[seed] Inserted ${tenants.length} tenants (default password = national_id)`);

        // ----- Sample meter readings + bills for current month -----
        const now   = new Date();
        const month = now.getMonth() + 1;
        const year  = now.getFullYear();
        const settings = (await client.query(
            `SELECT * FROM expense_settings WHERE apartment_id = 1`
        )).rows[0];

        const meterSamples = [
            { room: '101', wl: 100, wc: 112, el: 500, ec: 580 },
            { room: '103', wl: 90,  wc:  98, el: 420, ec: 470 },
            { room: '205', wl: 200, wc: 215, el: 800, ec: 875 },
            { room: '307', wl: 150, wc: 162, el: 600, ec: 660 },
            { room: '410', wl: 80,  wc:  90, el: 300, ec: 360 },
        ];

        for (const m of meterSamples) {
            const r = (await client.query(
                `SELECT room_id, rental_price FROM rooms WHERE room_number = $1 AND apartment_id = 1`,
                [m.room]
            )).rows[0];
            if (!r) continue;

            const water_usage = m.wc - m.wl;
            const elec_usage  = m.ec - m.el;
            const water_cost  = water_usage * Number(settings.water_price_per_unit);
            const elec_cost   = elec_usage  * Number(settings.electricity_price_per_unit);
            const rent_cost   = Number(r.rental_price);
            const total       = water_cost + elec_cost + rent_cost;

            await client.query(
                `INSERT INTO meter_readings
                 (room_id, month, year, water_units_last, water_units_current,
                  electricity_units_last, electricity_units_current)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (room_id, month, year) DO UPDATE
                 SET water_units_last       = EXCLUDED.water_units_last,
                     water_units_current    = EXCLUDED.water_units_current,
                     electricity_units_last = EXCLUDED.electricity_units_last,
                     electricity_units_current = EXCLUDED.electricity_units_current`,
                [r.room_id, month, year, m.wl, m.wc, m.el, m.ec]
            );

            await client.query(
                `INSERT INTO bills
                 (room_id, month, year, water_cost, electricity_cost, rent_cost, other_cost, total_cost)
                 VALUES ($1,$2,$3,$4,$5,$6,0,$7)
                 ON CONFLICT (room_id, month, year) DO UPDATE
                 SET water_cost       = EXCLUDED.water_cost,
                     electricity_cost = EXCLUDED.electricity_cost,
                     rent_cost        = EXCLUDED.rent_cost,
                     total_cost       = EXCLUDED.total_cost`,
                [r.room_id, month, year, water_cost, elec_cost, rent_cost, total]
            );
        }
        console.log(`[seed] Inserted meter readings + bills for ${month}/${year}`);

        console.log('[seed] Done.');
    } catch (err) {
        console.error('[seed] Failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('[seed] Fatal:', e);
    process.exit(1);
});
