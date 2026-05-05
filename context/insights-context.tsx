import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export type InsightType = 'rules' | 'claude';

export interface Insight {
  id:        string;
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

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    const { ok, body } = await apiFetch('/insights/today');
    if (ok && body.insight) setTodayInsight(fromApiInsight(body.insight as Record<string, unknown>));
  }, []);

  const fetchHistory = useCallback(async () => {
    const { ok, body } = await apiFetch(`/insights/history?limit=${DEFAULT_LIMIT}`);
    if (!ok) return;
    const rows = Array.isArray(body.insights) ? body.insights as Record<string, unknown>[] : [];
    setHistory(rows.map(fromApiInsight));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setTodayInsight(null);
      setClaudeInsight(null);
      setHistory([]);
      setClaudeLimitReached(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setTodayInsight(null);
    setClaudeInsight(null);
    setHistory([]);
    setClaudeLimitReached(false);

    (async () => {
      try {
        await Promise.all([fetchToday(), fetchHistory()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, fetchHistory]);

  // ── Fetch Claude insight ─────────────────────────────────────────────────
  const fetchClaudeInsight = useCallback(async (): Promise<Insight | null> => {
    const { ok, status: httpStatus, body } = await apiFetch('/insights/claude');

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

    const { ok } = await apiFetch(`/insights/${id}`, { method: 'DELETE' });
    if (!ok) {
      setTodayInsight(snapshotToday);
      setClaudeInsight(snapshotClaude);
      setHistory(snapshotHistory);
      throw new Error('Failed to dismiss insight');
    }
  }, [todayInsight, claudeInsight, history]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), fetchHistory()]);
  }, [fetchToday, fetchHistory]);

  return (
    <InsightsContext.Provider value={{
      todayInsight, claudeInsight, history, isLoading, claudeLimitReached,
      fetchClaudeInsight, dismissInsight, refresh,
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
