import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney } from '../../utils/api';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';

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
    const { user: me } = useAuth();
    const isPropertyManager = me?.admin_role === 'property_manager';
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ rental_price: 0, status: 'vacant', room_number: '', notes: '' });

    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFloor, setBulkFloor] = useState(1);
    const [bulkPrice, setBulkPrice] = useState(0);

    // Add-room modal state
    const [addFloor, setAddFloor] = useState(null);   // null = closed; number = open for that floor
    const [addForm, setAddForm]   = useState({ room_number: '', rental_price: 0, status: 'vacant', notes: '' });
    const [addBusy, setAddBusy]   = useState(false);
    const [delBusy, setDelBusy]   = useState(false);

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

    // Compare room numbers naturally: numeric if both sides parse as numbers,
    // otherwise lexicographic. So "101" < "102" < "1010" reads correctly.
    const cmpRoom = (a, b) => {
        const na = Number(a.room_number);
        const nb = Number(b.room_number);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return String(a.room_number).localeCompare(String(b.room_number));
    };

    const byFloor = useMemo(() => {
        const groups = {};
        rooms.forEach((r) => {
            const f = r.floor_number;
            if (!groups[f]) groups[f] = [];
            groups[f].push(r);
        });
        // Sort rooms within each floor by room_number
        Object.values(groups).forEach((list) => list.sort(cmpRoom));
        return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
    }, [rooms]);

    // Suggest the next room number for a floor: take max numeric room_number on
    // that floor and add 1; if none, default to floor + "01".
    const suggestNextRoomNumber = (floor) => {
        const onFloor = rooms.filter((r) => r.floor_number === Number(floor));
        const nums = onFloor
            .map((r) => Number(r.room_number))
            .filter(Number.isFinite);
        if (nums.length) return String(Math.max(...nums) + 1);
        return `${floor}${String(1).padStart(2, '0')}`;
    };

    const startAdd = (floor) => {
        const f = Number(floor);
        // Default rental price = price of any existing room on that floor (or 0)
        const onFloor = rooms.filter((r) => r.floor_number === f);
        const defaultPrice = onFloor.length ? Number(onFloor[0].rental_price) : 0;
        setAddForm({
            room_number:  suggestNextRoomNumber(f),
            rental_price: defaultPrice,
            status:       'vacant',
            notes:        '',
        });
        setAddFloor(f);
    };

    const submitAdd = async () => {
        if (addFloor == null) return;
        const room_number = String(addForm.room_number || '').trim();
        if (!room_number) {
            toast.error('กรุณาระบุเลขห้อง');
            return;
        }
        setAddBusy(true);
        try {
            await api.post('/rooms', {
                apartment_id: parseInt(apartmentId, 10),
                floor_number: addFloor,
                room_number,
                rental_price: Number(addForm.rental_price) || 0,
                status:       addForm.status || 'vacant',
                notes:        addForm.notes || null,
            });
            toast.success('เพิ่มห้องเรียบร้อย');
            setAddFloor(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'เพิ่มห้องล้มเหลว');
        } finally { setAddBusy(false); }
    };

    const submitDelete = async () => {
        if (!editing) return;
        const ok = window.confirm(
            `ยืนยันการลบห้อง ${editing.room_number} ?\n` +
            `การลบจะลบใบแจ้งหนี้และมิเตอร์ของห้องนี้ทั้งหมดด้วย และไม่สามารถย้อนกลับได้`
        );
        if (!ok) return;
        setDelBusy(true);
        try {
            await api.delete(`/rooms/${editing.room_id}`);
            toast.success('ลบห้องเรียบร้อย');
            setEditing(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ลบห้องล้มเหลว');
        } finally { setDelBusy(false); }
    };

    const startEdit = (room) => {
        setEditing(room);
        setForm({
            rental_price: room.rental_price,
            status:       room.status,
            room_number:  room.room_number,
            notes:        room.notes || '',
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
                        คลิกที่ห้องเพื่อ <strong>กำหนดราคา/แก้ไขเลขห้อง/หมายเหตุ</strong> หรือใช้ปุ่ม "ปรับราคาทั้งชั้น"
                    </p>
                </div>
                {!isPropertyManager && (
                    <button onClick={() => setBulkOpen(true)}
                            className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-3 py-2 rounded-md">
                        ปรับราคาทั้งชั้น
                    </button>
                )}
            </div>

            {byFloor.map(([floor, list]) => (
                <div key={floor} className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="font-semibold text-slate-700 mb-3">ชั้น {floor}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {list.map((r) => (
                            <button key={r.room_id} onClick={() => startEdit(r)}
                                    className={`border rounded-lg p-3 text-left transition hover:shadow ${STATUS_COLORS[r.status]}`}>
                                <div className="font-bold text-lg">{r.room_number}</div>
                                <div className="mt-1"><Badge status={r.status} /></div>
                                <div className="text-xs mt-1">฿ {fmtMoney(r.rental_price)}</div>
                                {r.tenant_name && (
                                    <div className="text-xs mt-1 truncate" title={r.tenant_name}>{r.tenant_name}</div>
                                )}
                                {r.notes && (
                                    <div className="text-[11px] mt-1 italic truncate text-slate-600" title={r.notes}>
                                        ✎ {r.notes}
                                    </div>
                                )}
                            </button>
                        ))}
                        {!isPropertyManager && (
                            <button type="button" onClick={() => startAdd(floor)}
                                    className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-slate-500 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition flex flex-col items-center justify-center min-h-[7rem]">
                                <span className="text-2xl leading-none">+</span>
                                <span className="text-xs mt-1">เพิ่มห้อง</span>
                            </button>
                        )}
                    </div>
                </div>
            ))}

            <Modal open={!!editing}
                   title={editing ? `แก้ไขห้อง ${editing.room_number}` : ''}
                   onClose={() => setEditing(null)}
                   footer={
                       <>
                           {!isPropertyManager && editing && (
                               <button type="button" onClick={submitDelete} disabled={delBusy}
                                       className="mr-auto px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50">
                                   {delBusy ? 'กำลังลบ...' : 'ลบห้อง'}
                               </button>
                           )}
                           <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                           <button onClick={submit} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md">บันทึก</button>
                       </>
                   }>
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-slate-600">เลขห้อง</span>
                        <input type="text"
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={form.room_number || ''}
                               onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
                        <span className="text-xs text-slate-500">ต้องไม่ซ้ำกับห้องอื่นในอพาร์ทเมนต์เดียวกัน</span>
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
                    <label className="block">
                        <span className="text-slate-600">หมายเหตุ</span>
                        <textarea rows={3}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                  placeholder="เช่น ห้องน้ำต้องซ่อม / กุญแจสำรอง / โน้ตอื่น ๆ"
                                  value={form.notes || ''}
                                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </label>
                </div>
            </Modal>

            <Modal open={bulkOpen}
                   title="ปรับราคาห้องทั้งชั้น"
                   onClose={() => setBulkOpen(false)}
                   footer={
                       <>
                           <button onClick={() => setBulkOpen(false)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                           <button onClick={submitBulk} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md">บันทึก</button>
                       </>
                   }>
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

            <Modal open={addFloor != null}
                   title={addFloor != null ? `เพิ่มห้องในชั้น ${addFloor}` : ''}
                   onClose={() => setAddFloor(null)}
                   footer={
                       <>
                           <button onClick={() => setAddFloor(null)} className="px-3 py-1.5 text-sm text-slate-600">ยกเลิก</button>
                           <button onClick={submitAdd} disabled={addBusy}
                                   className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                               {addBusy ? 'กำลังบันทึก...' : 'เพิ่มห้อง'}
                           </button>
                       </>
                   }>
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-slate-600">เลขห้อง</span>
                        <input type="text"
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={addForm.room_number}
                               onChange={(e) => setAddForm({ ...addForm, room_number: e.target.value })} />
                        <span className="text-xs text-slate-500">ต้องไม่ซ้ำกับห้องอื่นในอพาร์ทเมนต์เดียวกัน</span>
                    </label>
                    <label className="block">
                        <span className="text-slate-600">ราคาเช่า (บาท/เดือน)</span>
                        <input type="number" min={0}
                               className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                               value={addForm.rental_price}
                               onChange={(e) => setAddForm({ ...addForm, rental_price: parseFloat(e.target.value) || 0 })} />
                    </label>
                    <label className="block">
                        <span className="text-slate-600">สถานะ</span>
                        <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                value={addForm.status}
                                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}>
                            {STATUS_OPTIONS.filter((s) => s.value !== 'occupied').map((s) =>
                                <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <span className="text-xs text-slate-500">
                            ห้องใหม่ยังไม่มีผู้เช่า — สถานะ "มีผู้เช่า" จะตั้งอัตโนมัติเมื่อเพิ่มผู้เช่าในภายหลัง
                        </span>
                    </label>
                    <label className="block">
                        <span className="text-slate-600">หมายเหตุ</span>
                        <textarea rows={2}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                  value={addForm.notes}
                                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
                    </label>
                </div>
            </Modal>
        </div>
    );
}
