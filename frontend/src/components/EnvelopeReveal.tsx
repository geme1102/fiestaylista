import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaxSeal } from './WaxSeal';

interface EnvelopeRevealProps {
  guestName: string;
  eventEmoji: string;
  onComplete: () => void;
  confettiBurst: () => void;
}

type Phase = 'entering' | 'waiting' | 'breaking' | 'card' | 'expanding' | 'done';

export function EnvelopeReveal({
  guestName,
  eventEmoji,
  onComplete,
  confettiBurst,
}: EnvelopeRevealProps) {
  const [phase, setPhase] = useState<Phase>('entering');
  const [showMiniCard, setShowMiniCard] = useState(false);
  const [envelopeOpacity, setEnvelopeOpacity] = useState(1);
  const [envelopeBlur, setEnvelopeBlur] = useState(0);
  const [miniCardScale, setMiniCardScale] = useState(1);
  const [miniCardOpacity, setMiniCardOpacity] = useState(1);
  const [backdropVisible, setBackdropVisible] = useState(true);
  const expandingCardRef = useRef(false);
  const hasCompleted = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // Phase transitions
  useEffect(() => {
    if (phase !== 'entering') return;
    const t = setTimeout(() => setPhase('waiting'), 600);
    return () => clearTimeout(t);
  }, [phase]);

  const cleanup = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    setBackdropVisible(false);
    setPhase('done');
    onComplete();
  }, [onComplete]);

  const skip = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const handleSealClick = useCallback(() => {
    if (phase !== 'waiting') return;
    setPhase('breaking');

    timersRef.current.push(setTimeout(() => {
      setShowMiniCard(true);
      confettiBurst();
    }, 800));

    timersRef.current.push(setTimeout(() => {
      setPhase('card');
    }, 1200));
  }, [phase, confettiBurst]);

  const handleMiniCardClick = useCallback(() => {
    if (expandingCardRef.current) return;
    expandingCardRef.current = true;

    setPhase('expanding');
    setMiniCardScale(1.05);
    setMiniCardOpacity(0);

    timersRef.current.push(setTimeout(() => setEnvelopeOpacity(0), 100));
    timersRef.current.push(setTimeout(() => setEnvelopeBlur(12), 100));
    timersRef.current.push(setTimeout(() => cleanup(), 600));
  }, [cleanup]);

  const displayName = guestName || 'ti';
  const hasName = !!guestName;

  return (
    <AnimatePresence>
      {backdropVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/92 select-none"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{
              scale: envelopeBlur > 0 ? 0.88 : 1,
              opacity: envelopeOpacity,
              filter: `blur(${envelopeBlur}px)`,
            }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-[290px] sm:w-[320px]"
            style={{ minHeight: 400 }}
          >
            {/* Envelope scene with 3D perspective */}
            <div className="perspective-[1200px]">
              <div className="transform-3d relative" style={{ transformStyle: 'preserve-3d' }}>
                {/* Envelope interior (visible when flap opens) */}
                <div
                  className="absolute top-0 left-0 w-full rounded-t-2xl bg-gradient-to-b from-[#0f0e12] to-[#161418]"
                  style={{
                    height: '35%',
                    zIndex: showMiniCard ? 2 : 1,
                    borderBottom: '2px solid rgba(212,164,52,0.06)',
                  }}
                >
                  {/* Golden glow inside envelope */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-b from-[rgba(212,164,52,0.08)] to-transparent transition-opacity duration-500 rounded-t-2xl ${showMiniCard ? 'opacity-100' : 'opacity-0'}`}
                  />
                </div>

                {/* Mini-card (slides up from inside envelope) */}
                {showMiniCard && (
                  <motion.div
                    initial={{ y: 120, opacity: 0, scale: 0.9 }}
                    animate={{
                      y: 0,
                      opacity: miniCardOpacity,
                      scale: miniCardScale,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    onClick={handleMiniCardClick}
                    className="absolute left-1/2 -translate-x-1/2 cursor-pointer z-20 w-[85%] rounded-2xl p-6 flex flex-col items-center text-center shadow-2xl border border-white/10"
                    style={{
                      top: '10%',
                      background: 'linear-gradient(160deg, #ffffff 0%, #fdf8f0 100%)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Abrir invitación"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMiniCardClick(); }}
                  >
                    <span className="text-5xl mb-3 select-none">{eventEmoji}</span>
                    <span className="text-xs px-3 py-1 rounded-full bg-black/5 text-on-surface-variant font-semibold mb-3 tracking-wide uppercase">
                      evento
                    </span>
                    <h2
                      className="text-2xl font-bold text-gray-900 mb-1 leading-tight font-outfit"
                    >
                      ¡Estás invitado!
                    </h2>
                    {hasName && (
                      <p
                        className="text-base text-gray-600 mt-1 font-script italic"
                      >
                        {displayName}
                      </p>
                    )}
                    <p
                      className="text-xs text-on-surface-variant mt-4 flex items-center gap-1"
                    >
                      <span className="animate-tap-pulse">Toca para abrir</span>
                      <span className="animate-tap-pulse ml-1">→</span>
                    </p>
                  </motion.div>
                )}

                {/* Envelope flap (rotates in 3D) */}
                <div
                  className="absolute top-0 left-0 w-full rounded-t-2xl backface-hidden border-b border-[rgba(212,164,52,0.06)]"
                  style={{
                    height: '35%',
                    zIndex: phase === 'breaking' && showMiniCard ? 5 : 10,
                    transformOrigin: 'center bottom',
                    transform: showMiniCard ? 'rotateX(-180deg)' : 'rotateX(0deg)',
                    transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: 'linear-gradient(135deg, #2a2830 0%, #1c1a1f 100%)',
                    pointerEvents: showMiniCard ? 'none' : 'auto',
                  }}
                >
                  {/* Decorative line on flap */}
                  <div className="absolute bottom-1 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[rgba(212,164,52,0.15)] to-transparent" />
                </div>

                {/* Envelope body (below flap) */}
                <div
                  className="relative rounded-b-2xl"
                  style={{
                    marginTop: '35%',
                    zIndex: 5,
                    minHeight: 260,
                    background: 'linear-gradient(180deg, #1c1a1f 0%, #161418 100%)',
                    borderTop: '2px solid rgba(212,164,52,0.08)',
                  }}
                >
                  {/* Fold line */}
                  <div className="absolute -top-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[rgba(212,164,52,0.2)] to-transparent" />

                  {/* Guest name text */}
                  <div className={`pt-14 pb-8 px-8 text-center transition-opacity duration-300 ${showMiniCard ? 'opacity-0' : 'opacity-100'}`}>
                    <p
                      className="text-xs text-[rgba(212,164,52,0.7)] mb-3 tracking-[0.2em] uppercase font-medium"
                    >
                      Especialmente para{hasName ? '' : ':'}
                    </p>
                    {hasName ? (
                      <p
                        className="text-lg md:text-xl leading-relaxed font-script italic text-[#d4a434]"
                      >
                        {displayName}
                      </p>
                    ) : (
                      <p
                        className="text-sm font-script italic text-[rgba(212,164,52,0.4)]"
                      >
                        — tú —
                      </p>
                    )}
                  </div>

                  {/* Skip button */}
                  <div className="absolute bottom-8 left-0 right-0 text-center">
                    <button
                      onClick={skip}
                      className="text-xs text-white/30 hover:text-white/60 transition-colors px-4 py-2 min-h-[44px] min-w-[44px]"
                      aria-label="Saltar animación"
                    >
                      Saltar
                    </button>
                  </div>
                </div>

                {/* Wax seal (at the fold line between flap and body) */}
                <WaxSeal
                  emoji={eventEmoji}
                  onClick={handleSealClick}
                  pulsing={phase === 'waiting'}
                  breaking={phase === 'breaking'}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
