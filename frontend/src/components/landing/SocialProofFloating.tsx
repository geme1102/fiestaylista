import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SOCIAL_PROOFS = [
  { name: 'María', action: 'creó su lista de baby shower', amount: null, icon: '🎉', delay: 0 },
  { name: 'Carlos', action: 'apartó un regalo de boda', amount: null, icon: '🎁', delay: 1.2 },
  { name: 'Ana', action: 'compartió su lista por WhatsApp', amount: null, icon: '✨', delay: 2.4 },
  { name: 'Pedro', action: 'envió un aporte con Lluvia de Sobres', amount: null, icon: '💌', delay: 3.6 },
];

export function SocialProofFloating() {
  const [visible, setVisible] = useState<number[]>([]);
  const idxRef = useRef(0);
  const animKeyRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (idxRef.current + 1) % SOCIAL_PROOFS.length;
      idxRef.current = next;
      animKeyRef.current++;
      setVisible((v) => [...v, next].slice(-2));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-20 w-full max-w-sm mx-auto">
      <AnimatePresence mode="popLayout">
        {visible.map((idx) => {
          const proof = SOCIAL_PROOFS[idx];
          return (
            <motion.div
              key={`${proof.name}-${idx}-${animKeyRef.current}`}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: idx % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="absolute left-1/2 -translate-x-1/2 w-max"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface/80 backdrop-blur-md border border-amber-200/30 shadow-lg shadow-primary/5">
                <span className="text-lg">{proof.icon}</span>
                <span className="text-sm text-on-surface">
                  <strong className="text-primary">{proof.name}</strong> {proof.action}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
