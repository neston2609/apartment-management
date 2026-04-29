export default function Table({ columns = [], rows = [], empty = 'ไม่มีข้อมูล' }) {
    return (
        <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className="text-left font-medium px-4 py-2 border-b border-slate-200">
                                {c.title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="text-center text-slate-400 py-6">{empty}</td>
                        </tr>
                    )}
                    {rows.map((row, idx) => (
                        <tr key={row.id || idx} className="border-t border-slate-100 hover:bg-slate-50">
                            {columns.map((c) => (
                                <td key={c.key} className="px-4 py-2">
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
