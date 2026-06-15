import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="py-12 bg-surface-container-lowest border-t border-outline-variant/50 relative z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-on-surface-variant">
        <p>© {new Date().getFullYear()} fiestaylista.com. Todos los derechos reservados.</p>
        <div className="flex justify-center gap-6 mt-4">
          <Link to="/pricing" className="hover:text-primary transition-colors">Planes</Link>
          <Link to="/terminos-y-condiciones" className="hover:text-primary transition-colors">Términos</Link>
          <Link to="/politica-de-privacidad" className="hover:text-primary transition-colors">Privacidad</Link>
          <Link to="/politica-de-cookies" className="hover:text-primary transition-colors">Cookies</Link>
          <Link to="/derechos-arco" className="hover:text-primary transition-colors">ARCO</Link>
        </div>
      </div>
    </footer>
  );
}
