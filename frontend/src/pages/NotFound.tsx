import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#0B0F19] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15 }}
        >
          <div className="w-48 h-48 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-100 to-fuchsia-100 dark:from-rose-900/20 dark:to-fuchsia-900/20 flex items-center justify-center text-6xl">
            🔍
          </div>
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2 font-outfit">404</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
          Página no encontrada
        </p>
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="inline-flex px-8 py-4 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all min-h-[44px] items-center"
        >
          {isAuthenticated ? 'Ir al Dashboard' : 'Volver al inicio'}
        </Link>
      </div>
    </div>
  );
}
