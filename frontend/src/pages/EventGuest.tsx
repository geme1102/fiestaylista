import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import ShareButtons from '../components/ShareButtons';
import CashFundSection from '../components/CashFundSection';
import GiftCard from '../components/GiftCard';
import { showToast } from '../hooks/useToast';
import { EVENT_LABELS, EVENT_ICONS, type EventType, type Gift, type Photo } from '../types';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; isActive: boolean;
}

const HERO_BG: Record<string, string> = {
  BABY_SHOWER: '/backgrounds/hero-babyshower.png',
  WEDDING: '/backgrounds/hero-wedding.png',
  BIRTHDAY: '/backgrounds/hero-birthday.png',
  BAPTISM: '/backgrounds/hero-baptism.png',
  COMMUNION: '/backgrounds/hero-communion.png',
};

function PremiumConfetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-7xl"
        >
          🎉
        </motion.div>
      </div>
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{
            x: Math.random() * window.innerWidth,
            y: -100,
            rotate: 0,
            scale: 0.5 + Math.random() * 0.5,
          }}
          animate={{
            y: window.innerHeight + 100,
            rotate: 360 + Math.random() * 360,
            x: Math.random() * window.innerWidth,
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: 'easeIn',
          }}
        >
          <img
            src={`/confetti/confetti-${['star', 'heart', 'circle', 'diamond', 'ribbon'][Math.floor(Math.random() * 5)]}.svg`}
            alt=""
            className="w-8 h-8"
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function EventGuest() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!slug) return;
    loadEvent();
    return () => {
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    };
  }, [slug]);

  async function loadEvent() {
    try {
      const data = await getEventBySlug(slug!);
      if (!data.event.isActive) {
        setError('Este evento no está disponible');
        setLoading(false);
        return;
      }
      setEvent(data.event);
      setGifts(data.gifts || []);
      setPhotos(data.photos || []);
    } catch {
      setError('Evento no encontrado');
    } finally {
      setLoading(false);
    }
  }

  const handleClaim = async (giftId: string, giftName: string) => {
    if (!claimName.trim()) {
      showToast('Escribe tu nombre para apartar el regalo', 'error');
      inputRef.current?.focus();
      return;
    }
    setClaimingId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${slug}/gifts/${giftId}/claim`, {
        claimedBy: claimName.trim(),
      });
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
      setShowConfetti(true);
      confettiTimeoutRef.current = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
      setClaimName('');
      showToast(`¡${giftName} apartado! 🎉`, 'success');
    } catch {
      showToast('Error al apartar el regalo', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="text-center">
          <video
            src="/animations/gift-loading.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-32 h-32 mx-auto mb-4"
          />
          <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Cargando lista de regalos...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="text-center max-w-sm">
          <img src="/illustrations/illustration-404.png" alt="" loading="lazy" className="w-48 h-48 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Evento no encontrado</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error || 'Este evento no existe o ha sido desactivado.'}</p>
          <a href="/" className="inline-flex px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all min-h-[44px] items-center">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  const availableGifts = gifts.filter((g) => !g.isClaimed);
  const claimedGifts = gifts.filter((g) => g.isClaimed);

  return (
    <>
      <Helmet>
        <title>{event.title} - Fiesta y Lista</title>
        <meta name="description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}. Elige y aparta tu regalo para celebrar con ellos.`} />
        <meta property="og:title" content={`${event.title} - Fiesta y Lista`} />
        <meta property="og:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}.`} />
        <meta property="og:url" content={`https://fiestaylista.com/e/${event.slug}`} />
        <meta name="twitter:title" content={`${event.title} - Fiesta y Lista`} />
        <meta name="twitter:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}.`} />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {showConfetti && <PremiumConfetti />}

      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG[event.eventType] || '/backgrounds/hero-pattern.png'})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white dark:via-gray-900/60 dark:to-gray-900" />
        <div className="relative py-16 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-5xl mb-4 inline-block animate-float-slow">{EVENT_ICONS[event.eventType]}</div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-2">{event.title}</h1>
            <p className="text-gray-500 dark:text-gray-400">{EVENT_LABELS[event.eventType]}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ShareButtons slug={event.slug} title={event.title} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <CashFundSection eventId={event.id} isOwner={false} />
        </motion.div>

        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mb-12"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📸</span> Galería
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  whileHover={{ scale: 1.03 }}
                  className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', willChange: 'transform' }}
                >
                  <img src={photo.url} alt={photo.caption || ''} loading="lazy" className="w-full h-36 sm:h-40 object-cover" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-between mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🎁 Lista de Regalos
              <span className="text-sm font-normal text-gray-500">({availableGifts.length} disponibles)</span>
            </h2>
            {gifts.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{claimedGifts.length} apartados</span>
              </div>
            )}
          </motion.div>

          {gifts.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <img src="/illustrations/empty-guest.png" alt="" loading="lazy" className="w-64 h-64 mx-auto mb-6" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">La lista de regalos se está preparando</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">¡Vuelve pronto para elegir el regalo perfecto!</p>
            </motion.div>
          )}

          <div className="mb-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Escribe tu nombre para apartar un regalo"
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-400 transition-all min-h-[48px] backdrop-blur-sm"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
              />
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableGifts.map((gift) => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  onClaim={handleClaim}
                  claimingId={claimingId}
                />
              ))}
            </div>
          </AnimatePresence>

          {claimedGifts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span>💝</span>
                Ya apartados ({claimedGifts.length})
              </h3>
              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {claimedGifts.map((gift) => (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      isAdmin={false}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p>Hecho con 🎉 por <a href="/" className="text-pink-600 hover:text-pink-700 font-medium">Fiesta y Lista</a></p>
        </div>
      </div>
      </div>
    </>
  );
}
