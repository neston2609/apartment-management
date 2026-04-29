import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../utils/api';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../context/AuthContext';

const EMPTY_FORM = {
    name: '', address: '', contact_number: '',
    floors_count: 1, rooms_per_floor: 1, starting_price: 0,
};

export default function Apartments() {
    const { user: me } = useAuth();
    const isPropertyManager = me?.admin_role === 'property_manager';

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const [deleting, setDeleting] = useState(null);   // apartment row pending deletion
    const [preview, setPreview]   = useState(null);   // counts from /:id/delete-preview
    const [delBusy, setDelBusy]   = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setItems(await unwrap(api.get('/apartments')) || []);
        } catch {
            toast.error('โหลดข้อมูลล้มเหลว');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const startCreate = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
    const startEdit = (a) => {
        setEditing(a);
        setForm({
            name: a.name, address: a.address, contact_number: a.contact_number || '',
            floors_count: a.floors_count, rooms_per_floor: a.rooms_per_floor, starting_price: 0,
        });
        setOpen(true);
    };

    const startDelete = async (a) => {
        setDeleting(a);
        setPreview(null);
        try {
            const p = await unwrap(api.get(`/apartments/${a.apartment_id}/delete-preview`));
            setPreview(p);
        } catch {
            setPreview({ rooms: '?', active_tenants: '?', bills: '?', meter_readings: '?' });
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setDelBusy(true);
        try {
            await api.delete(`/apartments/${deleting.apartment_id}`, { params: { force: true } });
            toast.success('ลบอพาร์ทเมนต์เรียบร้อย');
            setDeleting(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ลบไม่สำเร็จ');
        } finally {
            setDelBusy(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/apartments/${editing.apartment_id}`, form);
                toast.success('บันทึกการแก้ไขแล้ว');
            } else {
                await api.post('/apartments', form);
                toast.success('สร้างอพาร์ทเมนต์ใหม่แล้ว');
            }
            setOpen(false);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        } finally { setSaving(false); }
    };

    const columns = [
        { key: 'name', title: 'ชื่อ' },
        { key: 'address', title: 'ที่อยู่' },
        { key: 'contact_number', title: 'โทร', render: (r) => r.contact_number || '-' },
        { key: 'rooms', title: 'ห้องทั้งหมด', render: (r) => `${r.rooms_total} (มีผู้เช่า ${r.rooms_occupied})` },
        {
            key: 'actions', title: '',
            render: (r) => (
                <div className="flex gap-3">
                    <Link to={`/admin/rooms/${r.apartment_id}`} className="text-brand-600 hover:underline text-xs">
                        ห้องพัก / ตั้งราคา
                    </Link>
                    {!isPropertyManager && (
                        <>
                            <button onClick={() => startEdit(r)} className="text-slate-600 hover:underline text-xs">
                                แก้ไข
                            </button>
                            <button onClick={() => startDelete(r)} className="text-red-600 hover:underline text-xs">
                                ลบ
                            </button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">อพาร์ทเมนต์</h1>
                {!isPropertyManager && (
                    <button onClick={startCreate} className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-md">
                        เพิ่มอพาร์ทเมนต์
                    </button>
                )}
            </div>
            <Table columns={columns} rows={items.map((i) => ({ ...i, id: i.apartment_id }))} />

            <Modal
                open={open}
                title={editing ? 'แก้ไขอพาร์ทเมนต์' : 'เพิ่มอพาร์ทเมนต์'}
                onClose={() => setOpen(false)}
                footer={
                    <>
                        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                        <button onClick={submit} disabled={saving}
                                className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </>
                }
            >
                <form onSubmit={submit} className="space-y-3 text-sm">
                    <Field label="ชื่อ"      value={form.name}            onChange={(v) => setForm({ ...form, name: v })} required />
                    <Field label="ที่อยู่"    value={form.address}         onChange={(v) => setForm({ ...form, address: v })} required textarea />
                    <Field label="เบอร์โทร"  value={form.contact_number}  onChange={(v) => setForm({ ...form, contact_number: v })} />
                    <div className="grid grid-cols-3 gap-2">
                        <Field label="จำนวนชั้น" type="number" min={1}
                               value={form.floors_count}
                               onChange={(v) => setForm({ ...form, floors_count: parseInt(v, 10) || 1 })} />
                        <Field label="ห้องต่อชั้น" type="number" min={1}
                               value={form.rooms_per_floor}
                               onChange={(v) => setForm({ ...form, rooms_per_floor: parseInt(v, 10) || 1 })} />
                        {!editing && (
                            <Field label="ราคาเริ่มต้น (บาท/เดือน)" type="number" min={0}
                                   value={form.starting_price}
                                   onChange={(v) => setForm({ ...form, starting_price: parseFloat(v) || 0 })} />
                        )}
                    </div>
                    {!editing && (
                        <p className="text-xs text-slate-500">
                            * ราคาเริ่มต้นจะถูกใช้กับทุกห้องที่สร้างขึ้น สามารถปรับ "ราคาแยกรายห้อง" ได้ในหน้า "ห้องพัก / ตั้งราคา"
                        </p>
                    )}
                    {editing && (
                        <p className="text-xs text-slate-500">
                            * การแก้ไขข้อมูลพื้นฐานจะไม่สร้างห้องพักใหม่อัตโนมัติ
                        </p>
                    )}
                </form>
            </Modal>

            <Modal
                open={!!deleting}
                title={deleting ? `ลบอพาร์ทเมนต์: ${deleting.name}` : ''}
                onClose={() => setDeleting(null)}
                footer={
                    <>
                        <button onClick={() => setDeleting(null)} className="px-3 py-1.5 text-sm text-slate-600">
                            ยกเลิก
                        </button>
                        <button onClick={confirmDelete} disabled={delBusy || !preview}
                                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50">
                            {delBusy ? 'กำลังลบ...' : 'ยืนยันลบถาวร'}
                        </button>
                    </>
                }
            >
                <div className="text-sm space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
                        การกระทำนี้ <strong>ลบถาวร</strong> และไม่สามารถย้อนกลับได้
                    </div>
                    {preview ? (
                        <div className="text-slate-700">
                            <p>การลบอพาร์ทเมนต์นี้จะลบข้อมูลที่เกี่ยวข้องทั้งหมด:</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>ห้องพัก: <strong>{preview.rooms}</strong> ห้อง</li>
                                <li>ใบแจ้งหนี้: <strong>{preview.bills}</strong> รายการ</li>
                                <li>มิเตอร์: <strong>{preview.meter_readings}</strong> รายการ</li>
                                <li>ผู้เช่ายังพักอยู่: <strong>{preview.active_tenants}</strong> คน
                                    <span className="text-slate-500"> (จะถูกบันทึกย้ายออกอัตโนมัติ)</span>
                                </li>
                            </ul>
                        </div>
                    ) : (
                        <div className="text-slate-500">กำลังโหลดข้อมูล...</div>
                    )}
                </div>
            </Modal>
        </div>
    );
}

function Field({ label, value, onChange, type = 'text', textarea, ...rest }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            {textarea ? (
                <textarea
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    value={value} onChange={(e) => onChange(e.target.value)}
                    {...rest}
                />
            ) : (
                <input
                    type={type}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    value={value} onChange={(e) => onChange(e.target.value)}
                    {...rest}
                />
            )}
        </label>
    );
}
