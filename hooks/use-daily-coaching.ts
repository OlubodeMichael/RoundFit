import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { useCheckin } from '@/hooks/use-checkin';
import { useCycle } from '@/hooks/use-cycle';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import { useSummary } from '@/hooks/use-summary';
import { useWater } from '@/hooks/use-water';
import { useWorkouts } from '@/hooks/use-workouts';
import { useWorkoutHistory } from '@/hooks/use-workout-history';
import { useInsights } from '@/hooks/use-insights';
import { CYCLE_ENABLED } from '@/constants/features';
import type { DailyCoachingDecision } from '@/types/daily-coaching';
import {
  assembleCoachingInput,
  type CoachingInputSources,
} from '@/utils/assemble-coaching-input';
import { assembleDailyCoachingDecision } from '@/utils/daily-coaching';
import {
  coachingCacheKey,
  coachingDecisionFingerprint,
  type DailyCoachingCache,
} from '@/utils/coaching-cache';
import {
  buildNutritionDaysFromSummaries,
} from '@/utils/coaching-nutrition-days';
import { fetchNutritionDays } from '@/utils/coaching-nutrition-days-fetch';
import { phraseCoachingViaOpenAI } from '@/utils/coaching-phrase-api';
import { coachingTitle, renderCoachingTemplate } from '@/utils/coaching-template';
import { getLocalDateString } from '@/utils/date';
import { resolveProteinTargetG } from '@/utils/nutrition';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import {
  getResourceCached,
  invalidateResourceCache,
  setResourceCached,
} from '@/utils/resource-cache';
import {
  resolveCoachingMessage,
  type CoachingMessage,
  type CoachingPhraser,
} from '@/utils/resolve-coaching-message';
import { shouldRefetchDailyCoachingAfterMutation } from '@/utils/cache-invalidation';
import { registerTodayDataSyncListener } from '@/utils/today-sync';
import { countConsecutiveHardDays } from '@/utils/workout-readiness';
import {
  generateDailyCoaching,
  isAppleLLMAvailable,
  prewarmAppleLLM,
} from '@/modules/apple-llm/src';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyCoachingGate {
  sleep_synced: boolean;
  checkin_completed: boolean;
  pending_sleep_sync: boolean;
  pillars_active: number;
}

export interface UseDailyCoachingResult {
  decision: DailyCoachingDecision | null;
  message: CoachingMessage | null;
  gate: DailyCoachingGate;
  isLoading: boolean;
  isPhrasing: boolean;
  refresh: () => Promise<void>;
}

// ── Phrasing backend (injected for tests via module export) ──────────────────

const coachingPhraser: CoachingPhraser = {
  appleAvailable: () => isAppleLLMAvailable().available,
  generateOnDevice: async (systemPrompt, userPrompt) => {
    const r = await generateDailyCoaching(systemPrompt, userPrompt);
    if (!r?.message?.trim()) return null;
    return { title: r.title, message: r.message };
  },
  phraseViaOpenAI: phraseCoachingViaOpenAI,
};

