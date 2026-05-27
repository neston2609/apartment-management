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
                <h1 className="font-display text-3xl font-bold text-ink">แก้ไขข้อมูลส่วนตัว</h1>
                <p className="text-sm text-ink-3">
                    ห้อง {user?.room_number || '-'} · ข้อมูลของคุณจะใช้ในการออกใบแจ้งหนี้และสัญญา
                </p>
            </div>
            <form onSubmit={submit} className="ui-card p-5 space-y-3 text-sm">
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
                    <button type="submit" disabled={saving} className="btn btn-primary">
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
            <span className="text-ink-2 font-semibold">{label}</span>
            {textarea
                ? <textarea rows={2}
                            className="ui-input mt-1 !py-2"
                            value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
                : <input type={type}
                         className="ui-input mt-1 !py-2"
                         value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
            {hint && <span className="text-xs text-ink-4 mt-0.5 block">{hint}</span>}
        </label>
    );
}
