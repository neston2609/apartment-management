import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const ALL_STATUSES = ['occupied', 'caretaker', 'maintenance', 'common', 'vacant'];
const STATUS_LABELS = {
    occupied: 'มีผู้เช่า', caretaker: 'ผู้ดูแล',
    maintenance: 'ซ่อมบำรุง', common: 'ส่วนกลาง', vacant: 'ว่าง',
};
const DEFAULT_PERIOD = defaultReportingMonth();

export default function Invoice() {
    const [apts, setApts]   = useState([]);
    const [aptId, setAptId] = useState('');
    const [month, setMonth] = useState(DEFAULT_PERIOD.month);
    const [year, setYear]   = useState(DEFAULT_PERIOD.year);
    const [size, setSize]   = useState('A5');
    const [statuses, setStatuses] = useState(['occupied', 'caretaker']);
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => {
            setApts(r || []);
            if (r?.length) setAptId(String(r[0].apartment_id));
        });
    }, []);

    useEffect(() => {
        if (!aptId) return;
        setLoading(true);
        unwrap(api.get(`/apartments/${aptId}/rooms`)).then(async (rooms) => {
            const filtered = (rooms || []).filter((r) => statuses.includes(r.status));
            const billsData = await unwrap(api.get('/bills', { params: { apartment_id: aptId, month, year } }));
            const merged = filtered.map((r) => {
                const b = (billsData || []).find((x) => x.room_id === r.room_id);
                return { ...r, bill: b };
            });
            setBills(merged);
        }).catch(() => toast.error('โหลดข้อมูลล้มเหลว'))
          .finally(() => setLoading(false));
    }, [aptId, month, year, statuses]);

    const downloadOne = async (bill_id) => {
        try {
            const res = await api.get(`/bills/${bill_id}/pdf`, {
                params: { size, lang: 'th' },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        }
    };

    const downloadAll = async () => {
        const ids = bills.filter((r) => r.bill?.bill_id).map((r) => r.bill.bill_id);
        if (!ids.length) { toast.error('ไม่มีใบแจ้งหนี้ให้ดาวน์โหลด'); return; }
        try {
            const res = await api.post('/bills/bulk-pdf',
                { bill_ids: ids, size, lang: 'th' },
                { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF รวมล้มเหลว');
        }
    };

    const toggleStatus = (s) =>
        setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

    return (
        <div className="space-y-4">
            <h1 className="font-display text-3xl font-bold text-ink">พิมพ์ใบแจ้งหนี้</h1>

            <div className="ui-card p-3.5 flex flex-wrap gap-3 items-center text-sm">
                <select value={aptId} onChange={(e) => setAptId(e.target.value)}
                        className="ui-input !py-2 !w-auto">
                    {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                </select>
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="ui-input !py-2 !w-auto">
                    {THAI_MONTHS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                </select>
                <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}
                       className="ui-input !py-2 w-24" />
                <span className="text-ink-3 font-mono">พ.ศ. {thaiYear(year)}</span>
                <select value={size} onChange={(e) => setSize(e.target.value)}
                        className="ui-input !py-2 !w-auto">
                    <option value="A5">A5 (ค่าเริ่มต้น)</option>
                    <option value="A4">A4</option>
                </select>
                <span className="text-xs text-ink-3">ภาษาไทย · แนวตั้ง</span>
                <button onClick={downloadAll} className="btn btn-primary ml-auto">
                    ดาวน์โหลดทั้งหมด
                </button>
            </div>

            <div className="ui-card p-3.5 flex flex-wrap gap-3 text-sm items-center">
                <span className="text-ink-2 font-medium">สถานะที่รวม:</span>
                {ALL_STATUSES.map((s) => (
                    <label key={s} className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggleStatus(s)} />
                        <span>{STATUS_LABELS[s]}</span>
                    </label>
                ))}
            </div>

            {loading
                ? <div className="grid place-items-center h-32"><Spinner /></div>
                : (
                    <div className="overflow-x-auto ui-card">
                        <table className="min-w-full text-sm">
                            <thead className="bg-cream-2 text-ink-3">
                                <tr className="[&>th]:text-[11px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:px-4 [&>th]:py-3.5 [&>th]:border-b [&>th]:border-[color:var(--border)]">
                                    <th className="text-left">ห้อง</th>
                                    <th className="text-left">ผู้เช่า</th>
                                    <th className="!text-right">รวม</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((r) => (
                                    <tr key={r.room_id} className="border-t border-[color:var(--border)] text-ink-2 hover:bg-cream-surface">
                                        <td className="px-4 py-3 font-display font-bold text-ink">{r.room_number}</td>
                                        <td className="px-4 py-3">{r.tenant_name || '-'}</td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {r.bill ? `฿ ${fmtMoney(r.bill.total_cost)}` : <span className="text-ink-4">ยังไม่ได้สร้าง</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {r.bill && (
                                                <button onClick={() => downloadOne(r.bill.bill_id)}
                                                        className="text-violet font-semibold hover:underline text-xs">
                                                    ดาวน์โหลด PDF
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {bills.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-4">ไม่มีห้องตามตัวกรอง</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )
            }
        </div>
    );
}
