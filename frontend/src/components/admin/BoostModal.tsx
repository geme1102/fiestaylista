import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

interface BoostModalProps {
  open: boolean;
  loading: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BoostModal({ loading, dialogRef, onConfirm, onClose }: BoostModalProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Activar Lluvia de Sobres"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70] [overscroll-behavior:contain]"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
        className="bg-surface rounded-[36px] max-w-md w-full p-6 md:p-8 shadow-2xl border border-orange-100 flex flex-col gap-4 text-center relative overflow-hidden"
      >
        <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-amber-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-700 rounded-3xl flex items-center justify-center mx-auto text-white text-3xl shadow-md border border-amber-200/50">
          ⚡
        </div>

        <h4 className="text-xl font-black text-[#93400e] tracking-tight">
          Activar Lluvia de Sobres
        </h4>
        <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed font-semibold">
          <strong>Gratuito — sin costo.</strong> Tus invitados podrán enviarte dinero directo a tu cuenta bancaria. Válido por 30 días.
        </p>

        <div className="bg-amber-50/70 p-[18px] rounded-2xl border border-amber-200/50 text-left space-y-2.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
            <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
            <span>Cada invitado transfiere directo a tu cuenta</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
            <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
            <span>Ellos registran su aporte y aparece en la lista</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
            <Check className="w-4 h-4 text-amber-700 font-extrabold shrink-0" />
            <span>Llevas el control de lo que recibes</span>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant font-semibold">Sin comisiones. La app solo muestra los aportes que los invitados registran voluntariamente.</p>

        <div className="flex flex-col gap-2.5 mt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="pay-boost-button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full bg-[#994715] hover:bg-[#833e12] text-white py-3.5 rounded-full text-xs font-black tracking-wider uppercase btn-gpu shadow-md cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#994715]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'ACTIVAR GRATIS'}
          </motion.button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full bg-transparent text-on-surface-variant hover:text-gray-700 text-xs py-3 font-extrabold cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            Ahora no, gracias
          </button>
        </div>
      </motion.div>
    </div>
  );
}
