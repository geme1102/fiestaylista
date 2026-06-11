import { useState, memo } from 'react';
import { cn } from '../utils/cn';

function getCloudinarySrcSet(src: string): string | undefined {
  if (!src.includes('cloudinary.com')) return undefined;
  const base = src.replace('/image/upload/', '/image/upload/w_400/');
  const base800 = src.replace('/image/upload/', '/image/upload/w_800/');
  const base1200 = src.replace('/image/upload/', '/image/upload/w_1200/');
  return `${base} 400w, ${base800} 800w, ${base1200} 1200w`;
}

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  fallback?: string;
}

const ImageWithSkeleton = memo(function ImageWithSkeleton({ src, alt, className, containerClassName, aspectRatio = 'aspect-[4/3]' }: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const srcSet = getCloudinarySrcSet(src);

  return (
    <div className={cn('relative overflow-hidden bg-surface-container-high rounded-xl', aspectRatio, containerClassName, 'group')}>
      {!loaded && !error && (
        <>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-surface-container-high via-surface-container/50 to-surface-container-high bg-[length:200%_100%]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-outline-variant/30 text-5xl">image</span>
          </div>
        </>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-low border-2 border-dashed border-outline-variant/30 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-error-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-error/40 text-4xl">broken_image</span>
          </div>
          <div className="text-center px-4">
            <span className="font-label-md text-label-md text-on-surface-variant/60">No se pudo cargar</span>
          </div>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            srcSet={srcSet}
            sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
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
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary/10" />
          )}
        </>
      )}
    </div>
  );
});

export default ImageWithSkeleton;
