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

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const }
  }),
  hover: { y: -4, scale: 1.02, transition: { duration: 0.2 } },
  tap: { scale: 0.98, transition: { duration: 0.1 } }
};

export default function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, isAdmin }: GiftCardProps) {
  const image = getGiftImage(gift.name);
  const category = getGiftCategory(gift.name);

  if (gift.isClaimed) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 0.8, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        className="relative rounded-2xl p-4 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(236,72,153,0.15)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]">
          <img src="/backgrounds/gift-card-bg.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden opacity-60">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-500 dark:text-gray-400 line-through truncate text-sm">
              {gift.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <img src="/badges/claimed-badge.svg" alt="Apartado" className="h-5" />
              <span className="text-xs font-medium text-pink-600 dark:text-pink-400">
                {gift.claimedBy}
              </span>
            </div>
          </div>
          {isAdmin && onFree && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onFree(gift.id)}
              className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors min-h-[36px]"
            >
              Liberar
            </motion.button>
          )}
          {isAdmin && onDelete && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDelete(gift.id)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors min-h-[36px]"
            >
              ✕
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
      className="relative rounded-2xl p-5 overflow-hidden cursor-default group"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
      }}
    >
      <div className="absolute inset-0 opacity-[0.04]">
        <img src="/backgrounds/gift-card-bg.png" alt="" className="w-full h-full object-cover" />
      </div>

      <div className="flex items-start gap-4 relative">
        <div className="relative w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
          <img src={image} alt={gift.name} className="w-full h-full object-contain" />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: category.color + '18',
                color: category.color,
              }}
            >
              {category.label}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
            {gift.name}
          </h3>
        </div>

        {onClaim && (
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 4px 20px rgba(236,72,153,0.35)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onClaim(gift.id, gift.name)}
            disabled={claimingId === gift.id}
            className="shrink-0 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #db2777)',
              boxShadow: '0 2px 12px rgba(236,72,153,0.25)',
            }}
          >
            {claimingId === gift.id ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                ...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                🎁 Lo regalo!
              </span>
            )}
          </motion.button>
        )}
      </div>

      {isAdmin && onDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
