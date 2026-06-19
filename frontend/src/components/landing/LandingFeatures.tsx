import { motion } from 'framer-motion';
import { Gift, Camera, Mail, BarChart3 } from 'lucide-react';

export function LandingFeatures() {
  return (
    <section className="pt-10 md:pt-16 pb-10 md:pb-16 px-4 md:px-8 max-w-6xl mx-auto">
      <div className="text-center mb-8 md:mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="font-outfit text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight md:leading-tight font-bold mb-4 md:mb-5"
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
          Dile adiós a las planillas de Excel y los WhatsApps confusos. Tu celebración perfecta, organizada desde un solo lugar.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
          className="md:col-span-2 relative p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] bg-surface/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 md:gap-10 group cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gradient-to-bl from-brand-peach/30 via-brand-pink/10 to-transparent opacity-60 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
          <div className="relative z-10 flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-[1.2rem] md:rounded-3xl bg-gradient-to-br from-brand-pink to-brand-peach p-1 shadow-[0_10px_25px_-5px_rgba(210,50,132,0.4)] group-hover:shadow-[0_15px_35px_-5px_rgba(210,50,132,0.5)] transition-shadow">
            <div className="w-full h-full bg-white rounded-[1rem] md:rounded-[20px] flex items-center justify-center">
              <Gift className="w-8 h-8 md:w-10 md:h-10 text-brand-pink" strokeWidth={1.5} />
            </div>
          </div>
          <div className="relative z-10 text-center sm:text-left flex-1">
            <h3 className="text-2xl md:text-3xl font-outfit font-bold text-gray-900 mb-3 md:mb-4">Regalos sin repetir</h3>
            <p className="text-gray-700 text-sm sm:text-base md:text-lg font-light leading-relaxed">
              Agrega lo que necesitas, comparte el enlace y cada invitado aparta el suyo. Nadie se equivoca, todos aciertan — sin planillas, sin WhatsApps confusos, sin estrés.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ y: -5, scale: 1.02 }}
          transition={{ duration: 0.5, delay: 0.1, type: 'spring', bounce: 0.3 }}
          className="relative p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] bg-surface/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col items-center justify-center text-center group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 to-brand-lavender/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="relative z-10 w-full h-36 md:h-40 mb-4 md:mb-6 flex items-center justify-center perspective-[1000px]">
            <motion.div className="absolute z-0 w-20 h-24 md:w-24 md:h-28 bg-white p-1 pb-4 md:pb-5 shadow-md rounded-sm -rotate-12 -ml-20 -mt-4 opacity-70 transition-all duration-300">
              <div className="w-full h-full bg-gray-100 rounded-[2px] overflow-hidden">
              </div>
            </motion.div>
            <motion.div className="absolute z-20 w-28 h-32 md:w-32 md:h-36 bg-white p-2 pb-6 md:pb-8 shadow-xl rounded-sm -rotate-3 transition-all duration-300">
              <div className="w-full h-full bg-gray-100 rounded-[2px] overflow-hidden">
                <img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=200" alt="Evento" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center shadow-lg transform -translate-y-2">
                  <Camera className="w-5 h-5 text-gray-900" strokeWidth={2} />
                </div>
              </div>
            </motion.div>
          </div>

          <h3 className="relative z-10 text-xl md:text-2xl font-outfit font-bold text-gray-900 mb-2 md:mb-3">Fotos que todos comparten</h3>
          <p className="relative z-10 text-sm sm:text-base text-gray-700 font-light leading-relaxed">
            Sube tus fotos y deja que los invitados también aporten las suyas desde el celular. Todos ven el evento desde sus ojos — sin apps, sin registros, sin complicaciones.
          </p>
        </motion.div>

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

          <h3 className="relative z-10 text-xl md:text-2xl font-outfit font-bold text-white mb-2 md:mb-3">Regalos en efectivo, sin efectivo</h3>
          <p className="relative z-10 text-sm sm:text-base text-white/90 font-light leading-relaxed">
            Tus invitados te envían dinero directo a tu cuenta. Ideal para la luna de miel, el ajuar del bebé o lo que tú prefieras. Seguro, rápido y sin complicaciones.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ duration: 0.5, delay: 0.3, type: 'spring', bounce: 0.3 }}
          className="md:col-span-2 relative p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] bg-surface/70 backdrop-blur-3xl border-2 border-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08),inset_0_4px_20px_rgba(255,255,255,1)] overflow-hidden flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 md:gap-10 group cursor-pointer"
        >
          <div className="absolute bottom-0 right-0 left-0 h-32 md:h-40 bg-gradient-to-t from-brand-lavender/20 to-transparent opacity-60 pointer-events-none group-hover:h-40 md:group-hover:h-48 transition-all duration-700"></div>

          <div className="relative z-10 text-center sm:text-left flex-1 order-2 sm:order-1">
            <h3 className="text-2xl md:text-3xl font-outfit font-bold text-gray-900 mb-3 md:mb-4">Tú ves todo</h3>
            <p className="text-gray-700 text-sm sm:text-base md:text-lg font-light leading-relaxed">
              Sabes quién apartó, qué falta y cuántas personas han visto tu lista. Todo desde un panel simple, sin perder tiempo. Tú disfruta, la app hace el resto.
            </p>
          </div>

          <div className="relative z-10 flex-shrink-0 w-20 h-20 md:w-24 md:h-24 order-1 sm:order-2 rounded-[1.2rem] md:rounded-3xl bg-gradient-to-br from-brand-blue to-brand-lavender p-1 shadow-[0_10px_25px_-5px_rgba(47,46,190,0.3)] group-hover:shadow-[0_15px_35px_-5px_rgba(47,46,190,0.4)] transition-shadow">
            <div className="w-full h-full bg-white rounded-[1rem] md:rounded-[20px] flex items-center justify-center">
              <BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-brand-blue" strokeWidth={1.5} />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mt-10 md:mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 px-4"
      >
        {[
          { value: '+1,000', label: 'Eventos creados' },
          { value: '+15,000', label: 'Regalos apartados' },
          { value: '4.9', label: 'Calificación' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl md:text-3xl font-outfit font-bold text-gradient-premium">{stat.value}</p>
            <p className="text-sm text-on-surface-variant mt-1">{stat.label}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
