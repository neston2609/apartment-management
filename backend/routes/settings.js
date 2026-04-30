/**
 * /api/settings/:apartment_id
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');
const { DEFAULT_CONTRACT_TERMS_TEXT } = require('../utils/contractDefaults');

router.use(authenticate, adminOnly);

const fullAdmin = requireAdminRoles('super_admin', 'admin');

router.get('/:apartment_id', async (req, res) => {
    try {
        const id = parseInt(req.params.apartment_id, 10);
        const { rows } = await db.query(
            `SELECT * FROM expense_settings WHERE apartment_id = $1`,
            [id]
        );
        if (!rows.length) {
            // Return defaults if not set yet
            return res.json({
                data: {
                    apartment_id: id,
                    water_price_per_unit: 0,
                    water_max_units: 9999,
                    electricity_price_per_unit: 0,
                    electricity_max_units: 9999,
                    invoice_footer_text: '',
                    contract_terms: DEFAULT_CONTRACT_TERMS_TEXT,
                    payment_due_day: null,
                    late_fee_per_day: 0,
                },
            });
        }
        // Pre-fill contract_terms with the default template if it's still blank,
        // so the admin sees the current rules to edit (not an empty box).
        const row = rows[0];
        if (!row.contract_terms || !row.contract_terms.trim()) {
            row.contract_terms = DEFAULT_CONTRACT_TERMS_TEXT;
        }
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
            invoice_footer_text, contract_terms,
            payment_due_day, late_fee_per_day,
        } = req.body;

        // Sanitize payment_due_day: must be int 1-31 or null
        let dueDay = null;
        if (payment_due_day != null && payment_due_day !== '') {
            const d = parseInt(payment_due_day, 10);
            if (Number.isFinite(d) && d >= 1 && d <= 31) dueDay = d;
        }
        const lateFee = Number(late_fee_per_day) || 0;

        const { rows } = await db.query(
            `INSERT INTO expense_settings
             (apartment_id, water_price_per_unit, water_max_units,
              electricity_price_per_unit, electricity_max_units,
              invoice_footer_text, contract_terms,
              payment_due_day, late_fee_per_day)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (apartment_id) DO UPDATE SET
                 water_price_per_unit       = EXCLUDED.water_price_per_unit,
                 water_max_units            = EXCLUDED.water_max_units,
                 electricity_price_per_unit = EXCLUDED.electricity_price_per_unit,
                 electricity_max_units      = EXCLUDED.electricity_max_units,
                 invoice_footer_text        = EXCLUDED.invoice_footer_text,
                 contract_terms             = EXCLUDED.contract_terms,
                 payment_due_day            = EXCLUDED.payment_due_day,
                 late_fee_per_day           = EXCLUDED.late_fee_per_day,
                 updated_at = NOW()
             RETURNING *`,
            [id,
             water_price_per_unit ?? 0, water_max_units ?? 9999,
             electricity_price_per_unit ?? 0, electricity_max_units ?? 9999,
             invoice_footer_text ?? '', contract_terms ?? '',
             dueDay, lateFee]
        );
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[settings/update]', err);
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;
