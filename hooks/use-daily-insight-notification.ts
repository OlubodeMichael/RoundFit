import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { useHealth } from '@/context/health-context';
import { apiFetch } from '@/utils/api';
import {
  deliverRichInsightIfReady,
  reconcileInsightFallback,
} from '@/utils/daily-insight-delivery';
import { getLocalDateString } from '@/utils/date';
import {
  enableSleepBackgroundDelivery,
  subscribeToSleepUpdates,
} from '@/utils/healthkit';

/**
 * Drives the "daily insight" notification:
 *
 *  • Background path — when last night's sleep syncs (HealthKit observer /
 *    background delivery), pushes it to the backend, fetches today's insight,
 *    and fires a rich notification with the real content (once per day). Only
 *    runs when the app is NOT in the foreground (an open app already shows the
 *    insight in-app via the existing sync listener).
 *
 *  • Fallback — a generic one-shot reminder, re-armed on every foreground/boot,
 *    so users without a wearable (or who force-quit) still get a daily nudge.
 *    It is cancelled automatically on any day the background path delivers.
 *
 * iOS-only — Android has no HealthKit sleep source here.
 */
export function useDailyInsightNotification(): void {
  const { status, user } = useAuth();
  const { syncFromDevice } = useHealth();
  const runningRef = useRef(false);

  // Sync last night's sleep, fetch the insight, and deliver if ready.
  const evaluate = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      // Push last night's sleep so the backend insight is no longer pending.
      await syncFromDevice(true);

      const today = getLocalDateString();
      const { ok, body } = await apiFetch(`/insights/today?date=${today}`);
      if (!ok) return;

      const row = body.insight as Record<string, unknown> | undefined;
      const insight = row
        ? {
            id:      String(row.id ?? ''),
            title:   String(row.title ?? ''),
            message: String(row.message ?? ''),
          }
        : null;
      const pending = body.pending === true;

      // Don't fire a banner at a user who is actively looking at the app — the
      // in-app insight already refreshed via syncFromDevice's sync listener.
      if (AppState.currentState !== 'active') {
        await deliverRichInsightIfReady({ insight, pending });
      }
    } catch {
      // non-fatal — the fallback still covers the day
    } finally {
      runningRef.current = false;
    }
  }, [status, user, syncFromDevice]);

  // Reconcile the fallback schedule on boot + every foreground.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;

    void reconcileInsightFallback();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void reconcileInsightFallback();
    });
    return () => sub.remove();
  }, [status, user]);

  // Sleep observer + background delivery.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;

    void enableSleepBackgroundDelivery().catch(() => {});

    const subscription = subscribeToSleepUpdates(() => {
      void evaluate();
    });

    return () => subscription?.remove();
  }, [status, user, evaluate]);
}
