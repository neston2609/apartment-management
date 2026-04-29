/**
 * Verify the admin user exists and that 'admin1234' actually matches its hash.
 *
 * Usage:
 *   node database/check-admin.js
 *
 * It will report ONE of:
 *   - "No admin row found"           -> seed never ran successfully → run `npm run db:seed`
 *   - "Hash does NOT match"          -> hash was overwritten somehow → run `npm run db:seed` to reset
 *   - "OK: admin / admin1234 works"  -> credentials are correct → frontend or env points at wrong DB
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
    const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
    });

    try {
        await client.connect();
        console.log(`Connected to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

        const { rows } = await client.query(
            `SELECT admin_id, username, password_hash, is_super_admin
             FROM admin_users WHERE username = 'admin'`
        );
        if (!rows.length) {
            console.log('Result: No admin row found.');
            console.log('Fix:    Run `npm run db:seed`');
            return;
        }
        const a = rows[0];
        console.log(`Found admin row id=${a.admin_id} super=${a.is_super_admin}`);
        console.log(`Hash:   ${a.password_hash}`);

        const ok = await bcrypt.compare('admin1234', a.password_hash);
        if (ok) {
            console.log('Result: OK — password admin1234 matches.');
            console.log('Fix:    None needed in DB. If login UI still fails:');
            console.log('        • Confirm backend is also reading the same .env (same DB)');
            console.log('        • Check backend console for the actual error');
            console.log('        • Open browser DevTools → Network → /api/auth/login → see response');
        } else {
            console.log('Result: Hash does NOT match admin1234.');
            console.log('Fix:    Run `npm run db:seed` (it upserts the hash).');
        }
    } catch (e) {
        console.error('Diagnose failed:', e.message);
    } finally {
        await client.end();
    }
})();
