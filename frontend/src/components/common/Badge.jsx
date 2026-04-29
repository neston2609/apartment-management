const STYLES = {
    occupied:    'bg-green-100 text-green-800',
    vacant:      'bg-slate-100 text-slate-700',
    maintenance: 'bg-yellow-100 text-yellow-800',
    common:      'bg-blue-100 text-blue-800',
    caretaker:   'bg-purple-100 text-purple-800',
    default:     'bg-slate-100 text-slate-700',
};
const LABELS = {
    occupied: 'มีผู้เช่า', vacant: 'ว่าง', maintenance: 'ซ่อมบำรุง',
    common: 'พื้นที่ส่วนกลาง', caretaker: 'ผู้ดูแล',
};

export default function Badge({ status, children }) {
    const cls = STYLES[status] || STYLES.default;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
            {children || LABELS[status] || status}
        </span>
    );
}
