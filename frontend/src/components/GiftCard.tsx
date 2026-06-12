import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { getGiftImage, getGiftCategory } from '../data/giftEmojis';
import type { Gift } from '../types';

interface GiftCardProps {
  gift: Gift;
  onClaim?: (id: string, name: string) => void;
  onFree?: (id: string) => void;
  onDelete?: (id: string) => void;
  claimingId?: string | null;
  freeingId?: string | null;
  deletingId?: string | null;
  isAdmin?: boolean;
}

const GiftCard = memo(function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, freeingId, deletingId, isAdmin }: GiftCardProps) {
  const image = getGiftImage(gift.name);
  const category = getGiftCategory(gift.name);
  const [imgError, setImgError] = useState(false);

  const onImgError = () => setImgError(true);

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
              disabled={freeingId === gift.id}
              className="text-gray-400 hover:text-red-500 font-bold text-[9px] uppercase tracking-widest transition-all underline cursor-pointer disabled:opacity-30"
            >
              {freeingId === gift.id ? '...' : 'Liberar obsequio'}
            </button>
          )}
        </div>
        <div className="h-32 bg-gray-50 flex items-center justify-center opacity-30">
          {!imgError && (
            <img src={image} alt="" loading="lazy" className="w-12 h-12 object-contain opacity-50" onError={onImgError} />
          )}
        </div>
        <div className="p-5 opacity-30 select-none">
          <h3 className="text-lg font-bold text-on-surface mb-1">{gift.name}</h3>
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
      className="bg-white border border-rose-100/30 rounded-3xl p-5 relative shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#a21b53]/25 group overflow-hidden text-left"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-50/60 to-transparent rounded-bl-full pointer-events-none -z-10" />

      <div className="absolute top-4 left-4 flex gap-1.5 z-10">
        <span className="bg-amber-50 border border-amber-200/50 text-amber-800 text-[8px] md:text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider leading-none">
          REGALO
        </span>
        {isAdmin && (
          <span className="bg-[#2a292e] text-white text-[8px] font-bold px-2 py-0.5 rounded tracking-wider uppercase leading-none">
            ADMIN VIEW
          </span>
        )}
      </div>

      <div className="flex items-start gap-4 mt-6">
        <div className="w-[72px] h-[72px] bg-[#fff0f4] rounded-2xl flex flex-col items-center justify-center shrink-0 border border-pink-100/30 relative">
          <div className="flex justify-center gap-0.5 -mb-0.5 pointer-events-none">
            <div className="w-2.5 h-2.5 border border-[#d65780] rounded-full rotate-[-12deg]" />
            <div className="w-2.5 h-2.5 border border-[#d65780] rounded-full rotate-[12deg]" />
          </div>
          <div className="w-9 h-2 bg-[#fadcd5] border border-[#d65780] rounded-sm relative z-10 pointer-events-none" />
          <div className="w-8 h-7 bg-white border-x border-b border-[#d65780] rounded-b-sm relative flex justify-center pointer-events-none">
            <div className="absolute h-full w-2 bg-[#d65780]" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-[#fef6ed] text-amber-700 text-[9px] font-extrabold py-0.5 px-2 rounded-full border border-amber-100">
              {category.label}
            </span>
            <span className="text-[#a21b53] text-[9px] font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100 inline" />
              Verificado
            </span>
          </div>

          <h4 className="text-[17px] font-extrabold text-gray-900 mt-2 tracking-tight group-hover:text-[#a21b53] transition-colors capitalize">
            {gift.name}
          </h4>
          <p className="text-gray-500 text-xs font-semibold leading-normal mt-0.5">
            Set de regalo ideal para {category.label.toLowerCase()}.
          </p>
        </div>
      </div>

      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(gift.id)}
          disabled={deletingId === gift.id}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-all cursor-pointer opacity-80 hover:opacity-100 disabled:opacity-30 z-10"
          title="Eliminar regalo"
        >
          {deletingId === gift.id ? (
            <span className="text-xs font-bold">...</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )}
        </button>
      )}

      {onClaim && (
        <div className="mt-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
            disabled={claimingId === gift.id}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-3 px-5 rounded-full font-bold flex items-center justify-center gap-2 shadow-sm transition-all text-xs uppercase tracking-wider border-b-4 border-b-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base animate-bounce">card_giftcard</span>
            {claimingId === gift.id ? '...' : 'Regalar este detalle'}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
});

export default GiftCard;
