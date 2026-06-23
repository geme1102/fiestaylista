import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

type BadgeVariant = 'gold' | 'primary' | 'secondary' | 'success' | 'neutral' | 'locked';

const VARIANTS: Record<BadgeVariant, string> = {
  gold: 'bg-gradient-to-r from-gold/15 to-gold-light/15 text-gold border-gold/30',
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
  locked: 'bg-surface-container-low text-on-surface-variant/50 border-outline-variant grayscale',
};

export const Badge = memo(function Badge({
  children,
  variant = 'neutral',
  icon,
  size = 'md',
  animated = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: string;
  size?: 'sm' | 'md';
  animated?: boolean;
  className?: string;
}) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold border rounded-full whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        VARIANTS[variant],
        className,
      )}
    >
      {icon && <span className="material-symbols-outlined" style={{ fontSize: size === 'sm' ? 12 : 14 }}>{icon}</span>}
      {children}
    </span>
  );

  if (animated) {
    return (
      <motion.span
        initial={{ scale: 0, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="inline-block"
      >
        {content}
      </motion.span>
    );
  }

  return content;
});
