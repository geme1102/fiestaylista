import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';

interface LiveStats {
  totalEvents: number;
  eventsToday: number;
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const displayRef = useRef(0);

  useEffect(() => {
    fromRef.current = displayRef.current;
    startRef.current = null;
    let frame: number;
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromRef.current + (value - fromRef.current) * easeOut);
      setDisplay(current);
      displayRef.current = current;
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

export default function LiveCounter() {
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    apiClient.get<{ events?: number }>('/api/public/stats', { signal: controller.signal })
      .then((data) => {
        if (mounted && data.events !== undefined) {
          setStats({ totalEvents: data.events, eventsToday: 0 });
        }
      })
      .catch(() => {
        if (mounted && import.meta.env.DEV) console.warn('[LiveCounter] Error fetching stats');
      });
    return () => { mounted = false; controller.abort(); };
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center justify-center gap-6 text-sm text-on-surface-variant mt-8">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span><strong className="text-on-surface"><AnimatedNumber value={stats.totalEvents} /></strong> listas creadas</span>
      </span>
    </div>
  );
}
