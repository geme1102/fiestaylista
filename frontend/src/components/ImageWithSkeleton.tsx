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
    <div className={cn('relative overflow-hidden bg-gray-100 dark:bg-gray-700 rounded-xl', aspectRatio, containerClassName, 'group')}>
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 bg-[length:200%_100%]" />
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
          <div className="text-center">
            <span className="material-symbols-outlined text-3xl text-gray-400">broken_image</span>
            <p className="text-xs text-gray-400 mt-1">No se pudo cargar</p>
          </div>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className={cn(
              'w-full h-full object-cover transition-all duration-500',
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
              'group-hover:scale-105 group-hover:shadow-lg',
              className,
            )}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
          {loaded && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/20 to-transparent" />
          )}
        </>
      )}
    </div>
  );
}
