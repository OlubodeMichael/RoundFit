import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import { registerTodayDataSyncListener } from '@/utils/today-sync';
import { getLocalDateString } from '@/utils/date';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
} from '@/utils/resource-cache';

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export type InsightType = 'rules' | 'claude';

export interface Insight {
  id:        string;
  title:     string;
  message:   string;
  type:      InsightType;
  date:      string;
  dismissed: boolean;
}

export interface InsightsContextValue {
  /** Today's rule-based insight. */
  todayInsight: Insight | null;

  /** Latest Claude insight (premium). Null if not yet fetched or unavailable. */
  claudeInsight: Insight | null;

  /** Recent insight history, newest first. */
  history: Insight[];

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** True when the daily Claude insight limit (3) has been reached. */
  claudeLimitReached: boolean;

  /** True when the report is waiting for yesterday's sleep data to sync from HealthKit. */
  pendingSleepSync: boolean;

  /**
   * Saves manually entered sleep hours for a given date into health_data,
   * then refreshes the insight so the report generates immediately.
   */
  submitManualSleep: (date: string, sleepHours: number) => Promise<void>;

  /**
   * Fetches a new Claude insight — hits GET /insights/claude.
   * Sets claudeLimitReached if the server returns 429.
   */
  fetchClaudeInsight: () => Promise<Insight | null>;

  /** Dismisses an insight — hits DELETE /insights/:id. Optimistic. */
  dismissInsight: (id: string) => Promise<void>;

  /** Re-fetches today's insight and history. */
  refresh: () => Promise<void>;
}


// ── Normalisation helpers ──────────────────────────────────────────────────

