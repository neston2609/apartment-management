import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { unwrap } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [mode, setMode] = useState('admin');
    const [form, setForm] = useState({ username: '', password: '', national_id: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url  = mode === 'admin' ? '/auth/login' : '/auth/tenant/login';
            const body = mode === 'admin'
                ? { username: form.username, password: form.password }
                : { national_id: form.national_id, password: form.password };
            const data = await unwrap(api.post(url, body));
            login(data.token, data.user);
            toast.success('เข้าสู่ระบบสำเร็จ');
            const u = data.user;
            const dest = u.role === 'tenant' ? '/tenant/dashboard' : '/admin/dashboard';
            navigate(dest, { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center app-bg p-6 relative overflow-hidden">
            {/* aurora blobs */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-pink/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky/30 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sunshine/20 blur-3xl" />

            <div className="relative bg-white/80 backdrop-blur-xl rounded-[28px] shadow-soft-lg w-full max-w-md p-8 border border-[color:var(--border)]">
                <div className="flex justify-center mb-4">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-grad-aurora shadow-glow-violet">
                        <BuildingOffice2Icon className="h-7 w-7 text-white" />
                    </div>
                </div>
                <h1 className="font-display text-2xl font-bold text-center">
                    <span className="aurora-text">ระบบจัดการอพาร์ทเมนต์</span>
                </h1>
                <p className="text-sm text-ink-3 text-center mt-1">กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>

                <div className="mt-6 flex bg-cream-2 rounded-2xl p-1 text-sm">
                    {['admin', 'tenant'].map((m) => (
                        <button key={m} type="button" onClick={() => setMode(m)}
                                className={`flex-1 py-2 rounded-xl transition-all ${
                                    mode === m
                                        ? 'bg-grad-aurora shadow-glow-violet text-white font-bold'
                                        : 'text-ink-3 hover:text-ink-2'
                                }`}>
                            {m === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้เช่า'}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                    {mode === 'admin' ? (
                        <div>
                            <label className="block text-sm font-semibold text-ink-2 mb-1.5">ชื่อผู้ใช้</label>
                            <input type="text" required
                                   className="ui-input"
                                   value={form.username}
                                   onChange={(e) => setForm({ ...form, username: e.target.value })} />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold text-ink-2 mb-1.5">เลขบัตรประชาชน หรือ เลขห้อง</label>
                            <input type="text" required
                                   placeholder="กรอกเลขบัตรประชาชน หรือเลขห้องของคุณ"
                                   className="ui-input"
                                   value={form.national_id}
                                   onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                            <p className="mt-1 text-xs text-ink-4">
                                ระบบจะตรวจเลขบัตรก่อน หากไม่พบจะใช้เลขห้องค้นหาแทน
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-ink-2 mb-1.5">รหัสผ่าน</label>
                        <input type="password" required
                               className="ui-input"
                               value={form.password}
                               onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <button type="submit" disabled={loading}
                            className="btn btn-primary w-full !py-3">
                        {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                    </button>
                    <div className="text-right text-sm">
                        <Link to="/forgot-password" className="text-violet font-semibold hover:underline">
                            ลืมรหัสผ่าน?
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
