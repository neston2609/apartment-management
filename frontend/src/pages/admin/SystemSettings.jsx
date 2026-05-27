import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const KEYS = [
    { key: 'smtp_host',     label: 'SMTP Host',     placeholder: 'smtp.gmail.com' },
    { key: 'smtp_port',     label: 'SMTP Port',     placeholder: '587' },
    { key: 'smtp_secure',   label: 'SSL/TLS',       hint: 'true หรือ false (Gmail STARTTLS = false)' },
    { key: 'smtp_user',     label: 'SMTP Username', placeholder: 'your-account@gmail.com' },
    { key: 'smtp_password', label: 'SMTP Password', type: 'password',
      hint: 'สำหรับ Gmail ต้องเป็น App Password (16 ตัว) ไม่ใช่รหัสผ่านบัญชี' },
    { key: 'smtp_from',     label: 'From Address',  placeholder: 'no-reply@yourdomain.com' },
    { key: 'app_base_url',  label: 'App Base URL',
      placeholder: 'http://localhost:3000',
      hint: 'URL ของหน้าเว็บที่ผู้ใช้เข้า — ใช้สร้างลิงก์รีเซ็ตรหัสผ่าน' },
];

export default function SystemSettings() {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [testTo, setTestTo] = useState('');
    const [testing, setTesting] = useState(false);

    const load = async () => {
        try {
            const data = await unwrap(api.get('/system-settings'));
            setForm(data || {});
        } catch (err) {
            toast.error(err.response?.data?.error || 'โหลดข้อมูลล้มเหลว');
        }
    };
    useEffect(() => { load(); }, []);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/system-settings', form);
            toast.success('บันทึกการตั้งค่าแล้ว');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally { setSaving(false); }
    };

    const sendTest = async () => {
        if (!testTo) { toast.error('กรอกอีเมลผู้รับก่อน'); return; }
        setTesting(true);
        try {
            await api.post('/system-settings/test-email', { to: testTo });
            toast.success(`ส่งอีเมลทดสอบไปที่ ${testTo} แล้ว`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'ส่งล้มเหลว');
        } finally { setTesting(false); }
    };

    if (!form) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="max-w-2xl space-y-4">
            <div>
                <h1 className="font-display text-3xl font-bold text-ink">ตั้งค่าระบบ</h1>
                <p className="text-sm text-ink-3">การตั้งค่า SMTP สำหรับส่งอีเมลรีเซ็ตรหัสผ่าน</p>
            </div>

            <details className="bg-sunshine-soft border border-sunshine/40 rounded-2xl p-4 text-sm text-[#92400e]">
                <summary className="font-medium cursor-pointer">
                    วิธีตั้งค่า Gmail App Password
                </summary>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>เปิด 2-Step Verification ในบัญชี Google ของคุณก่อน</li>
                    <li>ไปที่ <a className="underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a></li>
                    <li>สร้าง App Password ใหม่ (16 ตัวอักษร)</li>
                    <li>นำมาวางใน "SMTP Password" ด้านล่าง</li>
                    <li>SMTP Host: <code>smtp.gmail.com</code> · Port: <code>587</code> · SSL/TLS: <code>false</code></li>
                </ol>
            </details>

            <form onSubmit={save} className="ui-card p-5 space-y-3 text-sm">
                {KEYS.map((k) => (
                    <label key={k.key} className="block">
                        <span className="text-ink-2 font-semibold">{k.label}</span>
                        <input
                            type={k.type || 'text'}
                            placeholder={k.placeholder || ''}
                            className="ui-input mt-1 !py-2"
                            value={form[k.key] ?? ''}
                            onChange={(e) => setForm({ ...form, [k.key]: e.target.value })}
                        />
                        {k.hint && <span className="text-xs text-ink-3 mt-0.5 block">{k.hint}</span>}
                    </label>
                ))}
                <div className="flex justify-end">
                    <button type="submit" disabled={saving} className="btn btn-primary">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>

            <div className="ui-card p-5 text-sm">
                <h2 className="font-display font-bold text-ink">ทดสอบส่งอีเมล</h2>
                <p className="text-xs text-ink-3 mt-1">บันทึกการตั้งค่าก่อนแล้วทดสอบส่งอีเมลไปยังที่อยู่ใด ๆ</p>
                <div className="flex gap-2 mt-3">
                    <input type="email" placeholder="recipient@example.com"
                           className="ui-input !py-2 flex-1"
                           value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                    <button onClick={sendTest} disabled={testing} className="btn btn-ghost">
                        {testing ? 'กำลังส่ง...' : 'ส่งทดสอบ'}
                    </button>
                </div>
            </div>
        </div>
    );
}
