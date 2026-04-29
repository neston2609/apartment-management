import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ open, title, onClose, children, footer }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto">{children}</div>
                {footer && (
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
