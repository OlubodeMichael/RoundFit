import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BADGE_CATALOGUE, type BadgeDef } from '@/constants/badges';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/utils/api';
import {
  getBadgesCached,
  loadBadges,
  patchBadgesAck,
  subscribeBadgesCache,
  type BadgesCachePayload,
} from '@/utils/badges-cache';

export interface UserBadge extends BadgeDef {
  earned: boolean;
  earned_at: string | null;
  times_earned: number;
}

function toUserBadges(payload: BadgesCachePayload | null): UserBadge[] {
  const earnedById = new Map((payload?.badges ?? []).map((b) => [b.id, b]));
  return BADGE_CATALOGUE.map((def) => {
    const remote = earnedById.get(def.id);
    return {
      ...def,
      earned: !!remote?.earned,
      earned_at: remote?.earned_at ?? null,
      times_earned: remote?.times_earned ?? 0,
    };
  });
}

export function useBadges() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<BadgesCachePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const applyPayload = useCallback((payload: BadgesCachePayload | null) => {
    if (!mountedRef.current) return;
    setData(payload);
    setError(null);
  }, []);

  const hasDataRef = useRef(false);
  hasDataRef.current = data !== null;

  const readCache = useCallback(async (options?: { force?: boolean; background?: boolean }) => {
    if (!userId) {
      applyPayload(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const background = options?.background ?? false;
    const force = options?.force ?? false;

    if (!background && !force) {
      setIsLoading(true);
    }
    if (background || force) {
      setIsRefreshing(true);
    }

    try {
      const payload = await loadBadges(userId, { force });
      applyPayload(payload);
    } catch {
      if (mountedRef.current && !hasDataRef.current) {
        setError('Could not load badges. Pull to refresh.');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [userId, applyPayload]);

  useEffect(() => {
    setData(null);
    setError(null);
    setIsLoading(true);
    void readCache();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeBadgesCache(() => {
      void getBadgesCached(userId).then((cached) => {
        if (cached) applyPayload(cached);
      });
    });
  }, [userId, applyPayload]);

  const refresh = useCallback(async () => {
    await readCache({ force: true, background: true });
  }, [readCache]);

  const ack = useCallback(async (awardIds: string[]) => {
    if (!userId || awardIds.length === 0) return;
    await apiFetch('/badges/ack', { method: 'POST', body: JSON.stringify({ ids: awardIds }) });
    const patched = await patchBadgesAck(userId, awardIds);
    if (patched) applyPayload(patched);
  }, [userId, applyPayload]);

  const badges = useMemo(() => toUserBadges(data), [data]);
  const earnedCount = badges.filter((b) => b.earned).length;

  return {
    badges,
    earnedCount,
    totalCount: BADGE_CATALOGUE.length,
    unnotified: data?.unnotified ?? [],
    isLoading,
    isRefreshing,
    error,
    refresh,
    ack,
  };
}
