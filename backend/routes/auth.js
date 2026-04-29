/**
 * /api/auth
 *   POST /login                -> admin login → JWT (includes admin_role)
 *   POST /tenant/login         -> tenant login → JWT
 *   POST /register-admin       -> super-admin only
 *   PUT  /change-password      -> change own password (admin OR tenant)
 */
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authenticate, signToken, superAdminOnly } = require('../middleware/auth');

const SALT_ROUNDS = 10;

// ---------- Admin login ----------
router.post(
    '/login',
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
            const { username, password } = req.body;
            const { rows } = await db.query(
                `SELECT admin_id, username, password_hash, full_name, email, apartment_id,
                        is_super_admin, COALESCE(role, 'admin') AS role
                 FROM admin_users WHERE username = $1`,
                [username]
            );
            if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

            const a = rows[0];
            const ok = await bcrypt.compare(password, a.password_hash);
            if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

            const adminRole = a.role || (a.is_super_admin ? 'super_admin' : 'admin');

            const token = signToken({
                id:           a.admin_id,
                role:         'admin',
                admin_role:   adminRole,
                username:     a.username,
                is_super_admin: a.is_super_admin,
                apartment_id: a.apartment_id,
            });

            return res.json({
                data: {
                    token,
                    user: {
                        id: a.admin_id,
                        role: 'admin',
                        admin_role: adminRole,
                        username: a.username,
                        full_name: a.full_name,
                        email: a.email,
                        is_super_admin: a.is_super_admin,
                        apartment_id: a.apartment_id,
                    },
                },
            });
        } catch (err) {
            console.error('[auth/login]', err);
            return res.status(500).json({ error: 'Login failed' });
        }
    }
);

// ---------- Tenant login ----------
router.post(
    '/tenant/login',
    body('national_id').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
            const { national_id, password } = req.body;
            const { rows } = await db.query(
                `SELECT t.tenant_id, t.full_name, t.national_id, t.password_hash,
                        t.room_id, t.is_active,
                        r.room_number, r.apartment_id
                 FROM tenants t
                 LEFT JOIN rooms r ON r.room_id = t.room_id
                 WHERE t.national_id = $1`,
                [national_id]
            );
            if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

            const t = rows[0];
            if (!t.is_active) return res.status(403).json({ error: 'Tenant is no longer active' });

            const ok = await bcrypt.compare(password, t.password_hash);
            if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

            const token = signToken({
                id: t.tenant_id,
                role: 'tenant',
                room_id: t.room_id,
                apartment_id: t.apartment_id,
            });

            return res.json({
                data: {
                    token,
                    user: {
                        id: t.tenant_id,
                        role: 'tenant',
                        full_name: t.full_name,
                        national_id: t.national_id,
                        room_id: t.room_id,
                        room_number: t.room_number,
                        apartment_id: t.apartment_id,
                    },
                },
            });
        } catch (err) {
            console.error('[auth/tenant/login]', err);
            return res.status(500).json({ error: 'Login failed' });
        }
    }
);

// ---------- Register admin (super-admin only) ----------
router.post(
    '/register-admin',
    authenticate, superAdminOnly,
    body('username').isString().trim().notEmpty(),
    body('password').isString().isLength({ min: 6 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
            const { username, password, full_name, email, apartment_id, role } = req.body;
            const allowed = ['super_admin', 'admin', 'property_manager'];
            const userRole = allowed.includes(role) ? role : 'admin';
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
            if (err.code === '23505') {
                return res.status(409).json({ error: 'Username already exists' });
            }
            console.error('[auth/register-admin]', err);
            return res.status(500).json({ error: 'Failed to create admin' });
        }
    }
);

// ---------- Change own password ----------
router.put(
    '/change-password',
    authenticate,
    body('old_password').isString().notEmpty(),
    body('new_password').isString().isLength({ min: 6 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const { old_password, new_password } = req.body;
        const role = req.user.role;
        const id   = req.user.id;

        try {
            const table = role === 'admin' ? 'admin_users' : 'tenants';
            const idCol = role === 'admin' ? 'admin_id'   : 'tenant_id';
            const { rows } = await db.query(
                `SELECT password_hash FROM ${table} WHERE ${idCol} = $1`,
                [id]
            );
            if (!rows.length) return res.status(404).json({ error: 'User not found' });

            const ok = await bcrypt.compare(old_password, rows[0].password_hash);
            if (!ok) return res.status(401).json({ error: 'Old password incorrect' });

            const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
            await db.query(
                `UPDATE ${table} SET password_hash = $1, updated_at = NOW() WHERE ${idCol} = $2`,
                [newHash, id]
            );
            return res.json({ data: { message: 'Password updated' } });
        } catch (err) {
            console.error('[auth/change-password]', err);
            return res.status(500).json({ error: 'Failed to change password' });
        }
    }
);

module.exports = router;
