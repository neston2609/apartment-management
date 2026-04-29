import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ tenantMode = false }) {
    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar tenantMode={tenantMode} />
            <div className="flex-1 flex flex-col">
                <Navbar />
                <main className="flex-1 p-6 overflow-x-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
