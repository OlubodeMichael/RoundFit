import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { BadgeReviewModal } from '@/components/badges/BadgeReviewModal';
import { badgeById } from '@/constants/badges';
import { useAuth } from '@/hooks/use-auth';
import type { UserBadge } from '@/hooks/use-badges';
import { apiFetch } from '@/utils/api';
import {
  getBadgesCached,
  loadBadges,
  patchBadgesAck,
  prepareBadgesCache,
  subscribeBadgesCache,
  type BadgeAwardRef,
} from '@/utils/badges-cache';
import { shouldSyncBadgesAfterMutation } from '@/utils/cache-invalidation';
import { registerTodayDataSyncListener } from '@/utils/today-sync';

const FOREGROUND_SYNC_THROTTLE_MS = 5 * 60 * 1000;

interface QueuedUnlock {
  awardId: string;
  badge: UserBadge;
}

function toUnlockBadge(
  award: BadgeAwardRef,
  earnedAt: string | null,
  timesEarned: number,
): UserBadge | null {
  const def = badgeById(award.badge_id);
  if (!def) return null;
  return {
    ...def,
    earned: true,
    earned_at: earnedAt ?? new Date().toISOString(),
    times_earned: Math.max(timesEarned, 1),
  };
}

// ── Host — mounted once in the tab layout ─────────────────────────────────────
// Shows the badge review modal for each unnotified unlock, on any screen.

export function BadgeUnlockHost() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [queue, setQueue] = useState<QueuedUnlock[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const lastForegroundSyncRef = useRef(0);

  const userId = user?.id ?? null;

  const enqueueUnnotified = useCallback(async (awards: BadgeAwardRef[]) => {
    if (!userId || awards.length === 0) return;

    const cached = await getBadgesCached(userId);
    const fresh: QueuedUnlock[] = [];

    for (const award of awards) {
      if (seenRef.current.has(award.award_id)) continue;
      const earned = cached?.badges.find((row) => row.id === award.badge_id);
      const badge = toUnlockBadge(
        award,
        earned?.earned_at ?? null,
        earned?.times_earned ?? 1,
      );
      if (!badge) continue;
      seenRef.current.add(award.award_id);
      fresh.push({ awardId: award.award_id, badge });
    }

    if (fresh.length === 0) return;
    setQueue((q) => [...q, ...fresh]);
  }, [userId]);

  const readCacheAndEnqueue = useCallback(async () => {
    if (!userId) return;
    await prepareBadgesCache(userId);
    const cached = await getBadgesCached(userId);
    if (!cached) return;
    await enqueueUnnotified(cached.unnotified);
  }, [userId, enqueueUnnotified]);

  const syncFromServer = useCallback(async () => {
    if (!userId) return;
    try {
      const payload = await loadBadges(userId, { force: true });
      await enqueueUnnotified(payload.unnotified);
    } catch {
      // Unlock celebrations are best-effort — never surface errors.
    }
  }, [userId, enqueueUnnotified]);

  const bootstrap = useCallback(async () => {
    if (!userId) return;
    await prepareBadgesCache(userId);
    const cached = await getBadgesCached(userId);
    if (cached) {
      await enqueueUnnotified(cached.unnotified);
      return;
    }
    await syncFromServer();
  }, [userId, enqueueUnnotified, syncFromServer]);

  useEffect(() => {
    void bootstrap();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !userId) return;
      void readCacheAndEnqueue();
      const now = Date.now();
      if (now - lastForegroundSyncRef.current < FOREGROUND_SYNC_THROTTLE_MS) return;
      lastForegroundSyncRef.current = now;
      void syncFromServer();
    });
    return () => sub.remove();
  }, [bootstrap, readCacheAndEnqueue, syncFromServer, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeBadgesCache(() => {
      void readCacheAndEnqueue();
    });
  }, [userId, readCacheAndEnqueue]);

  useEffect(() => {
    if (!userId) return undefined;
    return registerTodayDataSyncListener((ctx) => {
      if (ctx.badgesUnlocked && ctx.badgesUnlocked.length > 0) {
        void enqueueUnnotified(ctx.badgesUnlocked);
        return;
      }
      if (!shouldSyncBadgesAfterMutation(ctx.domain)) return;
      void syncFromServer();
    });
  }, [userId, syncFromServer, enqueueUnnotified]);

  useEffect(() => {
    void readCacheAndEnqueue();
  }, [pathname, readCacheAndEnqueue]);

  const current = queue[0] ?? null;

  const handleClose = useCallback(() => {
    if (!current || !userId) return;
    void apiFetch('/badges/ack', {
      method: 'POST',
      body: JSON.stringify({ ids: [current.awardId] }),
    })
      .then(() => patchBadgesAck(userId, [current.awardId]))
      .catch(() => {});
    setQueue((q) => q.slice(1));
  }, [current, userId]);

  return (
    <BadgeReviewModal
      badge={current?.badge ?? null}
      visible={current != null}
      onClose={handleClose}
      celebration
    />
  );
}
