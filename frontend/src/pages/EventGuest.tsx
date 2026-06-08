import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import ShareButtons from '../components/ShareButtons';
import CashFundSection from '../components/CashFundSection';
import GiftCard from '../components/GiftCard';
import { useEventPage } from '../hooks/useEventPage';
import { EVENT_LABELS, THEME_COLORS } from '../types';
import ImageWithSkeleton from '../components/ImageWithSkeleton';

function sanitizeForJSON(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

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
    </motion.div>
  );
}

export default function EventGuest() {
  const {
    event, photos, loading, error,
    claimingId, claimName, setClaimName,
    showConfetti, showSuccessModal, setShowSuccessModal,
    easyReadMode, setEasyReadMode,
    categoryFilter, setCategoryFilter,
    uploadingPhoto,
    inputRef, filterBarRef, fileInputRef,
    availableGifts, claimedGifts, categories, filteredGifts, createdDate,
    handleClaim, handlePhotoUpload, handleDownload,
  } = useEventPage();

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
        {showConfetti && <PremiumConfetti />}

        <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-white/20 shadow-sm flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">menu</span>
            <span className="font-headline-md text-headline-md font-black text-primary">Fiesta y Lista</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">shopping_bag</span>
          </div>
        </header>

        <section className="pt-16 w-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed via-surface to-secondary-fixed/30 -z-10" />
          <div className="absolute top-20 right-[-10%] w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />
          <div className="px-4 pt-10 pb-12 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="glass-card w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl border-white/40"
            >
              <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-primary/10 text-primary px-4 py-1 rounded-full font-label-md text-label-md mb-4 inline-flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {EVENT_LABELS[event.eventType]}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 px-4"
            >
              {event.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="font-body-md text-body-md text-on-surface-variant mb-6"
            >
              {createdDate}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-3 glass-card px-4 py-2 rounded-full mb-4"
            >
              <span className="font-label-md text-label-md text-on-surface-variant">Lectura Fácil</span>
              <button
                onClick={() => setEasyReadMode(!easyReadMode)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${easyReadMode ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${easyReadMode ? 'left-7' : 'left-1'}`} />
              </button>
            </motion.div>
          </div>
        </section>

        <div className={`max-w-4xl mx-auto px-4 -mt-6 relative z-10 ${easyReadMode ? 'py-8 space-y-10' : 'py-12 space-y-8'}`}>
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
            <CashFundSection eventId={event.id} isOwner={false} easyRead={easyReadMode} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className={easyReadMode ? 'space-y-6' : ''}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-semibold text-on-surface flex items-center gap-2 ${easyReadMode ? 'text-2xl' : 'text-lg'}`}>
                <span>📸</span> Galería
              </h2>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
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
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-xs">{photo.caption}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleDownload(photo.url)}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                      aria-label="Descargar foto"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <div className={easyReadMode ? 'space-y-8' : ''}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
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
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="Escribe tu nombre para apartar un regalo"
                  className={`w-full rounded-2xl border border-outline-variant bg-surface/80 text-on-surface outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all backdrop-blur-sm shadow-sm ${easyReadMode ? 'px-6 py-4 text-lg min-h-[56px]' : 'px-5 py-3.5 text-sm min-h-[48px]'}`}
                />
              </div>
            </div>

            {categories.length > 1 && (
              <div ref={filterBarRef} className="sticky top-16 z-30 -mx-4 px-4 py-2 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 mb-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] ${
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
                      className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border min-h-[36px] ${
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

          <div className={`text-center pt-8 border-t border-outline-variant ${easyReadMode ? 'text-on-surface-variant' : 'text-sm text-on-surface-variant'}`}>
            <p>Hecho con 🎉 por <a href="/" className="text-primary hover:text-primary-fixed-dim font-medium">Fiesta y Lista</a></p>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-xl bg-surface/70 backdrop-blur-2xl border-t border-white/20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-20 px-4 pb-safe">
          <Link to="/" className="flex flex-col items-center justify-center text-primary font-bold relative after:content-[''] after:absolute after:-bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="font-label-md text-label-md">Inicio</span>
          </Link>
          <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-primary transition-all active:scale-90">
            <span className="material-symbols-outlined">card_giftcard</span>
            <span className="font-label-md text-label-md">Lista</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-primary transition-all active:scale-90">
            <span className="material-symbols-outlined">payments</span>
            <span className="font-label-md text-label-md">Regalar</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-primary transition-all active:scale-90">
            <span className="material-symbols-outlined">person</span>
            <span className="font-label-md text-label-md">Cuenta</span>
          </a>
        </nav>

        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/80 backdrop-blur-xl">
            <div className="glass-card w-full max-w-sm rounded-[40px] p-8 text-center shadow-2xl border-white/50">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">¡Regalo Apartado!</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-8">El organizador ya sabe qué vas a regalar. Gracias por ser parte de este momento especial.</p>
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
