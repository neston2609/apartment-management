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
            <h1 className="font-display text-3xl font-bold text-ink">สัญญาเช่า</h1>

            <div className="ui-card p-6 text-sm space-y-3">
                <p className="text-ink-2">
                    คุณสามารถดาวน์โหลดสัญญาเช่าฉบับเต็มได้ที่นี่
                    เอกสารจะแสดงรายละเอียดผู้เช่า ห้องพัก ค่าเช่า และเงื่อนไขทั้งหมด
                </p>
                <div className="text-ink-2 space-y-1">
                    <p><span className="text-ink-3">ชื่อ:</span> {user?.full_name}</p>
                    <p><span className="text-ink-3">ห้อง:</span> {user?.room_number}</p>
                    <p><span className="text-ink-3">เลขบัตรประชาชน:</span> {user?.national_id}</p>
                </div>
                <button onClick={download} disabled={loading} className="btn btn-primary">
                    {loading ? 'กำลังสร้าง...' : 'ดาวน์โหลดสัญญา PDF'}
                </button>
            </div>
        </div>
    );
}
