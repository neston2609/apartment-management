/**
 * /api/tenants
 *   GET    /                  -> list active tenants (admin)
 *   GET    /:id               -> single tenant (admin or self)
 *   POST   /                  -> create tenant (super_admin/admin)
 *   PUT    /:id               -> update (any admin role: super_admin/admin/property_manager)
 *   PUT    /me/profile        -> tenant edits their own profile
 *   POST   /:id/moveout       -> move out (super_admin/admin)
 *   GET    /:id/contract      -> generate contract PDF
 */
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authenticate, adminOnly, tenantOnly, requireAdminRoles } = require('../middleware/auth');
const { generateContractPDF } = require('../utils/pdf');

const SALT_ROUNDS = 10;
const fullAdmin = requireAdminRoles('super_admin', 'admin');

// ---------- List active tenants ----------
router.get('/', authenticate, adminOnly, async (req, res) => {
    try {
        const apartmentId = req.query.apartment_id ? parseInt(req.query.apartment_id, 10) : null;
        const params = [];
        let where = `WHERE t.is_active = TRUE`;
        if (apartmentId) {
            params.push(apartmentId);
            where += ` AND r.apartment_id = $${params.length}`;
        }
        const { rows } = await db.query(`
            SELECT t.tenant_id, t.full_name, t.phone_number, t.national_id,
                   t.move_in_date, t.move_out_date, t.email, t.notes, t.is_active, t.address,
                   r.room_id, r.room_number, r.apartment_id, r.rental_price
            FROM tenants t
            LEFT JOIN rooms r ON r.room_id = t.room_id
            ${where}
            ORDER BY r.apartment_id, r.room_number
        `, params);
        return res.json({ data: rows });
    } catch (err) {
        console.error('[tenants/list]', err);
        return res.status(500).json({ error: 'Failed to load tenants' });
    }
});

