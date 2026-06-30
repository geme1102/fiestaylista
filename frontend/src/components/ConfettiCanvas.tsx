import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface ConfettiCanvasRef {
  triggerBurst: () => void;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  isRibbon: boolean;
  aspectRatio: number;
  wobble: number;
  wobbleSpeed: number;
}

interface StarParticle {
  x: number;
  y: number;
  size: number;
  targetSize: number;
  opacity: number;
  phase: number;
  speed: number;
}

export const ConfettiCanvas = forwardRef<ConfettiCanvasRef, object>(function ConfettiCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const backgroundStarsRef = useRef<StarParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const goldPalette = [
    '#f6d365', '#d4af37', '#aa771c', '#f3e5ab', '#f43f5e', '#e11d48', '#fef08a',
  ];

  const initializeBackgroundStars = (width: number, height: number) => {
    const stars: StarParticle[] = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        targetSize: Math.random() * 3 + 1.5,
        opacity: Math.random() * 0.7 + 0.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.03,
      });
    }
    backgroundStarsRef.current = stars;
  };

  const createBurst = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;
      const colorIndex = Math.floor(Math.random() * goldPalette.length);
      const isRibbon = Math.random() > 0.45;

      newParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: Math.random() * 40 - 20,
        size: Math.random() * 8 + 6,
        color: goldPalette[colorIndex],
        speedX: Math.cos(angle) * speed * 0.4 + (Math.random() - 0.5) * 5,
        speedY: Math.random() * 5 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        opacity: 1,
        isRibbon,
        aspectRatio: Math.random() * 0.6 + 0.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.05 + 0.02,
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles].slice(-300);
  };

  useImperativeHandle(ref, () => ({
    triggerBurst() {
      createBurst();
    },
  }));

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeBackgroundStars(canvas.width, canvas.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const checkObserver = new ResizeObserver(() => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        handleResize();
      }
    });
    checkObserver.observe(document.body);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      backgroundStarsRef.current.forEach((star) => {
        star.phase += star.speed;
        const scale = 0.5 + Math.sin(star.phase) * 0.5;
        const currentOpacity = star.opacity * (0.3 + scale * 0.7);
        const currentSize = star.size + (star.targetSize - star.size) * scale;

        ctx.save();
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = '#fce7f3';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f43f5e';

        ctx.beginPath();
        ctx.moveTo(star.x, star.y - currentSize);
        ctx.lineTo(star.x + currentSize / 2, star.y);
        ctx.lineTo(star.x, star.y + currentSize);
        ctx.lineTo(star.x - currentSize / 2, star.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        star.y += 0.15;
        if (star.y > canvas.height) {
          star.y = -10;
          star.x = Math.random() * canvas.width;
        }
      });

      particlesRef.current.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.wobble) * 1.5;
        p.speedY += 0.08;
        p.speedX *= 0.985;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        if (p.y > canvas.height - 120) {
          p.opacity -= 0.015;
        }

        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        const gradient = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, p.color);
        ctx.fillStyle = gradient;

        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;

        if (p.isRibbon) {
          ctx.fillRect(-p.size, -p.size * p.aspectRatio, p.size * 2, p.size * 4 * p.aspectRatio);
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * p.aspectRatio, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      particlesRef.current = particlesRef.current.filter((p) => p.opacity > 0 && p.y < canvas.height + 20);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      checkObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-300"
      style={{ mixBlendMode: 'screen' }}
    />
  );
});

ConfettiCanvas.displayName = 'ConfettiCanvas';
