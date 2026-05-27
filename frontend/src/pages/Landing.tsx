import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { EVENT_ICONS, EVENT_LABELS, THEME_COLORS } from '../types';
import LiveCounter from '../components/LiveCounter';
import GoldStars from '../components/GoldStars';
import { useMousePosition, useDeviceOrientation } from '../hooks/useMousePosition';
import { use3DTilt } from '../hooks/use3DTilt';

const FEATURES = [
  { icon: '/icons/feature-gifts.png', title: 'Listas de Regalos', desc: 'Crea listas personalizadas para cualquier evento especial.', reaction: 'wiggle' },
  { icon: '/icons/feature-photos.png', title: 'Fotos del Evento', desc: 'Comparte recuerdos con todos los invitados.', reaction: 'scale' },
  { icon: '/icons/feature-cash.png', title: 'Lluvia de Sobres', desc: 'Recibe aportaciones económicas de tus invitados de forma segura.', reaction: 'coin' },
  { icon: '/icons/feature-stats.png', title: 'Estadísticas', desc: 'Sigue quién ha visto y elegido regalos.', reaction: 'scale' },
];

const EVENT_TYPES = [
  { value: 'BABY_SHOWER', label: 'Baby Shower', icon: '/icons/types/type-babyshower.svg' },
  { value: 'WEDDING', label: 'Boda', icon: '/icons/types/type-wedding.svg' },
  { value: 'BIRTHDAY', label: 'Cumpleaños', icon: '/icons/types/type-birthday.svg' },
  { value: 'BAPTISM', label: 'Bautizo', icon: '/icons/types/type-baptism.svg' },
  { value: 'COMMUNION', label: 'Comunión', icon: '/icons/types/type-communion.svg' },
] as const;

const HERO_BGS = [
  '/backgrounds/hero-babyshower.png',
  '/backgrounds/hero-wedding.png',
  '/backgrounds/hero-birthday.png',
  '/backgrounds/hero-baptism.png',
  '/backgrounds/hero-communion.png',
];

const TESTIMONIALS = [
  { name: 'María G.', role: 'Baby Shower', text: 'Invitada a baby shower, pude elegir el regalo perfecto sin repetir. Muy fácil de usar.', avatar: '/illustrations/avatar-1.png' },
  { name: 'Carlos R.', role: 'Boda', text: 'Organizamos nuestra lista de bodas aquí. Los invitados lo encontraron súper intuitivo.', avatar: '/illustrations/avatar-2.png' },
  { name: 'Ana L.', role: 'Cumpleaños', text: 'Creé la lista en 2 minutos. Mis amigos preguntaron qué app usaba. Muy recomendada.', avatar: '/illustrations/avatar-3.png' },
];

const MARQUEE_TESTIMONIALS = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

const TRUST_PILLS = [
  { icon: '🔒', text: 'Sin tarjeta de crédito' },
  { icon: '🎁', text: 'Plan gratis disponible' },
  { icon: '⚡', text: 'Fácil de usar' },
];

const CONFETTI_COLORS = ['#F43F5E', '#E11D48', '#D946EF', '#D97706', '#FDE68A', '#ec4899'];

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

