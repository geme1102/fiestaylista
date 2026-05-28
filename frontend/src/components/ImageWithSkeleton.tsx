import { useState } from 'react';
import { cn } from '../utils/cn';

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  fallback?: string;
}

export default function ImageWithSkeleton({ src, alt, className, containerClassName, aspectRatio = 'aspect-[4/3]', fallback = '/icons/gift-generic.svg' }: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-gray-100 dark:bg-gray-700', aspectRatio, containerClassName)}>
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-600" />
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={fallback} alt={alt} className="w-1/2 h-1/2 object-contain opacity-40" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            className,
          )}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
        />
      )}
    </div>
  );
}
