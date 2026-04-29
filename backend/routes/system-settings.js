/**
 * /api/system-settings — super-admin only
 * Stores small key/value config like SMTP credentials and app base URL.
 *
 *   GET  /                       -> all keys (smtp_password is masked)
 *   PUT  /                       -> { key1: value1, key2: value2, ... }  (upsert)
 *   POST /test-email             -> { to } sends a test email using current settings
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, superAdminOnly } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

router.use(authenticate, superAdminOnly);

const ALLOWED = new Set([
    'smtp_host', 'smtp_port', 'smtp_secure',
    'smtp_user', 'smtp_password', 'smtp_from',
    'app_base_url',
]);

router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`SELECT key, value FROM system_settings`);
        const out = {};
        rows.forEach((r) => {
            if (r.key === 'smtp_password') {
                out[r.key] = r.value ? '••••••••' : '';
            } else {
                out[r.key] = r.value || '';
            }
        });
        return res.json({ data: out });
    } catch (err) {
        console.error('[system-settings/get]', err);
        return res.status(500).json({ error: 'Failed to load settings' });
    }
});

router.put('/', async (req, res) => {
    try {
        const updates = req.body || {};
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            for (const [k, v] of Object.entries(updates)) {
                if (!ALLOWED.has(k)) continue;
                // Don't overwrite the password if the UI sent the masked placeholder
                if (k === 'smtp_password' && (v === '••••••••' || v === '')) continue;
                await client.query(
                    `INSERT INTO system_settings (key, value, updated_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                    [k, String(v ?? '')]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK'); throw e;
        } finally { client.release(); }
        return res.json({ data: { saved: true } });
    } catch (err) {
        console.error('[system-settings/put]', err);
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

router.post('/test-email', async (req, res) => {
    try {
        const to = (req.body?.to || '').toString().trim();
        if (!to) return res.status(400).json({ error: 'Missing recipient' });
        await sendMail({
            to,
            subject: '[ทดสอบ] อีเมลจากระบบจัดการอพาร์ทเมนต์',
            text: 'ถ้าคุณได้รับอีเมลฉบับนี้ การตั้งค่า SMTP ทำงานถูกต้องแล้ว',
            html: '<p>ถ้าคุณได้รับอีเมลฉบับนี้ การตั้งค่า SMTP ทำงานถูกต้องแล้ว ✅</p>',
        });
        return res.json({ data: { sent: true } });
    } catch (err) {
        console.error('[system-settings/test-email]', err);
        return res.status(500).json({ error: err.message || 'Send failed' });
    }
});

module.exports = router;
