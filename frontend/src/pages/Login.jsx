import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
            const dest =
                u.role === 'tenant'                              ? '/tenant/dashboard'
              : u.admin_role === 'property_manager'             ? '/admin/invoice'
              :                                                    '/admin/dashboard';
            navigate(dest, { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-600 to-brand-700 p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <h1 className="text-2xl font-bold text-slate-800 text-center">ระบบจัดการอพาร์ทเมนต์</h1>
                <p className="text-sm text-slate-500 text-center mt-1">กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>

                <div className="mt-6 flex bg-slate-100 rounded-lg p-1 text-sm">
                    {['admin', 'tenant'].map((m) => (
                        <button key={m} type="button" onClick={() => setMode(m)}
                                className={`flex-1 py-2 rounded-md transition ${
                                    mode === m ? 'bg-white shadow text-brand-700 font-medium' : 'text-slate-500'
                                }`}>
                            {m === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้เช่า'}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                    {mode === 'admin' ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-600">ชื่อผู้ใช้</label>
                            <input type="text" required
                                   className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-brand-500"
                                   value={form.username}
                                   onChange={(e) => setForm({ ...form, username: e.target.value })} />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-600">เลขบัตรประชาชน</label>
                            <input type="text" required
                                   className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-brand-500"
                                   value={form.national_id}
                                   onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-600">รหัสผ่าน</label>
                        <input type="password" required
                               className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-brand-500"
                               value={form.password}
                               onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <button type="submit" disabled={loading}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-md font-medium disabled:opacity-50">
                        {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                    </button>
                    <div className="text-right text-sm">
                        <Link to="/forgot-password" className="text-brand-600 hover:underline">
                            ลืมรหัสผ่าน?
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
