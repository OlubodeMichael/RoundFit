import { useMemo } from 'react';
import {
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dummy data ─────────────────────────────────────────────────────────────
const STREAK        = 12;
const CONSISTENCY   = 84;
const GOALS_HIT     = 5;
const GOALS_TOTAL   = 7;

const CONSISTENCY_DAYS: { label: string; on: boolean; today?: boolean }[] = [
  { label: 'M', on: true  },
  { label: 'T', on: true  },
  { label: 'W', on: true  },
  { label: 'T', on: false },
  { label: 'F', on: true  },
  { label: 'S', on: true  },
  { label: 'S', on: true, today: true },
];

const CALS_GOAL = 2100;
const CALS_WEEK = [
  { day: 'M', cals: 1980 },
  { day: 'T', cals: 2200 },
  { day: 'W', cals: 1750 },
  { day: 'T', cals: 2050 },
  { day: 'F', cals: 1900 },
  { day: 'S', cals: 2310 },
  { day: 'S', cals: 1840 },
];

const WEIGHT_LOG = [
  { date: 'Apr 6',  kg: 82.4 },
  { date: 'Apr 7',  kg: 82.1 },
  { date: 'Apr 8',  kg: 81.9 },
  { date: 'Apr 9',  kg: 82.0 },
  { date: 'Apr 10', kg: 81.7 },
  { date: 'Apr 11', kg: 81.5 },
  { date: 'Apr 12', kg: 81.3 },
];

export default function ProgressScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const maxCals = useMemo(() => Math.max(...CALS_WEEK.map(d => d.cals), CALS_GOAL), []);
  const avgCals = useMemo(
    () => Math.round(CALS_WEEK.reduce((a, d) => a + d.cals, 0) / CALS_WEEK.length),
    [],
  );

  const weightMin    = useMemo(() => Math.min(...WEIGHT_LOG.map(d => d.kg)), []);
  const weightMax    = useMemo(() => Math.max(...WEIGHT_LOG.map(d => d.kg)), []);
  const weightRange  = weightMax - weightMin || 1;
  const weightDelta  = WEIGHT_LOG[WEIGHT_LOG.length - 1].kg - WEIGHT_LOG[0].kg;
  const currentKg    = WEIGHT_LOG[WEIGHT_LOG.length - 1].kg;
  const goalKg       = 78.0;

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
              value={`${STREAK}`}
            />
            <StatTile
              delay={110}
              icon="compass"
              label="Consistency"
              value={`${CONSISTENCY}`}
              valueSuffix="/100"
              accentColor={P.protein}
            />
            <StatTile
              delay={160}
              icon="trophy"
              label="Goals met"
              value={`${GOALS_HIT}`}
              valueSuffix={`/${GOALS_TOTAL}`}
              accentColor={P.carbs}
            />
          </View>

          {/* ── Consistency index strip ────────────────────────── */}
          <AnimatedCard delay={220}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>CONSISTENCY INDEX</Text>
                <Text style={[styles.cardTitle, { color: P.text }]}>
                  {CONSISTENCY_DAYS.filter(d => d.on).length} of 7 days on target
                </Text>
              </View>
              <View style={[styles.trendPill, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="trending-up" size={11} color={P.protein} />
                <Text style={[styles.trendText, { color: P.protein }]}>+6</Text>
              </View>
            </View>

            <View style={styles.consistencyRow}>
              {CONSISTENCY_DAYS.map((d, i) => {
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

          {/* ── Calories bar chart ─────────────────────────────── */}
          <AnimatedCard delay={280}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>CALORIES</Text>
                <Text style={[styles.cardTitle, { color: P.text }]}>
                  Avg {avgCals.toLocaleString()}
                </Text>
              </View>
              <View style={styles.goalLegend}>
                <View style={[styles.dashLine, { borderColor: P.calories }]} />
                <Text style={[styles.goalLegendText, { color: P.textFaint }]}>
                  Goal {CALS_GOAL.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.barChart}>
              {CALS_WEEK.map((d, i) => {
                const pct      = d.cals / maxCals;
                const goalPct  = CALS_GOAL / maxCals;
                const isToday  = i === CALS_WEEK.length - 1;
                const over     = d.cals > CALS_GOAL;
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
          <AnimatedCard delay={340} padding={0}>
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
                  <Text style={[styles.cardEyebrow, { color: P.textFaint }]}>WEIGHT</Text>
                  <Text style={[styles.cardTitle, { color: P.text }]}>Trending down</Text>
                </View>
                <View style={[styles.trendPill, { backgroundColor: P.proteinSoft }]}>
                  <Ionicons name="trending-down" size={11} color={P.protein} />
                  <Text style={[styles.trendText, { color: P.protein }]}>
                    {weightDelta.toFixed(1)} kg
                  </Text>
                </View>
              </View>

              {/* Mini polyline chart using stacked dots + connecting lines (Views) */}
              <View style={styles.weightChart}>
                {WEIGHT_LOG.map((w, i) => {
                  const normalized = (w.kg - weightMin) / weightRange;
                  const bottom     = 6 + normalized * 48;
                  const isLatest   = i === WEIGHT_LOG.length - 1;
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
                        {w.date.split(' ')[1]}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.weightFoot}>
                <View>
                  <Text style={[styles.weightNum, { color: P.text }]}>
                    {currentKg.toFixed(1)}
                    <Text style={[styles.weightUnit, { color: P.textFaint }]}> kg</Text>
                  </Text>
                  <Text style={[styles.weightNote, { color: P.textFaint }]}>Current</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.weightNum, { color: P.text }]}>
                    −{Math.abs(weightDelta).toFixed(1)}
                    <Text style={[styles.weightUnit, { color: P.textFaint }]}> kg</Text>
                  </Text>
                  <Text style={[styles.weightNote, { color: P.textFaint }]}>7-day</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.weightNum, { color: P.text }]}>
                    {goalKg.toFixed(1)}
                    <Text style={[styles.weightUnit, { color: P.textFaint }]}> kg</Text>
                  </Text>
                  <Text style={[styles.weightNote, { color: P.textFaint }]}>Goal</Text>
                </View>
              </View>
            </Pressable>
          </AnimatedCard>

          {/* ── 30-day mirror promo ────────────────────────────── */}
          <AnimatedCard delay={420} padding={0} style={{ overflow: 'hidden' }}>
            <Pressable
              onPress={() => router.push('/(tabs)/progress/mirror')}
              style={({ pressed }) => [
                styles.mirrorCard,
                { backgroundColor: P.fat },
                pressed && { opacity: 0.92 },
              ]}
            >
              <View pointerEvents="none" style={[styles.mirrorGlow, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />

              <View style={[styles.premiumPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name="diamond" size={10} color="#fff" />
                <Text style={styles.premiumPillText}>PREMIUM</Text>
              </View>

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
