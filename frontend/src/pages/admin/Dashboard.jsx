import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const STAT_LABELS = {
    rooms_total:    'ห้องทั้งหมด',
    rooms_occupied: 'มีผู้เช่า',
    rooms_vacant:   'ว่าง',
    rooms_misc:     'อื่น ๆ',
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
                    <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
                    <p className="text-sm text-slate-500">
                        ภาพรวมประจำเดือน {THAI_MONTHS[month - 1]} {thaiYear(year)}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-slate-600">เดือน:</label>
                    <select className="border border-slate-300 rounded-md px-2 py-1"
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                        {THAI_MONTHS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                    </select>
                    <label className="text-slate-600 ml-2">ปี:</label>
                    <select className="border border-slate-300 rounded-md px-2 py-1"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{thaiYear(y)} ({y})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.keys(STAT_LABELS).map((k) => (
                    <div key={k} className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-xs text-slate-500">{STAT_LABELS[k]}</p>
                        <p className="text-3xl font-bold text-slate-800 mt-1">{totals[k]}</p>
                    </div>
                ))}
            </div>

            {/* Total revenue (filtered by selected room statuses) */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-xs text-slate-500">
                            รายได้รวม (ตามสถานะห้องที่เลือก)
                        </p>
                        <p className="text-3xl font-bold text-brand-700 mt-1">
                            ฿ {fmtMoney(breakdown.total)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            จาก {breakdown.count} ห้อง · ประจำเดือน {THAI_MONTHS[month - 1]} {thaiYear(year)}
                        </p>
                    </div>
                    {loadingBills && <Spinner />}
                </div>

                {/* Status filter checkboxes */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">เลือกสถานะห้องที่นำมาคำนวณรายได้:</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                        {ALL_STATUSES.map((s) => (
                            <label key={s} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    checked={statuses.includes(s)}
                                    onChange={() => toggleStatus(s)}
                                />
                                <span className="text-slate-700">{STATUS_LABELS[s]}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                    <BreakdownCard
                        label="ค่าน้ำ"
                        value={breakdown.water}
                        total={breakdown.total}
                        color="bg-cyan-500"
                    />
                    <BreakdownCard
                        label="ค่าไฟ"
                        value={breakdown.elec}
                        total={breakdown.total}
                        color="bg-amber-500"
                    />
                    <BreakdownCard
                        label="ค่าเช่าห้อง"
                        value={breakdown.rent}
                        total={breakdown.total}
                        color="bg-emerald-500"
                    />
                    <BreakdownCard
                        label="รายได้อื่น ๆ"
                        value={breakdown.other}
                        total={breakdown.total}
                        color="bg-purple-500"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-700">อพาร์ทเมนต์</h2>
                    <Link to="/admin/apartments" className="text-sm text-brand-600 hover:underline">
                        จัดการ →
                    </Link>
                </div>
                <ul className="divide-y divide-slate-100">
                    {apts.map((a) => (
                        <li key={a.apartment_id} className="px-5 py-3 flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-800">{a.name}</p>
                                <p className="text-xs text-slate-500">{a.address}</p>
                            </div>
                            <div className="text-sm text-slate-600">
                                {a.rooms_occupied}/{a.rooms_total} ห้อง
                            </div>
                        </li>
                    ))}
                    {apts.length === 0 && (
                        <li className="px-5 py-6 text-center text-slate-400 text-sm">ยังไม่มีอพาร์ทเมนต์</li>
                    )}
                </ul>
            </div>
        </div>
    );
}

function BreakdownCard({ label, value, total, color }) {
    const pct = total > 0 ? (Number(value) / Number(total)) * 100 : 0;
    return (
        <div className="border border-slate-200 rounded-md p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">
                ฿ {fmtMoney(value)}
            </p>
            <div className="w-full h-1.5 bg-slate-100 rounded mt-2 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{pct.toFixed(1)}% ของรายได้รวม</p>
        </div>
    );
}
