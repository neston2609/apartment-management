import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, fmtMoney, THAI_MONTHS, thaiYear, defaultReportingMonth, getUploadUrl } from '../../utils/api';
import Spinner from '../../components/common/Spinner';
import { paymentStatus } from '../../utils/billStatus';

export default function TenantBills() {
    const period = defaultReportingMonth();
    const [allBills, setAllBills] = useState([]);
    const [year, setYear]         = useState(period.year);
    const [loading, setLoading]   = useState(true);

    // Payment modal
    const [payModal, setPayModal] = useState(null);   // bill object
    const [slipFile, setSlipFile] = useState(null);
    const [slipPreview, setSlipPreview] = useState(null);
    const [uploading, setUploading]     = useState(false);
    const slipInputRef = useRef(null);

    const loadBills = () => {
        setLoading(true);
        unwrap(api.get('/bills/tenant/me'))
            .then((d) => setAllBills(d || []))
            .catch(() => toast.error('โหลดข้อมูลล้มเหลว'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadBills(); }, []);

    const yearOptions = useMemo(() => {
        const s = new Set([period.year]);
        allBills.forEach((b) => s.add(Number(b.year)));
        return [...s].sort((a, b) => b - a);
    }, [allBills, period.year]);

    const visible = useMemo(() => {
        const filtered = allBills.filter((b) => Number(b.year) === Number(year));
        return filtered.sort((a, b) => {
            if (Number(year) === period.year) {
                if (a.month === period.month && b.month !== period.month) return -1;
                if (b.month === period.month && a.month !== period.month) return  1;
            }
            return Number(b.month) - Number(a.month);
        });
    }, [allBills, year, period.month, period.year]);

    const downloadPdf = async (id, size = 'A5', lang = 'th') => {
        try {
            const res = await api.get(`/bills/${id}/pdf`, { params: { size, lang }, responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        }
    };

    const openPayModal = (bill) => {
        setPayModal(bill);
        setSlipFile(null);
        setSlipPreview(null);
        if (slipInputRef.current) slipInputRef.current.value = '';
    };

    const handleSlipFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSlipFile(file);
        setSlipPreview(URL.createObjectURL(file));
    };

    const submitSlip = async () => {
        if (!slipFile || !payModal) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('slip', slipFile);
            await api.post(`/bills/${payModal.bill_id}/submit-slip`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('ส่งสลิปเรียบร้อย รอการยืนยันจากผู้ดูแล');
            setPayModal(null);
            setSlipFile(null);
            setSlipPreview(null);
            loadBills();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ส่งสลิปล้มเหลว');
        } finally { setUploading(false); }
    };

    if (loading) return <div className="grid place-items-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-3xl font-bold text-ink">ใบแจ้งหนี้ของฉัน</h1>
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-ink-2 font-medium">ปี (พ.ศ.):</label>
                    <select className="ui-input !py-2 !w-auto"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{thaiYear(y)} ({y})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto ui-card">
                <table className="min-w-full text-sm">
                    <thead className="bg-cream-2 text-ink-3">
                        <tr className="[&>th]:text-[11px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:px-4 [&>th]:py-3.5 [&>th]:border-b [&>th]:border-[color:var(--border)]">
                            <th className="text-left">เดือน</th>
                            <th className="text-left">สถานะ</th>
                            <th className="!text-right">ค่าน้ำ</th>
                            <th className="!text-right">ค่าไฟ</th>
                            <th className="!text-right">ค่าเช่า</th>
                            <th className="!text-right">อื่น ๆ</th>
                            <th className="!text-right">รวม</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((b) => {
                            const isCurrent = b.month === period.month && Number(b.year) === period.year;
                            const ps = paymentStatus(b);
                            const lateFee = ps?.kind === 'overdue' ? ps.late_fee : 0;
                            const grand = Number(b.total_cost) + lateFee;
                            const slipStatus = b.payment_slip_status;
                            return (
                                <tr key={b.bill_id}
                                    className={`border-t border-[color:var(--border)] text-ink-2 ${isCurrent ? 'bg-violet-soft/50' : ''}`}>
                                    <td className="px-4 py-3 font-medium">
                                        {THAI_MONTHS[b.month - 1]} {thaiYear(b.year)}
                                        {isCurrent && <span className="ml-2 text-xs font-bold text-violet">(ปัจจุบัน)</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-0.5">
                                            {ps && (
                                                <>
                                                    <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium ${ps.cls}`}>
                                                        {ps.label}
                                                    </span>
                                                    {ps.kind === 'overdue' && (
                                                        <span className="text-[11px] text-red-700">
                                                            เลย {ps.days_overdue} วัน · ค่าปรับ ฿ {fmtMoney(ps.late_fee)}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {/* Slip status badge */}
                                            {slipStatus === 'pending' && (
                                                <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                                    รอการยืนยันสลิป
                                                </span>
                                            )}
                                            {slipStatus === 'confirmed' && (
                                                <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    ยืนยันสลิปแล้ว
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(b.water_cost)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(b.electricity_cost)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(b.rent_cost)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(b.other_cost)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-ink">
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="font-mono">฿ {fmtMoney(b.total_cost)}</span>
                                            {lateFee > 0 && (
                                                <span className="text-[11px] text-[#b91c1c] font-normal">
                                                    + ฿ {fmtMoney(lateFee)} ค่าปรับ → ฿ {fmtMoney(grand)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col items-end gap-1.5">
                                            {/* Show "ชำระเงิน" button for unpaid bills */}
                                            {!b.paid_at && (
                                                <button onClick={() => openPayModal(b)}
                                                        className="btn btn-primary !px-3 !py-1.5 !text-xs whitespace-nowrap">
                                                    {slipStatus === 'pending' ? 'ส่งสลิปใหม่' : 'ชำระเงิน'}
                                                </button>
                                            )}
                                            <button onClick={() => downloadPdf(b.bill_id, 'A5', 'th')}
                                                    className="text-xs text-ink-3 hover:text-ink hover:underline whitespace-nowrap">
                                                ดาวน์โหลด PDF
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {visible.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-4">
                                ไม่มีใบแจ้งหนี้สำหรับปีนี้
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payment modal */}
            {payModal && (
                <PaymentModal
                    bill={payModal}
                    slipFile={slipFile}
                    slipPreview={slipPreview}
                    uploading={uploading}
                    slipInputRef={slipInputRef}
                    onFileChange={handleSlipFileChange}
                    onSubmit={submitSlip}
                    onClose={() => { setPayModal(null); setSlipFile(null); setSlipPreview(null); }}
                />
            )}
        </div>
    );
}

function PaymentModal({ bill, slipFile, slipPreview, uploading, slipInputRef, onFileChange, onSubmit, onClose }) {
    const ps      = paymentStatus(bill);
    const lateFee = ps?.kind === 'overdue' ? ps.late_fee : 0;
    const grand   = Number(bill.total_cost) + lateFee;

    const hasBank  = bill.bank_name || bill.bank_account_number || bill.bank_account_name;
    const qrUrl    = bill.qr_code_url || (bill.qr_code_path ? getUploadUrl(bill.qr_code_path) : null);
    const hasPay   = hasBank || qrUrl;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4"
             onClick={onClose}>
            <div className="relative w-full max-w-md bg-white rounded-[20px] shadow-soft-lg border border-[color:var(--border)]"
                 onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
                    <h2 className="font-display font-bold text-ink">ชำระเงิน — {THAI_MONTHS[bill.month - 1]} {thaiYear(bill.year)}</h2>
                    <button onClick={onClose} className="text-ink-3 hover:text-ink text-2xl leading-none">×</button>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Bill summary */}
                    <div className="bg-cream-surface rounded-2xl p-3.5 space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-ink-3">ค่าน้ำ</span>
                            <span className="font-mono">฿ {fmtMoney(bill.water_cost)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-ink-3">ค่าไฟ</span>
                            <span className="font-mono">฿ {fmtMoney(bill.electricity_cost)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-ink-3">ค่าเช่า</span>
                            <span className="font-mono">฿ {fmtMoney(bill.rent_cost)}</span>
                        </div>
                        {Number(bill.other_cost) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-ink-3">ค่าอื่น ๆ</span>
                                <span className="font-mono">฿ {fmtMoney(bill.other_cost)}</span>
                            </div>
                        )}
                        {lateFee > 0 && (
                            <div className="flex justify-between text-[#b91c1c]">
                                <span>ค่าปรับ ({ps.days_overdue} วัน)</span>
                                <span className="font-mono">฿ {fmtMoney(lateFee)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-violet pt-1.5 border-t border-[color:var(--border)] mt-1.5">
                            <span>ยอดที่ต้องชำระ</span>
                            <span className="font-mono">฿ {fmtMoney(grand)}</span>
                        </div>
                    </div>

                    {/* Payment info */}
                    {hasPay ? (
                        <div className="space-y-3">
                            {hasBank && (
                                <div className="border border-[color:var(--border)] rounded-2xl p-3.5 text-sm space-y-1">
                                    <p className="font-bold text-ink mb-1">ข้อมูลการโอนเงิน</p>
                                    {bill.bank_name && (
                                        <div className="flex gap-2">
                                            <span className="text-ink-3 w-24 shrink-0">ธนาคาร</span>
                                            <span className="font-medium text-ink">{bill.bank_name}</span>
                                        </div>
                                    )}
                                    {bill.bank_account_number && (
                                        <div className="flex gap-2">
                                            <span className="text-ink-3 w-24 shrink-0">เลขบัญชี</span>
                                            <span className="font-mono font-medium tracking-wide text-ink">{bill.bank_account_number}</span>
                                        </div>
                                    )}
                                    {bill.bank_account_name && (
                                        <div className="flex gap-2">
                                            <span className="text-ink-3 w-24 shrink-0">ชื่อบัญชี</span>
                                            <span className="font-medium text-ink">{bill.bank_account_name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {qrUrl && (
                                <div className="flex flex-col items-center gap-2">
                                    <p className="text-sm font-bold text-ink self-start">QR Code สำหรับชำระเงิน</p>
                                    <img src={qrUrl} alt="QR Code"
                                         className="w-48 h-48 object-contain border border-[color:var(--border)] rounded-2xl bg-white p-1" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-sunshine-soft border border-sunshine/40 rounded-2xl p-3 text-sm text-[#b45309]">
                            ยังไม่มีข้อมูลการชำระเงิน — กรุณาติดต่อผู้ดูแลหอพัก
                        </div>
                    )}

                    {/* Slip upload */}
                    <div className="border-t border-[color:var(--border)] pt-3 space-y-2">
                        <p className="text-sm font-bold text-ink">แนบสลิปการโอนเงิน</p>
                        <p className="text-xs text-ink-3">
                            หลังโอนเงินแล้ว กรุณาอัปโหลดสลิปเพื่อยืนยันการชำระ
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="btn btn-ghost cursor-pointer">
                                เลือกรูปสลิป
                                <input ref={slipInputRef} type="file" accept="image/*" className="hidden"
                                       onChange={onFileChange} />
                            </label>
                            {slipFile && (
                                <span className="text-xs text-ink-2 truncate max-w-[160px]">{slipFile.name}</span>
                            )}
                        </div>
                        {slipPreview && (
                            <img src={slipPreview} alt="ตัวอย่างสลิป"
                                 className="w-full max-h-48 object-contain border border-[color:var(--border)] rounded-2xl" />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-[color:var(--border)] bg-cream-surface rounded-b-[20px]">
                    <button onClick={onClose} className="btn btn-ghost">
                        ปิด
                    </button>
                    <button onClick={onSubmit}
                            disabled={!slipFile || uploading}
                            className="btn btn-primary">
                        {uploading ? 'กำลังส่ง...' : 'ส่งสลิป'}
                    </button>
                </div>
            </div>
        </div>
    );
}
