import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';

    const [pwd, setPwd]       = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy]     = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (pwd.length < 6)         { toast.error('รหัสผ่านอย่างน้อย 6 ตัว'); return; }
        if (pwd !== confirm)        { toast.error('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
        setBusy(true);
        try {
            await api.post('/auth/reset-password', { token, new_password: pwd });
            toast.success('รีเซ็ตรหัสผ่านเรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสใหม่');
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || 'รีเซ็ตล้มเหลว');
        } finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-600 to-brand-700 p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <h1 className="text-2xl font-bold text-slate-800 text-center">ตั้งรหัสผ่านใหม่</h1>
                {!token ? (
                    <div className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                        ลิงก์ไม่ถูกต้อง — ขาดพารามิเตอร์ token
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
                            <input type="password" required
                                   className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                                   value={pwd} onChange={(e) => setPwd(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600">ยืนยันรหัสผ่านใหม่</label>
                            <input type="password" required
                                   className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                                   value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                        </div>
                        <button type="submit" disabled={busy}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-md font-medium disabled:opacity-50">
                            {busy ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
                        </button>
                    </form>
                )}
                <div className="text-center text-sm mt-4">
                    <Link to="/login" className="text-brand-600 hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                </div>
            </div>
        </div>
    );
}
