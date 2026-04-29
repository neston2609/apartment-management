import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import Apartments from './pages/admin/Apartments';
import Rooms from './pages/admin/Rooms';
import Tenants from './pages/admin/Tenants';
import TenantForm from './pages/admin/TenantForm';
import Billing from './pages/admin/Billing';
import BillingForm from './pages/admin/BillingForm';
import Invoice from './pages/admin/Invoice';
import Settings from './pages/admin/Settings';
import Users from './pages/admin/Users';

import TenantDashboard from './pages/tenant/TenantDashboard';
import TenantBills from './pages/tenant/TenantBills';
import TenantContract from './pages/tenant/TenantContract';

export default function App() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Admin */}
            <Route
                path="/admin"
                element={
                    <PrivateRoute role="admin">
                        <Layout />
                    </PrivateRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="apartments" element={<Apartments />} />
                <Route path="rooms/:apartmentId" element={<Rooms />} />
                <Route path="tenants" element={<Tenants />} />
                <Route path="tenants/new" element={<TenantForm />} />
                <Route path="tenants/:id/edit" element={<TenantForm />} />
                <Route path="billing" element={<Billing />} />
                <Route path="billing/:roomId/:month/:year" element={<BillingForm />} />
                <Route path="invoice" element={<Invoice />} />
                <Route path="settings" element={<Settings />} />
                <Route path="users" element={<Users />} />
            </Route>

            {/* Tenant */}
            <Route
                path="/tenant"
                element={
                    <PrivateRoute role="tenant">
                        <Layout tenantMode />
                    </PrivateRoute>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TenantDashboard />} />
                <Route path="bills" element={<TenantBills />} />
                <Route path="contract" element={<TenantContract />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
