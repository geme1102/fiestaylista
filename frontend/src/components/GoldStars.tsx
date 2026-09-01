import { useState, useEffect, useRef } from 'react';

interface GoldStarsProps {
  count?: number;
  size?: number;
}

function GoldParticle({ index }: { index: number }) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setStyle({
      position: 'absolute',
      width: 2,
      height: 2,
      borderRadius: '50%',
      background: '#D97706',
      left: `${20 + Math.random() * 60}%`,
      top: `${20 + Math.random() * 60}%`,
      animation: `gold-particle ${0.6 + Math.random() * 0.4}s ease-out ${index * 0.1}s forwards`,
      opacity: 0,
      pointerEvents: 'none',
    });
  }, [index]);

  return <div style={style} />;
}

export default function GoldStars({ count = 5, size = 14 }: GoldStarsProps) {
  const [showParticles, setShowParticles] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      className="inline-flex gap-0.5 relative"
      onMouseEnter={() => { if (reducedMotionRef.current) return; setShowParticles(true); clearTimeout(timeoutRef.current); }}
      onMouseLeave={() => { timeoutRef.current = setTimeout(() => setShowParticles(false), 500); }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="relative"
          style={{ filter: 'drop-shadow(0 0 4px rgba(217, 119, 6, 0.3))' }}
        >
          <defs>
            <linearGradient id={`gold-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="40%" stopColor="#D97706" />
              <stop offset="70%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={`url(#gold-grad-${i})`}
            stroke="#B45309"
            strokeWidth="0.5"
          />
        </svg>
      ))}
      {showParticles && Array.from({ length: 6 }).map((_, i) => (
        <GoldParticle key={i} index={i} />
      ))}
    </span>
  );
}
