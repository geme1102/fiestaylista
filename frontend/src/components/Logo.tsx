import { cn } from '../utils/cn';

interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return (
    <picture>
      <source srcSet="/logo.webp" type="image/webp" />
      <img src="/logo.png" alt="Fiesta y Lista" className={cn('object-contain', className)} />
    </picture>
  );
}
