/**
 * Postgres connection diagnostic.
 * Tries 4 things in order so you can see exactly what fails:
 *   1. DNS resolve of DB_HOST
 *   2. Raw TCP connect to DB_HOST:DB_PORT
 *   3. pg connect WITHOUT ssl
 *   4. pg connect WITH  ssl: { rejectUnauthorized: false }
 *
 * Usage:
 *   node database/diagnose.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const dns  = require('dns').promises;
const net  = require('net');
const { Client } = require('pg');

const HOST = process.env.DB_HOST;
const PORT = parseInt(process.env.DB_PORT, 10);
const USER = process.env.DB_USER;
const PASS = process.env.DB_PASSWORD;
const DB   = process.env.DB_NAME;

console.log(`Target: ${USER}@${HOST}:${PORT}/${DB}\n`);

async function step(name, fn) {
    process.stdout.write(`[${name}] ... `);
    try {
        const out = await fn();
        console.log('OK', out ? `(${out})` : '');
        return true;
    } catch (e) {
        console.log('FAIL');
        console.log(`        ${e.code || ''} ${e.message}`);
        return false;
    }
}

(async () => {
    // 1. DNS
    await step('DNS', async () => {
        const { address } = await dns.lookup(HOST);
        return address;
    });

    // 2. TCP
    const tcpOk = await step('TCP', () => new Promise((resolve, reject) => {
        const s = net.createConnection({ host: HOST, port: PORT, timeout: 8000 });
        s.once('connect', () => { s.end(); resolve('socket opened'); });
        s.once('timeout', () => { s.destroy(); reject(new Error('timeout after 8s')); });
        s.once('error',   (e) => reject(e));
    }));

    if (!tcpOk) {
        console.log('\nTCP failed → it is a network/firewall/port problem, not a Postgres-config problem.');
        console.log('Check: server actually running, port-forwarding on the router, Windows firewall, ISP blocking inbound.\n');
        process.exit(1);
    }

    const opts = { host: HOST, port: PORT, user: USER, password: PASS, database: DB,
                   connectionTimeoutMillis: 8000, query_timeout: 8000 };

    // 3. pg without SSL
    const noSslOk = await step('pg no-ssl', async () => {
        const c = new Client({ ...opts, ssl: false });
        await c.connect();
        const r = await c.query('SELECT version()');
        await c.end();
        return r.rows[0].version.split(' ').slice(0, 2).join(' ');
    });

    // 4. pg with SSL
    const sslOk = await step('pg ssl   ', async () => {
        const c = new Client({ ...opts, ssl: { rejectUnauthorized: false } });
        await c.connect();
        const r = await c.query('SELECT version()');
        await c.end();
        return r.rows[0].version.split(' ').slice(0, 2).join(' ');
    });

    console.log('');
    if (!noSslOk && sslOk) {
        console.log('Diagnosis: server requires SSL.  Set DB_SSL=true in .env  (already updated for you).');
    } else if (noSslOk && !sslOk) {
        console.log('Diagnosis: server does NOT support SSL.  Set DB_SSL=false in .env.');
    } else if (noSslOk && sslOk) {
        console.log('Both modes work — your real run should succeed. Re-try `npm run db:migrate`.');
    } else {
        console.log('Both modes fail even though TCP is open. Likely causes:');
        console.log('  • pg_hba.conf rejects this client IP/user (server logs will show it)');
        console.log('  • Wrong credentials');
        console.log('  • Server expects a specific authentication method (md5 vs scram-sha-256)');
    }
})();
