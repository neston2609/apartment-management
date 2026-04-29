import { NavLink } from 'react-router-dom';
import {
    HomeIcon, BuildingOffice2Icon, RectangleStackIcon,
    UsersIcon, DocumentTextIcon, PrinterIcon, Cog6ToothIcon,
    UserGroupIcon, ServerIcon, IdentificationIcon,
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
    { to: '/admin/users',           label: 'จัดการผู้ใช้',  icon: UserGroupIcon },
    { to: '/admin/system-settings', label: 'ตั้งค่าระบบ',   icon: ServerIcon },
];

const PROPERTY_MANAGER_LINKS = [
    { to: '/admin/invoice',    label: 'พิมพ์ใบแจ้งหนี้',   icon: PrinterIcon },
];

const TENANT_LINKS = [
    { to: '/tenant/dashboard', label: 'หน้าหลัก',           icon: HomeIcon },
    { to: '/tenant/bills',     label: 'ใบแจ้งหนี้ของฉัน',    icon: DocumentTextIcon },
    { to: '/tenant/contract',  label: 'สัญญาเช่า',          icon: RectangleStackIcon },
    { to: '/tenant/profile',   label: 'แก้ไขข้อมูลส่วนตัว',  icon: IdentificationIcon },
];

export default function Sidebar({ tenantMode = false }) {
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

    return (
        <aside className="w-64 bg-slate-900 text-slate-100 hidden md:flex flex-col">
            <div className="px-6 py-5 border-b border-slate-800">
                <h1 className="text-lg font-semibold leading-tight">ระบบจัดการ</h1>
                <p className="text-xs text-slate-400">อพาร์ทเมนต์</p>
            </div>
            <nav className="flex-1 p-3 space-y-1">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                             ${isActive
                                ? 'bg-brand-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
                        }
                    >
                        <Icon className="h-5 w-5" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 text-xs text-slate-500 border-t border-slate-800">
                v1.0 © Apartment MS
            </div>
        </aside>
    );
}
