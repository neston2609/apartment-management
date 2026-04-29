import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function TenantContract() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const download = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tenants/${user.id}/contract`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-bold text-slate-800">สัญญาเช่า</h1>

            <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm space-y-3">
                <p className="text-slate-600">
                    คุณสามารถดาวน์โหลดสัญญาเช่าฉบับเต็มได้ที่นี่
                    เอกสารจะแสดงรายละเอียดผู้เช่า ห้องพัก ค่าเช่า และเงื่อนไขทั้งหมด
                </p>
                <div className="text-slate-700">
                    <p><span className="text-slate-500">ชื่อ:</span> {user?.full_name}</p>
                    <p><span className="text-slate-500">ห้อง:</span> {user?.room_number}</p>
                    <p><span className="text-slate-500">เลขบัตรประชาชน:</span> {user?.national_id}</p>
                </div>
                <button onClick={download} disabled={loading}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md disabled:opacity-50">
                    {loading ? 'กำลังสร้าง...' : 'ดาวน์โหลดสัญญา PDF'}
                </button>
            </div>
        </div>
    );
}
