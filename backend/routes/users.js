/**
 * /api/users  — super-admin only
 *   GET    /                              -> list all admin users
 *   POST   /                              -> create a new admin (role: super_admin/admin/property_manager)
 *   PUT    /:id                           -> update name/email/role/apartment_id; can also reset password
 *   DELETE /:id                           -> remove admin
 *   POST   /tenants/:tenant_id/reset-password -> reset a tenant's password
 */
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authenticate, superAdminOnly } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const ALLOWED_ROLES = ['super_admin', 'admin', 'property_manager'];

router.use(authenticate, superAdminOnly);

const ROLE_LABELS = {
    super_admin:      'ผู้ดูแลระบบสูงสุด',
    admin:            'ผู้ดูแลระบบ',
    property_manager: 'ผู้ดูแลหอพัก',
};

// ---------- List admin users ----------
router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT u.admin_id, u.username, u.full_name, u.email, u.apartment_id,
                   u.is_super_admin, COALESCE(u.role, 'admin') AS role,
                   u.created_at,
                   a.name AS apartment_name
            FROM admin_users u
            LEFT JOIN apartments a ON a.apartment_id = u.apartment_id
            ORDER BY u.admin_id
        `);
        return res.json({ data: rows.map((r) => ({ ...r, role_label: ROLE_LABELS[r.role] || r.role })) });
    } catch (err) {
        console.error('[users/list]', err);
        return res.status(500).json({ error: 'Failed to load users' });
    }
});

// ---------- Create admin ----------
router.post(
    '/',
    body('username').isString().trim().notEmpty(),
    body('password').isString().isLength({ min: 6 }),
    body('role').optional().isIn(ALLOWED_ROLES),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
            const { username, password, full_name, email, apartment_id, role } = req.body;
            const userRole = ALLOWED_ROLES.includes(role) ? role : 'admin';
            const isSuper  = userRole === 'super_admin';
            const hash = await bcrypt.hash(password, SALT_ROUNDS);

            const { rows } = await db.query(
                `INSERT INTO admin_users
                 (username, password_hash, full_name, email, apartment_id, is_super_admin, role)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 RETURNING admin_id, username, full_name, email, apartment_id, is_super_admin, role`,
                [username, hash, full_name || null, email || null, apartment_id || null, isSuper, userRole]
            );
            return res.status(201).json({ data: rows[0] });
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
            console.error('[users/create]', err);
            return res.status(500).json({ error: 'Failed to create user' });
        }
    }
);

// ---------- Update admin ----------
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { full_name, email, apartment_id, role, new_password } = req.body;
        const userRole = role && ALLOWED_ROLES.includes(role) ? role : null;
        const isSuperOverride = userRole != null ? (userRole === 'super_admin') : null;

        const params = [
            full_name || null,
            email || null,
            apartment_id || null,
            userRole,
            isSuperOverride,
            id,
        ];
        let extraSet = '';
        if (new_password) {
            if (String(new_password).length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
            params.push(newHash);
            extraSet = `, password_hash = $${params.length}`;
        }

        const { rows } = await db.query(
            `UPDATE admin_users
             SET full_name      = COALESCE($1, full_name),
                 email          = COALESCE($2, email),
                 apartment_id   = COALESCE($3, apartment_id),
                 role           = COALESCE($4, role),
                 is_super_admin = COALESCE($5, is_super_admin)
                 ${extraSet},
                 updated_at = NOW()
             WHERE admin_id = $6
             RETURNING admin_id, username, full_name, email, apartment_id, is_super_admin, role`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[users/update]', err);
        return res.status(500).json({ error: 'Failed to update user' });
    }
});

// ---------- Delete admin ----------
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const { rowCount } = await db.query(
            `DELETE FROM admin_users WHERE admin_id = $1`, [id]
        );
        if (!rowCount) return res.status(404).json({ error: 'User not found' });
        return res.json({ data: { admin_id: id, deleted: true } });
    } catch (err) {
        console.error('[users/delete]', err);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ---------- Reset a tenant's password ----------
router.post('/tenants/:tenant_id/reset-password', async (req, res) => {
    try {
        const id = parseInt(req.params.tenant_id, 10);
        const newPwd = (req.body.new_password || '').toString();
        if (newPwd.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const hash = await bcrypt.hash(newPwd, SALT_ROUNDS);
        const { rowCount } = await db.query(
            `UPDATE tenants SET password_hash = $1, updated_at = NOW() WHERE tenant_id = $2`,
            [hash, id]
        );
        if (!rowCount) return res.status(404).json({ error: 'Tenant not found' });
        return res.json({ data: { tenant_id: id, reset: true } });
    } catch (err) {
        console.error('[users/tenant-reset]', err);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
