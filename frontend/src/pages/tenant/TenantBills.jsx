import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

export default function TenantBills() {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        unwrap(api.get('/bills/tenant/me'))
            .then((d) => setBills(d || []))
            .finally(() => setLoading(false));
    }, []);

    const downloadPdf = async (id, size = 'A4') => {
        try {
            const res = await api.get(`/bills/${id}/pdf`, { params: { size }, responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        }
    };

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-800">ใบแจ้งหนี้ของฉัน</h1>

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
                        {bills.map((b) => (
                            <tr key={b.bill_id} className="border-t border-slate-100">
                                <td className="px-4 py-2">{THAI_MONTHS[b.month - 1]} {thaiYear(b.year)}</td>
                                <td className="px-4 py-2 text-right">{fmtMoney(b.water_cost)}</td>
                                <td className="px-4 py-2 text-right">{fmtMoney(b.electricity_cost)}</td>
                                <td className="px-4 py-2 text-right">{fmtMoney(b.rent_cost)}</td>
                                <td className="px-4 py-2 text-right">{fmtMoney(b.other_cost)}</td>
                                <td className="px-4 py-2 text-right font-semibold">฿ {fmtMoney(b.total_cost)}</td>
                                <td className="px-4 py-2 text-right">
                                    <button onClick={() => downloadPdf(b.bill_id, 'A4')}
                                            className="text-brand-600 hover:underline text-xs">
                                        PDF
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {bills.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">ยังไม่มีใบแจ้งหนี้</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
