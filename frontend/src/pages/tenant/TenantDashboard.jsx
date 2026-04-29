import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/common/Spinner';

export default function TenantDashboard() {
    const { user } = useAuth();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();

    useEffect(() => {
        unwrap(api.get('/bills/tenant/me'))
            .then((d) => setBills(d || []))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    const current = bills.find((b) => b.month === now.getMonth() + 1 && b.year === now.getFullYear());

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">สวัสดี {user?.full_name}</h1>
                <p className="text-sm text-slate-500">ห้องของคุณ: {user?.room_number || '-'}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
                <p className="text-xs text-slate-500">
                    ใบแจ้งหนี้ประจำเดือน {THAI_MONTHS[now.getMonth()]} {thaiYear(now.getFullYear())}
                </p>
                {current ? (
                    <>
                        <p className="text-3xl font-bold text-brand-700 mt-1">฿ {fmtMoney(current.total_cost)}</p>
                        <Link to="/tenant/bills" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
                            ดูรายละเอียด →
                        </Link>
                    </>
                ) : (
                    <p className="text-slate-400 mt-2">ยังไม่มีใบแจ้งหนี้สำหรับเดือนนี้</p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/tenant/bills"
                      className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow transition">
                    <p className="font-semibold text-slate-700">ใบแจ้งหนี้ของฉัน</p>
                    <p className="text-xs text-slate-500 mt-1">ดูประวัติและดาวน์โหลด PDF</p>
                </Link>
                <Link to="/tenant/contract"
                      className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow transition">
                    <p className="font-semibold text-slate-700">สัญญาเช่า</p>
                    <p className="text-xs text-slate-500 mt-1">ดาวน์โหลดสัญญาเช่าฉบับเต็ม</p>
                </Link>
            </div>
        </div>
    );
}
