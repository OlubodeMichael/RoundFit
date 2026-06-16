import { BADGE_CATALOGUE, badgeById } from '@/constants/badges';
import { apiFetch } from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildResourceKey,
  getResourceCached,
  invalidateByPrefix,
  invalidateResourceCache,
  setResourceCached,
} from '@/utils/resource-cache';

/** Earned state is stable until a new unlock — no TTL-driven refetch. */
export const BADGES_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Bump when local badge cache shape or server semantics change. */
const BADGES_CACHE_SCHEMA = 'repeatable-v1';
const BADGES_CACHE_MIGRATION_KEY = '@roundfit/badges_cache_migration';

export interface BadgeAwardRef {
  award_id: string;
  badge_id: string;
}

export interface BadgesEarnedState {
  id: string;
  earned: boolean;
  earned_at: string | null;
  times_earned: number;
}

export interface BadgesCachePayload {
  badges: BadgesEarnedState[];
  unnotified: BadgeAwardRef[];
}

type BadgesListener = () => void;
const listeners = new Set<BadgesListener>();

export function buildBadgesCacheKey(userId: string): string {
  return buildResourceKey('badges', userId, BADGES_CACHE_SCHEMA);
}

/** Drop all persisted badge cache entries for a user (memory + AsyncStorage). */
export async function clearBadgesLocalCache(userId: string): Promise<void> {
  await invalidateByPrefix(`resource:v2:badges:${userId}`);
  notifyBadgesCache();
}

/** One-time wipe when badge cache schema changes. */
async function migrateBadgesCacheIfNeeded(userId: string): Promise<void> {
  const flagKey = `${BADGES_CACHE_MIGRATION_KEY}:${BADGES_CACHE_SCHEMA}:${userId}`;
  try {
    const done = await AsyncStorage.getItem(flagKey);
    if (done === '1') return;
    await clearBadgesLocalCache(userId);
    await AsyncStorage.setItem(flagKey, '1');
  } catch {
    await clearBadgesLocalCache(userId);
  }
}

export function subscribeBadgesCache(listener: BadgesListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyBadgesCache(): void {
  listeners.forEach((listener) => listener());
}

function parseAwardRef(raw: unknown): BadgeAwardRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.award_id !== 'string' || typeof row.badge_id !== 'string') return null;
  if (!badgeById(row.badge_id)) return null;
  return { award_id: row.award_id, badge_id: row.badge_id };
}

function parseBadgesResponse(body: Record<string, unknown>): BadgesCachePayload {
  const serverRows = Array.isArray(body.badges)
    ? (body.badges as Record<string, unknown>[])
    : [];
  const serverById = new Map(serverRows.map((row) => [String(row.id), row]));

  const badges: BadgesEarnedState[] = BADGE_CATALOGUE.map((def) => {
    const remote = serverById.get(def.id);
    const timesEarned =
      typeof remote?.times_earned === 'number' ? remote.times_earned : remote?.earned ? 1 : 0;
    return {
      id: def.id,
      earned: timesEarned > 0 || !!remote?.earned,
      earned_at: typeof remote?.earned_at === 'string' ? remote.earned_at : null,
      times_earned: timesEarned,
    };
  });

  const unnotified = (Array.isArray(body.unnotified) ? body.unnotified : [])
    .map(parseAwardRef)
    .filter((ref): ref is BadgeAwardRef => !!ref);

  return { badges, unnotified };
}

async function fetchBadgesFromApi(): Promise<BadgesCachePayload> {
  const { ok, body } = await apiFetch('/badges');
  if (!ok || !Array.isArray(body.badges)) {
    throw new Error(
      typeof body.error === 'string' ? body.error : 'Failed to load badges',
    );
  }
  return parseBadgesResponse(body as Record<string, unknown>);
}

async function writeBadgesCache(
  userId: string,
  payload: BadgesCachePayload,
): Promise<void> {
  await setResourceCached(buildBadgesCacheKey(userId), payload, BADGES_CACHE_TTL_MS);
  notifyBadgesCache();
}

/** Read persisted earned state without hitting the network. */
export async function getBadgesCached(
  userId: string,
): Promise<BadgesCachePayload | null> {
  const cached = await getResourceCached<BadgesCachePayload>(buildBadgesCacheKey(userId));
  return cached?.data ?? null;
}

/**
 * Cache-first load. Fetches from the API only when no local entry exists, or when
 * `force` is true (pull-to-refresh, post-unlock sync).
 */
export async function loadBadges(
  userId: string,
  options?: { force?: boolean },
): Promise<BadgesCachePayload> {
  const force = options?.force ?? false;

  await migrateBadgesCacheIfNeeded(userId);

  if (!force) {
    const cached = await getBadgesCached(userId);
    if (cached) return cached;
  }

  const fresh = await fetchBadgesFromApi();
  await writeBadgesCache(userId, fresh);
  return fresh;
}

/** Force-refresh after an action that may have unlocked a badge. */
export async function syncBadgesAfterMutation(userId: string): Promise<BadgesCachePayload> {
  return loadBadges(userId, { force: true });
}

/** Update local cache after the user dismisses unlock toasts — no refetch. */
export async function patchBadgesAck(
  userId: string,
  awardIds: string[],
): Promise<BadgesCachePayload | null> {
  if (awardIds.length === 0) return getBadgesCached(userId);

  const cached = await getBadgesCached(userId);
  if (!cached) return null;

  const acked = new Set(awardIds);
  const updated: BadgesCachePayload = {
    ...cached,
    unnotified: cached.unnotified.filter((ref) => !acked.has(ref.award_id)),
  };
  await writeBadgesCache(userId, updated);
  return updated;
}

export async function invalidateBadgesCache(userId: string): Promise<void> {
  await invalidateResourceCache(buildBadgesCacheKey(userId));
  notifyBadgesCache();
}

/** Run before reading badge cache outside `loadBadges` (e.g. unlock toast bootstrap). */
export async function prepareBadgesCache(userId: string): Promise<void> {
  await migrateBadgesCacheIfNeeded(userId);
}

/** Merge newly unlocked awards from a mutation response into the local cache. */
export async function applyBadgesUnlocked(
  userId: string,
  awards: BadgeAwardRef[],
): Promise<void> {
  const unlocked = awards.filter((ref) => badgeById(ref.badge_id));
  if (unlocked.length === 0) return;

  const cached = await getBadgesCached(userId);
  const now = new Date().toISOString();
  const unlockedByBadge = new Map<string, number>();
  for (const ref of unlocked) {
    unlockedByBadge.set(ref.badge_id, (unlockedByBadge.get(ref.badge_id) ?? 0) + 1);
  }

  const badges: BadgesEarnedState[] = cached
    ? cached.badges.map((row) => {
        const delta = unlockedByBadge.get(row.id) ?? 0;
        if (delta === 0) return row;
        return {
          ...row,
          earned: true,
          earned_at: row.earned_at ?? now,
          times_earned: row.times_earned + delta,
        };
      })
    : BADGE_CATALOGUE.map((def) => {
        const delta = unlockedByBadge.get(def.id) ?? 0;
        return {
          id: def.id,
          earned: delta > 0,
          earned_at: delta > 0 ? now : null,
          times_earned: delta,
        };
      });

  const existingIds = new Set((cached?.unnotified ?? []).map((ref) => ref.award_id));
  const unnotified = [
    ...(cached?.unnotified ?? []),
    ...unlocked.filter((ref) => !existingIds.has(ref.award_id)),
  ];

  await writeBadgesCache(userId, { badges, unnotified });
}
