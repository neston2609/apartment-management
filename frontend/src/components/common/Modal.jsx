import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ open, title, onClose, children, footer }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[20px] shadow-soft-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-[color:var(--border)]">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[color:var(--border)]">
                    <h3 className="font-display font-bold text-ink">{title}</h3>
                    <button onClick={onClose} className="text-ink-3 hover:text-ink">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto">{children}</div>
                {footer && (
                    <div className="px-5 py-3 border-t border-[color:var(--border)] bg-cream-surface flex justify-end gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
