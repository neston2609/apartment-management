import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser]   = useState(null);
    const [token, setToken] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const t = localStorage.getItem('apt_token');
            const u = localStorage.getItem('apt_user');
            if (t && u) {
                setToken(t);
                setUser(JSON.parse(u));
            }
        } catch { /* noop */ }
        setReady(true);
    }, []);

    const login = (newToken, newUser) => {
        localStorage.setItem('apt_token', newToken);
        localStorage.setItem('apt_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('apt_token');
        localStorage.removeItem('apt_user');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, ready, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
