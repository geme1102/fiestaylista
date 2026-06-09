import { useFocusTrap } from '../hooks/useFocusTrap';
import { cn } from '../utils/cn';

export function ConfirmModal({ message, onConfirm, onClose, loading, confirmLabel = 'Eliminar', destructive = true }: {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const dialogRef = useFocusTrap(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-2xl text-center animate-zoom-in"
      >
        {destructive && (
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
            <span className="material-symbols-outlined text-4xl" aria-hidden="true">warning</span>
          </div>
        )}
        <h2 id="confirm-title" className="text-lg font-bold text-on-surface mb-2">¿Estás seguro?</h2>
        <p className="text-sm text-on-surface-variant mb-8">{message}</p>
        <div className="flex gap-3">
          <button data-dialog-close onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-on-surface-variant border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className={cn(
            'flex-1 py-3 min-h-[44px] text-sm font-bold text-white rounded-xl transition-all disabled:opacity-50',
            destructive
              ? 'bg-red-500 hover:opacity-90 shadow-lg shadow-red-500/20'
              : 'bg-gradient-to-r from-primary to-primary-container hover:shadow-lg',
          )}>
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
