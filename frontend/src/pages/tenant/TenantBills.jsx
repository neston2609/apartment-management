import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

export default function TenantBills() {
    const now = new Date();
    const [allBills, setAllBills] = useState([]);
    const [year, setYear]         = useState(now.getFullYear());
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        unwrap(api.get('/bills/tenant/me'))
            .then((d) => setAllBills(d || []))
            .catch(() => toast.error('โหลดข้อมูลล้มเหลว'))
            .finally(() => setLoading(false));
    }, []);

    // Years actually present in the data, plus the current year
    const yearOptions = useMemo(() => {
        const s = new Set([now.getFullYear()]);
        allBills.forEach((b) => s.add(Number(b.year)));
        return [...s].sort((a, b) => b - a);
    }, [allBills, now]);

    // Filter by selected year, sort: current month first, then descending by month
    const visible = useMemo(() => {
        const filtered = allBills.filter((b) => Number(b.year) === Number(year));
        const cur = now.getMonth() + 1;
        return filtered.sort((a, b) => {
            // Current month always at top when looking at current year
            if (Number(year) === now.getFullYear()) {
                if (a.month === cur && b.month !== cur) return -1;
                if (b.month === cur && a.month !== cur) return  1;
            }
            return Number(b.month) - Number(a.month);
        });
    }, [allBills, year, now]);

    const downloadPdf = async (id, size = 'A5', lang = 'th') => {
        try {
            const res = await api.get(`/bills/${id}/pdf`, { params: { size, lang }, responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        }
    };

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-800">ใบแจ้งหนี้ของฉัน</h1>
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-slate-600">ปี (พ.ศ.):</label>
                    <select className="border border-slate-300 rounded-md px-2 py-1"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{thaiYear(y)} ({y})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="text-left px-4 py-2">เดือน</th>
                            <th className="text-right px-4 py-2">ค่าน้ำ</th>
                            <th className="text-right px-4 py-2">ค่าไฟ</th>
                            <th className="text-right px-4 py-2">ค่าเช่า</th>
                            <th className="text-right px-4 py-2">อื่น ๆ</th>
                            <th className="text-right px-4 py-2">รวม</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((b) => {
                            const isCurrent = b.month === (now.getMonth() + 1) && Number(b.year) === now.getFullYear();
                            return (
                                <tr key={b.bill_id}
                                    className={`border-t border-slate-100 ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                                    <td className="px-4 py-2">
                                        {THAI_MONTHS[b.month - 1]} {thaiYear(b.year)}
                                        {isCurrent && <span className="ml-2 text-xs text-brand-700">(ปัจจุบัน)</span>}
                                    </td>
                                    <td className="px-4 py-2 text-right">{fmtMoney(b.water_cost)}</td>
                                    <td className="px-4 py-2 text-right">{fmtMoney(b.electricity_cost)}</td>
                                    <td className="px-4 py-2 text-right">{fmtMoney(b.rent_cost)}</td>
                                    <td className="px-4 py-2 text-right">{fmtMoney(b.other_cost)}</td>
                                    <td className="px-4 py-2 text-right font-semibold">฿ {fmtMoney(b.total_cost)}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => downloadPdf(b.bill_id, 'A5', 'th')}
                                                className="bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1 rounded-md">
                                            ดาวน์โหลด PDF
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {visible.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                                ไม่มีใบแจ้งหนี้สำหรับปีนี้
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
