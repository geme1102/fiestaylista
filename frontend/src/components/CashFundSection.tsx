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

      <div className="rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #065F46, #047857, #059669)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          boxShadow: '0 4px 24px rgba(217, 119, 6, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-yellow-300 rounded-full blur-3xl animate-aurora" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-400 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '-7s' }} />
        </div>

        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-400/20 backdrop-blur-sm text-yellow-300 text-[10px] font-bold rounded-full border border-yellow-400/30">
            🔒 Transacción 100% segura
          </span>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl shadow-lg shadow-yellow-500/30">
              💰
            </div>
            <div>
              <h3 className="text-xl font-bold font-outfit">{fund.title || 'Lluvia de Sobres'}</h3>
              {fund.description && (
                <p className="text-sm text-emerald-100">{fund.description}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-emerald-100 font-medium">
                {formatCOP(fund.collectedAmount)} recaudados
              </span>
              {fund.targetAmount && (
                <span className="text-emerald-200">
                  Meta: {formatCOP(fund.targetAmount)}
                </span>
              )}
            </div>
            <div className="w-full h-3 bg-emerald-800/40 rounded-full overflow-hidden ring-1 ring-yellow-500/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 transition-all duration-1000 ease-out shadow-lg shadow-yellow-500/30"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>

          {recentContributions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recentContributions.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs border border-white/10">
                  <span>💛</span>
                  <span className="font-medium">{c.contributorName}</span>
                  <span className="font-semibold text-yellow-300">{formatCOP(c.amount)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-200/80">
            <span className="flex items-center gap-1">🔐 Procesado por <strong>Mercado Pago</strong></span>
            <span className="w-1 h-1 rounded-full bg-emerald-600" />
            <span className="flex items-center gap-1">💰 El dinero va directo al anfitrión</span>
          </div>

          {canContribute && (
            <form onSubmit={handleContribute} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm text-emerald-100 mb-2 font-medium">Elige un monto</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SUGGESTED_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { setSelectedAmount(amt); setAmount(''); }}
                      className={`px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all border ${
                        selectedAmount === amt
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-emerald-900 border-yellow-300 shadow-lg shadow-yellow-500/30 scale-105'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30'
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
                  placeholder="Monto personalizado"
                  min="2000"
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/60 outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 min-h-[44px] transition-all"
                />
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/60 outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 min-h-[44px] transition-all"
                />
              </div>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensaje para los anfitriones (opcional)"
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/60 outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 min-h-[44px] transition-all"
              />

              <button
                type="submit"
                disabled={contributing}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-emerald-900 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-yellow-500/30 transition-all disabled:opacity-50 flex items-center justify-center min-h-[52px]"
              >
                {contributing ? <LoadingSpinner size="sm" /> : '💛 Aportar ahora'}
              </button>

              <p className="text-[11px] text-center text-emerald-200/70">
                Comisión de {commission}% + $0.30. Pagos procesados de forma segura por Mercado Pago.
              </p>
            </form>
          )}

          {!canContribute && !isOwner && (
            <p className="mt-4 text-sm text-emerald-200/70 text-center">
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
