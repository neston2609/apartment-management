import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRightOnRectangleIcon, UserCircleIcon, KeyIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';

const ROLE_LABELS = {
    super_admin:      'ผู้ดูแลระบบสูงสุด',
    admin:            'ผู้ดูแลระบบ',
    property_manager: 'ผู้ดูแลหอพัก',
};

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pwOpen, setPwOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const roleText =
        user?.role === 'admin'
            ? (ROLE_LABELS[user?.admin_role] || 'ผู้ดูแลระบบ')
            : 'ผู้เช่า';

    return (
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-slate-500">โหมด: {roleText}</div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                    <UserCircleIcon className="h-6 w-6 text-slate-400" />
                    <span>{user?.full_name || user?.username || user?.national_id || '—'}</span>
                </div>
                <button onClick={() => setPwOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100">
                    <KeyIcon className="h-4 w-4" />
                    เปลี่ยนรหัสผ่าน
                </button>
                <button onClick={handleLogout}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100">
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    ออกจากระบบ
                </button>
            </div>
            <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </header>
    );
}
