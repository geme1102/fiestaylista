import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';
import { getEventBySlug } from '../services/events';
import ShareButtons from '../components/ShareButtons';
import CashFundSection from '../components/CashFundSection';
import GiftCard from '../components/GiftCard';
import { showToast } from '../hooks/useToast';
import { EVENT_LABELS, THEME_COLORS, type EventType, type Gift, type Photo } from '../types';
import { getGiftCategory } from '../data/giftEmojis';
import ImageWithSkeleton from '../components/ImageWithSkeleton';

interface GuestEvent {
  id: string; title: string; eventType: EventType; slug: string; hostPhone?: string; isActive: boolean; createdAt: string;
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
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [easyReadMode, setEasyReadMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) return;
    loadEvent();
    const poll = setInterval(loadEvent, 60000);
    return () => {
      clearInterval(poll);
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
      showToast('Escribe tu nombre para que sepan quién apartó el regalo', 'error');
      inputRef.current?.focus();
      return;
    }
    setClaimingId(giftId);
    try {
      const res = await apiClient.put<{ gift: Gift }>(`/api/events/${event!.id}/gifts/${giftId}/claim`, {
        claimedBy: claimName.trim(),
      });
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.gift : g)));
      setShowConfetti(true);
      setShowSuccessModal(true);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('La foto no puede superar los 10MB', 'error');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await apiClient.post<{ url: string }>('/api/upload/guest', formData);
      const res = await apiClient.post<{ photo: Photo }>(`/api/events/${event.id}/photos/guest`, {
        url: uploadRes.url,
      });
      
      setPhotos((prev) => [res.photo, ...prev]);
      showToast('¡Foto subida con éxito! 📸', 'success');
    } catch {
      showToast('Error al subir la foto', 'error');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-fixed/10 via-surface to-surface">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-4xl shadow-xl shadow-primary/20 animate-float-slow"
          >
            🎁
          </motion.div>
          <p className="text-sm text-surface-variant animate-pulse font-outfit">Preparando la lista de regalos...</p>
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
        <meta name="twitter:title" content={`${event.title} - Fiesta y Lista`} />
        <meta name="twitter:description" content={`Lista de regalos para ${event.title}. ${EVENT_LABELS[event.eventType]}.`} />
        <link rel="canonical" href={`https://fiestaylista.com/e/${event.slug}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": event.title,
            "description": `Lista de regalos para ${event.title} (${EVENT_LABELS[event.eventType]})`,
            "url": `https://fiestaylista.com/e/${event.slug}`,
            "inLanguage": "es-CO",
            "isAccessibleForFree": true,
            "organizer": {
              "@type": "Person",
              "name": event.title.split(' ')[0] || "Anfitrión"
            }
          })}
        </script>
      </Helmet>

      <div className={`min-h-screen bg-[#FAF9F8] transition-all duration-300 pb-20 ${easyReadMode ? 'text-lg space-y-6' : ''}`}>
        {showConfetti && <PremiumConfetti />}

        {/* Top App Bar */}
        <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-white/20 shadow-sm flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">menu</span>
            <span className="font-headline-md text-headline-md font-black text-primary">Fiesta y Lista</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">shopping_bag</span>
          </div>
        </header>

        {/* Immersive Header */}
        <section className="pt-16 w-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed via-surface to-secondary-fixed/30 -z-10" />
          <div className="absolute top-20 right-[-10%] w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: THEME_COLORS[event.eventType]?.primary || '#ec4899' }} />
          <div className="px-4 pt-10 pb-12 flex flex-col items-center text-center">
            {/* Glass Icon Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="glass-card w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl border-white/40"
            >
              <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </motion.div>

            {/* Badge with pulse dot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-primary/10 text-primary px-4 py-1 rounded-full font-label-md text-label-md mb-4 inline-flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {EVENT_LABELS[event.eventType]}
            </motion.div>

            {/* Event Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 px-4"
            >
              {event.title}
            </motion.h1>

            {/* Event Date */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="font-body-md text-body-md text-on-surface-variant mb-6"
            >
              {createdDate}
            </motion.p>

            {/* Accessibility Toggle (inline glass card) */}
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

        {/* Main Content */}
        <div className={`max-w-4xl mx-auto px-4 -mt-6 relative z-10 ${easyReadMode ? 'py-8 space-y-10' : 'py-12 space-y-8'}`}>
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
                    <a
                      href={photo.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 right-2 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                      aria-label="Descargar foto"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Gift List Section */}
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

            {/* Name Input */}
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

            {/* Category Filters */}
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

            {/* Available Gifts Grid */}
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

            {/* Claimed Gifts */}
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

          {/* Footer */}
          <div className={`text-center pt-8 border-t border-outline-variant ${easyReadMode ? 'text-on-surface-variant' : 'text-sm text-on-surface-variant'}`}>
            <p>Hecho con 🎉 por <a href="/" className="text-primary hover:text-primary-fixed-dim font-medium">Fiesta y Lista</a></p>
          </div>
        </div>

        {/* Bottom Nav */}
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

        {/* Success Modal */}
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
