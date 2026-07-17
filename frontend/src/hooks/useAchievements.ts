import { useCallback, useMemo, useState } from 'react';
import { showToast } from './useToast';

export interface Achievement {
  id: string;
  label: string;
  icon: string;
  description: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  eventCount: number;
  totalGifts: number;
  maxGiftsInEvent: number;
  cashFundActive: boolean;
  totalMessages: number;
  photoCount: number;
  maxPhotos: number;
  eventViews: number;
  isPro: boolean;
  setupComplete: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_event', label: 'Primer Evento', icon: 'celebration', description: 'Creaste tu primer evento', check: (c) => c.eventCount >= 1 },
  { id: 'gift_master', label: 'Maestro de Regalos', icon: 'redeem', description: '10 regalos en un evento', check: (c) => c.maxGiftsInEvent >= 10 },
  { id: 'cash_rain', label: 'Lluvia de Sobres', icon: 'savings', description: 'Activaste el fondo monetario', check: (c) => c.cashFundActive },
  { id: 'social_host', label: 'Anfitrión Social', icon: 'chat_bubble', description: 'Recibiste 5 mensajes', check: (c) => c.totalMessages >= 5 },
  { id: 'gallery_full', label: 'Galería Completa', icon: 'photo_library', description: 'Llenaste el álbum', check: (c) => c.photoCount >= c.maxPhotos && c.maxPhotos > 0 },
  { id: 'viral', label: 'Viral', icon: 'trending_up', description: '50 visitas a tu evento', check: (c) => c.eventViews >= 50 },
  { id: 'premium', label: 'Lista Premium', icon: 'star', description: 'Mejoraste a Pro', check: (c) => c.isPro },
  { id: 'all_set', label: 'Evento Redondo', icon: 'verified', description: 'Evento 100% listo', check: (c) => c.setupComplete },
];

const STORAGE_KEY = 'fy_achievements_unlocked';

function readUnlocked(): string[] {
  try {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useAchievements() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>(readUnlocked);

  const evaluate = useCallback((ctx: AchievementContext) => {
    const newlyUnlocked: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (ach.check(ctx)) newlyUnlocked.push(ach);
    }
    if (newlyUnlocked.length === 0) return;

    setUnlockedIds((prev) => {
      const added = newlyUnlocked.filter((a) => !prev.includes(a.id));
      if (added.length === 0) return prev;

      const next = [...prev, ...added.map((a) => a.id)];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}

      queueMicrotask(() => {
        for (const ach of added) {
          showToast(`🏆 Logro desbloqueado: ${ach.label}`, 'success');
        }
      });
      return next;
    });
  }, []);

  const earnedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  const getEarned = useCallback((): Set<string> => earnedSet, [earnedSet]);

  return { evaluate, getEarned, allAchievements: ACHIEVEMENTS };
}
