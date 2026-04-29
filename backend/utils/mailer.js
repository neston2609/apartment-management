/**
 * Sends mail via nodemailer using SMTP settings stored in system_settings.
 * Updating SMTP credentials in the UI takes effect on the next send (no restart).
 */
const nodemailer = require('nodemailer');
const db = require('../config/database');

async function loadSmtp() {
    const { rows } = await db.query(
        `SELECT key, value FROM system_settings
          WHERE key IN ('smtp_host','smtp_port','smtp_secure','smtp_user','smtp_password','smtp_from','app_base_url')`
    );
    const cfg = {};
    rows.forEach((r) => { cfg[r.key] = r.value; });
    return cfg;
}

async function sendMail({ to, subject, text, html }) {
    const cfg = await loadSmtp();
    if (!cfg.smtp_host || !cfg.smtp_user) {
        throw new Error('SMTP not configured. Ask the super admin to set it up in หน้า "ตั้งค่าระบบ".');
    }
    const transporter = nodemailer.createTransport({
        host:   cfg.smtp_host,
        port:   parseInt(cfg.smtp_port || '587', 10),
        secure: String(cfg.smtp_secure).toLowerCase() === 'true',
        auth:   { user: cfg.smtp_user, pass: cfg.smtp_password },
    });
    return transporter.sendMail({
        from: cfg.smtp_from || cfg.smtp_user,
        to, subject, text, html,
    });
}

async function getAppBaseUrl() {
    const cfg = await loadSmtp();
    return (cfg.app_base_url || 'http://localhost:3000').replace(/\/+$/, '');
}

module.exports = { sendMail, loadSmtp, getAppBaseUrl };
