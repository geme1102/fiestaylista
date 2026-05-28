import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LiveCounter from '../components/LiveCounter';
import GoldStars from '../components/GoldStars';
import { use3DTilt } from '../hooks/use3DTilt';

const FEATURES = [
  { icon: '/icons/feature-gifts.png', title: 'Listas de Regalos', desc: 'Crea listas personalizadas para cualquier evento especial.', reaction: 'wiggle' },
  { icon: '/icons/feature-photos.png', title: 'Fotos del Evento', desc: 'Comparte recuerdos con todos los invitados.', reaction: 'scale' },
  { icon: '/icons/feature-cash.png', title: 'Lluvia de Sobres', desc: 'Recibe aportaciones económicas de tus invitados de forma segura.', reaction: 'coin' },
  { icon: '/icons/feature-stats.png', title: 'Estadísticas', desc: 'Sigue quién ha visto y elegido regalos.', reaction: 'scale' },
];

const EVENT_TYPES = [
  { value: 'WEDDING', label: 'Boda', icon: '/icons/types/type-wedding.svg', emoji: '💍' },
  { value: 'BABY_SHOWER', label: 'Baby Shower', icon: '/icons/types/type-babyshower.svg', emoji: '🍼' },
  { value: 'BIRTHDAY', label: 'Cumpleaños', icon: '/icons/types/type-birthday.svg', emoji: '🎂' },
  { value: 'BAPTISM', label: 'Bautizo', icon: '/icons/types/type-baptism.svg', emoji: '🕊️' },
  { value: 'COMMUNION', label: 'Comunión', icon: '/icons/types/type-communion.svg', emoji: '✨' },
] as const;

const TESTIMONIALS = [
  { name: 'María G.', role: 'Baby Shower', text: 'Invitada a baby shower, pude elegir el regalo perfecto sin repetir. Muy fácil de usar.', avatar: '/illustrations/avatar-1.png' },
  { name: 'Carlos R.', role: 'Boda', text: 'Organizamos nuestra lista de bodas aquí. Los invitados lo encontraron súper intuitivo.', avatar: '/illustrations/avatar-2.png' },
  { name: 'Ana L.', role: 'Cumpleaños', text: 'Creé la lista en 2 minutos. Mis amigos preguntaron qué app usaba. Muy recomendada.', avatar: '/illustrations/avatar-3.png' },
];

const MARQUEE_TESTIMONIALS = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

const TYPING_PHRASES = ['compartir momentos', 'recibir con amor', 'celebrar en familia'];

const SOCIAL_PROOFS = [
  { name: 'Tía María', action: 'envió un sobre de', amount: 100, icon: '✉️', delay: 0 },
  { name: 'Carlos', action: 'apartó', amount: null, icon: '🎁', delay: 1.2 },
  { name: 'Abuela Rosa', action: 'envió un sobre de', amount: 200, icon: '💌', delay: 2.4 },
  { name: 'Los primos', action: 'aportaron', amount: 150, icon: '💰', delay: 3.6 },
];

function useTypewriter(texts: string[], typingSpeed = 55, deletingSpeed = 30, pauseTime = 2500) {
  const [displayed, setDisplayed] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[lineIdx];
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplayed(current.slice(0, charIdx + 1));
          setCharIdx((i) => i + 1);
        } else {
          setTimeout(() => setDeleting(true), pauseTime);
        }
      } else {
        if (charIdx > 0) {
          setDisplayed(current.slice(0, charIdx - 1));
          setCharIdx((i) => i - 1);
        } else {
          setDeleting(false);
          setLineIdx((i) => (i + 1) % texts.length);
        }
      }
    }, deleting ? deletingSpeed : typingSpeed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, lineIdx, texts, typingSpeed, deletingSpeed, pauseTime]);

  return displayed;
}

