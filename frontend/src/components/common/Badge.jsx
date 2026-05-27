const STYLES = {
    occupied:    'bg-cyan-soft text-[#0e7490]',
    vacant:      'bg-cream-2 text-ink-2',
    maintenance: 'bg-orange-soft text-[#b45309]',
    common:      'bg-mint-soft text-[#0f766e]',
    caretaker:   'bg-violet-soft text-[#6d28d9]',
    default:     'bg-cream-2 text-ink-2',
};
const LABELS = {
    occupied: 'มีผู้เช่า', vacant: 'ว่าง', maintenance: 'ซ่อมบำรุง',
    common: 'พื้นที่ส่วนกลาง', caretaker: 'ผู้ดูแล',
};

export default function Badge({ status, children }) {
    const cls = STYLES[status] || STYLES.default;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
            {children || LABELS[status] || status}
        </span>
    );
}
