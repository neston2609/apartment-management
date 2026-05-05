/**
 * /api/auth
 *   POST /login                -> admin login → JWT (includes admin_role)
 *   POST /tenant/login         -> tenant login → JWT
 *   POST /register-admin       -> super-admin only
 *   PUT  /change-password      -> change own password (admin OR tenant)
 */
const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendMail, getAppBaseUrl } = require('../utils/mailer');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const { authenticate, signToken, superAdminOnly } = require('../middleware/auth');

const SALT_ROUNDS = 10;

// ---------- Helpers ----------
function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || null;
}

// Best-effort logging — never throw out of here so a logging hiccup
// can't break a real login response.
async function recordLoginLog(req, { userKind, userId, identifier, success, errorReason }) {
    try {
        await db.query(
            `INSERT INTO login_logs
             (user_kind, user_id, identifier, success, error_reason, ip, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                userKind || null,
                userId || null,
                (identifier || '').toString().slice(0, 255),
                !!success,
                errorReason || null,
                clientIp(req),
                (req.headers['user-agent'] || '').toString().slice(0, 500),
            ]
        );
    } catch (err) {
        console.error('[auth/log]', err.message);
    }
}

// ---------- Admin login ----------
router.post(
    '/login',
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const { username, password } = req.body;
        try {
            const { rows } = await db.query(
                `SELECT admin_id, username, password_hash, full_name, email, apartment_id,
                        is_super_admin, COALESCE(role, 'admin') AS role
                 FROM admin_users WHERE username = $1`,
                [username]
            );
            if (!rows.length) {
                await recordLoginLog(req, { userKind: null, userId: null, identifier: username, success: false, errorReason: 'unknown_user' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const a = rows[0];
            const ok = await bcrypt.compare(password, a.password_hash);
            if (!ok) {
                await recordLoginLog(req, { userKind: 'admin', userId: a.admin_id, identifier: username, success: false, errorReason: 'wrong_password' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const adminRole = a.role || (a.is_super_admin ? 'super_admin' : 'admin');

            const token = signToken({
                id:           a.admin_id,
                role:         'admin',
                admin_role:   adminRole,
                username:     a.username,
                is_super_admin: a.is_super_admin,
                apartment_id: a.apartment_id,
            });

            await recordLoginLog(req, { userKind: 'admin', userId: a.admin_id, identifier: username, success: true });

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
// Accepts EITHER national_id OR room_number as the identifier.
// Body field is still named `national_id` for backward compatibility, but
// it can hold a national_id or a room_number. We try national_id first;
// if that lookup returns no row we fall back to room_number (most recently
// active tenant in that room).
router.post(
    '/tenant/login',
    body('national_id').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        const identifier = String(req.body.national_id).trim();
        const { password } = req.body;

        try {
            // 1) try by national_id
            let { rows } = await db.query(
                `SELECT t.tenant_id, t.full_name, t.national_id, t.password_hash,
                        t.room_id, t.is_active,
                        r.room_number, r.apartment_id
                 FROM tenants t
                 LEFT JOIN rooms r ON r.room_id = t.room_id
                 WHERE t.national_id = $1`,
                [identifier]
            );

            // 2) fall back to room_number (active tenant in that room)
            if (!rows.length) {
                const r = await db.query(
                    `SELECT t.tenant_id, t.full_name, t.national_id, t.password_hash,
                            t.room_id, t.is_active,
                            r.room_number, r.apartment_id
                     FROM tenants t
                     JOIN rooms r ON r.room_id = t.room_id
                     WHERE r.room_number = $1 AND t.is_active = TRUE
                     ORDER BY t.tenant_id DESC LIMIT 1`,
                    [identifier]
                );
                rows = r.rows;
            }

            if (!rows.length) {
                await recordLoginLog(req, { userKind: null, userId: null, identifier, success: false, errorReason: 'unknown_user' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const t = rows[0];
            if (!t.is_active) {
                await recordLoginLog(req, { userKind: 'tenant', userId: t.tenant_id, identifier, success: false, errorReason: 'inactive' });
                return res.status(403).json({ error: 'Tenant is no longer active' });
            }

            const ok = await bcrypt.compare(password, t.password_hash);
            if (!ok) {
                await recordLoginLog(req, { userKind: 'tenant', userId: t.tenant_id, identifier, success: false, errorReason: 'wrong_password' });
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = signToken({
                id: t.tenant_id,
                role: 'tenant',
                room_id: t.room_id,
                apartment_id: t.apartment_id,
            });

            await recordLoginLog(req, { userKind: 'tenant', userId: t.tenant_id, identifier, success: true });

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


// ---------- Forgot password (sends email) ----------
router.post('/forgot-password', async (req, res) => {
    try {
        const identifier = (req.body?.identifier || '').toString().trim();
        if (!identifier) return res.status(400).json({ error: 'Missing identifier' });

        // Look up admin by username or email, OR tenant by national_id or email.
        const admin = (await db.query(
            `SELECT admin_id AS id, email, full_name, username
             FROM admin_users WHERE (LOWER(email) = LOWER($1) OR username = $1)
               AND email IS NOT NULL AND email <> ''`,
            [identifier]
        )).rows[0];
        const tenant = !admin ? (await db.query(
            `SELECT tenant_id AS id, email, full_name, national_id
             FROM tenants WHERE (LOWER(email) = LOWER($1) OR national_id = $1)
               AND is_active = TRUE AND email IS NOT NULL AND email <> ''`,
            [identifier]
        )).rows[0] : null;

        if (!admin && !tenant) {
            // Don't leak which accounts exist
            return res.json({ data: { sent: true } });
        }

        const userKind = admin ? 'admin' : 'tenant';
        const user     = admin || tenant;

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
        await db.query(
            `INSERT INTO password_reset_tokens (token, user_kind, user_id, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [token, userKind, user.id, expires]
        );

        const base = await getAppBaseUrl();
        const link = `${base}/reset-password?token=${token}`;
        try {
            await sendMail({
                to: user.email,
                subject: 'รีเซ็ตรหัสผ่าน — ระบบจัดการอพาร์ทเมนต์',
                html: `
                    <p>สวัสดี ${user.full_name || user.username || ''}</p>
                    <p>มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 1 ชั่วโมง):</p>
                    <p><a href="${link}">${link}</a></p>
                    <p>หากคุณไม่ได้ขอรีเซ็ต โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
                `,
            });
        } catch (mailErr) {
            console.error('[auth/forgot-password] mail error:', mailErr.message);
            return res.status(500).json({ error: 'ส่งอีเมลไม่สำเร็จ — โปรดให้ผู้ดูแลระบบตรวจสอบการตั้งค่า SMTP' });
        }
        return res.json({ data: { sent: true } });
    } catch (err) {
        console.error('[auth/forgot-password]', err);
        return res.status(500).json({ error: 'Failed' });
    }
});

