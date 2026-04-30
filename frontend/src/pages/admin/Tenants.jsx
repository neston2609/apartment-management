import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { unwrap, fmtThaiDate } from '../../utils/api';
import Table from '../../components/common/Table';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../context/AuthContext';

export default function Tenants() {
    const { user: me } = useAuth();
    const isPropertyManager = me?.admin_role === 'property_manager';

    const [apts, setApts] = useState([]);
    const [filter, setFilter] = useState('');
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const params = filter ? { apartment_id: filter } : {};
            const data = await unwrap(api.get('/tenants', { params }));
            setTenants(data || []);
        } catch {
            toast.error('โหลดข้อมูลล้มเหลว');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        unwrap(api.get('/apartments')).then((r) => setApts(r || []));
    }, []);

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

    const handleMoveOut = async (t) => {
        if (!window.confirm(`ยืนยันการย้ายออก: ${t.full_name} ?`)) return;
        try {
            await api.post(`/tenants/${t.tenant_id}/moveout`);
            toast.success('บันทึกการย้ายออกแล้ว');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.error || 'ล้มเหลว');
        }
    };

    const downloadContract = async (t) => {
        try {
            const res = await api.get(`/tenants/${t.tenant_id}/contract`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
        } catch {
            toast.error('สร้าง PDF ไม่สำเร็จ');
        }
    };

    const columns = [
        { key: 'room_number',  title: 'ห้อง', render: (r) => r.room_number || '-' },
        { key: 'full_name',    title: 'ชื่อ-นามสกุล' },
        { key: 'phone_number', title: 'โทรศัพท์', render: (r) => r.phone_number || '-' },
        { key: 'national_id',  title: 'เลขบัตร ปชช.' },
        { key: 'move_in_date', title: 'วันที่เข้าพัก',
          render: (r) => fmtThaiDate(r.move_in_date) },
        {
            key: 'actions', title: '',
            render: (r) => (
                <div className="flex gap-2 text-xs">
                    <Link to={`/admin/tenants/${r.tenant_id}/edit`} className="text-brand-600 hover:underline">แก้ไข</Link>
                    <button onClick={() => downloadContract(r)} className="text-slate-600 hover:underline">สัญญา</button>
                    {!isPropertyManager && (
                        <button onClick={() => handleMoveOut(r)} className="text-red-600 hover:underline">ย้ายออก</button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">ผู้เช่า</h1>
                {!isPropertyManager && (
                    <Link to="/admin/tenants/new"
                          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-md">
                        เพิ่มผู้เช่า
                    </Link>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="text-sm text-slate-600 mr-2">อพาร์ทเมนต์:</label>
                <select className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                        value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {apts.map((a) => <option key={a.apartment_id} value={a.apartment_id}>{a.name}</option>)}
                </select>
            </div>

            {loading
                ? <div className="grid place-items-center h-32"><Spinner /></div>
                : <Table columns={columns} rows={tenants.map((t) => ({ ...t, id: t.tenant_id }))} />
            }
        </div>
    );
}
