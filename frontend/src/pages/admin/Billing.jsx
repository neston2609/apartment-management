import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import Spinner from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';

const now = new Date();

export default function Billing() {
    const [apts, setApts]     = useState([]);
    const [aptId, setAptId]   = useState('');
    const [month, setMonth]   = useState(now.getMonth() + 1);
    const [year, setYear]     = useState(now.getFullYear());
    const [rooms, setRooms]   = useState([]);
    const [bills, setBills]   = useState([]);
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
        Promise.all([
            unwrap(api.get(`/apartments/${aptId}/rooms`)),
            unwrap(api.get('/bills', { params: { apartment_id: aptId, month, year } })),
        ]).then(([r, b]) => {
            setRooms(r || []);
            setBills(b || []);
        }).catch(() => toast.error('โหลดข้อมูลล้มเหลว'))
          .finally(() => setLoading(false));
    }, [aptId, month, year]);

    const billByRoom = bills.reduce((m, b) => { m[b.room_id] = b; return m; }, {});

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-800">ใบแจ้งค่าเช่า</h1>

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
                                    return (
                                        <tr key={r.room_id} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium">{r.room_number}</td>
                                            <td className="px-4 py-2">{r.tenant_name || '-'}</td>
                                            <td className="px-4 py-2"><Badge status={r.status} /></td>
                                            <td className="px-4 py-2 text-right">
                                                {b ? `฿ ${fmtMoney(b.total_cost)}` : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <Link to={`/admin/billing/${r.room_id}/${month}/${year}`}
                                                      className="text-brand-600 hover:underline text-xs">
                                                    {b ? 'แก้ไข' : 'สร้าง'}
                                                </Link>
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
        </div>
    );
}
