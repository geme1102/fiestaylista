import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { createEvent } from '../services/events';
import { EVENT_ICONS, EVENT_LABELS, type EventType } from '../types';
import { showToast } from '../hooks/useToast';

const EVENT_TYPES: { value: EventType; icon: string; label: string }[] = [
  { value: 'BABY_SHOWER', icon: '🍼', label: 'Baby Shower' },
  { value: 'WEDDING', icon: '💍', label: 'Boda' },
  { value: 'BIRTHDAY', icon: '🎂', label: 'Cumpleaños' },
  { value: 'BAPTISM', icon: '🕊️', label: 'Bautizo' },
  { value: 'COMMUNION', icon: '✨', label: 'Comunión' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState<EventType>('BABY_SHOWER');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleFinish = async () => {
    if (!title.trim()) {
      showToast('Ingresa un nombre para tu evento', 'error');
      return;
    }
    setCreating(true);
    try {
      await createEvent({ title: title.trim(), eventType });
      navigate('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear evento', 'error');
      setCreating(false);
    }
  };

  const skip = () => navigate('/dashboard');

  const stepImages: Record<number, string> = {
    1: '/illustrations/onboarding-1.png',
    2: '/illustrations/onboarding-2.png',
    3: '/illustrations/onboarding-3.png',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-8">
              {step <= 2 && (
                <img
                  src={stepImages[step]}
                  alt=""
                  loading="lazy"
                  className="w-48 h-48 mx-auto mb-6"
                />
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {step === 1 ? '¿Qué tipo de evento?' : step === 2 ? '¿Cómo se llama tu evento?' : '¡Todo listo!'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {step === 1 ? 'Elige el tipo de evento que quieres organizar' : step === 2 ? 'Dale un nombre a tu lista de regalos' : 'Revisa los detalles y empieza'}
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <motion.div
                  key={s}
                  className={`w-3 h-3 rounded-full ${step >= s ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  animate={{ scale: step === s ? 1.3 : 1 }}
                />
              ))}
            </div>

            {step === 1 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EVENT_TYPES.map((t) => (
                  <motion.button
                    key={t.value}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setEventType(t.value); setStep(2); }}
                    className={`flex flex-col items-center gap-2 p-6 rounded-2xl border-2 transition-all min-h-[120px] ${
                      eventType === t.value
                        ? 'border-pink-500 bg-pink-50/50 dark:bg-pink-900/10 ring-2 ring-pink-500'
                        : 'border-gray-200 dark:border-gray-700 glass-card-premium'
                    }`}
                  >
                    <span className="text-3xl">{t.icon}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.label}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="rounded-2xl p-8 glass-card-premium">
                <div className="text-center mb-6">
                  <span className="text-5xl">{EVENT_ICONS[eventType]}</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{EVENT_LABELS[eventType]}</p>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none text-center text-lg"
                  placeholder={`Ej: ${EVENT_LABELS[eventType]} de ${user?.name || 'María'}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!title.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px]"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="rounded-2xl p-8 text-center glass-card-premium">
                <span className="text-5xl block mb-4">{EVENT_ICONS[eventType]}</span>
                <p className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{EVENT_LABELS[eventType]}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={creating}
                    className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                  >
                    {creating ? (
                      <video src="/animations/gift-loading.mp4" autoPlay loop muted playsInline className="h-6 w-6" />
                    ) : (
                      'Crear mi primer evento'
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="text-center mt-6">
          <button
            onClick={skip}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Saltar este paso
          </button>
        </div>
      </div>
    </div>
  );
}
