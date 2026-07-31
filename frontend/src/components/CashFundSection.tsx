import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getCashFund, getContributions, boostEvent, createPromise } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { reportError } from '../lib/reportError';
import { formatCOP } from '../utils/format';
import { useTurnstile, waitForTurnstile } from '../hooks/useTurnstile';
import Sheet from './ui/Sheet';
import { Skeleton } from './ui/Skeleton';
import type { CashFund, CashContribution } from '../types';

const MAX_RECENT_CONTRIBUTIONS = 5;

const INITIALS_COLORS = ['bg-secondary-fixed text-secondary', 'bg-primary-fixed text-primary', 'bg-tertiary-fixed text-tertiary'];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getInitialsBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

const CashFundSection = memo(function CashFundSection({ eventId, isOwner, easyRead, guestName }: { eventId: string; isOwner: boolean; easyRead?: boolean; guestName?: string }) {
  const [fund, setFund] = useState<CashFund | null>(null);
  const [promisedTotal, setPromisedTotal] = useState(0);
  const [contributions, setContributions] = useState<CashContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostModal, setBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boostSubmittingRef = useRef(false);

  const { containerRef: boostTurnstileRef, token: boostTurnstileToken } = useTurnstile();
  const boostTurnstileTokenRef = useRef(boostTurnstileToken);
  useEffect(() => { boostTurnstileTokenRef.current = boostTurnstileToken; }, [boostTurnstileToken]);

  const canContribute = !isOwner && fund?.isActive;

  const loadFund = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await getCashFund(eventId);
      setFund(res.cashFund);
      setPromisedTotal(res.promisedTotal ?? 0);
      if (res.cashFund) {
        try {
          const contribRes = await getContributions(res.cashFund.id);
          setContributions(contribRes.contributions.filter((c) => c.status === 'promised'));
        } catch (err) {
          reportError(err, { source: 'CashFundSection' });
          // guests cannot see contributions list, that's fine
        }
      }
    } catch (err) {
      reportError(err, { source: 'CashFundSection' });
      setLoadError(true);
      const message = err instanceof Error ? err.message : 'Error al cargar la Lluvia de Sobres. Recarga la página e intenta de nuevo.';
      showToast(message, 'error');
      if (import.meta.env.DEV) console.error('[CashFund] loadFund error:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadFund();
    return () => {
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
  }, [loadFund]);

  const milestoneCelebratedRef = useRef(false);
  useEffect(() => {
    if (!fund?.targetAmount || fund.targetAmount <= 0) return;
    const reached = fund.collectedAmount >= fund.targetAmount;
    if (reached && !milestoneCelebratedRef.current) {
      milestoneCelebratedRef.current = true;
      setShowConfetti(true);
      showToast('🌟 ¡Meta de recaudación alcanzada!', 'success');
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [fund?.collectedAmount, fund?.targetAmount]);

  const handleBoost = async () => {
    if (boostSubmittingRef.current) return;
    boostSubmittingRef.current = true;
    setBoostLoading(true);
    try {
      let token: string | null = boostTurnstileToken;
      if (!token) {
        token = await waitForTurnstile(() => boostTurnstileTokenRef.current);
      }
      await boostEvent(eventId, token ?? undefined);
      showToast('Lluvia de sobres activada 🚀', 'success');
      setBoostModal(false);
      loadFund();
    } catch (err) {
      reportError(err, { source: 'CashFundSection' });
      showToast(err instanceof Error ? err.message : 'Error al activar Lluvia de Sobres. Intenta de nuevo.', 'error');
    } finally {
      boostSubmittingRef.current = false;
      setBoostLoading(false);
    }
  };

  const recentContributions = useMemo(() =>
    contributions.slice(-MAX_RECENT_CONTRIBUTIONS).reverse(),
    [contributions]
  );

  if (loading) {
    return (
      <Skeleton className={`mb-12 rounded-2xl ${easyRead ? 'p-8 h-56' : 'p-6 h-48'}`} />
    );
  }

  if (loadError) {
    return (
      <div className="mb-12 rounded-2xl border border-red-200 bg-red-50/90 p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-red-400 mb-2" aria-hidden="true">error_outline</span>
        <p className="text-sm text-red-700 mb-4">No pudimos cargar la Lluvia de Sobres.</p>
        <button
          onClick={loadFund}
          className="px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl min-h-[44px]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // STATE: Inactive (Admin) — no fund yet
  if (!fund) {
    if (isOwner) {
      return (
        <section className="space-y-4 mb-12">
          <h2 className="font-headline-md text-headline-md text-on-surface">Configuración (Admin)</h2>
          <div className="border-2 border-dashed border-primary/40 rounded-3xl p-8 flex flex-col items-center text-center bg-white/50">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">add_circle</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Activa la Lluvia de Sobres</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">Permite que tus invitados te envíen regalos en efectivo de forma elegante y segura.</p>
            <button
              onClick={() => setBoostModal(true)}
              className="px-8 py-3 bg-gradient-to-r from-[#994715] to-[#833e12] text-white font-bold rounded-xl shadow-lg shadow-[#994715]/20 active:scale-95 btn-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#994715]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Activar gratis
            </button>
          </div>
          {boostModal && <div ref={boostTurnstileRef} className="hidden" />}
          <Sheet open={boostModal} onClose={() => setBoostModal(false)} ariaLabel="Activar Lluvia de Sobres">
            <div className="p-6 pb-safe-lg">
              <h3 className="text-lg font-bold text-on-surface mb-2">Activar Lluvia de Sobres</h3>
              <p className="text-sm text-on-surface-variant mb-4">
                Activa el Cash Fund para este evento durante 30 días <strong className="text-on-surface">gratis</strong>.
              </p>
              <ul className="space-y-2 text-sm text-on-surface-variant mb-6">
                <li className="flex items-center gap-2">✅ Recibe aportaciones de tus invitados</li>
                <li className="flex items-center gap-2">✅ 3x más visitas en tu lista</li>
                <li className="flex items-center gap-2">✅ Sin necesidad de suscripción mensual</li>
              </ul>
              <div className="flex gap-3">
                <button onClick={() => setBoostModal(false)} disabled={boostLoading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-on-surface-variant bg-surface-container-high rounded-xl hover:bg-surface-container-highest transition-colors">
                  Cancelar
                </button>
                <button onClick={handleBoost} disabled={boostLoading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-[#994715] to-[#833e12] rounded-xl hover:shadow-lg btn-gpu disabled:opacity-50 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#994715]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                  {boostLoading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Activar gratis'}
                </button>
              </div>
            </div>
          </Sheet>
        </section>
      );
    }
    return null;
  }

  const progressPercent = fund.targetAmount && fund.targetAmount > 0
    ? Math.min((fund.collectedAmount / fund.targetAmount) * 100, 100)
    : 0;

  return (
    <div className="mb-12 relative">
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay reduceMotion={shouldReduceMotion ?? false} />}
      </AnimatePresence>

      {/* SECTION 1: ESTADO ACTIVO (Vista Invitado) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Lluvia de Sobres</h2>
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            Seguridad Activa
          </span>
        </div>
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.15 : 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative rounded-3xl p-6 overflow-hidden shadow-xl shadow-secondary/10 transition-all duration-300"
          style={{
            background: 'rgba(255, 248, 230, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
          }}
        >
          {/* Background Orbs */}
          <div className="absolute w-32 h-32 bg-secondary-container top-[-20px] left-[-20px] rounded-full blur-[40px] opacity-50" style={{ animation: 'float 10s infinite alternate ease-in-out' }} />
          <div className="absolute w-24 h-24 bg-amber-200 bottom-[-10px] right-[-10px] rounded-full blur-[40px] opacity-50" style={{ animation: 'float 10s infinite alternate ease-in-out', animationDelay: '-2s' }} />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-secondary-container to-secondary rounded-2xl flex items-center justify-center shadow-lg mb-4 text-white">
              <span className="material-symbols-outlined text-4xl">mail</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-secondary mb-1">{fund.title || 'Lluvia de Sobres'}</h3>
            {fund.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">{fund.description}</p>
            )}
            {!fund.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">Tu aporte es el mejor regalo para nuestro futuro hogar.</p>
            )}
              <div className="w-full space-y-2 mb-8">
              <div className="flex flex-wrap justify-between gap-1 text-xs font-bold text-secondary uppercase tracking-tighter">
                <span className="min-w-0 truncate">{formatCOP(fund.collectedAmount)} / {formatCOP(fund.targetAmount || 0)}</span>
                <span className="shrink-0">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-secondary/10">
                <motion.div
                  initial={shouldReduceMotion ? { width: 0 } : { scaleX: 0 }}
                  animate={shouldReduceMotion ? { width: `${Math.min(progressPercent, 100)}%` } : { scaleX: Math.min(progressPercent, 100) / 100 }}
                  transition={shouldReduceMotion ? { duration: 0.3 } : { duration: 1.2, ease: 'easeOut' }}
                  style={shouldReduceMotion ? { height: '100%' } : { transformOrigin: 'left', width: '100%' }}
                  className="h-full bg-gradient-to-r from-secondary-container to-secondary shimmer-bg rounded-full"
                />
              </div>
              {promisedTotal > 0 && (
                <p className="text-xs text-on-surface-variant pt-1">
                  <span className="font-semibold">+ {formatCOP(promisedTotal)} prometido</span>
                  <span className="text-on-surface-variant/70"> (aportes por confirmar)</span>
                </p>
              )}
            </div>

            {/* Recent Contributions */}
            {recentContributions.length > 0 && (
              <div className="w-full bg-white/40 rounded-2xl p-4 border border-white/60 space-y-3">
                <h4 className="text-left font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">history</span>
                  Aportes Recientes
                </h4>
                {recentContributions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-white/60">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getInitialsBg(c.contributorName)}`}>
                        {getInitials(c.contributorName)}
                      </div>
                      <span className="font-label-md text-label-md text-on-surface">{c.contributorName}</span>
                    </div>
                    <span className="font-label-md text-label-md text-secondary">{formatCOP(c.amount)} COP</span>
                  </div>
                ))}
              </div>
            )}

            {/* La Jarra — Admin bank info config */}
            {isOwner && (
              <div className="w-full mt-6 pt-4 border-t border-secondary/10">
                <AdminBankConfig fund={fund} eventId={eventId} onUpdate={loadFund} />
              </div>
            )}

            {/* Badges */}
            <div className="grid grid-cols-3 gap-2 mt-6 w-full">
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">account_balance</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">Transferencia Directa</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">verified_user</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">100% Confiable</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">savings</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">Para el Anfitrión</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2: FORMULARIO DE APORTE (Honor system) */}
      {canContribute && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">Ya transferiste? Regístralo aquí</h2>
          <div className="rounded-3xl p-6 border border-secondary/20 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(255,248,230,0.6), rgba(255,255,255,0.8))' }}>
            <p className="text-sm text-on-surface-variant mb-4">
              Envía tu aporte directo a la cuenta del anfitrión y luego regístralo aquí para que aparezca en la lista.
            </p>
            {fund.bankPhone && (
              <BankContact phone={fund.bankPhone} bankType={fund.bankType ?? null} eventId={eventId} />
            )}
            <PromiseForm fundId={fund.id} loadFund={loadFund} guestName={guestName} />
          </div>
        </section>
      )}

      {/* SECTION 4: ESTADO CERRADO (Invitado) */}
      {!fund.isActive && !isOwner && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">Fondo Finalizado</h2>
          <div className="bg-surface-container-high rounded-3xl p-8 flex flex-col items-center text-center border border-outline-variant">
            <div className="w-12 h-12 rounded-full bg-on-surface-variant/10 flex items-center justify-center mb-4 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl">event_available</span>
            </div>
            <p className="font-headline-md text-headline-md text-on-surface-variant">Este fondo ya no está activo</p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Los anfitriones han cerrado la recepción de aportes. ¡Gracias por participar!</p>
          </div>
        </section>
      )}

      {/* SECTION 3: ESTADO INACTIVO (Admin) — when fund exists but is not active */}
      {!fund.isActive && isOwner && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">Configuración (Admin)</h2>
          <div className="border-2 border-dashed border-primary/40 rounded-3xl p-8 flex flex-col items-center text-center bg-white/50">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">add_circle</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Activa la Lluvia de Sobres</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">Permite que tus invitados te envíen regalos en efectivo de forma elegante y segura.</p>
            <button
              onClick={() => setBoostModal(true)}
              className="px-8 py-3 bg-gradient-to-r from-[#994715] to-[#833e12] text-white font-bold rounded-xl shadow-lg shadow-[#994715]/20 active:scale-95 btn-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#994715]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Activar
            </button>
          </div>
        </section>
      )}
    </div>
  );
});