// ---------- Reset password using token ----------
router.post('/reset-password',
    body('token').isString().notEmpty(),
    body('new_password').isString().isLength({ min: 6 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

        try {
            const { token, new_password } = req.body;
            const { rows } = await db.query(
                `SELECT token_id, user_kind, user_id, expires_at, used_at
                 FROM password_reset_tokens WHERE token = $1`,
                [token]
            );
            if (!rows.length) return res.status(400).json({ error: 'ลิงก์ไม่ถูกต้อง' });
            const t = rows[0];
            if (t.used_at)                       return res.status(400).json({ error: 'ลิงก์นี้ถูกใช้ไปแล้ว' });
            if (new Date(t.expires_at) < new Date()) return res.status(400).json({ error: 'ลิงก์หมดอายุ' });

            const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
            const tbl = t.user_kind === 'admin' ? 'admin_users' : 'tenants';
            const id  = t.user_kind === 'admin' ? 'admin_id'   : 'tenant_id';

            const client = await db.getClient();
            try {
                await client.query('BEGIN');
                await client.query(`UPDATE ${tbl} SET password_hash = $1, updated_at = NOW() WHERE ${id} = $2`,
                                   [hash, t.user_id]);
                await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE token_id = $1`, [t.token_id]);
                await client.query('COMMIT');
            } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }

            return res.json({ data: { reset: true } });
        } catch (err) {
            console.error('[auth/reset-password]', err);
            return res.status(500).json({ error: 'Failed' });
        }
    }
);

module.exports = router;
