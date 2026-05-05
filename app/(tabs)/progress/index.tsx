import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { useHealth } from '@/hooks/use-health';
import { useUnits } from '@/hooks/use-units';
import { useSummary } from '@/hooks/use-summary';
import { useWeight } from '@/hooks/use-weight';
import { getLocalDateString } from '@/utils/date';
import { formatDistance } from '@/utils/units';
import type { DistanceUnit } from '@/utils/units';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const STEPS_GOAL = 10_000;

function StepsCard({ delay = 0 }: { delay?: number }) {
  const P = usePalette();
  const { today, isConnected } = useHealth();
  const { profileUnit } = useUnits();

  const steps       = today?.steps ?? 0;
  const activeCals  = today?.active_calories ?? 0;
  const pct         = Math.min(steps / STEPS_GOAL, 1);
  const remaining   = Math.max(STEPS_GOAL - steps, 0);

  const fillAnim = useRef(new Animated.Value(0)).current;
  const [displayedSteps, setDisplayedSteps] = useState(0);

  useEffect(() => {
    const countAnim = new Animated.Value(0);
    const id = countAnim.addListener(({ value }) => setDisplayedSteps(Math.round(value)));
    Animated.parallel([
      Animated.timing(fillAnim, {
        toValue: pct,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(countAnim, {
        toValue: steps,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => countAnim.removeListener(id));
    return () => countAnim.removeListener(id);
  }, [steps, pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const pctLabel  = Math.round(pct * 100);

  return (
    <AnimatedCard delay={delay}>
      <View style={stepsStyles.headRow}>
        <View style={[stepsStyles.iconTile, { backgroundColor: P.waterSoft }]}>
          <Ionicons name="footsteps" size={16} color={P.water} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[stepsStyles.eyebrow, { color: P.textFaint }]}>TODAY&apos;S STEPS</Text>
          <Text style={[stepsStyles.title, { color: P.text }]}>
            {displayedSteps.toLocaleString()}
            <Text style={[stepsStyles.goal, { color: P.textFaint }]}> / {STEPS_GOAL.toLocaleString()}</Text>
          </Text>
        </View>
        <View style={[stepsStyles.pctPill, { backgroundColor: pct >= 1 ? P.proteinSoft : P.waterSoft }]}>
          {pct >= 1
            ? <Ionicons name="checkmark" size={11} color={P.protein} />
            : null}
          <Text style={[stepsStyles.pctText, { color: pct >= 1 ? P.protein : P.water }]}>
            {pct >= 1 ? 'Done!' : `${pctLabel}%`}
          </Text>
        </View>
      </View>

      <View style={[stepsStyles.track, { backgroundColor: P.hair }]}>
        <Animated.View
          style={[
            stepsStyles.fill,
            {
              width: fillWidth,
              backgroundColor: pct >= 1 ? P.protein : P.water,
            },
          ]}
        />
      </View>

      <View style={stepsStyles.footRow}>
        <View style={stepsStyles.footCell}>
          <Text style={[stepsStyles.footVal, { color: P.text }]}>
            {remaining > 0 ? remaining.toLocaleString() : '0'}
          </Text>
          <Text style={[stepsStyles.footLbl, { color: P.textFaint }]}>steps left</Text>
        </View>
        <View style={[stepsStyles.footDivider, { backgroundColor: P.hair }]} />
        <View style={stepsStyles.footCell}>
          <Text style={[stepsStyles.footVal, { color: P.text }]}>
            {activeCals.toLocaleString()}
          </Text>
          <Text style={[stepsStyles.footLbl, { color: P.textFaint }]}>active cal</Text>
        </View>
        <View style={[stepsStyles.footDivider, { backgroundColor: P.hair }]} />
        <View style={stepsStyles.footCell}>
          <Text style={[stepsStyles.footVal, { color: P.text }]}>
            {today?.distance != null
              ? formatDistance(today.distance, (today.distance_unit as DistanceUnit) ?? 'km', profileUnit)
              : '—'}
          </Text>
          <Text style={[stepsStyles.footLbl, { color: P.textFaint }]}>distance</Text>
        </View>
      </View>

      {!isConnected && (
        <Text style={[stepsStyles.notConnected, { color: P.textFaint }]}>
          Connect Apple Health to see live steps
        </Text>
      )}
    </AnimatedCard>
  );
}

const stepsStyles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginBottom: 3 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  goal: { fontSize: 14, fontWeight: '600' },
  pctPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pctText: { fontSize: 11, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  fill: { height: '100%', borderRadius: 3 },
  footRow: { flexDirection: 'row', alignItems: 'center' },
  footCell: { flex: 1, alignItems: 'center', gap: 3 },
  footDivider: { width: 1, height: 28, marginHorizontal: 4 },
  footVal: { fontSize: 15, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  footLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  notConnected: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 12 },
});

export default function ProgressScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { weekly }                       = useSummary();
  const { entries }                      = useWeight();
  const { weightUnit, toDisplayWeight }  = useUnits();
  const todayStr                         = getLocalDateString();

  // ── Streak: consecutive trailing logged days ──────────────────────────────
  const streak = useMemo(() => {
    if (!weekly?.days?.length) return 0;
    const sorted = [...weekly.days].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const d of sorted) {
      if (d.calories_consumed > 0) count++;
      else break;
    }
    return count;
  }, [weekly]);

  // ── Consistency ───────────────────────────────────────────────────────────
  const consistency = Math.round(weekly?.consistency_score ?? 0);

  // ── Goals (days under calorie budget out of 7) ───────────────────────────
  const goalsHit = useMemo(() => {
    if (!weekly?.days?.length) return 0;
    return weekly.days.filter(d => d.calories_consumed > 0 && d.calories_consumed <= d.calorie_budget).length;
  }, [weekly]);

  // ── Consistency day strip ─────────────────────────────────────────────────
  const consistencyDays = useMemo(() => {
    if (!weekly?.days?.length) return [];
    return [...weekly.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })[0],
        on:    d.calories_consumed > 0,
        today: d.date === todayStr,
      }));
  }, [weekly, todayStr]);

  // ── Calories chart ────────────────────────────────────────────────────────
  const calsGoal = weekly?.days.find(d => d.calorie_budget > 0)?.calorie_budget ?? 2000;
  const calsWeek = useMemo(() => {
    if (!weekly?.days?.length) return [];
    return [...weekly.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        day:  new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })[0],
        cals: d.calories_consumed,
      }));
  }, [weekly]);

  const avgCals  = Math.round(weekly?.avg_calories ?? 0);
  const maxCals  = useMemo(
    () => Math.max(...calsWeek.map(d => d.cals), calsGoal, 1),
    [calsWeek, calsGoal],
  );

  // ── Weight chart (up to 7 most recent entries, oldest→newest) ────────────
  const weightEntries = useMemo(() => entries.slice(0, 7).reverse(), [entries]);

  const weightMin   = useMemo(() => weightEntries.length ? Math.min(...weightEntries.map(e => e.weight_kg)) : 0, [weightEntries]);
  const weightMax   = useMemo(() => weightEntries.length ? Math.max(...weightEntries.map(e => e.weight_kg)) : 0, [weightEntries]);
  const weightRange = weightMax - weightMin || 1;

  const weightDeltaKg = weightEntries.length >= 2
    ? weightEntries[weightEntries.length - 1].weight_kg - weightEntries[0].weight_kg
    : 0;
  const currentKg  = weightEntries.length ? weightEntries[weightEntries.length - 1].weight_kg : null;
  const weightTrend = weightDeltaKg < -0.1 ? 'Trending down' : weightDeltaKg > 0.1 ? 'Trending up' : 'Stable';

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>THIS WEEK</Text>
            <Text style={[styles.title, { color: P.text }]}>
              Progress<Text style={{ color: P.calories }}>.</Text>
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            style={[styles.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          >
            <Ionicons name="calendar-outline" size={16} color={P.text} />
          </Pressable>
        </View>

        <View style={styles.stack}>
          {/* ── Headline stats ─────────────────────────────────── */}
          <View style={styles.statsRow}>
            <StatTile
              delay={60}
              tone="accent"
              icon="flame"
              label="Day streak"
              value={`${streak}`}
            />
            <StatTile
              delay={110}
              icon="compass"
              label="Consistency"
              value={`${consistency}`}
              valueSuffix="/100"
              accentColor={P.protein}
            />
            <StatTile
              delay={160}
              icon="trophy"
              label="Goals met"
              value={`${goalsHit}`}
              valueSuffix="/7"
              accentColor={P.carbs}
            />
          </View>

          {/* ── Consistency index strip ────────────────────────── */}
          <AnimatedCard delay={220}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>CONSISTENCY INDEX</Text>
                <Text style={[styles.cardTitle, { color: P.text }]}>
                  {consistencyDays.filter(d => d.on).length} of {consistencyDays.length || 7} days on target
                </Text>
              </View>
              <View style={[styles.trendPill, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="checkmark-circle" size={11} color={P.protein} />
                <Text style={[styles.trendText, { color: P.protein }]}>{consistency}/100</Text>
              </View>
            </View>

            <View style={styles.consistencyRow}>
              {consistencyDays.map((d, i) => {
                const bg = d.on ? P.protein : P.sunken;
                const border = d.on ? P.protein : P.cardEdge;
                const isToday = d.today;
                return (
                  <View key={i} style={styles.consistencyCol}>
                    <View
                      style={[
                        styles.consistencyCell,
                        {
                          backgroundColor: bg,
                          borderColor:     isToday ? P.calories : border,
                          borderWidth:     isToday ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      {d.on && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.consistencyLabel,
                        { color: isToday ? P.calories : P.textFaint, fontWeight: isToday ? '800' : '700' },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Steps progress ────────────────────────────────── */}
          <StepsCard delay={280} />

          {/* ── Calories bar chart ─────────────────────────────── */}
          <AnimatedCard delay={340}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>CALORIES</Text>
                <Text style={[styles.cardTitle, { color: P.text }]}>
                  {avgCals > 0 ? `Avg ${avgCals.toLocaleString()}` : 'No data yet'}
                </Text>
              </View>
              <View style={styles.goalLegend}>
                <View style={[styles.dashLine, { borderColor: P.calories }]} />
                <Text style={[styles.goalLegendText, { color: P.textFaint }]}>
                  Goal {calsGoal.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.barChart}>
              {calsWeek.map((d, i) => {
                const pct      = d.cals / maxCals;
                const goalPct  = calsGoal / maxCals;
                const isToday  = i === calsWeek.length - 1;
                const over     = d.cals > calsGoal;
                const color    = isToday ? P.calories : over ? P.danger : P.protein;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barWrap}>
                      <View style={[styles.goalLine, { bottom: `${goalPct * 100}%`, borderColor: P.calories, opacity: 0.4 }]} />
                      <View
                        style={[
                          styles.bar,
                          {
                            height:          `${pct * 100}%`,
                            backgroundColor: color,
                            opacity:         isToday ? 1 : 0.75,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barDay,
                        {
                          color:      isToday ? P.calories : P.textFaint,
                          fontWeight: isToday ? '800' : '600',
                        },
                      ]}
                    >
                      {d.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Weight card ────────────────────────────────────── */}
          <AnimatedCard delay={400} padding={0}>
            <Pressable
              onPress={() => router.push('/(tabs)/progress/weight')}
              style={({ pressed }) => [
                { padding: 20, borderRadius: 24 },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.headRow}>
                <View style={[styles.iconTile, { backgroundColor: P.weightSoft }]}>
                  <Ionicons name="scale" size={16} color={P.weight} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>WEIGHT OVER TIME</Text>
                  <Text style={[styles.cardTitle, { color: P.text }]}>{weightTrend}</Text>
                </View>
                {weightEntries.length >= 2 && (
                  <View style={[
                    styles.trendPill,
                    { backgroundColor: weightDeltaKg <= -0.1 ? P.proteinSoft : weightDeltaKg >= 0.1 ? P.caloriesSoft : P.sunken },
                  ]}>
                    <Ionicons
                      name={weightDeltaKg <= -0.1 ? 'trending-down' : weightDeltaKg >= 0.1 ? 'trending-up' : 'remove'}
                      size={11}
                      color={weightDeltaKg <= -0.1 ? P.protein : weightDeltaKg >= 0.1 ? P.calories : P.textFaint}
                    />
                    <Text style={[
                      styles.trendText,
                      { color: weightDeltaKg <= -0.1 ? P.protein : weightDeltaKg >= 0.1 ? P.calories : P.textFaint },
                    ]}>
                      {weightDeltaKg > 0 ? '+' : ''}{toDisplayWeight(Math.abs(weightDeltaKg)).toFixed(1)} {weightUnit}
                    </Text>
                  </View>
                )}
              </View>

              {weightEntries.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ color: P.textFaint, fontSize: 13, fontWeight: '500' }}>
                    No weight entries yet — log your weight to see trends
                  </Text>
                </View>
              ) : (
                <>
                  {/* Dot chart — oldest → newest */}
                  <View style={styles.weightChart}>
                    {weightEntries.map((w, i) => {
                      const normalized = (w.weight_kg - weightMin) / weightRange;
                      const bottom     = 6 + normalized * 48;
                      const isLatest   = i === weightEntries.length - 1;
                      const dateLabel  = new Date(w.logged_at).getDate().toString();
                      return (
                        <View key={i} style={styles.weightCol}>
                          <View style={styles.weightColInner}>
                            <View
                              style={[
                                styles.weightDot,
                                {
                                  bottom,
                                  backgroundColor: isLatest ? P.weight : P.textFaint,
                                  width:           isLatest ? 10 : 6,
                                  height:          isLatest ? 10 : 6,
                                  borderRadius:    isLatest ? 5 : 3,
                                  shadowColor:     isLatest ? P.weight : 'transparent',
                                  shadowOpacity:   isLatest ? 0.5 : 0,
                                  shadowRadius:    isLatest ? 8 : 0,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.weightDate, { color: P.textFaint }]}>
                            {dateLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.weightFoot}>
                    <View>
                      <Text style={[styles.weightNum, { color: P.text }]}>
                        {currentKg !== null ? toDisplayWeight(currentKg).toFixed(1) : '—'}
                        <Text style={[styles.weightUnit, { color: P.textFaint }]}> {weightUnit}</Text>
                      </Text>
                      <Text style={[styles.weightNote, { color: P.textFaint }]}>Current</Text>
                    </View>
                    {weightEntries.length >= 2 && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.weightNum, {
                          color: weightDeltaKg <= -0.1 ? P.protein : weightDeltaKg >= 0.1 ? P.calories : P.textFaint,
                        }]}>
                          {weightDeltaKg > 0 ? '+' : weightDeltaKg < 0 ? '−' : ''}{toDisplayWeight(Math.abs(weightDeltaKg)).toFixed(1)}
                          <Text style={[styles.weightUnit, { color: P.textFaint }]}> {weightUnit}</Text>
                        </Text>
                        <Text style={[styles.weightNote, { color: P.textFaint }]}>
                          {weightEntries.length}-entry change
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </Pressable>
          </AnimatedCard>

          {/* ── 30-day mirror promo ────────────────────────────── */}
          <AnimatedCard delay={480} padding={0} style={{ overflow: 'hidden' }}>
            <Pressable
              onPress={() => router.push('/(tabs)/progress/mirror')}
              style={({ pressed }) => [
                styles.mirrorCard,
                { backgroundColor: P.fat },
                pressed && { opacity: 0.92 },
              ]}
            >
              <View pointerEvents="none" style={[styles.mirrorGlow, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />

              <Text style={styles.mirrorTitle}>30-day mirror</Text>
              <Text style={styles.mirrorSub}>
                Optimal sleep, optimal protein, best training days, and the strongest correlation in your last month.
              </Text>

              <View style={styles.mirrorFoot}>
                <View style={styles.mirrorItem}>
                  <Ionicons name="analytics" size={12} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.mirrorFootLabel}>4 correlations</Text>
                </View>
                <View style={styles.mirrorItem}>
                  <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.mirrorFootLabel}>AI synthesis</Text>
                </View>
                <View style={[styles.mirrorCta, { backgroundColor: '#fff' }]}>
                  <Text style={[styles.mirrorCtaText, { color: P.fat }]}>Open</Text>
                  <Ionicons name="arrow-forward" size={13} color={P.fat} />
                </View>
              </View>
            </Pressable>
          </AnimatedCard>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Headline stat tile ─────────────────────────────────────────────────────
function StatTile({
  icon, label, value, valueSuffix, tone, accentColor, delay,
}: {
  icon:         IoniconName;
  label:        string;
  value:        string;
  valueSuffix?: string;
  tone?:        'accent';
  accentColor?: string;
  delay:        number;
}) {
  const P = usePalette();

  if (tone === 'accent') {
    return (
      <AnimatedCard delay={delay} padding={14} style={[styles.statTile, { backgroundColor: P.calories, borderColor: P.calories }]}>
        <Ionicons name={icon} size={20} color="rgba(255,255,255,0.95)" />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Text style={[styles.statValue, { color: '#fff' }]}>{value}</Text>
          {!!valueSuffix && (
            <Text style={[styles.statSuffix, { color: 'rgba(255,255,255,0.75)' }]}>{valueSuffix}</Text>
          )}
        </View>
        <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.85)' }]}>{label.toUpperCase()}</Text>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard delay={delay} padding={14} style={styles.statTile}>
      <Ionicons name={icon} size={20} color={accentColor ?? P.text} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={[styles.statValue, { color: P.text }]}>{value}</Text>
        {!!valueSuffix && (
          <Text style={[styles.statSuffix, { color: P.textFaint }]}>{valueSuffix}</Text>
        )}
      </View>
      <Text style={[styles.statLabel, { color: P.textFaint }]}>{label.toUpperCase()}</Text>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        4,
    paddingBottom:     18,
    gap:               12,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
  },
  title: {
    fontSize:      30,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },

  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },

  // ─── Stat tiles ──
  statsRow: {
    flexDirection: 'row',
    gap:           10,
  },
  statTile: {
    flex:       1,
    alignItems: 'flex-start',
    gap:        10,
  },
  statValue: {
    fontSize:      24,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },
  statSuffix: {
    fontSize:   11,
    fontWeight: '700',
  },
  statLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  // ─── Card chrome ──
  headRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  16,
  },
  cardEyebrow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  4,
  },
  cardTitle: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  trendPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      999,
  },
  trendText: {
    fontSize:   10,
    fontWeight: '800',
  },
  iconTile: {
    width: 36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ─── Consistency row ──
  consistencyRow: {
    flexDirection: 'row',
    gap:           8,
  },
  consistencyCol: {
    flex:       1,
    alignItems: 'center',
    gap:        8,
  },
  consistencyCell: {
    width:           '100%',
    aspectRatio:     0.85,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  consistencyLabel: {
    fontSize:   11,
    fontWeight: '700',
  },

  // ─── Calories bar chart ──
  goalLegend: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  dashLine: {
    width:          16,
    borderTopWidth: 1,
    borderStyle:    'dashed',
  },
  goalLegendText: {
    fontSize:   10,
    fontWeight: '700',
  },
  barChart: {
    flexDirection: 'row',
    height:        128,
    gap:           6,
    alignItems:    'flex-end',
  },
  barCol: {
    flex:       1,
    alignItems: 'center',
    gap:        8,
  },
  barWrap: {
    flex:           1,
    width:          '100%',
    justifyContent: 'flex-end',
    position:       'relative',
  },
  bar: {
    width:        '100%',
    borderRadius: 5,
    minHeight:    4,
  },
  goalLine: {
    position:      'absolute',
    left:          0,
    right:         0,
    borderTopWidth:1,
    borderStyle:   'dashed',
  },
  barDay: {
    fontSize:   11,
    fontWeight: '600',
  },

  // ─── Weight card ──
  weightChart: {
    flexDirection: 'row',
    height:        72,
    alignItems:    'flex-end',
    gap:           2,
    marginBottom:  14,
  },
  weightCol: {
    flex:       1,
    alignItems: 'center',
  },
  weightColInner: {
    width:  '100%',
    height: 60,
    position: 'relative',
  },
  weightDot: {
    position: 'absolute',
    left:     '50%',
    marginLeft: -5,
  },
  weightDate: {
    fontSize:   9,
    fontWeight: '600',
    marginTop:  4,
  },
  weightFoot: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  weightNum: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.7,
  },
  weightUnit: {
    fontSize:   13,
    fontWeight: '600',
  },
  weightNote: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },

  // ─── Mirror promo ──
  mirrorCard: {
    padding:  22,
    overflow: 'hidden',
    position: 'relative',
  },
  mirrorGlow: {
    position:     'absolute',
    top:          -60,
    right:        -80,
    width:        220,
    height:       220,
    borderRadius: 110,
  },
  premiumPill: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    marginBottom:      12,
  },
  premiumPillText: {
    color:         '#fff',
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  mirrorTitle: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.6,
    color:         '#fff',
    marginBottom:  6,
  },
  mirrorSub: {
    fontSize:      13,
    fontWeight:    '500',
    lineHeight:    19,
    color:         'rgba(255,255,255,0.85)',
    marginBottom:  16,
  },
  mirrorFoot: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  mirrorItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  mirrorFootLabel: {
    fontSize:   11,
    fontWeight: '700',
    color:      'rgba(255,255,255,0.9)',
  },
  mirrorCta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      10,
    marginLeft:        'auto',
  },
  mirrorCtaText: {
    fontSize:   12,
    fontWeight: '800',
  },
});
