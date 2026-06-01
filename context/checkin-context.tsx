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
} from '@/utils/resource-cache';

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;

// Earliest local hour the check-in modal is allowed to appear. Anything before
// this is treated as "still night" so the user doesn't get prompted the moment
// the local date rolls over at midnight.
const MORNING_HOUR = 5;

// How long to wait before re-prompting after the user taps Skip. The skip
// reaches the server (so RIS / insights still get a fallback) but we re-open
// the modal once so it doesn't feel like a one-shot opt-out for the day.
const SKIP_SNOOZE_MS = 4 * 60 * 60 * 1000; // 4 hours

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

  /** True if today's check-in has been completed or skipped. */
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
  return {
    id:              String(row.id ?? ''),
    user_id:         String(row.user_id ?? ''),
    date:            String(row.date ?? ''),
    sleep_quality:   typeof row.sleep_quality === 'number' ? row.sleep_quality : null,
    energy_level:    (row.energy_level as EnergyLevel) ?? 'medium',
    planned_workout: row.planned_workout === true,
    completed:       row.completed === true,
    skipped:         row.skipped === true,
    completed_at:    typeof row.completed_at === 'string' ? row.completed_at : null,
  };
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
  const appStateRef      = useRef(AppState.currentState);
  const lastFetchDateRef = useRef('');
  const doneThisSession  = useRef(false);
  // Timer that flips `shouldShowCheckin` on at the morning hour if we
  // suppressed the modal because it was still night.
  const morningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer that re-opens the check-in some hours after the user tapped Skip.
  const skipSnoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while we're in the "skipped, will re-prompt later" window — keeps
  // applyCheckinToday from hiding the modal because the server says skipped.
  const skipSnoozeActiveRef = useRef(false);

  const clearMorningTimer = useCallback(() => {
    if (morningTimerRef.current) {
      clearTimeout(morningTimerRef.current);
      morningTimerRef.current = null;
    }
  }, []);

  const clearSkipSnoozeTimer = useCallback(() => {
    if (skipSnoozeTimerRef.current) {
      clearTimeout(skipSnoozeTimerRef.current);
      skipSnoozeTimerRef.current = null;
    }
    skipSnoozeActiveRef.current = false;
  }, []);

  const scheduleSkipSnooze = useCallback(() => {
    clearSkipSnoozeTimer();
    skipSnoozeActiveRef.current = true;
    skipSnoozeTimerRef.current = setTimeout(() => {
      skipSnoozeTimerRef.current = null;
      // Respect the morning gate — if the snooze rolls past midnight into
      // pre-morning hours, defer to the morning timer instead.
      if (isMorningOrLater()) {
        setShouldShowCheckin(true);
      }
    }, SKIP_SNOOZE_MS);
  }, [clearSkipSnoozeTimer]);

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
  useEffect(() => clearSkipSnoozeTimer, [clearSkipSnoozeTimer]);

  const hasCheckedInToday       = useMemo(() => today?.completed === true, [today]);
  const shouldShowWorkoutPrompt = useMemo(() => appStatus?.should_show_workout_prompt ?? false, [appStatus]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  // Fetches today's check-in from the DB and derives shouldShowCheckin from
  // the server response — the single source of truth. Local storage is a
  // secondary cache so the modal doesn't flash before the network resolves.
  const applyCheckinToday = useCallback(async (checkin: CheckIn | null) => {
    setToday(checkin);
    const showNow = isMorningOrLater();

    if (!checkin) {
      const localDone = await storageHasCheckedInToday();
      if (localDone) {
        clearMorningTimer();
        setShouldShowCheckin(false);
        return;
      }
      setShouldShowCheckin(showNow);
      if (!showNow) scheduleMorningShow();
      return;
    }

    // During the post-skip snooze window we deliberately ignore `skipped`
    // so the modal can re-open even if applyCheckinToday re-runs (e.g. on
    // foreground resume).
    const alreadyDone =
      checkin.completed ||
      (checkin.skipped && !skipSnoozeActiveRef.current);

    if (alreadyDone) {
      doneThisSession.current = true;
      clearMorningTimer();
      clearSkipSnoozeTimer();
      setShouldShowCheckin(false);
      void markCheckedInToday();
    } else {
      setShouldShowCheckin(showNow);
      if (!showNow) scheduleMorningShow();
    }
  }, [clearMorningTimer, clearSkipSnoozeTimer, scheduleMorningShow]);

  const fetchToday = useCallback(async (force = false) => {
    if (doneThisSession.current) {
      setShouldShowCheckin(false);
      return;
    }

    if (!user?.id) return;

    const today = getLocalDateString();
    const key   = buildResourceKey('checkin-today', user.id, today);
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
      { force },
    );

    await applyCheckinToday(cached);
  }, [user?.id, applyCheckinToday]);

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
      doneThisSession.current = false;
      void clearCheckinStorage();
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const today = getLocalDateString();
      const key   = buildResourceKey('checkin-today', user.id, today);
      const cached = await getResourceCached<CheckIn | null>(key);
      if (cached && !cancelled) {
        await applyCheckinToday(cached.data);
        setIsLoading(false);
      } else if (!cancelled) {
        setIsLoading(true);
      }

      try {
        lastFetchDateRef.current = today;
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

    const dateStr = todayDateString();
    if (checkin.date === dateStr) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    doneThisSession.current = true;
    clearMorningTimer();
    clearSkipSnoozeTimer();
    setShouldShowCheckin(false);
    void markCheckedInToday();
    if (user?.id) {
      await invalidateResourceCache(
        buildResourceKey('checkin-today', user.id, dateStr),
      );
      void notifyTodayDataChanged(user.id, 'checkin');
    }

    return { checkin, insight };
  }, [user?.id, clearMorningTimer, clearSkipSnoozeTimer]);

  // ── Skip check-in ────────────────────────────────────────────────────────
  const skipCheckin = useCallback(async (date: string): Promise<CheckIn> => {
    const { ok, body } = await apiFetch('/checkin/skip', {
      method: 'POST',
      body:   JSON.stringify({ date }),
    });
    if (!ok || !body.checkin) {
      throw new Error((body.error as string) || 'Failed to skip check-in');
    }

    const checkin = fromApiCheckin(body.checkin as Record<string, unknown>);
    if (checkin.date === todayDateString()) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    // Skip is treated as a "snooze, ask again later" rather than a hard
    // opt-out for the day. We hide the modal now but schedule a re-show.
    doneThisSession.current = false;
    clearMorningTimer();
    setShouldShowCheckin(false);
    scheduleSkipSnooze();
    if (user?.id) {
      await invalidateResourceCache(
        buildResourceKey('checkin-today', user.id, getLocalDateString()),
      );
      void notifyTodayDataChanged(user.id, 'checkin');
    }

    return checkin;
  }, [user?.id, clearMorningTimer, scheduleSkipSnooze]);

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
