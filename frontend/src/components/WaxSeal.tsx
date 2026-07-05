import { cn } from '../utils/cn';

interface WaxSealProps {
  emoji: string;
  onClick: () => void;
  pulsing: boolean;
  breaking: boolean;
}

export function WaxSeal({ emoji, onClick, pulsing, breaking }: WaxSealProps) {
  return (
    <button
      onClick={onClick}
      disabled={breaking}
      className={cn(
        'absolute z-30 w-[76px] h-[76px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-300',
        pulsing ? 'animate-seal-pulse' : '',
        breaking ? 'animate-none' : '',
      )}
      style={{
        top: '50%',
        left: '50%',
        transform: breaking ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
        background: 'radial-gradient(circle at 38% 35%, #e6c35c 0%, #c9952e 40%, #8b6914 100%)',
        boxShadow: breaking
          ? 'none'
          : pulsing
            ? '0 0 40px rgba(212,164,52,0.6)'
            : '0 4px 15px rgba(139,105,20,0.5), inset 0 -2px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,215,120,0.4)',
        animation: breaking ? 'seal-break 0.4s ease-out forwards' : undefined,
      }}
      aria-label="Abrir invitación"
    >
      <svg
        viewBox="0 0 76 76"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <radialGradient id="wax-shine" cx="38%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(255,235,180,0.5)" />
            <stop offset="50%" stopColor="rgba(201,149,46,0.1)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
          <filter id="wax-texture">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="textured" />
            <feComposite in="textured" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        <circle cx="38" cy="38" r="37" fill="none" stroke="rgba(139,105,20,0.4)" strokeWidth="1.5" />
        <circle cx="38" cy="38" r="33" fill="url(#wax-shine)" />
        <circle cx="38" cy="38" r="33" fill="none" stroke="rgba(255,215,120,0.15)" strokeWidth="0.5" />
      </svg>
      <span className="relative z-10 text-2xl select-none drop-shadow-md">{emoji}</span>
    </button>
  );
}
