import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRightOnRectangleIcon, UserCircleIcon, KeyIcon, Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';

const ROLE_LABELS = {
    super_admin:      'ผู้ดูแลระบบสูงสุด',
    admin:            'ผู้ดูแลระบบ',
    property_manager: 'ผู้ดูแลหอพัก',
};

export default function Navbar({ onMenuClick }) {
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

    const userName = user?.full_name || user?.username || user?.national_id || '—';

    return (
        <header className="bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
                {/* Hamburger — only visible on narrow screens */}
                <button onClick={onMenuClick}
                        aria-label="เปิดเมนู"
                        className="md:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <div className="text-sm text-slate-500 truncate">
                    <span className="hidden sm:inline">โหมด: </span>{roleText}
                </div>
            </div>

            <div className="flex items-center gap-1 md:gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700 max-w-[14rem] truncate">
                    <UserCircleIcon className="h-6 w-6 text-slate-400 shrink-0" />
                    <span className="truncate">{userName}</span>
                </div>
                <button onClick={() => setPwOpen(true)}
                        title="เปลี่ยนรหัสผ่าน"
                        className="flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100">
                    <KeyIcon className="h-4 w-4" />
                    <span className="hidden md:inline">เปลี่ยนรหัสผ่าน</span>
                </button>
                <button onClick={handleLogout}
                        title="ออกจากระบบ"
                        className="flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100">
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    <span className="hidden md:inline">ออกจากระบบ</span>
                </button>
            </div>
            <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </header>
    );
}
