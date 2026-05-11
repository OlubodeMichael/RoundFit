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
import { useDailyInsights } from '@/hooks/use-daily-insights';
import { useFood } from '@/context/food-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import {
  formatSleepHours,
  recomputeNormalizedDay,
  type MetricStatus,
  type NormalizedDay,
  type InsightTargets,
} from '@/utils/insights-aggregator';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, radius = 8, style }: {
  width: number | string; height: number; radius?: number; style?: object;
}) {
  const P     = usePalette();
  const anim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: P.hair, opacity }, style]} />
  );
}

function DailySkeleton({
  pad, insets, date, isToday, onBack, onPrev, onNext,
}: {
  pad:     ReturnType<typeof import('@/lib/log-theme').useScreenPadding>;
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
        {/* Real header — date and nav are already known */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable onPress={onBack} hitSlop={12} style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="chevron-back" size={18} color={P.text} />
          </Pressable>
          <DayNavigator
            label={formatDateLabel(date)}
            isToday={isToday}
            onPrev={onPrev}
            onNext={onNext}
          />
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stack}>
          {/* Score hero skeleton */}
          <View style={[skeletonStyles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <SkeletonBlock width={80} height={10} radius={4} style={{ alignSelf: 'center' }} />
            <SkeletonBlock width={90} height={72} radius={10} style={{ alignSelf: 'center', marginTop: 10 }} />
            <SkeletonBlock width={40} height={12} radius={4} style={{ alignSelf: 'center', marginTop: 6 }} />
            <SkeletonBlock width='100%' height={6} radius={4} style={{ marginTop: 16 }} />
            <SkeletonBlock width={140} height={13} radius={4} style={{ alignSelf: 'center', marginTop: 14 }} />
          </View>

          {/* Metric card skeletons */}
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[skeletonStyles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SkeletonBlock width={44} height={44} radius={14} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonBlock width={60} height={9} radius={4} />
                  <SkeletonBlock width={80} height={20} radius={5} />
                  <SkeletonBlock width={100} height={11} radius={4} />
                </View>
                <SkeletonBlock width={72} height={30} radius={8} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

function prevDay(iso: string): string {
  return addLocalCalendarDays(iso, -1);
}

function nextDay(iso: string): string {
  return addLocalCalendarDays(iso, 1);
}

function formatDateLabel(iso: string): string {
  const today     = getLocalDateString();
  const yesterday = prevDay(today);
  if (iso === today)     return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function statusColor(
  status: MetricStatus,
  met: string,
  partial: string,
  missed: string,
  faint: string,
): string {
  if (status === 'met')     return met;
  if (status === 'partial') return partial;
  if (status === 'missed')  return missed;
  return faint;
}

function statusLabel(status: MetricStatus): string {
  if (status === 'met')     return 'On target';
  if (status === 'partial') return 'Close';
  if (status === 'missed')  return 'Off target';
  return 'No data';
}

/**
 * Re-derive a NormalizedDay using fresh nutrition totals from the live food
 * context. Steps, sleep, water, and date are kept from the server-side day so
 * we only override what the food log actually owns.
 */
function withLiveNutrition(
  day:      NormalizedDay,
  targets:  InsightTargets,
  calories: number,
  protein:  number,
  carbs:    number,
  fat:      number,
): NormalizedDay {
  return recomputeNormalizedDay(
    { ...day, calories, protein, carbs, fat },
    targets,
  );
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

  const goTo    = (d: string) => { if (d <= today) setDate(d); };

  const { data, isLoading, isRefreshing, error, refresh } = useDailyInsights(date);

  // Live food totals — when viewing today, prefer these over the cached server
  // values so calories/protein update the moment a meal is logged.
  const {
    activeDate:    foodActiveDate,
    totalCalories: liveCalories,
    totalProtein:  liveProtein,
    totalCarbs:    liveCarbs,
    totalFat:      liveFat,
  } = useFood();
  const useLiveFood = isToday && foodActiveDate === today;

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <DailySkeleton
        pad={pad}
        insets={insets}
        date={date}
        isToday={isToday}
        onBack={() => router.back()}
        onPrev={() => goTo(prevDay(date))}
        onNext={() => goTo(nextDay(date))}
      />
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="cloud-offline-outline" size={36} color={P.textFaint} />
        <Text style={{ color: P.textDim, fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
          {error}
        </Text>
        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            { marginTop: 20, backgroundColor: P.calories, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const targets = data?.targets;
  const day     = data?.day && targets && useLiveFood
    ? withLiveNutrition(data.day, targets, liveCalories, liveProtein, liveCarbs, liveFat)
    : data?.day;
  const score   = day?.score ?? 0;

  // Count targets met (excluding no-data metrics)
  const metricStatuses = day
    ? [day.met_calories, day.met_protein, day.met_steps, day.met_sleep]
    : [];
  const trackable = metricStatuses.filter(s => s !== 'no-data').length;
  const metCount  = metricStatuses.filter(s => s === 'met').length;

  const metrics: {
    key:    string;
    label:  string;
    icon:   IoniconName;
    tint:   string;
    soft:   string;
    actual: string;
    target: string;
    status: MetricStatus;
  }[] = [];

  if (day && targets) {
    metrics.push({
      key:    'calories',
      label:  'Calories',
      icon:   'flame',
      tint:   P.calories,
      soft:   P.caloriesSoft,
      actual: `${Math.round(day.calories)} kcal`,
      target: `${targets.calorie_budget} kcal`,
      status: day.met_calories,
    });
    metrics.push({
      key:    'protein',
      label:  'Protein',
      icon:   'fitness',
      tint:   P.protein,
      soft:   P.proteinSoft,
      actual: `${Math.round(day.protein)} g`,
      target: `${targets.protein_target} g`,
      status: day.met_protein,
    });
    if (day.steps !== null || targets.steps_target !== null) {
      metrics.push({
        key:    'steps',
        label:  'Steps',
        icon:   'walk',
        tint:   P.fat,
        soft:   P.fatSoft,
        actual: day.steps != null ? day.steps.toLocaleString() : '—',
        target: targets.steps_target != null ? targets.steps_target.toLocaleString() : '—',
        status: day.met_steps,
      });
    }
    if (day.sleep_hours !== null || targets.sleep_target !== null) {
      metrics.push({
        key:    'sleep',
        label:  'Sleep',
        icon:   'moon',
        tint:   P.sleep,
        soft:   P.sleepSoft,
        actual: formatSleepHours(day.sleep_hours),
        target: formatSleepHours(targets.sleep_target ?? 7),
        status: day.met_sleep,
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={P.calories} />
        }
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="chevron-back" size={18} color={P.text} />
          </Pressable>

          <DayNavigator
            label={formatDateLabel(date)}
            isToday={isToday}
            onPrev={() => goTo(prevDay(date))}
            onNext={() => goTo(nextDay(date))}
            accentColor={P.calories}
          />

          {/* Balance spacer */}
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stack}>
          {/* ── Score hero ───────────────────────────────────── */}
          <AnimatedCard delay={60} style={{ overflow: 'hidden', alignItems: 'center' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.caloriesSoft, top: -80, right: -60 }]} />

            <Text style={[styles.scoreLabel, { color: P.textFaint }]}>DAILY SCORE</Text>
            <Text style={[styles.scoreNumber, { color: P.text }]}>{score}</Text>
            <Text style={[styles.scoreOf, { color: P.textFaint }]}>/ 100</Text>

            <View style={[styles.progressTrack, { backgroundColor: P.sunken, width: '100%', marginTop: 16 }]}>
              <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: P.calories }]} />
            </View>

            {trackable > 0 && (
              <Text style={[styles.metSummary, { color: P.textDim }]}>
                {metCount} of {trackable} targets hit today
              </Text>
            )}
          </AnimatedCard>

          {/* ── Metric cards ─────────────────────────────────── */}
          {metrics.map((m, i) => {
            const statusCol = statusColor(m.status, P.protein, P.carbs, P.calories, P.textFaint);
            return (
              <AnimatedCard key={m.key} delay={140 + i * 60}>
                <View style={styles.metricRow}>
                  <View style={[styles.metricIcon, { backgroundColor: m.soft }]}>
                    <Ionicons name={m.icon} size={18} color={m.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.metricLabel, { color: P.textFaint }]}>{m.label.toUpperCase()}</Text>
                    <Text style={[styles.metricActual, { color: P.text }]}>{m.actual}</Text>
                    <Text style={[styles.metricTarget, { color: P.textDim }]}>Target: {m.target}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: `${statusCol}22` }]}>
                    <Text style={[styles.statusChipText, { color: statusCol }]}>{statusLabel(m.status)}</Text>
                  </View>
                </View>
              </AnimatedCard>
            );
          })}

          {/* ── Water ────────────────────────────────────────── */}
          {day && day.water_glasses > 0 && (
            <AnimatedCard delay={440}>
              <View style={styles.metricRow}>
                <View style={[styles.metricIcon, { backgroundColor: P.sleepSoft }]}>
                  <Ionicons name="water" size={18} color={P.sleep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.metricLabel, { color: P.textFaint }]}>WATER</Text>
                  <Text style={[styles.metricActual, { color: P.text }]}>{day.water_glasses} glasses</Text>
                </View>
              </View>
            </AnimatedCard>
          )}

          {/* ── Empty state ───────────────────────────────────── */}
          {day?.is_partial && (
            <AnimatedCard delay={200}>
              <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
                <Ionicons name="journal-outline" size={28} color={P.textFaint} />
                <Text style={{ color: P.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  {isToday
                    ? 'No meals logged yet today. Start logging to see your daily score.'
                    : 'No data was logged for this day.'}
                </Text>
              </View>
            </AnimatedCard>
          )}
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
    marginBottom:   16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },
  stack: {
    paddingHorizontal: 20,
    gap:               12,
  },

  glow: {
    position:     'absolute',
    width:        240,
    height:       240,
    borderRadius: 120,
  },

  scoreLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.8,
    marginBottom:  4,
  },
  scoreNumber: {
    fontSize:      72,
    fontWeight:    '800',
    letterSpacing: -3,
    lineHeight:    76,
  },
  scoreOf: {
    fontSize:   14,
    fontWeight: '700',
    marginTop:  -4,
  },
  progressTrack: {
    height:       6,
    borderRadius: 4,
    overflow:     'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 4,
  },
  metSummary: {
    fontSize:   13,
    fontWeight: '600',
    marginTop:  12,
  },

  metricRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  metricIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
    marginBottom:  2,
  },
  metricActual: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  metricTarget: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      8,
  },
  statusChipText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
});
