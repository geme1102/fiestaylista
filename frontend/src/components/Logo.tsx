import { cn } from '../utils/cn';

interface LogoProps {
  className?: string;
  alt?: string;
}

export default function Logo({ className, alt = '' }: LogoProps) {
  return (
    <picture>
      <source srcSet="/logo.webp" type="image/webp" />
      <img
        src="/logo.png"
        alt={alt}
        className={cn('object-contain', className)}
        width={200}
        height={200}
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  );
}
