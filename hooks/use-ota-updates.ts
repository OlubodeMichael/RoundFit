import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

import { posthog } from '@/lib/posthog';

/**
 * How long the app must sit in the background before a downloaded update is
 * allowed to reload it. Reloading mid-session throws away in-flight screen
 * state, so we only do it when returning looks like a cold start to the user.
 */
const RELOAD_AFTER_BACKGROUND_MS = 10 * 60 * 1000;

/** Don't hammer the update server when the app is bounced repeatedly. */
const MIN_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Over-the-air updates (EAS Update).
 *
 * The native config already checks on every cold launch (`EXUpdatesCheckOnLaunch:
 * ALWAYS`, `LaunchWaitMs: 0`), which downloads in the background and applies on
 * the *next* cold start — two launches for a hotfix to land. This hook closes
 * that gap: when the app comes back to the foreground after a long enough
 * background stretch, it fetches any pending update and reloads immediately.
 *
 * Inert in Expo Go and dev clients (`Updates.isEnabled === false`).
 */
export function useOtaUpdates() {
  const lastCheckedAt = useRef(0);
  const backgroundedAt = useRef<number | null>(null);
  const reloading = useRef(false);

  const syncUpdates = useCallback(async (allowReload: boolean) => {
    if (!Updates.isEnabled || __DEV__) return;
    if (reloading.current) return;

    const now = Date.now();
    if (now - lastCheckedAt.current < MIN_CHECK_INTERVAL_MS) return;
    lastCheckedAt.current = now;

    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;

      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) return;

      posthog.capture('ota_update_downloaded', {
        channel: Updates.channel ?? null,
        runtime_version: Updates.runtimeVersion ?? null,
        from_update_id: Updates.updateId ?? null,
        applied_immediately: allowReload,
      });

      // Not safe to interrupt right now — the native launch check will apply it
      // on the next cold start.
      if (!allowReload) return;

      reloading.current = true;
      await posthog.flush().catch(() => {});
      await Updates.reloadAsync();
    } catch (error) {
      // Offline, server hiccup, or a mismatched runtime version. The embedded
      // bundle keeps running; nothing to surface to the user.
      reloading.current = false;
      if (__DEV__) console.warn('[ota] update check failed', error);
    }
  }, []);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;

    // Cold start: download only. The bundle we're running is already launched,
    // so reloading here would double the perceived startup time.
    void syncUpdates(false);

    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        const awayFor = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        void syncUpdates(awayFor >= RELOAD_AFTER_BACKGROUND_MS);
        return;
      }
      if (next === 'background' && backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [syncUpdates]);
}
