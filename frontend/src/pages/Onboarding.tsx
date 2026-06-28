import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { createEvent } from '../services/events';
import { type EventType } from '../types';
import { showToast } from '../hooks/useToast';

const EVENT_TYPES: { value: EventType; icon: string; label: string }[] = [
  { value: 'WEDDING', icon: '💍', label: 'Boda' },
  { value: 'BABY_SHOWER', icon: '🍼', label: 'Baby Shower' },
  { value: 'BIRTHDAY', icon: '🎂', label: 'Cumpleaños' },
  { value: 'BAPTISM', icon: '⛪', label: 'Bautizo' },
  { value: 'COMMUNION', icon: '🕊️', label: 'Primera Comunión' },
  { value: 'OTHER', icon: '✨', label: 'Otro' },
  { value: 'HOUSE_WARMING', icon: '🏠', label: 'Casa Shower' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState<EventType>('WEDDING');
  const [title, setTitle] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('💍');
  const [selectedLabel, setSelectedLabel] = useState('Boda');

  const handleFinish = async () => {
    if (!title.trim()) {
      showToast('Ingresa un nombre para tu evento', 'error');
      return;
    }
    setCreating(true);
    try {
      await createEvent({ title: title.trim(), eventType, eventNote: eventNote.trim() || undefined });
      navigate('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear evento', 'error');
      setCreating(false);
    }
  };

  const skip = () => navigate('/dashboard');

  const nextStep = (s: number) => {
    if (s === 3) {
      handleFinish();
      return;
    }
    setStep(s);
  };

  const prevStep = (s: number) => {
    setStep(s);
  };

  const selectEventType = (t: typeof EVENT_TYPES[0]) => {
    setEventType(t.value);
    setSelectedIcon(t.icon);
    setSelectedLabel(t.label);
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface overflow-hidden"
    >
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-gutter py-4 bg-transparent">
        <div className="flex items-center gap-2">
          <h1 className="font-display-lg text-display-lg text-primary">Fiesta y Lista</h1>
        </div>
        <button
          onClick={() => { if (window.confirm('¿Salir del asistente? Puedes crear tu primer evento desde el panel principal.')) skip(); }}
          className="material-symbols-outlined text-primary hover:opacity-80 transition-opacity active:scale-90 transition-transform p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Salir del asistente"
        >
          close
        </button>
      </header>

      {/* Wizard Content */}
      <main className="relative w-full min-h-[100dvh] overflow-y-auto" id="wizard-container">
        {/* Step 1: Event Type */}
        <motion.section
          className="absolute inset-0 flex flex-col items-center justify-center px-container-margin pt-20 pb-32"
          initial={false}
          animate={{ x: step === 1 ? '0%' : '-100%' }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="text-center mb-4">
                <span className="text-5xl">🎉</span>
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Paso 1 de 2</span>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 mt-2">¿Qué tipo de evento?</h2>
              <p className="text-on-surface-variant font-body-md">Selecciona la ocasión que vamos a celebrar.</p>
            </div>
            <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-label="Tipo de evento">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={eventType === t.value}
                  onClick={() => selectEventType(t)}
                  className={`p-6 rounded-xl flex flex-col items-center gap-3 transition-all duration-300 hover:scale-[1.02] border-2 ${
                    eventType === t.value
                      ? 'border-primary ring-2 ring-primary/20 bg-white/60'
                      : 'border-transparent'
                  }`}
                  style={{
                    background: 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: eventType === t.value ? '2px solid #b10e6b' : '2px solid transparent',
                  }}
                >
                  <span className="text-3xl">{t.icon}</span>
                  <span className="font-label-md text-label-md">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => nextStep(2)}
                className="primary-gradient text-on-primary px-8 py-3 rounded-full font-label-md text-label-md shadow-lg shadow-rose-500/20 flex items-center gap-2 hover:opacity-90 transition-all active:scale-90"
              >
                Continuar
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </motion.section>

        {/* Step 2: Event Name + Create (merged with old step 3) */}
        <motion.section
          className="absolute inset-0 flex flex-col items-center justify-center px-container-margin pt-20 pb-32"
          initial={false}
          animate={{ x: step === 2 ? '0%' : step < 2 ? '100%' : '-100%' }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Paso 2 de 2</span>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 mt-2">¿Cómo se llama tu evento?</h2>
              <p className="text-on-surface-variant font-body-md">Dale un nombre especial a tu lista de regalos.</p>
            </div>

            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${selectedLabel} de ${user?.name || 'María'}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
              className="w-full bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-center font-display-lg text-headline-lg py-4 placeholder:text-surface-variant transition-colors outline-none mb-8"
            />

            <textarea
              id="event-note"
              value={eventNote}
              onChange={(e) => setEventNote(e.target.value)}
              placeholder="Escribe las palabras de bienvenida para tu evento — será lo primero que vean tus invitados al abrir la tarjeta"
              rows={3}
              maxLength={500}
              className="w-full bg-surface-container-high rounded-2xl p-4 text-sm text-on-surface font-medium placeholder:text-on-surface-variant/50 resize-none outline-none focus:ring-2 focus:ring-primary/30 transition-all mb-8 border border-transparent focus:border-primary/20"
            />

            {/* Summary preview card (was step 3) */}
            <div
              className="rounded-2xl p-6 mb-8 border border-white/40 shadow-xl shadow-rose-500/5 relative overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="flex flex-col items-center text-center gap-3 relative z-10">
                <div className="w-16 h-16 bg-primary-fixed flex items-center justify-center rounded-full text-3xl shadow-inner">
                  <span>{selectedIcon}</span>
                </div>
                <div>
                  <p className="text-on-surface-variant font-caption text-caption uppercase tracking-widest mb-1">
                    TU {selectedLabel.toUpperCase()}
                  </p>
                  <h3 className="font-headline-md text-headline-md text-primary">{title || `${selectedLabel} de ${user?.name || 'María'}`}</h3>
                </div>
                <div className="w-full h-px bg-outline-variant/30 my-1" />
                <p className="text-xs text-on-surface-variant px-2 font-medium">
                  Próximos pasos: agrega los regalos, comparte el enlace por WhatsApp y tus invitados empezarán a apartar.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button onClick={() => prevStep(1)} className="px-6 py-3 text-on-surface-variant font-label-md text-label-md hover:bg-white/10 rounded-full transition-all">
                Atrás
              </button>
              <button
                onClick={handleFinish}
                disabled={creating || !title.trim()}
                className="primary-gradient text-on-primary px-10 py-3 rounded-full font-label-md text-label-md shadow-lg shadow-rose-500/20 hover:opacity-90 transition-all active:scale-90 disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
              >
                {creating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Crear mi {selectedLabel.toLowerCase()}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-center mt-4">
              <button onClick={skip} disabled={creating} className="text-xs text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 underline py-2.5 min-h-[44px]">
                Saltar este paso
              </button>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Dots Indicator */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-center gap-4 items-center pb-8 pt-4 bg-surface/10 backdrop-blur-xl border-t border-white/20 shadow-rose-500/20 shadow-lg rounded-t-xl">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              step === s
                ? 'bg-primary-container p-2 scale-125'
                : 'bg-on-surface-variant/20 p-2'
            }`}
          />
        ))}
      </nav>
    </div>
  );
}
