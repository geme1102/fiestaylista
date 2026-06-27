import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';

interface RsvpFormProps {
  eventId: string;
  eventTitle: string;
  guestName: string;
}

export default function RsvpForm({ eventId, guestName }: RsvpFormProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companions, setCompanions] = useState(0);
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/api/events/${eventId}/rsvp`, {
        name: guestName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        companions,
        dietaryRestrictions: dietaryRestrictions.trim() || undefined,
        message: message.trim() || undefined,
      });
      setConfirmed(true);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar asistencia');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-200/50 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <div>
          <p className="font-bold text-emerald-800 text-sm">¡Asistencia confirmada!</p>
          <p className="text-emerald-600 text-xs mt-0.5">Ya puedes apartar tus regalos aquí abajo.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div ref={formRef} className="mb-8">
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full p-4 rounded-2xl border border-dashed border-outline-variant/50 flex items-center justify-between gap-3 hover:border-primary/50 hover:bg-primary-fixed/20 transition-all min-h-[56px] group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
          <span className="font-semibold text-sm text-on-surface-variant group-hover:text-primary transition-colors">
            {showForm ? 'Cerrar confirmación de asistencia' : '💌 ¿Vienes? Confirma tu asistencia'}
          </span>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${showForm ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="overflow-hidden"
          >
            <div className="p-5 mt-2 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-4">
              <div>
                <label htmlFor="rsvp-name" className="block text-sm font-semibold text-on-surface mb-1">Tu nombre *</label>
                <input
                  id="rsvp-name"
                  type="text"
                  value={guestName}
                  readOnly
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-high text-on-surface/70 px-4 py-3 text-sm outline-none cursor-default"
                  placeholder="Ej: María Pérez"
                  autoComplete="name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rsvp-email" className="block text-sm font-semibold text-on-surface mb-1">Email (opcional)</label>
                  <input
                    id="rsvp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="maria@ejemplo.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="rsvp-phone" className="block text-sm font-semibold text-on-surface mb-1">Celular (opcional)</label>
                  <input
                    id="rsvp-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="+57 300 000 0000"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rsvp-companions" className="block text-sm font-semibold text-on-surface mb-1">
                  Acompañantes {companions > 0 && <span className="text-on-surface-variant/70 font-normal">({companions} {companions === 1 ? 'persona' : 'personas'})</span>}
                </label>
                <input
                  id="rsvp-companions"
                  type="range"
                  min={0}
                  max={10}
                  value={companions}
                  onChange={(e) => setCompanions(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-on-surface-variant/60 mt-1">
                  <span>0</span>
                  <span>10+</span>
                </div>
              </div>

              <div>
                <label htmlFor="rsvp-diet" className="block text-sm font-semibold text-on-surface mb-1">Restricciones alimentarias (opcional)</label>
                <input
                  id="rsvp-diet"
                  type="text"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej: Vegetariano, alergia al maní..."
                />
              </div>

              <div>
                <label htmlFor="rsvp-message" className="block text-sm font-semibold text-on-surface mb-1">Mensaje para el anfitrión (opcional)</label>
                <textarea
                  id="rsvp-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="¡Felicidades! Nos vemos allí 🎉"
                  rows={2}
                />
              </div>

              {error && (
                <p className="text-xs text-error font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !guestName.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center"
              >
                {submitting ? (
                  <span className="block w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  'Confirmar asistencia'
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
