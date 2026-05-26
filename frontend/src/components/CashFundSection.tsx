import { useState, useEffect, useRef } from 'react';
import { getCashFund, createContribution, getContributions, boostEvent } from '../services/cashFund';
import { showToast } from '../hooks/useToast';
import { formatCOP } from '../utils/format';
import LoadingSpinner from './LoadingSpinner';
import type { CashFund, CashContribution } from '../types';

const SUGGESTED_AMOUNTS = [5000, 10000, 20000, 50000];
const MAX_RECENT_CONTRIBUTIONS = 5;

export default function CashFundSection({ eventId, isOwner, ownerTier }: { eventId: string; isOwner: boolean; ownerTier?: string }) {
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
  const isBoostNeeded = !isOwner && ownerTier === 'free';
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
      // fund not found
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
      <div className="mb-12 rounded-2xl p-6 bg-gray-100 dark:bg-gray-800 animate-pulse h-48" />
    );
  }

  if (!fund) {
    if (isOwner && ownerTier === 'free' && !isBoostNeeded) {
      return (
        <div className="mb-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">Activa la Lluvia de Sobres para recibir aportaciones</p>
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
    : fund.collectedAmount > 0 ? 50 : 0;

  const recentContributions = contributions.slice(-MAX_RECENT_CONTRIBUTIONS).reverse();

  return (
    <div className="mb-12 relative">
      {showConfetti && <ConfettiOverlay />}

      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 dark:from-emerald-600 dark:to-green-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-300 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">💰</span>
            <div>
              <h3 className="text-xl font-bold">{fund.title || 'Lluvia de Sobres'}</h3>
              {fund.description && (
                <p className="text-sm text-emerald-100">{fund.description}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-emerald-100">
                {formatCOP(fund.collectedAmount)} recaudados
              </span>
              {fund.targetAmount && (
                <span className="text-emerald-100">
                  meta: {formatCOP(fund.targetAmount)}
                </span>
              )}
            </div>
            <div className="w-full h-3 bg-emerald-800/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300 transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>

          {recentContributions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recentContributions.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs backdrop-blur-sm">
                  <span>💛</span>
                  <span>{c.contributorName}</span>
                  <span className="font-semibold">{formatCOP(c.amount)}</span>
                </span>
              ))}
            </div>
          )}

          {canContribute && (
            <form onSubmit={handleContribute} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm text-emerald-100 mb-2">Monto</label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { setSelectedAmount(amt); setAmount(''); }}
                      className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                        selectedAmount === amt
                          ? 'bg-white text-emerald-700 shadow-md'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {formatCOP(amt)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setSelectedAmount(null); }}
                  placeholder="Otro monto"
                  min="2000"
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-emerald-200 outline-none focus:ring-2 focus:ring-white/50 min-h-[44px]"
                />
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-emerald-200 outline-none focus:ring-2 focus:ring-white/50 min-h-[44px]"
                />
              </div>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensaje (opcional)"
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-emerald-200 outline-none focus:ring-2 focus:ring-white/50 min-h-[44px]"
              />

              <button
                type="submit"
                disabled={contributing}
                className="w-full py-3 px-6 bg-gradient-to-r from-yellow-400 to-amber-500 text-emerald-900 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all disabled:opacity-50 flex items-center justify-center min-h-[52px]"
              >
                {contributing ? <LoadingSpinner size="sm" /> : '💛 Aportar'}
              </button>

              <p className="text-xs text-center text-emerald-200">
                Comisión de {commission}% + $0.30. Procesado por Mercado Pago de forma segura.
              </p>
            </form>
          )}

          {!canContribute && !isOwner && (
            <p className="mt-4 text-sm text-emerald-200 text-center">
              {!fund.isActive ? 'Este fondo ya no está activo' : 'No disponible'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfettiOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="text-6xl animate-pop-in">💛</div>
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
    </div>
  );
}

function BoostModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 p-6 rounded-t-2xl sm:rounded-2xl animate-slide-up shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Activar Lluvia de Sobres</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Por solo <strong className="text-gray-900 dark:text-white">$4.99</strong> activa el Cash Fund para este evento durante 30 días. Recibe aportaciones económicas de tus invitados.
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
      </div>
    </div>
  );
}
