import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, setTokens } from '../services/api';
import { EVENT_ICONS, EVENT_LABELS } from '../types';
import { showToast } from '../hooks/useToast';
import LiveCounter from '../components/LiveCounter';

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

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestTitle, setGuestTitle] = useState('');
  const [guestType, setGuestType] = useState('BABY_SHOWER');
  const [guestCreating, setGuestCreating] = useState(false);
  const [guestAcceptTerms, setGuestAcceptTerms] = useState(false);

  const heroBg = useMemo(() => HERO_BGS[Math.floor(Math.random() * HERO_BGS.length)], []);

  const handleGuestCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestTitle.trim()) {
      showToast('Completa todos los campos', 'error');
      return;
    }
    if (!guestAcceptTerms) {
      showToast('Debes aceptar los términos y condiciones', 'error');
      return;
    }
    setGuestCreating(true);
    try {
      const data = await apiClient.post<{ event: { id: string }; accessToken: string; refreshToken: string }>('/api/events/guest', {
        title: guestTitle.trim(),
        eventType: guestType,
        hostName: guestName.trim(),
      });
      setTokens(data.accessToken, data.refreshToken);
      showToast('Evento creado. Regístrate para guardarlo permanentemente.', 'success');
      navigate(`/event/${data.event.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear evento', 'error');
    } finally {
      setGuestCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <nav className="sticky top-0 z-50" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icons/feature-gifts.png" alt="" className="w-8 h-8" loading="lazy" />
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
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

      <section className="relative overflow-hidden pt-20 pb-32">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 dark:opacity-20"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-gray-900/80 dark:to-gray-900" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-200/30 rounded-full blur-3xl dark:bg-pink-900/20" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl dark:bg-rose-900/20" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm font-medium">
              🎊 Crea tu lista de regalos en segundos
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
              La forma más fácil de
              <span className="block bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                organizar tus regalos
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-10">
              Crea listas de regalos para baby showers, bodas, cumpleaños y más.
              Tus invitados pueden apartar regalos o contribuir económicamente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-pink-500/30 transition-all"
                >
                  Ir a Mis Eventos
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setShowGuestForm(true)}
                    className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-pink-500/30 transition-all"
                  >
                    Comenzar Gratis →
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="px-8 py-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Registrarse
                  </button>
                  <Link
                    to="/pricing"
                    className="px-8 py-4 text-gray-500 dark:text-gray-400 bg-transparent border border-gray-200 dark:border-gray-700 rounded-full text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Ver Planes
                  </Link>
                </>
              )}
            </div>
            <div className="mt-16 flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>✅ Sin tarjeta de crédito</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>✅ Plan gratis disponible</span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>✅ Fácil de usar</span>
            </div>
            <LiveCounter />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <img
            src="/illustrations/mascot.png"
            alt="Mascota"
            loading="lazy"
            className="w-20 h-20 animate-float-slow"
          />
        </motion.div>
      </section>

      {showGuestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGuestForm(false)}>
          <form
            onSubmit={handleGuestCreate}
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
            style={{ animation: 'pop-in 0.3s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Crear evento rápido</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sin registro. Crea tu lista en segundos.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tu nombre</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Ej: María"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nombre del evento</label>
                <input
                  type="text"
                  value={guestTitle}
                  onChange={(e) => setGuestTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Ej: Baby Shower de Mateo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tipo de evento</label>
                <select
                  value={guestType}
                  onChange={(e) => setGuestType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={guestAcceptTerms}
                onChange={(e) => setGuestAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-pink-500 shrink-0"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Acepto los{' '}
                <Link to="/terminos-y-condiciones" target="_blank" className="text-pink-600 hover:underline">Términos y Condiciones</Link>
                {' '}y la{' '}
                <Link to="/politica-de-privacidad" target="_blank" className="text-pink-600 hover:underline">Política de Privacidad</Link>.
              </span>
            </label>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowGuestForm(false)}
                className="flex-1 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guestCreating || !guestAcceptTerms}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {guestCreating ? 'Creando...' : 'Crear evento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Perfecto para cualquier ocasión
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto">
            Sea cual sea el evento, tenemos todo lo que necesitas para organizar los regalos.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(EVENT_LABELS).map(([key, label]) => {
              const typeEntry = EVENT_TYPES.find(t => t.value === key);
              return (
                <motion.div
                  key={key}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
                  }}
                >
                  <img src={typeEntry?.icon || EVENT_ICONS[key as keyof typeof EVENT_ICONS]} alt="" loading="lazy" className="w-12 h-12" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-white mb-16">
            Todo lo que necesitas
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                whileHover={{ y: -4 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm" style={{ border: '1px solid rgba(255,255,255,0.4)' }}>
                  <img src={feature.icon} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-xl mx-auto">
            Miles de personas ya organizan sus eventos con Fiesta y Lista.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                whileHover={{ y: -4 }}
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
                }}
              >
                <div className="flex gap-1 mb-3">{'⭐'.repeat(5)}</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-white to-pink-50 dark:from-gray-900 dark:to-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-pink-500 to-rose-500 p-8 sm:p-16 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ¿Listo para empezar?
            </h2>
            <p className="text-lg sm:text-xl mb-8 text-pink-100 max-w-xl mx-auto">
              Crea tu primer evento gratis. No necesitas tarjeta de crédito.
            </p>
            <Link
              to="/register"
              className="inline-flex px-8 py-4 bg-white text-pink-600 rounded-full text-lg font-semibold hover:shadow-xl transition-all"
            >
              Crear mi primera lista
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Diego Alejandro Fierro Rivera. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/pricing" className="hover:text-pink-600">Planes</Link>
            <Link to="/terminos-y-condiciones" className="hover:text-pink-600">Términos</Link>
            <Link to="/politica-de-privacidad" className="hover:text-pink-600">Privacidad</Link>
            <Link to="/politica-de-cookies" className="hover:text-pink-600">Cookies</Link>
            <Link to="/derechos-arco" className="hover:text-pink-600">ARCO</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
