import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api',
    timeout: 30000,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('apt_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 by clearing auth and redirecting
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('apt_token');
            localStorage.removeItem('apt_user');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.assign('/login');
            }
        }
        return Promise.reject(err);
    }
);

// Convenience: extract { data } envelope
export const unwrap = (resPromise) => resPromise.then((r) => r.data?.data ?? r.data);

export default api;

// Thai utility helpers used widely in pages
export const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
export const thaiYear = (g) => Number(g) + 543;
export const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Format a date as DD/MM/YYYY in Buddhist Era (พ.ศ.).
 * Accepts: ISO string, "YYYY-MM-DD", Date object, null/undefined.
 * Returns "-" if the input is unparseable or empty.
 */
export const fmtThaiDate = (input) => {
    if (!input) return '-';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear() + 543;
    return `${dd}/${mm}/${yy}`;
};

/**
 * Default "reporting month" rule used as the initial month/year filter
 * across the app:
 *   - Before the 25th of the calendar month → previous month.
 *   - On/after the 25th                      → current month.
 * Example: 24 Apr → { month: 3, year: 2026 }; 25 Apr → { month: 4, year: 2026 }.
 */
export const defaultReportingMonth = (now = new Date()) => {
    let m = now.getMonth() + 1;   // 1..12
    let y = now.getFullYear();
    if (now.getDate() < 25) {
        m -= 1;
        if (m === 0) { m = 12; y -= 1; }
    }
    return { month: m, year: y };
};
