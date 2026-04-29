/**
 * /api/settings/:apartment_id
 */
const router = require('express').Router();
const db = require('../config/database');
const { authenticate, adminOnly, requireAdminRoles } = require('../middleware/auth');

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
                },
            });
        }
        return res.json({ data: rows[0] });
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
            invoice_footer_text,
        } = req.body;

        const { rows } = await db.query(
            `INSERT INTO expense_settings
             (apartment_id, water_price_per_unit, water_max_units,
              electricity_price_per_unit, electricity_max_units, invoice_footer_text)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (apartment_id) DO UPDATE SET
                 water_price_per_unit       = EXCLUDED.water_price_per_unit,
                 water_max_units            = EXCLUDED.water_max_units,
                 electricity_price_per_unit = EXCLUDED.electricity_price_per_unit,
                 electricity_max_units      = EXCLUDED.electricity_max_units,
                 invoice_footer_text        = EXCLUDED.invoice_footer_text,
                 updated_at = NOW()
             RETURNING *`,
            [id,
             water_price_per_unit ?? 0, water_max_units ?? 9999,
             electricity_price_per_unit ?? 0, electricity_max_units ?? 9999,
             invoice_footer_text ?? '']
        );
        return res.json({ data: rows[0] });
    } catch (err) {
        console.error('[settings/update]', err);
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;
