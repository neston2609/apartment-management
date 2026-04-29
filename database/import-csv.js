/**
 * CSV importer for old apartment data → new system.
 *
 * Expected CSV columns (header row required):
 *   room_no, bill_year, bill_month, bill_date,
 *   old_water, new_water, water_price,
 *   old_electric, new_electric, electric_price,
 *   other_price, room_price
 *
 * Year handling:
 *   Years 1900–2100 are treated as Gregorian and used as-is.
 *   Years 2400–2700 are treated as Buddhist (พ.ศ.) and converted by -543.
 *   Anything else is rejected (the row is skipped with a warning).
 *
 * Usage:
 *   node database/import-csv.js --file <csv> [--apartment-id N]
 *                              [--create-missing-rooms] [--dry-run]
 *
 * Defaults:
 *   --file              required
 *   --apartment-id      auto if exactly one apartment exists; otherwise required
 *   --create-missing-rooms   false (rooms must exist; rows for missing rooms are skipped)
 *   --dry-run           false (set to print summary without writing)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// -------- CLI args --------
function arg(name, def = undefined) {
    const ix = process.argv.indexOf(`--${name}`);
    if (ix < 0) return def;
    const next = process.argv[ix + 1];
    if (!next || next.startsWith('--')) return true; // flag with no value
    return next;
}

const FILE   = arg('file');
const APT_ID = arg('apartment-id') ? parseInt(arg('apartment-id'), 10) : null;
const CREATE_ROOMS = !!arg('create-missing-rooms', false);
const DRY    = !!arg('dry-run', false);

if (!FILE) {
    console.error('ERROR: --file <path> is required');
    process.exit(1);
}
if (!fs.existsSync(FILE)) {
    console.error(`ERROR: file not found: ${FILE}`);
    process.exit(1);
}

// -------- minimal CSV parser (handles quoted commas + CRLF) --------
function parseCsv(raw) {
    const out = [];
    let row = [], cell = '', inQuote = false, i = 0;
    while (i < raw.length) {
        const c = raw[i];
        if (inQuote) {
            if (c === '"' && raw[i + 1] === '"') { cell += '"'; i += 2; continue; }
            if (c === '"') { inQuote = false; i++; continue; }
            cell += c; i++; continue;
        }
        if (c === '"')                  { inQuote = true; i++; continue; }
        if (c === ',')                  { row.push(cell); cell = ''; i++; continue; }
        if (c === '\r')                 { i++; continue; }
        if (c === '\n')                 { row.push(cell); out.push(row); row = []; cell = ''; i++; continue; }
        cell += c; i++;
    }
    if (cell.length || row.length) { row.push(cell); out.push(row); }
    return out;
}

// -------- helpers --------
const num = (v) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) ? n : 0;
};
function normaliseYear(y) {
    const n = parseInt(String(y).trim(), 10);
    if (!Number.isFinite(n)) return null;
    if (n >= 1900 && n <= 2100) return { year: n, source: 'gregorian' };
    if (n >= 2400 && n <= 2700) return { year: n - 543, source: 'buddhist→gregorian' };
    return null;
}
function deriveFloor(roomNo) {
    // "111" → floor 1, "1208" → floor 12
    const s = String(roomNo).trim();
    if (s.length <= 2) return 1;
    return parseInt(s.slice(0, s.length - 2), 10);
}
function deriveSeq(roomNo) {
    const s = String(roomNo).trim();
    return parseInt(s.slice(-2), 10);
}

// -------- main --------
(async () => {
    const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
    });

    let apartmentId = APT_ID;
    try {
        if (!apartmentId) {
            const { rows } = await pool.query(`SELECT apartment_id, name FROM apartments ORDER BY apartment_id`);
            if (rows.length === 0) {
                console.error('ERROR: no apartments exist. Create one first.');
                process.exit(1);
            }
            if (rows.length > 1) {
                console.error('ERROR: more than one apartment exists. Specify --apartment-id N. Choices:');
                rows.forEach((r) => console.error(`  ${r.apartment_id}  ${r.name}`));
                process.exit(1);
            }
            apartmentId = rows[0].apartment_id;
            console.log(`[import] Auto-selected apartment_id=${apartmentId} (${rows[0].name})`);
        }

        const raw = fs.readFileSync(FILE, 'utf8');
        const grid = parseCsv(raw).filter((r) => r.length && r.some((c) => c.trim() !== ''));
        const header = grid.shift().map((h) => h.trim().toLowerCase());

        const required = ['room_no','bill_year','bill_month','old_water','new_water',
                          'water_price','old_electric','new_electric','electric_price',
                          'other_price','room_price'];
        const missing = required.filter((c) => !header.includes(c));
        if (missing.length) {
            console.error('ERROR: CSV missing columns:', missing.join(', '));
            process.exit(1);
        }
        const idx = (k) => header.indexOf(k);

        // Pre-load existing rooms in this apartment for fast lookup
        const roomMap = new Map(); // room_number(string) -> room_id
        const { rows: roomRows } = await pool.query(
            `SELECT room_id, room_number FROM rooms WHERE apartment_id = $1`,
            [apartmentId]
        );
        roomRows.forEach((r) => roomMap.set(String(r.room_number).trim(), r.room_id));

        // Pass 1 — validate & summarise
        const ops = [];
        const skipped = [];
        const yearStats = {};
        const missingRooms = new Set();

        for (let li = 0; li < grid.length; li++) {
            const row = grid[li];
            const roomNo = String(row[idx('room_no')] || '').trim();
            const yObj   = normaliseYear(row[idx('bill_year')]);
            const month  = parseInt(String(row[idx('bill_month')] || '').trim(), 10);

            if (!roomNo) { skipped.push({ line: li + 2, reason: 'empty room_no' }); continue; }
            if (!yObj)   { skipped.push({ line: li + 2, reason: `bad year: ${row[idx('bill_year')]}` }); continue; }
            if (!Number.isFinite(month) || month < 1 || month > 12) {
                skipped.push({ line: li + 2, reason: `bad month: ${row[idx('bill_month')]}` }); continue;
            }
            yearStats[yObj.year] = (yearStats[yObj.year] || 0) + 1;

            let roomId = roomMap.get(roomNo);
            if (!roomId) {
                missingRooms.add(roomNo);
                if (!CREATE_ROOMS) {
                    skipped.push({ line: li + 2, reason: `room ${roomNo} not in apartment ${apartmentId}` });
                    continue;
                }
            }

            const wLast = num(row[idx('old_water')]);
            const wCur  = num(row[idx('new_water')]);
            const eLast = num(row[idx('old_electric')]);
            const eCur  = num(row[idx('new_electric')]);
            const wCost = num(row[idx('water_price')]);
            const eCost = num(row[idx('electric_price')]);
            const rent  = num(row[idx('room_price')]);
            const other = num(row[idx('other_price')]);
            const total = +(wCost + eCost + rent + other).toFixed(2);

            ops.push({
                roomNo, roomId,
                month, year: yObj.year, yearSource: yObj.source,
                wLast, wCur, eLast, eCur,
                wCost, eCost, rent, other, total,
            });
        }

        // Summary
        console.log('');
        console.log(`File:           ${path.resolve(FILE)}`);
        console.log(`Apartment:      #${apartmentId}`);
        console.log(`Rows total:     ${grid.length}`);
        console.log(`To import:      ${ops.length}`);
        console.log(`Skipped:        ${skipped.length}`);
        if (skipped.length) {
            console.log('  First 10 skipped:');
            skipped.slice(0, 10).forEach((s) => console.log(`    line ${s.line}: ${s.reason}`));
        }
        console.log('Years detected: ' +
            Object.entries(yearStats).map(([y, n]) => `${y}=${n}`).join(', '));
        if (missingRooms.size) {
            console.log(`Missing rooms (${missingRooms.size}): ${[...missingRooms].sort().join(', ')}`);
            if (CREATE_ROOMS) console.log('  → will be CREATED (--create-missing-rooms)');
            else              console.log('  → SKIPPED (pass --create-missing-rooms to import them)');
        }

        if (DRY) {
            console.log('\n[--dry-run] No changes written. Re-run without --dry-run to commit.');
            await pool.end();
            return;
        }

        // Pass 2 — actually write, in a single transaction
        const client = await pool.connect();
        let createdRooms = 0, upMeters = 0, upBills = 0;
        try {
            await client.query('BEGIN');

            // Create missing rooms first if asked
            if (CREATE_ROOMS && missingRooms.size) {
                for (const rn of missingRooms) {
                    const floor = deriveFloor(rn);
                    const seq   = deriveSeq(rn);
                    const ins = await client.query(
                        `INSERT INTO rooms
                         (apartment_id, floor_number, room_sequence, room_number, rental_price, status)
                         VALUES ($1,$2,$3,$4,$5,'vacant')
                         ON CONFLICT (apartment_id, room_number) DO UPDATE
                         SET updated_at = NOW()
                         RETURNING room_id`,
                        [apartmentId, floor, seq, rn, 0]
                    );
                    roomMap.set(rn, ins.rows[0].room_id);
                    createdRooms++;
                }
            }

            // Now upsert meter readings + bills
            for (const op of ops) {
                const roomId = op.roomId || roomMap.get(op.roomNo);
                if (!roomId) continue;

                await client.query(
                    `INSERT INTO meter_readings
                     (room_id, month, year, water_units_last, water_units_current,
                      electricity_units_last, electricity_units_current)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (room_id, month, year) DO UPDATE SET
                         water_units_last          = EXCLUDED.water_units_last,
                         water_units_current       = EXCLUDED.water_units_current,
                         electricity_units_last    = EXCLUDED.electricity_units_last,
                         electricity_units_current = EXCLUDED.electricity_units_current,
                         updated_at = NOW()`,
                    [roomId, op.month, op.year, op.wLast, op.wCur, op.eLast, op.eCur]
                );
                upMeters++;

                await client.query(
                    `INSERT INTO bills
                     (room_id, month, year, water_cost, electricity_cost, rent_cost, other_cost, total_cost)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     ON CONFLICT (room_id, month, year) DO UPDATE SET
                         water_cost       = EXCLUDED.water_cost,
                         electricity_cost = EXCLUDED.electricity_cost,
                         rent_cost        = EXCLUDED.rent_cost,
                         other_cost       = EXCLUDED.other_cost,
                         total_cost       = EXCLUDED.total_cost,
                         updated_at = NOW()`,
                    [roomId, op.month, op.year, op.wCost, op.eCost, op.rent, op.other, op.total]
                );
                upBills++;
            }

            await client.query('COMMIT');
            console.log('');
            console.log(`✓ Rooms created:   ${createdRooms}`);
            console.log(`✓ Meter readings:  ${upMeters} upserted`);
            console.log(`✓ Bills:           ${upBills} upserted`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('ROLLED BACK:', e.message);
            process.exitCode = 1;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Fatal:', e);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
