import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dummy data ─────────────────────────────────────────────────────────────
const WEEK_RANGE     = 'April 12 — April 18';
const CONSISTENCY    = 78;
const STREAK         = 12;
const BEST_DAY       = {
  label:  'Wednesday',
  score:  96,
  reason: 'Protein target hit, 8 glasses of water, lifting + walk',
};
const DAYS = [
  { label: 'M', score: 82, target: true  },
  { label: 'T', score: 71, target: true  },
  { label: 'W', score: 96, target: true  },
  { label: 'T', score: 64, target: false },
  { label: 'F', score: 88, target: true  },
  { label: 'S', score: 74, target: true  },
  { label: 'S', score: 72, target: false },
];
const AVERAGES = [
  { key: 'cals',    label: 'Calories', value: '2,047',   delta: '+140 vs. target', icon: 'flame'            as IoniconName, tint: 'calories' as const },
  { key: 'protein', label: 'Protein',  value: '118 g',   delta: '−22 g vs. target', icon: 'fitness'         as IoniconName, tint: 'protein'  as const },
  { key: 'sleep',   label: 'Sleep',    value: '6h 48m',  delta: '−12 m vs. target', icon: 'moon'            as IoniconName, tint: 'sleep'    as const },
  { key: 'energy',  label: 'Energy',   value: '3.8 / 5', delta: '+0.4 vs. week 14', icon: 'battery-charging' as IoniconName, tint: 'fat'      as const },
];
const TOP_PATTERN = {
  title:      'Low-protein days → lower next-day energy',
  confidence: 0.82,
  supports:   4,
};
const AI_RECO = 'Front-load protein before noon on training days. Three out of four of your highest-energy mornings came after breakfasts over 32g of protein.';

