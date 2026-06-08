import { memo } from 'react';
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

  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/icons/gift-generic.svg';
  };

  // State 3: Apartado (claimed)
  if (gift.isClaimed) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.9, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="glass-card-premium rounded-xl overflow-hidden opacity-90 relative"
      >
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="relative h-48 overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover blur-sm opacity-60"
            onError={onImgError}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-primary/20 shadow-xl">
              <span className="text-primary font-label-md text-label-md flex items-center gap-2">
                💝 Apartado con amor por {gift.claimedBy}
              </span>
            </div>
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-headline-md text-headline-md text-on-surface-variant/60 line-through mb-1">{gift.name}</h3>
        </div>
        {isAdmin && onFree && (
          <div className="absolute top-2 right-2 z-10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onFree(gift.id)}
              className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors min-h-[36px]"
            >
              Liberar
            </motion.button>
          </div>
        )}
      </motion.div>
    );
  }

  const cardContent = (
    <>
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={image}
          alt={gift.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={onImgError}
        />
        {/* Category Badge */}
        <div className="absolute top-4 left-4 bg-primary/90 text-on-primary px-3 py-1 rounded-full text-caption font-label-md flex items-center gap-1 backdrop-blur-md">
          <span className="material-symbols-outlined text-sm">home</span>
          {category.label}
        </div>

        {/* Admin overlay */}
        {isAdmin && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* Admin badge */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">
            Admin View
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-1">{gift.name}</h3>
        <p className="text-on-surface-variant text-body-md mb-4">Set de regalo ideal para {category.label.toLowerCase()}.</p>
        {onClaim && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
            disabled={claimingId === gift.id}
            className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-label-md text-label-md rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">card_giftcard</span>
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
    </>
  );

  // State 4: Admin View (wrapped in glass-card with border)
  if (isAdmin) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-premium rounded-xl overflow-hidden border-2 border-primary/10 shadow-lg relative group"
      >
        {cardContent}
      </motion.div>
    );
  }

  // States 1 & 2: Individual / Available (guest view)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="glass-card-premium rounded-xl overflow-hidden shadow-lg group"
    >
      {cardContent}
    </motion.div>
  );
});

export default GiftCard;
