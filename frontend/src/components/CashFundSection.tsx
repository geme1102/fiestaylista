import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCashFund, createContribution, getContributions, boostEvent } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { formatCOP } from '../utils/format';
import { validateRedirectUrl } from '../utils/format';
import type { CashFund, CashContribution } from '../types';
import { TIER_LIMITS } from '../types';

const SUGGESTED_AMOUNTS = [50000, 100000, 200000];
const MAX_RECENT_CONTRIBUTIONS = 5;

export default function CashFundSection({ eventId, isOwner, ownerTier, easyRead }: { eventId: string; isOwner: boolean; ownerTier?: string; easyRead?: boolean }) {
  const [fund, setFund] = useState<CashFund | null>(null);
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

  const commission = TIER_LIMITS[ownerTier as keyof typeof TIER_LIMITS]?.cashFundCommission ?? 4;
  const canContribute = !isOwner && fund?.isActive;

  useEffect(() => {
    loadFund();
    return () => {
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
  }, [eventId]);

  async function loadFund() {
    try {
      const res = await getCashFund(eventId);
      setFund(res.cashFund);
      if (res.cashFund) {
        const contribRes = await getContributions(res.cashFund.id);
        setContributions(contribRes.contributions.filter((c) => c.status === 'completed'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar fondo';
      showToast(message, 'error');
      console.error('[CashFund] loadFund error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fund) return;

    const amountInCents = selectedAmount || parseInt(amount, 10);
    if (!amountInCents || amountInCents < 2000) {
      showToast('El monto mínimo es $2,000 COP', 'error');
      return;
    }
    if (!name.trim()) {
      showToast('Escribe tu nombre', 'error');
      return;
    }

    setContributing(true);
    try {
      const result = await createContribution({
        cashFundId: fund.id,
        contributorName: name.trim(),
        amount: amountInCents,
        message: message.trim() || undefined,
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
      showToast(err instanceof Error ? err.message : 'Error al procesar contribución', 'error');
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
      showToast(err instanceof Error ? err.message : 'Error al boostear', 'error');
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
    if (isOwner && ownerTier === 'free') {
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
              Activar por $4.99
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

  const recentContributions = contributions.slice(-MAX_RECENT_CONTRIBUTIONS).reverse();

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function getInitialsBg(name: string) {
    const colors = ['bg-secondary-fixed text-secondary', 'bg-primary-fixed text-primary', 'bg-tertiary-fixed text-tertiary'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <div className="mb-12 relative">
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay />}
      </AnimatePresence>

      {/* SECTION 1: ESTADO ACTIVO (Vista Invitado) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Fondo Activo</h2>
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
            <h3 className="font-headline-md text-headline-md text-secondary mb-1">{fund.title || 'Lluvia de Sobres Digital'}</h3>
            {fund.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">{fund.description}</p>
            )}
            {!fund.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">Tu aporte es el mejor regalo para nuestro futuro hogar.</p>
            )}
            <div className="w-full space-y-2 mb-8">
              <div className="flex justify-between text-xs font-bold text-secondary uppercase tracking-tighter">
                <span>Meta Alcanzada</span>
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
                <span className="text-[10px] font-bold text-on-surface-variant uppercase text-center">Directo al Anfitrión</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2: FORMULARIO DE APORTE */}
      {canContribute && (
        <section className="space-y-4 mt-8">
          <h2 className="font-headline-md text-headline-md text-on-surface">Realiza tu Aporte</h2>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-variant space-y-6">
            <div className="space-y-3">
              <p className="font-label-md text-label-md text-on-surface-variant">Selecciona un monto:</p>
              <div className="grid grid-cols-3 gap-3">
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
                <label className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Monto Personalizado</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setSelectedAmount(null); }}
                    placeholder="Otro valor"
                    min="2000"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-surface-variant focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none bg-surface-container-low"
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Tu Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Familia Rodríguez"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-surface-variant focus:ring-2 focus:ring-primary outline-none bg-surface-container-low"
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-on-surface-variant mb-1 ml-1 uppercase">Mensaje de Felicitación</label>
                <textarea
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
                {contributing ? 'Procesando...' : 'Aportar ahora'}
              </button>
              <div className="pt-4 border-t border-surface-variant flex flex-col items-center gap-3">
                <p className="text-[10px] text-center text-on-surface-variant max-w-[200px]">
                  Comisión por servicio: <span className="font-bold">{commission}%</span>. Procesado de forma segura.
                </p>
                <div className="flex items-center grayscale opacity-60">
                  <span className="text-xs font-bold text-on-surface-variant">Mercado Pago</span>
                </div>
              </div>
            </form>
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
}

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

function BoostModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
          <li className="flex items-center gap-2">✅ Estadísticas básicas del evento</li>
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
