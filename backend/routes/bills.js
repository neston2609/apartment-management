/**
 * /api/bills
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');
const fullAdmin = requireAdminRoles('super_admin', 'admin');

const { generateInvoicePDF, generateInvoicePDFEnglish, generateInvoicePDFBulk } = require('../utils/pdf');

// ---------- Helper: compute usage + cost ----------
function computeBill(meter, settings, rentCost, otherCost = 0) {
    const wMax = Number(settings.water_max_units);
    const eMax = Number(settings.electricity_max_units);
    const wp   = Number(settings.water_price_per_unit);
    const ep   = Number(settings.electricity_price_per_unit);

    const wl = Number(meter.water_units_last);
    const wc = Number(meter.water_units_current);
    const el = Number(meter.electricity_units_last);
    const ec = Number(meter.electricity_units_current);

    const water_usage = meter.rollover_water       ? (wMax - wl) + wc : wc - wl;
    const elec_usage  = meter.rollover_electricity ? (eMax - el) + ec : ec - el;

    const water_cost       = +(water_usage * wp).toFixed(2);
    const electricity_cost = +(elec_usage  * ep).toFixed(2);
    const rent             = Number(rentCost) || 0;
    const other            = Number(otherCost) || 0;
    const total_cost       = +(water_cost + electricity_cost + rent + other).toFixed(2);

    return { water_usage, elec_usage, water_cost, electricity_cost, total_cost };
}

// ---------- List bills ----------
router.get('/', authenticate, adminOnly, async (req, res) => {
    try {
        const month = req.query.month ? parseInt(req.query.month, 10) : null;
        const year  = req.query.year  ? parseInt(req.query.year,  10) : null;
        const aptId = req.query.apartment_id ? parseInt(req.query.apartment_id, 10) : null;

        const where = [];
        const params = [];
        if (month) { params.push(month); where.push(`b.month = $${params.length}`); }
        if (year)  { params.push(year);  where.push(`b.year  = $${params.length}`); }
        if (aptId) { params.push(aptId); where.push(`r.apartment_id = $${params.length}`); }
        const sql = `
            SELECT b.*,
                   r.room_number, r.apartment_id, r.rental_price, r.status,
                   t.full_name AS tenant_name
            FROM bills b
            JOIN rooms r ON r.room_id = b.room_id
            LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_active = TRUE
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY r.apartment_id, r.room_number
        `;
        const { rows } = await db.query(sql, params);
        return res.json({ data: rows });
    } catch (err) {
        console.error('[bills/list]', err);
        return res.status(500).json({ error: 'Failed to list bills' });
    }
});

// ---------- Get single bill ----------
router.get('/:id', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { rows } = await db.query(`
            SELECT b.*,
                   r.room_number, r.apartment_id, r.rental_price,
                   t.tenant_id, t.full_name AS tenant_name,
                   m.water_units_last, m.water_units_current,
                   m.electricity_units_last, m.electricity_units_current,
                   m.rollover_water, m.rollover_electricity
            FROM bills b
            JOIN rooms r ON r.room_id = b.room_id
            LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_active = TRUE
            LEFT JOIN meter_readings m
              ON m.room_id = b.room_id AND m.month = b.month AND m.year = b.year
            WHERE b.bill_id = $1
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Bill not found' });

        if (req.user.role === 'tenant' && req.user.room_id !== rows[0].room_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[bills/get]', err);
        return res.status(500).json({ error: 'Failed to load bill' });
    }
});

// ---------- Create or upsert bill + meter reading ----------
router.post('/', authenticate, adminOnly, fullAdmin, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const {
            room_id, month, year,
            water_units_last, water_units_current, rollover_water,
            electricity_units_last, electricity_units_current, rollover_electricity,
            rent_cost, other_cost,
        } = req.body;

        if (!room_id || !month || !year) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'room_id, month, year required' });
        }

        const room = await client.query(
            `SELECT r.rental_price, r.apartment_id FROM rooms r WHERE r.room_id = $1`,
            [room_id]
        );
        if (!room.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Room not found' });
        }
        const settings = (await client.query(
            `SELECT * FROM expense_settings WHERE apartment_id = $1`,
            [room.rows[0].apartment_id]
        )).rows[0] || { water_price_per_unit: 0, electricity_price_per_unit: 0,
                        water_max_units: 9999, electricity_max_units: 9999 };

        const meter = {
            water_units_last:          Number(water_units_last) || 0,
            water_units_current:       Number(water_units_current) || 0,
            electricity_units_last:    Number(electricity_units_last) || 0,
            electricity_units_current: Number(electricity_units_current) || 0,
            rollover_water:            !!rollover_water,
            rollover_electricity:      !!rollover_electricity,
        };
        const rent = rent_cost != null ? Number(rent_cost) : Number(room.rows[0].rental_price);
        const other = Number(other_cost) || 0;
        const calc = computeBill(meter, settings, rent, other);

        // Upsert meter reading
        await client.query(
            `INSERT INTO meter_readings
             (room_id, month, year, water_units_last, water_units_current,
              electricity_units_last, electricity_units_current,
              rollover_water, rollover_electricity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (room_id, month, year) DO UPDATE SET
                 water_units_last          = EXCLUDED.water_units_last,
                 water_units_current       = EXCLUDED.water_units_current,
                 electricity_units_last    = EXCLUDED.electricity_units_last,
                 electricity_units_current = EXCLUDED.electricity_units_current,
                 rollover_water            = EXCLUDED.rollover_water,
                 rollover_electricity      = EXCLUDED.rollover_electricity,
                 updated_at = NOW()`,
            [room_id, month, year,
             meter.water_units_last, meter.water_units_current,
             meter.electricity_units_last, meter.electricity_units_current,
             meter.rollover_water, meter.rollover_electricity]
        );

        // Upsert bill
        const { rows } = await client.query(
            `INSERT INTO bills
             (room_id, month, year, water_cost, electricity_cost, rent_cost, other_cost, total_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (room_id, month, year) DO UPDATE SET
                 water_cost       = EXCLUDED.water_cost,
                 electricity_cost = EXCLUDED.electricity_cost,
                 rent_cost        = EXCLUDED.rent_cost,
                 other_cost       = EXCLUDED.other_cost,
                 total_cost       = EXCLUDED.total_cost,
                 updated_at = NOW()
             RETURNING *`,
            [room_id, month, year, calc.water_cost, calc.electricity_cost, rent, other, calc.total_cost]
        );

        await client.query('COMMIT');
        return res.status(201).json({ data: { ...rows[0], ...calc } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[bills/create]', err);
        return res.status(500).json({ error: 'Failed to save bill' });
    } finally {
        client.release();
    }
});

// ---------- Update bill (same upsert path) ----------
router.put('/:id', authenticate, adminOnly, fullAdmin, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const id = parseInt(req.params.id, 10);
        const existing = await client.query(`SELECT * FROM bills WHERE bill_id = $1`, [id]);
        if (!existing.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Bill not found' });
        }
        const b = existing.rows[0];
        const body = req.body;

        const room = (await client.query(
            `SELECT r.apartment_id, r.rental_price FROM rooms r WHERE r.room_id = $1`,
            [b.room_id]
        )).rows[0];
        const settings = (await client.query(
            `SELECT * FROM expense_settings WHERE apartment_id = $1`,
            [room.apartment_id]
        )).rows[0] || { water_price_per_unit: 0, electricity_price_per_unit: 0,
                        water_max_units: 9999, electricity_max_units: 9999 };

        const meter = {
            water_units_last:          Number(body.water_units_last) || 0,
            water_units_current:       Number(body.water_units_current) || 0,
            electricity_units_last:    Number(body.electricity_units_last) || 0,
            electricity_units_current: Number(body.electricity_units_current) || 0,
            rollover_water:            !!body.rollover_water,
            rollover_electricity:      !!body.rollover_electricity,
        };
        const rent  = body.rent_cost  != null ? Number(body.rent_cost)  : Number(room.rental_price);
        const other = Number(body.other_cost) || 0;
        const calc  = computeBill(meter, settings, rent, other);

        await client.query(
            `INSERT INTO meter_readings
             (room_id, month, year, water_units_last, water_units_current,
              electricity_units_last, electricity_units_current,
              rollover_water, rollover_electricity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (room_id, month, year) DO UPDATE SET
                 water_units_last          = EXCLUDED.water_units_last,
                 water_units_current       = EXCLUDED.water_units_current,
                 electricity_units_last    = EXCLUDED.electricity_units_last,
                 electricity_units_current = EXCLUDED.electricity_units_current,
                 rollover_water            = EXCLUDED.rollover_water,
                 rollover_electricity      = EXCLUDED.rollover_electricity,
                 updated_at = NOW()`,
            [b.room_id, b.month, b.year,
             meter.water_units_last, meter.water_units_current,
             meter.electricity_units_last, meter.electricity_units_current,
             meter.rollover_water, meter.rollover_electricity]
        );

        const { rows } = await client.query(
            `UPDATE bills
             SET water_cost = $1, electricity_cost = $2, rent_cost = $3, other_cost = $4,
                 total_cost = $5, updated_at = NOW()
             WHERE bill_id = $6 RETURNING *`,
            [calc.water_cost, calc.electricity_cost, rent, other, calc.total_cost, id]
        );

        await client.query('COMMIT');
        return res.json({ data: { ...rows[0], ...calc } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[bills/update]', err);
        return res.status(500).json({ error: 'Failed to update bill' });
    } finally {
        client.release();
    }
});

// ---------- Get meter reading for room/month ----------
router.get('/meter/:room_id', authenticate, adminOnly, async (req, res) => {
    try {
        const room_id = parseInt(req.params.room_id, 10);
        const month   = parseInt(req.query.month, 10);
        const year    = parseInt(req.query.year, 10);
        const { rows } = await db.query(
            `SELECT * FROM meter_readings WHERE room_id = $1 AND month = $2 AND year = $3`,
            [room_id, month, year]
        );
        if (!rows.length) {
            // Find most recent prior reading to use as 'last'
            const prior = await db.query(
                `SELECT water_units_current AS water_units_last,
                        electricity_units_current AS electricity_units_last
                 FROM meter_readings
                 WHERE room_id = $1 AND (year < $2 OR (year = $2 AND month < $3))
                 ORDER BY year DESC, month DESC LIMIT 1`,
                [room_id, year, month]
            );
            return res.json({
                data: prior.rows[0] || { water_units_last: 0, electricity_units_last: 0 },
            });
        }
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[bills/meter]', err);
        return res.status(500).json({ error: 'Failed to load meter' });
    }
});

// ---------- Tenant: list own bills ----------
router.get('/tenant/me', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { rows } = await db.query(`
            SELECT b.*, r.room_number
            FROM bills b
            JOIN rooms r ON r.room_id = b.room_id
            WHERE b.room_id = $1
            ORDER BY b.year DESC, b.month DESC
        `, [req.user.room_id]);
        return res.json({ data: rows });
    } catch (err) {
        console.error('[bills/tenant/me]', err);
        return res.status(500).json({ error: 'Failed to load bills' });
    }
});

// ---------- Bill PDF ----------
router.get('/:id/pdf', authenticate, async (req, res) => {
    try {
        const id   = parseInt(req.params.id, 10);
        const size = (req.query.size || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';
        const lang = (req.query.lang || 'th').toLowerCase() === 'en' ? 'en' : 'th';

        const { rows } = await db.query(`
            SELECT b.*,
                   r.room_number, r.apartment_id,
                   t.full_name AS tenant_name,
                   m.water_units_last, m.water_units_current,
                   m.electricity_units_last, m.electricity_units_current,
                   a.name AS apartment_name, a.address AS apartment_address,
                   a.contact_number AS apartment_phone,
                   s.water_price_per_unit, s.electricity_price_per_unit, s.invoice_footer_text
            FROM bills b
            JOIN rooms r ON r.room_id = b.room_id
            JOIN apartments a ON a.apartment_id = r.apartment_id
            LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_active = TRUE
            LEFT JOIN meter_readings m
              ON m.room_id = b.room_id AND m.month = b.month AND m.year = b.year
            LEFT JOIN expense_settings s ON s.apartment_id = r.apartment_id
            WHERE b.bill_id = $1
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Bill not found' });

        if (req.user.role === 'tenant' && req.user.room_id !== rows[0].room_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="invoice_${id}_${lang}_${size}.pdf"`);
        if (lang === 'en') {
            generateInvoicePDFEnglish(rows[0], size, res);
        } else {
            generateInvoicePDF(rows[0], size, res);
        }
    } catch (err) {
        console.error('[bills/pdf]', err);
        return res.status(500).json({ error: 'Failed to generate PDF' });
    }
});


// ---------- Bulk import from Excel ----------
// Body: { apartment_id, month, year, rows: [{ room_no, water, electric, status?, notes? }] }
router.post('/import', authenticate, adminOnly, fullAdmin, async (req, res) => {
    const apartmentId = parseInt(req.body.apartment_id, 10);
    const month       = parseInt(req.body.month, 10);
    const year        = parseInt(req.body.year, 10);
    const rows        = Array.isArray(req.body.rows) ? req.body.rows : [];

    if (!apartmentId || !month || month < 1 || month > 12 || !year || !rows.length) {
        return res.status(400).json({ error: 'apartment_id, month, year, rows required' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Settings + room map
        const settings = (await client.query(
            `SELECT * FROM expense_settings WHERE apartment_id = $1`, [apartmentId]
        )).rows[0] || {
            water_price_per_unit: 0, electricity_price_per_unit: 0,
            water_max_units: 9999, electricity_max_units: 9999,
        };
        const roomRows = (await client.query(
            `SELECT room_id, room_number, rental_price FROM rooms WHERE apartment_id = $1`,
            [apartmentId]
        )).rows;
        const roomMap = new Map(roomRows.map((r) => [String(r.room_number).trim(), r]));

        let imported = 0, updated = 0, skipped = 0;
        const missingRooms = [];
        const items = [];

        for (const r of rows) {
            const roomNo = String(r.room_no ?? '').trim();
            const water  = Number(r.water);
            const elec   = Number(r.electric);
            if (!roomNo) { skipped++; continue; }
            if (!Number.isFinite(water) || !Number.isFinite(elec)) { skipped++; continue; }

            const room = roomMap.get(roomNo);
            if (!room) { missingRooms.push(roomNo); skipped++; continue; }

            // Prior meter reading (for this room, before target month/year)
            const prior = (await client.query(
                `SELECT water_units_current, electricity_units_current
                 FROM meter_readings
                 WHERE room_id = $1 AND (year < $2 OR (year = $2 AND month < $3))
                 ORDER BY year DESC, month DESC LIMIT 1`,
                [room.room_id, year, month]
            )).rows[0];

            const wLast = prior ? Number(prior.water_units_current) : 0;
            const eLast = prior ? Number(prior.electricity_units_current) : 0;

            const wUsage = Math.max(0, water - wLast);
            const eUsage = Math.max(0, elec  - eLast);
            const wCost  = +(wUsage * Number(settings.water_price_per_unit)).toFixed(2);
            const eCost  = +(eUsage * Number(settings.electricity_price_per_unit)).toFixed(2);
            const rent   = Number(room.rental_price) || 0;

            // Existing bill & meter for this room/month/year
            const existingBill = (await client.query(
                `SELECT bill_id, other_cost FROM bills WHERE room_id = $1 AND month = $2 AND year = $3`,
                [room.room_id, month, year]
            )).rows[0];

            const other = existingBill ? Number(existingBill.other_cost) : 0;
            const total = +(wCost + eCost + rent + other).toFixed(2);

            // Upsert meter_readings (overwrite current; preserve last from prior or compute)
            await client.query(
                `INSERT INTO meter_readings
                 (room_id, month, year,
                  water_units_last, water_units_current,
                  electricity_units_last, electricity_units_current)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (room_id, month, year) DO UPDATE SET
                     water_units_last          = EXCLUDED.water_units_last,
                     water_units_current       = EXCLUDED.water_units_current,
                     electricity_units_last    = EXCLUDED.electricity_units_last,
                     electricity_units_current = EXCLUDED.electricity_units_current,
                     updated_at = NOW()`,
                [room.room_id, month, year, wLast, water, eLast, elec]
            );

            // Upsert bill
            await client.query(
                `INSERT INTO bills
                 (room_id, month, year, water_cost, electricity_cost, rent_cost, other_cost, total_cost)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (room_id, month, year) DO UPDATE SET
                     water_cost       = EXCLUDED.water_cost,
                     electricity_cost = EXCLUDED.electricity_cost,
                     rent_cost        = EXCLUDED.rent_cost,
                     total_cost       = EXCLUDED.total_cost,
                     updated_at = NOW()`,
                [room.room_id, month, year, wCost, eCost, rent, other, total]
            );

            if (existingBill) updated++; else imported++;
            items.push({
                room_no: roomNo, water_last: wLast, water_current: water, water_usage: wUsage, water_cost: wCost,
                elec_last: eLast, elec_current: elec, elec_usage: eUsage, elec_cost: eCost,
                rent, other, total, action: existingBill ? 'updated' : 'created',
            });
        }

        await client.query('COMMIT');
        return res.json({
            data: {
                summary: {
                    rows_in:  rows.length,
                    imported, updated, skipped,
                    missing_rooms: [...new Set(missingRooms)],
                },
                items,
            },
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[bills/import]', err);
        return res.status(500).json({ error: 'Import failed: ' + err.message });
    } finally {
        client.release();
    }
});



// ---------- Bulk PDF (single file, many bills) ----------
// POST /api/bills/bulk-pdf  body: { bill_ids: [int...], size?: 'A4'|'A5', lang?: 'th'|'en' }
router.post('/bulk-pdf', authenticate, adminOnly, async (req, res) => {
    try {
        const ids   = Array.isArray(req.body.bill_ids) ? req.body.bill_ids.map((x) => parseInt(x, 10)).filter(Boolean) : [];
        const size  = (req.body.size || 'A5').toUpperCase() === 'A4' ? 'A4' : 'A5';
        const lang  = (req.body.lang || 'th').toLowerCase() === 'en' ? 'en' : 'th';
        if (!ids.length) return res.status(400).json({ error: 'bill_ids required' });

        const { rows } = await db.query(`
            SELECT b.*,
                   r.room_number, r.apartment_id,
                   t.full_name AS tenant_name,
                   m.water_units_last, m.water_units_current,
                   m.electricity_units_last, m.electricity_units_current,
                   a.name AS apartment_name, a.address AS apartment_address,
                   a.contact_number AS apartment_phone,
                   s.water_price_per_unit, s.electricity_price_per_unit, s.invoice_footer_text
            FROM bills b
            JOIN rooms r       ON r.room_id = b.room_id
            JOIN apartments a  ON a.apartment_id = r.apartment_id
            LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_active = TRUE
            LEFT JOIN meter_readings m
              ON m.room_id = b.room_id AND m.month = b.month AND m.year = b.year
            LEFT JOIN expense_settings s ON s.apartment_id = r.apartment_id
            WHERE b.bill_id = ANY($1::int[])
            ORDER BY r.apartment_id, r.room_number
        `, [ids]);

        if (!rows.length) return res.status(404).json({ error: 'No bills found' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="bills_bulk_${size}_${lang}.pdf"`);
        generateInvoicePDFBulk(rows, size, lang, res);
    } catch (err) {
        console.error('[bills/bulk-pdf]', err);
        return res.status(500).json({ error: 'Failed to generate bulk PDF' });
    }
});


module.exports = router;
