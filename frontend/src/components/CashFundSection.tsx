import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCashFund, createContribution, getContributions, boostEvent } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { formatCOP } from '../utils/format';
import LoadingSpinner from './LoadingSpinner';
import type { CashFund, CashContribution } from '../types';

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

  const commission = ownerTier === 'pro' ? 2 : 4;
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
    } catch {
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
        window.location.href = result.redirectUrl;
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
        window.location.href = result.url;
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

  if (loading) {
    return (
      <div className={`mb-12 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse ${easyRead ? 'p-8 h-56' : 'p-6 h-48'}`} />
    );
  }

  if (!fund) {
    if (isOwner && ownerTier === 'free') {
      return (
        <div className={`mb-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center ${easyRead ? 'p-8' : 'p-6'}`}>
          <p className={`text-gray-500 dark:text-gray-400 mb-4 ${easyRead ? 'text-lg' : ''}`}>Activa la Lluvia de Sobres para recibir aportaciones</p>
          <button
            onClick={() => setBoostModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all min-h-[44px]"
          >
            Activar por $4.99
          </button>
          {boostModal && (
            <BoostModal onConfirm={handleBoost} onClose={() => setBoostModal(false)} loading={boostLoading} />
          )}
        </div>
      );
    }
    return null;
  }

  const progressPercent = fund.targetAmount && fund.targetAmount > 0
    ? Math.min((fund.collectedAmount / fund.targetAmount) * 100, 100)
    : 0;

  const recentContributions = contributions.slice(-MAX_RECENT_CONTRIBUTIONS).reverse();

  return (
    <div className="mb-12 relative">
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className={`rounded-2xl relative overflow-hidden transition-all duration-300 ${easyRead ? 'p-8' : 'p-6 sm:p-8'} glass-card-gold`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl animate-aurora" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yellow-300/10 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '-7s' }} />
        </div>

        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400/15 backdrop-blur-sm text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-400/30">
            🔒 Candado de seguridad activa
          </span>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className={`rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 ${easyRead ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-2xl'}`}>
              ✉️
            </div>
            <div>
              <h3 className={`font-bold text-gray-900 dark:text-white font-outfit ${easyRead ? 'text-2xl' : 'text-xl'}`}>
                {fund.title || 'Lluvia de Sobres Digital'}
              </h3>
              {fund.description && (
                <p className={`text-gray-500 dark:text-gray-400 ${easyRead ? 'text-base' : 'text-sm'}`}>{fund.description}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className={`flex justify-between mb-1.5 ${easyRead ? 'text-base' : 'text-sm'}`}>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {formatCOP(fund.collectedAmount)} recaudados
              </span>
              {fund.targetAmount && (
                <span className="text-gray-500 dark:text-gray-400">
                  Meta: {formatCOP(fund.targetAmount)}
                </span>
              )}
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ring-1 ring-amber-500/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-[length:200%_100%] animate-cash-gold-shimmer shadow-lg shadow-amber-500/30"
              />
            </div>
          </div>

          {recentContributions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recentContributions.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-full text-xs border border-amber-200/30 dark:border-amber-800/20">
                  <span>💛</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{c.contributorName}</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCOP(c.amount)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <strong className="text-gray-700 dark:text-gray-300">Mercado Pago</strong>
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>100% garantizado</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>💰 El dinero va directo al anfitrión</span>
          </div>

          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            Procesado de forma segura y 100% garantizada por Mercado Pago
          </p>

          {canContribute && (
            <form onSubmit={handleContribute} className="mt-6 space-y-4">
              <div>
                <label className={`block text-gray-700 dark:text-gray-300 mb-2 font-medium ${easyRead ? 'text-lg' : 'text-sm'}`}>
                  Elige un monto
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SUGGESTED_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { setSelectedAmount(amt); setAmount(''); }}
                      className={`px-3 py-3 min-h-[48px] rounded-xl font-semibold transition-all border ${
                        selectedAmount === amt
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-amber-300 shadow-lg shadow-amber-500/25 scale-105'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md'
                      } ${easyRead ? 'text-lg' : 'text-sm'}`}
                    >
                      {formatCOP(amt)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setSelectedAmount(null); }}
                  placeholder="Monto personalizado"
                  min="2000"
                  className={`mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all ${easyRead ? 'px-5 py-3.5 text-lg min-h-[52px]' : 'px-4 py-3 text-sm min-h-[44px]'}`}
                />
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className={`flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all ${easyRead ? 'px-5 py-3.5 text-lg min-h-[52px]' : 'px-4 py-3 text-sm min-h-[44px]'}`}
                />
              </div>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensaje para los anfitriones (opcional)"
                maxLength={500}
                className={`w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all ${easyRead ? 'px-5 py-3.5 text-lg min-h-[52px]' : 'px-4 py-3 text-sm min-h-[44px]'}`}
              />

              <motion.button
                type="submit"
                disabled={contributing}
                whileHover={{ scale: 1.01, boxShadow: '0 8px 32px rgba(217,119,6,0.3)' }}
                whileTap={{ scale: 0.98 }}
                className={`w-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 bg-[length:200%_100%] animate-cash-gold-shimmer text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-amber-500/20 ${easyRead ? 'py-4 text-xl min-h-[56px]' : 'py-3.5 text-lg min-h-[52px]'}`}
              >
                {contributing ? <LoadingSpinner size="sm" /> : (
                  <span className="flex items-center justify-center gap-2">
                    ✉️ Aportar ahora
                  </span>
                )}
              </motion.button>

              <p className={`text-center text-gray-400 dark:text-gray-500 ${easyRead ? 'text-sm' : 'text-[11px]'}`}>
                Comisión de {commission}% + $0.30. Pagos procesados de forma segura por Mercado Pago.
              </p>
            </form>
          )}

          {!canContribute && !isOwner && (
            <p className={`mt-4 text-center text-gray-500 dark:text-gray-400 ${easyRead ? 'text-base' : 'text-sm'}`}>
              {!fund.isActive ? 'Este fondo ya no está activo' : 'No disponible'}
            </p>
          )}
        </div>
      </motion.div>
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
        className="w-full sm:max-w-md bg-white dark:bg-gray-800 p-6 rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Activar Lluvia de Sobres</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Por solo <strong className="text-gray-900 dark:text-white">$4.99</strong> activa el Cash Fund para este evento durante 30 días.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <li className="flex items-center gap-2">✅ Recibe aportaciones de tus invitados</li>
          <li className="flex items-center gap-2">✅ Estadísticas básicas del evento</li>
          <li className="flex items-center gap-2">✅ Sin necesidad de suscripción mensual</li>
        </ul>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-xl hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 min-h-[44px] text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center">
            {loading ? <LoadingSpinner size="sm" /> : 'Pagar $4.99'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
