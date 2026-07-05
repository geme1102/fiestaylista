import { memo } from 'react';
import { cn } from '../../utils/cn';

export const Skeleton = memo(function Skeleton({ className, rounded = 'rounded-lg' }: { className?: string; rounded?: string }) {
  return <div className={cn('animate-pulse bg-surface-container-high', rounded, className)} />;
});

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}


