export default function Table({ columns = [], rows = [], empty = 'ไม่มีข้อมูล' }) {
    return (
        <div className="overflow-x-auto ui-card">
            <table className="min-w-full text-sm">
                <thead className="bg-cream-2 text-ink-3">
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className="text-left font-bold uppercase tracking-wider text-[11px] px-4 py-3.5 border-b border-[color:var(--border)]">
                                {c.title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="text-center text-ink-4 py-8">{empty}</td>
                        </tr>
                    )}
                    {rows.map((row, idx) => (
                        <tr key={row.id || idx} className="border-t border-[color:var(--border)] hover:bg-cream-surface text-ink-2">
                            {columns.map((c) => (
                                <td key={c.key} className="px-4 py-3.5">
                                    {typeof c.render === 'function' ? c.render(row) : row[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
