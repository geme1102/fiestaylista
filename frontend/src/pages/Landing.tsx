import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { EVENT_ICONS, EVENT_LABELS } from '../types';
import LiveCounter from '../components/LiveCounter';
import { useMousePosition, useDeviceOrientation } from '../hooks/useMousePosition';

const FEATURES = [
  { icon: '/icons/feature-gifts.png', title: 'Listas de Regalos', desc: 'Crea listas personalizadas para cualquier evento especial.' },
  { icon: '/icons/feature-photos.png', title: 'Fotos del Evento', desc: 'Comparte recuerdos con todos los invitados.' },
  { icon: '/icons/feature-cash.png', title: 'Lluvia de Sobres', desc: 'Recibe aportaciones económicas de tus invitados de forma segura.' },
  { icon: '/icons/feature-stats.png', title: 'Estadísticas', desc: 'Sigue quién ha visto y elegido regalos.' },
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

const FLOATING_TESTIMONIALS = [
  { text: '✨ "Super fácil de usar"', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
  { text: '🎉 "Invitados encantados"', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { text: '💝 "Me encantó"', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' },
];

const CONFETTI_COLORS = ['#F43F5E', '#E11D48', '#D946EF', '#D97706', '#FDE68A', '#ec4899'];

const TYPED_LINES = [
  'organizar tus regalos',
  'compartir momentos',
  'recibir con amor',
];

function useTypewriter(texts: string[], typingSpeed = 60, deletingSpeed = 35, pauseTime = 2000) {
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



export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const heroBg = useMemo(() => HERO_BGS[Math.floor(Math.random() * HERO_BGS.length)], []);
  const [floatingIdx, setFloatingIdx] = useState(0);
  const typedText = useTypewriter(TYPED_LINES);
  const particles = useConfettiParticles(16);
  const [flashCard, setFlashCard] = useState<string | null>(null);

  const handleCategoryTap = useCallback((key: string) => {
    navigator.vibrate?.(15);
    setFlashCard(key);
    setTimeout(() => setFlashCard(null), 400);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFloatingIdx((i) => (i + 1) % FLOATING_TESTIMONIALS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19]">
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

      <section className="relative overflow-hidden pt-16 pb-24">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-10 scale-110"
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
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 text-pink-600 dark:text-pink-300 rounded-full text-sm font-medium border border-pink-200/50 dark:border-pink-800/30 shadow-sm backdrop-blur-sm">
              🎊 Crea tu lista de regalos en segundos
            </div>

            <h1 className="text-fluid-hero font-bold tracking-tight text-gray-900 dark:text-white mb-6 font-outfit leading-tight">
              La forma más fácil de
              <span className="block bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent min-h-[1.2em]">
                {typedText}
                <span className="animate-typewriter-cursor text-pink-500">|</span>
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-fluid-body text-gray-600 dark:text-gray-400 mb-10">
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
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-card-shine" />
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-pink-500/30 transition-all shadow-lg shadow-pink-500/20 animate-pulse-cta relative overflow-hidden group"
                  >
                    <span className="relative z-10">Comenzar Gratis →</span>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-card-shine" />
                  </button>
                  <Link
                    to="/pricing"
                    className="px-8 py-4 text-gray-600 dark:text-gray-300 bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-full text-sm font-semibold hover:shadow-lg hover:border-pink-300/50 transition-all"
                  >
                    Ver Planes
                  </Link>
                </>
              )}
            </div>

            <div className="mt-16 flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">✅ Sin tarjeta de crédito</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="flex items-center gap-1">✅ Plan gratis disponible</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="flex items-center gap-1">✅ Fácil de usar</span>
            </div>

            <LiveCounter />
          </motion.div>
        </div>

        <div className="absolute bottom-24 left-4 hidden lg:block">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={floatingIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className={`px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm border border-white/20 shadow-lg ${FLOATING_TESTIMONIALS[floatingIdx].color}`}
              >
                {FLOATING_TESTIMONIALS[floatingIdx].text}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
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

      <section className="space-fluid-section bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-4 font-outfit tracking-tight">
              Perfecto para cualquier ocasión
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto text-fluid-body">
              Sea cual sea el evento, tenemos todo lo que necesitas para organizar los regalos.
            </p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(EVENT_LABELS).map(([key, label], idx) => {
              const typeEntry = EVENT_TYPES.find(t => t.value === key);
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  whileHover={{ y: -6, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleCategoryTap(key)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl glass-card-premium hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden group"
                  style={{
                    transformStyle: 'preserve-3d',
                    perspective: '600px',
                  }}
                >
                  {flashCard === key && (
                    <motion.div
                      initial={{ opacity: 1, scale: 2 }}
                      animate={{ opacity: 0, scale: 4 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 bg-gradient-to-br from-pink-400/30 to-rose-500/30 rounded-2xl pointer-events-none"
                    />
                  )}
                  <div className="relative group-hover:scale-110 transition-transform duration-300">
                    <img src={typeEntry?.icon || EVENT_ICONS[key as keyof typeof EVENT_ICONS]} alt={`Ícono ${label}`} loading="lazy" className="w-12 h-12" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-fluid-section bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-16 font-outfit tracking-tight">
              Todo lo que necesitas
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                whileHover={{ y: -6 }}
                className="text-center group"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 shadow-sm group-hover:shadow-md group-hover:shadow-pink-500/10 transition-all ring-1 ring-pink-200/50 dark:ring-pink-800/30">
                  <img src={feature.icon} alt={feature.title} loading="lazy" className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-fluid-body">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-fluid-section bg-gray-50/70 dark:bg-gray-800/30 backdrop-blur-sm overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-fluid-h2 font-bold text-center text-gray-900 dark:text-white mb-4 font-outfit tracking-tight">
              Lo que dicen nuestros usuarios
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto text-fluid-body">
              Miles de personas ya organizan sus eventos con Fiesta y Lista.
            </p>
          </motion.div>
          <div className="relative overflow-hidden">
            <div className="flex gap-6 animate-marquee-scroll w-max">
              {MARQUEE_TESTIMONIALS.map((t, idx) => (
                <div
                  key={`${t.name}-${idx}`}
                  className="w-[280px] sm:w-[320px] shrink-0 rounded-2xl p-6 glass-card-premium"
                >
                  <div className="flex gap-1 mb-3">{'⭐'.repeat(5)}</div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <img
                      src={t.avatar}
                      alt={`Avatar de ${t.name}`}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover bg-gray-100 animate-marquee-avatar-glow"
                    />
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

      <section className="space-fluid-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600 p-8 sm:p-16 text-center text-white relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-fluid-h2 font-bold mb-4 font-outfit tracking-tight">
                ¿Listo para empezar?
              </h2>
              <p className="text-fluid-body mb-8 text-pink-100 max-w-xl mx-auto">
                Crea tu primer evento gratis. No necesitas tarjeta de crédito.
              </p>
              <Link
                to="/register"
                className="inline-flex px-8 py-4 bg-white text-pink-600 rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-white/20 transition-all shadow-lg relative overflow-hidden group"
              >
                <span className="relative z-10">Crear mi primera lista</span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-card-shine" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-12 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200/50 dark:border-gray-700/50">
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
