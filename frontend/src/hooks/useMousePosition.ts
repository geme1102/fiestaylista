import { useState, useEffect, useRef, useMemo } from 'react';

interface MousePosition {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
}

export function useMousePosition(): MousePosition {
  const [pos, setPos] = useState<MousePosition>({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    let targetX = 0, targetY = 0;
    const handleMouse = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };
    const handleTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) { targetX = t.clientX; targetY = t.clientY; }
    };
    const animate = () => {
      setPos((prev) => {
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const x = lerp(prev.x, targetX, 0.1);
        const y = lerp(prev.y, targetY, 0.1);
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        return {
          x, y,
          normalizedX: (x / w) * 2 - 1,
          normalizedY: (y / h) * 2 - 1,
        };
      });
      frameRef.current = requestAnimationFrame(animate);
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('touchmove', handleTouch);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return useMemo(() => pos, [pos.x, pos.y, pos.normalizedX, pos.normalizedY]);
}

export function useDeviceOrientation() {
  const [gamma, setGamma] = useState(0);
  const [beta, setBeta] = useState(0);

  useEffect(() => {
    const handle = (e: DeviceOrientationEvent) => {
      setGamma(e.gamma ?? 0);
      setBeta(e.beta ?? 0);
    };
    window.addEventListener('deviceorientation', handle, true);
    return () => window.removeEventListener('deviceorientation', handle, true);
  }, []);

  return { gamma, beta };
}
