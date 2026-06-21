import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Photo } from '../types';

interface PhotoSlideshowProps {
  photos: Photo[];
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoSlideshow({ photos, initialIndex = 0, onClose }: PhotoSlideshowProps) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(() => {
    setCurrent((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setCurrent((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next]);

  const photo = photos[current];
  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90"
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <span className="text-white/70 text-sm font-semibold">
          {current + 1} / {photos.length}
        </span>
        <button
          onClick={() => {
            const a = document.createElement('a');
            a.href = photo.url;
            a.download = `foto-${current + 1}`;
            a.click();
          }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90"
          aria-label="Descargar"
        >
          <span className="material-symbols-outlined">download</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative px-4">
        <button
          onClick={prev}
          className="absolute left-2 md:left-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-90 z-10"
          aria-label="Anterior"
        >
          <span className="material-symbols-outlined text-2xl">chevron_left</span>
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="max-w-full max-h-full flex flex-col items-center"
          >
            <img
              src={photo.url}
              alt={photo.caption || `Foto ${current + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-xl"
            />
            {photo.caption && (
              <p className="text-white/70 text-sm mt-4 text-center max-w-md">{photo.caption}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={next}
          className="absolute right-2 md:right-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-90 z-10"
          aria-label="Siguiente"
        >
          <span className="material-symbols-outlined text-2xl">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
