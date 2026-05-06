import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ tenantMode = false }) {
    // mobileOpen controls the slide-in drawer that replaces the sidebar
    // on narrow screens (< md). On md and up the desktop sidebar is used.
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar
                tenantMode={tenantMode}
                mobileOpen={mobileOpen}
                onClose={() => setMobileOpen(false)}
            />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar onMenuClick={() => setMobileOpen(true)} />
                <main className="flex-1 p-4 md:p-6 overflow-x-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
