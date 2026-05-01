import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth } from '../../utils/api';
import Spinner from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import BillingImport from './BillingImport';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_PERIOD = defaultReportingMonth();

/**
 * Derive a bill's payment status.
 *   no bill                         -> null (let the row show the room status instead)
 *   paid_at set                     -> 'paid'    "ชำระค่าเช่าแล้ว"
 *   no payment_due_day configured   -> 'issued'  "ออกบิลแล้ว"
 *   today <= due date               -> 'pending' "รอชำระ"
 *   today >  due date               -> 'overdue' "เกินกำหนด" (with late fee)
 */
function paymentStatus(bill, now = new Date()) {
    if (!bill) return null;
    if (bill.paid_at) {
        return { kind: 'paid', label: 'ชำระค่าเช่าแล้ว',
                 cls: 'bg-green-100 text-green-800' };
    }
    const dueDayRaw = bill.payment_due_day;
    if (dueDayRaw == null || dueDayRaw === '') {
        return { kind: 'issued', label: 'ออกบิลแล้ว',
                 cls: 'bg-blue-100 text-blue-800' };
    }
    // Clamp due day to last day of that month
    const lastDay = new Date(bill.year, bill.month, 0).getDate();
    const day = Math.min(parseInt(dueDayRaw, 10), lastDay);
    const dueDate = new Date(bill.year, bill.month , day, 23, 59, 59);

    if (now.getTime() <= dueDate.getTime()) {
        return { kind: 'pending', label: 'รอชำระ',
                 cls: 'bg-amber-100 text-amber-800' };
    }
    const days = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    const lateFee = +(Number(bill.late_fee_per_day || 0) * days).toFixed(2);
    return {
        kind: 'overdue', label: 'เกินกำหนด',
        cls: 'bg-red-100 text-red-800',
        days_overdue: days, late_fee: lateFee,
    };
}

