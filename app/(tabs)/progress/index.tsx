import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DistanceMetricCard,
  StepsMetricCard,
} from '@/components/home/ActivityCard';
import { MirrorPromoCard } from '@/components/progress/MirrorPromoCard';
import { ProgressCaloriesCard } from '@/components/progress/ProgressCaloriesCard';
import { ProgressConsistencyCard } from '@/components/progress/ProgressConsistencyCard';
import { ProgressHeadlineStats } from '@/components/progress/ProgressHeadlineStats';
import { ProgressWeightCard } from '@/components/progress/ProgressWeightCard';
import { usePalette } from '@/lib/log-theme';
import { ReadinessWidget } from '@/components/home/ReadinessWidget';
import { useHealth } from '@/hooks/use-health';
import { useUnits } from '@/hooks/use-units';
import { useSummary } from '@/hooks/use-summary';
import { useWeight } from '@/hooks/use-weight';
import { useProfile } from '@/hooks/use-profile';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { getWeekStart } from '@/utils/insights-aggregator';

function buildWeekDates(todayStr: string): string[] {
  // Monday-start, matching the getWeekStart() key used to fetch
  // /summary/weekly. A Sunday-start strip can never align with the
  // Monday-keyed data: its first slot is the *previous* week's Sunday
  // (always rendered as missed) and on Sundays the whole week disappears.
  const weekStart = getWeekStart(new Date(todayStr + "T12:00:00"));
  return Array.from({ length: 7 }, (_, i) =>
    addLocalCalendarDays(weekStart, i),
  );
}

const movementSectionStyles = StyleSheet.create({
  metricsRow: { flexDirection: "row", gap: 10 },
  notConnected: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
});

function StepsCard({ delay = 0 }: { delay?: number }) {
  const P = usePalette();
  const { today, isConnected } = useHealth();

  return (
    <View>
      <View style={movementSectionStyles.metricsRow}>
        <StepsMetricCard P={P} delay={delay} data={today} />
        <DistanceMetricCard P={P} delay={delay + 20} data={today} />
      </View>
      {!isConnected && (
        <Text
          style={[movementSectionStyles.notConnected, { color: P.textFaint }]}
        >
          Connect Apple Health to see live steps
        </Text>
      )}
    </View>
  );
}

