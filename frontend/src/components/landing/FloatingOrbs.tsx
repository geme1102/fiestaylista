import { motion } from 'framer-motion';

export function FloatingOrbs() {
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
