import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import {
  cancelMealReminders,
  cancelReminder,
  getPermissionStatus,
  openNotificationSettings,
  requestPermissions,
  scheduleMealReminders,
  scheduleReminder,
  setupNotificationChannel,
  type PermissionStatus,
} from '@/utils/notifications';

// ── Storage keys ───────────────────────────────────────────────────────────

const ENABLED_KEY = '@roundfit/notification_enabled_v1';
const TIMES_KEY   = '@roundfit/notification_times_v1';

const DEFAULT_TIMES: Record<string, TimeVal> = {
  morning: { hour: 7,  minute: 0,  period: 'AM' },
  workout: { hour: 5,  minute: 0,  period: 'PM' },
  sleep:   { hour: 10, minute: 0,  period: 'PM' },
  summary: { hour: 8,  minute: 0,  period: 'PM' },
  water:   { hour: 9,  minute: 0,  period: 'AM' },
};

const DEFAULT_MEAL_TIMES: TimeVal[] = [{ hour: 12, minute: 30, period: 'PM' }];

// ── Types ──────────────────────────────────────────────────────────────────

interface TimeVal {
  hour:   number;
  minute: number;
  period: 'AM' | 'PM';
}

interface UseNotificationsReturn {
  enabled:          Record<string, boolean>;
  permissionStatus: PermissionStatus;
  hydrated:         boolean;
  toggle:           (id: string) => Promise<boolean>;
  syncReminder:     (id: string, time: TimeVal) => Promise<void>;
  syncMealReminders:(mealTimes: TimeVal[]) => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useNotifications(
  reminderIds: string[],
): UseNotificationsReturn {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(reminderIds.map((id) => [id, false])),
  );
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [hydrated, setHydrated] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // ── Hydrate from storage + setup channel ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await setupNotificationChannel();

      const [storedRaw, status] = await Promise.all([
        AsyncStorage.getItem(ENABLED_KEY),
        getPermissionStatus(),
      ]);

      if (cancelled) return;
      setPermissionStatus(status);

      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw) as Record<string, boolean>;
          const merged = Object.fromEntries(
            reminderIds.map((id) => [id, parsed[id] === true]),
          );
          setEnabled(merged);
        } catch { /* corrupt storage — use defaults */ }
      }

      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist enabled state on change ─────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ENABLED_KEY, JSON.stringify(enabled)).catch(() => {});
  }, [hydrated, enabled]);

  // ── Re-check permissions when app foregrounds ───────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (next === 'active') {
        const status = await getPermissionStatus();
        setPermissionStatus(status);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Ensure permissions (prompt or alert) ────────────────────────────────
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    let status = await getPermissionStatus();

    if (status === 'granted') return true;

    if (status === 'undetermined') {
      status = await requestPermissions();
      setPermissionStatus(status);
      return status === 'granted';
    }

    Alert.alert(
      'Notifications Disabled',
      'Enable notifications in your device settings to receive reminders.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: openNotificationSettings },
      ],
    );
    return false;
  }, []);

  // ── Toggle a reminder on/off ────────────────────────────────────────────
  const toggle = useCallback(async (id: string): Promise<boolean> => {
    const wasOn = enabledRef.current[id];

    if (!wasOn) {
      const granted = await ensurePermission();
      if (!granted) return false;
    }

    setEnabled((prev) => {
      const next = { ...prev, [id]: !wasOn };
      enabledRef.current = next;
      return next;
    });

    if (wasOn) {
      if (id === 'meal') {
        await cancelMealReminders();
      } else {
        await cancelReminder(id);
      }
    }

    return true;
  }, [ensurePermission]);

  // ── Sync a single reminder's schedule (call after time change) ──────────
  const syncReminder = useCallback(async (id: string, time: TimeVal) => {
    if (!enabledRef.current[id]) return;
    await scheduleReminder(id, time.hour, time.minute, time.period);
  }, []);

  // ── Re-schedule enabled reminders after hydrate (e.g. water log screen) ──
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    (async () => {
      const hasEnabled = reminderIds.some((id) => enabledRef.current[id]);
      if (!hasEnabled) return;

      let times = { ...DEFAULT_TIMES };
      let mealTimes = [...DEFAULT_MEAL_TIMES];

      try {
        const raw = await AsyncStorage.getItem(TIMES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            times?: Record<string, TimeVal>;
            mealTimes?: TimeVal[];
          };
          if (parsed.times) {
            times = { ...times, ...parsed.times };
          }
          if (Array.isArray(parsed.mealTimes) && parsed.mealTimes.length > 0) {
            mealTimes = parsed.mealTimes;
          }
        }
      } catch { /* use defaults */ }

      if (cancelled) return;

      for (const id of reminderIds) {
        if (!enabledRef.current[id]) continue;
        if (id === 'meal') {
          await scheduleMealReminders(mealTimes);
        } else {
          const t = times[id] ?? DEFAULT_TIMES[id];
          if (t) await scheduleReminder(id, t.hour, t.minute, t.period);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [hydrated, reminderIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync all meal reminders (call after any meal time change) ───────────
  const syncMealReminders = useCallback(async (mealTimes: TimeVal[]) => {
    if (!enabledRef.current.meal) return;
    await scheduleMealReminders(mealTimes);
  }, []);

  return {
    enabled,
    permissionStatus,
    hydrated,
    toggle,
    syncReminder,
    syncMealReminders,
  };
}
