import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { getGiftImage, getGiftCategory } from '../data/giftEmojis';
import type { Gift } from '../types';

interface GiftCardProps {
  gift: Gift;
  onClaim?: (id: string, name: string) => void;
  onFree?: (id: string) => void;
  onDelete?: (id: string) => void;
  claimingId?: string | null;
  isAdmin?: boolean;
}

const GiftCard = memo(function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, isAdmin }: GiftCardProps) {
  const image = getGiftImage(gift.name);
  const category = getGiftCategory(gift.name);
  const [imgError, setImgError] = useState(false);

  const onImgError = () => {
    setImgError(true);
  };

  if (gift.isClaimed) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white/90 rounded-3xl overflow-hidden shadow-xs border border-amber-100/50 relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-50 via-white/98 to-white/98 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-10 text-center border-2 border-amber-300/40 rounded-3xl">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow border border-amber-200 mb-2 animate-pulse">
            <span className="text-sm">🕊️</span>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm text-xs uppercase tracking-wider mb-3">
            <span className="text-[8px] text-amber-700 font-extrabold tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-600">favorite</span>
              APARTADO CON CARIÑO POR
            </span>
            <span className="text-gray-900 font-black mt-0.5 text-xs md:text-sm">{gift.claimedBy}</span>
          </div>
          {isAdmin && onFree && (
            <button
              onClick={() => onFree(gift.id)}
              className="text-gray-400 hover:text-red-500 font-bold text-[9px] uppercase tracking-widest transition-all underline cursor-pointer"
            >
              Liberar obsequio
            </button>
          )}
        </div>
        <div className="h-32 bg-gray-50 flex items-center justify-center opacity-30">
          {!imgError && (
            <img src={image} alt="" className="w-12 h-12 object-contain opacity-50" onError={onImgError} />
          )}
        </div>
        <div className="p-5 opacity-30 select-none">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">{gift.name}</h3>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-amber-100/60 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
    >
      <div>
        <div className="relative h-44 bg-gradient-to-b from-amber-50/60 to-rose-50/30 flex items-center justify-center p-4">
          <span className="absolute top-4 left-4 bg-white/95 text-amber-800 text-[9px] font-extrabold uppercase px-3 py-1 rounded-full border border-amber-200/50 shadow-xs z-10">
            {category.label}
          </span>

          <span className="absolute top-5 right-6 text-yellow-500 text-sm sparkle-fast pointer-events-none select-none">✦</span>
          <span className="absolute bottom-5 left-6 text-pink-400 text-base sparkle-slow pointer-events-none select-none">✦</span>

          {!imgError ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="w-20 h-20 object-contain transition-transform duration-500 group-hover:scale-110 select-none pointer-events-none"
              onError={onImgError}
            />
          ) : (
            <span className="text-5xl select-none">🎁</span>
          )}

          {isAdmin && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              {onDelete && (
                <button
                  onClick={() => onDelete(gift.id)}
                  className="bg-error text-white flex flex-col items-center justify-center w-16 h-16 rounded-full shadow-lg hover:bg-red-700 active:scale-90 transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                  <span className="text-[10px] font-bold mt-1">Eliminar</span>
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="absolute top-4 right-4 z-20 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">
              Admin View
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-2 rounded-full border border-amber-200/50">
              Premium Unión
            </span>
            <span className="text-[9px] text-gray-400">Verificado</span>
          </div>

          <h3 className="font-headline-md text-headline-md text-on-surface capitalize">
            {gift.name}
          </h3>
          <p className="text-gray-500 font-medium mt-1 leading-relaxed text-xs">
            Set de regalo ideal para {category.label.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        {onClaim && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
            disabled={claimingId === gift.id}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-3 px-5 rounded-full font-bold flex items-center justify-center gap-2 shadow-sm transition-all text-xs uppercase tracking-wider border-b-4 border-b-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base animate-bounce">card_giftcard</span>
            {claimingId === gift.id ? '...' : '🎁 Regalar este detalle'}
          </motion.button>
        )}
        {isAdmin && onDelete && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onDelete(gift.id)}
              className="text-outline-variant hover:text-error transition-colors text-sm"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default GiftCard;
