import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/common/Spinner';
import { paymentStatus } from '../../utils/billStatus';

export default function TenantDashboard() {
    const { user } = useAuth();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const period = defaultReportingMonth();

    useEffect(() => {
        unwrap(api.get('/bills/tenant/me'))
            .then((d) => setBills(d || []))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    const current = bills.find((b) => b.month === period.month && b.year === period.year);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-3xl font-bold text-ink">สวัสดี {user?.full_name}</h1>
                <p className="text-sm text-ink-3">ห้องของคุณ: <span className="font-mono font-semibold text-ink-2">{user?.room_number || '-'}</span></p>
            </div>

            {/* Current bill hero — sunset gradient */}
            <div className="rounded-[28px] p-6 text-white shadow-soft-lg bg-grad-sunset relative overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
                <p className="text-xs font-bold uppercase tracking-wider text-white/80 relative">
                    ใบแจ้งหนี้ประจำเดือน {THAI_MONTHS[period.month - 1]} {thaiYear(period.year)}
                </p>
                {current ? (() => {
                    const ps = paymentStatus(current);
                    const lateFee = ps?.kind === 'overdue' ? ps.late_fee : 0;
                    const grand = Number(current.total_cost) + lateFee;
                    return (
                        <div className="relative">
                            <p className="font-display text-5xl font-bold mt-1.5">฿ {fmtMoney(current.total_cost)}</p>
                            {ps && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white/25 backdrop-blur">
                                        {ps.label}
                                    </span>
                                    {ps.kind === 'overdue' && (
                                        <span className="text-xs text-white/90">
                                            เลย {ps.days_overdue} วัน{ps.late_fee > 0 && ` · ค่าปรับ ฿ ${fmtMoney(ps.late_fee)} → ยอดที่ต้องชำระ ฿ ${fmtMoney(grand)}`}
                                        </span>
                                    )}
                                </div>
                            )}
                            <Link to="/tenant/bills" className="text-sm font-bold text-white hover:underline mt-3 inline-block">
                                ดูรายละเอียด →
                            </Link>
                        </div>
                    );
                })() : (
                    <p className="text-white/80 mt-2 relative">ยังไม่มีใบแจ้งหนี้สำหรับเดือนนี้</p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/tenant/bills"
                      className="ui-card p-5 hover:shadow-soft-md transition">
                    <p className="font-display font-bold text-ink">ใบแจ้งหนี้ของฉัน</p>
                    <p className="text-xs text-ink-3 mt-1">ดูประวัติและดาวน์โหลด PDF</p>
                </Link>
                <Link to="/tenant/contract"
                      className="ui-card p-5 hover:shadow-soft-md transition">
                    <p className="font-display font-bold text-ink">สัญญาเช่า</p>
                    <p className="text-xs text-ink-3 mt-1">ดาวน์โหลดสัญญาเช่าฉบับเต็ม</p>
                </Link>
            </div>
        </div>
    );
}
