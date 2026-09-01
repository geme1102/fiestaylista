import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '../services/api';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import { Button } from '../components/ui/Button';
import { reportError } from '../lib/reportError';

interface RsvpFormProps {
  eventId: string;
  eventTitle: string;
  guestName: string;
}

export default function RsvpForm({ eventId, guestName }: RsvpFormProps) {
  const storageKey = `rsvp_confirmed:${eventId}`;
  // B8: draft de acompañantes + mensaje sobrevive a recargas (un RSVP medio
  // escrito no se pierde). Se limpia al confirmar.
  const DRAFT_KEY = `fy_rsvp_draft:${eventId}`;
  const [draft] = useState<{ companions: number; message: string }>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            companions: typeof parsed.companions === 'number' ? parsed.companions : 0,
            message: typeof parsed.message === 'string' ? parsed.message : '',
          };
        }
      }
    } catch {}
    return { companions: 0, message: '' };
  });
  const [companions, setCompanions] = useState(draft.companions);
  const [message, setMessage] = useState(draft.message);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const { containerRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!guestName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    let token = turnstileTokenRef.current;
    try {
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }

      await apiClient.post(`/api/events/${eventId}/rsvp`, {
        name: guestName.trim(),
        companions,
        message: message.trim() || undefined,
        turnstileToken: token ?? undefined,
      });
      setConfirmed(true);
      setShowForm(false);
      resetTurnstile();
      try { localStorage.setItem(storageKey, 'true'); } catch {}
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (err) {
      reportError(err, { source: 'RsvpForm' });
      setError(err instanceof Error ? err.message : 'Error al confirmar asistencia');
    } finally {
      submittingRef.current = false;
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
        aria-expanded={showForm}
        aria-controls="rsvp-form-panel"
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

      <div id="rsvp-form-panel" className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${showForm ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <form
            onSubmit={handleSubmit}
          >
            <div className="p-5 mt-2 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-4">
              <div>
                <label htmlFor="rsvp-companions" className="block text-sm font-semibold text-on-surface mb-1">
                  Acompañantes {companions > 0 && <span className="text-on-surface-variant font-normal">({companions} {companions === 1 ? 'persona' : 'personas'})</span>}
                </label>
                <input
                  id="rsvp-companions"
                  type="range"
                  min={0}
                  max={10}
                  value={companions}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setCompanions(value);
                    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ companions: value, message })); } catch {}
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                  <span>0</span>
                  <span>10+</span>
                </div>
              </div>

              <div>
                <label htmlFor="rsvp-message" className="block text-sm font-semibold text-on-surface mb-1">Mensaje para el anfitrión (opcional)</label>
                <textarea
                  id="rsvp-message"
                  value={message}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMessage(value);
                    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ companions, message: value })); } catch {}
                  }}
                  maxLength={500}
                  className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow] resize-none"
                  placeholder="¡Felicidades! Nos vemos allí 🎉"
                  rows={2}
                />
              </div>

              <div ref={containerRef} />

              {error && (
                <p id="rsvp-error" role="alert" className="text-xs text-error font-medium">{error}</p>
              )}

              <Button variant="primary" fullWidth loading={submitting} type="submit" disabled={!guestName.trim() || submitting} aria-describedby={error ? 'rsvp-error' : undefined}>
                {submitting ? 'Confirmando...' : 'Confirmar asistencia'}
              </Button>
              {!guestName.trim() && (
                <p className="text-xs text-on-surface-variant text-center">Escribe tu nombre arriba para confirmar tu asistencia.</p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