function useConfettiParticles(count: number) {
  const mouse = useMousePosition();
  const orientation = useDeviceOrientation();
  const [particles, setParticles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speed: 0.2 + Math.random() * 0.4,
      drift: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
    }))
  );

  useEffect(() => {
    let frame = requestAnimationFrame(function animate() {
      setParticles((prev) =>
        prev.map((p) => {
          const normX = mouse.normalizedX || orientation.gamma / 45;
          const normY = mouse.normalizedY || orientation.beta / 45;
          let x = p.x + normX * p.drift * 2;
          let y = p.y + normY * p.speed * 0.5;
          if (y > 100) y = -5;
          if (y < -5) y = 100;
          if (x > 105) x = -5;
          if (x < -5) x = 105;
          return { ...p, x, y };
        })
      );
      frame = requestAnimationFrame(animate);
    });
    return () => cancelAnimationFrame(frame);
  }, [mouse, orientation]);

  return particles;
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
        className="w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 shadow-sm group-hover:shadow-xl group-hover:shadow-pink-500/15 transition-all duration-300 ring-1 ring-pink-200/50 dark:ring-pink-800/30 cursor-pointer relative"
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-fluid-body">{FEATURES.find(f => f.title === title)?.desc}</p>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const heroBg = useMemo(() => HERO_BGS[Math.floor(Math.random() * HERO_BGS.length)], []);
  const typedText = useTypewriter(['compartir momentos', 'recibir con amor', 'celebrar en familia']);
  const particles = useConfettiParticles(16);
  const [_scrolled, setScrolled] = useState(0);
  const categoryScrollRef = useMemo(() => {
    const el = { current: null as HTMLDivElement | null };
    return el;
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleCategoryTap = useCallback((_key: string) => {
    navigator.vibrate?.(15);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#F43F5E] opacity-[0.04] blur-3xl animate-mesh-drift" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#D97706] opacity-[0.04] blur-3xl animate-mesh-drift-reverse" />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full bg-[#F43F5E] opacity-[0.03] blur-3xl animate-mesh-drift" style={{ animationDelay: '-10s' }} />
      </div>

      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-white/20 dark:border-gray-800/50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                F
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent font-outfit tracking-tight">
                Fiesta y Lista
              </span>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all"
                >
                  Ir al Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                    Iniciar Sesión
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all"
                  >
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16 pb-24 z-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15 dark:opacity-8 scale-110"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/70 to-white dark:from-gray-900/30 dark:via-gray-900/80 dark:to-gray-900" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl dark:bg-pink-600/10 animate-aurora" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-300/20 rounded-full blur-3xl dark:bg-rose-600/10 animate-aurora" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl dark:bg-amber-600/5 animate-aurora" style={{ animationDelay: '-14s' }} />
        </div>

        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              opacity: 0.15,
              filter: 'blur(0.5px)',
            }}
          />
        ))}

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 text-pink-600 dark:text-pink-300 rounded-full text-sm font-medium border border-pink-200/50 dark:border-pink-800/30 shadow-sm backdrop-blur-sm">
              🎊 Crea tu lista de regalos en segundos
            </div>

            <h1 className="text-fluid-hero font-bold tracking-tight text-gray-900 dark:text-white mb-4 font-outfit leading-tight">
              <span className="text-gray-800 dark:text-white font-extrabold">La forma más fácil de</span>
              <span className="block bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent relative min-h-[1.3em]">
                <span className="relative">
                  {typedText}
                  <span className="animate-typewriter-cursor text-pink-500 font-extralight">|</span>
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-card-shine pointer-events-none" />
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-fluid-body text-gray-600 dark:text-gray-400 mb-8">
              Crea listas de regalos para baby showers, bodas, cumpleaños y más.
              Tus invitados pueden apartar regalos o contribuir económicamente.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-pink-500/30 transition-all shadow-lg shadow-pink-500/20 relative overflow-hidden group"
                >
                  <span className="relative z-10">Ir a Mis Eventos</span>
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent bg-[length:200%_100%] animate-card-shine" />
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-lg font-semibold transition-all shadow-lg shadow-pink-500/20 relative overflow-hidden group animate-radial-pulse"
                  >
                    <span className="relative z-10">Comenzar Gratis →</span>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent bg-[length:200%_100%] animate-card-shine" />
                  </button>
                  <Link
                    to="/pricing"
                    className="px-8 py-4 text-gray-600 dark:text-gray-300 glass-ghost rounded-full text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Ver Planes
                  </Link>
                </>
              )}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              {TRUST_PILLS.map((pill) => (
                <span
                  key={pill.text}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm border border-amber-200/30 dark:border-amber-800/20 bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 shadow-sm"
                >
                  <span className="text-amber-500">{pill.icon}</span>
                  {pill.text}
                </span>
              ))}
            </div>

            <LiveCounter />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-start justify-center p-1.5"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
          </motion.div>
        </motion.div>
      </section>

      <section className="space-fluid-section bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-4 font-outfit tracking-tight">
              Perfecto para cualquier ocasión
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto text-fluid-body">
              Sea cual sea el evento, tenemos todo lo que necesitas para organizar los regalos.
            </p>
          </motion.div>
          <div className="relative">
            <div
              ref={categoryScrollRef as any}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
              style={{ scrollBehavior: 'smooth' }}
            >
              {Object.entries(EVENT_LABELS).map(([key, label]) => {
                const typeEntry = EVENT_TYPES.find(t => t.value === key);
                const themeColor = THEME_COLORS[key as keyof typeof THEME_COLORS];
                return (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8, scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleCategoryTap(key)}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl glass-card-premium hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden group snap-center shrink-0 w-[160px]"
                    style={{
                      transformStyle: 'preserve-3d',
                      perspective: '600px',
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl blur-xl"
                      style={{ background: themeColor?.primary || '#ec4899' }}
                    />
                    <div className="relative group-hover:scale-110 transition-transform duration-300">
                      <img src={typeEntry?.icon || EVENT_ICONS[key as keyof typeof EVENT_ICONS]} alt={`Ícono ${label}`} loading="lazy" className="w-12 h-12" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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

      <section className="relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-fuchsia-600 to-violet-700 opacity-95" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-20 w-[600px] h-[600px] rounded-full bg-pink-400/20 blur-3xl animate-aurora" />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-violet-400/20 blur-3xl animate-aurora" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full bg-fuchsia-300/15 blur-3xl animate-aurora" style={{ animationDelay: '-14s' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent" />
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
              <p className="text-fluid-body mb-8 text-pink-100 max-w-xl mx-auto">
                Crea tu primer evento gratis. No necesitas tarjeta de crédito.
              </p>
              <Link
                to="/register"
                className="inline-flex px-10 py-4 bg-white text-pink-600 rounded-full text-lg font-semibold transition-all shadow-lg animate-breathing-shadow hover:shadow-xl hover:shadow-pink-500/30 hover:scale-105 relative overflow-hidden group"
              >
                <span className="relative z-10">Crear mi primera lista</span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-pink-100/30 to-transparent bg-[length:200%_100%] animate-card-shine" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200/50 dark:border-gray-700/50 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Diego Alejandro Fierro Rivera. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/pricing" className="hover:text-pink-600 transition-colors">Planes</Link>
            <Link to="/terminos-y-condiciones" className="hover:text-pink-600 transition-colors">Términos</Link>
            <Link to="/politica-de-privacidad" className="hover:text-pink-600 transition-colors">Privacidad</Link>
            <Link to="/politica-de-cookies" className="hover:text-pink-600 transition-colors">Cookies</Link>
            <Link to="/derechos-arco" className="hover:text-pink-600 transition-colors">ARCO</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
