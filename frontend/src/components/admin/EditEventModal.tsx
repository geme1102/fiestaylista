import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Sheet from '../ui/Sheet';
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
  updatingDetails, onTitleChange, onTypeChange, onDateChange,
  onLocationChange, onNoteChange, onSave, onClose,
}: EditEventModalProps) {
  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Editar información del evento" className="p-6 md:p-8">
      <div className="flex items-center justify-between pb-3.5 border-b border-gray-200">
        <div className="flex items-center gap-1.5 text-left">
          <span className="text-xl">✨</span>
          <h3 className="text-lg font-black text-gray-900 tracking-tight">Editar Información de Evento</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          data-testid="close-edit-modal"
          className="p-2.5 min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-gray-800 hover:bg-gray-50 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSave(); }}
        className="space-y-4 text-left mt-5"
      >
        <div>
          <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Nombre del evento</label>
          <input
            id="edit-title"
            type="text"
            value={titleDraft}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold"
            autoComplete="off"
            enterKeyHint="next"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Tipo de evento</label>
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
            <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Fecha y Hora</label>
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
          <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Lugar del evento</label>
          <input
            id="edit-location"
            type="text"
            value={locationDraft}
            onChange={(e) => onLocationChange(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-bold text-gray-700"
            placeholder="Ej: Salón de eventos, Ciudad"
            autoComplete="street-address"
            inputMode="text"
            enterKeyHint="next"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Notas para invitados</label>
          <textarea
            id="edit-note"
            value={noteDraft}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full border border-gray-200 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-white font-semibold text-gray-700 resize-none"
            placeholder="Ej: No se aceptan regalos envueltos"
          />
        </div>

        <div className="flex justify-end gap-3.5 pt-4 border-t border-gray-200 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 text-xs font-bold text-on-surface-variant hover:text-gray-800 cursor-pointer min-h-[44px]"
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
            {updatingDetails ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Guardar cambios'}
          </motion.button>
        </div>
      </form>
    </Sheet>
  );
}
