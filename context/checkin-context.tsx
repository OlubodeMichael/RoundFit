import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { getLocalDateString } from '@/utils/date';
import { apiFetch } from '@/utils/api';
import { notifyTodayDataChanged } from '@/utils/today-sync';
import {
  hasCheckedInToday as storageHasCheckedInToday,
  markCheckedInToday,
  clearCheckinStorage,
} from '@/utils/checkin-storage';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
  setResourceCached,
} from '@/utils/resource-cache';

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;

// Earliest local hour the check-in modal is allowed to appear. Anything before
// this is treated as "still night" so the user doesn't get prompted the moment
// the local date rolls over at midnight.
const MORNING_HOUR = 5;

function msUntilMorning(): number {
  const now    = new Date();
  const target = new Date(now);
  target.setHours(MORNING_HOUR, 0, 0, 0);
  return Math.max(0, target.getTime() - now.getTime());
}

function isMorningOrLater(): boolean {
  return msUntilMorning() === 0;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface CheckIn {
  id:              string;
  user_id:         string;
  date:            string;
  sleep_quality:   number | null;
  energy_level:    EnergyLevel;
  planned_workout: boolean;
  completed:       boolean;
  skipped:         boolean;
  completed_at:    string | null;
}

export interface MorningCheckinInput {
  date:              string;
  sleep_quality:     number;
  energy_level:      EnergyLevel;
  planned_workout?:  boolean;
}

export interface CheckinInsight {
  id:           string;
  message:      string;
  type:         string;
  triggered_by: string;
  date:         string;
}

export interface CheckinStatus {
  should_show_checkin:       boolean;
  should_show_workout_prompt: boolean;
  checkin_completed:         boolean;
  workout_logged:            boolean;
  reason:                    string | null;
}

export interface CheckinStats {
  total_days:        number;
  completed_days:    number;
  skipped_days:      number;
  completion_rate:   number;
  avg_sleep_quality: number;
  energy_breakdown: {
    low:    number;
    medium: number;
    high:   number;
  };
}

export interface CheckinContextValue {
  /** Today's check-in, or null if not yet submitted. */
  today: CheckIn | null;

  /** Recent check-in history, newest first. */
  history: CheckIn[];

  /** Aggregate stats across the last 30 check-ins. */
  stats: CheckinStats | null;

  /**
   * App-open status response — whether to show the check-in modal or
   * workout prompt. Null until first fetch.
   */
  appStatus: CheckinStatus | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** True if today's check-in has been logged (completed or skipped). */
  hasCheckedInToday: boolean;

  /** Convenience flag — true when the check-in modal should be shown. */
  shouldShowCheckin: boolean;

  /** Convenience flag — true when the workout prompt should be shown. */
  shouldShowWorkoutPrompt: boolean;

  /**
   * Submits the morning check-in — hits POST /checkin/morning.
   * Returns the saved check-in and the auto-generated insight.
   */
  submitMorningCheckin: (
    input: MorningCheckinInput,
  ) => Promise<{ checkin: CheckIn; insight: CheckinInsight | null }>;

  /**
   * Skips today's check-in — hits POST /checkin/skip.
   * Still triggers a fallback insight server-side.
   */
  skipCheckin: (date: string) => Promise<CheckIn>;

  /** Fetches a single check-in by date — hits GET /checkin/:date. */
  fetchByDate: (date: string) => Promise<CheckIn | null>;

  /** Re-fetches the app-open status — hits GET /checkin/status. */
  refreshStatus: () => Promise<void>;

  /** Re-fetches today's check-in, history, and stats. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────


// ── Normalisation helpers ──────────────────────────────────────────────────

function todayDateString(): string {
  return getLocalDateString();
}

function fromApiCheckin(row: Record<string, unknown>): CheckIn {
  const completed = row.completed === true
    || row.status === 'completed'
    || (typeof row.completed_at === 'string' && row.completed_at.length > 0);
  const skipped = row.skipped === true || row.status === 'skipped';
  const hasMorningLog = typeof row.sleep_quality === 'number' && typeof row.energy_level === 'string';

  return {
    id:              String(row.id ?? ''),
    user_id:         String(row.user_id ?? ''),
    date:            String(row.date ?? ''),
    sleep_quality:   typeof row.sleep_quality === 'number' ? row.sleep_quality : null,
    energy_level:    (row.energy_level as EnergyLevel) ?? 'medium',
    planned_workout: row.planned_workout === true,
    completed:       completed || (hasMorningLog && !skipped),
    skipped,
    completed_at:    typeof row.completed_at === 'string' ? row.completed_at : null,
  };
}

function isCheckinLogged(checkin: CheckIn | null): boolean {
  if (!checkin) return false;
  return checkin.completed || checkin.skipped;
}

function fromApiInsight(row: Record<string, unknown>): CheckinInsight {
  return {
    id:           String(row.id ?? ''),
    message:      String(row.message ?? ''),
    type:         String(row.type ?? 'rules'),
    triggered_by: String(row.triggered_by ?? ''),
    date:         String(row.date ?? ''),
  };
}


function fromApiStats(body: Record<string, unknown>): CheckinStats {
  const eb = (body.energy_breakdown as Record<string, unknown>) ?? {};
  return {
    total_days:        typeof body.total_days        === 'number' ? body.total_days        : 0,
    completed_days:    typeof body.completed_days    === 'number' ? body.completed_days    : 0,
    skipped_days:      typeof body.skipped_days      === 'number' ? body.skipped_days      : 0,
    completion_rate:   typeof body.completion_rate   === 'number' ? body.completion_rate   : 0,
    avg_sleep_quality: typeof body.avg_sleep_quality === 'number' ? body.avg_sleep_quality : 0,
    energy_breakdown: {
      low:    typeof eb.low    === 'number' ? eb.low    : 0,
      medium: typeof eb.medium === 'number' ? eb.medium : 0,
      high:   typeof eb.high   === 'number' ? eb.high   : 0,
    },
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const CheckinContext = createContext<CheckinContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,              setToday]              = useState<CheckIn | null>(null);
  const [history,            setHistory]            = useState<CheckIn[]>([]);
  const [stats,              setStats]              = useState<CheckinStats | null>(null);
  const [appStatus,          setAppStatus]          = useState<CheckinStatus | null>(null);
  const [isLoading,          setIsLoading]          = useState(true);
  const [shouldShowCheckin,  setShouldShowCheckin]  = useState(false);
  const [localLoggedToday,   setLocalLoggedToday]   = useState(false);
  const localLoggedTodayRef  = useRef(false);
  const appStateRef      = useRef(AppState.currentState);
  const lastFetchDateRef = useRef('');
  const doneThisSession  = useRef(false);
  // Timer that flips `shouldShowCheckin` on at the morning hour if we
  // suppressed the modal because it was still night.
  const morningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMorningTimer = useCallback(() => {
    if (morningTimerRef.current) {
      clearTimeout(morningTimerRef.current);
      morningTimerRef.current = null;
    }
  }, []);

  const scheduleMorningShow = useCallback(() => {
    clearMorningTimer();
    const delay = msUntilMorning();
    if (delay <= 0) return;
    morningTimerRef.current = setTimeout(() => {
      morningTimerRef.current = null;
      // Re-check at fire time — user may have completed/skipped meanwhile.
      if (doneThisSession.current) return;
      setShouldShowCheckin(true);
    }, delay);
  }, [clearMorningTimer]);

  useEffect(() => clearMorningTimer, [clearMorningTimer]);

  const setLoggedToday = useCallback((logged: boolean) => {
    localLoggedTodayRef.current = logged;
    setLocalLoggedToday(logged);
  }, []);

  const hasCheckedInToday = useMemo(
    () => localLoggedToday || isCheckinLogged(today),
    [localLoggedToday, today],
  );
  const shouldShowWorkoutPrompt = useMemo(() => appStatus?.should_show_workout_prompt ?? false, [appStatus]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  // Fetches today's check-in from the DB and derives shouldShowCheckin from
  // the server response — the single source of truth. Local storage is a
  // secondary cache so the modal doesn't flash before the network resolves.
  const applyCheckinToday = useCallback(async (checkin: CheckIn | null, userId: string) => {
    if (checkin && isCheckinLogged(checkin)) {
      setToday(checkin);
      doneThisSession.current = true;
      clearMorningTimer();
      setShouldShowCheckin(false);
      setLoggedToday(true);
      await markCheckedInToday(userId);
      return;
    }

    const localDone = await storageHasCheckedInToday(userId);
    if (localDone) {
      setLoggedToday(true);
      doneThisSession.current = true;
      clearMorningTimer();
      setShouldShowCheckin(false);
      if (checkin) setToday(checkin);
      return;
    }

    setToday(checkin);
    const showNow = isMorningOrLater();
    setShouldShowCheckin(showNow);
    if (!showNow) scheduleMorningShow();
  }, [clearMorningTimer, scheduleMorningShow, setLoggedToday]);

  const fetchToday = useCallback(async (force = false) => {
    if (!user?.id) return;

    if (doneThisSession.current || localLoggedTodayRef.current) {
      setShouldShowCheckin(false);
      if (!force) return;
    }

    const todayDate = getLocalDateString();
    const key       = buildResourceKey('checkin-today', user.id, todayDate);
    const localDone = await storageHasCheckedInToday(user.id);
    if (localDone) {
      setLoggedToday(true);
      doneThisSession.current = true;
      setShouldShowCheckin(false);
    }

    const cached = await fetchWithResourceCache<CheckIn | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch('/checkin/today');
        if (ok && body.checkin) {
          return fromApiCheckin(body.checkin as Record<string, unknown>);
        }
        return null;
      },
      { force: force || localDone },
    );

    await applyCheckinToday(cached, user.id);
  }, [user?.id, applyCheckinToday, setLoggedToday]);

  const fetchHistory = useCallback(async () => {
    const { ok, body } = await apiFetch(`/checkin/history?limit=${DEFAULT_LIMIT}`);
    if (!ok) return;
    const rows = Array.isArray(body.checkins) ? body.checkins as Record<string, unknown>[] : [];
    setHistory(rows.map(fromApiCheckin));
  }, []);

  const fetchStats = useCallback(async () => {
    const { ok, body } = await apiFetch('/checkin/stats');
    if (ok) setStats(fromApiStats(body));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (!hasActiveUserSession(status, user)) {
      setToday(null);
      setHistory([]);
      setStats(null);
      setAppStatus(null);
      setShouldShowCheckin(false);
      setLoggedToday(false);
      doneThisSession.current = false;
      void clearCheckinStorage(user?.id);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const todayDate = getLocalDateString();
      const key       = buildResourceKey('checkin-today', user.id, todayDate);

      const localDone = await storageHasCheckedInToday(user.id);
      if (localDone && !cancelled) {
        setLoggedToday(true);
        doneThisSession.current = true;
        setShouldShowCheckin(false);
      }

      const cached = await getResourceCached<CheckIn | null>(key);
      if (cached && !cancelled) {
        await applyCheckinToday(cached.data, user.id);
        setIsLoading(false);
      } else if (!cancelled) {
        setIsLoading(true);
      }

      try {
        lastFetchDateRef.current = todayDate;
        await fetchToday(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, fetchHistory, fetchStats, applyCheckinToday]);

  // ── Reset to today when app returns to foreground on a new day ─────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        const todayDate = getLocalDateString();
        if (lastFetchDateRef.current !== todayDate) {
          lastFetchDateRef.current = todayDate;
          doneThisSession.current = false;
          setLoggedToday(false);
          setToday(null);
          void fetchToday();
        }
      }
    });
    return () => sub.remove();
  }, [fetchToday]);

  // ── Submit morning check-in ──────────────────────────────────────────────
  const submitMorningCheckin = useCallback(async (
    input: MorningCheckinInput,
  ): Promise<{ checkin: CheckIn; insight: CheckinInsight | null }> => {
    const dateStr = todayDateString();
    if (input.date === dateStr && (localLoggedToday || isCheckinLogged(today))) {
      throw new Error('Check-in already logged for today');
    }

    const { ok, body } = await apiFetch('/checkin/morning', {
      method: 'POST',
      body:   JSON.stringify({
        date:             input.date,
        sleep_quality:    input.sleep_quality,
        energy_level:     input.energy_level,
        planned_workout:  input.planned_workout ?? false,
      }),
    });
    if (!ok || !body.checkin) {
      throw new Error((body.error as string) || 'Failed to submit check-in');
    }

    const checkin = fromApiCheckin(body.checkin as Record<string, unknown>);
    const insight = body.insight
      ? fromApiInsight(body.insight as Record<string, unknown>)
      : null;

    if (checkin.date === dateStr) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    doneThisSession.current = true;
    clearMorningTimer();
    setShouldShowCheckin(false);
    setLoggedToday(true);
    if (user?.id) {
      await markCheckedInToday(user.id);
      await setResourceCached(
        buildResourceKey('checkin-today', user.id, dateStr),
        checkin,
        TTL_COLD_START_MS,
      );
      void notifyTodayDataChanged(user.id, 'checkin');
    }

    return { checkin, insight };
  }, [user?.id, today, localLoggedToday, clearMorningTimer, setLoggedToday]);

  // ── Skip check-in ────────────────────────────────────────────────────────
  const skipCheckin = useCallback(async (date: string): Promise<CheckIn> => {
    const todayStr = todayDateString();
    if (date === todayStr && (localLoggedToday || isCheckinLogged(today))) {
      throw new Error('Check-in already logged for today');
    }

    const { ok, body } = await apiFetch('/checkin/skip', {
      method: 'POST',
      body:   JSON.stringify({ date }),
    });
    if (!ok || !body.checkin) {
      throw new Error((body.error as string) || 'Failed to skip check-in');
    }

    const checkin = fromApiCheckin(body.checkin as Record<string, unknown>);
    if (checkin.date === todayStr) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    doneThisSession.current = true;
    clearMorningTimer();
    setShouldShowCheckin(false);
    setLoggedToday(true);
    if (user?.id) {
      await markCheckedInToday(user.id);
      await setResourceCached(
        buildResourceKey('checkin-today', user.id, todayStr),
        checkin,
        TTL_COLD_START_MS,
      );
      void notifyTodayDataChanged(user.id, 'checkin');
    }

    return checkin;
  }, [user?.id, today, localLoggedToday, clearMorningTimer, setLoggedToday]);

  // ── Fetch by date ────────────────────────────────────────────────────────
  const fetchByDate = useCallback(async (date: string): Promise<CheckIn | null> => {
    const { ok, body } = await apiFetch(`/checkin/${date}`);
    if (!ok || !body.checkin) return null;
    return fromApiCheckin(body.checkin as Record<string, unknown>);
  }, []);

  // ── Refresh status ───────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    await fetchToday(true);
  }, [fetchToday]);

  // ── Full refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (user?.id) {
      await invalidateResourceCache(
        buildResourceKey('checkin-today', user.id, getLocalDateString()),
      );
    }
    await Promise.all([fetchToday(true), fetchHistory(), fetchStats()]);
  }, [fetchToday, fetchHistory, fetchStats, user?.id]);

  return (
    <CheckinContext.Provider value={{
      today, history, stats, appStatus, isLoading,
      hasCheckedInToday, shouldShowCheckin, shouldShowWorkoutPrompt,
      submitMorningCheckin, skipCheckin, fetchByDate, refreshStatus, refresh,
    }}>
      {children}
    </CheckinContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCheckin(): CheckinContextValue {
  const ctx = useContext(CheckinContext);
  if (!ctx) throw new Error('useCheckin must be used inside <CheckinProvider>');
  return ctx;
}
