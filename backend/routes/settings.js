/**
 * /api/settings/:apartment_id
 */
const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const db     = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');
const { DEFAULT_CONTRACT_TERMS_TEXT } = require('../utils/contractDefaults');
const { qrUpload, UPLOADS_ROOT } = require('../utils/upload');

router.use(authenticate, adminOnly);

const fullAdmin = requireAdminRoles('super_admin', 'admin');

// Build a URL-safe path for the QR code
function qrUrl(req, qr_code_path) {
    if (!qr_code_path) return null;
    const base = `${req.protocol}://${req.get('host')}`;
    return `${base}/uploads/${qr_code_path}`;
}

router.get('/:apartment_id', async (req, res) => {
    try {
        const id = parseInt(req.params.apartment_id, 10);
        const { rows } = await db.query(
            `SELECT * FROM expense_settings WHERE apartment_id = $1`,
            [id]
        );
        if (!rows.length) {
            return res.json({
                data: {
                    apartment_id: id,
                    water_price_per_unit: 0,
                    water_max_units: 9999,
                    electricity_price_per_unit: 0,
                    electricity_max_units: 9999,
                    common_fee_per_unit: 0,
                    common_fee_enabled: false,
                    invoice_footer_text: '',
                    contract_terms: DEFAULT_CONTRACT_TERMS_TEXT,
                    payment_due_day: null,
                    late_fee_per_day: 0,
                    late_fee_enabled: true,
                    bank_name: '',
                    bank_account_number: '',
                    bank_account_name: '',
                    qr_code_path: null,
                    qr_code_url: null,
                },
            });
        }
        const row = rows[0];
        if (!row.contract_terms || !row.contract_terms.trim()) {
            row.contract_terms = DEFAULT_CONTRACT_TERMS_TEXT;
        }
        row.qr_code_url = qrUrl(req, row.qr_code_path);
        return res.json({ data: row });
    } catch (err) {
        console.error('[settings/get]', err);
        return res.status(500).json({ error: 'Failed to load settings' });
    }
});

