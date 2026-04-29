/**
 * Database migration runner.
 * Reads database/schema.sql and executes it against the configured Postgres DB.
 *
 * Usage:
 *   node database/migrate.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
    const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
    const pool = new Pool({
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT, 10),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      useSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
    });

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql  = fs.readFileSync(schemaPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log('[migrate] Running schema.sql ...');
        await client.query(schemaSql);
        console.log('[migrate] Schema applied successfully.');
    } catch (err) {
        console.error('[migrate] Schema failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('[migrate] Fatal:', e);
    process.exit(1);
});
