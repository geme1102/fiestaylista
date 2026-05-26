import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
      <div className="text-center max-w-sm">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15 }}
        >
          <img
            src="/illustrations/illustration-404.png"
            alt="404"
            className="w-64 h-64 mx-auto mb-6"
          />
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
          Página no encontrada
        </p>
        <Link
          to="/"
          className="inline-flex px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-pink-500/25 transition-all min-h-[44px] items-center"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
