import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const EMPTY = {
    room_id: '', full_name: '', phone_number: '', national_id: '',
    move_in_date: new Date().toISOString().slice(0, 10), email: '', notes: '',
};

export default function TenantForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const editMode = !!id;

    const [apts, setApts] = useState([]);
    const [aptId, setAptId] = useState('');
    const [vacantRooms, setVacantRooms] = useState([]);
    const [form, setForm] = useState(EMPTY);
    const [origNid, setOrigNid] = useState('');
    const [resetPwd, setResetPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving]   = useState(false);

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => {
            setApts(r || []);
            if (r?.length && !editMode) setAptId(String(r[0].apartment_id));
        });
        if (editMode) {
            setLoading(true);
            unwrap(api.get(`/tenants/${id}`)).then((t) => {
                setForm({
                    room_id: t.room_id || '',
                    full_name: t.full_name,
                    phone_number: t.phone_number || '',
                    national_id: t.national_id,
                    move_in_date: t.move_in_date ? t.move_in_date.slice(0, 10) : '',
                    email: t.email || '',
                    notes: t.notes || '',
                });
                setOrigNid(t.national_id || '');
                setAptId(String(t.apartment_id || ''));
            }).finally(() => setLoading(false));
        }
    }, [id, editMode]);

    useEffect(() => {
        if (!aptId || editMode) return;
        unwrap(api.get(`/apartments/${aptId}/rooms`, { params: { status: 'vacant' } }))
            .then((r) => setVacantRooms(r || []));
    }, [aptId, editMode]);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editMode) {
                await api.put(`/tenants/${id}`, {
                    full_name: form.full_name,
                    phone_number: form.phone_number,
                    email: form.email,
                    notes: form.notes,
                    move_in_date: form.move_in_date,
                    national_id: form.national_id,
                    reset_password: resetPwd,
                });
                toast.success('บันทึกการแก้ไขแล้ว');
            } else {
                await api.post('/tenants', form);
                toast.success('เพิ่มผู้เช่าสำเร็จ (รหัสผ่าน = เลขบัตรประชาชน)');
            }
            navigate('/admin/tenants');
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold text-slate-800">
                {editMode ? 'แก้ไขผู้เช่า' : 'เพิ่มผู้เช่า'}
            </h1>

            <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-sm">
                {!editMode && (
                    <>
                        <Field label="อพาร์ทเมนต์" tag="select"
                               value={aptId} onChange={setAptId}>
                            <option value="">-- เลือก --</option>
                            {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                        </Field>
                        <Field label="ห้องว่าง" tag="select" required
                               value={form.room_id}
                               onChange={(v) => setForm({ ...form, room_id: parseInt(v, 10) })}>
                            <option value="">-- เลือกห้อง --</option>
                            {vacantRooms.map((r) => (
                                <option key={r.room_id} value={r.room_id}>
                                    ห้อง {r.room_number} (฿{r.rental_price})
                                </option>
                            ))}
                        </Field>
                    </>
                )}

                <Field label="ชื่อ-นามสกุล" required value={form.full_name}
                       onChange={(v) => setForm({ ...form, full_name: v })} />
                <Field label="เบอร์โทรศัพท์" value={form.phone_number}
                       onChange={(v) => setForm({ ...form, phone_number: v })} />
                <Field label="เลขบัตรประชาชน" required
                       value={form.national_id}
                       onChange={(v) => setForm({ ...form, national_id: v })} />
                {editMode && form.national_id !== origNid && (
                    <div className="-mt-2 ml-1 text-xs">
                        <label className="inline-flex items-center gap-2 text-slate-600">
                            <input type="checkbox" checked={resetPwd}
                                   onChange={(e) => setResetPwd(e.target.checked)} />
                            <span>รีเซ็ตรหัสผ่านผู้เช่าให้เท่ากับเลขบัตรใหม่ (ผู้เช่าจะใช้เลขบัตรใหม่เข้าระบบ)</span>
                        </label>
                    </div>
                )}
                <Field label="วันที่เข้าพัก" type="date" required value={form.move_in_date}
                       onChange={(v) => setForm({ ...form, move_in_date: v })} />
                <Field label="อีเมล" type="email" value={form.email}
                       onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="หมายเหตุ" tag="textarea" value={form.notes}
                       onChange={(v) => setForm({ ...form, notes: v })} />

                {!editMode && (
                    <p className="text-xs text-slate-500">
                        * รหัสผ่านเริ่มต้นจะเท่ากับเลขบัตรประชาชน ผู้เช่าควรเปลี่ยนรหัสผ่านเมื่อเข้าใช้งานครั้งแรก
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => navigate(-1)}
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

function Field({ label, value, onChange, tag = 'input', children, ...rest }) {
    const cls = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5';
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            {tag === 'select' ? (
                <select className={cls} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>{children}</select>
            ) : tag === 'textarea' ? (
                <textarea rows={2} className={cls} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
            ) : (
                <input className={cls} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
            )}
        </label>
    );
}
