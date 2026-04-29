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
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-600 to-brand-700 p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <h1 className="text-2xl font-bold text-slate-800 text-center">ลืมรหัสผ่าน</h1>
                <p className="text-sm text-slate-500 text-center mt-1">
                    กรอกอีเมล / ชื่อผู้ใช้ / เลขบัตรประชาชน เพื่อรับลิงก์รีเซ็ตทางอีเมล
                </p>

                {done ? (
                    <div className="mt-6 text-sm text-slate-700 space-y-3">
                        <p className="bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2">
                            ถ้าบัญชีนี้มีอยู่ในระบบและมีอีเมล จะได้รับลิงก์รีเซ็ตในอีกสักครู่
                        </p>
                        <Link to="/login" className="text-brand-600 hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600">อีเมล / ชื่อผู้ใช้ / เลขบัตรประชาชน</label>
                            <input type="text" required
                                   className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-brand-500"
                                   value={identifier}
                                   onChange={(e) => setIdentifier(e.target.value)} />
                        </div>
                        <button type="submit" disabled={busy}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-md font-medium disabled:opacity-50">
                            {busy ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
                        </button>
                        <div className="text-center text-sm">
                            <Link to="/login" className="text-brand-600 hover:underline">← กลับไปหน้าเข้าสู่ระบบ</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
