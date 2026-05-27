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
    return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
            ? 'bg-grad-aurora text-white shadow-glow-violet'
            : 'text-ink-2 hover:bg-cream-surface hover:text-ink'
    }`;
}

function BrandHeader() {
    return (
        <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-grad-aurora shadow-glow-violet">
                <BuildingOffice2Icon className="h-5 w-5 text-white" />
            </div>
            <div>
                <h1 className="font-display text-lg font-bold leading-tight text-ink">ระบบจัดการ</h1>
                <p className="text-[11px] uppercase tracking-wider text-ink-3">อพาร์ทเมนต์</p>
            </div>
        </div>
    );
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
            <aside className="w-64 hidden md:flex flex-col bg-gradient-to-b from-white to-cream-surface border-r border-[color:var(--border)]">
                <div className="px-5 py-5 border-b border-[color:var(--border)]">
                    <BrandHeader />
                </div>
                <NavList />
                <div className="p-4 text-xs text-ink-3 border-t border-[color:var(--border)]">
                    v1.0 © Apartment MS
                </div>
            </aside>

            {/* Mobile drawer — only renders below md */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <aside className="w-72 max-w-[80vw] flex flex-col shadow-xl bg-gradient-to-b from-white to-cream-surface border-r border-[color:var(--border)]">
                        <div className="px-5 py-4 border-b border-[color:var(--border)] flex items-center justify-between">
                            <BrandHeader />
                            <button onClick={onClose}
                                    aria-label="ปิดเมนู"
                                    className="text-ink-3 hover:text-ink p-1 rounded-md">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        {/* Auto-close on tap-through */}
                        <NavList onNavigate={onClose} />
                        <div className="p-4 text-xs text-ink-3 border-t border-[color:var(--border)]">
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
