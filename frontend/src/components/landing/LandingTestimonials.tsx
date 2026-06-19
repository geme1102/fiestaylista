import { motion } from 'framer-motion';
import GoldStars from '../GoldStars';

const TESTIMONIALS = [
  { name: 'María G.', role: 'Baby Shower', text: 'Llegaron 7 invitados y los 7 regalos distintos. Nadie repitió y todos preguntaron cómo lo hicimos. Súper fácil.', avatar: '/illustrations/avatar-1.png' },
  { name: 'Carlos R.', role: 'Boda', text: 'Nadie se confundió con los regalos. Cada invitado apartó el suyo y hasta recibimos plata para la luna de miel.', avatar: '/illustrations/avatar-2.png' },
  { name: 'Ana L.', role: 'Cumpleaños', text: 'En 2 minutos tenía la lista lista. Lo compartí por WhatsApp y los abuelos apartaron sin necesidad de registro.', avatar: '/illustrations/avatar-3.png' },
];

const MARQUEE_TESTIMONIALS = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

export function LandingTestimonials() {
  return (
    <section className="pt-12 md:pt-20 pb-12 md:pb-20 bg-surface/70 backdrop-blur-sm overflow-hidden relative z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="font-outfit text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight md:leading-tight font-bold mb-4 md:mb-5 text-center"
          >
            <span className="text-gradient-premium leading-normal">Lo que dicen nuestros usuarios</span>
          </motion.h2>
          <p className="text-center text-on-surface-variant mb-10 max-w-xl mx-auto text-fluid-body">
            Miles de familias colombianas ya organizan sus celebraciones con Fiesta y Lista.
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
  );
}
