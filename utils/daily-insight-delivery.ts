import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLocalDateString } from '@/utils/date';
import {
  cancelInsightFallback,
  notifyDailyInsight,
  scheduleInsightFallbackOneShot,
} from '@/utils/notifications';

// ── Storage keys ─────────────────────────────────────────────────────────────

const CONFIG_KEY      = '@roundfit/daily_insight_notification_v1';
const NOTIFIED_PREFIX = '@roundfit/insight_notified:';

// ── Config ───────────────────────────────────────────────────────────────────

export interface DailyInsightConfig {
  enabled: boolean;
  /** 24-hour fallback time. */
  hour:    number;
  minute:  number;
}

export const DEFAULT_DAILY_INSIGHT_CONFIG: DailyInsightConfig = {
  enabled: false,
  hour:    9,
  minute:  0,
};

export async function getDailyInsightConfig(): Promise<DailyInsightConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_DAILY_INSIGHT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DailyInsightConfig>;
    return {
      enabled: parsed.enabled === true,
      hour:    typeof parsed.hour   === 'number' ? parsed.hour   : DEFAULT_DAILY_INSIGHT_CONFIG.hour,
      minute:  typeof parsed.minute === 'number' ? parsed.minute : DEFAULT_DAILY_INSIGHT_CONFIG.minute,
    };
  } catch {
    return DEFAULT_DAILY_INSIGHT_CONFIG;
  }
}

/** Persists config and immediately re-arms (or cancels) the fallback. */
export async function setDailyInsightConfig(config: DailyInsightConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  await reconcileInsightFallback(config);
}

// ── Per-day de-dup flag ──────────────────────────────────────────────────────

async function wasNotifiedToday(date = getLocalDateString()): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NOTIFIED_PREFIX + date)) === '1';
  } catch {
    return false;
  }
}

async function markNotifiedToday(date = getLocalDateString()): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFIED_PREFIX + date, '1');
  } catch {
    // non-fatal
  }
}

/** Drops notified flags for past days so they don't accumulate forever. */
async function pruneNotifiedFlags(): Promise<void> {
  try {
    const today = getLocalDateString();
    const keys  = await AsyncStorage.getAllKeys();
    const stale = keys.filter(
      (k) => k.startsWith(NOTIFIED_PREFIX) && k.slice(NOTIFIED_PREFIX.length) < today,
    );
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {
    // non-fatal
  }
}

// ── Fallback scheduling ──────────────────────────────────────────────────────

/**
 * Next fire Date for the configured time — today if it hasn't passed and we
 * haven't already notified, otherwise tomorrow.
 */
function nextFallbackDate(
  config: DailyInsightConfig,
  notifiedToday: boolean,
  now = new Date(),
): Date {
  const fire = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    config.hour, config.minute, 0, 0,
  );
  if (notifiedToday || fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1);
  }
  return fire;
}

/**
 * Re-arms the one-shot generic fallback for the correct next slot, or cancels it
 * when disabled. Call on app foreground / boot and after a rich delivery.
 */
export async function reconcileInsightFallback(config?: DailyInsightConfig): Promise<void> {
  void pruneNotifiedFlags();
  const cfg = config ?? (await getDailyInsightConfig());
  if (!cfg.enabled) {
    await cancelInsightFallback();
    return;
  }
  const notified = await wasNotifiedToday();
  await scheduleInsightFallbackOneShot(nextFallbackDate(cfg, notified));
}

// ── Rich delivery (background path) ───────────────────────────────────────────

export interface DeliverArgs {
  insight: { id?: string; title: string; message: string } | null;
  pending: boolean;
}

/**
 * Fires the rich insight notification when fresh data has produced a ready
 * insight — at most once per local day, and only *before* today's generic
 * fallback time (so the two paths can never double-notify). On success it marks
 * the day and re-arms the fallback for tomorrow, cancelling today's generic one.
 *
 * Returns true when a rich notification was fired.
 */
export async function deliverRichInsightIfReady({ insight, pending }: DeliverArgs): Promise<boolean> {
  const cfg = await getDailyInsightConfig();
  if (!cfg.enabled) return false;
  if (pending || !insight) return false;
  if (await wasNotifiedToday()) return false;

  // Only pre-empt the generic fallback — never fire after it would have today.
  const now      = new Date();
  const todayFire = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    cfg.hour, cfg.minute, 0, 0,
  );
  if (now.getTime() >= todayFire.getTime()) return false;

  await notifyDailyInsight({
    title:     insight.title,
    message:   insight.message,
    insightId: insight.id,
  });
  await markNotifiedToday();
  await reconcileInsightFallback(cfg); // arms tomorrow → cancels today's generic
  return true;
}
