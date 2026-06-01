import { motion } from 'framer-motion';
import { getGiftImage, getGiftCategory } from '../data/giftEmojis';
import { formatCOP } from '../utils/format';
import type { Gift } from '../types';

interface GiftCardProps {
  gift: Gift;
  onClaim?: (id: string, name: string) => void;
  onFree?: (id: string) => void;
  onDelete?: (id: string) => void;
  claimingId?: string | null;
  isAdmin?: boolean;
  easyRead?: boolean;
}

export default function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, isAdmin }: GiftCardProps) {
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
          {gift.targetAmount && (
            <p className="text-on-surface-variant/50 text-body-md">
              {formatCOP(gift.targetAmount)}
            </p>
          )}
        </div>
        {isAdmin && onFree && (
          <div className="absolute top-2 right-2 z-10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onFree(gift.id)}
              className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 dark:bg-primary/20 rounded-lg hover:bg-primary/20 transition-colors min-h-[36px]"
            >
              Liberar
            </motion.button>
          </div>
        )}
      </motion.div>
    );
  }

  const progressPercent = gift.isCollective && gift.targetAmount && gift.targetAmount > 0
    ? Math.min((gift.collectedAmount || 0) / gift.targetAmount * 100, 100)
    : 0;

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

        {/* Collective overlay */}
        {gift.isCollective && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <span className="bg-secondary-container/90 text-on-secondary-container px-3 py-1 rounded-full text-caption font-label-md backdrop-blur-md inline-block mb-2">
                Regalo Colectivo
              </span>
            </div>
          </div>
        )}

        {/* Admin overlay */}
        {isAdmin && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-4 transition-opacity">
            {onFree && (
              <button
                onClick={() => onFree(gift.id)}
                className="bg-emerald-600 text-white flex flex-col items-center justify-center w-16 h-16 rounded-full shadow-lg hover:bg-emerald-700 active:scale-90 transition-all"
              >
                <span className="material-symbols-outlined">check_circle</span>
                <span className="text-[10px] font-bold mt-1">Liberar</span>
              </button>
            )}
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
        {gift.isCollective ? (
          <>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{gift.name}</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-caption font-label-md text-on-surface-variant">
                <span>{gift.collectedAmount ? formatCOP(gift.collectedAmount) : '$0'} recaudados</span>
                {gift.targetAmount && <span>Meta: {formatCOP(gift.targetAmount)}</span>}
              </div>
              <div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-container shimmer-bg"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-primary font-label-md text-label-md text-right">{Math.round(progressPercent)}% completado</p>
            </div>
            {onClaim && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
                disabled={claimingId === gift.id}
                className="w-full py-3 px-6 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-label-md text-label-md rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {claimingId === gift.id ? '...' : 'Contribuir al sueño'}
              </motion.button>
            )}
          </>
        ) : (
          <>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-1">{gift.name}</h3>
            {gift.targetAmount && (
              <p className="text-on-surface-variant text-body-md mb-4">{formatCOP(gift.targetAmount)}</p>
            )}
            {!gift.targetAmount && (
              <p className="text-on-surface-variant text-body-md mb-4">Set de regalo ideal para {category.label.toLowerCase()}.</p>
            )}
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
          </>
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

  // States 1 & 2: Individual / Collective (guest view)
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
}