// ---------- Tenant: edit own profile ----------
router.put('/me/profile', authenticate, async (req, res) => {
    if (req.user.role !== 'tenant') return res.status(403).json({ error: 'Tenant only' });
    try {
        const id = req.user.id;
        const { full_name, phone_number, email, address, national_id } = req.body;
        const newNid = (national_id ?? '').toString().trim();
        const { rows } = await db.query(
            `UPDATE tenants
             SET full_name    = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 email        = COALESCE($3, email),
                 address      = COALESCE($4, address),
                 national_id  = COALESCE(NULLIF($5, ''), national_id),
                 updated_at   = NOW()
             WHERE tenant_id = $6
             RETURNING tenant_id, full_name, phone_number, email, address, national_id, is_active`,
            [full_name || null, phone_number || null, email || null,
             address || null, newNid || null, id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'เลขบัตรประชาชนนี้มีผู้ใช้อยู่แล้ว' });
        console.error('[tenants/me/profile]', err);
        return res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ---------- Get single tenant ----------
router.get('/:id', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (req.user.role === 'tenant' && req.user.id !== id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { rows } = await db.query(`
            SELECT t.tenant_id, t.full_name, t.phone_number, t.national_id,
                   t.move_in_date, t.move_out_date, t.email, t.notes, t.is_active, t.address,
                   r.room_id, r.room_number, r.apartment_id, r.rental_price,
                   a.name AS apartment_name, a.address AS apartment_address,
                   a.contact_number AS apartment_phone
            FROM tenants t
            LEFT JOIN rooms r ON r.room_id = t.room_id
            LEFT JOIN apartments a ON a.apartment_id = r.apartment_id
            WHERE t.tenant_id = $1
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[tenants/get]', err);
        return res.status(500).json({ error: 'Failed to load tenant' });
    }
});

// ---------- Create tenant ----------
router.post(
    '/',
    authenticate, adminOnly, fullAdmin,
    body('room_id').isInt({ min: 1 }),
    body('full_name').isString().trim().notEmpty(),
    body('national_id').isString().trim().notEmpty(),
    body('move_in_date').isISO8601(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const { room_id, full_name, phone_number, national_id, move_in_date, email, notes, address } = req.body;

            const room = await client.query(`SELECT status FROM rooms WHERE room_id = $1 FOR UPDATE`, [room_id]);
            if (!room.rows.length) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Room not found' });
            }

            const hash = await bcrypt.hash(national_id, SALT_ROUNDS);
            const ins = await client.query(
                `INSERT INTO tenants
                 (room_id, full_name, phone_number, national_id, move_in_date, email,
                  password_hash, notes, address, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
                 RETURNING tenant_id, room_id, full_name, phone_number, national_id,
                           move_in_date, email, notes, address, is_active`,
                [room_id, full_name, phone_number || null, national_id, move_in_date,
                 email || null, hash, notes || null, address || null]
            );

            await client.query(
                `UPDATE rooms SET status = 'occupied', updated_at = NOW() WHERE room_id = $1`,
                [room_id]
            );

            await client.query('COMMIT');
            return res.status(201).json({ data: ins.rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            if (err.code === '23505') return res.status(409).json({ error: 'National ID already exists' });
            console.error('[tenants/create]', err);
            return res.status(500).json({ error: 'Failed to create tenant' });
        } finally {
            client.release();
        }
    }
);

// ---------- Update tenant (any admin role; property_manager allowed) ----------
router.put('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { full_name, phone_number, email, notes, move_in_date,
                national_id, reset_password, address } = req.body;
        const newNid = (national_id ?? '').toString().trim();

        const params = [
            full_name || null,        // $1
            phone_number || null,     // $2
            email || null,            // $3
            notes || null,            // $4
            move_in_date || null,     // $5
            newNid || null,           // $6
            address || null,          // $7
            id,                       // $8
        ];

        let extraSet = '';
        if (newNid && reset_password) {
            const newHash = await bcrypt.hash(newNid, SALT_ROUNDS);
            params.push(newHash);     // $9
            extraSet = `, password_hash = $${params.length}`;
        }

        const { rows } = await db.query(
            `UPDATE tenants
             SET full_name    = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 email        = COALESCE($3, email),
                 notes        = COALESCE($4, notes),
                 move_in_date = COALESCE($5, move_in_date),
                 national_id  = COALESCE(NULLIF($6, ''), national_id),
                 address      = COALESCE($7, address)
                 ${extraSet},
                 updated_at   = NOW()
             WHERE tenant_id = $8
             RETURNING tenant_id, full_name, phone_number, email, notes, move_in_date,
                       national_id, address, is_active`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'เลขบัตรประชาชนนี้มีผู้ใช้อยู่แล้ว' });
        console.error('[tenants/update]', err);
        return res.status(500).json({ error: 'Failed to update tenant' });
    }
});

// ---------- Move-out (super_admin/admin only) ----------
router.post('/:id/moveout', authenticate, adminOnly, fullAdmin, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const id  = parseInt(req.params.id, 10);
        const day = req.body.move_out_date || new Date().toISOString().slice(0, 10);

        const t = await client.query(`SELECT room_id FROM tenants WHERE tenant_id = $1 FOR UPDATE`, [id]);
        if (!t.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tenant not found' });
        }

        await client.query(
            `UPDATE tenants
             SET move_out_date = $1, is_active = FALSE, updated_at = NOW()
             WHERE tenant_id = $2`,
            [day, id]
        );

        if (t.rows[0].room_id) {
            await client.query(
                `UPDATE rooms SET status = 'vacant', updated_at = NOW() WHERE room_id = $1`,
                [t.rows[0].room_id]
            );
        }

        await client.query('COMMIT');
        return res.json({ data: { tenant_id: id, move_out_date: day, is_active: false } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[tenants/moveout]', err);
        return res.status(500).json({ error: 'Failed to move out tenant' });
    } finally {
        client.release();
    }
});

// ---------- Generate rental contract PDF ----------
router.get('/:id/contract', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (req.user.role === 'tenant' && req.user.id !== id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { rows } = await db.query(`
            SELECT t.full_name, t.phone_number, t.national_id, t.move_in_date,
                   r.room_number, r.rental_price,
                   a.name AS apartment_name, a.address AS apartment_address,
                   a.contact_number AS apartment_phone,
                   es.contract_terms
            FROM tenants t
            LEFT JOIN rooms r ON r.room_id = t.room_id
            LEFT JOIN apartments a ON a.apartment_id = r.apartment_id
            LEFT JOIN expense_settings es ON es.apartment_id = a.apartment_id
            WHERE t.tenant_id = $1
        `, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contract_${id}.pdf"`);
        generateContractPDF(rows[0], res);
    } catch (err) {
        console.error('[tenants/contract]', err);
        return res.status(500).json({ error: 'Failed to generate contract' });
    }
});

module.exports = router;
