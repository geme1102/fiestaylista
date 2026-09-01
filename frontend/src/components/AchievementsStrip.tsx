import { memo } from 'react';
import { motion } from 'framer-motion';
import { ACHIEVEMENTS } from '../hooks/useAchievements';
import { cn } from '../utils/cn';

export const AchievementsStrip = memo(function AchievementsStrip({
  unlockedIds,
  compact = false,
}: {
  unlockedIds: Set<string>;
  compact?: boolean;
}) {
  const earned = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id));
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id));

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-1', compact && 'gap-1.5')}>
      {ACHIEVEMENTS.map((ach) => {
        const isUnlocked = unlockedIds.has(ach.id);
        return (
          <motion.div
            key={ach.id}
            whileHover={{ scale: 1.1, y: -2 }}
            title={`${ach.label} — ${ach.description}${isUnlocked ? ' ✅' : ' (bloqueado)'}`}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 transition-all flex-shrink-0',
              compact ? 'w-12 h-12' : 'w-16 h-16',
              isUnlocked
                ? 'bg-gradient-to-br from-gold/10 to-gold-light/10 border-gold/40 text-gold shadow-md shadow-gold/10'
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant/30',
            )}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: compact ? 20 : 26,
                fontVariationSettings: isUnlocked ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {ach.icon}
            </span>
          </motion.div>
        );
      })}
      {earned.length === 0 && locked.length === ACHIEVEMENTS.length && (
        <p className="text-xs text-on-surface-variant px-2">
          Completa acciones para desbloquear logros 🏆
        </p>
      )}
    </div>
  );
});
