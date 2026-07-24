import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, getUploadUrl } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

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
    const [apts, setApts]     = useState([]);
    const [aptId, setAptId]   = useState('');
    const [form, setForm]     = useState(null);
    const [saving, setSaving] = useState(false);

    // QR upload state
    const [qrPreview, setQrPreview]     = useState(null);   // object URL for local preview
    const [qrFile, setQrFile]           = useState(null);   // File object to upload
    const [qrUploading, setQrUploading] = useState(false);
    const qrInputRef = useRef(null);

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => {
            setApts(r || []);
            if (r?.length) setAptId(String(r[0].apartment_id));
        });
    }, []);

    useEffect(() => {
        if (!aptId) return;
        setQrPreview(null);
        setQrFile(null);
        unwrap(api.get(`/settings/${aptId}`)).then((d) => {
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

    const handleQrFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setQrFile(file);
        setQrPreview(URL.createObjectURL(file));
    };

    const uploadQr = async () => {
        if (!qrFile || !aptId) return;
        setQrUploading(true);
        try {
            const fd = new FormData();
            fd.append('qr_code', qrFile);
            const res = await api.post(`/settings/${aptId}/upload-qr`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const updated = res.data?.data ?? res.data;
            setForm((f) => ({ ...f, qr_code_path: updated.qr_code_path, qr_code_url: updated.qr_code_url }));
            setQrFile(null);
            setQrPreview(null);
            if (qrInputRef.current) qrInputRef.current.value = '';
            toast.success('อัปโหลด QR Code แล้ว');
        } catch (err) {
            toast.error(err.response?.data?.error || 'อัปโหลด QR ล้มเหลว');
        } finally { setQrUploading(false); }
    };

    const removeQr = async () => {
        if (!aptId) return;
        if (!window.confirm('ลบ QR Code ออก?')) return;
        try {
            await api.delete(`/settings/${aptId}/qr`);
            setForm((f) => ({ ...f, qr_code_path: null, qr_code_url: null }));
            setQrFile(null);
            setQrPreview(null);
            if (qrInputRef.current) qrInputRef.current.value = '';
            toast.success('ลบ QR Code แล้ว');
        } catch (err) {
            toast.error(err.response?.data?.error || 'ลบ QR ล้มเหลว');
        }
    };

    if (!form) return <div className="grid place-items-center h-64"><Spinner /></div>;

    const savedQrUrl = form.qr_code_url || (form.qr_code_path ? getUploadUrl(form.qr_code_path) : null);
    const displayQr  = qrPreview || savedQrUrl;

    return (
        <div className="max-w-3xl space-y-4">
            <h1 className="font-display text-3xl font-bold text-ink">ตั้งค่า</h1>

            <div className="ui-card p-3.5 text-sm">
                <label className="text-ink-2 font-medium mr-2">อพาร์ทเมนต์:</label>
                <select value={aptId} onChange={(e) => setAptId(e.target.value)}
                        className="ui-input !py-2 !w-auto inline-block">
                    {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                </select>
            </div>

            <form onSubmit={submit} className="ui-card p-5 space-y-3 text-sm">
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

                {/* Common-area electricity fee */}
                <div className="border-t border-[color:var(--border)] pt-3 mt-2">
                    <h3 className="font-display text-sm font-bold text-ink mb-2">ค่าบริการไฟส่วนกลาง</h3>

                    <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                        <input type="checkbox"
                               className="h-4 w-4 accent-brand-600"
                               checked={form.common_fee_enabled === true}
                               onChange={(e) => setForm({ ...form, common_fee_enabled: e.target.checked })} />
                        <span className="text-ink-2 font-semibold">เปิดเก็บค่าบริการไฟส่วนกลาง</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="ราคาต่อหน่วยไฟฟ้า (บาท/หน่วย)" type="number" step="0.01" min={0}
                               disabled={form.common_fee_enabled !== true}
                               value={form.common_fee_per_unit ?? 0}
                               onChange={(v) => setForm({ ...form, common_fee_per_unit: parseFloat(v) || 0 })} />
                    </div>
                    <span className="text-xs text-ink-3 mt-1 block">
                        คิดจากจำนวนหน่วยไฟฟ้าที่ห้องใช้ (เช่น 2 บาท/หน่วย × 200 หน่วย = 400 บาท)
                        {form.common_fee_enabled !== true && ' — ปิดอยู่: จะไม่คิดและไม่แสดงในบิล'}
                    </span>
                </div>

                {/* Payment & Late Fee */}
                <div className="border-t border-[color:var(--border)] pt-3 mt-2">
                    <h3 className="font-display text-sm font-bold text-ink mb-2">การชำระเงิน &amp; ค่าปรับ</h3>

                    <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                        <input type="checkbox"
                               className="h-4 w-4 accent-brand-600"
                               checked={form.late_fee_enabled !== false}
                               onChange={(e) => setForm({ ...form, late_fee_enabled: e.target.checked })} />
                        <span className="text-ink-2 font-semibold">เปิดเก็บค่าปรับเมื่อเกินกำหนด</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-ink-2 font-semibold">วันครบกำหนดชำระ (ของทุกเดือน)</span>
                            <input type="number" min={1} max={31}
                                   placeholder="เช่น 5"
                                   className="ui-input mt-1 !py-2"
                                   value={form.payment_due_day ?? ''}
                                   onChange={(e) => {
                                       const v = e.target.value;
                                       setForm({ ...form, payment_due_day: v === '' ? null : parseInt(v, 10) });
                                   }} />
                            <span className="text-xs text-ink-3 mt-0.5 block">
                                เว้นว่างถ้ายังไม่กำหนด — สถานะจะแสดงเป็น "ออกบิลแล้ว" แทน
                            </span>
                        </label>
                        <Field label="ค่าปรับต่อวัน (บาท)" type="number" step="0.01" min={0}
                               disabled={form.late_fee_enabled === false}
                               value={form.late_fee_per_day ?? 0}
                               onChange={(v) => setForm({ ...form, late_fee_per_day: parseFloat(v) || 0 })} />
                    </div>
                    {form.late_fee_enabled === false && (
                        <span className="text-xs text-ink-3 mt-1 block">
                            ปิดอยู่ — บิลที่เกินกำหนดจะยังแสดงสถานะ "เกินกำหนด" แต่จะไม่คิดค่าปรับ
                        </span>
                    )}
                </div>

                {/* Bank Transfer Info */}
                <div className="border-t border-[color:var(--border)] pt-3 mt-2">
                    <h3 className="font-display text-sm font-bold text-ink mb-2">ข้อมูลการโอนเงิน</h3>
                    <p className="text-xs text-ink-3 mb-2">
                        ข้อมูลนี้จะแสดงให้ผู้เช่าเห็นเมื่อต้องการชำระเงิน
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                        <Field label="ชื่อธนาคาร"
                               value={form.bank_name || ''}
                               onChange={(v) => setForm({ ...form, bank_name: v })}
                               placeholder="เช่น ธนาคารกสิกรไทย" />
                        <Field label="เลขบัญชี"
                               value={form.bank_account_number || ''}
                               onChange={(v) => setForm({ ...form, bank_account_number: v })}
                               placeholder="เช่น 123-4-56789-0" />
                        <Field label="ชื่อบัญชี"
                               value={form.bank_account_name || ''}
                               onChange={(v) => setForm({ ...form, bank_account_name: v })}
                               placeholder="เช่น นายสมชาย ใจดี" />
                    </div>
                </div>

                <label className="block">
                    <span className="text-ink-2 font-semibold">ข้อความท้ายใบแจ้งหนี้</span>
                    <textarea rows={3} className="ui-input mt-1 !py-2"
                              value={form.invoice_footer_text || ''}
                              onChange={(e) => setForm({ ...form, invoice_footer_text: e.target.value })} />
                </label>

                <label className="block">
                    <div className="flex items-center justify-between">
                        <span className="text-ink-2 font-semibold">ข้อตกลงและเงื่อนไข (สัญญาเช่า)</span>
                        <button type="button" onClick={resetContractTerms}
                                className="text-xs text-brand-600 hover:underline">
                            คืนค่าเริ่มต้น
                        </button>
                    </div>
                    <p className="text-xs text-ink-4 mt-0.5">
                        แต่ละบรรทัดคือ 1 ข้อ — บรรทัดที่ปรากฏที่นี่จะถูกพิมพ์ลงใน PDF สัญญาเช่า
                    </p>
                    <textarea rows={12}
                              className="ui-input mt-1 !py-2 font-mono text-[13px] leading-relaxed"
                              value={form.contract_terms || ''}
                              onChange={(e) => setForm({ ...form, contract_terms: e.target.value })} />
                </label>

                <div className="flex justify-end">
                    <button type="submit" disabled={saving} className="btn btn-primary">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>

            {/* QR Code Section — separate upload, not part of the main form */}
            <div className="ui-card p-5 space-y-3 text-sm">
                <h3 className="font-display text-sm font-bold text-ink">QR Code สำหรับชำระเงิน</h3>
                <p className="text-xs text-ink-3">อัปโหลดรูป QR Code พร้อมเพย์หรือ QR สำหรับโอนเงิน ผู้เช่าจะเห็นรูปนี้เมื่อกดชำระเงิน</p>

                <div className="flex flex-wrap items-start gap-4">
                    {displayQr && (
                        <div className="relative">
                            <img src={displayQr} alt="QR Code"
                                 className="w-36 h-36 object-contain border border-[color:var(--border)] rounded-2xl bg-white" />
                            {qrPreview && (
                                <span className="absolute -top-1 -right-1 bg-orange text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    ยังไม่ได้บันทึก
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <label className="btn btn-ghost cursor-pointer !text-xs !py-1.5">
                                เลือกรูป QR Code
                                <input ref={qrInputRef} type="file" accept="image/*" className="hidden"
                                       onChange={handleQrFileChange} />
                            </label>
                            {qrFile && (
                                <button type="button" onClick={uploadQr} disabled={qrUploading}
                                        className="btn btn-primary !text-xs !py-1.5">
                                    {qrUploading ? 'กำลังอัปโหลด...' : 'บันทึก QR Code'}
                                </button>
                            )}
                            {savedQrUrl && !qrFile && (
                                <button type="button" onClick={removeQr}
                                        className="btn !text-xs !py-1.5 bg-[#fee2e2] text-[#b91c1c]">
                                    ลบ QR Code
                                </button>
                            )}
                        </div>
                        {!displayQr && (
                            <p className="text-xs text-ink-4">ยังไม่มี QR Code</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, ...rest }) {
    return (
        <label className="block">
            <span className="text-ink-2 font-semibold">{label}</span>
            <input className="ui-input mt-1 !py-2"
                   value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        </label>
    );
}
