import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BuildingOffice2Icon, UsersIcon, KeyIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const STAT_META = {
    rooms_total:    { label: 'ห้องทั้งหมด', tone: 'cy', icon: BuildingOffice2Icon },
    rooms_occupied: { label: 'มีผู้เช่า',    tone: 'gr', icon: UsersIcon },
    rooms_vacant:   { label: 'ว่าง',         tone: 'am', icon: KeyIcon },
    rooms_misc:     { label: 'อื่น ๆ',       tone: 'vi', icon: Squares2X2Icon },
};

const ALL_STATUSES = ['occupied', 'caretaker', 'maintenance', 'common', 'vacant'];
const STATUS_LABELS = {
    occupied:    'มีผู้เช่า',
    caretaker:   'ผู้ดูแล',
    maintenance: 'ซ่อมบำรุง',
    common:      'พื้นที่ส่วนกลาง',
    vacant:      'ว่าง',
};
const DEFAULT_REVENUE_STATUSES = ['occupied', 'caretaker'];

export default function Dashboard() {
    const now = new Date();
    const initial = defaultReportingMonth(now);
    const [month, setMonth] = useState(initial.month);
    const [year,  setYear]  = useState(initial.year);

    const [apts, setApts]   = useState([]);
    const [bills, setBills] = useState([]);
    const [loadingApts, setLoadingApts]   = useState(true);
    const [loadingBills, setLoadingBills] = useState(true);

    // Status filter for revenue calculation (default: occupied + caretaker)
    const [statuses, setStatuses] = useState(DEFAULT_REVENUE_STATUSES);
    const toggleStatus = (s) =>
        setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

    // Apartments only need to load once
    useEffect(() => {
        unwrap(api.get('/apartments'))
            .then((r) => setApts(r || []))
            .finally(() => setLoadingApts(false));
    }, []);

    // Bills reload on month/year change
    useEffect(() => {
        setLoadingBills(true);
        unwrap(api.get('/bills', { params: { month, year } }))
            .then((b) => setBills(b || []))
            .catch(() => setBills([]))
            .finally(() => setLoadingBills(false));
    }, [month, year]);

    const totals = useMemo(() => {
        const t = apts.reduce((acc, a) => ({
            rooms_total:    acc.rooms_total    + Number(a.rooms_total || 0),
            rooms_occupied: acc.rooms_occupied + Number(a.rooms_occupied || 0),
            rooms_vacant:   acc.rooms_vacant   + Number(a.rooms_vacant || 0),
        }), { rooms_total: 0, rooms_occupied: 0, rooms_vacant: 0 });
        t.rooms_misc = t.rooms_total - t.rooms_occupied - t.rooms_vacant;
        return t;
    }, [apts]);

    // Revenue is computed only from bills whose room status is in the selected filter.
    // The /api/bills response includes r.status (room status) via JOIN.
    const filteredBills = useMemo(
        () => bills.filter((b) => statuses.includes(b.status)),
        [bills, statuses]
    );

    const breakdown = useMemo(() => {
        const sum = (key) => filteredBills.reduce((s, b) => s + Number(b[key] || 0), 0);
        return {
            water:   sum('water_cost'),
            elec:    sum('electricity_cost'),
            rent:    sum('rent_cost'),
            other:   sum('other_cost'),
            total:   sum('total_cost'),
            count:   filteredBills.length,
        };
    }, [filteredBills]);

    const yearOptions = useMemo(() => {
        const cy = now.getFullYear();
        const arr = [];
        for (let y = cy - 3; y <= cy + 1; y++) arr.push(y);
        return arr;
    }, [now]);

    if (loadingApts) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="font-display text-3xl font-bold text-ink">แดชบอร์ด</h1>
                    <p className="text-sm text-ink-3 mt-1">
                        ภาพรวมประจำเดือน {THAI_MONTHS[month - 1]} {thaiYear(year)}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-ink-2 font-medium">เดือน:</label>
                    <select className="ui-input !py-2 !w-auto"
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                        {THAI_MONTHS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                    </select>
                    <label className="text-ink-2 font-medium ml-2">ปี:</label>
                    <select className="ui-input !py-2 !w-auto"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{thaiYear(y)} ({y})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.keys(STAT_META).map((k) => {
                    const { label, tone, icon: Icon } = STAT_META[k];
                    return (
                        <div key={k} className={`stat ${tone}`}>
                            <div className="stat-icon mb-3.5"><Icon className="h-5 w-5" /></div>
                            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 relative">{label}</p>
                            <p className="font-display text-4xl font-bold mt-1 relative">{totals[k]}</p>
                        </div>
                    );
                })}
            </div>

            {/* Total revenue (filtered by selected room statuses) */}
            <div className="ui-card p-6 relative overflow-hidden">
                <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-sunshine/20 blur-3xl" />
                <div className="flex items-center justify-between flex-wrap gap-3 relative">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-3">
                            รายได้รวม (ตามสถานะห้องที่เลือก)
                        </p>
                        <p className="font-display text-5xl font-bold mt-1.5">
                            <span className="sunset-text">฿ {fmtMoney(breakdown.total)}</span>
                        </p>
                        <p className="text-xs text-ink-4 mt-1.5">
                            จาก {breakdown.count} ห้อง · ประจำเดือน {THAI_MONTHS[month - 1]} {thaiYear(year)}
                        </p>
                    </div>
                    {loadingBills && <Spinner />}
                </div>

                {/* Status filter checkboxes */}
                <div className="mt-5 pt-4 border-t border-[color:var(--border)] relative">
                    <p className="text-xs text-ink-3 mb-2.5">เลือกสถานะห้องที่นำมาคำนวณรายได้:</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                        {ALL_STATUSES.map((s) => (
                            <label key={s} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-[color:var(--border-strong)] text-violet focus:ring-violet"
                                    checked={statuses.includes(s)}
                                    onChange={() => toggleStatus(s)}
                                />
                                <span className="text-ink-2">{STATUS_LABELS[s]}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 relative">
                    <BreakdownCard label="ค่าน้ำ"       value={breakdown.water} total={breakdown.total} color="bg-grad-cyan" />
                    <BreakdownCard label="ค่าไฟ"        value={breakdown.elec}  total={breakdown.total} color="bg-grad-sunset" />
                    <BreakdownCard label="ค่าเช่าห้อง"  value={breakdown.rent}  total={breakdown.total} color="bg-grad-mint" />
                    <BreakdownCard label="รายได้อื่น ๆ" value={breakdown.other} total={breakdown.total} color="bg-grad-pink" />
                </div>
            </div>

            <div className="ui-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[color:var(--border)] flex items-center justify-between">
                    <h2 className="font-display font-bold text-ink">อพาร์ทเมนต์</h2>
                    <Link to="/admin/apartments" className="text-sm font-semibold text-violet hover:underline">
                        จัดการ →
                    </Link>
                </div>
                <ul className="divide-y divide-[color:var(--border)]">
                    {apts.map((a) => (
                        <li key={a.apartment_id} className="px-5 py-3.5 flex items-center justify-between hover:bg-cream-surface">
                            <div>
                                <p className="font-semibold text-ink">{a.name}</p>
                                <p className="text-xs text-ink-3">{a.address}</p>
                            </div>
                            <div className="text-sm font-mono font-semibold text-ink-2">
                                {a.rooms_occupied}/{a.rooms_total} ห้อง
                            </div>
                        </li>
                    ))}
                    {apts.length === 0 && (
                        <li className="px-5 py-6 text-center text-ink-4 text-sm">ยังไม่มีอพาร์ทเมนต์</li>
                    )}
                </ul>
            </div>
        </div>
    );
}

function BreakdownCard({ label, value, total, color }) {
    const pct = total > 0 ? (Number(value) / Number(total)) * 100 : 0;
    return (
        <div className="bg-cream-surface border border-[color:var(--border)] rounded-2xl p-3.5">
            <p className="text-xs text-ink-3">{label}</p>
            <p className="font-display text-xl font-bold text-ink mt-1">
                ฿ {fmtMoney(value)}
            </p>
            <div className="w-full h-2 bg-cream-2 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-ink-4 mt-1">{pct.toFixed(1)}% ของรายได้รวม</p>
        </div>
    );
}
