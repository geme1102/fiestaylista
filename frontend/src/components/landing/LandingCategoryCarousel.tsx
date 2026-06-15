import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gem, Baby, Cake, Droplet, Sun, Home, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface LandingCategoryCarouselProps {
  onNavigate: (path: string) => void;
}

export function LandingCategoryCarousel({ onNavigate }: LandingCategoryCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollLeft = useCallback(() => {
    carouselRef.current?.scrollBy({ left: -340, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    carouselRef.current?.scrollBy({ left: 340, behavior: 'smooth' });
  }, []);

  const events = [
    { title: 'Boda', icon: Gem, color: 'from-brand-peach/50 to-brand-pink/20', glow: 'bg-brand-pink' },
    { title: 'Baby Shower', icon: Baby, color: 'from-brand-blue/20 to-brand-lavender/50', glow: 'bg-brand-blue' },
    { title: 'Cumpleaños', icon: Cake, color: 'from-amber-200 to-rose-200', glow: 'bg-amber-400' },
    { title: 'Bautizo', icon: Droplet, color: 'from-emerald-100 to-teal-200/80', glow: 'bg-teal-400' },
    { title: 'Comunión', icon: Sun, color: 'from-brand-lavender/40 to-brand-peach/20', glow: 'bg-brand-peach' },
    { title: 'Casa Shower', icon: Home, color: 'from-orange-100 to-amber-200/60', glow: 'bg-orange-400' },
  ];

  return (
    <section className="pt-16 md:pt-24 pb-12 md:pb-20">
      <div className="max-w-4xl mx-auto text-center mb-10 md:mb-14 px-4 md:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-tight md:leading-tight font-bold mb-4 drop-shadow-sm"
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
          {events.map((event, idx) => (
            <motion.button
              key={event.title}
              onClick={() => onNavigate('/register')}
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

              <h3 className="relative z-10 text-xl md:text-2xl font-outfit font-bold text-gray-900 tracking-tight mb-3 md:mb-4">
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
  );
}
