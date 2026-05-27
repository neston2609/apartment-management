import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, fmtThaiDate } from '../../utils/api';
import Spinner from '../../components/common/Spinner';

const KIND_LABEL = { admin: 'แอดมิน', tenant: 'ผู้เช่า' };
const KIND_BADGE = {
    admin:  'bg-cyan-soft text-[#0e7490]',
    tenant: 'bg-orange-soft text-[#b45309]',
};
const REASON_LABEL = {
    unknown_user:   'ไม่พบผู้ใช้',
    wrong_password: 'รหัสผ่านผิด',
    inactive:       'บัญชีไม่ใช้งานแล้ว',
};

const PAGE_SIZE = 100;

function fmtThaiDateTime(input) {
    if (!input) return '-';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '-';
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yy  = d.getFullYear() + 543;
    const hh  = String(d.getHours()).padStart(2, '0');
    const mi  = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export default function LoginLogs() {
    const [logs, setLogs]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [offset, setOffset]   = useState(0);
    const [filterKind, setFilterKind]       = useState('');   // '', 'admin', 'tenant'
    const [filterSuccess, setFilterSuccess] = useState('');   // '', 'true', 'false'
    const [loading, setLoading] = useState(true);

    const load = async (newOffset = 0) => {
        setLoading(true);
        try {
            const params = { limit: PAGE_SIZE, offset: newOffset };
            if (filterKind)    params.user_kind = filterKind;
            if (filterSuccess) params.success   = filterSuccess;
            const r = await unwrap(api.get('/login-logs', { params }));
            setLogs(r?.logs || []);
            setTotal(r?.total || 0);
            setOffset(newOffset);
        } catch (err) {
            toast.error(err.response?.data?.error || 'โหลดข้อมูลล้มเหลว');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(0); /* eslint-disable-next-line */ }, [filterKind, filterSuccess]);

    const last = Math.min(offset + PAGE_SIZE, total);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="font-display text-3xl font-bold text-ink">ประวัติการเข้าสู่ระบบ</h1>
                <p className="text-sm text-ink-3">บันทึกการเข้าสู่ระบบทั้งหมด (ทั้งสำเร็จและไม่สำเร็จ)</p>
            </div>

            <div className="ui-card p-3.5 flex flex-wrap items-center gap-3 text-sm">
                <label className="text-ink-2 font-medium">ประเภทผู้ใช้:</label>
                <select className="ui-input !py-2 !w-auto"
                        value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="admin">แอดมิน</option>
                    <option value="tenant">ผู้เช่า</option>
                </select>
                <label className="text-ink-2 font-medium ml-2">ผลลัพธ์:</label>
                <select className="ui-input !py-2 !w-auto"
                        value={filterSuccess} onChange={(e) => setFilterSuccess(e.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="true">สำเร็จ</option>
                    <option value="false">ไม่สำเร็จ</option>
                </select>
                <span className="ml-auto text-ink-3">
                    {total > 0
                        ? `${offset + 1}–${last} จาก ${total.toLocaleString()}`
                        : 'ไม่พบรายการ'}
                </span>
            </div>

            {loading
                ? <div className="grid place-items-center h-32"><Spinner /></div>
                : (
                    <div className="overflow-x-auto ui-card">
                        <table className="min-w-full text-sm">
                            <thead className="bg-cream-2 text-ink-3">
                                <tr className="[&>th]:text-[11px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:px-4 [&>th]:py-3.5 [&>th]:border-b [&>th]:border-[color:var(--border)] [&>th]:text-left">
                                    <th>เวลา</th>
                                    <th>ผลลัพธ์</th>
                                    <th>ประเภท</th>
                                    <th>ชื่อผู้ใช้/เลขบัตร</th>
                                    <th>รายละเอียด</th>
                                    <th>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((l) => (
                                    <tr key={l.log_id} className="border-t border-[color:var(--border)] hover:bg-cream-surface text-ink-2">
                                        <td className="px-4 py-2 whitespace-nowrap">{fmtThaiDateTime(l.created_at)}</td>
                                        <td className="px-4 py-2">
                                            {l.success
                                                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">สำเร็จ</span>
                                                : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">ไม่สำเร็จ</span>}
                                        </td>
                                        <td className="px-4 py-2">
                                            {l.user_kind ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${KIND_BADGE[l.user_kind]}`}>
                                                    {KIND_LABEL[l.user_kind] || l.user_kind}
                                                </span>
                                            ) : (
                                                <span className="text-ink-4 text-xs">ไม่ระบุ</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="font-medium">{l.identifier || '-'}</div>
                                            {l.user_name && (
                                                <div className="text-xs text-ink-3">{l.user_name}{l.user_room ? ` · ห้อง ${l.user_room}` : ''}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-ink-2">
                                            {l.success
                                                ? <span className="text-[#047857]">เข้าสู่ระบบสำเร็จ</span>
                                                : <span className="text-[#b91c1c]">{REASON_LABEL[l.error_reason] || l.error_reason || 'ไม่สำเร็จ'}</span>}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-500">{l.ip || '-'}</td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-4">ไม่มีข้อมูล</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Pagination */}
            <div className="flex items-center justify-end gap-2 text-sm">
                <button onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0 || loading}
                        className="btn btn-ghost">
                    ← ก่อนหน้า
                </button>
                <button onClick={() => load(offset + PAGE_SIZE)}
                        disabled={offset + PAGE_SIZE >= total || loading}
                        className="btn btn-ghost">
                    ถัดไป →
                </button>
            </div>
        </div>
    );
}