export default function WeeklyReportScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Premium report"
          title="This week"
          accent={P.calories}
          right={
            <Pressable hitSlop={10} style={[styles.shareBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="share-outline" size={18} color={P.text} />
            </Pressable>
          }
        />

        <View style={styles.stack}>
          {/* ── Consistency hero ───────────────────────────────── */}
          <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.caloriesSoft, top: -80, right: -60 }]} />

            <View style={styles.rangeRow}>
              <View style={[styles.miniPill, { backgroundColor: P.caloriesSoft }]}>
                <View style={[styles.dot, { backgroundColor: P.calories }]} />
                <Text style={[styles.miniPillText, { color: P.calories }]}>{WEEK_RANGE.toUpperCase()}</Text>
              </View>
              <View style={[styles.streakPill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                <Ionicons name="flame" size={11} color={P.calories} />
                <Text style={[styles.streakText, { color: P.text }]}>{STREAK}-day streak</Text>
              </View>
            </View>

            <Text style={[styles.heroLabel, { color: P.textFaint }]}>CONSISTENCY</Text>
            <View style={styles.heroScoreRow}>
              <Text style={[styles.heroScore, { color: P.text }]}>{CONSISTENCY}</Text>
              <Text style={[styles.heroScoreOf, { color: P.textFaint }]}>/ 100</Text>
              <View style={[styles.trendPill, { backgroundColor: P.proteinSoft, marginLeft: 'auto' }]}>
                <Ionicons name="arrow-up" size={10} color={P.protein} />
                <Text style={[styles.trendText, { color: P.protein }]}>+6 vs. last week</Text>
              </View>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: P.sunken }]}>
              <View style={[styles.progressFill, { width: `${CONSISTENCY}%`, backgroundColor: P.calories }]} />
            </View>

            <View style={styles.daysRow}>
              {DAYS.map((d, i) => {
                const pct = d.score / 100;
                const color = d.target ? P.protein : P.textFaint;
                return (
                  <View key={i} style={styles.dayCol}>
                    <View style={[styles.dayTrack, { backgroundColor: P.sunken }]}>
                      <View
                        style={[
                          styles.dayFill,
                          {
                            height:          `${pct * 100}%`,
                            backgroundColor: color,
                            opacity:         d.target ? 1 : 0.5,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.dayLabel, { color: P.textFaint }]}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Best day ───────────────────────────────────────── */}
          <AnimatedCard delay={140}>
            <View style={styles.bestRow}>
              <View style={[styles.trophyTile, { backgroundColor: P.carbsSoft }]}>
                <Ionicons name="trophy" size={18} color={P.carbs} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.smallLabel, { color: P.textFaint }]}>BEST DAY</Text>
                <Text style={[styles.bestTitle, { color: P.text }]}>{BEST_DAY.label}</Text>
              </View>
              <Text style={[styles.bestScore, { color: P.carbs }]}>{BEST_DAY.score}</Text>
            </View>
            <Text style={[styles.bestReason, { color: P.textDim }]}>
              {BEST_DAY.reason}
            </Text>
          </AnimatedCard>

          {/* ── Averages grid ──────────────────────────────────── */}
          <AnimatedCard delay={220} padding={18}>
            <Text style={[styles.cardTitle, { color: P.text }]}>Averages</Text>
            <View style={styles.avgGrid}>
              {AVERAGES.map((a, i) => {
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

          {/* ── Top pattern ────────────────────────────────────── */}
          <AnimatedCard delay={300}>
            <View style={styles.patternHead}>
              <View style={[styles.iconTile, { backgroundColor: P.sleepSoft }]}>
                <Ionicons name="git-network" size={16} color={P.sleep} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.smallLabel, { color: P.sleep }]}>TOP PATTERN THIS WEEK</Text>
                <Text style={[styles.patternMeta, { color: P.textFaint }]}>
                  {TOP_PATTERN.supports} supporting days · {Math.round(TOP_PATTERN.confidence * 100)}% confidence
                </Text>
              </View>
            </View>

            <Text style={[styles.patternTitle, { color: P.text }]}>
              {TOP_PATTERN.title}
            </Text>

            <View style={[styles.confidenceTrack, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${TOP_PATTERN.confidence * 100}%`, backgroundColor: P.sleep },
                ]}
              />
            </View>
          </AnimatedCard>

          {/* ── Claude recommendation ──────────────────────────── */}
          <AnimatedCard delay={380} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.fatSoft, top: -60, right: -80 }]} />

            <View style={styles.claudeHead}>
              <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
                <Ionicons name="sparkles" size={16} color={P.fat} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.smallLabel, { color: P.fat }]}>AI RECOMMENDATION</Text>
                <Text style={[styles.claudeMeta, { color: P.textFaint }]}>Fresh from this week's data</Text>
              </View>
              <View style={[styles.aiBadge, { backgroundColor: P.fatSoft }]}>
                <Ionicons name="flash" size={10} color={P.fat} />
                <Text style={[styles.aiBadgeText, { color: P.fat }]}>CLAUDE</Text>
              </View>
            </View>

            <Text style={[styles.claudeBody, { color: P.text }]}>{AI_RECO}</Text>

            <Pressable style={({ pressed }) => [
              styles.claudeCta,
              { backgroundColor: P.sunken, borderColor: P.cardEdge },
              pressed && { opacity: 0.8 },
            ]}>
              <Ionicons name="bookmark-outline" size={14} color={P.text} />
              <Text style={[styles.claudeCtaText, { color: P.text }]}>Save to plan</Text>
            </Pressable>
          </AnimatedCard>

          {/* ── Share button ────────────────────────────────────── */}
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
    fontSize:   13,
    fontWeight: '700',
    paddingBottom: 10,
  },
  trendPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderRadius:      999,
    marginBottom:      8,
  },
  trendText: {
    fontSize:   10,
    fontWeight: '800',
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
    width:        '100%',
    height:       72,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow:     'hidden',
  },
  dayFill: {
    width:            '100%',
    borderRadius:     6,
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
  patternTitle: {
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.3,
    marginBottom:  12,
    lineHeight:    21,
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
  aiBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
  },
  aiBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 0.6,
  },
  claudeBody: {
    fontSize:      14,
    fontWeight:    '500',
    lineHeight:    22,
    letterSpacing: -0.1,
    marginBottom:  16,
  },
  claudeCta: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 12,
    paddingVertical:   9,
    borderRadius:      10,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  claudeCtaText: {
    fontSize:   12,
    fontWeight: '700',
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
