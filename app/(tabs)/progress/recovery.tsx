import { useWindowDimensions } from 'react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import Svg, { Circle } from 'react-native-svg';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dummy data ──────────────────────────────────────────────────────────────
const RECOVERY_SCORE = 74;
const SLEEP_SCORE    = 72;
const STRAIN_SCORE   = 91;

const FACTORS: {
  label:      string;
  icon:       IoniconName;
  value:      string;
  note:       string;
  status:     'good' | 'ok' | 'poor';
  ringScore?: number;
}[] = [
  { label: 'Sleep quality', icon: 'moon', value: '7h 25m', note: 'Deep sleep 22% · Bedtime 10:40 PM', status: 'good', ringScore: 78 },
  { label: 'HRV',           icon: 'pulse',             value: '52 ms',       note: '+4 ms above your 30-day avg',       status: 'good' },
  { label: 'Training load', icon: 'barbell-outline',   value: 'Moderate',    note: '3 sessions this week · 1 rest day', status: 'ok'   },
  { label: 'Nutrition',     icon: 'nutrition-outline', value: '98 g protein',note: 'Below your 140 g target yesterday', status: 'poor' },
];

const TREND      = [62, 70, 58, 74, 80, 74, 74];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const RECOMMENDATIONS: { icon: IoniconName; text: string }[] = [
  { icon: 'barbell-outline',    text: 'Strength or cardio at moderate–high intensity is a good fit today.' },
  { icon: 'nutrition-outline',  text: 'Prioritise protein — aim for 140 g to support muscle repair.' },
  { icon: 'moon-outline',       text: "Keep tonight's bedtime before 11 PM to maintain your streak." },
];

