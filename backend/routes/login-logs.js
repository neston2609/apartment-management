/**
 * /api/login-logs — super-admin only
 *
 *   GET /?limit=100&offset=0&user_kind=&success=
 *   Returns recent login attempts (success and failure) with the user's name
 *   resolved when known.
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, superAdminOnly } = require('../middleware/auth');

router.use(authenticate, superAdminOnly);

router.get('/', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const where = [];
        const params = [];
        if (req.query.user_kind) {
            params.push(req.query.user_kind);
            where.push(`l.user_kind = $${params.length}`);
        }
        if (req.query.success === 'true' || req.query.success === 'false') {
            params.push(req.query.success === 'true');
            where.push(`l.success = $${params.length}`);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const totalRow = await db.query(
            `SELECT COUNT(*)::int AS total FROM login_logs l ${whereSql}`,
            params
        );

        params.push(limit, offset);
        const { rows } = await db.query(
            `SELECT l.log_id, l.user_kind, l.user_id, l.identifier,
                    l.success, l.error_reason, l.ip, l.user_agent, l.created_at,
                    CASE l.user_kind
                        WHEN 'admin'  THEN au.full_name
                        WHEN 'tenant' THEN t.full_name
                    END AS user_name,
                    CASE l.user_kind
                        WHEN 'admin'  THEN au.username
                        WHEN 'tenant' THEN t.national_id
                    END AS user_login,
                    r.room_number AS user_room
             FROM login_logs l
             LEFT JOIN admin_users au ON l.user_kind = 'admin'  AND au.admin_id = l.user_id
             LEFT JOIN tenants t      ON l.user_kind = 'tenant' AND t.tenant_id = l.user_id
             LEFT JOIN rooms r        ON l.user_kind = 'tenant' AND r.room_id   = t.room_id
             ${whereSql}
             ORDER BY l.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({ data: { logs: rows, total: totalRow.rows[0].total } });
    } catch (err) {
        console.error('[login-logs/list]', err);
        return res.status(500).json({ error: 'Failed to load logs' });
    }
});

module.exports = router;
