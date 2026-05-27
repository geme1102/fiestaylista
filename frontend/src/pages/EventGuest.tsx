import { useState, useEffect, useRef, useMemo } from 'react';
import { useScroll, useTransform } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import ShareButtons from '../components/ShareButtons';
import CashFundSection from '../components/CashFundSection';
import GiftCard from '../components/GiftCard';
import { showToast } from '../hooks/useToast';
import { EVENT_LABELS, EVENT_ICONS, THEME_COLORS, type EventType, type Gift, type Photo } from '../types';
import { getGiftCategory } from '../data/giftEmojis';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; isActive: boolean; createdAt: string;
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
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-4xl shadow-xl shadow-pink-500/20 animate-float-slow"
          >
            🎁
          </motion.div>
          <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse font-outfit">Cargando lista de regalos...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="text-center max-w-sm">
          <img src="/illustrations/illustration-404.png" alt="Evento no encontrado" loading="lazy" className="w-48 h-48 mx-auto mb-6" />
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
  const [easyReadMode, setEasyReadMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: { label: string; color: string }[] = [];
    availableGifts.forEach((g) => {
      const c = getGiftCategory(g.name);
      if (!seen.has(c.label)) {
        seen.add(c.label);
        cats.push(c);
      }
    });
    return cats;
  }, [gifts]);

  const filteredGifts = categoryFilter
    ? availableGifts.filter((g) => getGiftCategory(g.name).label === categoryFilter)
    : availableGifts;

  const eventDate = event.createdAt ? new Date(event.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 400], [0, 80]);

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
      <div className={`min-h-screen bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 transition-all duration-300 ${easyReadMode ? 'text-lg space-y-6' : ''}`}>
      {showConfetti && <PremiumConfetti />}

      <div className="relative min-h-[340px] sm:min-h-[400px] overflow-hidden flex items-center">
        <motion.div
          className="absolute inset-0 bg-cover bg-center opacity-25 dark:opacity-10 scale-110"
          style={{ backgroundImage: `url(${HERO_BG[event.eventType] || '/backgrounds/hero-pattern.png'})`, y: parallaxY }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/70 to-white dark:from-gray-900/30 dark:via-gray-900/80 dark:to-gray-900" />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-15 blur-3xl" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />

        <div className="relative w-full px-4 py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/70 dark:bg-white/10 backdrop-blur-md mb-5 shadow-lg ${easyReadMode ? 'w-20 h-20 sm:w-24 sm:h-24' : ''}`}
              style={{ boxShadow: `0 4px 20px ${THEME_COLORS[event.eventType]?.primary || '#ec4899'}20` }}>
              <span className={`${easyReadMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{EVENT_ICONS[event.eventType]}</span>
            </div>
            <h1 className={`font-black text-gray-900 dark:text-white mb-2 font-outfit leading-tight ${easyReadMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>
              {event.title}
            </h1>
            <p className={`text-gray-500 dark:text-gray-400 mb-2 inline-flex items-center gap-2 px-4 py-1.5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-full ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
              {EVENT_ICONS[event.eventType]} {EVENT_LABELS[event.eventType]}
            </p>
            {eventDate && (
              <p className="text-gray-400 dark:text-gray-500 mt-3 flex items-center justify-center gap-1.5">
                <span>📅</span> <span className={easyReadMode ? 'text-base' : 'text-sm'}>{eventDate}</span>
              </p>
            )}
          </motion.div>
        </div>

        <div className="absolute top-4 right-4 z-20">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setEasyReadMode(!easyReadMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all backdrop-blur-sm border min-h-[36px] ${
              easyReadMode
                ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-300/40 shadow-lg shadow-pink-500/10'
                : 'bg-white/60 text-gray-500 border-gray-200/50 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700/50'
            }`}
            title={easyReadMode ? 'Modo normal' : 'Modo Lectura Fácil'}
          >
            {easyReadMode ? '🔤 Normal' : '🔤 Fácil'}
          </motion.button>
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
            className={`mb-12 ${easyReadMode ? 'space-y-6' : ''}`}
          >
            <h2 className={`font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 ${easyReadMode ? 'text-2xl' : 'text-lg'}`}>
              <span>📸</span> Galería
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  whileHover={{ scale: 1.03 }}
                  className="overflow-hidden bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-200/50 dark:ring-gray-700/50 clip-path-organic"
                >
                  <img src={photo.url} alt={photo.caption || 'Foto del evento'} loading="lazy" className="w-full aspect-[4/3] object-cover" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <div className={`mb-12 ${easyReadMode ? 'space-y-8' : ''}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-between mb-6"
          >
            <h2 className={`font-bold text-gray-900 dark:text-white flex items-center gap-2 ${easyReadMode ? 'text-3xl' : 'text-xl'}`}>
              🎁 Lista de Regalos
              <span className={`font-normal text-gray-500 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>({availableGifts.length} disponibles)</span>
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
              <img src="/illustrations/empty-guest.png" alt="Lista vacía" loading="lazy" className="w-64 h-64 mx-auto mb-6" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">La lista de regalos se está preparando</p>
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
                className={`w-full rounded-2xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-400 transition-all backdrop-blur-sm ${easyReadMode ? 'px-6 py-4 text-lg min-h-[56px]' : 'px-5 py-3.5 text-sm min-h-[48px]'}`}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
              />
            </div>
          </div>

          {categories.length > 1 && (
            <div ref={filterBarRef} className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 mb-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 w-max">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] ${
                    categoryFilter === null
                      ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-pink-300'
                  }`}
                >
                  🎁 Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setCategoryFilter(cat.label === categoryFilter ? null : cat.label)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] ${
                      categoryFilter === cat.label
                        ? 'text-white shadow-md'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-pink-300'
                    }`}
                    style={{
                      backgroundColor: categoryFilter === cat.label ? cat.color : undefined,
                      borderColor: categoryFilter === cat.label ? cat.color : undefined,
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredGifts.map((gift) => (
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
              <h3 className={`font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
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

        <div className={`text-center pt-8 border-t border-gray-200 dark:border-gray-700 ${easyReadMode ? 'text-gray-500' : 'text-sm text-gray-500 dark:text-gray-400'}`}>
          <p>Hecho con 🎉 por <a href="/" className="text-pink-600 hover:text-pink-700 font-medium">Fiesta y Lista</a></p>
        </div>
      </div>
      </div>
    </>
  );
}
