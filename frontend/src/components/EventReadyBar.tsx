import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';

export interface SetupChecklist {
  hasGifts: boolean;
  hasThreeGifts: boolean;
  hasDate: boolean;
  hasLocation: boolean;
  hasNote: boolean;
  hasPhotos: boolean;
  hasCashFund: boolean;
  hasRsvp: boolean;
  hasBeenShared: boolean;
}

interface ChecklistItem {
  key: keyof SetupChecklist;
  label: string;
  icon: string;
  weight: number;
  hint: string;
}

const ITEMS: ChecklistItem[] = [
  { key: 'hasGifts', label: 'Primer regalo', icon: 'redeem', weight: 15, hint: 'Añade al menos 1 regalo' },
  { key: 'hasThreeGifts', label: 'Lista completa', icon: 'checklist', weight: 10, hint: 'Añade 3+ regalos' },
  { key: 'hasDate', label: 'Fecha del evento', icon: 'event', weight: 15, hint: 'Define cuándo es' },
  { key: 'hasLocation', label: 'Lugar', icon: 'location_on', weight: 10, hint: 'Dónde se celebra' },
  { key: 'hasNote', label: 'Nota de bienvenida', icon: 'sticky_note_2', weight: 10, hint: 'Saludo para tus invitados' },
  { key: 'hasPhotos', label: 'Foto del álbum', icon: 'photo_camera', weight: 10, hint: 'Sube 1+ fotos' },
  { key: 'hasCashFund', label: 'Lluvia de Sobres', icon: 'savings', weight: 10, hint: 'Activa el fondo monetario' },
  { key: 'hasRsvp', label: '1ª confirmación', icon: 'how_to_reg', weight: 10, hint: 'Alguien confirma asistencia' },
  { key: 'hasBeenShared', label: 'Enlace compartido', icon: 'share', weight: 10, hint: 'Comparte con tus invitados' },
];

export function getSetupProgress(checklist: SetupChecklist): { percent: number; completed: number; total: number; next: ChecklistItem | null } {
  let percent = 0;
  let completed = 0;
  let next: ChecklistItem | null = null;
  for (const item of ITEMS) {
    if (checklist[item.key]) {
      percent += item.weight;
      completed++;
    } else if (!next) {
      next = item;
    }
  }
  return { percent: Math.min(percent, 100), completed, total: ITEMS.length, next };
}

export const EventReadyBar = memo(function EventReadyBar({
  checklist,
  onAction,
}: {
  checklist: SetupChecklist;
  onAction?: (hint: string) => void;
}) {
  const { percent, completed, total, next } = useMemo(() => getSetupProgress(checklist), [checklist]);
  const isComplete = percent >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card-premium p-5 rounded-2xl border',
        isComplete ? 'border-emerald-300/50' : 'border-outline-variant/50',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl" style={{ color: isComplete ? '#10b981' : 'var(--color-primary)' }}>
            {isComplete ? 'verified' : 'rocket_launch'}
          </span>
          <h3 className="text-sm font-bold text-on-surface">
            {isComplete ? '¡Evento listo! 🎉' : 'Progreso del evento'}
          </h3>
        </div>
        <span className={cn(
          'text-lg font-extrabold tabular-nums',
          isComplete ? 'text-emerald-600' : 'text-primary',
        )}>
          {percent}%
        </span>
      </div>

      <div className="relative h-3 bg-surface-container-high rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className={cn(
            'h-full rounded-full relative',
            isComplete
              ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
              : 'bg-gradient-to-r from-primary to-primary-container',
          )}
        >
          <div className="absolute inset-0 animate-card-shine rounded-full" />
        </motion.div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {ITEMS.map((item) => {
          const done = checklist[item.key];
          return (
            <button
              key={item.key}
              onClick={() => !done && onAction?.(item.hint)}
              disabled={done}
              className={cn(
                'touch-compact inline-flex items-center gap-1 px-2 py-1 min-h-[44px] rounded-full text-[11px] font-semibold transition-all',
                done
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-surface-container-low text-on-surface-variant/60 border border-outline-variant hover:border-primary/30 hover:text-primary cursor-pointer',
              )}
              title={done ? `Completo: ${item.label}` : `Falta: ${item.hint}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {done ? 'check_circle' : item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {!isComplete && next && (
          <motion.p
            key={next.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-on-surface-variant mt-3 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-primary">tips_and_updates</span>
            Siguiente paso: <span className="font-bold text-on-surface">{next.hint}</span>
          </motion.p>
        )}
        {isComplete && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-emerald-600 mt-3 flex items-center gap-1.5 font-medium"
          >
            <span className="material-symbols-outlined text-sm">celebration</span>
            ¡Tu evento está al 100%! Compártelo con tus invitados.
          </motion.p>
        )}
      </AnimatePresence>

      <span className="sr-only">{completed} de {total} pasos completados</span>
    </motion.div>
  );
});