function templateMessageFor(decision: DailyCoachingDecision): CoachingMessage {
  return {
    title: coachingTitle(decision),
    message: renderCoachingTemplate(decision),
    source: 'template',
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDailyCoaching(date?: string): UseDailyCoachingResult {
  const { user } = useAuth();
  const { computed, today: recoveryToday, hrvBaseline, restingHrBaseline, display, initialized: recoveryReady } = useRecovery();
  const { today: healthToday } = useHealth();
  const { daily, weekly } = useSummary();
  const { current: cycle } = useCycle();
  const { today: checkinToday, hasCheckedInToday } = useCheckin();
  const { totalMl, goalMl } = useWater();
  const { workouts: todayWorkouts } = useWorkouts();
  const { groups: workoutHistoryGroups } = useWorkoutHistory();
  const { pendingSleepSync } = useInsights();

  const today = getLocalDateString();
  const targetDate = date ?? today;
  const isToday = targetDate === today;

  const [nutritionDays, setNutritionDays] = useState(() =>
    buildNutritionDaysFromSummaries(
      targetDate,
      weekly?.days ?? (daily ? [daily] : []),
    ),
  );
  const [message, setMessage] = useState<CoachingMessage | null>(null);
  const [isPhrasing, setIsPhrasing] = useState(false);
  const [nutritionReady, setNutritionReady] = useState(false);

  const mountedRef = useRef(true);
  const phrasingRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const workoutsWindow = useMemo(() => {
    const all = [...todayWorkouts];
    for (const g of workoutHistoryGroups) all.push(...g.workouts);
    return all;
  }, [todayWorkouts, workoutHistoryGroups]);

  const proteinTarget = useMemo(() => {
    if (!user) return 150;
    try {
      return resolveProteinTargetG(
        {
          sex: user.sex,
          age: user.age,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          activityLevel: user.activityLevel,
          goal: user.goal,
        },
        user.proteinTarget,
      );
    } catch {
      return 150;
    }
  }, [user]);

  const calorieBudget = useMemo(
    () =>
      (CYCLE_ENABLED && cycle?.adjusted_targets?.calories) ||
      daily?.calorie_budget ||
      user?.calorieBudget ||
      user?.tdee ||
      2000,
    [cycle?.adjusted_targets?.calories, daily?.calorie_budget, user?.calorieBudget, user?.tdee],
  );

  const effectiveProteinTarget = useMemo(
    () =>
      (CYCLE_ENABLED && cycle?.adjusted_targets?.protein) ||
      daily?.protein_target ||
      proteinTarget,
    [cycle?.adjusted_targets?.protein, daily?.protein_target, proteinTarget],
  );

  // Hydrate the 3-day nutrition window — weekly first, then fill gaps from cache/API.
  useEffect(() => {
    if (!user?.id) {
      setNutritionDays([]);
      setNutritionReady(false);
      return;
    }

    const seed = weekly?.days ?? (daily ? [daily] : []);
    const sync = buildNutritionDaysFromSummaries(targetDate, seed);
    setNutritionDays(sync);
    setNutritionReady(false);

    let cancelled = false;
    void (async () => {
      const enriched = await fetchNutritionDays(user.id, targetDate, seed);
      if (!cancelled) {
        setNutritionDays(enriched);
        setNutritionReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, targetDate, weekly?.days, daily]);

  const inputSources = useMemo((): CoachingInputSources | null => {
    if (!user?.id) return null;

    const todayHrv = recoveryToday?.hrv ?? healthToday?.hrv ?? null;
    const todayRestingHr = recoveryToday?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null;

    const cycleInclude = CYCLE_ENABLED && (cycle?.available ?? false) && user.sex === 'female';

    return {
      date: targetDate,
      computed: isToday ? computed : null,
      todayRestingHr,
      todayHrv,
      restingHrBaseline,
      hrvBaseline,
      respiratoryRate: null,
      respiratoryRateBaseline: null,
      consecutiveHardDays: isToday ? countConsecutiveHardDays(workoutsWindow) : 0,
      goal: user.goal,
      nutritionDays,
      nutritionTargets: {
        calorie_budget: calorieBudget,
        protein_target: effectiveProteinTarget,
      },
      cycle: {
        include: cycleInclude,
        phase: cycleInclude ? (cycle?.phase ?? null) : null,
        days_remaining: cycleInclude ? (cycle?.days_remaining ?? null) : null,
      },
      hydration: {
        active: true,
        logged_ml: isToday ? totalMl : null,
        target_ml: goalMl,
      },
      hasBaselines: hrvBaseline != null && restingHrBaseline != null,
      historyDays: isToday
        ? Math.max(display.trend7d.length, checkinToday ? 1 : 0)
        : 0,
    };
  }, [
    user,
    targetDate,
    isToday,
    computed,
    recoveryToday,
    healthToday,
    restingHrBaseline,
    hrvBaseline,
    workoutsWindow,
    nutritionDays,
    calorieBudget,
    effectiveProteinTarget,
    cycle,
    totalMl,
    goalMl,
    display.trend7d.length,
    checkinToday,
  ]);

  const decision = useMemo(() => {
    if (!inputSources) return null;
    return assembleDailyCoachingDecision(assembleCoachingInput(inputSources));
  }, [inputSources]);

  const gate = useMemo((): DailyCoachingGate => ({
    sleep_synced: !!(
      (recoveryToday?.sleep_hours && recoveryToday.sleep_hours > 0) ||
      (healthToday?.sleep_hours && healthToday.sleep_hours > 0)
    ),
    checkin_completed: hasCheckedInToday,
    pending_sleep_sync: isToday ? pendingSleepSync : false,
    pillars_active: computed?.pillars.filter((p) => p.active).length ?? 0,
  }), [
    recoveryToday?.sleep_hours,
    healthToday?.sleep_hours,
    hasCheckedInToday,
    pendingSleepSync,
    isToday,
    computed?.pillars,
  ]);

  const isLoading = !user?.id || (isToday && !recoveryReady) || !nutritionReady;

  // Template is always available synchronously — never a blank card.
  useEffect(() => {
    if (!decision) {
      setMessage(null);
      return;
    }
    setMessage(templateMessageFor(decision));
  }, [decision]);

  // Phrase via Apple FM → OpenAI, with per-fingerprint cache.
  useEffect(() => {
    if (!decision || !user?.id) return;

    const runId = ++phrasingRef.current;
    const fingerprint = coachingDecisionFingerprint(decision);
    const cacheKey = coachingCacheKey(user.id, targetDate);

    void (async () => {
      const cached = await getResourceCached<DailyCoachingCache>(cacheKey);
      if (
        cached &&
        !cached.isStale &&
        cached.data.fingerprint === fingerprint &&
        cached.data.message.message.trim()
      ) {
        if (mountedRef.current && phrasingRef.current === runId) {
          setMessage(cached.data.message);
        }
        return;
      }

      if (mountedRef.current && phrasingRef.current === runId) {
        setIsPhrasing(true);
      }

      try {
        void prewarmAppleLLM();
        const resolved = await resolveCoachingMessage(decision, coachingPhraser);
        if (!mountedRef.current || phrasingRef.current !== runId) return;

        setMessage(resolved);

        const payload: DailyCoachingCache = { fingerprint, decision, message: resolved };
        void setResourceCached(cacheKey, payload, TTL_COLD_START_MS);
      } finally {
        if (mountedRef.current && phrasingRef.current === runId) {
          setIsPhrasing(false);
        }
      }
    })();
  }, [decision, user?.id, targetDate]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    await invalidateResourceCache(coachingCacheKey(user.id, targetDate));
    if (decision) {
      setMessage(templateMessageFor(decision));
      const fingerprint = coachingDecisionFingerprint(decision);
      setIsPhrasing(true);
      try {
        const resolved = await resolveCoachingMessage(decision, coachingPhraser);
        setMessage(resolved);
        const payload: DailyCoachingCache = { fingerprint, decision, message: resolved };
        await setResourceCached(coachingCacheKey(user.id, targetDate), payload, TTL_COLD_START_MS);
      } finally {
        setIsPhrasing(false);
      }
    }
  }, [user?.id, targetDate, decision]);

  useEffect(() => {
    if (!isToday) return;
    return registerTodayDataSyncListener(({ domain }) => {
      if (shouldRefetchDailyCoachingAfterMutation(domain)) {
        void refresh();
      }
    });
  }, [isToday, refresh]);

  return {
    decision,
    message,
    gate,
    isLoading,
    isPhrasing,
    refresh,
  };
}
