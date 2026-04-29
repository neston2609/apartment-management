import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './common/Spinner';

export default function PrivateRoute({ children, role }) {
    const { user, ready } = useAuth();
    if (!ready) return <div className="grid place-items-center h-screen"><Spinner /></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) {
        return <Navigate to={user.role === 'admin' ? '/admin' : '/tenant'} replace />;
    }
    return children;
}
