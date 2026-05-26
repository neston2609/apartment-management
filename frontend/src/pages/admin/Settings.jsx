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

                {/* Payment & Late Fee */}
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

                {/* Bank Transfer Info */}
                <div className="border-t border-slate-200 pt-3 mt-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">ข้อมูลการโอนเงิน</h3>
                    <p className="text-xs text-slate-500 mb-2">
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

            {/* QR Code Section — separate upload, not part of the main form */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-sm">
                <h3 className="text-sm font-semibold text-slate-700">QR Code สำหรับชำระเงิน</h3>
                <p className="text-xs text-slate-500">อัปโหลดรูป QR Code พร้อมเพย์หรือ QR สำหรับโอนเงิน ผู้เช่าจะเห็นรูปนี้เมื่อกดชำระเงิน</p>

                <div className="flex flex-wrap items-start gap-4">
                    {displayQr && (
                        <div className="relative">
                            <img src={displayQr} alt="QR Code"
                                 className="w-36 h-36 object-contain border border-slate-200 rounded-lg bg-white" />
                            {qrPreview && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] px-1 rounded">
                                    ยังไม่ได้บันทึก
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md text-slate-700 text-xs">
                                เลือกรูป QR Code
                                <input ref={qrInputRef} type="file" accept="image/*" className="hidden"
                                       onChange={handleQrFileChange} />
                            </label>
                            {qrFile && (
                                <button type="button" onClick={uploadQr} disabled={qrUploading}
                                        className="bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded-md disabled:opacity-50">
                                    {qrUploading ? 'กำลังอัปโหลด...' : 'บันทึก QR Code'}
                                </button>
                            )}
                            {savedQrUrl && !qrFile && (
                                <button type="button" onClick={removeQr}
                                        className="bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-md">
                                    ลบ QR Code
                                </button>
                            )}
                        </div>
                        {!displayQr && (
                            <p className="text-xs text-slate-400">ยังไม่มี QR Code</p>
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
            <span className="text-slate-600">{label}</span>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                   value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
        </label>
    );
}
