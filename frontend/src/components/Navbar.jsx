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
        <header className="sticky top-0 z-30 px-3 md:px-6 py-3 flex items-center justify-between gap-2 border-b border-[color:var(--border)] bg-white/60 backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
                {/* Hamburger — only visible on narrow screens */}
                <button onClick={onMenuClick}
                        aria-label="เปิดเมนู"
                        className="md:hidden p-1.5 rounded-xl text-ink-2 hover:bg-cream-surface">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <div className="text-sm text-ink-3 truncate">
                    <span className="hidden sm:inline">โหมด: </span>
                    <span className="font-semibold text-ink-2">{roleText}</span>
                </div>
            </div>

            <div className="flex items-center gap-1 md:gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm text-ink-2 max-w-[14rem] truncate">
                    <UserCircleIcon className="h-7 w-7 text-violet shrink-0" />
                    <span className="truncate font-medium">{userName}</span>
                </div>
                <button onClick={() => setPwOpen(true)}
                        title="เปลี่ยนรหัสผ่าน"
                        className="btn btn-ghost !px-2 md:!px-3 !py-1.5">
                    <KeyIcon className="h-4 w-4" />
                    <span className="hidden md:inline">เปลี่ยนรหัสผ่าน</span>
                </button>
                <button onClick={handleLogout}
                        title="ออกจากระบบ"
                        className="btn btn-ghost !px-2 md:!px-3 !py-1.5">
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    <span className="hidden md:inline">ออกจากระบบ</span>
                </button>
            </div>
            <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </header>
    );
}
