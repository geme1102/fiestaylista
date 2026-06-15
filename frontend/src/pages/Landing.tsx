import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { FloatingOrbs } from '../components/landing/FloatingOrbs';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingCategoryCarousel } from '../components/landing/LandingCategoryCarousel';
import { LandingFeatures } from '../components/landing/LandingFeatures';
import { LandingTestimonials } from '../components/landing/LandingTestimonials';
import { LandingCTA } from '../components/landing/LandingCTA';
import { LandingFooter } from '../components/landing/LandingFooter';

const TYPING_PHRASES = ['organizar tus regalos sin estrés', 'recibir justo lo que necesitas', 'decir adiós a los regalos repetidos'];

function useTypewriter(texts: string[], typingSpeed = 55, deletingSpeed = 30, pauseTime = 2500) {
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

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const typedText = useTypewriter(TYPING_PHRASES);
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Fiesta y Lista - Listas de Regalos",
            "description": "App colombiana para crear listas de regalos para cualquier evento.",
            "url": "https://fiestaylista.com",
            "inLanguage": "es-CO",
            "isFamilyFriendly": true,
            "isPartOf": {
              "@type": "WebSite",
              "name": "Fiesta y Lista",
              "url": "https://fiestaylista.com"
            },
            "about": {
              "@type": "Thing",
              "name": "Listas de regalos"
            }
          })}
        </script>
      </Helmet>
      <div className="min-h-screen bg-[#FAF9F8]">
      <FloatingOrbs />
      <LandingNavbar scrolled={scrolled > 50} isAuthenticated={isAuthenticated} />
      <LandingHero typedText={typedText} isAuthenticated={isAuthenticated} onNavigate={navigate} />
      <LandingCategoryCarousel onNavigate={navigate} />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingCTA onNavigate={navigate} />
      <LandingFooter />
    </div>
    </>
  );
}
