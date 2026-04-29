import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = [
    { value: 'super_admin',      label: 'ผู้ดูแลระบบสูงสุด (เพิ่ม/ลบผู้ใช้ได้)' },
    { value: 'admin',            label: 'ผู้ดูแลระบบ (จัดการระบบทั้งหมด)' },
    { value: 'property_manager', label: 'ผู้ดูแลหอพัก (เฉพาะพิมพ์ใบแจ้งหนี้)' },
];

const ROLE_BADGE = {
    super_admin:      'bg-purple-100 text-purple-700',
    admin:            'bg-blue-100 text-blue-700',
    property_manager: 'bg-amber-100 text-amber-700',
};

export default function Users() {
    const { user: me } = useAuth();
    const [users, setUsers]     = useState([]);
    const [tenants, setTenants] = useState([]);
    const [apts, setApts]       = useState([]);
    const [loading, setLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen]     = useState(null); // user row or null
    const [resetOpen, setResetOpen]   = useState(null); // tenant row or null
    const [tenantSearch, setTenantSearch] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [u, t, a] = await Promise.all([
                unwrap(api.get('/users')),
                unwrap(api.get('/tenants')),
                unwrap(api.get('/apartments')),
            ]);
            setUsers(u || []);
            setTenants(t || []);
            setApts(a || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'โหลดข้อมูลล้มเหลว');
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const handleDelete = async (u) => {
        if (u.admin_id === me?.id) { toast.error('ไม่สามารถลบบัญชีของตัวเอง'); return; }
        if (!window.confirm(`ลบผู้ใช้ "${u.username}" ?`)) return;
        try {
            await api.delete(`/users/${u.admin_id}`);
            toast.success('ลบเรียบร้อย');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ลบไม่สำเร็จ');
        }
    };

    const visibleTenants = tenants.filter((t) => {
        const q = tenantSearch.trim().toLowerCase();
        if (!q) return true;
        return [t.full_name, t.national_id, t.room_number]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
    });

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้</h1>
                <button onClick={() => setCreateOpen(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-md">
                    เพิ่มผู้ใช้
                </button>
            </div>

            {/* Admin users */}
            <section className="bg-white border border-slate-200 rounded-lg">
                <div className="px-5 py-3 border-b border-slate-200">
                    <h2 className="font-semibold text-slate-700">ผู้ดูแลระบบ / ผู้ดูแลหอพัก</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        ผู้ดูแลหอพักจะเห็นเฉพาะหน้า "พิมพ์ใบแจ้งหนี้" เท่านั้น
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left px-4 py-2">ชื่อผู้ใช้</th>
                                <th className="text-left px-4 py-2">ชื่อ-สกุล</th>
                                <th className="text-left px-4 py-2">อีเมล</th>
                                <th className="text-left px-4 py-2">บทบาท</th>
                                <th className="text-left px-4 py-2">อพาร์ทเมนต์</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.admin_id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium">{u.username}{u.admin_id === me?.id && (<span className="ml-1 text-xs text-slate-400">(คุณ)</span>)}</td>
                                    <td className="px-4 py-2">{u.full_name || '-'}</td>
                                    <td className="px-4 py-2">{u.email || '-'}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-700'}`}>
                                            {u.role_label || u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">{u.apartment_name || '-'}</td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex gap-2 justify-end text-xs">
                                            <button onClick={() => setEditOpen(u)}
                                                    className="text-brand-600 hover:underline">แก้ไข</button>
                                            <button onClick={() => handleDelete(u)}
                                                    disabled={u.admin_id === me?.id}
                                                    className="text-red-600 hover:underline disabled:opacity-40 disabled:no-underline">
                                                ลบ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">ยังไม่มีผู้ใช้</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Tenant password reset */}
            <section className="bg-white border border-slate-200 rounded-lg">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-slate-700">รีเซ็ตรหัสผ่านผู้เช่า</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            ค้นหาผู้เช่าตามชื่อ เลขห้อง หรือเลขบัตรประชาชน แล้วกดรีเซ็ตเพื่อกำหนดรหัสผ่านใหม่
                        </p>
                    </div>
                    <input type="text" placeholder="ค้นหา..."
                           value={tenantSearch}
                           onChange={(e) => setTenantSearch(e.target.value)}
                           className="border border-slate-300 rounded-md px-2 py-1 text-sm w-48" />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-left px-4 py-2">ห้อง</th>
                                <th className="text-left px-4 py-2">ชื่อ-สกุล</th>
                                <th className="text-left px-4 py-2">เลขบัตร</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTenants.map((t) => (
                                <tr key={t.tenant_id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium">{t.room_number || '-'}</td>
                                    <td className="px-4 py-2">{t.full_name}</td>
                                    <td className="px-4 py-2">{t.national_id}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => setResetOpen(t)}
                                                className="text-brand-600 hover:underline text-xs">
                                            รีเซ็ตรหัสผ่าน
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visibleTenants.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">ไม่พบผู้เช่า</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <CreateUserModal open={createOpen}
                             onClose={() => setCreateOpen(false)}
                             onSaved={load}
                             apts={apts} />
            <EditUserModal open={!!editOpen}
                           user={editOpen}
                           onClose={() => setEditOpen(null)}
                           onSaved={load}
                           apts={apts} />
            <ResetTenantPwdModal open={!!resetOpen}
                                 tenant={resetOpen}
                                 onClose={() => setResetOpen(null)} />
        </div>
    );
}

// ----------------------------------------------------------
function CreateUserModal({ open, onClose, onSaved, apts }) {
    const [form, setForm] = useState({
        username: '', password: '', full_name: '', email: '',
        role: 'admin', apartment_id: '',
    });
    const [busy, setBusy] = useState(false);
    const reset = () => setForm({
        username: '', password: '', full_name: '', email: '',
        role: 'admin', apartment_id: '',
    });

    const submit = async () => {
        if (!form.username.trim()) { toast.error('กรอกชื่อผู้ใช้'); return; }
        if (form.password.length < 6) { toast.error('รหัสผ่านอย่างน้อย 6 ตัว'); return; }
        setBusy(true);
        try {
            await api.post('/users', {
                ...form,
                apartment_id: form.apartment_id ? Number(form.apartment_id) : null,
            });
            toast.success('สร้างผู้ใช้เรียบร้อย');
            reset();
            onClose();
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'สร้างไม่สำเร็จ');
        } finally { setBusy(false); }
    };

    return (
        <Modal open={open} title="เพิ่มผู้ใช้"
               onClose={() => { reset(); onClose(); }}
               footer={
                   <>
                       <button onClick={() => { reset(); onClose(); }}
                               className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                       <button onClick={submit} disabled={busy}
                               className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                           {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                       </button>
                   </>
               }>
            <div className="space-y-3 text-sm">
                <Field label="ชื่อผู้ใช้ (สำหรับ login)" required
                       value={form.username}
                       onChange={(v) => setForm({ ...form, username: v })} />
                <Field label="รหัสผ่าน (อย่างน้อย 6 ตัว)" type="password" required
                       value={form.password}
                       onChange={(v) => setForm({ ...form, password: v })} />
                <Field label="ชื่อ-สกุล" value={form.full_name}
                       onChange={(v) => setForm({ ...form, full_name: v })} />
                <Field label="อีเมล" type="email" value={form.email}
                       onChange={(v) => setForm({ ...form, email: v })} />
                <label className="block">
                    <span className="text-slate-600">บทบาท</span>
                    <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="text-slate-600">ผูกกับอพาร์ทเมนต์ (ตัวเลือก)</span>
                    <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={form.apartment_id}
                            onChange={(e) => setForm({ ...form, apartment_id: e.target.value })}>
                        <option value="">— ไม่ผูก —</option>
                        {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                    </select>
                </label>
            </div>
        </Modal>
    );
}

function EditUserModal({ open, user, onClose, onSaved, apts }) {
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!user) return;
        setForm({
            full_name: user.full_name || '',
            email: user.email || '',
            role: user.role || 'admin',
            apartment_id: user.apartment_id || '',
            new_password: '',
        });
    }, [user]);

    if (!user) return null;

    const submit = async () => {
        setBusy(true);
        try {
            await api.put(`/users/${user.admin_id}`, {
                ...form,
                apartment_id: form.apartment_id ? Number(form.apartment_id) : null,
                new_password: form.new_password || undefined,
            });
            toast.success('บันทึกแล้ว');
            onClose();
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกไม่สำเร็จ');
        } finally { setBusy(false); }
    };

    return (
        <Modal open={open} title={`แก้ไขผู้ใช้: ${user.username}`}
               onClose={onClose}
               footer={
                   <>
                       <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                       <button onClick={submit} disabled={busy}
                               className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                           {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                       </button>
                   </>
               }>
            <div className="space-y-3 text-sm">
                <Field label="ชื่อ-สกุล" value={form.full_name || ''}
                       onChange={(v) => setForm({ ...form, full_name: v })} />
                <Field label="อีเมล" type="email" value={form.email || ''}
                       onChange={(v) => setForm({ ...form, email: v })} />
                <label className="block">
                    <span className="text-slate-600">บทบาท</span>
                    <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={form.role || 'admin'}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="text-slate-600">ผูกกับอพาร์ทเมนต์</span>
                    <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                            value={form.apartment_id || ''}
                            onChange={(e) => setForm({ ...form, apartment_id: e.target.value })}>
                        <option value="">— ไม่ผูก —</option>
                        {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                    </select>
                </label>
                <Field label="รีเซ็ตรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)" type="password"
                       value={form.new_password || ''}
                       onChange={(v) => setForm({ ...form, new_password: v })} />
            </div>
        </Modal>
    );
}

function ResetTenantPwdModal({ open, tenant, onClose }) {
    const [pwd, setPwd] = useState('');
    const [busy, setBusy] = useState(false);

    if (!tenant) return null;

    const submit = async () => {
        if (pwd.length < 6) { toast.error('รหัสผ่านอย่างน้อย 6 ตัว'); return; }
        setBusy(true);
        try {
            await api.post(`/users/tenants/${tenant.tenant_id}/reset-password`,
                           { new_password: pwd });
            toast.success(`รีเซ็ตรหัสผ่าน "${tenant.full_name}" แล้ว`);
            setPwd('');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'รีเซ็ตไม่สำเร็จ');
        } finally { setBusy(false); }
    };

    return (
        <Modal open={open}
               title={`รีเซ็ตรหัสผ่าน: ${tenant.full_name}`}
               onClose={() => { setPwd(''); onClose(); }}
               footer={
                   <>
                       <button onClick={() => { setPwd(''); onClose(); }}
                               className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                       <button onClick={submit} disabled={busy}
                               className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                           {busy ? 'กำลังบันทึก...' : 'รีเซ็ต'}
                       </button>
                   </>
               }>
            <div className="space-y-3 text-sm">
                <p className="text-slate-600">
                    ห้อง <strong>{tenant.room_number || '-'}</strong> · เลขบัตร <strong>{tenant.national_id}</strong>
                </p>
                <Field label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" type="password"
                       value={pwd} onChange={setPwd} />
                <p className="text-xs text-slate-500">
                    ผู้เช่าจะใช้รหัสผ่านใหม่นี้ในการเข้าระบบครั้งถัดไป
                </p>
            </div>
        </Modal>
    );
}

function Field({ label, value, onChange, type = 'text', required }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            <input type={type} required={required}
                   className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                   value={value || ''}
                   onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}
