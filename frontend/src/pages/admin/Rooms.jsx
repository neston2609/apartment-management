import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney } from '../../utils/api';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
    { value: 'occupied',    label: 'มีผู้เช่า' },
    { value: 'vacant',      label: 'ว่าง' },
    { value: 'maintenance', label: 'ซ่อมบำรุง' },
    { value: 'common',      label: 'พื้นที่ส่วนกลาง' },
    { value: 'caretaker',   label: 'ผู้ดูแล' },
];

const STATUS_TH = {
    occupied: 'มีผู้เช่า', vacant: 'ว่าง', maintenance: 'ซ่อมบำรุง',
    common: 'พื้นที่ส่วนกลาง', caretaker: 'ผู้ดูแล',
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
                    <h1 className="font-display text-3xl font-bold text-ink">ห้องพัก</h1>
                    <p className="text-xs text-ink-3 mt-1">
                        คลิกที่ห้องเพื่อ <strong>กำหนดราคา/แก้ไขเลขห้อง/หมายเหตุ</strong> หรือใช้ปุ่ม "ปรับราคาทั้งชั้น"
                    </p>
                </div>
                {!isPropertyManager && (
                    <button onClick={() => setBulkOpen(true)} className="btn btn-ghost">
                        ปรับราคาทั้งชั้น
                    </button>
                )}
            </div>

            {byFloor.map(([floor, list]) => (
                <div key={floor} className="ui-card p-4">
                    <h2 className="font-display font-bold text-ink mb-3">ชั้น {floor}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {list.map((r) => {
                            const isVacant = r.status === 'vacant';
                            return (
                                <button key={r.room_id} onClick={() => startEdit(r)}
                                        className={`room-cell ${r.status} p-3 text-left hover:scale-[1.03] min-h-[7rem]`}>
                                    <div className="font-display font-bold text-lg leading-tight">{r.room_number}</div>
                                    <div className={`text-[11px] font-bold uppercase tracking-wide mt-1 ${isVacant ? 'text-ink-3' : 'text-white/80'}`}>
                                        {STATUS_TH[r.status]}
                                    </div>
                                    <div className={`text-xs font-mono mt-1 ${isVacant ? 'text-ink-2' : 'text-white/90'}`}>฿ {fmtMoney(r.rental_price)}</div>
                                    {r.tenant_name && (
                                        <div className={`text-xs mt-1 truncate ${isVacant ? 'text-ink-2' : 'text-white/90'}`} title={r.tenant_name}>{r.tenant_name}</div>
                                    )}
                                    {r.notes && (
                                        <div className={`text-[11px] mt-1 italic truncate ${isVacant ? 'text-ink-3' : 'text-white/75'}`} title={r.notes}>
                                            ✎ {r.notes}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                        {!isPropertyManager && (
                            <button type="button" onClick={() => startAdd(floor)}
                                    className="border-2 border-dashed border-[color:var(--border-strong)] rounded-xl p-3 text-ink-3 hover:border-violet hover:text-violet hover:bg-violet-soft transition flex flex-col items-center justify-center min-h-[7rem]">
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
                                       className="btn mr-auto bg-red-600 text-white">
                                   {delBusy ? 'กำลังลบ...' : 'ลบห้อง'}
                               </button>
                           )}
                           <button onClick={() => setEditing(null)} className="btn btn-ghost">ยกเลิก</button>
                           <button onClick={submit} className="btn btn-primary">บันทึก</button>
                       </>
                   }>
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-ink-2 font-semibold">เลขห้อง</span>
                        <input type="text"
                               className="ui-input mt-1 !py-2"
                               value={form.room_number || ''}
                               onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
                        <span className="text-xs text-ink-3">ต้องไม่ซ้ำกับห้องอื่นในอพาร์ทเมนต์เดียวกัน</span>
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">ราคาเช่า (บาท/เดือน)</span>
                        <input type="number" min={0}
                               className="ui-input mt-1 !py-2"
                               value={form.rental_price}
                               onChange={(e) => setForm({ ...form, rental_price: parseFloat(e.target.value) || 0 })} />
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">สถานะ</span>
                        <select className="ui-input mt-1 !py-2"
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">หมายเหตุ</span>
                        <textarea rows={3}
                                  className="ui-input mt-1 !py-2"
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
                           <button onClick={() => setBulkOpen(false)} className="btn btn-ghost">ยกเลิก</button>
                           <button onClick={submitBulk} className="btn btn-primary">บันทึก</button>
                       </>
                   }>
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-ink-2 font-semibold">ชั้น</span>
                        <input type="number" min={1}
                               className="ui-input mt-1 !py-2"
                               value={bulkFloor}
                               onChange={(e) => setBulkFloor(parseInt(e.target.value, 10) || 1)} />
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">ราคา</span>
                        <input type="number" min={0}
                               className="ui-input mt-1 !py-2"
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
                           <button onClick={() => setAddFloor(null)} className="btn btn-ghost">ยกเลิก</button>
                           <button onClick={submitAdd} disabled={addBusy} className="btn btn-primary">
                               {addBusy ? 'กำลังบันทึก...' : 'เพิ่มห้อง'}
                           </button>
                       </>
                   }>
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="text-ink-2 font-semibold">เลขห้อง</span>
                        <input type="text"
                               className="ui-input mt-1 !py-2"
                               value={addForm.room_number}
                               onChange={(e) => setAddForm({ ...addForm, room_number: e.target.value })} />
                        <span className="text-xs text-ink-3">ต้องไม่ซ้ำกับห้องอื่นในอพาร์ทเมนต์เดียวกัน</span>
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">ราคาเช่า (บาท/เดือน)</span>
                        <input type="number" min={0}
                               className="ui-input mt-1 !py-2"
                               value={addForm.rental_price}
                               onChange={(e) => setAddForm({ ...addForm, rental_price: parseFloat(e.target.value) || 0 })} />
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">สถานะ</span>
                        <select className="ui-input mt-1 !py-2"
                                value={addForm.status}
                                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}>
                            {STATUS_OPTIONS.filter((s) => s.value !== 'occupied').map((s) =>
                                <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <span className="text-xs text-ink-3">
                            ห้องใหม่ยังไม่มีผู้เช่า — สถานะ "มีผู้เช่า" จะตั้งอัตโนมัติเมื่อเพิ่มผู้เช่าในภายหลัง
                        </span>
                    </label>
                    <label className="block">
                        <span className="text-ink-2 font-semibold">หมายเหตุ</span>
                        <textarea rows={2}
                                  className="ui-input mt-1 !py-2"
                                  value={addForm.notes}
                                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
                    </label>
                </div>
            </Modal>
        </div>
    );
}
