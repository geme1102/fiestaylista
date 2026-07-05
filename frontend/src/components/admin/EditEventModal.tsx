import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { EventType } from '../../types';

const EVENT_TYPES: { value: EventType; icon: string; label: string }[] = [
  { value: 'BABY_SHOWER', icon: '🍼', label: 'Baby Shower' },
  { value: 'WEDDING', icon: '💍', label: 'Boda' },
  { value: 'BIRTHDAY', icon: '🎂', label: 'Cumpleaños' },
  { value: 'BAPTISM', icon: '🕊️', label: 'Bautizo' },
  { value: 'COMMUNION', icon: '✨', label: 'Comunión' },
  { value: 'OTHER', icon: '🎊', label: 'Otro' },
  { value: 'HOUSE_WARMING', icon: '🏠', label: 'Casa Shower' },
];

interface EditEventModalProps {
  open: boolean;
  titleDraft: string;
  typeDraft: EventType;
  dateDraft: string;
  locationDraft: string;
  noteDraft: string;
  updatingDetails: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onTitleChange: (v: string) => void;
  onTypeChange: (v: EventType) => void;
  onDateChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EditEventModal({
  open, titleDraft, typeDraft, dateDraft, locationDraft, noteDraft,
  updatingDetails, dialogRef, onTitleChange, onTypeChange, onDateChange,
  onLocationChange, onNoteChange, onSave, onClose,
}: EditEventModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Editar información del evento"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface rounded-[32px] max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-gray-100 flex flex-col gap-5 relative"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-pink-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-center justify-between pb-3.5 border-b border-gray-200">
              <div className="flex items-center gap-1.5 text-left">
                <span className="text-xl">✨</span>
                <h4 className="text-lg font-black text-gray-900 tracking-tight">Editar Información de Evento</h4>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                data-testid="close-edit-modal"
                className="p-2.5 text-gray-400 hover:text-gray-800 hover:bg-gray-50 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); onSave(); }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nombre del evento</label>
                <input
                  id="edit-title"
                  type="text"
                  value={titleDraft}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold"
                  autoComplete="off"
                  enterKeyHint="next"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tipo de evento</label>
                  <select
                    id="edit-type"
                    value={typeDraft}
                    onChange={(e) => onTypeChange(e.target.value as EventType)}
                    className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold text-gray-700 select-custom"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fecha y Hora</label>
                  <input
                    id="edit-date"
                    type="datetime-local"
                    value={dateDraft}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold text-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Lugar del evento</label>
                <input
                  id="edit-location"
                  type="text"
                  value={locationDraft}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold text-gray-700"
                  placeholder="Ej: Salón de eventos, Ciudad"
                  autoComplete="street-address"
                  inputMode="text"
                  enterKeyHint="next"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notas para invitados</label>
                <textarea
                  id="edit-note"
                  value={noteDraft}
                  onChange={(e) => onNoteChange(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-semibold text-gray-700 resize-none"
                  placeholder="Ej: No se aceptan regalos envueltos"
                />
              </div>

              <div className="flex justify-end gap-3.5 pt-4 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Salir sin guardar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  data-testid="save-event-changes"
                  disabled={updatingDetails}
                  className="bg-primary hover:bg-primary text-white px-6 py-3.5 rounded-full text-xs font-black tracking-wide shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingDetails ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Guardar Cambios'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
