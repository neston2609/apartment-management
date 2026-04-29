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
                <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
                <p className="text-sm text-slate-500">การตั้งค่า SMTP สำหรับส่งอีเมลรีเซ็ตรหัสผ่าน</p>
            </div>

            <details className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
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

            <form onSubmit={save} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-sm">
                {KEYS.map((k) => (
                    <label key={k.key} className="block">
                        <span className="text-slate-600">{k.label}</span>
                        <input
                            type={k.type || 'text'}
                            placeholder={k.placeholder || ''}
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={form[k.key] ?? ''}
                            onChange={(e) => setForm({ ...form, [k.key]: e.target.value })}
                        />
                        {k.hint && <span className="text-xs text-slate-500 mt-0.5 block">{k.hint}</span>}
                    </label>
                ))}
                <div className="flex justify-end">
                    <button type="submit" disabled={saving}
                            className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>

            <div className="bg-white border border-slate-200 rounded-lg p-5 text-sm">
                <h2 className="font-semibold text-slate-700">ทดสอบส่งอีเมล</h2>
                <p className="text-xs text-slate-500 mt-1">บันทึกการตั้งค่าก่อนแล้วทดสอบส่งอีเมลไปยังที่อยู่ใด ๆ</p>
                <div className="flex gap-2 mt-3">
                    <input type="email" placeholder="recipient@example.com"
                           className="flex-1 rounded-md border border-slate-300 px-2 py-1.5"
                           value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                    <button onClick={sendTest} disabled={testing}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-md disabled:opacity-50">
                        {testing ? 'กำลังส่ง...' : 'ส่งทดสอบ'}
                    </button>
                </div>
            </div>
        </div>
    );
}
