import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LiveCounter from '../components/LiveCounter';
import GoldStars from '../components/GoldStars';
import {
  Gem, Baby, Cake, Droplet, Sun, Gift, Camera, Mail, BarChart3,
  ArrowRight, Home, ChevronLeft, ChevronRight,
} from 'lucide-react';

const TESTIMONIALS = [
  { name: 'María G.', role: 'Baby Shower', text: 'Invitada a baby shower, pude elegir el regalo perfecto sin repetir. Muy fácil de usar.', avatar: '/illustrations/avatar-1.png' },
  { name: 'Carlos R.', role: 'Boda', text: 'Organizamos nuestra lista de bodas aquí. Los invitados lo encontraron súper intuitivo.', avatar: '/illustrations/avatar-2.png' },
  { name: 'Ana L.', role: 'Cumpleaños', text: 'Creé la lista en 2 minutos. Mis amigos preguntaron qué app usaba. Muy recomendada.', avatar: '/illustrations/avatar-3.png' },
];

const MARQUEE_TESTIMONIALS = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

const TYPING_PHRASES = ['compartir momentos', 'recibir con amor', 'celebrar en familia'];

const SOCIAL_PROOFS = [
  { name: 'Un usuario', action: 'creó su lista de', amount: null, icon: '🎉', delay: 0 },
  { name: 'Un invitado', action: 'apartó un regalo de', amount: null, icon: '🎁', delay: 1.2 },
  { name: 'Una organizadora', action: 'compartió su evento', amount: null, icon: '✨', delay: 2.4 },
  { name: 'Un invitado', action: 'envió una felicitación', amount: null, icon: '💌', delay: 3.6 },
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
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #b10e6b 0%, #d23284 50%, transparent 70%)',
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
        className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{
          background: 'radial-gradient(circle, #d23284 0%, #b10e6b 50%, transparent 70%)',
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
        className="absolute top-1/2 left-1/4 w-[400px] h-[400px] rounded-full opacity-[0.04]"
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
  const animKeyRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (idxRef.current + 1) % SOCIAL_PROOFS.length;
      idxRef.current = next;
      animKeyRef.current++;
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
              key={`${proof.name}-${idx}-${animKeyRef.current}`}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: idx % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="absolute left-1/2 -translate-x-1/2 w-max"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface/80 backdrop-blur-md border border-amber-200/30 shadow-lg shadow-primary/5">
                <span className="text-lg">{proof.icon}</span>
                <span className="text-sm text-on-surface">
                  <strong className="text-primary">{proof.name}</strong> {proof.action}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const typedText = useTypewriter(TYPING_PHRASES);
  const [scrolled, setScrolled] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollLeft = useCallback(() => {
    carouselRef.current?.scrollBy({ left: -340, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    carouselRef.current?.scrollBy({ left: 340, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F8]">
      <FloatingOrbs />

      {/* Premium Navbar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm transition-all duration-300 ${scrolled > 50 ? 'shadow-primary/5' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-all duration-300">
                F
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent font-outfit tracking-tight">
                Fiesta y Lista
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
                >
                  Ir al Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Entrar a mi Evento
                  </Link>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Link
                      to="/register"
                      className="relative inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-sm font-semibold overflow-hidden group shadow-lg shadow-primary/20"
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
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/30 to-white pointer-events-none" />

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
              className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-primary-fixed to-primary-fixed/50 text-primary rounded-full text-sm font-medium border border-primary/20 shadow-sm backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Crea tu lista de regalos en segundos
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-fluid-hero font-extrabold tracking-tight text-on-surface mb-3 font-outfit leading-[1.1]">
              <span className="text-on-surface">La forma más hermosa de</span>
              <span className="block relative min-h-[1.3em] mt-1">
                <span className="bg-gradient-to-r from-primary via-primary-container to-secondary-container bg-clip-text text-transparent">
                  {typedText}
                </span>
                <span className="animate-typewriter-cursor text-primary font-extralight">|</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl mx-auto text-fluid-body text-on-surface-variant mb-8 leading-relaxed">
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
                  className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-primary/30 transition-all shadow-lg shadow-primary/20 overflow-hidden"
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
                    className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full text-lg font-semibold transition-all shadow-lg shadow-primary/20 overflow-hidden animate-pulse-cta"
                  >
                    <span className="relative z-10">Comenzar mi Lista</span>
                    <span className="text-sm text-primary-fixed relative z-10">(Gratis y en 2 minutos)</span>
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
                    className="px-8 py-4 text-on-surface-variant glass-ghost rounded-full text-sm font-semibold hover:shadow-lg transition-all"
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
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
                <span className="text-amber-500">🔒</span>
                Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
                <span className="text-amber-500">🎁</span>
                Plan gratis disponible
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 bg-surface/60 text-on-surface-variant shadow-sm">
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
            className="w-6 h-10 rounded-full border-2 border-outline-variant flex items-start justify-center p-1.5"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      </section>

      {/* Category Selector - Horizontal Carousel */}
      <section className="pt-16 md:pt-24 pb-12 md:pb-20">
        <div className="max-w-4xl mx-auto text-center mb-10 md:mb-14 px-4 md:px-8">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-tight md:leading-tight font-bold mb-4 drop-shadow-sm"
          >
            <span className="text-gradient-premium leading-normal">¿Qué estás</span> <span className="text-gradient-premium italic pr-2 leading-normal">celebrando?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
            className="text-gray-700 text-base sm:text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto"
          >
            Elige tu evento y empieza a crear tu lista de regalos en segundos.
          </motion.p>
        </div>

        {/* Horizontal Snapping Carousel */}
        <div className="relative w-full">
          <div className="hidden md:block absolute top-0 left-0 bottom-0 w-16 lg:w-24 xl:w-40 bg-gradient-to-r from-[#fdfbfb] via-[#fdfbfb]/80 to-transparent z-10 pointer-events-none"></div>
          <div className="hidden md:block absolute top-0 right-0 bottom-0 w-16 lg:w-24 xl:w-40 bg-gradient-to-l from-[#fdfbfb] via-[#fdfbfb]/80 to-transparent z-10 pointer-events-none"></div>

          <motion.div
            ref={carouselRef}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3, type: 'spring', bounce: 0.4 }}
            className="flex gap-4 sm:gap-6 md:gap-8 overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 sm:px-10 md:px-16 lg:px-32 xl:px-48 py-8 md:py-12"
          >
            {[
              { title: 'Boda', icon: Gem, color: 'from-brand-peach/50 to-brand-pink/20', glow: 'bg-brand-pink' },
              { title: 'Baby Shower', icon: Baby, color: 'from-brand-blue/20 to-brand-lavender/50', glow: 'bg-brand-blue' },
              { title: 'Cumpleaños', icon: Cake, color: 'from-amber-200 to-rose-200', glow: 'bg-amber-400' },
              { title: 'Bautizo', icon: Droplet, color: 'from-emerald-100 to-teal-200/80', glow: 'bg-teal-400' },
              { title: 'Comunión', icon: Sun, color: 'from-brand-lavender/40 to-brand-peach/20', glow: 'bg-brand-peach' },
              { title: 'Casa Shower', icon: Home, color: 'from-orange-100 to-amber-200/60', glow: 'bg-orange-400' },
            ].map((event, idx) => (
              <motion.button
                key={event.title}
                onClick={() => navigate('/register')}
                whileTap={{ scale: 0.94, y: 0 }}
                whileHover={{ y: -12, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative snap-center shrink-0 w-[80vw] sm:w-[260px] md:w-[320px] flex flex-col items-center p-8 md:p-10
                           bg-gradient-to-b from-white/90 to-white/70 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem]
                           shadow-[0_15px_35px_-5px_rgba(0,0,0,0.06),0_4px_10px_-5px_rgba(0,0,0,0.02),inset_0_0_0_1px_rgba(255,255,255,0.7),inset_0_4px_15px_rgba(255,255,255,0.9)]
                           hover:shadow-[0_40px_60px_-15px_rgba(140,0,83,0.25),0_15px_25px_-10px_rgba(210,50,132,0.15),inset_0_0_0_2px_rgba(255,255,255,1),inset_0_4px_25px_rgba(255,255,255,1)]
                           active:shadow-[0_15px_25px_-5px_rgba(140,0,83,0.2),inset_0_0_0_2px_rgba(255,255,255,0.9),inset_0_4px_20px_rgba(255,255,255,0.8)]
                           transition-shadow duration-500 overflow-visible group outline-none"
              >
                <div className={`absolute -inset-1 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br ${event.color} blur-[12px] opacity-30 group-hover:opacity-70 transition-opacity duration-500 -z-10 pointer-events-none`}></div>
                <div className={`absolute inset-0 bg-gradient-to-t ${event.color} opacity-0 group-hover:opacity-15 rounded-[2.5rem] md:rounded-[3rem] transition-opacity duration-500 pointer-events-none`}></div>

                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.2 }}
                  className={`relative z-10 flex items-center justify-center w-24 h-24 md:w-28 md:h-28 mb-6 md:mb-8 rounded-full bg-gradient-to-br ${event.color} shadow-[0_15px_30px_-10px_rgba(0,0,0,0.15),inset_0_4px_8px_rgba(255,255,255,0.9)] border border-white/60`}
                >
                  <div className={`absolute -bottom-2 w-12 h-3 md:w-16 md:h-4 ${event.glow} blur-lg md:blur-xl opacity-40 rounded-full`}></div>
                  <event.icon strokeWidth={1.5} className="w-10 h-10 md:w-12 md:h-12 text-gray-800 drop-shadow-sm" />
                </motion.div>

                <h3 className="relative z-10 text-xl md:text-2xl font-serif font-bold text-gray-900 tracking-tight mb-3 md:mb-4">
                  {event.title}
                </h3>

                <div className="relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-50 border border-gray-100/50 shadow-inner group-hover:bg-brand-pink group-hover:text-white group-hover:border-brand-pink transition-all duration-300">
                  <span className="text-xs md:text-sm font-semibold tracking-wide transition-colors text-brand-pink group-hover:text-white">Ver más</span>
                  <ArrowRight strokeWidth={2.5} className="w-4 h-4 text-brand-pink group-hover:text-white group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            ))}

            <div className="shrink-0 w-4 md:w-12 lg:w-24 xl:w-40"></div>
          </motion.div>
        </div>

        {/* Navigation Arrows (Desktop) */}
        <div className="hidden md:flex justify-center items-center gap-6 mt-8">
          <button
            onClick={scrollLeft}
            className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_8px_30px_-5px_rgba(0,0,0,0.15)] border border-white/60 text-brand-berry hover:bg-white hover:text-brand-pink hover:scale-105 hover:shadow-[0_15px_40px_-5px_rgba(210,50,132,0.25)] transition-all focus:outline-none"
            aria-label="Desplazar a la izquierda"
          >
            <ChevronLeft strokeWidth={2.5} className="w-7 h-7 -ml-1" />
          </button>
          <button
            onClick={scrollRight}
            className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_8px_30px_-5px_rgba(0,0,0,0.15)] border border-white/60 text-brand-berry hover:bg-white hover:text-brand-pink hover:scale-105 hover:shadow-[0_15px_40px_-5px_rgba(210,50,132,0.25)] transition-all focus:outline-none"
            aria-label="Desplazar a la derecha"
          >
            <ChevronRight strokeWidth={2.5} className="w-7 h-7 -mr-1" />
          </button>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section className="pt-16 md:pt-24 pb-16 md:pb-24 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight md:leading-tight font-bold mb-4 md:mb-5"
          >
            <span className="text-gradient-premium leading-normal">Todo lo que necesitas</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-gray-700 text-base sm:text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto"
          >
            Una suite premium diseñada para hacer inolvidable tu celebración.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

          {/* Card 1: Gifts */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.01 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
            className="md:col-span-2 relative p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] bg-white/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 md:gap-10 group cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gradient-to-bl from-brand-peach/30 via-brand-pink/10 to-transparent opacity-60 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative z-10 flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-[1.2rem] md:rounded-3xl bg-gradient-to-br from-brand-pink to-brand-peach p-1 shadow-[0_10px_25px_-5px_rgba(210,50,132,0.4)] group-hover:shadow-[0_15px_35px_-5px_rgba(210,50,132,0.5)] transition-shadow">
              <div className="w-full h-full bg-white rounded-[1rem] md:rounded-[20px] flex items-center justify-center">
                <Gift className="w-8 h-8 md:w-10 md:h-10 text-brand-pink" strokeWidth={1.5} />
              </div>
            </div>
            <div className="relative z-10 text-center sm:text-left flex-1">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-3 md:mb-4">Listas de Regalos</h3>
              <p className="text-gray-700 text-sm sm:text-base md:text-lg font-light leading-relaxed">
                Crea listas personalizadas con una experiencia de unboxing virtual elegante. Perfecto para cualquier evento especial que merezca ser recordado.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Photos */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.5, delay: 0.1, type: 'spring', bounce: 0.3 }}
            className="relative p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] bg-white/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col items-center justify-center text-center group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 to-brand-lavender/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            {/* Photo Collage */}
            <div className="relative z-10 w-full h-36 md:h-40 mb-4 md:mb-6 flex items-center justify-center perspective-[1000px]">
              <motion.div className="absolute z-0 w-20 h-24 md:w-24 md:h-28 bg-white p-1 pb-4 md:pb-5 shadow-md rounded-sm -rotate-12 -ml-20 -mt-4 opacity-70 group-hover:-rotate-[16deg] group-hover:-ml-28 group-hover:opacity-90 transition-all duration-300">
                <div className="w-full h-full bg-gray-100 rounded-[2px] overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1525268771113-32d9e9021a97?auto=format&fit=crop&q=80&w=200" alt="Fiesta" className="w-full h-full object-cover" />
                </div>
              </motion.div>
              <motion.div className="absolute z-10 w-24 h-28 md:w-28 md:h-32 bg-white p-1.5 pb-5 md:pb-6 shadow-lg rounded-sm rotate-12 ml-16 md:ml-20 mt-4 group-hover:rotate-[16deg] group-hover:ml-24 group-hover:scale-105 transition-all duration-300">
                <div className="w-full h-full bg-gray-100 rounded-[2px] overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1530103862676-de8892ebe853?auto=format&fit=crop&q=80&w=200" alt="Celebración" className="w-full h-full object-cover" />
                </div>
              </motion.div>
              <motion.div className="absolute z-20 w-28 h-32 md:w-32 md:h-36 bg-white p-2 pb-6 md:pb-8 shadow-xl rounded-sm -rotate-3 group-hover:rotate-0 group-hover:scale-110 group-hover:-mt-4 transition-all duration-300">
                <div className="w-full h-full bg-gray-100 rounded-[2px] overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=200" alt="Evento" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center shadow-lg transform -translate-y-2">
                    <Camera className="w-5 h-5 text-gray-900" strokeWidth={2} />
                  </div>
                </div>
              </motion.div>
            </div>

            <h3 className="relative z-10 text-xl md:text-2xl font-serif font-bold text-gray-900 mb-2 md:mb-3">Fotos del Evento</h3>
            <p className="relative z-10 text-sm sm:text-base text-gray-700 font-light leading-relaxed">
              Revive cada instante con un muro de recuerdos vivos.
            </p>
          </motion.div>

          {/* Card 3: Cash */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring', bounce: 0.3 }}
            className="relative p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] bg-brand-berry text-white shadow-[0_15px_40px_-15px_rgba(140,0,83,0.5)] overflow-hidden flex flex-col items-center justify-center text-center group cursor-pointer"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-16 -right-16 w-48 h-48 md:w-64 md:h-64 bg-brand-pink rounded-full blur-[60px] md:blur-[80px]"
            />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 md:w-40 md:h-40 bg-white opacity-10 rounded-full blur-[40px] group-hover:opacity-20 transition-opacity duration-500"></div>

            <div className="relative z-10 flex-shrink-0 w-16 h-16 md:w-20 md:h-20 mb-5 md:mb-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner group-hover:bg-white/20 transition-colors">
              <Mail className="w-7 h-7 md:w-8 md:h-8 text-white" strokeWidth={1.5} />
            </div>

            <h3 className="relative z-10 text-xl md:text-2xl font-serif font-bold text-white mb-2 md:mb-3">Lluvia de Sobres</h3>
            <p className="relative z-10 text-sm sm:text-base text-white/90 font-light leading-relaxed">
              Aportaciones con extrema elegancia.
            </p>
          </motion.div>

          {/* Card 4: Stats */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5, scale: 1.01 }}
            transition={{ duration: 0.5, delay: 0.3, type: 'spring', bounce: 0.3 }}
            className="md:col-span-2 relative p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] bg-white/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 md:gap-10 group cursor-pointer"
          >
            <div className="absolute bottom-0 right-0 left-0 h-32 md:h-40 bg-gradient-to-t from-brand-lavender/20 to-transparent opacity-60 pointer-events-none group-hover:h-40 md:group-hover:h-48 transition-all duration-700"></div>

            <div className="relative z-10 text-center sm:text-left flex-1 order-2 sm:order-1">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-3 md:mb-4">Estadísticas Detalladas</h3>
              <p className="text-gray-700 text-sm sm:text-base md:text-lg font-light leading-relaxed">
                Sigue en tiempo real quién ha visto tu invitación, confirma asistencia y gestiona los regalos con un panel intuitivo y moderno.
              </p>
            </div>

            <div className="relative z-10 flex-shrink-0 w-20 h-20 md:w-24 md:h-24 order-1 sm:order-2 rounded-[1.2rem] md:rounded-3xl bg-gradient-to-br from-brand-blue to-brand-lavender p-1 shadow-[0_10px_25px_-5px_rgba(47,46,190,0.3)] group-hover:shadow-[0_15px_35px_-5px_rgba(47,46,190,0.4)] transition-shadow">
              <div className="w-full h-full bg-white rounded-[1rem] md:rounded-[20px] flex items-center justify-center">
                <BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-brand-blue" strokeWidth={1.5} />
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Testimonials */}
      <section className="space-fluid-section bg-surface-container-lowest/70 backdrop-blur-sm overflow-hidden relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-on-surface mb-4 font-outfit tracking-tight">
              Lo que dicen nuestros usuarios
            </h2>
            <p className="text-center text-on-surface-variant mb-10 max-w-xl mx-auto text-fluid-body">
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
                  <p className="text-on-surface-variant text-sm mb-4 mt-3">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="relative rounded-full animate-avatar-pulse-ring">
                      <img
                        src={t.avatar}
                        alt={`Avatar de ${t.name}`}
                        loading="lazy"
                        className="w-10 h-10 rounded-full object-cover bg-surface-container-high relative z-10"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-on-surface text-sm">{t.name}</p>
                      <p className="text-xs text-on-surface-variant">{t.role}</p>
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary opacity-95" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full bg-primary/20 blur-3xl animate-aurora" />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-tertiary/20 blur-3xl animate-aurora" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full bg-primary-container/15 blur-3xl animate-aurora" style={{ animationDelay: '-14s' }} />
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
              <p className="text-fluid-body mb-8 text-on-primary max-w-xl mx-auto">
                Crea tu primer evento gratis. No necesitas tarjeta de crédito.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-10 py-4 bg-white text-primary rounded-full text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:shadow-primary/30 hover:scale-105 relative overflow-hidden group"
              >
                <span className="relative z-10">Crear mi primera lista</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="relative z-10"
                >
                  →
                </motion.span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-primary-fixed/30 to-transparent bg-[length:200%_100%] animate-card-shine" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-surface-container-lowest border-t border-outline-variant/50 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-on-surface-variant">
          <p>© {new Date().getFullYear()} Diego Alejandro Fierro Rivera. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/pricing" className="hover:text-primary transition-colors">Planes</Link>
            <Link to="/terminos-y-condiciones" className="hover:text-primary transition-colors">Términos</Link>
            <Link to="/politica-de-privacidad" className="hover:text-primary transition-colors">Privacidad</Link>
            <Link to="/politica-de-cookies" className="hover:text-primary transition-colors">Cookies</Link>
            <Link to="/derechos-arco" className="hover:text-primary transition-colors">ARCO</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