export default function Billing() {
    const { user: me } = useAuth();
    const isPropertyManager = me?.admin_role === 'property_manager';

    const [apts, setApts]     = useState([]);
    const [aptId, setAptId]   = useState('');
    const [month, setMonth]   = useState(DEFAULT_PERIOD.month);
    const [year, setYear]     = useState(DEFAULT_PERIOD.year);
    const [rooms, setRooms]   = useState([]);
    const [bills, setBills]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId]   = useState(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const reload = () => {
        if (!aptId) return;
        setLoading(true);
        Promise.all([
            unwrap(api.get(`/apartments/${aptId}/rooms`)),
            unwrap(api.get('/bills', { params: { apartment_id: aptId, month, year } })),
        ]).then(([r, b]) => { setRooms(r || []); setBills(b || []); })
          .catch(() => toast.error('โหลดข้อมูลล้มเหลว'))
          .finally(() => setLoading(false));
    };

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => {
            setApts(r || []);
            if (r?.length) setAptId(String(r[0].apartment_id));
        });
    }, []);

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [aptId, month, year]);

    const billByRoom = bills.reduce((m, b) => { m[b.room_id] = b; return m; }, {});
    const now = new Date();

    const togglePaid = async (bill) => {
        if (!bill) return;
        setBusyId(bill.bill_id);
        try {
            if (bill.paid_at) {
                await api.post(`/bills/${bill.bill_id}/mark-unpaid`);
                toast.success('ยกเลิกการชำระแล้ว');
            } else {
                await api.post(`/bills/${bill.bill_id}/mark-paid`);
                toast.success('บันทึกการชำระแล้ว');
            }
            await reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'อัปเดตสถานะล้มเหลว');
        } finally { setBusyId(null); }
    };

    const bulkMarkPaid = async () => {
        if (!aptId) return;
        const aptName = apts.find((a) => String(a.apartment_id) === String(aptId))?.name || '';
        const ok = window.confirm(
            `ทำเครื่องหมาย "ชำระแล้ว" ให้กับทุกห้องที่ยังไม่ชำระ\n` +
            `อพาร์ทเมนต์: ${aptName}\n` +
            `ประจำเดือน ${THAI_MONTHS[month - 1]} ${thaiYear(year)}\n\n` +
            `ห้องที่ชำระไปแล้วจะไม่ถูกแก้ไข ดำเนินการต่อ?`
        );
        if (!ok) return;
        setBulkBusy(true);
        try {
            const res = await unwrap(api.post('/bills/bulk-mark-paid', {
                apartment_id: parseInt(aptId, 10),
                month, year,
            }));
            const n = res?.marked_count ?? 0;
            if (n === 0) toast('ไม่มีบิลที่ค้างชำระให้ทำเครื่องหมาย', { icon: 'ℹ️' });
            else toast.success(`ทำเครื่องหมายชำระแล้ว ${n} ห้อง`);
            await reload();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ทำเครื่องหมายล้มเหลว');
        } finally { setBulkBusy(false); }
    };

    // Count how many bills are still unpaid for the current view
    const unpaidCount = bills.filter((b) => !b.paid_at).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-slate-800">ใบแจ้งค่าเช่า</h1>
                {!isPropertyManager && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={bulkMarkPaid}
                                disabled={bulkBusy || unpaidCount === 0}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded-md disabled:opacity-50">
                            {bulkBusy
                                ? 'กำลังบันทึก...'
                                : `✓ ชำระแล้วทุกห้อง${unpaidCount > 0 ? ` (${unpaidCount})` : ''}`}
                        </button>
                        <button onClick={() => setImportOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-2 rounded-md">
                            นำเข้าจาก Excel
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-3 items-center text-sm">
                <select value={aptId} onChange={(e) => setAptId(e.target.value)}
                        className="border border-slate-300 rounded-md px-2 py-1">
                    {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                </select>
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="border border-slate-300 rounded-md px-2 py-1">
                    {THAI_MONTHS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                </select>
                <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}
                       className="border border-slate-300 rounded-md px-2 py-1 w-24" />
                <span className="text-slate-500">พ.ศ. {thaiYear(year)}</span>
            </div>

            {loading
                ? <div className="grid place-items-center h-32"><Spinner /></div>
                : (
                    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left px-4 py-2">ห้อง</th>
                                    <th className="text-left px-4 py-2">ผู้เช่า</th>
                                    <th className="text-left px-4 py-2">สถานะ</th>
                                    <th className="text-right px-4 py-2">รวม</th>
                                    <th className="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map((r) => {
                                    const b = billByRoom[r.room_id];
                                    // Payment status only applies to rooms with an active tenant.
                                    // Non-occupied rooms (vacant / maintenance / common / caretaker)
                                    // always show their room-type badge regardless of bill state.
                                    const isOccupied = r.status === 'occupied';
                                    const ps = isOccupied ? paymentStatus(b, now) : null;
                                    const hasBill = !!b;
                                    const total = hasBill ? Number(b.total_cost) : 0;
                                    const lateFee = ps?.kind === 'overdue' ? ps.late_fee : 0;
                                    const grand = total + lateFee;
                                    return (
                                        <tr key={r.room_id} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium">{r.room_number}</td>
                                            <td className="px-4 py-2">{r.tenant_name || '-'}</td>
                                            <td className="px-4 py-2">
                                                {ps ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium ${ps.cls}`}>
                                                            {ps.label}
                                                        </span>
                                                        {ps.kind === 'overdue' && (
                                                            <span className="text-[11px] text-red-700">
                                                                เลย {ps.days_overdue} วัน · ค่าปรับ ฿ {fmtMoney(ps.late_fee)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Badge status={r.status} />
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {hasBill ? (
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span>฿ {fmtMoney(total)}</span>
                                                        {lateFee > 0 && (
                                                            <span className="text-[11px] text-red-700">
                                                                + ฿ {fmtMoney(lateFee)} ค่าปรับ → ฿ {fmtMoney(grand)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="flex flex-col items-end gap-0.5 text-xs">
                                                    <Link to={`/admin/billing/${r.room_id}/${month}/${year}`}
                                                          className="text-brand-600 hover:underline">
                                                        {hasBill ? 'แก้ไข' : 'สร้าง'}
                                                    </Link>
                                                    {hasBill && !isPropertyManager && (
                                                        <button onClick={() => togglePaid(b)}
                                                                disabled={busyId === b.bill_id}
                                                                className={`hover:underline disabled:opacity-50 ${
                                                                    b.paid_at ? 'text-slate-500' : 'text-green-700'
                                                                }`}>
                                                            {busyId === b.bill_id
                                                                ? 'กำลังบันทึก...'
                                                                : b.paid_at ? 'ยกเลิกการชำระ' : '✓ ทำเครื่องหมายชำระแล้ว'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {rooms.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">ไม่มีห้องพัก</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {importOpen && aptId && (
                <BillingImport
                    apartmentId={parseInt(aptId, 10)}
                    defaultMonth={month}
                    defaultYear={year}
                    onClose={() => setImportOpen(false)}
                    onDone={reload}
                />
            )}
        </div>
    );
}
