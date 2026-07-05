import { forwardRef, useCallback, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'gold';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-md hover:shadow-lg hover:shadow-primary/20',
  secondary:
    'bg-gradient-to-r from-secondary to-secondary-container text-on-secondary-container shadow-md hover:shadow-lg hover:shadow-secondary/20',
  ghost: 'text-on-surface-variant hover:bg-surface-container-high',
  outline: 'border border-outline-variant text-on-surface hover:bg-surface-container-low hover:border-primary/40',
  destructive: 'bg-red-500 text-white shadow-md hover:opacity-90 shadow-red-500/20',
  gold: 'bg-gradient-to-r from-gold to-gold-light text-white shadow-md hover:shadow-lg hover:shadow-gold/30',
};

const SIZES: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm min-h-[36px] rounded-lg',
  md: 'px-5 py-2.5 text-sm min-h-[44px] rounded-xl',
  lg: 'px-7 py-3.5 text-base min-h-[52px] rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, className, children, onClick, disabled, ...rest },
  ref,
) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
      onClick?.(e);
    },
    [onClick],
  );

  return (
    <motion.button
      ref={ref}
      onClick={handleClick}
      disabled={disabled || loading}
      whileHover={prefersReducedMotion ? {} : { scale: disabled || loading ? 1 : 1.02 }}
      whileTap={prefersReducedMotion ? {} : { scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative overflow-hidden inline-flex items-center justify-center gap-2 font-bold transition-colors duration-200 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...(rest as Record<string, unknown>)}
    >
      {loading && (
        <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />
      )}
      {!loading && leftIcon && <span className="flex-shrink-0 flex items-center">{leftIcon}</span>}
      <span className={cn(loading && 'opacity-70')}>{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0 flex items-center">{rightIcon}</span>}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ scale: 0, opacity: 0.35 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ position: 'absolute', left: r.x - 20, top: r.y - 20, width: 40, height: 40, borderRadius: '50%', background: 'currentColor', pointerEvents: 'none' }}
        />
      ))}
    </motion.button>
  );
});
