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
import ImageWithSkeleton from '../components/ImageWithSkeleton';

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

function AccessibilityToggle({ easyRead, onToggle }: { easyRead: boolean; onToggle: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all backdrop-blur-sm border min-h-[36px] ${
        easyRead
          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-300/40 shadow-lg shadow-rose-500/10'
          : 'bg-white/60 text-gray-500 border-gray-200/50 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700/50'
      }`}
      title={easyRead ? 'Modo normal' : 'Modo Lectura Fácil'}
    >
      <span className="flex items-center gap-1.5">
        {easyRead ? '🔤' : '⚙️'}
        {easyRead ? 'Normal' : 'Lectura Fácil'}
      </span>
    </motion.button>
  );
}

function EmptyGiftState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-4xl">
        🎁
      </div>
      <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">La lista de regalos se está preparando</p>
      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">¡Vuelve pronto para elegir el regalo perfecto!</p>
    </motion.div>
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
  const [easyReadMode, setEasyReadMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-400 to-fuchsia-500 flex items-center justify-center text-4xl shadow-xl shadow-rose-500/20 animate-float-slow"
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-4xl">
            😕
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Evento no encontrado</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error || 'Este evento no existe o ha sido desactivado.'}</p>
          <a href="/" className="inline-flex px-6 py-3 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all min-h-[44px] items-center">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  const availableGifts = gifts.filter((g) => !g.isClaimed);
  const claimedGifts = gifts.filter((g) => g.isClaimed);

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

  const createdDate = event.createdAt
    ? new Date(event.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

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

      <div className={`min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19] transition-all duration-300 ${easyReadMode ? 'text-lg space-y-6' : ''}`}>
        {showConfetti && <PremiumConfetti />}

        {/* Immersive Header */}
        <div className="relative min-h-[360px] sm:min-h-[420px] overflow-hidden flex items-center">
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10 scale-110"
            style={{ backgroundImage: `url(${HERO_BG[event.eventType] || '/backgrounds/hero-pattern.png'})`, y: parallaxY }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/60 to-white dark:from-gray-900/20 dark:via-gray-900/70 dark:to-gray-900" />

          {/* Gradient orbs overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />
          </div>

          <div className="relative w-full px-4 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              {/* Event Icon */}
              <div
                className={`inline-flex items-center justify-center rounded-2xl bg-white/70 dark:bg-white/10 backdrop-blur-md mb-5 shadow-lg ${easyReadMode ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-16 h-16 sm:w-20 sm:h-20'}`}
                style={{ boxShadow: `0 4px 20px ${THEME_COLORS[event.eventType]?.primary || '#ec4899'}20` }}
              >
                <span className={easyReadMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}>{EVENT_ICONS[event.eventType]}</span>
              </div>

              {/* Event Title */}
              <h1 className={`font-black text-gray-900 dark:text-white mb-2 font-outfit leading-tight ${easyReadMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>
                {event.title}
              </h1>

              {/* Event Type Badge */}
              <p className={`text-gray-500 dark:text-gray-400 mb-3 inline-flex items-center gap-2 px-4 py-1.5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-full border border-white/20 dark:border-gray-700/50 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
                {EVENT_ICONS[event.eventType]} {EVENT_LABELS[event.eventType]}
              </p>

              {/* Created date */}
              {createdDate && (
                <span className="text-gray-400 dark:text-gray-500 inline-flex items-center gap-1.5 text-sm">
                  <span>📅</span>
                  <span>Creado el {createdDate}</span>
                </span>
              )}
            </motion.div>
          </div>

          {/* Accessibility Toggle */}
          <div className="absolute top-4 right-4 z-20">
            <AccessibilityToggle easyRead={easyReadMode} onToggle={() => setEasyReadMode(!easyReadMode)} />
          </div>
        </div>

        {/* Main Content */}
        <div className={`max-w-4xl mx-auto px-4 ${easyReadMode ? 'py-8 space-y-10' : 'py-12 space-y-8'}`}>
          {/* Share */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ShareButtons slug={event.slug} title={event.title} />
          </motion.div>

          {/* Cash Fund */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <CashFundSection eventId={event.id} isOwner={false} easyRead={easyReadMode} />
          </motion.div>

          {/* Photos Gallery */}
          {photos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className={easyReadMode ? 'space-y-6' : ''}
            >
              <h2 className={`font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 ${easyReadMode ? 'text-2xl' : 'text-lg'}`}>
                <span>📸</span> Galería
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <motion.div
                    key={photo.id}
                    whileHover={{ scale: 1.03 }}
                    className="relative overflow-hidden bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-200/50 dark:ring-gray-700/50 rounded-xl group"
                  >
                    <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-[4/3]" />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-xs">{photo.caption}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Gift List Section */}
          <div className={easyReadMode ? 'space-y-8' : ''}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-between mb-6"
            >
              <h2 className={`font-bold text-gray-900 dark:text-white flex items-center gap-2 ${easyReadMode ? 'text-3xl' : 'text-xl'}`}>
                🎁 Lista de Regalos
                <span className={`font-normal text-gray-500 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
                  ({availableGifts.length} disponibles)
                </span>
              </h2>
              {gifts.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{claimedGifts.length} apartados</span>
                </div>
              )}
            </motion.div>

            {gifts.length === 0 && <EmptyGiftState />}

            {/* Name Input */}
            <div className="mb-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="Escribe tu nombre para apartar un regalo"
                  className={`w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-400 transition-all backdrop-blur-sm shadow-sm ${easyReadMode ? 'px-6 py-4 text-lg min-h-[56px]' : 'px-5 py-3.5 text-sm min-h-[48px]'}`}
                />
              </div>
            </div>

            {/* Category Filters */}
            {categories.length > 1 && (
              <div ref={filterBarRef} className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 mb-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] ${
                      categoryFilter === null
                        ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-rose-300'
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
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-rose-300'
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

            {/* Available Gifts Grid */}
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredGifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    onClaim={handleClaim}
                    claimingId={claimingId}
                    easyRead={easyReadMode}
                  />
                ))}
              </div>
            </AnimatePresence>

            {/* Claimed Gifts */}
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
                        easyRead={easyReadMode}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className={`text-center pt-8 border-t border-gray-200 dark:border-gray-700 ${easyReadMode ? 'text-gray-500' : 'text-sm text-gray-500 dark:text-gray-400'}`}>
            <p>Hecho con 🎉 por <a href="/" className="text-rose-600 hover:text-rose-700 font-medium">Fiesta y Lista</a></p>
          </div>
        </div>
      </div>
    </>
  );
}
