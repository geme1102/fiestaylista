import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import ShareButtons from '../components/ShareButtons';
import CashFundSection from '../components/CashFundSection';
import GiftCard from '../components/GiftCard';
import { ConfettiCanvas, type ConfettiCanvasRef } from '../components/ConfettiCanvas';
import { useEventPage } from '../hooks/useEventPage';
import { EVENT_LABELS, EVENT_ICONS, THEME_COLORS, DEFAULT_NOTES, type EventType } from '../types';
import ImageWithSkeleton from '../components/ImageWithSkeleton';
import { apiClient } from '../services/api';

const CURSIVE_TEXTS: Record<EventType, string> = {
  WEDDING: 'Nuestra Historia comienza con un Sí...',
  BABY_SHOWER: 'Dulce espera, amor infinito...',
  BIRTHDAY: 'Risas, amigos y un año milagroso...',
  BAPTISM: 'Guiado por la luz divina...',
  COMMUNION: 'Luz y alegría en este reencuentro de fe...',
  HOUSE_WARMING: 'Nuevo nido de amor, nuevas historias...',
  OTHER: 'Celebrando juntos este momento especial...',
};

const INTRO_TEXTS: Record<EventType, string> = {
  WEDDING: 'Te invitamos a ser parte del día más especial. Tu presencia y palabras de aliento son el regalo más valioso en este camino que iniciamos.',
  BABY_SHOWER: '¡La cigüeña está en camino! Los invitamos a celebrar la dulce espera y preparar el nido para el milagro de una nueva vida llena de felicidad.',
  BIRTHDAY: '¡A celebrar la vida! Un año más repleto de risas, aprendizajes y sueños por realizar. El mejor regalo es brindar rodeado de las personas que amo.',
  BAPTISM: 'Un día consagrado a la fe y la gracia. Los invitamos a acompañarnos en la bendición de bautizo, iluminando los primeros pasos espirituales.',
  COMMUNION: 'Unión sagrada bajo una misma luz de fe. Los invitamos a conmemorar este sacramento con un espíritu puro y feliz.',
  HOUSE_WARMING: '¡Llaves nuevas y risas compartidas! Los invitamos a celebrar nuestro nuevo hogar, un nuevo capítulo para construir con el corazón.',
  OTHER: 'Te invitamos a ser parte de este momento especial. Tu presencia y cariño son el mejor regalo.',
};

