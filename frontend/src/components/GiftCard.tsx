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

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] as const }
  }),
  hover: { y: -6, scale: 1.02, transition: { duration: 0.25, ease: 'easeOut' as const } },
  tap: { scale: 0.97, transition: { duration: 0.12 } }
};

export default function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, isAdmin, easyRead }: GiftCardProps) {
  const image = getGiftImage(gift.name);
  const category = getGiftCategory(gift.name);

  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/icons/gift-generic.svg';
  };

  const progressPercent = gift.targetAmount && gift.targetAmount > 0
    ? Math.min(((gift.collectedAmount || 0) / gift.targetAmount) * 100, 100)
    : 0;

  if (gift.isClaimed) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 0.75, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        className={`relative rounded-2xl overflow-hidden border border-pink-200/20 dark:border-pink-900/15 bg-gradient-to-br from-pink-50/60 to-rose-50/60 dark:from-pink-950/20 dark:to-rose-950/20 backdrop-blur-sm ${easyRead ? 'p-5' : 'p-4'}`}
      >
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[11px] font-bold rounded-full shadow-lg shadow-pink-500/25 animate-glow-pulse-soft">
            <span>💝</span>
            Apartado con amor por {gift.claimedBy}
          </span>
        </div>
        <div className={`flex items-center gap-4 relative ${easyRead ? 'pt-2' : 'pt-1'}`}>
          <div className={`relative shrink-0 rounded-xl overflow-hidden opacity-40 saturate-[0.3] blur-[1px] ${easyRead ? 'w-16 h-16' : 'w-14 h-14'}`}>
            <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" onError={onImgError} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-gray-400 dark:text-gray-500 line-through truncate ${easyRead ? 'text-lg' : 'text-sm'}`}>
              {gift.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`font-semibold text-pink-600 dark:text-pink-400 ${easyRead ? 'text-base' : 'text-xs'}`}>
                💝 {gift.claimedBy}
              </span>
            </div>
          </div>
          {isAdmin && onFree && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onFree(gift.id)}
              className="shrink-0 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 dark:bg-primary/20 rounded-lg hover:bg-primary/20 transition-colors min-h-[36px]"
            >
              Liberar
            </motion.button>
          )}
          {isAdmin && onDelete && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDelete(gift.id)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium text-outline-variant hover:text-error transition-colors min-h-[36px]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      custom={0}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      className={`relative rounded-2xl overflow-hidden cursor-default group ${easyRead ? 'p-6' : 'p-5'} glass-card-premium hover:shadow-lg hover:shadow-rose-500/5 transition-all duration-300`}
    >
      <div className="absolute inset-0 opacity-[0.02] bg-gradient-to-br from-rose-100/20 to-fuchsia-100/20 dark:from-rose-900/10 dark:to-fuchsia-900/10" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="animate-card-shine w-full h-full" />
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={`relative shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300 ring-1 ring-rose-200/50 dark:ring-rose-800/30 ${easyRead ? 'w-20 h-20' : 'w-16 h-16'}`}>
            <img src={image} alt={gift.name} loading="lazy" className="w-full h-full object-contain" onError={onImgError} />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: category.color + '18',
                  color: category.color,
                }}
              >
                {category.label}
              </span>
            </div>
            <h3 className={`font-semibold text-gray-900 dark:text-white leading-snug font-outfit ${easyRead ? 'text-xl' : 'text-sm'}`}>
              {gift.name}
            </h3>
          </div>
        </div>

        {gift.isCollective && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {formatCOP(gift.collectedAmount || 0)} recaudados
              </span>
              <span className="text-gray-400">
                Meta: {formatCOP(gift.targetAmount || 0)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ring-1 ring-rose-500/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-rose-400 via-fuchsia-500 to-rose-400 bg-[length:200%_100%] animate-gift-progress-pulse shadow-lg shadow-rose-500/20"
              />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
              {gift.targetAmount && gift.collectedAmount !== undefined
                ? `Faltan ${formatCOP(gift.targetAmount - gift.collectedAmount)} para completar este regalo`
                : 'Regalo colectivo'}
            </p>
          </div>
        )}

        {onClaim && (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(244,63,94,0.35)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
            disabled={claimingId === gift.id}
            className={`w-full min-h-[48px] font-bold text-white rounded-xl transition-all disabled:opacity-50 bg-gradient-to-r from-rose-500 to-fuchsia-500 shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 ${easyRead ? 'py-4 text-lg' : 'py-3 text-sm'}`}
          >
            {claimingId === gift.id ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                ...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🎁</span>
                Regalar este detalle
              </span>
            )}
          </motion.button>
        )}
      </div>

      {isAdmin && onDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(gift.id)}
            className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
          >
            ✕
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
