import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface LandingCTAProps {
  onNavigate: (path: string) => void;
}

export function LandingCTA({ onNavigate }: LandingCTAProps) {
  return (
    <section className="relative z-10 w-full py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="relative w-full bg-white rounded-[3rem] px-4 py-20 md:py-28 text-center overflow-hidden border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-multiply"
            style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}
          ></div>

          <div className="absolute inset-0 opacity-100 mix-blend-multiply">
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                x: ['-20%', '30%', '-20%'],
                y: ['-10%', '20%', '-10%'],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-[0%] left-[0%] w-[80vw] h-[80vw] md:w-[40rem] md:h-[40rem] bg-gradient-to-br from-pink-400 via-[#d23284] to-brand-berry rounded-full blur-[60px] md:blur-[100px] opacity-[0.9]"
            />

            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                x: ['20%', '-30%', '20%'],
                y: ['20%', '-10%', '20%'],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-[10%] right-[0%] w-[75vw] h-[75vw] md:w-[35rem] md:h-[35rem] bg-gradient-to-bl from-cyan-300 via-blue-500 to-indigo-500 rounded-full blur-[60px] md:blur-[100px] opacity-[0.85]"
            />

            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                x: ['-30%', '20%', '-30%'],
                y: ['20%', '-30%', '20%'],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-[0%] left-[10%] w-[90vw] h-[90vw] md:w-[45rem] md:h-[45rem] bg-gradient-to-tr from-yellow-300 via-orange-400 to-brand-peach rounded-full blur-[60px] md:blur-[100px] opacity-[0.9]"
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center max-w-3xl mx-auto bg-white/60 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-14 border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
        >
          <h2 className="font-outfit text-4xl sm:text-5xl md:text-6xl font-bold text-stone-800 mb-4 tracking-tight drop-shadow-sm">
            ¿Listo para empezar?
          </h2>
          <p className="text-stone-700 text-lg sm:text-xl md:text-2xl font-medium mb-10 md:mb-12 max-w-xl text-center">
            Tu celebración perfecta empieza aquí. <br className="hidden sm:block" /> Crea tu primer evento gratis, sin tarjeta de crédito.
          </p>

          <div className="relative group w-full sm:w-auto">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-primary/60 rounded-full blur-[15px] pointer-events-none"
            />

            <motion.button
              onClick={() => onNavigate('/register')}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative flex items-center justify-center w-full sm:w-auto gap-3 px-10 py-5 rounded-full text-white bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20 overflow-hidden cursor-pointer"
            >
              <motion.div
                className="absolute inset-0 w-full h-full z-0 pointer-events-none flex items-center"
                initial={{ x: '-150%' }}
                animate={{ x: '150%' }}
                transition={{ duration: 2.5, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatDelay: 4 }}
              >
                <div className="w-[30%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"></div>
              </motion.div>

              <span className="relative z-10 flex items-center gap-2 text-lg tracking-wide font-semibold text-white">
                Crear mi primera lista <ArrowRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1.5 duration-300" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
