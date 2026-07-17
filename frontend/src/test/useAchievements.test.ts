import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ACHIEVEMENTS, type AchievementContext } from '../hooks/useAchievements';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ACHIEVEMENTS checks', () => {
  const fullCtx: AchievementContext = {
    eventCount: 5, totalGifts: 20, maxGiftsInEvent: 15,
    cashFundActive: true, totalMessages: 10,
    photoCount: 50, maxPhotos: 50, eventViews: 100,
    isPro: true, setupComplete: true,
  };

  it('first_event: true when eventCount >= 1', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'first_event')!;
    expect(ach.check({ ...fullCtx, eventCount: 0 })).toBe(false);
    expect(ach.check({ ...fullCtx, eventCount: 1 })).toBe(true);
  });

  it('gift_master: true when maxGiftsInEvent >= 10', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'gift_master')!;
    expect(ach.check({ ...fullCtx, maxGiftsInEvent: 9 })).toBe(false);
    expect(ach.check({ ...fullCtx, maxGiftsInEvent: 10 })).toBe(true);
  });

  it('cash_rain: true when cashFundActive', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'cash_rain')!;
    expect(ach.check({ ...fullCtx, cashFundActive: false })).toBe(false);
    expect(ach.check({ ...fullCtx, cashFundActive: true })).toBe(true);
  });

  it('social_host: true when totalMessages >= 5', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'social_host')!;
    expect(ach.check({ ...fullCtx, totalMessages: 4 })).toBe(false);
    expect(ach.check({ ...fullCtx, totalMessages: 5 })).toBe(true);
  });

  it('gallery_full: false when maxPhotos is 0', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'gallery_full')!;
    expect(ach.check({ ...fullCtx, photoCount: 0, maxPhotos: 0 })).toBe(false);
    expect(ach.check({ ...fullCtx, photoCount: 10, maxPhotos: 10 })).toBe(true);
    expect(ach.check({ ...fullCtx, photoCount: 9, maxPhotos: 10 })).toBe(false);
  });

  it('viral: true when eventViews >= 50', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'viral')!;
    expect(ach.check({ ...fullCtx, eventViews: 49 })).toBe(false);
    expect(ach.check({ ...fullCtx, eventViews: 50 })).toBe(true);
  });

  it('premium: true when isPro', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'premium')!;
    expect(ach.check({ ...fullCtx, isPro: false })).toBe(false);
    expect(ach.check({ ...fullCtx, isPro: true })).toBe(true);
  });

  it('all_set: true when setupComplete', () => {
    const ach = ACHIEVEMENTS.find(a => a.id === 'all_set')!;
    expect(ach.check({ ...fullCtx, setupComplete: false })).toBe(false);
    expect(ach.check({ ...fullCtx, setupComplete: true })).toBe(true);
  });
});

describe('useAchievements evaluate', () => {
  const emptyCtx: AchievementContext = { eventCount: 0, totalGifts: 0, maxGiftsInEvent: 0, cashFundActive: false, totalMessages: 0, photoCount: 0, maxPhotos: 0, eventViews: 0, isPro: false, setupComplete: false };

  it('unlocks first_event when eventCount >= 1', async () => {
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());
    const ctx: AchievementContext = { ...emptyCtx, eventCount: 1 };

    act(() => { result.current.evaluate(ctx); });

    const earned = result.current.getEarned();
    expect(earned.has('first_event')).toBe(true);
  });

  it('does not re-unlock already stored achievements', async () => {
    localStorage.setItem('fy_achievements_unlocked', JSON.stringify(['first_event']));
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());
    const ctx: AchievementContext = { ...emptyCtx, eventCount: 1 };

    act(() => { result.current.evaluate(ctx); });

    const stored = JSON.parse(localStorage.getItem('fy_achievements_unlocked') || '[]');
    expect(stored).toEqual(['first_event']);
  });

  it('unlocks multiple achievements from a single evaluate', async () => {
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());
    const ctx: AchievementContext = { ...emptyCtx, eventCount: 1, cashFundActive: true, totalMessages: 5 };

    act(() => { result.current.evaluate(ctx); });

    const earned = result.current.getEarned();
    expect(earned.has('first_event')).toBe(true);
    expect(earned.has('cash_rain')).toBe(true);
    expect(earned.has('social_host')).toBe(true);
  });

  it('persists unlocked achievements to localStorage', async () => {
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());
    const ctx: AchievementContext = { ...emptyCtx, eventCount: 1 };

    act(() => { result.current.evaluate(ctx); });

    const stored = JSON.parse(localStorage.getItem('fy_achievements_unlocked') || '[]');
    expect(stored).toContain('first_event');
  });

  it('getEarned returns empty set with no stored achievements', async () => {
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());

    const earned = result.current.getEarned();

    expect(earned.size).toBe(0);
  });

  it('getEarned returns stored achievements', async () => {
    localStorage.setItem('fy_achievements_unlocked', JSON.stringify(['first_event', 'viral']));
    const { useAchievements } = await import('../hooks/useAchievements');
    const { result } = renderHook(() => useAchievements());

    const earned = result.current.getEarned();

    expect(earned.has('first_event')).toBe(true);
    expect(earned.has('viral')).toBe(true);
    expect(earned.size).toBe(2);
  });
});