// ─── Mini ring (inline, factor rows) ─────────────────────────────────────────
function MiniRing({ score, color, size = 44, strokeWidth = 5 }: {
  score:        number;
  color:        string;
  size?:        number;
  strokeWidth?: number;
}) {
  const P    = usePalette();
  const r    = (size - strokeWidth) / 2;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={P.hair} strokeWidth={strokeWidth} />
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color }}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Ring gauge ──────────────────────────────────────────────────────────────
function RingGauge({
  score,
  label,
  color,
  size,
  strokeWidth = 11,
}: {
  score:       number;
  label:       string;
  color:       string;
  size:        number;
  strokeWidth?: number;
}) {
  const P    = usePalette();
  const r    = (size - strokeWidth) / 2;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={P.hair}
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <Circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${cx},${cy}`}
          />
        </Svg>

        {/* Centred score text — overlaid via absolute position */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.ringScore, { color: P.text }]}>{score}</Text>
            <Text style={[styles.ringOf,    { color: P.textFaint }]}>/100</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.ringLabel, { color: P.textFaint }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function RecoveryScreen() {
  const P       = usePalette();
  const pad     = useScreenPadding();
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const SLEEP_COLOR    = '#38BDF8';
  const accentRecovery = RECOVERY_SCORE >= 70 ? P.protein : RECOVERY_SCORE >= 40 ? P.carbs : P.calories;

  // Ring size: 3 rings + 2 gaps (24px each) inside horizontal padding (40px)
  const GAP      = 24;
  const ringSize = Math.floor((width - 40 - GAP * 2) / 3);

  const maxTrend = Math.max(...TREND, 1);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Today"
          title="Recovery"
          accent={accentRecovery}
        />

        <View style={styles.stack}>

          {/* ── Three ring gauges ────────────────────────────────── */}
          <AnimatedCard delay={60}>
            <View style={styles.ringsRow}>
              <RingGauge score={RECOVERY_SCORE} label="Recovery" color={P.protein}   size={ringSize} />
              <RingGauge score={SLEEP_SCORE}    label="Sleep"    color={SLEEP_COLOR}  size={ringSize} />
              <RingGauge score={STRAIN_SCORE}   label="Strain"   color={P.calories}   size={ringSize} />
            </View>
          </AnimatedCard>

          {/* ── 7-day trend ─────────────────────────────────────── */}
          <AnimatedCard delay={140}>
            <Text style={[styles.cardTitle, { color: P.text }]}>7-day trend</Text>
            <View style={styles.trendRow}>
              {TREND.map((v, i) => {
                const isToday   = i === TREND.length - 1;
                const barAccent = v >= 70 ? P.protein : v >= 40 ? P.carbs : P.calories;
                return (
                  <View key={i} style={styles.trendCol}>
                    <View style={styles.trendBarWrap}>
                      <View style={[styles.trendTrack, { backgroundColor: P.sunken }]} />
                      <View style={[styles.trendBar, {
                        height:          `${(v / maxTrend) * 100}%`,
                        backgroundColor: barAccent,
                        opacity:         isToday ? 1 : 0.5,
                      }]} />
                    </View>
                    <Text style={[styles.trendDayLabel, {
                      color:      isToday ? accentRecovery : P.textFaint,
                      fontWeight: isToday ? '800' : '600',
                    }]}>
                      {DAY_LABELS[i]}
                    </Text>
                    <Text style={[styles.trendVal, { color: P.textFaint }]}>{v}</Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Factor breakdown ────────────────────────────────── */}
          <AnimatedCard delay={210} padding={0}>
            {FACTORS.map((f, i) => {
              const col = f.status === 'good' ? P.protein : f.status === 'ok' ? P.carbs : P.calories;
              const bg  = f.status === 'good' ? P.proteinSoft : f.status === 'ok' ? P.carbsSoft : P.caloriesSoft;

              const ringColor = f.ringScore != null
                ? f.ringScore >= 70 ? P.protein : f.ringScore >= 40 ? P.carbs : P.calories
                : col;

              return (
                <View key={f.label}>
                  <View style={styles.factorRow}>
                    <View style={[styles.factorIcon, { backgroundColor: bg }]}>
                      <Ionicons name={f.icon} size={14} color={col} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.factorLabel, { color: P.text }]}>{f.label}</Text>
                      <Text style={[styles.factorNote,  { color: P.textFaint }]}>{f.note}</Text>
                    </View>
                    {f.ringScore != null ? (
                      <MiniRing score={f.ringScore} color={ringColor} />
                    ) : (
                      <Text style={[styles.factorValue, { color: col }]}>{f.value}</Text>
                    )}
                  </View>
                  {i < FACTORS.length - 1 && <View style={[styles.divider, { backgroundColor: P.hair }]} />}
                </View>
              );
            })}
          </AnimatedCard>

          {/* ── Recommendations ─────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: P.text }]}>Recommendations</Text>

          <AnimatedCard delay={280} padding={0}>
            {RECOMMENDATIONS.map((r, i) => (
              <View key={i}>
                <View style={styles.recRow}>
                  <View style={[styles.recIcon, { backgroundColor: P.proteinSoft }]}>
                    <Ionicons name={r.icon} size={14} color={P.protein} />
                  </View>
                  <Text style={[styles.recText, { color: P.text }]}>{r.text}</Text>
                </View>
                {i < RECOMMENDATIONS.length - 1 && <View style={[styles.divider, { backgroundColor: P.hair }]} />}
              </View>
            ))}
          </AnimatedCard>

          {/* ── Coming soon note ────────────────────────────────── */}
          <View style={[styles.dummyNote, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
            <Ionicons name="construct-outline" size={13} color={P.textFaint} />
            <Text style={[styles.dummyText, { color: P.textFaint }]}>
              Live readiness score coming soon — powered by RIS.
            </Text>
          </View>

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

  // ─── Rings ──
  ringsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            24,
    paddingVertical: 8,
  },
  ringScore: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -1,
  },
  ringOf: {
    fontSize:   11,
    fontWeight: '700',
    marginTop:  -2,
  },
  ringLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },

  // ─── Trend ──
  cardTitle: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    marginBottom:  14,
  },
  trendRow: {
    flexDirection: 'row',
    height:        100,
    gap:           6,
    alignItems:    'flex-end',
  },
  trendCol: {
    flex:       1,
    alignItems: 'center',
    gap:        5,
  },
  trendBarWrap: {
    flex:           1,
    width:          '100%',
    position:       'relative',
    justifyContent: 'flex-end',
  },
  trendTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
  },
  trendBar: {
    width:        '100%',
    borderRadius: 4,
    minHeight:    4,
  },
  trendDayLabel: {
    fontSize: 11,
  },
  trendVal: {
    fontSize:   9,
    fontWeight: '700',
  },

  // ─── Factors ──
  factorRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 18,
    paddingVertical:   16,
  },
  factorIcon: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  factorLabel: {
    fontSize:   14,
    fontWeight: '700',
  },
  factorNote: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },
  factorValue: {
    fontSize:   13,
    fontWeight: '800',
  },

  divider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 18,
  },

  // ─── Recommendations ──
  sectionTitle: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    marginTop:     4,
  },
  recRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               12,
    paddingHorizontal: 18,
    paddingVertical:   16,
  },
  recIcon: {
    width:          30,
    height:         30,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      1,
  },
  recText: {
    flex:       1,
    fontSize:   13,
    fontWeight: '600',
    lineHeight: 19,
  },

  // ─── Dummy note ──
  dummyNote: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   12,
    borderRadius:      12,
    borderWidth:       StyleSheet.hairlineWidth,
    marginTop:         4,
  },
  dummyText: {
    fontSize:   12,
    fontWeight: '500',
    flex:       1,
  },
});