export default function ProgressScreen() {
  const P = usePalette();
  const insets = useSafeAreaInsets();

  const { weekly } = useSummary();
  const { entries } = useWeight();
  const { weightUnit, toDisplayWeight } = useUnits();
  const { profile } = useProfile();
  const todayStr = getLocalDateString();

  // ── Streak: prefer cached value from profile, fall back to computed ───────
  const streak = useMemo(() => {
    if (typeof profile?.currentStreak === "number") {
      // Stale-guard: current_streak is only recomputed when food is logged,
      // so it freezes if the user stops logging. Zero it only on positive
      // evidence the run is broken: yesterday is in the week's data with
      // nothing logged, and today (so far) has nothing either.
      const yesterday = addLocalCalendarDays(todayStr, -1);
      const yRow = weekly?.days?.find((d) => d.date === yesterday);
      const tRow = weekly?.days?.find((d) => d.date === todayStr);
      const runBroken =
        yRow !== undefined &&
        yRow.calories_consumed === 0 &&
        (tRow?.calories_consumed ?? 0) === 0;
      return runBroken ? 0 : profile.currentStreak;
    }
    if (!weekly?.days?.length) return 0;
    const sorted = [...weekly.days].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    let count = 0;
    for (const d of sorted) {
      if (d.date > todayStr) continue; // ignore future rows
      // An empty *today* doesn't break the run — the day isn't over yet.
      if (d.date === todayStr && d.calories_consumed === 0) continue;
      if (d.calories_consumed > 0) count++;
      else break;
    }
    return count;
  }, [profile?.currentStreak, weekly, todayStr]);

  // ── Consistency (clamped — ProgressConsistencyCard clamps internally, but
  // the headline tile would otherwise render a bad API value verbatim) ──────
  const consistency = Math.min(
    100,
    Math.max(0, Math.round(weekly?.consistency_score ?? 0)),
  );

  // ── Goals (days that met targets, out of 7) ──────────────────────────────
  // Prefer the backend's met_targets so this tile agrees with the consistency
  // strip below it (calorie ±200 band, ≥75% of applicable slots). The fallback
  // (older cached responses) mirrors the backend's calorie band against the
  // day's OWN budget snapshot — grading past days with today's budget would
  // silently re-grade history after any budget change, and "under budget"
  // alone is goal-direction-blind (a surplus goal is MISSED by under-eating).
  const goalsHit = useMemo(() => {
    if (!weekly?.days?.length) return 0;
    const profileBudget = profile?.calorieBudget ?? profile?.tdee ?? 0;
    return weekly.days.filter((d) => {
      if (d.met_targets !== undefined) return d.met_targets;
      const goal = d.calorie_budget > 0 ? d.calorie_budget : profileBudget;
      return (
        d.calories_consumed > 0 &&
        goal > 0 &&
        Math.abs(d.calories_consumed - goal) <= 200
      );
    }).length;
  }, [weekly, profile?.calorieBudget, profile?.tdee]);

  // ── Consistency day strip — always 7 days (Sun → Sat) ───────────────────
  // A day is marked "on" only when the backend says the user actually met
  // their targets that day (calorie ±200, protein 90%+, steps target, sleep
  // target — at least 75% of applicable slots). Falls back to the old
  // "logged anything" check if the API doesn't return `met_targets` yet
  // (e.g. cached responses from an older server).
  const consistencyDays = useMemo(() => {
    const dayMap = new Map((weekly?.days ?? []).map((d) => [d.date, d]));
    return buildWeekDates(todayStr).map((date) => {
      const day = dayMap.get(date);
      const onTarget =
        day?.met_targets !== undefined
          ? day.met_targets
          : (day?.calories_consumed ?? 0) > 0;
      return {
        label: new Date(date + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
        })[0],
        on: onTarget,
        today: date === todayStr,
      };
    });
  }, [weekly, todayStr]);

  // ── Calories chart — always 7 days (Sun → Sat) ───────────────────────────
  const calsGoal =
    profile?.calorieBudget ??
    profile?.tdee ??
    weekly?.days.find((d) => d.calorie_budget > 0)?.calorie_budget ??
    2000;
  const calsWeek = useMemo(() => {
    const dayMap = new Map((weekly?.days ?? []).map((d) => [d.date, d]));
    return buildWeekDates(todayStr).map((date) => ({
      day: new Date(date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
      })[0],
      cals: dayMap.get(date)?.calories_consumed ?? 0,
      today: date === todayStr,
    }));
  }, [weekly, todayStr]);

  const avgCals = Math.round(weekly?.avg_calories ?? 0);
  const maxCals = useMemo(
    () => Math.max(...calsWeek.map((d) => d.cals), calsGoal, 1),
    [calsWeek, calsGoal],
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>
              THIS WEEK
            </Text>
            <Text style={[styles.title, { color: P.text }]}>
              Progress<Text style={{ color: P.calories }}>.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.stack}>
          <ProgressHeadlineStats
            streak={streak}
            consistency={consistency}
            goalsHit={goalsHit}
          />

          {/* ── Readiness widget ───────────────────────────────── */}
          <ReadinessWidget delay={180} />

          <ProgressConsistencyCard
            consistency={consistency}
            days={consistencyDays}
            delay={220}
          />

          {/* ── Steps progress ────────────────────────────────── */}
          <StepsCard delay={280} />

          <ProgressCaloriesCard
            avgCals={avgCals}
            calsGoal={calsGoal}
            days={calsWeek}
            maxCals={maxCals}
            delay={340}
          />

          <ProgressWeightCard
            entries={entries}
            profileWeightKg={profile?.weightKg ?? null}
            weightUnit={weightUnit}
            toDisplayWeight={toDisplayWeight}
            delay={400}
          />

          <MirrorPromoCard P={P} delay={480} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  stack: {
    paddingHorizontal: 20,
    gap: 14,
  },
});
