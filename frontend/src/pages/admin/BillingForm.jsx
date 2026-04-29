import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

export default function BillingForm() {
    const { roomId, month, year } = useParams();
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [settings, setSettings] = useState(null);
    const [existing, setExisting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);

    const [form, setForm] = useState({
        water_units_last: 0, water_units_current: 0, rollover_water: false,
        electricity_units_last: 0, electricity_units_current: 0, rollover_electricity: false,
        rent_cost: 0, other_cost: 0,
    });

    useEffect(() => {
        (async () => {
            let r, s;
            try {
                r = await unwrap(api.get(`/rooms/${roomId}`));
                setRoom(r);
                s = await unwrap(api.get(`/settings/${r.apartment_id}`));
                setSettings(s);
            } catch (err) {
                toast.error('โหลดข้อมูลห้อง/ตั้งค่าล้มเหลว');
                setLoading(false);
                return;
            }

            let m = null, cur = null;
            try {
                m = await unwrap(api.get(`/bills/meter/${roomId}`, { params: { month, year } }));
            } catch { m = null; }
            try {
                const bills = await unwrap(api.get('/bills',
                    { params: { apartment_id: r.apartment_id, month, year } }));
                cur = (bills || []).find((x) => x.room_id === Number(roomId)) || null;
            } catch { cur = null; }
            setExisting(cur);

            const num = (v) => {
                const n = parseFloat(v);
                return Number.isFinite(n) ? n : 0;
            };
            setForm({
                water_units_last:          num(m?.water_units_last),
                water_units_current:       num(m?.water_units_current),
                rollover_water:            !!m?.rollover_water,
                electricity_units_last:    num(m?.electricity_units_last),
                electricity_units_current: num(m?.electricity_units_current),
                rollover_electricity:      !!m?.rollover_electricity,
                rent_cost:                 num(r.rental_price),
                other_cost:                cur ? num(cur.other_cost) : 0,
            });
            setLoading(false);
        })();
    }, [roomId, month, year]);

    const calc = () => {
        if (!settings) return { water_cost: 0, electricity_cost: 0, total: 0, w_usage: 0, e_usage: 0 };
        const w_usage = form.rollover_water
            ? (Number(settings.water_max_units) - Number(form.water_units_last)) + Number(form.water_units_current)
            : Number(form.water_units_current) - Number(form.water_units_last);
        const e_usage = form.rollover_electricity
            ? (Number(settings.electricity_max_units) - Number(form.electricity_units_last)) + Number(form.electricity_units_current)
            : Number(form.electricity_units_current) - Number(form.electricity_units_last);
        const water_cost       = w_usage * Number(settings.water_price_per_unit);
        const electricity_cost = e_usage * Number(settings.electricity_price_per_unit);
        const total = water_cost + electricity_cost + Number(form.rent_cost) + Number(form.other_cost);
        return { water_cost, electricity_cost, total, w_usage, e_usage };
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                room_id: Number(roomId),
                month: Number(month), year: Number(year),
                ...form,
            };
            if (existing) {
                await api.put(`/bills/${existing.bill_id}`, payload);
            } else {
                await api.post('/bills', payload);
            }
            toast.success('บันทึกใบแจ้งหนี้แล้ว');
            navigate('/admin/billing');
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally { setSaving(false); }
    };

    if (loading || !room || !settings) return <div className="grid place-items-center h-64"><Spinner /></div>;

    const c = calc();
    return (
        <div className="max-w-3xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    {existing ? 'แก้ไขใบแจ้งหนี้' : 'สร้างใบแจ้งหนี้'}
                </h1>
                <p className="text-sm text-slate-500">
                    ห้อง {room.room_number} · ประจำเดือน {THAI_MONTHS[Number(month) - 1]} {thaiYear(year)}
                </p>
            </div>

            <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-sm">
                <Section title="ค่าน้ำประปา">
                    <div className="grid grid-cols-2 gap-3">
                        <NumInput int label="มิเตอร์ครั้งก่อน" value={form.water_units_last}
                                onChange={(v) => setForm({ ...form, water_units_last: v })} />
                        <NumInput int label="มิเตอร์ครั้งนี้" value={form.water_units_current}
                                onChange={(v) => setForm({ ...form, water_units_current: v })} />
                    </div>
                    <p className="text-xs text-slate-500">
                        มิเตอร์ครั้งก่อนดึงจากค่าล่าสุดอัตโนมัติ (ถ้ายังไม่มี = 0) สามารถแก้ไขได้
                    </p>
                    <Checkbox label="มิเตอร์ครบรอบ (rollover)" checked={form.rollover_water}
                              onChange={(v) => setForm({ ...form, rollover_water: v })} />
                    <p className="text-xs text-slate-500">
                        ราคา/หน่วย: ฿ {fmtMoney(settings.water_price_per_unit)} ·
                        จำนวนหน่วย: {Math.trunc(c.w_usage)} · รวมค่าน้ำ: ฿ {fmtMoney(c.water_cost)}
                    </p>
                </Section>

                <Section title="ค่าไฟฟ้า">
                    <div className="grid grid-cols-2 gap-3">
                        <NumInput int label="มิเตอร์ครั้งก่อน" value={form.electricity_units_last}
                                onChange={(v) => setForm({ ...form, electricity_units_last: v })} />
                        <NumInput int label="มิเตอร์ครั้งนี้" value={form.electricity_units_current}
                                onChange={(v) => setForm({ ...form, electricity_units_current: v })} />
                    </div>
                    <p className="text-xs text-slate-500">
                        มิเตอร์ครั้งก่อนดึงจากค่าล่าสุดอัตโนมัติ (ถ้ายังไม่มี = 0) สามารถแก้ไขได้
                    </p>
                    <Checkbox label="มิเตอร์ครบรอบ (rollover)" checked={form.rollover_electricity}
                              onChange={(v) => setForm({ ...form, rollover_electricity: v })} />
                    <p className="text-xs text-slate-500">
                        ราคา/หน่วย: ฿ {fmtMoney(settings.electricity_price_per_unit)} ·
                        จำนวนหน่วย: {Math.trunc(c.e_usage)} · รวมค่าไฟ: ฿ {fmtMoney(c.electricity_cost)}
                    </p>
                </Section>

                <Section title="ค่าใช้จ่ายอื่น">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <NumInput label="ค่าเช่าห้อง" value={form.rent_cost}
                                    onChange={(v) => setForm({ ...form, rent_cost: v })} />
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span>ดึงจากราคาห้องที่ตั้งไว้: ฿ {fmtMoney(room.rental_price)}</span>
                                {Number(form.rent_cost) !== Number(room.rental_price) && (
                                    <button type="button"
                                            onClick={() => setForm({ ...form, rent_cost: Number(room.rental_price) || 0 })}
                                            className="text-brand-600 hover:underline">
                                        ใช้ราคาห้องล่าสุด
                                    </button>
                                )}
                            </div>
                        </div>
                        <NumInput label="ค่าอื่น ๆ" value={form.other_cost}
                                onChange={(v) => setForm({ ...form, other_cost: v })} />
                    </div>
                </Section>

                <div className="bg-brand-50 border border-brand-500/20 rounded-md p-4 flex items-center justify-between">
                    <span className="text-slate-700">รวมทั้งสิ้น</span>
                    <span className="text-2xl font-bold text-brand-700">฿ {fmtMoney(c.total)}</span>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => navigate('/admin/billing')}
                            className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                    <button type="submit" disabled={saving}
                            className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-2">
            <h3 className="font-semibold text-slate-700">{title}</h3>
            {children}
        </div>
    );
}

function NumInput({ label, value, onChange, int = false }) {
    const step = int ? '1' : '0.01';
    const parse = int ? (s) => parseInt(s, 10) || 0 : (s) => parseFloat(s) || 0;
    const num = Number.isFinite(+value) ? +value : 0;
    const display = int ? Math.trunc(num) : num;
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            <input type="number" step={step} min="0"
                   inputMode={int ? 'numeric' : 'decimal'}
                   className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                   value={display}
                   onChange={(e) => onChange(parse(e.target.value))} />
        </label>
    );
}

function Checkbox({ label, checked, onChange }) {
    return (
        <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="text-slate-600">{label}</span>
        </label>
    );
}
