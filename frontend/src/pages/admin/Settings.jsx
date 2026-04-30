import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

// Default rental contract terms (Thai) — used to pre-fill the textarea
// when an apartment has not yet customised its terms.
const DEFAULT_CONTRACT_TERMS = [
    '1. ผู้เช่าตกลงชำระค่าเช่าภายในวันที่ 5 ของทุกเดือน',
    '2. ผู้เช่าต้องรักษาทรัพย์สินภายในห้องพักให้อยู่ในสภาพดี',
    '3. ห้ามนำสัตว์เลี้ยงทุกชนิดเข้าพักโดยไม่ได้รับอนุญาต',
    '4. ห้ามประกอบกิจการที่ผิดกฎหมาย',
    '5. การบอกเลิกสัญญาต้องแจ้งล่วงหน้าอย่างน้อย 30 วัน',
    '6. ผู้เช่าต้องชำระค่าน้ำประปาและค่าไฟฟ้าตามมิเตอร์',
    '7. ห้ามดัดแปลงต่อเติมห้องพักโดยไม่ได้รับอนุญาต',
    '8. ผู้เช่าต้องส่งคืนห้องพักในสภาพเรียบร้อยเมื่อสิ้นสุดสัญญา',
    '9. การกระทำใด ๆ ที่ขัดต่อสัญญาฉบับนี้ ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาได้ทันที',
    '10. คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อตกลงทั้งหมดแล้ว',
].join('\n');

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
        unwrap(api.get(`/settings/${aptId}`)).then((d) => {
            // If the apartment has no custom contract terms yet, pre-fill the
            // textarea with the default 10 rules so the admin can see/edit them.
            const next = { ...d };
            if (!next.contract_terms || !next.contract_terms.trim()) {
                next.contract_terms = DEFAULT_CONTRACT_TERMS;
            }
            setForm(next);
        });
    }, [aptId]);

    const resetContractTerms = () => {
        if (!form) return;
        setForm({ ...form, contract_terms: DEFAULT_CONTRACT_TERMS });
    };

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
        <div className="max-w-3xl space-y-4">
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

                <div className="border-t border-slate-200 pt-3 mt-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">การชำระเงิน &amp; ค่าปรับ</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-slate-600">วันครบกำหนดชำระ (ของทุกเดือน)</span>
                            <input type="number" min={1} max={31}
                                   placeholder="เช่น 5"
                                   className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                   value={form.payment_due_day ?? ''}
                                   onChange={(e) => {
                                       const v = e.target.value;
                                       setForm({ ...form, payment_due_day: v === '' ? null : parseInt(v, 10) });
                                   }} />
                            <span className="text-xs text-slate-500 mt-0.5 block">
                                เว้นว่างถ้ายังไม่กำหนด — สถานะจะแสดงเป็น "ออกบิลแล้ว" แทน
                            </span>
                        </label>
                        <Field label="ค่าปรับต่อวัน (บาท)" type="number" step="0.01" min={0}
                               value={form.late_fee_per_day ?? 0}
                               onChange={(v) => setForm({ ...form, late_fee_per_day: parseFloat(v) || 0 })} />
                    </div>
                </div>
                <label className="block">
                    <span className="text-slate-600">ข้อความท้ายใบแจ้งหนี้</span>
                    <textarea rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                              value={form.invoice_footer_text || ''}
                              onChange={(e) => setForm({ ...form, invoice_footer_text: e.target.value })} />
                </label>

                <label className="block">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">ข้อตกลงและเงื่อนไข (สัญญาเช่า)</span>
                        <button type="button" onClick={resetContractTerms}
                                className="text-xs text-brand-600 hover:underline">
                            คืนค่าเริ่มต้น
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                        แต่ละบรรทัดคือ 1 ข้อ — บรรทัดที่ปรากฏที่นี่จะถูกพิมพ์ลงใน PDF สัญญาเช่า
                    </p>
                    <textarea rows={12}
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-[13px] leading-relaxed"
                              value={form.contract_terms || ''}
                              onChange={(e) => setForm({ ...form, contract_terms: e.target.value })} />
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