function ConfettiOverlay({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
    >
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { scale: 0, rotate: -20 }}
        animate={reduceMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl"
      >
        💛
      </motion.div>
      {!reduceMotion && Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            fontSize: `${Math.random() * 16 + 12}px`,
          }}
        >
          {['✨', '💛', '🎉', '💰', '🌟'][Math.floor(Math.random() * 5)]}
        </div>
      ))}
    </motion.div>
  );
}

function AdminBankConfig({ fund, eventId, onUpdate }: { fund: CashFund; eventId: string; onUpdate: () => void }) {
  const [phone, setPhone] = useState(fund.bankPhone || '');
  const [type, setType] = useState(fund.bankType || 'nequi');
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const saveSubmittingRef = useRef(false);

  const handleSave = async () => {
    if (saveSubmittingRef.current) return;
    saveSubmittingRef.current = true;
    setSaving(true);
    try {
      const { apiClient } = await import('../services/api');
      await apiClient.put(`/api/events/${eventId}/cash-fund`, {
        bankPhone: phone.trim() || null,
        bankType: phone.trim() ? type : null,
      });
      showToast('Datos bancarios guardados ✅', 'success');
      onUpdate();
    } catch (err) {
      reportError(err, { source: 'AdminBankConfig' });
      showToast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      saveSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-base">account_balance</span>
        {show ? 'Cerrar' : 'Configurar datos para transferencia directa'}
      </button>
      {show && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-on-surface-variant/70">Comparte tu Nequi, Daviplata o Bancolombia para que los invitados te transfieran directo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="bank-type" className="sr-only">Tipo de cuenta</label>
              <select
                id="bank-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all select-custom"
              >
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="bancolombia">Bancolombia</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bank-phone" className="sr-only">Número de teléfono</label>
              <input
                id="bank-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Número de teléfono"
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="next"
                className="rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-[border-color,box-shadow]"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-secondary text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-h-[44px] flex items-center gap-2"
          >
            {saving ? (
              <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              'Guardar datos de transferencia'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function PromiseForm({ fundId, loadFund, guestName }: { fundId: string; loadFund: () => void; guestName?: string }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { containerRef, token: turnstileToken, reset: resetTurnstile } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  const promiseSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName?.trim() || !amount) {
      if (!guestName?.trim()) showToast('Debes ingresar tu nombre primero', 'error');
      else showToast('Ingresa un monto válido', 'error');
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 2000) {
      showToast('El monto debe ser un número entero mayor o igual a $2,000', 'error');
      return;
    }

    if (promiseSubmittingRef.current) return;
    promiseSubmittingRef.current = true;

    setSubmitting(true);
    try {
      let token = turnstileTokenRef.current;
      if (!token) {
        token = await waitForTurnstile(() => turnstileTokenRef.current);
      }
      await createPromise({
        cashFundId: fundId,
        contributorName: guestName!.trim(),
        amount: numericAmount,
        message: message.trim() || undefined,
        turnstileToken: token ?? undefined,
      });
      setDone(true);
      resetTurnstile();
      showToast('¡Gracias por tu aporte! 💛 El anfitrión lo recibirá directo.', 'success');
      loadFund();
    } catch (err) {
      reportError(err, { source: 'PromiseForm' });
      showToast(err instanceof Error ? err.message : 'Error al registrar tu aporte', 'error');
    } finally {
      promiseSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
        <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        <p className="text-sm font-semibold text-emerald-800">¡Aporte registrado! El anfitrión recibirá la notificación.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-bold text-on-surface">¿Ya transferiste? Regístralo aquí:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="promise-name" className="sr-only">Nombre</label>
          <input
            id="promise-name"
            type="text"
            value={guestName ?? ''}
            readOnly
            placeholder="Tu nombre"
            className="w-full rounded-xl border border-surface-variant bg-surface-container-high text-on-surface/70 px-4 py-3 text-sm outline-none cursor-default"
          />
        </div>
        <div className="relative">
          <label htmlFor="promise-amount" className="sr-only">Valor del aporte</label>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-bold">$</span>
          <input
            id="promise-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Monto"
            className="w-full pl-7 rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-[border-color,box-shadow]"
            inputMode="numeric"
            enterKeyHint="next"
            min="2000"
            required
          />
        </div>
      </div>
      <label htmlFor="promise-message" className="sr-only">Mensaje (opcional)</label>
      <input
        id="promise-message"
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mensaje (opcional)"
        autoCapitalize="sentences"
        enterKeyHint="go"
        className="w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-[border-color,box-shadow]"
      />
      <div ref={containerRef} />
      <button
        type="submit"
        disabled={submitting || !guestName?.trim() || !amount}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-secondary-container to-secondary text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center"
      >
        {submitting ? (
          <span className="block w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        ) : (
          '✅ Ya transferí'
        )}
      </button>
    </form>
  );
}

function BankContact({ phone, bankType, eventId }: { phone: string; bankType: string | null; eventId: string }) {
  const isMasked = phone.startsWith('****');
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const { containerRef, token: revealToken, reset: resetReveal } = useTurnstile();
  const revealTokenRef = useRef(revealToken);
  useEffect(() => { revealTokenRef.current = revealToken; }, [revealToken]);

  const displayPhone = revealedPhone || phone;

  const handleReveal = async () => {
    setRevealLoading(true);
    try {
      let token = revealTokenRef.current;
      if (!token) {
        token = await waitForTurnstile(() => revealTokenRef.current);
      }
      const { apiClient } = await import('../services/api');
      const res = await apiClient.post<{ bankPhone: string }>(
        `/api/events/${eventId}/cash-fund/reveal-phone`,
        { turnstileToken: token ?? undefined },
      );
      setRevealedPhone(res.bankPhone);
      resetReveal();
    } catch (err) {
      reportError(err, { source: 'BankContact' });
      showToast(err instanceof Error ? err.message : 'Error al revelar el número', 'error');
    } finally {
      setRevealLoading(false);
    }
  };

  const handleCopy = () => {
    const num = revealedPhone || phone;
    if (isMasked && !revealedPhone) return;
    navigator.clipboard.writeText(num).then(() => showToast('Número copiado 📋', 'success'));
  };

  return (
    <div className="bg-white/60 rounded-2xl p-4 border border-secondary/10 mb-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-secondary">account_balance</span>
        <div>
          <p className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wide">Tipo de cuenta</p>
          <p className="font-bold text-on-surface">
            {bankType === 'nequi' && 'Nequi'}
            {bankType === 'daviplata' && 'Daviplata'}
            {bankType === 'bancolombia' && 'Bancolombia'}
            {!['nequi', 'daviplata', 'bancolombia'].includes(bankType || '') && (bankType || 'Cuenta bancaria')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-secondary">smartphone</span>
        <div>
          <p className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wide">Número</p>
          <p className="font-bold text-on-surface text-lg tracking-wider">{displayPhone}</p>
        </div>
        {isMasked && !revealedPhone ? (
          <div className="ml-auto">
            <div ref={containerRef} />
            <button
              onClick={handleReveal}
              disabled={revealLoading}
              className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all flex items-center justify-center"
              aria-label="Revelar número"
            >
              {revealLoading ? (
                <span className="block w-4 h-4 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">visibility</span>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCopy}
            className="ml-auto p-2 min-h-[44px] min-w-[44px] rounded-xl bg-primary-fixed/30 text-primary hover:bg-primary-fixed/50 transition-all flex items-center justify-center"
            aria-label="Copiar número"
          >
            <span className="material-symbols-outlined text-base">content_copy</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default CashFundSection;
