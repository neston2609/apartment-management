/**
 * PostgreSQL connection pool.
 */
const { Pool } = require('pg');

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:      useSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};