function fromApiInsight(row: Record<string, unknown>): Insight {
  return {
    id:        String(row.id ?? ''),
    title:     String(row.title ?? ''),
    message:   String(row.message ?? ''),
    type:      (row.type as InsightType) ?? 'rules',
    date:      String(row.date ?? ''),
    dismissed: row.dismissed === true,
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const InsightsContext = createContext<InsightsContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function InsightsProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [todayInsight,     setTodayInsight]     = useState<Insight | null>(null);
  const [claudeInsight,    setClaudeInsight]    = useState<Insight | null>(null);
  const [history,          setHistory]          = useState<Insight[]>([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [claudeLimitReached, setClaudeLimitReached] = useState(false);
  const [pendingSleepSync, setPendingSleepSync] = useState(false);

  const applyTodayPayload = useCallback((payload: {
    insight: Insight | null;
    pendingSleepSync: boolean;
  }) => {
    setTodayInsight(payload.insight);
    setPendingSleepSync(payload.pendingSleepSync);
  }, []);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchToday = useCallback(async (force = false) => {
    if (!user?.id) return;

    const today = getLocalDateString();
    const key   = buildResourceKey('insights-today', user.id, today);
    const payload = await fetchWithResourceCache<{
      insight: Insight | null;
      pendingSleepSync: boolean;
    } | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch(`/insights/today?date=${today}`);
        if (!ok) return null;
        if (body.insight) {
          return {
            insight: fromApiInsight(body.insight as Record<string, unknown>),
            pendingSleepSync: false,
          };
        }
        if (body.pending) {
          return { insight: null, pendingSleepSync: true };
        }
        return { insight: null, pendingSleepSync: false };
      },
      { force },
    );

    if (payload) applyTodayPayload(payload);
  }, [user?.id, applyTodayPayload]);

  const fetchHistory = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = getLocalDateString();
    const key   = buildResourceKey('insights-history', user.id, today);
    const rows = await fetchWithResourceCache<Insight[]>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch(`/insights/history?limit=${DEFAULT_LIMIT}&date=${today}`);
        if (!ok) return null;
        const items = Array.isArray(body.insights) ? body.insights as Record<string, unknown>[] : [];
        return items.map(fromApiInsight).filter(i => i.date <= today);
      },
      { force },
    );
    if (rows) setHistory(rows);
  }, [user?.id]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setTodayInsight(null);
      setClaudeInsight(null);
      setHistory([]);
      setClaudeLimitReached(false);
      setPendingSleepSync(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const today = getLocalDateString();
      const key   = buildResourceKey('insights-today', user!.id, today);
      const cached = await getResourceCached<{
        insight: Insight | null;
        pendingSleepSync: boolean;
      }>(key);
      if (cached && !cancelled) {
        applyTodayPayload(cached.data);
        setIsLoading(false);
      } else if (!cancelled) {
        setIsLoading(true);
        setTodayInsight(null);
        setClaudeInsight(null);
        setHistory([]);
        setClaudeLimitReached(false);
        setPendingSleepSync(false);
      }

      try {
        await Promise.all([fetchToday(false), fetchHistory(false)]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, fetchHistory, applyTodayPayload]);

  useEffect(() => {
    return registerTodayDataSyncListener(async () => {
      if (!user?.id) return;
      await invalidateResourceCache(
        buildResourceKey('insights-today', user.id, getLocalDateString()),
      );
      await fetchToday(true);
    });
  }, [fetchToday, user?.id]);

  // ── Fetch Claude insight ─────────────────────────────────────────────────
  const fetchClaudeInsight = useCallback(async (): Promise<Insight | null> => {
    const { ok, status: httpStatus, body } = await apiFetch('/insights/ai');

    if (httpStatus === 429) {
      setClaudeLimitReached(true);
      return null;
    }

    if (!ok || !body.insight) return null;

    const insight = fromApiInsight(body.insight as Record<string, unknown>);
    setClaudeInsight(insight);
    setHistory((prev) => {
      const without = prev.filter((i) => i.id !== insight.id);
      return [insight, ...without];
    });
    return insight;
  }, []);

  // ── Dismiss insight ──────────────────────────────────────────────────────
  const dismissInsight = useCallback(async (id: string) => {
    const snapshotToday   = todayInsight;
    const snapshotClaude  = claudeInsight;
    const snapshotHistory = history;

    // Optimistic: mark dismissed in all state slices
    const markDismissed = (i: Insight) => i.id === id ? { ...i, dismissed: true } : i;
    if (todayInsight?.id  === id) setTodayInsight((prev)  => prev  ? markDismissed(prev)  : prev);
    if (claudeInsight?.id === id) setClaudeInsight((prev) => prev  ? markDismissed(prev)  : prev);
    setHistory((prev) => prev.map(markDismissed));

    const { ok } = await apiFetch(`/insights/${id}/dismiss`, { method: 'PATCH' });
    if (!ok) {
      setTodayInsight(snapshotToday);
      setClaudeInsight(snapshotClaude);
      setHistory(snapshotHistory);
      throw new Error('Failed to dismiss insight');
    }
  }, [todayInsight, claudeInsight, history]);

  // ── Manual sleep entry ───────────────────────────────────────────────────
  const submitManualSleep = useCallback(async (date: string, sleepHours: number) => {
    const { ok } = await apiFetch('/insights/manual-sleep', {
      method: 'POST',
      body: JSON.stringify({ date, sleep_hours: sleepHours }),
    });
    if (!ok) throw new Error('Failed to save sleep hours');
    setPendingSleepSync(false);
    await Promise.all([fetchToday(true), fetchHistory(true)]);
  }, [fetchToday, fetchHistory]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(true), fetchHistory(true)]);
  }, [fetchToday, fetchHistory]);

  return (
    <InsightsContext.Provider value={{
      todayInsight, claudeInsight, history, isLoading, claudeLimitReached,
      pendingSleepSync,
      fetchClaudeInsight, dismissInsight, refresh, submitManualSleep,
    }}>
      {children}
    </InsightsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useInsights(): InsightsContextValue {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error('useInsights must be used inside <InsightsProvider>');
  return ctx;
}
