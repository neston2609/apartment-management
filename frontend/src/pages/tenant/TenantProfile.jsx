import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../context/AuthContext';

export default function TenantProfile() {
    const { user, login, token } = useAuth();
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        unwrap(api.get(`/tenants/${user.id}`)).then((t) => {
            setForm({
                full_name:    t.full_name || '',
                phone_number: t.phone_number || '',
                email:        t.email || '',
                national_id:  t.national_id || '',
                address:      t.address || '',
            });
        }).catch(() => toast.error('โหลดข้อมูลล้มเหลว'));
    }, [user]);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updated = await unwrap(api.put('/tenants/me/profile', form));
            toast.success('บันทึกข้อมูลส่วนตัวเรียบร้อย');
            // Refresh local user copy so navbar shows new name
            login(token, { ...user, full_name: updated.full_name, national_id: updated.national_id });
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally { setSaving(false); }
    };

    if (!form) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="max-w-2xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">แก้ไขข้อมูลส่วนตัว</h1>
                <p className="text-sm text-slate-500">
                    ห้อง {user?.room_number || '-'} · ข้อมูลของคุณจะใช้ในการออกใบแจ้งหนี้และสัญญา
                </p>
            </div>
            <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-sm">
                <Field label="ชื่อ-นามสกุล" required value={form.full_name}
                       onChange={(v) => setForm({ ...form, full_name: v })} />
                <Field label="เบอร์โทรศัพท์" value={form.phone_number}
                       onChange={(v) => setForm({ ...form, phone_number: v })} />
                <Field label="เลขบัตรประชาชน" required value={form.national_id}
                       onChange={(v) => setForm({ ...form, national_id: v })} />
                <Field label="อีเมล" type="email" value={form.email}
                       onChange={(v) => setForm({ ...form, email: v })}
                       hint="ใช้สำหรับรีเซ็ตรหัสผ่าน" />
                <Field label="ที่อยู่" textarea value={form.address}
                       onChange={(v) => setForm({ ...form, address: v })} />

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

function Field({ label, value, onChange, type = 'text', textarea, hint, ...rest }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            {textarea
                ? <textarea rows={2}
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
                : <input type={type}
                         className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                         value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
            {hint && <span className="text-xs text-slate-400 mt-0.5 block">{hint}</span>}
        </label>
    );
}