function FeatureIcon3D({ icon, title, reaction }: { icon: string; title: string; reaction: string }) {
  const { ref, handleMouseMove, handleMouseLeave } = use3DTilt(6);
  const [coins, setCoins] = useState<{ id: number }[]>([]);

  const handleClick = useCallback(() => {
    navigator.vibrate?.(10);
    if (reaction === 'coin') {
      setCoins(Array.from({ length: 6 }, (_, i) => ({ id: Date.now() + i })));
      setTimeout(() => setCoins([]), 1000);
    }
  }, [reaction]);

  return (
    <div className="text-center group relative">
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:from-rose-900/20 dark:to-fuchsia-900/20 shadow-sm group-hover:shadow-xl group-hover:shadow-rose-500/15 transition-all duration-300 ring-1 ring-rose-200/50 dark:ring-rose-800/30 cursor-pointer relative"
        style={{ transformStyle: 'preserve-3d', transition: 'transform 0.2s cubic-bezier(0.23,1,0.32,1)' }}
      >
        <img
          src={icon}
          alt={title}
          loading="lazy"
          className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-300"
          style={{ transform: 'translateZ(20px)' }}
        />
        {reaction === 'coin' && coins.map((c) => (
          <span key={c.id} className="absolute text-xs animate-gold-particle" style={{ left: `${30 + Math.random() * 40}%`, top: '40%' }}>
            ✨
          </span>
        ))}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-fluid-body">{FEATURES.find(f => f.title === title)?.desc}</p>
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        animate={{
          x: [0, 60, -30, 40, 0],
          y: [0, -40, 50, -20, 0],
          scale: [1, 1.15, 0.9, 1.05, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06] dark:opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, #f43f5e 0%, #d946ef 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{
          x: [0, -50, 40, -30, 0],
          y: [0, 50, -30, 40, 0],
          scale: [1, 0.9, 1.1, 0.95, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.05] dark:opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, #d946ef 0%, #f43f5e 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{
          x: [0, 30, -40, 20, 0],
          y: [0, -30, 20, -40, 0],
          scale: [1, 1.05, 0.95, 1.1, 1],
        }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/4 w-[400px] h-[400px] rounded-full opacity-[0.04] dark:opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #d97706 0%, #f59e0b 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

function SocialProofFloating() {
  const [visible, setVisible] = useState<number[]>([]);
  const idxRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (idxRef.current + 1) % SOCIAL_PROOFS.length;
      idxRef.current = next;
      setVisible((v) => [...v, next].slice(-2));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-20 w-full max-w-sm mx-auto">
      <AnimatePresence mode="popLayout">
        {visible.map((idx) => {
          const proof = SOCIAL_PROOFS[idx];
          return (
            <motion.div
              key={`${proof.name}-${idx}-${Date.now()}`}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: idx % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="absolute left-1/2 -translate-x-1/2 w-max"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-amber-200/30 dark:border-amber-800/20 shadow-lg shadow-rose-500/5">
                <span className="text-lg">{proof.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <strong className="text-rose-600 dark:text-rose-400">{proof.name}</strong> {proof.action}{' '}
                  {proof.amount && (
                    <strong className="text-amber-600 dark:text-amber-400">${proof.amount}</strong>
                  )}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function CategoryCard3D({ type, index }: { type: typeof EVENT_TYPES[number]; index: number }) {
  const { ref, handleMouseMove, handleMouseLeave } = use3DTilt(10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
      className="relative"
    >
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transformStyle: 'preserve-3d', perspective: '800px' }}
        className="group relative flex flex-col items-center gap-4 p-6 rounded-2xl bg-white/70 dark:bg-[#0B0F19]/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 cursor-pointer hover:border-rose-300/50 dark:hover:border-rose-800/30"
      >
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10" />
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-rose-500/30 via-fuchsia-500/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ zIndex: -1 }} />
        </div>

        <div
          className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 ring-1 ring-rose-200/50 dark:ring-rose-800/30"
          style={{ transform: 'translateZ(30px)' }}
        >
          {type.emoji}
        </div>

        <span
          className="text-base font-bold text-gray-800 dark:text-white font-outfit tracking-tight group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-300"
          style={{ transform: 'translateZ(20px)' }}
        >
          {type.label}
        </span>

        <span
          className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-rose-500/70 transition-colors duration-300"
          style={{ transform: 'translateZ(10px)' }}
        >
          Ver más →
        </span>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-3/4 h-0.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-full transition-all duration-500 opacity-0 group-hover:opacity-100" />
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const typedText = useTypewriter(TYPING_PHRASES);
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19]">
      <FloatingOrbs />

      {/* Premium Navbar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border-b border-white/20 dark:border-white/10 shadow-sm transition-all duration-300 ${scrolled > 50 ? 'shadow-rose-500/5' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-rose-500/25 group-hover:shadow-rose-500/40 transition-all duration-300">
                F
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent font-outfit tracking-tight">
                Fiesta y Lista
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all duration-300"
                >
                  Ir al Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                  >
                    Entrar a mi Evento
                  </Link>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Link
                      to="/register"
                      className="relative inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-sm font-semibold overflow-hidden group shadow-lg shadow-rose-500/20"
                    >
                      <span className="relative z-10">Crear Lista Gratis</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine" />
                    </Link>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/30 to-white dark:from-gray-900/0 dark:via-gray-900/30 dark:to-gray-900 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-rose-100 to-fuchsia-100 dark:from-rose-900/30 dark:to-fuchsia-900/30 text-rose-600 dark:text-rose-300 rounded-full text-sm font-medium border border-rose-200/50 dark:border-rose-800/30 shadow-sm backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Crea tu lista de regalos en segundos
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-fluid-hero font-extrabold tracking-tight text-gray-900 dark:text-white mb-3 font-outfit leading-[1.1]">
              <span className="text-gray-800 dark:text-white">La forma más hermosa de</span>
              <span className="block bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent relative min-h-[1.3em] mt-1">
                <span className="relative">
                  {typedText}
                  <span className="animate-typewriter-cursor text-rose-500 font-extralight">|</span>
                </span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl mx-auto text-fluid-body text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              Tan fácil que hasta los abuelos y tíos pueden regalar sin registrarse.
              <br className="hidden sm:block" />
              Bodas, baby showers, cumpleaños y más — en 2 minutos.
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-rose-500/30 transition-all shadow-lg shadow-rose-500/20 overflow-hidden"
                >
                  <span className="relative z-10">Ir a Mis Eventos</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="relative z-10"
                  >
                    →
                  </motion.span>
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine" />
                </Link>
              ) : (
                <>
                  <motion.button
                    onClick={() => navigate('/register')}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full text-lg font-semibold transition-all shadow-lg shadow-rose-500/20 overflow-hidden animate-pulse-cta"
                  >
                    <span className="relative z-10">Comenzar mi Lista</span>
                    <span className="text-sm text-rose-200 relative z-10">(Gratis y en 2 minutos)</span>
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="relative z-10 text-xl"
                    >
                      →
                    </motion.span>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine" />
                  </motion.button>
                  <Link
                    to="/pricing"
                    className="px-8 py-4 text-gray-600 dark:text-gray-300 glass-ghost rounded-full text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Ver Planes
                  </Link>
                </>
              )}
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-12"
            >
              <SocialProofFloating />
            </motion.div>

            {/* Trust Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 dark:border-amber-800/20 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 shadow-sm">
                <span className="text-amber-500">🔒</span>
                Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 dark:border-amber-800/20 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 shadow-sm">
                <span className="text-amber-500">🎁</span>
                Plan gratis disponible
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 dark:border-amber-800/20 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 shadow-sm">
                <span className="text-amber-500">⚡</span>
                Fácil para todos
              </span>
            </motion.div>

            {/* Global Counter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <LiveCounter />
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-start justify-center p-1.5"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* Category Selector 3D */}
      <section className="space-fluid-section bg-white/50 dark:bg-gray-900/30 backdrop-blur-sm relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-3 font-outfit tracking-tight">
              ¿Qué estás celebrando?
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto text-fluid-body">
              Elige tu evento y empieza a crear tu lista de regalos en segundos
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {EVENT_TYPES.map((type, idx) => (
              <CategoryCard3D key={type.value} type={type} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-fluid-section bg-white dark:bg-gray-900 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-16 font-outfit tracking-tight">
              Todo lo que necesitas
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {FEATURES.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1, ease: [0.23, 1, 0.32, 1] }}
              >
                <FeatureIcon3D icon={feature.icon} title={feature.title} reaction={feature.reaction} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="space-fluid-section bg-gray-50/70 dark:bg-gray-800/30 backdrop-blur-sm overflow-hidden relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-4 font-outfit tracking-tight">
              Lo que dicen nuestros usuarios
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto text-fluid-body">
              Miles de personas ya organizan sus eventos con Fiesta y Lista.
            </p>
          </motion.div>
          <div className="relative overflow-hidden">
            <div className="flex gap-6 animate-marquee-scroll w-max">
              {MARQUEE_TESTIMONIALS.map((t, idx) => (
                <div
                  key={`${t.name}-${idx}`}
                  className="w-[300px] sm:w-[340px] shrink-0 rounded-2xl p-6 glass-card-premium"
                >
                  <GoldStars />
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 mt-3">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="relative rounded-full animate-avatar-pulse-ring">
                      <img
                        src={t.avatar}
                        alt={`Avatar de ${t.name}`}
                        loading="lazy"
                        className="w-10 h-10 rounded-full object-cover bg-gray-100 relative z-10"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600 via-fuchsia-600 to-violet-700 opacity-95" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full bg-rose-400/20 blur-3xl animate-aurora" />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-violet-400/20 blur-3xl animate-aurora" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full bg-fuchsia-300/15 blur-3xl animate-aurora" style={{ animationDelay: '-14s' }} />
        </div>
        <div className="relative space-fluid-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            >
              <h2 className="text-fluid-h2 font-bold mb-4 font-outfit tracking-tight text-white">
                ¿Listo para empezar?
              </h2>
              <p className="text-fluid-body mb-8 text-rose-100 max-w-xl mx-auto">
                Crea tu primer evento gratis. No necesitas tarjeta de crédito.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-10 py-4 bg-white text-rose-600 rounded-full text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:shadow-rose-500/30 hover:scale-105 relative overflow-hidden group"
              >
                <span className="relative z-10">Crear mi primera lista</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="relative z-10"
                >
                  →
                </motion.span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-rose-100/30 to-transparent bg-[length:200%_100%] animate-card-shine" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200/50 dark:border-gray-700/50 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Diego Alejandro Fierro Rivera. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/pricing" className="hover:text-rose-600 transition-colors">Planes</Link>
            <Link to="/terminos-y-condiciones" className="hover:text-rose-600 transition-colors">Términos</Link>
            <Link to="/politica-de-privacidad" className="hover:text-rose-600 transition-colors">Privacidad</Link>
            <Link to="/politica-de-cookies" className="hover:text-rose-600 transition-colors">Cookies</Link>
            <Link to="/derechos-arco" className="hover:text-rose-600 transition-colors">ARCO</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
