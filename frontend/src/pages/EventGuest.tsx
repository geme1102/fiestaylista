import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import GiftCard from '../components/GiftCard';
import RsvpForm from '../components/RsvpForm';
import GuestPhotoUpload from '../components/GuestPhotoUpload';
import MessageWall from '../components/MessageWall';
import type { ConfettiCanvasRef } from '../components/ConfettiCanvas';

const CashFundSection = lazy(() => import('../components/CashFundSection'));
const PhotoSlideshow = lazy(() => import('../components/PhotoSlideshow'));
const ConfettiCanvas = lazy(() => import('../components/ConfettiCanvas').then(m => ({ default: m.ConfettiCanvas })));
import { useEventPage } from '../hooks/useEventPage';
import { EVENT_LABELS, EVENT_ICONS, THEME_COLORS } from '../types';
import ImageWithSkeleton from '../components/ImageWithSkeleton';
import { apiClient } from '../services/api';
import { getGiftCategory } from '../data/giftEmojis';

function sanitizeForJSON(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

function EmptyGiftState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      role="status"
      className="text-center py-16"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed/50 flex items-center justify-center text-4xl">
        🎁
      </div>
      <p className="text-on-surface-variant font-medium text-lg">La lista de regalos se está preparando</p>
      <p className="text-surface-variant text-sm mt-1">¡Vuelve pronto para elegir el regalo perfecto!</p>
      <p className="text-surface-variant text-xs mt-4">Mientras tanto, comparte este evento con quien pueda querer apartar algo ✨</p>
    </motion.div>
  );
}