function sanitizeForJSON(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

function EmptyGiftState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
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
    claimingId, claimName, setClaimName, shaking,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    uploadingPhoto,
    inputRef, filterBarRef, fileInputRef,
    availableGifts, claimedGifts, categories, filteredGifts,
    eventDateFormatted, eventTimeFormatted,
    turnstileRef,
    handleClaim, handlePhotoUpload, handleDownload,
  } = useEventPage();

  const [lastClaimedGift, setLastClaimedGift] = useState('');
  const [lastClaimedBy, setLastClaimedBy] = useState('');

  const displayNote = event?.eventNote || DEFAULT_NOTES[event?.eventType || 'OTHER'];

  const confettiRef = useRef<ConfettiCanvasRef>(null);

  useEffect(() => {
    if (!event) return;
    apiClient.post('/api/analytics/view', { eventId: event.id }).catch(() => {});
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F8] animate-pulse">
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
          <meta property="og:image" content={photos[0].url} />
        )}
        <meta name="twitter:title" content={`${event.title} - Fiesta y Lista`} />
        <meta name="twitter:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}.`} />
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
            "organizer": {
              "@type": "Person",
              "name": sanitizeForJSON(event.title.split(' ')[0] || "Anfitrión")
            }
          })}
        </script>
      </Helmet>

      <div className={`min-h-screen bg-[#FAF9F8] transition-all duration-300 pb-20 ${easyReadMode ? 'text-lg space-y-6' : ''}`}>
        <ConfettiCanvas ref={confettiRef} />

        <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-white/20 shadow-sm flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-headline-md text-headline-md font-black text-primary">Fiesta y Lista</Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => document.getElementById('gift-list')?.scrollIntoView({ behavior: 'smooth' })}
              className="material-symbols-outlined text-primary cursor-pointer"
              aria-label="Ir a la lista de regalos"
            >
              shopping_bag
            </button>
          </div>
        </header>

        {/* Turnstile (invisible) */}
        <div ref={turnstileRef} className="fixed overflow-hidden" style={{ left: '-9999px', top: '-9999px', width: '1px', height: '1px' }} />

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

              <p className="font-body-lg text-body-lg italic font-semibold tracking-wide max-w-lg mb-4 leading-relaxed" style={{ color: THEME_COLORS[event.eventType]?.primary }}>
                &ldquo;{CURSIVE_TEXTS[event.eventType]}&rdquo;
              </p>

              <p className="text-gray-600 font-medium max-w-xl leading-relaxed mb-8 text-xs md:text-sm">
                {INTRO_TEXTS[event.eventType]}
              </p>

              {displayNote && (
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-8 leading-relaxed text-center">
                  {displayNote}
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

              <div className="w-full max-w-md z-10 relative">
                <ShareButtons slug={event.slug} title={event.title} />
              </div>
            </motion.header>
          </div>
        </section>

        <div className={`max-w-4xl mx-auto px-4 -mt-6 relative z-10 ${easyReadMode ? 'py-8 space-y-10' : 'py-12 space-y-8'}`}>
          {/* Gift List — primary action, shown first */}
          <div className={easyReadMode ? 'space-y-8' : ''}>
            <motion.div
              id="gift-list"
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

            <div className="mb-6">
              <label htmlFor="claim-name" className="block text-sm font-semibold text-on-surface mb-1.5">Tu nombre</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="claim-name"
                  type="text"
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="Escribe tu nombre para apartar un regalo"
                  autoComplete="name"
                  inputMode="text"
                  autoCapitalize="words"
                  enterKeyHint="go"
                  className={`w-full rounded-2xl border outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all backdrop-blur-sm shadow-sm ${shaking ? 'animate-shake border-red-400 ring-2 ring-red-300' : 'border-outline-variant bg-surface/80 text-on-surface'} ${easyReadMode ? 'px-6 py-4 text-lg min-h-[56px]' : 'px-5 py-3.5 text-sm min-h-[48px]'}`}
                />
              </div>
            </div>

            {categories.length > 1 && (
              <div ref={filterBarRef} className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 mb-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max">
                  <button
                    onClick={() => setCategoryFilter(null)}
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

            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredGifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    onClaim={(id, name) => { setLastClaimedGift(name); setLastClaimedBy(claimName); handleClaim(id, name); }}
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
                <h3 className={`font-semibold text-on-surface-variant mb-4 uppercase tracking-wider flex items-center gap-2 ${easyReadMode ? 'text-lg' : 'text-sm'}`}>
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
              <input id="guest-photo-upload" type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={uploadingPhoto}
                className="px-4 py-2 bg-primary/10 text-primary font-semibold text-sm rounded-xl flex items-center gap-2 hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{uploadingPhoto ? 'hourglass_empty' : 'upload'}</span>
                {uploadingPhoto ? 'Subiendo...' : photos.length === 0 ? 'Sube la primera foto' : 'Subir foto'}
              </button>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <motion.div
                    key={photo.id}
                    whileHover={{ scale: 1.03 }}
                    className="relative overflow-hidden bg-surface-container-high ring-1 ring-gray-200/50 rounded-xl group"
                  >
                    <ImageWithSkeleton src={photo.url} alt={photo.caption || 'Foto del evento'} aspectRatio="aspect-[4/3]" />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-xs">{photo.caption}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleDownload(photo.url)}
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

          {/* Cash Fund — tertiary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <CashFundSection eventId={event.id} isOwner={false} easyRead={easyReadMode} />
          </motion.div>

          <div className={`text-center pt-8 border-t border-outline-variant ${easyReadMode ? 'text-on-surface-variant' : 'text-sm text-on-surface-variant'}`}>
            <p>Hecho por <a href="/" className="text-primary hover:text-primary-fixed-dim font-medium">Fiesta y Lista</a></p>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-xl bg-surface/70 backdrop-blur-2xl border-t border-white/20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-center items-center h-20 px-4 pb-safe">
          <Link to="/" className="flex flex-col items-center justify-center text-primary font-bold relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full transition-all" aria-label="Ir al inicio">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="font-label-md text-label-md">Inicio</span>
          </Link>
        </nav>

        {showSuccessModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/80 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSuccessModal(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSuccessModal(false); }}
          >
            <div className="glass-card w-full max-w-sm rounded-[40px] p-8 text-center shadow-2xl border-white/50">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 id="success-title" className="font-headline-md text-headline-md text-on-surface mb-2">¡Regalo Apartado!</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">Gracias por ser parte de este momento especial.</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 bg-primary-fixed/30 rounded-xl px-4 py-3 font-semibold">
                {lastClaimedGift}
              </p>
              {event?.hostPhone && (
                <a
                  href={`https://wa.me/${event.hostPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `🎁 ¡Hola! Aparté *${lastClaimedGift}* para *${event.title}*. ¡Confirmo mi asistencia! – ${lastClaimedBy}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 active:scale-95 transition-transform mb-3"
                >
                  <span className="material-symbols-outlined">chat</span>
                  Notificar al anfitrión por WhatsApp
                </a>
              )}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-primary text-white py-4 rounded-2xl font-label-md text-label-md shadow-lg shadow-primary/20 active:scale-95 transition-transform"
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
