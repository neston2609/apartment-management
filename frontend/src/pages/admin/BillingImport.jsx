import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear } from '../../utils/api';
import Modal from '../../components/common/Modal';

/**
 * Excel import modal for the Billing page.
 * Layout matches the user's reference file:
 *   row 1: header date (ignored)
 *   row 2: header labels    (skipped — see "headerRow" + "dataStartRow")
 *   row 3+: data
 *
 * The user picks which 1-indexed columns hold:
 *   - room number  (default 2)
 *   - water (new)  (default 3)
 *   - electric (new) (default 4)
 */
export default function BillingImport({ apartmentId, defaultMonth, defaultYear, onClose, onDone }) {
    const [month, setMonth] = useState(defaultMonth);
    const [year,  setYear]  = useState(defaultYear);

    const [colRoom, setColRoom] = useState(2);
    const [colWater, setColWater] = useState(3);
    const [colElec,  setColElec]  = useState(4);
    const [headerRow, setHeaderRow] = useState(2);   // 1-indexed header row to skip
    const [dataStartRow, setDataStartRow] = useState(3);

    const [rows, setRows]       = useState([]);   // parsed { room_no, water, electric }
    const [fileName, setFileName] = useState('');
    const [busy, setBusy]       = useState(false);
    const [report, setReport]   = useState(null); // server response after import

    const yearOptions = useMemo(() => {
        const cy = new Date().getFullYear();
        const arr = [];
        for (let y = cy - 3; y <= cy + 1; y++) arr.push(y);
        return arr;
    }, []);

    const handleFile = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFileName(f.name);
        setReport(null);
        try {
            const buf = await f.arrayBuffer();
            const wb  = XLSX.read(buf, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            // Get as 2D array (raw values), starting from row 1
            const all = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

            const dStart = dataStartRow - 1; // 0-indexed
            const out = [];
            for (let i = dStart; i < all.length; i++) {
                const r = all[i] || [];
                const roomCell  = r[colRoom  - 1];
                const waterCell = r[colWater - 1];
                const elecCell  = r[colElec  - 1];
                if (roomCell == null || roomCell === '') continue;
                const w = Number(waterCell);
                const e = Number(elecCell);
                if (!Number.isFinite(w) || !Number.isFinite(e)) continue;
                out.push({
                    room_no: String(roomCell).trim(),
                    water:   Math.trunc(w),
                    electric: Math.trunc(e),
                });
            }
            setRows(out);
            if (!out.length) toast.error('ไม่พบแถวข้อมูลที่ใช้ได้');
        } catch (err) {
            toast.error('อ่านไฟล์ไม่สำเร็จ — โปรดตรวจสอบว่าเป็นไฟล์ .xlsx');
        }
    };

    const submit = async () => {
        if (!rows.length) { toast.error('ยังไม่มีข้อมูลให้นำเข้า'); return; }
        setBusy(true);
        try {
            const data = await unwrap(api.post('/bills/import', {
                apartment_id: apartmentId,
                month, year, rows,
            }));
            setReport(data);
            toast.success(`สำเร็จ — สร้าง ${data.summary.imported}, แก้ไข ${data.summary.updated}, ข้าม ${data.summary.skipped}`);
            onDone?.();
        } catch (err) {
            toast.error(err.response?.data?.error || 'นำเข้าล้มเหลว');
        } finally { setBusy(false); }
    };

    const close = () => {
        setRows([]); setFileName(''); setReport(null);
        onClose();
    };

    return (
        <Modal
            open
            onClose={close}
            title="นำเข้าใบแจ้งหนี้จาก Excel"
            footer={
                <>
                    <button onClick={close} className="px-3 py-1.5 text-sm text-slate-600">ปิด</button>
                    {!report && (
                        <button onClick={submit} disabled={busy || !rows.length}
                                className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md disabled:opacity-50">
                            {busy ? 'กำลังนำเข้า...' : `นำเข้า ${rows.length} แถว`}
                        </button>
                    )}
                </>
            }
        >
            <div className="text-sm space-y-4">
                {/* Step 1: Period and column mapping */}
                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-slate-600">เดือน</span>
                        <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                            {THAI_MONTHS.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-slate-600">ปี (ค.ศ.)</span>
                        <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                                value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                            {yearOptions.map((y) => <option key={y} value={y}>{thaiYear(y)} ({y})</option>)}
                        </select>
                    </label>
                </div>

                <details className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs">
                    <summary className="cursor-pointer font-medium text-slate-700">
                        ตั้งค่าคอลัมน์ (ค่าเริ่มต้น: เลขห้อง=2, น้ำ=3, ไฟ=4)
                    </summary>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <NumField label="คอลัมน์ เลขห้อง" value={colRoom}  onChange={setColRoom} />
                        <NumField label="คอลัมน์ น้ำใหม่"  value={colWater} onChange={setColWater} />
                        <NumField label="คอลัมน์ ไฟใหม่"  value={colElec}  onChange={setColElec} />
                        <NumField label="แถวเริ่มข้อมูล"   value={dataStartRow} onChange={setDataStartRow} />
                    </div>
                    <p className="text-slate-500 mt-2">
                        * ใช้เลขคอลัมน์แบบ 1, 2, 3 ... (A=1, B=2, ...)
                    </p>
                </details>

                {/* Step 2: file picker */}
                <div>
                    <label className="block">
                        <span className="text-slate-600">เลือกไฟล์ .xlsx</span>
                        <input type="file" accept=".xlsx,.xls"
                               onChange={handleFile}
                               className="mt-1 w-full text-sm" />
                    </label>
                    {fileName && (
                        <p className="text-xs text-slate-500 mt-1">
                            ไฟล์: <strong>{fileName}</strong> · พบ {rows.length} แถวที่ใช้ได้
                        </p>
                    )}
                </div>

                {/* Step 3: preview */}
                {rows.length > 0 && !report && (
                    <div className="overflow-x-auto bg-white rounded-md border border-slate-200 max-h-72">
                        <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                <tr>
                                    <th className="text-left px-3 py-1.5">เลขห้อง</th>
                                    <th className="text-right px-3 py-1.5">น้ำใหม่</th>
                                    <th className="text-right px-3 py-1.5">ไฟใหม่</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 100).map((r, i) => (
                                    <tr key={i} className="border-t border-slate-100">
                                        <td className="px-3 py-1">{r.room_no}</td>
                                        <td className="px-3 py-1 text-right">{r.water}</td>
                                        <td className="px-3 py-1 text-right">{r.electric}</td>
                                    </tr>
                                ))}
                                {rows.length > 100 && (
                                    <tr><td colSpan={3} className="text-center text-slate-400 py-2">
                                        และอีก {rows.length - 100} แถว...
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Step 4: report */}
                {report && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                        <div className="font-medium text-green-800">นำเข้าสำเร็จ</div>
                        <ul className="mt-2 text-green-900 list-disc pl-5">
                            <li>สร้างใหม่: <strong>{report.summary.imported}</strong> รายการ</li>
                            <li>แก้ไขที่มีอยู่: <strong>{report.summary.updated}</strong> รายการ</li>
                            <li>ข้าม (ไม่พบห้อง / ข้อมูลไม่ครบ): <strong>{report.summary.skipped}</strong></li>
                        </ul>
                        {report.summary.missing_rooms?.length > 0 && (
                            <p className="mt-2 text-amber-800">
                                ห้องที่ไม่พบในระบบ: {report.summary.missing_rooms.join(', ')}
                            </p>
                        )}
                        <details className="mt-2">
                            <summary className="cursor-pointer text-green-800">ดูรายละเอียด</summary>
                            <div className="overflow-x-auto bg-white rounded-md border border-slate-200 mt-2 max-h-60">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                        <tr>
                                            <th className="text-left px-2 py-1">ห้อง</th>
                                            <th className="text-right px-2 py-1">น้ำเก่า/ใหม่</th>
                                            <th className="text-right px-2 py-1">ไฟเก่า/ใหม่</th>
                                            <th className="text-right px-2 py-1">หน่วยน้ำ</th>
                                            <th className="text-right px-2 py-1">หน่วยไฟ</th>
                                            <th className="text-right px-2 py-1">รวม</th>
                                            <th className="px-2 py-1">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.items.map((it, i) => (
                                            <tr key={i} className="border-t border-slate-100">
                                                <td className="px-2 py-1">{it.room_no}</td>
                                                <td className="px-2 py-1 text-right">{it.water_last}/{it.water_current}</td>
                                                <td className="px-2 py-1 text-right">{it.elec_last}/{it.elec_current}</td>
                                                <td className="px-2 py-1 text-right">{it.water_usage}</td>
                                                <td className="px-2 py-1 text-right">{it.elec_usage}</td>
                                                <td className="px-2 py-1 text-right font-medium">฿ {fmtMoney(it.total)}</td>
                                                <td className="px-2 py-1 text-xs">
                                                    {it.action === 'updated' ? 'แก้ไข' : 'สร้างใหม่'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    </div>
                )}

                {!report && (
                    <p className="text-xs text-slate-500">
                        * มิเตอร์เก่าจะถูกดึงจากเดือนก่อนหน้าใน DB อัตโนมัติ ค่าเช่าใช้จาก "ราคาห้อง" ที่ตั้งไว้
                          ถ้ามีใบแจ้งหนี้อยู่แล้วจะอัปเดตและคำนวณใหม่
                    </p>
                )}
            </div>
        </Modal>
    );
}

function NumField({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="text-slate-600">{label}</span>
            <input type="number" min={1}
                   className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                   value={value}
                   onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)} />
        </label>
    );
}
