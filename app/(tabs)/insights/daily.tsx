import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { AnimatedCard, DayNavigator, usePalette, useScreenPadding } from '@/lib/log-theme';
import { DailyGoalsSummaryCard } from '@/components/insights/DailyGoalsSummaryCard';
import { DailyMetricsCard } from '@/components/insights/DailyMetricsCard';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { useDailyInsights } from '@/hooks/use-daily-insights';
import { useFood } from '@/context/food-context';
import { useInsights } from '@/context/insights-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import {
  formatSleepHours,
  recomputeNormalizedDay,
  type NormalizedDay,
  type InsightTargets,
} from '@/utils/insights-aggregator';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, radius = 8, style }: {
  width: number | string; height: number; radius?: number; style?: object;
}) {
  const P    = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });

  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: P.hair, opacity }, style]} />
  );
}

function DailySkeleton({
  pad, insets, date, isToday, onBack, onPrev, onNext,
}: {
  pad:     ReturnType<typeof useScreenPadding>;
  insets:  { bottom: number };
  date:    string;
  isToday: boolean;
  onBack:  () => void;
  onPrev:  () => void;
  onNext:  () => void;
}) {
  const P = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable onPress={onBack} hitSlop={12} style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="chevron-back" size={18} color={P.text} />
          </Pressable>
          <DayNavigator label={formatDateLabel(date)} isToday={isToday} onPrev={onPrev} onNext={onNext} />
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stack}>
          {/* Goals summary skeleton */}
          <View style={[skeletonCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <SkeletonBlock width={80}  height={10} radius={4} />
            <SkeletonBlock width={160} height={52} radius={8} style={{ marginTop: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={{ flex: 1, gap: 6 }}>
                  <SkeletonBlock width="100%" height={3} radius={2} />
                  <SkeletonBlock width="70%"  height={9} radius={3} />
                </View>
              ))}
            </View>
          </View>

          {/* Metric rows skeleton */}
          <View style={[skeletonCard, { backgroundColor: P.card, borderColor: P.cardEdge, padding: 0, overflow: 'hidden' }]}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: P.hair }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <SkeletonBlock width={15} height={15} radius={4} />
                    <SkeletonBlock width={60}  height={14} radius={4} />
                  </View>
                  <SkeletonBlock width={100} height={14} radius={4} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <SkeletonBlock width="80%" height={4} radius={2} />
                  <SkeletonBlock width={30}  height={11} radius={3} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const skeletonCard: object = {
  borderRadius: 20,
  borderWidth:  StyleSheet.hairlineWidth,
  padding:      20,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function prevDay(iso: string): string { return addLocalCalendarDays(iso, -1); }
function nextDay(iso: string): string { return addLocalCalendarDays(iso, 1);  }

function formatDateLabel(iso: string): string {
  const today     = getLocalDateString();
  const yesterday = prevDay(today);
  if (iso === today)     return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function formatCardDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();
}

function withLiveNutrition(
  day:      NormalizedDay,
  targets:  InsightTargets,
  calories: number,
  protein:  number,
  carbs:    number,
  fat:      number,
): NormalizedDay {
  return recomputeNormalizedDay({ ...day, calories, protein, carbs, fat }, targets);
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DailyInsightScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const params  = useLocalSearchParams<{ date?: string }>();
  const today   = getLocalDateString();
  const [date, setDate] = useState(params.date ?? today);
  const isToday = date === today;

  const goTo = (d: string) => { if (d <= today) setDate(d); };

  const { data, isLoading, isRefreshing, error, refresh } = useDailyInsights(date);

  // Daily insight paragraph for the selected date.
  const { todayInsight, claudeInsight, history } = useInsights();
  const dailyInsight = isToday
    ? (claudeInsight ?? todayInsight)
    : (history.find(i => i.date === date) ?? null);

  const {
    activeDate:    foodActiveDate,
    totalCalories: liveCalories,
    totalProtein:  liveProtein,
    totalCarbs:    liveCarbs,
    totalFat:      liveFat,
  } = useFood();
  const useLiveFood = isToday && foodActiveDate === today;

  if (isLoading && !data) {
    return (
      <DailySkeleton
        pad={pad} insets={insets} date={date} isToday={isToday}
        onBack={() => router.back()}
        onPrev={() => goTo(prevDay(date))}
        onNext={() => goTo(nextDay(date))}
      />
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="cloud-offline-outline" size={36} color={P.textFaint} />
        <Text style={{ color: P.textDim, fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24 }}>{error}</Text>
        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            { marginTop: 20, backgroundColor: P.calories, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const targets = data?.targets;
  const day     = data?.day && targets && useLiveFood
    ? withLiveNutrition(data.day, targets, liveCalories, liveProtein, liveCarbs, liveFat)
    : data?.day;

  // Targets with fallbacks
  const calBudget   = targets?.calorie_budget ?? 2000;
  const protTarget  = targets?.protein_target ?? 150;
  const stepsTarget = targets?.steps_target   ?? 10000;
  const sleepTarget = targets?.sleep_target   ?? 8;

  // Values
  const cals    = day?.calories    ?? 0;
  const protein = day?.protein     ?? 0;
  const steps   = day?.steps       ?? null;
  const sleep =
    day?.sleep_hours != null && day.sleep_hours > 0
      ? day.sleep_hours
      : null;

  // Progress percentages (0–100, capped)
  const calPct   = calBudget   > 0 ? Math.min((cals    / calBudget)   * 100, 100) : 0;
  const protPct  = protTarget  > 0 ? Math.min((protein / protTarget)  * 100, 100) : 0;
  const stepsPct = stepsTarget > 0 && steps != null ? Math.min((steps / stepsTarget) * 100, 100) : 0;
  const sleepPct = sleepTarget > 0 && sleep != null ? Math.min((sleep / sleepTarget) * 100, 100) : 0;

  // Met status
  const metCal   = day?.met_calories === 'met';
  const metProt  = day?.met_protein  === 'met';
  const metSteps = day?.met_steps    === 'met';
  const metSleep = day?.met_sleep    === 'met';
  const goalsMetCount = [metCal, metProt, metSteps, metSleep].filter(Boolean).length;

  const miniGoals = [
    { label: 'Calories', pct: calPct,   met: metCal   },
    { label: 'Protein',  pct: protPct,  met: metProt  },
    { label: 'Steps',    pct: stepsPct, met: metSteps },
    { label: 'Sleep',    pct: sleepPct, met: metSleep },
  ];

  const metrics: {
    key: string; label: string; icon: IoniconName;
    value: string; target: string; pct: number; met: boolean; noData: boolean;
  }[] = [
    {
      key: 'cals',  label: 'Calories', icon: 'flame-outline',
      value:  cals > 0 ? cals.toLocaleString() : '0',
      target: `${calBudget.toLocaleString()} kcal`,
      pct: calPct, met: metCal, noData: false,
    },
    {
      key: 'prot',  label: 'Protein',  icon: 'pulse-outline',
      value:  protein > 0 ? `${Math.round(protein)}` : '0',
      target: `${protTarget} g`,
      pct: protPct, met: metProt, noData: false,
    },
    {
      key: 'steps', label: 'Steps',    icon: 'walk-outline',
      value:  steps != null ? steps.toLocaleString() : '—',
      target: stepsTarget.toLocaleString(),
      pct: stepsPct, met: metSteps, noData: steps == null,
    },
    {
      key: 'sleep', label: 'Sleep',    icon: 'moon-outline',
      value:  sleep != null ? formatSleepHours(sleep) : '—',
      target: `${sleepTarget}h`,
      pct: sleepPct, met: metSleep, noData: sleep == null,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={P.calories} />
        }
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          >
            <Ionicons name="chevron-back" size={18} color={P.text} />
          </Pressable>
          <DayNavigator
            label={formatDateLabel(date)}
            isToday={isToday}
            onPrev={() => goTo(prevDay(date))}
            onNext={() => goTo(nextDay(date))}
            accentColor={P.calories}
            large
          />
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stack}>

          <DailyGoalsSummaryCard
            P={P}
            delay={60}
            large
            dateLabel={formatCardDate(date)}
            goalsMetCount={goalsMetCount}
            miniGoals={miniGoals}
          />

          <DailyMetricsCard P={P} delay={140} metrics={metrics} />

          {day?.is_partial ? (
            <GradientCard
              variant="insightGrey"
              palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
              corner="top-right"
              delay={220}
              contentStyle={{ paddingVertical: 24, paddingHorizontal: 20 }}
            >
              <View style={styles.emptyState}>
                <Ionicons name="journal-outline" size={32} color={P.textFaint} />
                <Text style={[styles.emptyText, { color: P.textDim }]}>
                  {isToday
                    ? 'No meals logged yet today. Start logging to see your daily score.'
                    : 'No data was logged for this day.'}
                </Text>
              </View>
            </GradientCard>
          ) : null}

          {dailyInsight ? (
            <GradientCard
              variant="insightGrey"
              palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
              corner="top-right"
              delay={300}
              contentStyle={{ paddingVertical: 20, paddingHorizontal: 20 }}
            >
              <View style={styles.insightHeader}>
                {(() => {
                  const accent = getCardAccent('insightGrey', P.isDark);
                  return (
                    <View style={[styles.insightIconRing, { backgroundColor: accent.iconSoft }]}>
                      <View style={[styles.insightIconBox, { backgroundColor: accent.iconBg }]}>
                        <Ionicons name="sparkles" size={15} color="#FFF" />
                      </View>
                    </View>
                  );
                })()}
                <Text style={[styles.insightLabel, { color: P.textDim }]}>
                  {dailyInsight.type === 'claude' ? 'RIS insight' : 'Daily insight'}
                </Text>
              </View>

              {dailyInsight.title ? (
                <Text style={[styles.insightTitle, { color: P.text }]}>
                  {dailyInsight.title}
                </Text>
              ) : null}
              <Text style={[styles.insightBody, { color: P.textDim }]}>
                {dailyInsight.message}
              </Text>
            </GradientCard>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   24,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stack: {
    paddingHorizontal: 20,
    gap:               16,
  },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  emptyText:  { fontSize: 16, fontWeight: '400', textAlign: 'center', lineHeight: 24 },

  // ── Insight paragraph ──
  insightHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  12,
  },
  insightIconRing: {
    padding:      3,
    borderRadius: 12,
  },
  insightIconBox: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  insightLabel: {
    fontSize: 14, fontWeight: '600', letterSpacing: -0.1,
  },
  insightTitle: {
    fontSize: 18, fontWeight: '800', letterSpacing: -0.3,
    lineHeight: 24, marginBottom: 8,
  },
  insightBody: {
    fontSize: 16, fontWeight: '500', lineHeight: 24, letterSpacing: -0.1,
  },
});
