import { NavLink } from 'react-router-dom';
import {
    HomeIcon, BuildingOffice2Icon, RectangleStackIcon,
    UsersIcon, DocumentTextIcon, PrinterIcon, Cog6ToothIcon,
    UserGroupIcon, ServerIcon, IdentificationIcon,
    ShieldCheckIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const ALL_ADMIN_LINKS = [
    { to: '/admin/dashboard',  label: 'แดชบอร์ด',         icon: HomeIcon },
    { to: '/admin/apartments', label: 'อพาร์ทเมนต์',       icon: BuildingOffice2Icon },
    { to: '/admin/tenants',    label: 'ผู้เช่า',            icon: UsersIcon },
    { to: '/admin/billing',    label: 'ใบแจ้งค่าเช่า',     icon: DocumentTextIcon },
    { to: '/admin/invoice',    label: 'พิมพ์ใบแจ้งหนี้',   icon: PrinterIcon },
    { to: '/admin/settings',   label: 'ตั้งค่า',            icon: Cog6ToothIcon },
];

const SUPER_ONLY_LINKS = [
    { to: '/admin/users',           label: 'จัดการผู้ใช้',     icon: UserGroupIcon },
    { to: '/admin/login-logs',      label: 'ประวัติเข้าระบบ',  icon: ShieldCheckIcon },
    { to: '/admin/system-settings', label: 'ตั้งค่าระบบ',      icon: ServerIcon },
];

const PROPERTY_MANAGER_LINKS = [
    { to: '/admin/dashboard',  label: 'แดชบอร์ด',         icon: HomeIcon },
    { to: '/admin/apartments', label: 'อพาร์ทเมนต์',       icon: BuildingOffice2Icon },
    { to: '/admin/tenants',    label: 'ผู้เช่า',            icon: UsersIcon },
    { to: '/admin/billing',    label: 'ใบแจ้งค่าเช่า',     icon: DocumentTextIcon },
    { to: '/admin/invoice',    label: 'พิมพ์ใบแจ้งหนี้',   icon: PrinterIcon },
];

const TENANT_LINKS = [
    { to: '/tenant/dashboard', label: 'หน้าหลัก',           icon: HomeIcon },
    { to: '/tenant/bills',     label: 'ใบแจ้งหนี้ของฉัน',    icon: DocumentTextIcon },
    { to: '/tenant/contract',  label: 'สัญญาเช่า',          icon: RectangleStackIcon },
    { to: '/tenant/profile',   label: 'แก้ไขข้อมูลส่วนตัว',  icon: IdentificationIcon },
];

function navLinkClass({ isActive }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
            ? 'bg-brand-600 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
}

export default function Sidebar({ tenantMode = false, mobileOpen = false, onClose }) {
    const { user } = useAuth();

    let links;
    if (tenantMode) {
        links = TENANT_LINKS;
    } else if (user?.admin_role === 'property_manager') {
        links = PROPERTY_MANAGER_LINKS;
    } else if (user?.admin_role === 'super_admin' || user?.is_super_admin) {
        links = [...ALL_ADMIN_LINKS, ...SUPER_ONLY_LINKS];
    } else {
        links = ALL_ADMIN_LINKS;
    }

    const NavList = ({ onNavigate }) => (
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={onNavigate} className={navLinkClass}>
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                </NavLink>
            ))}
        </nav>
    );

    return (
        <>
            {/* Desktop sidebar — md and up */}
            <aside className="w-64 bg-slate-900 text-slate-100 hidden md:flex flex-col">
                <div className="px-6 py-5 border-b border-slate-800">
                    <h1 className="text-lg font-semibold leading-tight">ระบบจัดการ</h1>
                    <p className="text-xs text-slate-400">อพาร์ทเมนต์</p>
                </div>
                <NavList />
                <div className="p-4 text-xs text-slate-500 border-t border-slate-800">
                    v1.0 © Apartment MS
                </div>
            </aside>

            {/* Mobile drawer — only renders below md */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <aside className="w-72 max-w-[80vw] bg-slate-900 text-slate-100 flex flex-col shadow-xl">
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-semibold leading-tight">ระบบจัดการ</h1>
                                <p className="text-xs text-slate-400">อพาร์ทเมนต์</p>
                            </div>
                            <button onClick={onClose}
                                    aria-label="ปิดเมนู"
                                    className="text-slate-300 hover:text-white p-1 rounded-md">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        {/* Auto-close on tap-through */}
                        <NavList onNavigate={onClose} />
                        <div className="p-4 text-xs text-slate-500 border-t border-slate-800">
                            v1.0 © Apartment MS
                        </div>
                    </aside>
                    {/* Backdrop — tap to dismiss */}
                    <button onClick={onClose}
                            aria-label="ปิดเมนู"
                            className="flex-1 bg-black/40" />
                </div>
            )}
        </>
    );
}