router.put('/:apartment_id', fullAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.apartment_id, 10);
        const {
            water_price_per_unit, water_max_units,
            electricity_price_per_unit, electricity_max_units,
            common_fee_per_unit, common_fee_enabled,
            invoice_footer_text, contract_terms,
            payment_due_day, late_fee_per_day, late_fee_enabled,
            bank_name, bank_account_number, bank_account_name,
        } = req.body;

        let dueDay = null;
        if (payment_due_day != null && payment_due_day !== '') {
            const d = parseInt(payment_due_day, 10);
            if (Number.isFinite(d) && d >= 1 && d <= 31) dueDay = d;
        }
        const lateFee = Number(late_fee_per_day) || 0;
        // Default to enabled unless explicitly turned off (false / 'false' / 0).
        const lateFeeEnabled = !(late_fee_enabled === false
            || late_fee_enabled === 'false' || late_fee_enabled === 0);
        const commonFeePerUnit = Number(common_fee_per_unit) || 0;
        // Common-area fee is opt-in: enabled only when explicitly turned on.
        const commonFeeEnabled = common_fee_enabled === true
            || common_fee_enabled === 'true' || common_fee_enabled === 1;

        const { rows } = await db.query(
            `INSERT INTO expense_settings
             (apartment_id, water_price_per_unit, water_max_units,
              electricity_price_per_unit, electricity_max_units,
              common_fee_per_unit, common_fee_enabled,
              invoice_footer_text, contract_terms,
              payment_due_day, late_fee_per_day, late_fee_enabled,
              bank_name, bank_account_number, bank_account_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             ON CONFLICT (apartment_id) DO UPDATE SET
                 water_price_per_unit       = EXCLUDED.water_price_per_unit,
                 water_max_units            = EXCLUDED.water_max_units,
                 electricity_price_per_unit = EXCLUDED.electricity_price_per_unit,
                 electricity_max_units      = EXCLUDED.electricity_max_units,
                 common_fee_per_unit        = EXCLUDED.common_fee_per_unit,
                 common_fee_enabled         = EXCLUDED.common_fee_enabled,
                 invoice_footer_text        = EXCLUDED.invoice_footer_text,
                 contract_terms             = EXCLUDED.contract_terms,
                 payment_due_day            = EXCLUDED.payment_due_day,
                 late_fee_per_day           = EXCLUDED.late_fee_per_day,
                 late_fee_enabled           = EXCLUDED.late_fee_enabled,
                 bank_name                  = EXCLUDED.bank_name,
                 bank_account_number        = EXCLUDED.bank_account_number,
                 bank_account_name          = EXCLUDED.bank_account_name,
                 updated_at = NOW()
             RETURNING *`,
            [id,
             water_price_per_unit ?? 0, water_max_units ?? 9999,
             electricity_price_per_unit ?? 0, electricity_max_units ?? 9999,
             commonFeePerUnit, commonFeeEnabled,
             invoice_footer_text ?? '', contract_terms ?? '',
             dueDay, lateFee, lateFeeEnabled,
             (bank_name || '').trim(),
             (bank_account_number || '').trim(),
             (bank_account_name || '').trim()]
        );
        const row = rows[0];

        // Retroactively apply the common-area fee to EXISTING bills so past
        // bills follow the current on/off state and rate:
        //   enabled  -> common_fee = rate × electricity_usage (shown on bill)
        //   disabled -> common_fee = 0                        (hidden on bill)
        // electricity_usage is recomputed from each bill's meter reading
        // (respecting rollover); total_cost is rebuilt from the stored
        // water/electricity/rent/other components + the new common_fee.
        const emax    = Number(row.electricity_max_units) || 9999;
        const rate    = Number(row.common_fee_per_unit) || 0;
        const enabled = row.common_fee_enabled === true;
        await db.query(
            `UPDATE bills b
                SET common_fee = nc.new_common,
                    total_cost = b.water_cost + b.electricity_cost + b.rent_cost
                                 + b.other_cost + nc.new_common,
                    updated_at = NOW()
               FROM (
                 SELECT b2.bill_id,
                        CASE WHEN $2 THEN ROUND(
                          (CASE WHEN COALESCE(m.rollover_electricity, FALSE)
                                THEN ($3::numeric - COALESCE(m.electricity_units_last, 0))
                                     + COALESCE(m.electricity_units_current, 0)
                                ELSE COALESCE(m.electricity_units_current, 0)
                                     - COALESCE(m.electricity_units_last, 0)
                           END) * $4::numeric, 2)
                        ELSE 0 END AS new_common
                   FROM bills b2
                   JOIN rooms r ON r.room_id = b2.room_id
                   LEFT JOIN meter_readings m
                     ON m.room_id = b2.room_id AND m.month = b2.month AND m.year = b2.year
                  WHERE r.apartment_id = $1
               ) nc
              WHERE b.bill_id = nc.bill_id`,
            [id, enabled, emax, rate]
        );

        row.qr_code_url = qrUrl(req, row.qr_code_path);
        return res.json({ data: row });
    } catch (err) {
        console.error('[settings/update]', err);
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

// POST /:apartment_id/upload-qr  — replace QR code image
router.post('/:apartment_id/upload-qr', fullAdmin, (req, res, next) => {
    qrUpload.single('qr_code')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
    try {
        const id = parseInt(req.params.apartment_id, 10);

        // Delete old QR file if one already exists
        const { rows: existing } = await db.query(
            'SELECT qr_code_path FROM expense_settings WHERE apartment_id = $1', [id]
        );
        if (existing[0]?.qr_code_path) {
            const oldFile = path.join(UPLOADS_ROOT, existing[0].qr_code_path);
            if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        const filePath = `qr/${req.file.filename}`;
        await db.query(
            `INSERT INTO expense_settings (apartment_id, qr_code_path)
             VALUES ($1, $2)
             ON CONFLICT (apartment_id) DO UPDATE SET qr_code_path = $2, updated_at = NOW()`,
            [id, filePath]
        );
        return res.json({ data: { qr_code_path: filePath, qr_code_url: qrUrl(req, filePath) } });
    } catch (err) {
        console.error('[settings/upload-qr]', err);
        return res.status(500).json({ error: 'Failed to save QR code' });
    }
});

// DELETE /:apartment_id/qr  — remove QR code
router.delete('/:apartment_id/qr', fullAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.apartment_id, 10);
        const { rows } = await db.query(
            'SELECT qr_code_path FROM expense_settings WHERE apartment_id = $1', [id]
        );
        const oldPath = rows[0]?.qr_code_path;
        if (oldPath) {
            const file = path.join(UPLOADS_ROOT, oldPath);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        await db.query(
            'UPDATE expense_settings SET qr_code_path = NULL, updated_at = NOW() WHERE apartment_id = $1',
            [id]
        );
        return res.json({ data: { removed: true } });
    } catch (err) {
        console.error('[settings/delete-qr]', err);
        return res.status(500).json({ error: 'Failed to remove QR code' });
    }
});

module.exports = router;
