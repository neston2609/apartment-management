import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ForgotPassword() {
    const [identifier, setIdentifier] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/auth/forgot-password', { identifier });
            setDone(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'ส่งอีเมลล้มเหลว');
        } finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen grid place-items-center app-bg p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-pink/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky/30 blur-3xl" />
            <div className="relative bg-white/80 backdrop-blur-xl rounded-[28px] shadow-soft-lg w-full max-w-md p-8 border border-[color:var(--border)]">
                <h1 className="font-display text-2xl font-bold text-center"><span className="aurora-text">ลืมรหัสผ่าน</span></h1>
                <p className="text-sm text-ink-3 text-center mt-1">
                    กรอกอีเมล / ชื่อผู้ใช้ / เลขบัตรประชาชน เพื่อรับลิงก์รีเซ็ตทางอีเมล
                </p>

                {done ? (
                    <div className="mt-6 text-sm text-ink-2 space-y-3">
                        <p className="bg-[#d1fae5] border border-[#10b981]/30 text-[#047857] rounded-xl px-3 py-2">
                            ถ้าบัญชีนี้มีอยู่ในระบบและมีอีเมล จะได้รับลิงก์รีเซ็ตในอีกสักครู่
                        </p>
                        <Link to="/login" className="text-violet font-semibold hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-ink-2 mb-1.5">อีเมล / ชื่อผู้ใช้ / เลขบัตรประชาชน</label>
                            <input type="text" required
                                   className="ui-input"
                                   value={identifier}
                                   onChange={(e) => setIdentifier(e.target.value)} />
                        </div>
                        <button type="submit" disabled={busy} className="btn btn-primary w-full !py-3">
                            {busy ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
                        </button>
                        <div className="text-center text-sm">
                            <Link to="/login" className="text-violet font-semibold hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
