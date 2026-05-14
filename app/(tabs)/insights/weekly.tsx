import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { useWeeklyInsights } from '@/hooks/use-weekly-insights';
import {
  formatWeekRange,
  getDayLetter,
  getDayName,
  formatSleepHours,
  formatDelta,
  getWeekStart,
} from '@/utils/insights-aggregator';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  return `${h}h ago`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyReportScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isRefreshing, isStale, error, refresh } =
    useWeeklyInsights(getWeekStart());

  // ── Loading (no cached data yet) ────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={P.calories} />
      </View>
    );
  }

  // ── Error (no data at all) ───────────────────────────────────────────────
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

  // ── Data ─────────────────────────────────────────────────────────────────
  const weekRange   = data ? formatWeekRange(data.week_start, data.week_end) : '';
  const consistency = data?.consistency_score ?? 0;
  const streak      = data?.streak ?? 0;

  const dayBars = (data?.days ?? []).map(d => ({
    label:  getDayLetter(d.date),
    score:  d.score,
    target: d.met_calories === 'met',
    empty:  d.is_partial,
  }));

  const targets = data?.targets_snapshot;
  const avgCalDelta = targets
    ? data!.avg_calories - targets.calorie_budget
    : null;
  const avgProtDelta = targets
    ? data!.avg_protein - targets.protein_target
    : null;
  const avgSleepDelta =
    data?.avg_sleep != null && targets?.sleep_target != null
      ? data.avg_sleep - targets.sleep_target
      : null;

  const averages = [
    {
      key:   'cals',
      label: 'Calories',
      value: data ? `${data.avg_calories.toLocaleString()}` : '—',
      delta: avgCalDelta != null ? `${formatDelta(avgCalDelta)} vs. target` : '—',
      icon:  'flame' as IoniconName,
      tint:  'calories' as const,
    },
    {
      key:   'protein',
      label: 'Protein',
      value: data ? `${data.avg_protein} g` : '—',
      delta: avgProtDelta != null ? `${formatDelta(avgProtDelta, 'g')} vs. target` : '—',
      icon:  'fitness' as IoniconName,
      tint:  'protein' as const,
    },
    {
      key:   'sleep',
      label: 'Sleep',
      value: formatSleepHours(data?.avg_sleep ?? null),
      delta: avgSleepDelta != null ? `${formatDelta(avgSleepDelta, 'h')} vs. target` : '—',
      icon:  'moon' as IoniconName,
      tint:  'sleep' as const,
    },
    {
      key:   'steps',
      label: 'Steps',
      value: data?.avg_steps != null ? `${Math.round(data.avg_steps).toLocaleString()}` : '—',
      delta: data?.avg_steps != null && targets?.steps_target != null
        ? `${formatDelta(data.avg_steps - targets.steps_target)} vs. target`
        : data?.avg_steps != null ? 'daily avg' : 'no data',
      icon:  'walk' as IoniconName,
      tint:  'fat' as const,
    },
  ];

  const bestDay = data?.best_day_date
    ? data.days.find(d => d.date === data.best_day_date)
    : null;

  const aiMessage = data?.weekly_insight_message;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={P.calories}
          />
        }
      >
        <ScreenHeader
          eyebrow="Weekly report"
          title="This week"
          accent={P.calories}
          right={
            <Pressable hitSlop={10} style={[styles.shareBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="share-outline" size={18} color={P.text} />
            </Pressable>
          }
        />

        {/* Stale badge */}
        {isStale && data && (
          <View style={[styles.staleBadge, { backgroundColor: P.sunken, marginHorizontal: 20, marginBottom: 8 }]}>
            <Ionicons name="time-outline" size={12} color={P.textFaint} />
            <Text style={[styles.staleText, { color: P.textFaint }]}>
              Updated {minutesAgo(data.last_computed_at)} · Pull to refresh
            </Text>
          </View>
        )}

        <View style={styles.stack}>
          {/* ── Consistency hero ────────────────────────────────── */}
          <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.caloriesSoft, top: -80, right: -60 }]} />

            <View style={styles.rangeRow}>
              <View style={[styles.miniPill, { backgroundColor: P.caloriesSoft }]}>
                <View style={[styles.dot, { backgroundColor: P.calories }]} />
                <Text style={[styles.miniPillText, { color: P.calories }]}>
                  {weekRange.toUpperCase()}
                </Text>
              </View>
              {streak > 0 && (
                <View style={[styles.streakPill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                  <Ionicons name="flame" size={11} color={P.calories} />
                  <Text style={[styles.streakText, { color: P.text }]}>{streak}-day streak</Text>
                </View>
              )}
            </View>

            <Text style={[styles.heroLabel, { color: P.textFaint }]}>CONSISTENCY</Text>
            <View style={styles.heroScoreRow}>
              <Text style={[styles.heroScore, { color: P.text }]}>{consistency}</Text>
              <Text style={[styles.heroScoreOf, { color: P.textFaint }]}>/ 100</Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: P.sunken }]}>
              <View style={[styles.progressFill, { width: `${consistency}%`, backgroundColor: P.calories }]} />
            </View>

            {/* Day bars */}
            <View style={styles.daysRow}>
              {dayBars.map((d, i) => {
                const pct   = d.score / 100;
                const color = d.empty ? P.textFaint : d.target ? P.protein : P.textFaint;
                return (
                  <View key={i} style={styles.dayCol}>
                    <View style={[styles.dayTrack, { backgroundColor: P.sunken }]}>
                      {!d.empty && (
                        <View
                          style={[
                            styles.dayFill,
                            { height: `${pct * 100}%`, backgroundColor: color, opacity: d.target ? 1 : 0.5 },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[styles.dayLabel, { color: P.textFaint }]}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Best day ────────────────────────────────────────── */}
          {bestDay && (
            <AnimatedCard delay={140}>
              <View style={styles.bestRow}>
                <View style={[styles.trophyTile, { backgroundColor: P.carbsSoft }]}>
                  <Ionicons name="trophy" size={18} color={P.carbs} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.smallLabel, { color: P.textFaint }]}>BEST DAY</Text>
                  <Text style={[styles.bestTitle, { color: P.text }]}>{getDayName(bestDay.date)}</Text>
                </View>
                <Text style={[styles.bestScore, { color: P.carbs }]}>{bestDay.score}</Text>
              </View>
              <Text style={[styles.bestReason, { color: P.textDim }]}>
                {[
                  bestDay.met_calories === 'met' ? 'Calories on target' : null,
                  bestDay.met_protein  === 'met' ? 'Protein hit' : null,
                  bestDay.workout_count > 0 ? `${bestDay.workout_count} workout` : null,
                  bestDay.sleep_hours != null ? `${formatSleepHours(bestDay.sleep_hours)} sleep` : null,
                ].filter(Boolean).join(' · ') || 'Your strongest day this week'}
              </Text>
            </AnimatedCard>
          )}

          {/* ── Averages grid ────────────────────────────────────── */}
          <AnimatedCard delay={220} padding={18}>
            <Text style={[styles.cardTitle, { color: P.text }]}>Averages</Text>
            <View style={styles.avgGrid}>
              {averages.map((a, i) => {
                const tint = P[a.tint];
                const soft = P[`${a.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;
                const isRightCol = i % 2 === 1;
                return (
                  <View key={a.key} style={[styles.avgCell, { borderColor: P.hair }, !isRightCol && styles.avgCellRightBorder]}>
                    <View style={[styles.avgIcon, { backgroundColor: soft }]}>
                      <Ionicons name={a.icon} size={14} color={tint} />
                    </View>
                    <Text style={[styles.avgLabel, { color: P.textFaint }]}>{a.label.toUpperCase()}</Text>
                    <Text style={[styles.avgValue, { color: P.text }]}>{a.value}</Text>
                    <Text style={[styles.avgDelta, { color: P.textDim }]}>{a.delta}</Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Days on target summary ───────────────────────────── */}
          {data && (
            <AnimatedCard delay={300}>
              <View style={styles.patternHead}>
                <View style={[styles.iconTile, { backgroundColor: P.proteinSoft }]}>
                  <Ionicons name="checkmark-circle" size={16} color={P.protein} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.smallLabel, { color: P.protein }]}>TARGET SUMMARY</Text>
                  <Text style={[styles.patternMeta, { color: P.textFaint }]}>
                    {data.days_met_calories} / {data.days.filter(d => !d.is_partial).length} days hit calorie target
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {[
                  { label: 'Calories',  met: data.days_met_calories, color: P.calories },
                  { label: 'Protein',   met: data.days_met_protein,  color: P.protein  },
                  { label: 'Steps',     met: data.days_met_steps,    color: P.fat,     skip: targets?.steps_target == null },
                  { label: 'Sleep',     met: data.days_met_sleep,    color: P.sleep,   skip: targets?.sleep_target == null && data.avg_sleep == null },
                ].filter(r => !r.skip).map(row => {
                  const logged = data.days.filter(d => !d.is_partial).length;
                  const pct    = logged > 0 ? row.met / logged : 0;
                  return (
                    <View key={row.label} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.patternMeta, { color: P.textDim }]}>{row.label}</Text>
                        <Text style={[styles.patternMeta, { color: P.textDim }]}>{row.met}/{logged}</Text>
                      </View>
                      <View style={[styles.confidenceTrack, { backgroundColor: P.sunken }]}>
                        <View style={[styles.confidenceFill, { width: `${pct * 100}%`, backgroundColor: row.color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </AnimatedCard>
          )}

          {/* ── Weekly insight message ──────────────────────────── */}
          {aiMessage ? (
            <AnimatedCard delay={380} style={{ overflow: 'hidden' }}>
              <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.fatSoft, top: -60, right: -80 }]} />

              <View style={styles.claudeHead}>
                <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
                  <Ionicons name="sparkles" size={16} color={P.fat} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.smallLabel, { color: P.fat }]}>RIS INSIGHT</Text>
                  <Text style={[styles.claudeMeta, { color: P.textFaint }]}>Based on this week's data</Text>
                </View>
              </View>

              <Text style={[styles.claudeBody, { color: P.text }]}>{aiMessage}</Text>
            </AnimatedCard>
          ) : isLoading ? null : (
            <AnimatedCard delay={380}>
              <View style={styles.claudeHead}>
                <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
                  <Ionicons name="sparkles-outline" size={16} color={P.textFaint} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.smallLabel, { color: P.textFaint }]}>RIS INSIGHT</Text>
                  <Text style={[styles.claudeMeta, { color: P.textFaint }]}>Log more days for a personalised insight</Text>
                </View>
              </View>
            </AnimatedCard>
          )}

          {/* ── Share button ─────────────────────────────────────── */}
          <Pressable style={({ pressed }) => [
            styles.shareCta,
            { backgroundColor: P.calories },
            pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
          ]}>
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.shareCtaText}>Share week</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },

  shareBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },

  staleBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      10,
  },
  staleText: {
    fontSize:   11,
    fontWeight: '500',
  },

  glow: {
    position:     'absolute',
    width:        240,
    height:       240,
    borderRadius: 120,
  },

  rangeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  16,
    gap:           10,
  },
  miniPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  miniPillText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  streakPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    borderWidth:       StyleSheet.hairlineWidth,
    marginLeft:        'auto',
  },
  streakText: {
    fontSize:   11,
    fontWeight: '700',
  },

  heroLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.8,
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           6,
    marginTop:     4,
    marginBottom:  12,
  },
  heroScore: {
    fontSize:      56,
    fontWeight:    '800',
    letterSpacing: -2.2,
    lineHeight:    58,
  },
  heroScoreOf: {
    fontSize:      13,
    fontWeight:    '700',
    paddingBottom: 10,
  },

  progressTrack: {
    height:       6,
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height:       '100%',
    borderRadius: 4,
  },

  daysRow: {
    flexDirection: 'row',
    gap:           6,
    height:        92,
    alignItems:    'flex-end',
  },
  dayCol: {
    flex:       1,
    alignItems: 'center',
    gap:        6,
  },
  dayTrack: {
    width:          '100%',
    height:         72,
    borderRadius:   6,
    justifyContent: 'flex-end',
    overflow:       'hidden',
  },
  dayFill: {
    width:        '100%',
    borderRadius: 6,
  },
  dayLabel: {
    fontSize:   10,
    fontWeight: '700',
  },

  bestRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  12,
  },
  trophyTile: {
    width: 40, height: 40, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  smallLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  bestTitle: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.4,
    marginTop:     3,
  },
  bestScore: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -1,
  },
  bestReason: {
    fontSize:   13,
    fontWeight: '500',
    lineHeight: 19,
  },

  cardTitle: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    marginBottom:  14,
  },
  avgGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },
  avgCell: {
    width:           '50%',
    paddingVertical: 10,
    gap:             4,
  },
  avgCellRightBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight:     12,
  },
  avgIcon: {
    width: 28, height: 28, borderRadius: 9,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   2,
  },
  avgLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.0,
  },
  avgValue: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  avgDelta: {
    fontSize:   11,
    fontWeight: '500',
  },

  patternHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  12,
  },
  iconTile: {
    width: 36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  patternMeta: {
    fontSize:   11,
    fontWeight: '500',
  },

  confidenceTrack: {
    height:       5,
    borderRadius: 3,
    overflow:     'hidden',
  },
  confidenceFill: {
    height:       '100%',
    borderRadius: 3,
  },

  claudeHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  12,
  },
  claudeMeta: {
    fontSize:   11,
    fontWeight: '500',
  },
  claudeBody: {
    fontSize:      14,
    fontWeight:    '500',
    lineHeight:    22,
    letterSpacing: -0.1,
  },

  shareCta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 16,
    borderRadius:    16,
    marginTop:       6,
  },
  shareCtaText: {
    color:         '#fff',
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
});