export default function EventGuest() {
  const {
    event, gifts, photos, loading, error,
    claimingId, guestName, setGuestName, shaking,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    inputRef, filterBarRef,
    availableGifts, claimedGifts, categories, filteredGifts,
    eventDateFormatted, eventTimeFormatted,
    turnstileRef,
    handleClaim, handleDownload, reloadEvent,
  } = useEventPage();

  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  const [lastClaimedGift, setLastClaimedGift] = useState('');
  const [lastClaimedBy, setLastClaimedBy] = useState('');
  const claimNameRef = useRef(guestName);
  const handleClaimRef = useRef(handleClaim);
  handleClaimRef.current = handleClaim;
  const handleClaimWithRef = useCallback((id: string, name: string) => {
    setLastClaimedGift(name);
    setLastClaimedBy(claimNameRef.current);
    handleClaimRef.current(id, name);
  }, []);

  const displayNote = event?.eventNote;

  const confettiRef = useRef<ConfettiCanvasRef>(null);
  const viewedEventRef = useRef<string | null>(null);

  useEffect(() => {
    if (!event || viewedEventRef.current === event.id) return;
    viewedEventRef.current = event.id;
    apiClient.post('/api/analytics/view', { eventId: event.id }, { skipAuthRedirect: true }).catch(() => {});
  }, [event]);

  useEffect(() => {
    if (showConfetti) {
      confettiRef.current?.triggerBurst();
    }
  }, [showConfetti]);

  useEffect(() => {
    const timer = setTimeout(() => {
      confettiRef.current?.triggerBurst();
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    claimNameRef.current = guestName;
  }, [guestName]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-surface animate-pulse">
        <div className="pt-16 w-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/30 via-surface to-secondary-fixed/10 -z-10" />
          <div className="px-4 pt-10 pb-12 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-surface-container-highest mb-6" />
            <div className="h-6 w-32 bg-surface-container-highest rounded-full mb-4" />
            <div className="h-10 w-64 bg-surface-container-highest rounded-xl mb-2" />
            <div className="h-5 w-40 bg-surface-container-highest rounded-lg mb-6" />
            <div className="h-8 w-36 bg-surface-container-highest rounded-full" />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10 space-y-8 py-12">
          <div className="flex gap-4 justify-center">
            <div className="h-10 w-24 bg-surface-container-highest rounded-xl" />
            <div className="h-10 w-24 bg-surface-container-highest rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-8 w-48 bg-surface-container-highest rounded-lg" />
            <div className="h-12 w-full bg-surface-container-highest rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-surface-container-highest rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-fixed/10 via-surface to-surface px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-fixed to-primary-fixed/50 flex items-center justify-center text-4xl">
            😕
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">Evento no encontrado</h1>
          <p className="text-on-surface-variant mb-6">{error || 'Este evento no existe o ha sido desactivado.'}</p>
          <a href="/" className="inline-flex px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold hover:shadow-lg transition-all min-h-[44px] items-center">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{event.title} - Fiesta y Lista</title>
        <meta name="description" content={`Lista de regalos para ${event.title} (${EVENT_LABELS[event.eventType]}). Aparta tu regalo y celebra con ellos. Fiesta y Lista — la app de listas de regalos.`} />
        <meta name="keywords" content={`fiestaylista, lista de regalos, ${EVENT_LABELS[event.eventType]}, ${event.title}, apartar regalo`} />
        <meta property="og:title" content={`${event.title} - Fiesta y Lista`} />
        <meta property="og:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}. Aparta tu regalo en Fiesta y Lista.`} />
        <meta property="og:url" content={`https://fiestaylista.com/e/${event.slug}`} />
        <meta property="og:locale" content="es_CO" />
        {photos.length > 0 && (
          <>
            <meta property="og:image" content={photos[0].url} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`Lista de regalos: ${event.title}`} />
          </>
        )}
        <meta name="twitter:title" content={`${event.title} - Fiesta y Lista`} />
        <meta name="twitter:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}.`} />
        <meta name="twitter:card" content="summary_large_image" />
        {photos.length > 0 && (
          <meta name="twitter:image" content={photos[0].url} />
        )}
        <link rel="canonical" href={`https://fiestaylista.com/e/${event.slug}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": sanitizeForJSON(event.title),
            "description": sanitizeForJSON(`Lista de regalos para ${event.title} (${EVENT_LABELS[event.eventType]})`),
            "url": `https://fiestaylista.com/e/${event.slug}`,
            "inLanguage": "es-CO",
            "isAccessibleForFree": true,
            ...(event.eventDate ? { "startDate": event.eventDate } : {}),
            ...(event.eventLocation ? { "location": { "@type": "Place", "name": sanitizeForJSON(event.eventLocation) } } : {}),
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "organizer": {
              "@type": "Person",
              "name": sanitizeForJSON(event.title.split(' ')[0] || "Anfitrión")
            }
          })}
        </script>
      </Helmet>

      <main className={`min-h-screen bg-surface transition-all duration-300 pb-20 ${easyReadMode ? 'text-lg space-y-6' : ''}`}>
        <Suspense fallback={null}><ConfettiCanvas ref={confettiRef} /></Suspense>

        <header className="fixed top-0 left-0 w-full z-50 crystal-nav border-b border-white/20 flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-headline-md text-headline-md font-black text-primary">Fiesta y Lista</Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              data-testid="scroll-to-gifts"
              onClick={() => document.getElementById('gift-list')?.scrollIntoView({ behavior: 'smooth' })}
              className="material-symbols-outlined text-primary cursor-pointer p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Ir a la lista de regalos"
            >
              shopping_bag
            </button>
          </div>
        </header>

        {/* Turnstile (invisible) */}
        <div ref={turnstileRef} aria-hidden="true" className="absolute -z-10 opacity-0 pointer-events-none" />

        <section className="pt-16 w-full overflow-hidden relative">
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-colors duration-700" style={{ background: `${THEME_COLORS[event.eventType]?.primary}20` }} />
          <div className="absolute top-1/4 right-0 w-72 h-72 rounded-full blur-[100px] pointer-events-none translate-x-1/3 transition-colors duration-700"                 style={{ background: `${THEME_COLORS[event.eventType]?.light}` }} />
          <div className="absolute bottom-1/3 left-10 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-700" style={{ background: `${THEME_COLORS[event.eventType]?.light}` }} />

          <div className="px-4 pt-10 pb-12">
            <motion.header
              initial={{ opacity: 0, y: -25, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="vintage-wedding-frame rounded-[40px] p-8 md:p-14 flex flex-col items-center text-center mb-12 relative overflow-hidden shadow-2xl border-2"
              style={{
                background: 'rgba(255,255,255,0.85)',
                borderColor: `${THEME_COLORS[event.eventType]?.primary}25`,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#00000005_1px,transparent_1px)] [background-size:16px_16px] opacity-70 pointer-events-none" />

              <div className="relative mb-6 z-10">
                <div
                  className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 transition-all duration-500 floating-logo"
                  style={{ boxShadow: `0 0 0 4px ${THEME_COLORS[event.eventType]?.primary}30` }}
                >
                  <span className="text-4xl select-none filter drop-shadow-sm">
                 {EVENT_ICONS[event.eventType]}
                  </span>
                </div>
                <span className="absolute -top-1 -left-2 text-yellow-500 text-lg sparkle-fast pointer-events-none select-none">✦</span>
                <span className="absolute -bottom-1 -right-2 text-pink-400 text-xl sparkle-slow pointer-events-none select-none">★</span>
                <span className="absolute top-12 -right-6 text-amber-500 text-sm sparkle-slow pointer-events-none select-none">✨</span>
              </div>

              <span
                className="text-[10px] uppercase font-extrabold tracking-[0.25em] px-4 py-1.5 rounded-full border animate-pulse font-display shadow-xs mb-4"
                style={{
                  color: THEME_COLORS[event.eventType]?.primary,
                  backgroundColor: `${THEME_COLORS[event.eventType]?.primary}12`,
                  borderColor: `${THEME_COLORS[event.eventType]?.primary}35`,
                }}
              >
                {EVENT_LABELS[event.eventType]}
              </span>

              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 px-4">
                <span className="gold-metallic-gradient-text">{event.title}</span>
              </h1>

              <div
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-5 mb-6 text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-2xl border shadow-xs"
                style={{
                  color: THEME_COLORS[event.eventType]?.primary,
                  backgroundColor: `${THEME_COLORS[event.eventType]?.primary}08`,
                  borderColor: `${THEME_COLORS[event.eventType]?.primary}25`,
                }}
              >
                <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ color: THEME_COLORS[event.eventType]?.primary }}>card_giftcard</span>
                    {availableGifts.length} regalos{claimedGifts.length > 0 ? ` · ${claimedGifts.length} apartados` : ''}
                  </span>
                  {eventDateFormatted && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ color: THEME_COLORS[event.eventType]?.primary }}>calendar_month</span>
                    {eventDateFormatted}{eventTimeFormatted ? ` • ${eventTimeFormatted}` : ''}
                  </span>
                )}
                {event?.eventLocation && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ color: THEME_COLORS[event.eventType]?.primary }}>location_on</span>
                    {event.eventLocation}
                  </span>
                )}
              </div>

              {displayNote && (
                <p className="font-body-lg text-body-lg italic font-semibold tracking-wide max-w-lg mb-8 leading-relaxed" style={{ color: THEME_COLORS[event.eventType]?.primary }}>
                  &ldquo;{displayNote}&rdquo;
                </p>
              )}

              <div className="flex items-center gap-3 px-4 py-2 rounded-full mb-6 z-10" style={{ backgroundColor: `${THEME_COLORS[event.eventType]?.primary}08`, border: `1px solid ${THEME_COLORS[event.eventType]?.primary}20` }}>
                <span className="font-bold text-xs uppercase tracking-wider" style={{ color: THEME_COLORS[event.eventType]?.primary }}>
                  Texto más grande
                </span>
                <button
                  onClick={() => setEasyReadMode(!easyReadMode)}
                  role="switch"
                  aria-checked={easyReadMode}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${easyReadMode ? 'bg-primary' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${easyReadMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="w-full max-w-md mt-6">
                <label htmlFor="guest-name" className="block text-sm font-semibold text-on-surface mb-1.5">Tu nombre</label>
                <input
                  ref={inputRef}
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Escribe tu nombre"
                  autoComplete="name"
                  inputMode="text"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  className={`w-full rounded-2xl border outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all backdrop-blur-sm shadow-sm ${shaking ? 'animate-shake border-red-400 ring-2 ring-red-300' : 'border-outline-variant bg-surface/80 text-on-surface'} ${easyReadMode ? 'px-6 py-4 text-lg min-h-[56px]' : 'px-5 py-3.5 text-sm min-h-[48px]'}`}
                />
              </div>
            </motion.header>
          </div>
        </section>

        <div className={`max-w-4xl mx-auto px-4 -mt-6 relative z-10 ${easyReadMode ? 'py-8 space-y-10' : 'py-12 space-y-8'}`}>
          {event.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-high border border-outline-variant/30 shadow-sm mb-4">
                <span className="text-lg">🎉</span>
                <span className="font-bold text-sm text-on-surface">Este evento ya fue</span>
              </div>
              <h2 className={`font-bold text-on-surface ${easyReadMode ? 'text-3xl' : 'text-2xl'}`}>¡Gracias a todos los que asistieron!</h2>
              <p className="text-on-surface-variant mt-2">Revive los mejores momentos compartiendo y viendo las fotos del evento.</p>
            </motion.div>
          )}

          {event.status !== 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <RsvpForm eventId={event.id} eventTitle={event.title} guestName={guestName} />
            </motion.div>
          )}

          {/* Gift List — primary action, shown first */}
          {event.status !== 'completed' && (
          <div className={easyReadMode ? 'space-y-8' : ''}>
            <motion.div
              id="gift-list"
              data-testid="gift-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center justify-between mb-6"
            >
              <h2 className={`font-bold text-on-surface flex items-center gap-2 ${easyReadMode ? 'text-3xl' : 'text-xl'}`}>
                🎁 Lista de Regalos
                <span className={`font-normal text-on-surface-variant ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
                  ({availableGifts.length} disponibles)
                </span>
              </h2>
              {gifts.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{claimedGifts.length} apartados</span>
                </div>
              )}
            </motion.div>

            {gifts.length === 0 && <EmptyGiftState />}

            {categories.length > 1 && (
              <div ref={filterBarRef} className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 mb-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    aria-pressed={categoryFilter === null}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[44px] ${
                      categoryFilter === null
  ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/20'
  : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary'
                    }`}
                  >
                    🎁 Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.label}
                      onClick={() => setCategoryFilter(cat.label === categoryFilter ? null : cat.label)}
                      aria-pressed={categoryFilter === cat.label}
                      className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[44px] ${
                        categoryFilter === cat.label
                          ? 'text-white shadow-md'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary'
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

            <AnimatePresence mode="wait">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredGifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    onClaim={handleClaimWithRef}
                    claimingId={claimingId === gift.id ? claimingId : null}
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
                <h3 className={`font-semibold text-on-surface-variant mb-4 uppercase tracking-wider flex items-center gap-2 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
                  <span>💝</span>
                  Ya apartados ({categoryFilter ? claimedGifts.filter((g) => getGiftCategory(g.name).label === categoryFilter).length : claimedGifts.length})
                </h3>
                <AnimatePresence mode="wait">
                  <div className="space-y-2">
                    {(categoryFilter ? claimedGifts.filter((g) => getGiftCategory(g.name).label === categoryFilter) : claimedGifts).map((gift) => (
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
          )}

          {/* Photo Gallery — secondary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={easyReadMode ? 'space-y-6' : ''}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-semibold text-on-surface flex items-center gap-2 ${easyReadMode ? 'text-2xl' : 'text-lg'}`}>
                <span>📸</span> Galería
              </h2>
              {photos.length > 1 && (
                <button
                  onClick={() => setSlideshowIndex(0)}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-primary-fixed/30 hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-sm">slideshow</span>
                  Presentación
                </button>
              )}
            </div>

            <GuestPhotoUpload eventId={event.id} onUploaded={reloadEvent} />

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                  <motion.div
                    key={photo.id}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setSlideshowIndex(idx)}
                    className="relative overflow-hidden bg-surface-container-high ring-1 ring-gray-200/50 rounded-xl group cursor-pointer"
                  >
                    <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-[4/3]" />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-xs">{photo.caption}</p>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(photo.url); }}
                      className="absolute top-2 right-2 w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity active:scale-90"
                      aria-label="Descargar foto"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Message Wall */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <MessageWall eventId={event.id} guestName={guestName} />
          </motion.div>

          {event.status !== 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <SectionErrorBoundary sectionName="CashFundSection">
            <Suspense fallback={<div className="animate-pulse h-40 bg-surface-container-highest rounded-3xl" />}><CashFundSection eventId={event.id} isOwner={false} easyRead={easyReadMode} guestName={guestName} /></Suspense>
            </SectionErrorBoundary>
          </motion.div>
          )}

          <div className={`text-center pt-8 border-t border-outline-variant ${easyReadMode ? 'text-on-surface-variant' : 'text-sm text-on-surface-variant'}`}>
            <p>Hecho por <a href="/" className="text-primary hover:text-primary-fixed-dim font-medium">Fiesta y Lista</a></p>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-xl crystal-nav border-t border-white/20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-center items-center h-20 px-4 pb-safe">
          <Link to="/" className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-primary font-bold relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full transition-all" aria-label="Ir al inicio">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="font-label-md text-label-md">Inicio</span>
          </Link>
        </nav>

        {slideshowIndex !== null && (
          <Suspense fallback={null}>
            <PhotoSlideshow
              photos={photos}
              initialIndex={slideshowIndex}
              onClose={() => setSlideshowIndex(null)}
            />
          </Suspense>
        )}

        {showSuccessModal && (
          <div
            data-testid="success-modal"
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/80 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSuccessModal(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSuccessModal(false); }}
          >
            <div className="w-full max-w-sm rounded-[40px] p-8 text-center bg-white shadow-2xl">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 id="success-title" className="text-2xl font-extrabold text-on-surface mb-2">¡Regalo Apartado!</h2>
              <p className="text-on-surface-variant text-sm font-semibold mb-6">Gracias por ser parte de este momento especial.</p>
              <div className="bg-primary-fixed/30 rounded-2xl px-5 py-4 mb-8">
                <p className="text-on-surface font-bold text-base">{lastClaimedGift}</p>
              </div>
              {event?.hostPhone && (
                <a
                  href={`https://wa.me/${event.hostPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `🎁 ¡Hola! Aparté *${lastClaimedGift}* para *${event.title}*. ¡Confirmo mi asistencia! – ${lastClaimedBy}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.97] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 transition-all mb-4"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  Notificar al anfitrión por WhatsApp
                </a>
              )}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-on-surface-variant font-semibold text-sm hover:text-on-surface transition-colors underline underline-offset-2 decoration-dotted"
              >
                Seguir viendo
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
