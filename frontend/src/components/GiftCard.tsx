import { memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { getGiftImage, getGiftCategory } from '../data/giftEmojis';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import type { Gift, GiftClaim } from '../types';
import { use3DTilt } from '../hooks/use3DTilt';
import { Badge } from '../components/ui/Badge';

interface GiftCardProps {
  gift: Gift;
  onClaim?: (id: string, name: string) => void;
  onFree?: (id: string) => void;
  onDelete?: (id: string) => void;
  claimingId?: string | null;
  freeingId?: string | null;
  deletingId?: string | null;
  isAdmin?: boolean;
  guestName?: string;
  readOnly?: boolean;
}

const GiftCard = memo(function GiftCard({ gift, onClaim, onFree, onDelete, claimingId, freeingId, deletingId, isAdmin, guestName, readOnly }: GiftCardProps) {
  const image = getGiftImage(gift.name);
  const category = getGiftCategory(gift.name);
  const [imgError, setImgError] = useState(false);
  const [claims, setClaims] = useState<GiftClaim[]>(gift.claims || []);
  const [isGroupGift, setIsGroupGift] = useState(gift.isGroupGift);
  const [togglingGroup, setTogglingGroup] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claiming, setClaiming] = useState(false);
  const { containerRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  const submittingRef = useRef(false);
  const tilt = use3DTilt(8);

  useEffect(() => {
    setIsGroupGift(gift.isGroupGift);
  }, [gift.isGroupGift]);

  useEffect(() => {
    setClaims(gift.claims || []);
  }, [gift.claims]);

  const onImgError = () => setImgError(true);

  const handleGroupClaim = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!claimName.trim()) return;

    setClaiming(true);
    try {
      let token = turnstileTokenRef.current;
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
      const res = await apiClient.put<{ claim: GiftClaim }>(`/api/events/${gift.eventId}/gifts/${gift.id}/group-claim`, {
        claimedBy: claimName.trim(),
        message: claimMessage.trim() || undefined,
        turnstileToken: token ?? undefined,
      });
      setClaims((prev) => [...prev, res.claim]);
      setClaimName('');
      setClaimMessage('');
      setShowClaimForm(false);
      resetTurnstile();
      showToast(`${claimName.trim()} se unió al regalo 🎉`, 'success');
    } catch (err) {
      reportError(err, { source: 'GiftCard' });
      showToast(err instanceof Error ? err.message : 'Error al unirte al regalo', 'error');
    } finally {
      submittingRef.current = false;
      setClaiming(false);
    }
  };

  if (gift.isClaimed && !isGroupGift) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        data-testid={`gift-card-${gift.id}`}
        className="bg-surface/90 rounded-3xl overflow-hidden shadow-xs border border-amber-100/50 relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-50 via-white/98 to-white/98 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-10 text-center border-2 border-amber-300/40 rounded-3xl">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow border border-amber-200 mb-2 animate-pulse">
            <span className="text-sm">🕊️</span>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm text-xs uppercase tracking-wider mb-3">
            <span className="text-xs text-amber-700 font-extrabold tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-600">favorite</span>
              {isAdmin ? 'APARTADO CON CARIÑO POR' : 'YA APARTADO'}
            </span>
            <span className="text-on-surface font-black mt-0.5 text-xs md:text-sm">
              {isAdmin ? gift.claimedBy : 'Alguien ya apartó este regalo'}
            </span>
          </div>
          {isAdmin && onFree && !readOnly && (
            <button
              onClick={() => onFree(gift.id)}
              disabled={freeingId === gift.id}
              className="text-on-surface-variant hover:text-red-500 font-bold text-[11px] uppercase tracking-widest transition-all underline cursor-pointer disabled:opacity-30 py-2.5 min-h-[44px]"
            >
              {freeingId === gift.id ? <span className="inline-block w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> : 'Liberar obsequio'}
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
      ref={tilt.ref as React.RefObject<HTMLDivElement>}
      onMouseMove={tilt.handleMouseMove}
      onMouseLeave={tilt.handleMouseLeave}
      data-testid={`gift-card-${gift.id}`}
      className="bg-surface border border-rose-100/30 rounded-3xl p-5 relative shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/25 group overflow-hidden text-left"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-50/60 to-transparent rounded-bl-full pointer-events-none -z-10" />

      <div className="absolute top-4 left-4 flex gap-1.5 z-10">
        <Badge variant="neutral" size="sm" className="uppercase tracking-wider">
          REGALO
        </Badge>
        {isAdmin && (
          <span className="bg-[#2a292e] text-white text-xs font-bold px-2 py-0.5 rounded tracking-wider uppercase leading-none">
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
            <span className="text-primary text-[9px] font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-100 inline" />
              Verificado
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-extrabold text-on-surface mt-2 tracking-tight group-hover:text-primary transition-colors capitalize">
            {gift.name}
          </h4>
          <p className="text-on-surface-variant/80 text-xs font-semibold leading-normal mt-0.5">
            Set de regalo ideal para {category.label.toLowerCase()}.
          </p>
        </div>
      </div>

      {isAdmin && !readOnly && (
        <div className="absolute top-4 right-4 flex gap-1 z-10">
          <button
            onClick={async () => {
              const next = !isGroupGift;
              setIsGroupGift(next);
              setTogglingGroup(true);
              try {
                const res = await apiClient.put<{ gift: Gift }>(`/api/events/${gift.eventId}/gifts/${gift.id}/toggle-group`, { isGroupGift: next });
                showToast(res.gift.isGroupGift ? 'Regalo grupal activado 👥' : 'Regalo individual', 'success');
              } catch (err) {
                reportError(err, { source: 'GiftCard' });
                setIsGroupGift(!next);
                showToast(err instanceof Error ? err.message : 'Error', 'error');
              } finally {
                setTogglingGroup(false);
              }
            }}
            disabled={togglingGroup}
            className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all ${isGroupGift ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-on-surface-variant hover:text-secondary hover:bg-secondary/10'} disabled:opacity-50`}
            title={isGroupGift ? 'Regalo grupal (varias personas)' : 'Hacer grupal (varias personas pueden unirse)'}
            aria-label={isGroupGift ? 'Desactivar modo grupal' : 'Activar modo grupal'}
          >
            <span className="material-symbols-outlined text-base">group</span>
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(gift.id)}
              disabled={deletingId === gift.id}
              className="text-on-surface-variant hover:text-red-500 hover:bg-red-50 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-30"
              title="Eliminar regalo"
              aria-label="Eliminar regalo"
            >
              {deletingId === gift.id ? (
                <span className="inline-block w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Group Gift: Claims list */}
      {isGroupGift && claims.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-bold text-on-surface-variant/80 uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">group</span>
            {claims.length} {claims.length === 1 ? 'persona' : 'personas'} participan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {claims.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed/30 text-primary text-[11px] font-bold">
                {c.claimedBy}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buttons area */}
      {isGroupGift && !gift.isClaimed ? (
        <div className="mt-4">
          {!showClaimForm ? (
            <button
              onClick={() => { setClaimName(guestName ?? ''); setShowClaimForm(true); }}
              className="w-full bg-gradient-to-r from-secondary to-secondary-container text-on-secondary py-3 px-5 rounded-full font-bold flex items-center justify-center gap-2 shadow-sm transition-all text-xs uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-base">group_add</span>
              Unirme al grupo
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30">
              <label htmlFor="claim-name" className="sr-only">Tu nombre</label>
              <input
                id="claim-name"
                type="text"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                inputMode="text"
                autoCapitalize="words"
                enterKeyHint="next"
                className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-[border-color,box-shadow]"
                autoFocus
              />
              <label htmlFor="claim-message" className="sr-only">Mensaje (opcional)</label>
              <input
                id="claim-message"
                type="text"
                value={claimMessage}
                onChange={(e) => setClaimMessage(e.target.value)}
                placeholder="Mensaje (opcional)"
                autoCapitalize="sentences"
                enterKeyHint="go"
                className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-[border-color,box-shadow]"
              />
              <div ref={containerRef} />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClaimForm(false)}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGroupClaim}
                  disabled={claiming || !claimName.trim()}
                  aria-busy={claiming}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-secondary to-secondary-container text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {claiming ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Uniendo...
                    </span>
                  ) : (
                    'Unirme'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : onClaim && (
        <div className="mt-4">
          <button
            onClick={() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(10); onClaim(gift.id, gift.name); }}
            disabled={claimingId === gift.id}
            aria-busy={claimingId === gift.id}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.96] text-white py-3 px-5 rounded-full font-bold flex items-center justify-center gap-2 btn-gpu text-xs uppercase tracking-wider border-b-[3px] border-b-amber-800 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-base group-hover:animate-[lightning-wiggle_0.4s_ease-in-out]">card_giftcard</span>
            {claimingId === gift.id ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Apartando...
              </span>
            ) : 'Regalar este detalle'}
          </button>
        </div>
      )}
    </motion.div>
  );
});

export default GiftCard;
