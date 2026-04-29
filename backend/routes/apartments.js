/**
 * /api/apartments
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');

router.use(authenticate, adminOnly);

const fullAdmin = requireAdminRoles('super_admin', 'admin');

// Helper: build a room number from floor + sequence
function roomNumber(floor, seq) {
    return `${floor}${String(seq).padStart(2, '0')}`;
}

// ---------- List all apartments ----------
router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT a.*,
                   COUNT(r.room_id)                                       AS rooms_total,
                   COUNT(r.room_id) FILTER (WHERE r.status = 'occupied')  AS rooms_occupied,
                   COUNT(r.room_id) FILTER (WHERE r.status = 'vacant')    AS rooms_vacant
            FROM apartments a
            LEFT JOIN rooms r ON r.apartment_id = a.apartment_id
            GROUP BY a.apartment_id
            ORDER BY a.apartment_id
        `);
        return res.json({ data: rows });
    } catch (err) {
        console.error('[apartments/list]', err);
        return res.status(500).json({ error: 'Failed to load apartments' });
    }
});

// ---------- Get apartment detail + settings ----------
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const a  = await db.query(`SELECT * FROM apartments WHERE apartment_id = $1`, [id]);
        if (!a.rows.length) return res.status(404).json({ error: 'Apartment not found' });

        const s = await db.query(`SELECT * FROM expense_settings WHERE apartment_id = $1`, [id]);
        return res.json({ data: { ...a.rows[0], settings: s.rows[0] || null } });
    } catch (err) {
        console.error('[apartments/get]', err);
        return res.status(500).json({ error: 'Failed to load apartment' });
    }
});

// ---------- Create apartment + auto-generate rooms + default settings ----------
router.post('/', fullAdmin,
    body('name').isString().trim().notEmpty(),
    body('address').isString().trim().notEmpty(),
    body('floors_count').isInt({ min: 1 }),
    body('rooms_per_floor').isInt({ min: 1 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const { name, address, contact_number, floors_count, rooms_per_floor, starting_price } = req.body;
            const price = Number(starting_price) || 0;

            const ins = await client.query(
                `INSERT INTO apartments (name, address, contact_number, floors_count, rooms_per_floor)
                 VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [name, address, contact_number || null, floors_count, rooms_per_floor]
            );
            const apt = ins.rows[0];

            for (let f = 1; f <= floors_count; f++) {
                for (let s = 1; s <= rooms_per_floor; s++) {
                    await client.query(
                        `INSERT INTO rooms
                         (apartment_id, floor_number, room_sequence, room_number, rental_price, status)
                         VALUES ($1,$2,$3,$4,$5,'vacant')`,
                        [apt.apartment_id, f, s, roomNumber(f, s), price]
                    );
                }
            }

            await client.query(
                `INSERT INTO expense_settings (apartment_id) VALUES ($1)`,
                [apt.apartment_id]
            );

            await client.query('COMMIT');
            return res.status(201).json({ data: apt });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[apartments/create]', err);
            return res.status(500).json({ error: 'Failed to create apartment' });
        } finally {
            client.release();
        }
    }
);

// ---------- Update apartment info ----------
router.put('/:id', fullAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, address, contact_number, floors_count, rooms_per_floor } = req.body;
        const { rows } = await db.query(
            `UPDATE apartments
             SET name = COALESCE($1, name),
                 address = COALESCE($2, address),
                 contact_number = COALESCE($3, contact_number),
                 floors_count = COALESCE($4, floors_count),
                 rooms_per_floor = COALESCE($5, rooms_per_floor),
                 updated_at = NOW()
             WHERE apartment_id = $6
             RETURNING *`,
            [name || null, address || null, contact_number || null,
             floors_count || null, rooms_per_floor || null, id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Apartment not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[apartments/update]', err);
        return res.status(500).json({ error: 'Failed to update apartment' });
    }
});

// ---------- Delete apartment ----------
// GET /:id/delete-preview      -> returns counts so the UI can warn
// DELETE /:id?force=true       -> actually deletes (cascade handles rooms/bills/meters/settings)
router.get('/:id/delete-preview', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { rows } = await db.query(`
            SELECT
              (SELECT COUNT(*) FROM rooms          r WHERE r.apartment_id = $1)                                    AS rooms,
              (SELECT COUNT(*) FROM tenants        t JOIN rooms r ON t.room_id = r.room_id
                 WHERE r.apartment_id = $1 AND t.is_active = TRUE)                                                  AS active_tenants,
              (SELECT COUNT(*) FROM bills          b JOIN rooms r ON b.room_id = r.room_id WHERE r.apartment_id=$1) AS bills,
              (SELECT COUNT(*) FROM meter_readings m JOIN rooms r ON m.room_id = r.room_id WHERE r.apartment_id=$1) AS meter_readings
        `, [id]);
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[apartments/delete-preview]', err);
        return res.status(500).json({ error: 'Failed to preview delete' });
    }
});

router.delete('/:id', fullAdmin, async (req, res) => {
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const id = parseInt(req.params.id, 10);

        const exists = await client.query(`SELECT 1 FROM apartments WHERE apartment_id = $1`, [id]);
        if (!exists.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Apartment not found' });
        }

        // Block accidental destruction unless force=true
        if (!force) {
            const c = await client.query(`
                SELECT COUNT(*) AS active FROM tenants t
                JOIN rooms r ON t.room_id = r.room_id
                WHERE r.apartment_id = $1 AND t.is_active = TRUE
            `, [id]);
            if (parseInt(c.rows[0].active, 10) > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: `Apartment has ${c.rows[0].active} active tenants. Pass ?force=true to confirm deletion (this also moves them out).`,
                });
            }
        }

        // Move out any remaining active tenants (cascade would set their room_id to NULL, but
        // we want is_active=false too so they disappear from active lists).
        await client.query(`
            UPDATE tenants
               SET is_active = FALSE,
                   move_out_date = COALESCE(move_out_date, CURRENT_DATE),
                   updated_at = NOW()
             WHERE room_id IN (SELECT room_id FROM rooms WHERE apartment_id = $1)
               AND is_active = TRUE
        `, [id]);

        // Cascade deletes rooms, expense_settings, meter_readings, bills.
        await client.query(`DELETE FROM apartments WHERE apartment_id = $1`, [id]);

        await client.query('COMMIT');
        return res.json({ data: { apartment_id: id, deleted: true } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[apartments/delete]', err);
        return res.status(500).json({ error: 'Failed to delete apartment' });
    } finally {
        client.release();
    }
});

// ---------- List rooms for an apartment ----------
router.get('/:id/rooms', async (req, res) => {
    try {
        const id      = parseInt(req.params.id, 10);
        const status  = req.query.status;
        const params  = [id];
        let where = `WHERE r.apartment_id = $1`;
        if (status) {
            params.push(status);
            where += ` AND r.status = $2`;
        }
        const { rows } = await db.query(`
            SELECT r.*,
                   t.tenant_id, t.full_name AS tenant_name, t.phone_number AS tenant_phone
            FROM rooms r
            LEFT JOIN tenants t
              ON t.room_id = r.room_id AND t.is_active = TRUE
            ${where}
            ORDER BY r.floor_number, r.room_sequence
        `, params);
        return res.json({ data: rows });
    } catch (err) {
        console.error('[apartments/rooms]', err);
        return res.status(500).json({ error: 'Failed to load rooms' });
    }
});

// ---------- Update settings ----------
router.put('/:id/settings', fullAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const {
            water_price_per_unit, water_max_units,
            electricity_price_per_unit, electricity_max_units,
            invoice_footer_text,
        } = req.body;

        const { rows } = await db.query(
            `INSERT INTO expense_settings
             (apartment_id, water_price_per_unit, water_max_units,
              electricity_price_per_unit, electricity_max_units, invoice_footer_text)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (apartment_id) DO UPDATE SET
                 water_price_per_unit       = EXCLUDED.water_price_per_unit,
                 water_max_units            = EXCLUDED.water_max_units,
                 electricity_price_per_unit = EXCLUDED.electricity_price_per_unit,
                 electricity_max_units      = EXCLUDED.electricity_max_units,
                 invoice_footer_text        = EXCLUDED.invoice_footer_text,
                 updated_at = NOW()
             RETURNING *`,
            [id,
             water_price_per_unit ?? 0, water_max_units ?? 9999,
             electricity_price_per_unit ?? 0, electricity_max_units ?? 9999,
             invoice_footer_text ?? '']
        );
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[apartments/settings]', err);
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;
