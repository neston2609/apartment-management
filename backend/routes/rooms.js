/**
 * /api/rooms
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');

router.use(authenticate, adminOnly);

const fullAdmin = requireAdminRoles('super_admin', 'admin');

// ---------- Bulk: set uniform price for a floor ----------
router.put('/bulk/floor-price', fullAdmin, async (req, res) => {
    try {
        const { apartment_id, floor_number, rental_price } = req.body;
        if (!apartment_id || !floor_number || rental_price == null) {
            return res.status(400).json({ error: 'apartment_id, floor_number, rental_price required' });
        }
        const { rows } = await db.query(
            `UPDATE rooms
             SET rental_price = $1, updated_at = NOW()
             WHERE apartment_id = $2 AND floor_number = $3
             RETURNING room_id, room_number, rental_price`,
            [rental_price, apartment_id, floor_number]
        );
        return res.json({ data: rows });
    } catch (err) {
        console.error('[rooms/bulk]', err);
        return res.status(500).json({ error: 'Failed bulk update' });
    }
});

// ---------- Get single room detail ----------
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { rows } = await db.query(`
            SELECT r.*,
                   t.tenant_id, t.full_name AS tenant_name, t.phone_number AS tenant_phone,
                   t.move_in_date
            FROM rooms r
            LEFT JOIN tenants t ON t.room_id = r.room_id AND t.is_active = TRUE
            WHERE r.room_id = $1
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Room not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[rooms/get]', err);
        return res.status(500).json({ error: 'Failed to load room' });
    }
});

// ---------- Update room price/status/number ----------
router.put('/:id', fullAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { rental_price, status, room_number } = req.body;
        const trimmed = (room_number ?? '').toString().trim();
        const { rows } = await db.query(
            `UPDATE rooms
             SET rental_price = COALESCE($1, rental_price),
                 status       = COALESCE($2, status),
                 room_number  = COALESCE(NULLIF($3, ''), room_number),
                 updated_at   = NOW()
             WHERE room_id = $4
             RETURNING *`,
            [rental_price ?? null, status || null, trimmed, id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Room not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'เลขห้องนี้มีอยู่แล้วในอพาร์ทเมนต์' });
        }
        console.error('[rooms/update]', err);
        return res.status(500).json({ error: 'Failed to update room' });
    }
});

module.exports = router;
