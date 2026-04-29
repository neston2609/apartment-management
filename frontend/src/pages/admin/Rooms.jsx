import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney } from '../../utils/api';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';

const STATUS_OPTIONS = [
    { value: 'occupied',    label: 'มีผู้เช่า' },
    { value: 'vacant',      label: 'ว่าง' },
    { value: 'maintenance', label: 'ซ่อมบำรุง' },
    { value: 'common',      label: 'พื้นที่ส่วนกลาง' },
    { value: 'caretaker',   label: 'ผู้ดูแล' },
];

const STATUS_COLORS = {
    occupied:    'bg-green-100 border-green-300 text-green-800',
    vacant:      'bg-slate-100 border-slate-300 text-slate-700',
    maintenance: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    common:      'bg-blue-100 border-blue-300 text-blue-800',
    caretaker:   'bg-purple-100 border-purple-300 text-purple-800',
};

export default function Rooms() {
    const { apartmentId } = useParams();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ rental_price: 0, status: 'vacant', room_number: '' });

    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFloor, setBulkFloor] = useState(1);
    const [bulkPrice, setBulkPrice] = useState(0);

    const load = async () => {
        setLoading(true);
        try {
            const data = await unwrap(api.get(`/apartments/${apartmentId}/rooms`));
            setRooms(data || []);
        } catch {
            toast.error('โหลดข้อมูลล้มเหลว');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [apartmentId]);

    const byFloor = useMemo(() => {
        const groups = {};
        rooms.forEach((r) => {
            const f = r.floor_number;
            if (!groups[f]) groups[f] = [];
            groups[f].push(r);
        });
        return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
    }, [rooms]);

    const startEdit = (room) => {
        setEditing(room);
        setForm({
            rental_price: room.rental_price,
            status: room.status,
            room_number: room.room_number,
        });
    };

    const submit = async () => {
        try {
            await api.put(`/rooms/${editing.room_id}`, form);
            toast.success('บันทึกแล้ว');
            setEditing(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        }
    };

    const submitBulk = async () => {
        try {
            await api.put('/rooms/bulk/floor-price', {
                apartment_id: parseInt(apartmentId, 10),
                floor_number: bulkFloor,
                rental_price: bulkPrice,
            });
            toast.success('ปรับราคาทั้งชั้นเรียบร้อย');
            setBulkOpen(false);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'บันทึกล้มเหลว');
        }
    };

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">ห้องพัก</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        คลิกที่ห้องเพื่อ <strong>กำหนดราคา/แก้ไขเลขห้อง</strong> หรือใช้ปุ่ม "ปรับราคาทั้งชั้น" เพื่อตั้งครั้งเดียว
                    </p>
                </div>
                <button onClick={() => setBulkOpen(true)}
                        className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-3 py-2 rounded-md">
                    ปรับราคาทั้งชั้น
                </button>
            </div>

            {byFloor.map(([floor, list]) => (
                <div key={floor} className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="font-semibold text-slate-700 mb-3">ชั้น {floor}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {list.map((r) => (
                            <button
                                key={r.room_id}
                                onClick={() => startEdit(r)}
                                className={`border rounded-lg p-3 text-left transition hover:shadow ${STATUS_COLORS[r.status]}`}
                            >
                                <div className="font-bold text-lg">{r.room_number}</div>
                                <div className="mt-1"><Badge status={r.status} /></div>
                                <div className="text-xs mt-1">฿ {fmtMoney(r.rental_price)}</div>
                                {r.tenant_name && (
                                    <div className="text-xs mt-1 truncate" title={r.tenant_name}>{r.tenant_name}</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <Modal
                open={!!editing}
                title={editing ? `แก้ไขห้อง ${editing.room_number}` : ''}
                onClose={() => setEditing(null)}
                footer={
                    <>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                        <button onClick={submit} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md">บันทึก</button>
                    </>
                }
            >
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-slate-600">เลขห้อง</span>
                        <input type="text"
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={form.room_number || ''}
                               onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
                        <span className="text-xs text-slate-500">
                            ต้องไม่ซ้ำกับห้องอื่นในอพาร์ทเมนต์เดียวกัน
                        </span>
                    </label>
                    <label className="block">
                        <span className="text-slate-600">ราคาเช่า (บาท/เดือน)</span>
                        <input type="number" min={0}
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={form.rental_price}
                               onChange={(e) => setForm({ ...form, rental_price: parseFloat(e.target.value) || 0 })} />
                    </label>
                    <label className="block">
                        <span className="text-slate-600">สถานะ</span>
                        <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                </div>
            </Modal>

            <Modal
                open={bulkOpen}
                title="ปรับราคาห้องทั้งชั้น"
                onClose={() => setBulkOpen(false)}
                footer={
                    <>
                        <button onClick={() => setBulkOpen(false)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                        <button onClick={submitBulk} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md">บันทึก</button>
                    </>
                }
            >
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-slate-600">ชั้น</span>
                        <input type="number" min={1}
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={bulkFloor}
                               onChange={(e) => setBulkFloor(parseInt(e.target.value, 10) || 1)} />
                    </label>
                    <label className="block">
                        <span className="text-slate-600">ราคา</span>
                        <input type="number" min={0}
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={bulkPrice}
                               onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 0)} />
                    </label>
                </div>
            </Modal>
        </div>
    );
}
