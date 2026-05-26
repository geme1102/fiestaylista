import { useState, useEffect } from 'react';

interface LiveStats {
  totalEvents: number;
  eventsToday: number;
}

export default function LiveCounter() {
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    fetch('/api/public/stats')
      .then(r => r.json())
      .then((data) => {
        if (data.events !== undefined) {
          setStats({ totalEvents: data.events, eventsToday: 0 });
        }
      })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400 mt-8">
      <span className="flex items-center gap-1.5">
        <span className="text-lg">📊</span>
        <span><strong className="text-gray-900 dark:text-white">{stats.totalEvents.toLocaleString()}</strong> listas creadas</span>
      </span>
    </div>
  );
}
