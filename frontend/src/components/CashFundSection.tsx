import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCashFund, createContribution, getContributions, boostEvent, createPromise } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { formatCOP, validateRedirectUrl } from '../utils/format';
import { useTurnstile } from '../hooks/useTurnstile';
import type { CashFund, CashContribution } from '../types';
import { TIER_LIMITS } from '../types';

const SUGGESTED_AMOUNTS = [30000, 50000, 100000, 200000];
const MAX_RECENT_CONTRIBUTIONS = 5;
const MAX_AMOUNT = 5000000;

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

const CashFundSection = memo(function CashFundSection({ eventId, isOwner, ownerTier, easyRead }: { eventId: string; isOwner: boolean; ownerTier?: string; easyRead?: boolean }) {
  const [fund, setFund] = useState<CashFund | null>(null);
  const [promisedTotal, setPromisedTotal] = useState(0);
  const [contributions, setContributions] = useState<CashContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [boostModal, setBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { containerRef, token: turnstileToken } = useTurnstile();
  const turnstileTokenRef = useRef(turnstileToken);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  const [turnstileBlocked, setTurnstileBlocked] = useState(false);

  const commission = TIER_LIMITS[ownerTier as keyof typeof TIER_LIMITS]?.cashFundCommission ?? 5;
  const canContribute = !isOwner && fund?.isActive;

  const loadFund = useCallback(async () => {
    try {
      const res = await getCashFund(eventId);
      setFund(res.cashFund);
      setPromisedTotal(res.promisedTotal ?? 0);
      if (res.cashFund) {
        const contribRes = await getContributions(res.cashFund.id);
        setContributions(contribRes.contributions.filter((c) => c.status === 'completed'));
      }
    } catch (err) {
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

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fund || contributing) return;

    const rawAmount = selectedAmount || amount;
    const parsedAmount = typeof rawAmount === 'string' ? Number(rawAmount) : rawAmount;
    if (!Number.isInteger(parsedAmount) || parsedAmount < 2000) {
      showToast('El monto mínimo es $2,000 COP', 'error');
      return;
    }
    if (parsedAmount > MAX_AMOUNT) {
      showToast(`El monto máximo es $${MAX_AMOUNT.toLocaleString('es-CO')} COP`, 'error');
      return;
    }
    const amountInCents = parsedAmount;
    if (!name.trim()) {
      showToast('Escribe tu nombre', 'error');
      return;
    }

    let token = turnstileToken;
    if (!token) {
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (turnstileTokenRef.current) { token = turnstileTokenRef.current; break; }
      }
    }

    if (!token) {
      setTurnstileBlocked(true);
      showToast('No se pudo verificar que no eres un robot. Si usas un bloqueador de anuncios, desactívalo o intenta con otro navegador.', 'error');
      return;
    }

    setContributing(true);
    try {
      const result = await createContribution({
        cashFundId: fund.id,
        contributorName: name.trim(),
        amount: amountInCents,
        message: message.trim() || undefined,
        turnstileToken: token ?? undefined,
      });

      if (result.redirectUrl) {
        const validatedUrl = validateRedirectUrl(result.redirectUrl);
        if (validatedUrl) {
          window.location.href = validatedUrl;
        } else {
          showToast('URL de pago inválida', 'error');
        }
        return;
      }

      setShowConfetti(true);
      confettiTimeoutRef.current = setTimeout(() => setShowConfetti(false), 3000);
      showToast('¡Gracias por tu contribución! 💛', 'success');
      setName('');
      setAmount('');
      setSelectedAmount(null);
      setMessage('');
      loadFund();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al procesar tu aporte. Verifica tus datos e intenta de nuevo.', 'error');
    } finally {
      setContributing(false);
    }
  };

  const handleBoost = async () => {
    setBoostLoading(true);
    try {
      const result = await boostEvent(eventId);
      if (result.url) {
        const validatedUrl = validateRedirectUrl(result.url);
        if (validatedUrl) {
          window.location.href = validatedUrl;
        } else {
          showToast('URL de pago inválida', 'error');
        }
      } else {
        showToast('Evento boosteado 🚀', 'success');
        setBoostModal(false);
        loadFund();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al activar Lluvia de Sobres. Intenta de nuevo.', 'error');
    } finally {
      setBoostLoading(false);
    }
  };

  const selectAmount = (_btn: HTMLElement, amt: number) => {
    setSelectedAmount(amt);
    setAmount('');
  };

  if (loading) {
    return (
      <div className={`mb-12 rounded-2xl bg-surface-container-high animate-pulse ${easyRead ? 'p-8 h-56' : 'p-6 h-48'}`} />
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
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
            >
              Activar por $10.000 COP
            </button>
          </div>
          {boostModal && (
            <BoostModal onConfirm={handleBoost} onClose={() => setBoostModal(false)} loading={boostLoading} />
          )}
        </section>
      );
    }
    return null;
  }

  const progressPercent = fund.targetAmount && fund.targetAmount > 0
    ? Math.min((fund.collectedAmount / fund.targetAmount) * 100, 100)
    : 0;

  const recentContributions = useMemo(() =>
    contributions.slice(-MAX_RECENT_CONTRIBUTIONS).reverse(),
    [contributions]
  );

  return (
    <div className="mb-12 relative">
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay />}
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
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
              <div className="flex justify-between text-xs font-bold text-secondary uppercase tracking-tighter">
                <span>{formatCOP(fund.collectedAmount)} de {formatCOP(fund.targetAmount || 0)}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden border border-secondary/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
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

            {/* Payment Method Badges */}
            <div className="grid grid-cols-3 gap-2 mt-6 w-full">
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">payments</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">Mercado Pago</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">verified_user</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">100% Garantizado</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-white/20 border border-white/30">
                <span className="material-symbols-outlined text-secondary text-lg mb-1">savings</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">Para el Anfitrión</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Turnstile (invisible) */}
      <div ref={containerRef} className="absolute -z-10 opacity-0 pointer-events-none" />
      {turnstileBlocked && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <span>No se pudo verificar que no eres un robot. Si usas un bloqueador de anuncios, desactívalo o intenta con otro navegador.</span>
        </div>
      )}

      {/* SECTION 2: FORMULARIO DE APORTE */}
      {canContribute && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">Realiza tu Aporte</h2>
          <div className="bg-surface rounded-3xl p-6 shadow-sm border border-surface-variant space-y-6">
            <div className="space-y-3">
              <p className="font-label-md text-label-md text-on-surface-variant">Selecciona un monto:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SUGGESTED_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={(e) => selectAmount(e.currentTarget, amt)}
                    className={`p-3 rounded-2xl border font-bold transition-all active:scale-95 ${
                      selectedAmount === amt
                        ? 'border-secondary bg-gradient-to-br from-secondary-container to-secondary text-white scale-105 shadow-md'
                        : 'border-surface-variant text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {formatCOP(amt).replace('$', '').replace('COP', '').trim()}K
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={handleContribute} className="space-y-4">
              <div className="relative">
                <label htmlFor="custom-amount" className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Monto Personalizado</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                  <input
                    id="custom-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setSelectedAmount(null); }}
                    placeholder="Otro valor"
                    min="2000"
                    inputMode="numeric"
                    enterKeyHint="next"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-surface-variant focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none bg-surface-container-low"
                  />
                </div>
              </div>
              <div className="relative">
                <label htmlFor="contributor-name" className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Tu Nombre</label>
                <input
                  id="contributor-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Familia Rodríguez"
                  autoComplete="name"
                  inputMode="text"
                  autoCapitalize="words"
                  enterKeyHint="go"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-surface-variant focus:ring-2 focus:ring-primary outline-none bg-surface-container-low"
                />
              </div>
              <div className="relative">
                <label htmlFor="contributor-message" className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Mensaje de Felicitación</label>
                <textarea
                  id="contributor-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe un mensaje especial para los anfitriones..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border border-surface-variant focus:ring-2 focus:ring-primary outline-none bg-surface-container-low resize-none"
                />
                <p className="text-[10px] text-right text-on-surface-variant mt-1">Máximo 500 caracteres</p>
              </div>
              <button
                type="submit"
                disabled={contributing}
                className="w-full bg-gradient-to-r from-secondary-container to-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-secondary/20 shimmer-bg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                {contributing ? <span className="flex items-center gap-2"><span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Procesando...</span> : 'Enviar mi aporte'}
              </button>
              <div className="pt-4 border-t border-surface-variant flex flex-col items-center gap-3">
                <p className="text-[10px] text-center text-on-surface-variant max-w-[200px]">
                  Comisión <span className="font-bold">{commission}%</span> de Fiesta y Lista por procesar el pago. Transacción segura con Mercado Pago.
                </p>
                <div className="flex items-center grayscale opacity-60">
                  <span className="text-xs font-bold text-on-surface-variant">Mercado Pago</span>
                </div>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* LA JARRA: Transferencia directa */}
      {fund && fund.bankPhone && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">💸 Transferencia Directa</h2>
          <div className="rounded-3xl p-6 border border-secondary/20 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(255,248,230,0.6), rgba(255,255,255,0.8))' }}>
            <p className="text-sm text-on-surface-variant mb-4">
              El anfitrión recibe transferencias directas. Usa los datos de abajo para enviar tu aporte y luego márcalo como enviado.
            </p>
            <div className="bg-white/60 rounded-2xl p-4 border border-secondary/10 mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">account_balance</span>
                <div>
                  <p className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wide">Tipo de cuenta</p>
                  <p className="font-bold text-on-surface">
                    {fund.bankType === 'nequi' && 'Nequi'}
                    {fund.bankType === 'daviplata' && 'Daviplata'}
                    {fund.bankType === 'bancolombia' && 'Bancolombia'}
                    {!['nequi', 'daviplata', 'bancolombia'].includes(fund.bankType || '') && (fund.bankType || 'Cuenta bancaria')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">smartphone</span>
                <div>
                  <p className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wide">Número</p>
                  <p className="font-bold text-on-surface text-lg tracking-wider">{fund.bankPhone}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(fund.bankPhone || ''); showToast('Número copiado 📋', 'success'); }}
                  className="ml-auto p-2 rounded-xl bg-primary-fixed/30 text-primary hover:bg-primary-fixed/50 transition-all"
                  aria-label="Copiar número"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                </button>
              </div>
            </div>

            {canContribute && <PromiseForm fundId={fund.id} loadFund={loadFund} />}
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
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
            >
              Activar
            </button>
          </div>
        </section>
      )}
    </div>
  );
});

function ConfettiOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl"
      >
        💛
      </motion.div>
      {Array.from({ length: 20 }).map((_, i) => (
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

  const handleSave = async () => {
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
      showToast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
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
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
            >
              <option value="nequi">Nequi</option>
              <option value="daviplata">Daviplata</option>
              <option value="bancolombia">Bancolombia</option>
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Número de teléfono"
              className="rounded-xl border border-outline-variant bg-surface text-on-surface px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all sm:col-span-2"
            />
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

function PromiseForm({ fundId, loadFund }: { fundId: string; loadFund: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    try {
      await createPromise({
        cashFundId: fundId,
        contributorName: name.trim(),
        amount: Number(amount),
        message: message.trim() || undefined,
      });
      setDone(true);
      showToast('¡Gracias por tu aporte! 💛 El anfitrión lo recibirá directo.', 'success');
      loadFund();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al registrar tu aporte', 'error');
    } finally {
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
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
          required
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-bold">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Monto"
            className="w-full pl-7 rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
            min="2000"
            required
          />
        </div>
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mensaje (opcional)"
        className="w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
      />
      <button
        type="submit"
        disabled={submitting || !name.trim() || !amount}
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

function BoostModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="w-full sm:max-w-md bg-surface p-6 rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <h3 className="text-lg font-bold text-on-surface mb-2">Activar Lluvia de Sobres</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          Activa el Cash Fund para este evento durante 30 días por solo <strong className="text-on-surface">$10.000 COP</strong>.
        </p>
        <ul className="space-y-2 text-sm text-on-surface-variant mb-6">
          <li className="flex items-center gap-2">✅ Recibe aportaciones de tus invitados</li>
          <li className="flex items-center gap-2">✅ 3x más visitas en tu lista</li>
          <li className="flex items-center gap-2">✅ Sin necesidad de suscripción mensual</li>
        </ul>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-on-surface-variant bg-surface-container-high rounded-xl hover:bg-surface-container-highest transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center">
            {loading ? '...' : 'Pagar $10.000 COP'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default CashFundSection;
