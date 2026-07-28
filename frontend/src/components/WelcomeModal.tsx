import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Sheet from './ui/Sheet';

interface WelcomeModalProps {
  open: boolean;
  hasEvents: boolean;
  onCreateEvent: () => void;
  onClose: () => void;
}

const STEPS = [
  {
    icon: 'calendar_add_on',
    title: 'Crea tu evento',
    body: 'Desde tu panel de control, crea tu lista de regalos en menos de 1 minuto. Elige el tipo de evento y configúralo a tu gusto.',
  },
  {
    icon: 'auto_awesome',
    title: 'Personaliza la experiencia',
    body: 'Tus invitados recibirán una invitación interactiva con un sobre virtual que se abre con un efecto WOW. ¡Les va a encantar!',
  },
  {
    icon: 'forum',
    title: 'Comparte y controla',
    body: 'Envía tu enlace por WhatsApp. Tus invitados apartan regalos sin registrarse. Tú ves las confirmaciones en tiempo real.',
  },
];

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-primary' : 'w-1.5 bg-on-surface-variant/30'}`}
        />
      ))}
    </div>
  );
}

function StepIcon({ icon, index, reduceMotion }: { icon: string; index: number; reduceMotion: boolean }) {
  const gradients = [
    'from-[#f43f5e] to-[#fb7185]',
    'from-[#a855f7] to-[#c084fc]',
    'from-[#14b8a6] to-[#2dd4bf]',
  ];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { scale: 0, rotate: -20 }}
      animate={reduceMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradients[index]} flex items-center justify-center shadow-lg`}
    >
      <span className="material-symbols-outlined text-3xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
    </motion.div>
  );
}

export function WelcomeModal({ open, hasEvents, onCreateEvent, onClose }: WelcomeModalProps) {
  const [currentStep, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const isLast = currentStep === STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) return;
    setDirection(1);
    setStep((s) => s + 1);
  }, [isLast]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleFinish = useCallback(() => {
    if (!hasEvents) onCreateEvent();
    onClose();
  }, [hasEvents, onCreateEvent, onClose]);

  const slideVariants = shouldReduceMotion ? {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  } : {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  const stepData = STEPS[currentStep];

  return (
    <Sheet open={open} onClose={handleSkip} ariaLabel="Introducción a la aplicación" className="p-8 pb-safe-lg sm:p-10">
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant/50 hover:text-on-surface-variant rounded-full hover:bg-surface-container-high transition-colors"
        aria-label="Cerrar introducción"
      >
        <span className="material-symbols-outlined text-xl">close</span>
      </button>

      <div className="flex flex-col items-center text-center min-h-[300px] sm:min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col items-center"
          >
            <StepIcon icon={stepData.icon} index={currentStep} reduceMotion={shouldReduceMotion ?? false} />
            <h2 className="text-xl font-bold text-on-surface font-outfit mt-6 mb-3">
              {stepData.title}
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs">
              {stepData.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-outline-variant/20">
        <button
          onClick={handleSkip}
          className="text-xs font-semibold text-on-surface-variant/50 hover:text-on-surface-variant transition-colors px-2 py-2 min-h-[44px]"
        >
          Saltar introducción
        </button>

        <div className="flex items-center gap-4">
          <Dots total={STEPS.length} current={currentStep} />

          {!isLast ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 min-h-[44px] bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-shadow"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 min-h-[44px] bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-shadow"
            >
              {hasEvents ? '¡Empezar a explorar!' : 'Crear mi primer evento'}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
