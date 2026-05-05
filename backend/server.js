/**
 * Apartment Management System - Express server entry point.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) =>
    res.json({ data: { status: 'ok', ts: new Date().toISOString() } })
);

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/apartments',      require('./routes/apartments'));
app.use('/api/rooms',           require('./routes/rooms'));
app.use('/api/tenants',         require('./routes/tenants'));
app.use('/api/bills',           require('./routes/bills'));
app.use('/api/settings',        require('./routes/settings'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/system-settings', require('./routes/system-settings'));
app.use('/api/login-logs',      require('./routes/login-logs'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = parseInt(process.env.PORT, 10) || 5000;
app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
});
