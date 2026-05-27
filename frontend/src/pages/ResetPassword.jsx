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
        <div className="min-h-screen grid place-items-center app-bg p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-violet/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky/30 blur-3xl" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-[28px] shadow-soft-lg w-full max-w-md p-8 border border-[color:var(--border)]">
                <h1 className="font-display text-2xl font-bold text-center"><span className="aurora-text">ตั้งรหัสผ่านใหม่</span></h1>
                {!token ? (
                    <div className="mt-6 text-sm text-[#b91c1c] bg-[#fee2e2] border border-[#ef4444]/30 rounded-xl p-3">
                        ลิงก์ไม่ถูกต้อง — ขาดพารามิเตอร์ token
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-ink-2 mb-1.5">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
                            <input type="password" required
                                   className="ui-input"
                                   value={pwd} onChange={(e) => setPwd(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-ink-2 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                            <input type="password" required
                                   className="ui-input"
                                   value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                        </div>
                        <button type="submit" disabled={busy} className="btn btn-primary w-full !py-3">
                            {busy ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
                        </button>
                    </form>
                )}
                <div className="text-center text-sm mt-4">
                    <Link to="/login" className="text-violet font-semibold hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                </div>
            </div>
        </div>
    );
}
