import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

export default function Settings() {
    const [apts, setApts] = useState([]);
    const [aptId, setAptId] = useState('');
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => {
            setApts(r || []);
            if (r?.length) setAptId(String(r[0].apartment_id));
        });
    }, []);

    useEffect(() => {
        if (!aptId) return;
        unwrap(api.get(`/settings/${aptId}`)).then((d) => setForm(d));
    }, [aptId]);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/settings/${aptId}`, form);
            toast.success('บันทึกการตั้งค่าแล้ว');
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally { setSaving(false); }
    };

    if (!form) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold text-slate-800">ตั้งค่า</h1>

            <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
                <label className="text-slate-600 mr-2">อพาร์ทเมนต์:</label>
                <select value={aptId} onChange={(e) => setAptId(e.target.value)}
                        className="border border-slate-300 rounded-md px-2 py-1">
                    {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                </select>
            </div>

            <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="ราคาน้ำต่อหน่วย" type="number" step="0.01"
                           value={form.water_price_per_unit}
                           onChange={(v) => setForm({ ...form, water_price_per_unit: parseFloat(v) || 0 })} />
                    <Field label="หน่วยน้ำสูงสุดของมิเตอร์" type="number"
                           value={form.water_max_units}
                           onChange={(v) => setForm({ ...form, water_max_units: parseInt(v, 10) || 0 })} />
                    <Field label="ราคาไฟต่อหน่วย" type="number" step="0.01"
                           value={form.electricity_price_per_unit}
                           onChange={(v) => setForm({ ...form, electricity_price_per_unit: parseFloat(v) || 0 })} />
                    <Field label="หน่วยไฟสูงสุดของมิเตอร์" type="number"
                           value={form.electricity_max_units}
                           onChange={(v) => setForm({ ...form, electricity_max_units: parseInt(v, 10) || 0 })} />
                </div>
                <label className="block">
                    <span className="text-slate-600">ข้อความท้ายใบแจ้งหนี้</span>
                    <textarea rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                              value={form.invoice_footer_text || ''}
                              onChange={(e) => setForm({ ...form, invoice_footer_text: e.target.value })} />
                </label>
                <div className="flex justify-end">
                    <button type="submit" disabled={saving}
                            className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({ label, value, onChange, ...rest }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                   value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        </label>
    );
}
