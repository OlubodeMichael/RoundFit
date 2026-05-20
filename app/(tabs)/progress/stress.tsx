import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { usePalette } from '@/lib/log-theme';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/context/recovery-context';
import { getHealthKitModule, readIntradayHRVSamples, type HRVSample } from '@/utils/healthkit';

// ── Constants ──────────────────────────────────────────────────────────────

const RING_R      = 48;
const RING_SIZE   = 140;
const RING_CX     = RING_SIZE / 2;
const RING_CY     = RING_SIZE / 2;
const RING_CIRC   = 2 * Math.PI * RING_R;
const ARC_LEN     = 0.75 * RING_CIRC;   // 270° arc
const GAP_LEN     = 0.25 * RING_CIRC;   // 90° gap at bottom
const RING_ROTATE = 135;                 // rotate so gap is centered at bottom

const CURVE_COLOR  = '#7C3AED';          // violet — stress curve
const CURVE_HEIGHT = 100;
const C_PAD        = 8;

// ── Helpers ────────────────────────────────────────────────────────────────

function hrvToStress(hrv: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - (hrv / 120) * 100)));
}

interface StressPoint { time: Date; hrv: number; stress: number }

type Zone = 'CALM' | 'BALANCED' | 'ELEVATED' | 'HIGH' | 'PEAK';

function getZone(score: number): Zone {
  if (score <= 25) return 'CALM';
  if (score <= 45) return 'BALANCED';
  if (score <= 65) return 'ELEVATED';
  if (score <= 80) return 'HIGH';
  return 'PEAK';
}

function zoneColor(zone: Zone, P: ReturnType<typeof usePalette>): string {
  switch (zone) {
    case 'CALM':     return P.protein;
    case 'BALANCED': return P.carbs;
    case 'ELEVATED': return P.calories;
    case 'HIGH':     return P.calories;
    case 'PEAK':     return P.danger;
  }
}

function zoneGlowColor(zone: Zone): string {
  switch (zone) {
    case 'CALM':     return '#10B981';
    case 'BALANCED': return '#F59E0B';
    case 'ELEVATED': return '#F97316';
    case 'HIGH':     return '#EF4444';
    case 'PEAK':     return '#DC2626';
  }
}

function heroHeadline(zone: Zone): string {
  switch (zone) {
    case 'CALM':     return "You're calm";
    case 'BALANCED': return "You're balanced";
    case 'ELEVATED': return "Slightly elevated";
    case 'HIGH':     return "High stress";
    case 'PEAK':     return "Peak stress";
  }
}

function heroCopy(zone: Zone): string {
  switch (zone) {
    case 'CALM':     return 'Recovery complete. Great day to train hard.';
    case 'BALANCED': return 'HRV trending up. A short walk would lock it in.';
    case 'ELEVATED': return 'Physiological load building. Moderate your intensity.';
    case 'HIGH':     return 'Prioritise recovery today. Light movement only.';
    case 'PEAK':     return 'Rest is the best workout today. Sleep and breathe.';
  }
}

function fmtSleep(h: number): string {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${String(mins).padStart(2, '0')}m` : `${hrs}h`;
}

function fmtHour(date: Date): string {
  const h = date.getHours();
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function hourAxisLabel(h: number): string {
  if (h === 0)  return '12A';
  if (h === 12) return '12P';
  return h < 12 ? `${h}A` : `${h - 12}P`;
}

// ── SVG curve helpers ──────────────────────────────────────────────────────

function buildLine(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function buildFill(pts: { x: number; y: number }[], h: number): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${h} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${h} Z`;
  return d;
}

// ── Horseshoe ring ─────────────────────────────────────────────────────────

function HorseshoeRing({
  score,
  zone,
  color,
  trackColor,
}: {
  score:      number | null;
  zone:       Zone | null;
  color:      string;
  trackColor: string;
}) {
  const animScore = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (score == null) return;
    const id = animScore.addListener(({ value }) => setDisplayed(Math.round(value)));
    Animated.timing(animScore, {
      toValue:         score,
      duration:        1000,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => animScore.removeListener(id));
    return () => animScore.removeListener(id);
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillLen  = score != null ? ARC_LEN * (score / 100) : 0;
  const P        = usePalette();

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Track */}
        <Circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R}
          fill="none"
          stroke={trackColor}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${GAP_LEN}`}
          transform={`rotate(${RING_ROTATE}, ${RING_CX}, ${RING_CY})`}
        />
        {/* Fill */}
        {score != null && score > 0 && (
          <Circle
            cx={RING_CX}
            cy={RING_CY}
            r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${RING_CIRC - fillLen}`}
            transform={`rotate(${RING_ROTATE}, ${RING_CX}, ${RING_CY})`}
          />
        )}
      </Svg>

      {/* Overlaid content */}
      <View style={[StyleSheet.absoluteFillObject, ringStyles.inner]}>
        <Text style={[ringStyles.eyebrow, { color: P.textFaint }]}>STRESS</Text>
        <Text style={[ringStyles.score, { color: P.text }]}>
          {score != null ? displayed : '—'}
        </Text>
      </View>

      {/* Zone pill in the gap at bottom */}
      {zone != null && (
        <View style={[ringStyles.pilWrap]}>
          <View style={[ringStyles.pill, { backgroundColor: color + '28' }]}>
            <Text style={[ringStyles.pillText, { color }]}>{zone}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  inner: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingBottom:  10,
  },
  eyebrow: {
    fontSize:      8,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  2,
  },
  score: {
    fontFamily:    'Syne_700Bold',
    fontSize:      40,
    fontWeight:    '800',
    letterSpacing: -1.5,
    lineHeight:    44,
  },
  pilWrap: {
    position:  'absolute',
    bottom:    10,
    left:      0,
    right:     0,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical:   3,
    borderRadius:      6,
  },
  pillText: {
    fontSize:      8,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
});

// ── Main screen ────────────────────────────────────────────────────────────

export default function StressScreen() {
  const P      = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { today: healthToday }                          = useHealth();
  const { computed, hrvBaseline, restingHrBaseline }    = useRecovery();

  const [chartW,       setChartW]       = useState(0);
  const [stressPoints, setStressPoints] = useState<StressPoint[]>([]);
  const [loadingCurve, setLoadingCurve] = useState(true);

  // ── Load intraday HRV ──────────────────────────────────────────────────
  const loadCurve = useCallback(async () => {
    setLoadingCurve(true);
    try {
      const hk = getHealthKitModule();
      if (!hk) { setLoadingCurve(false); return; }
      const now      = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const samples: HRVSample[] = await readIntradayHRVSamples(hk, midnight, now);
      setStressPoints(
        samples.map((s) => ({
          time:   new Date(s.time),
          hrv:    s.hrv,
          stress: hrvToStress(s.hrv),
        })),
      );
    } catch { /* HealthKit unavailable */ }
    finally { setLoadingCurve(false); }
  }, []);

  useEffect(() => { void loadCurve(); }, [loadCurve]);

  // ── Derived ────────────────────────────────────────────────────────────
  const stressScore = healthToday?.stress_score ?? null;
  const currentHrv  = healthToday?.hrv           ?? null;
  const currentRhr  = healthToday?.resting_heart_rate ?? null;
  const sleepHours  = healthToday?.sleep_hours    ?? null;
  const sleepScore  = computed?.sleep_score       ?? null;

  const zone       = stressScore != null ? getZone(stressScore) : null;
  const scoreColor = zone != null ? zoneColor(zone, P) : P.textFaint;
  const glowColor  = zone != null ? zoneGlowColor(zone) : '#F59E0B';

  const now      = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const totalMs  = Math.max(now.getTime() - midnight.getTime(), 1);

  const avgStress = stressPoints.length > 0
    ? Math.round(stressPoints.reduce((s, p) => s + p.stress, 0) / stressPoints.length)
    : null;
  const peakPoint = stressPoints.length > 0
    ? stressPoints.reduce((mx, p) => p.stress > mx.stress ? p : mx, stressPoints[0])
    : null;

  // ── SVG chart points ───────────────────────────────────────────────────
  const svgPoints = (() => {
    if (!chartW || stressPoints.length < 2) return [];
    const cH = CURVE_HEIGHT - C_PAD * 2;
    return stressPoints.map((p) => ({
      x: ((p.time.getTime() - midnight.getTime()) / totalMs) * chartW,
      y: C_PAD + (1 - p.stress / 100) * cH,
    }));
  })();

  const curveLine = buildLine(svgPoints);
  const curveFill = buildFill(svgPoints, CURVE_HEIGHT);

  // ── Formatted date header ──────────────────────────────────────────────
  const dayLabel = now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dateLabel = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();

  // ── Factor rows ────────────────────────────────────────────────────────
  const sleepZone: Zone | null =
    sleepScore == null  ? null
    : sleepScore >= 70  ? 'CALM'
    : sleepScore >= 50  ? 'BALANCED'
    : sleepScore >= 35  ? 'ELEVATED'
    : 'HIGH';

  const hrvDelta   = currentHrv != null && hrvBaseline != null
    ? Math.round(currentHrv - hrvBaseline)
    : null;
  const hrvZone: Zone | null =
    currentHrv == null  ? null
    : currentHrv >= 60  ? 'CALM'
    : currentHrv >= 40  ? 'BALANCED'
    : currentHrv >= 25  ? 'ELEVATED'
    : 'HIGH';

  const rhrZone: Zone | null =
    currentRhr == null          ? null
    : restingHrBaseline == null ? null
    : currentRhr <= restingHrBaseline * 0.97 ? 'CALM'
    : currentRhr <= restingHrBaseline * 1.05 ? 'BALANCED'
    : currentRhr <= restingHrBaseline * 1.12 ? 'ELEVATED'
    : 'HIGH';

  const rhrDesc =
    rhrZone === 'CALM'     ? 'below your baseline'
    : rhrZone === 'ELEVATED' ? 'slightly elevated'
    : rhrZone === 'HIGH'     ? 'elevated'
    : 'within normal range';

  // Tick hours for time axis
  const tickHours = [0, 6, 12, 18].filter((h) => h * 3_600_000 <= totalMs);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 4,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={ss.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [ss.backBtn, { borderColor: P.cardEdge }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={18} color={P.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[ss.dateEyebrow, { color: P.textFaint }]}>{dayLabel} · {dateLabel}</Text>
            <Text style={[ss.title, { color: P.text }]}>Stress</Text>
          </View>
          <Pressable
            style={[ss.infoBtn, { borderColor: P.cardEdge }]}
            onPress={() => {/* future: info modal */}}
          >
            <Ionicons name="information-circle-outline" size={20} color={P.textFaint} />
          </Pressable>
        </View>

        <View style={ss.stack}>
          {/* ── Hero card ───────────────────────────────────────── */}
          <View
            style={[
              ss.heroCard,
              { backgroundColor: P.card, borderColor: P.cardEdge },
              Platform.select({
                ios:     { shadowColor: '#000', shadowOpacity: P.isDark ? 0.3 : 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
                android: { elevation: 4 },
              }),
            ]}
          >
            {/* Warm glow overlay at bottom */}
            <LinearGradient
              colors={['transparent', glowColor + '30']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
              pointerEvents="none"
            />

            <View style={ss.heroRow}>
              {/* Left: Ring */}
              <HorseshoeRing
                score={stressScore}
                zone={zone}
                color={scoreColor}
                trackColor={P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
              />

              {/* Right: Copy */}
              <View style={ss.heroRight}>
                <Text style={[ss.rightNow, { color: P.textFaint }]}>RIGHT NOW</Text>
                <Text style={[ss.headline, { color: P.text }]}>
                  {zone ? heroHeadline(zone) : 'No data yet'}
                </Text>
                <Text style={[ss.heroCopy, { color: P.textFaint }]}>
                  {zone ? heroCopy(zone) : 'Sync Apple Health to see your stress level.'}
                </Text>
                <View style={[ss.liveBadge, { backgroundColor: P.proteinSoft }]}>
                  <View style={[ss.liveDot, { backgroundColor: P.protein }]} />
                  <Text style={[ss.liveText, { color: P.protein }]}>LIVE</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── 24H Curve ───────────────────────────────────────── */}
          <View
            style={[
              ss.card,
              { backgroundColor: P.card, borderColor: P.cardEdge },
              Platform.select({
                ios:     { shadowColor: '#000', shadowOpacity: P.isDark ? 0.22 : 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
                android: { elevation: 2 },
              }),
            ]}
          >
            <View style={ss.curveHeader}>
              <Text style={[ss.curveTitle, { color: P.textFaint }]}>TODAY · 24H</Text>
              {(avgStress != null || peakPoint != null) && (
                <Text style={[ss.curveStats, { color: P.textFaint }]}>
                  {avgStress != null && `Avg ${avgStress}`}
                  {avgStress != null && peakPoint != null && ' · '}
                  {peakPoint != null && `Peak ${peakPoint.stress} at ${fmtHour(peakPoint.time)}`}
                </Text>
              )}
            </View>

            {loadingCurve ? (
              <View style={[ss.curvePlaceholder, { backgroundColor: P.sunken }]}>
                <Text style={{ fontSize: 12, color: P.textFaint }}>Loading…</Text>
              </View>
            ) : stressPoints.length < 2 ? (
              <View style={[ss.curvePlaceholder, { backgroundColor: P.sunken }]}>
                <Ionicons name="pulse-outline" size={22} color={P.textFaint} />
                <Text style={[ss.emptyText, { color: P.textFaint }]}>
                  {stressPoints.length === 1
                    ? 'One reading so far — check back later'
                    : 'No HRV readings yet today'}
                </Text>
              </View>
            ) : (
              <View
                style={{ height: CURVE_HEIGHT }}
                onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
              >
                {chartW > 0 && (
                  <Svg width={chartW} height={CURVE_HEIGHT}>
                    <Defs>
                      <SvgGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={CURVE_COLOR} stopOpacity={0.3} />
                        <Stop offset="1" stopColor={CURVE_COLOR} stopOpacity={0}   />
                      </SvgGradient>
                    </Defs>
                    <Path d={curveFill} fill="url(#cg)" />
                    <Path
                      d={curveLine}
                      fill="none"
                      stroke={CURVE_COLOR}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
            )}

            {/* Time axis */}
            <View style={ss.timeAxis}>
              {tickHours.map((h) => (
                <Text key={h} style={[ss.timeTick, { color: P.textFaint }]}>{hourAxisLabel(h)}</Text>
              ))}
              <Text style={[ss.timeTick, { color: P.textFaint }]}>Now</Text>
            </View>
          </View>

          {/* ── What's moving it ─────────────────────────────────── */}
          <View
            style={[
              ss.card,
              { backgroundColor: P.card, borderColor: P.cardEdge },
              Platform.select({
                ios:     { shadowColor: '#000', shadowOpacity: P.isDark ? 0.22 : 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
                android: { elevation: 2 },
              }),
            ]}
          >
            <Text style={[ss.sectionTitle, { color: P.textFaint }]}>WHAT'S MOVING IT</Text>

            {/* Sleep */}
            {sleepHours != null && (
              <FactorRow
                iconName="moon"
                iconBg={P.isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)'}
                iconColor="#6366F1"
                label="Sleep last night"
                sub={`${fmtSleep(sleepHours)} · ${sleepHours >= 7.5 ? 'on target' : `short of ${sleepHours < 7 ? '7h' : '7h 30m'} goal`}`}
                rightVal={sleepScore != null ? String(Math.round(sleepScore)) : null}
                zone={sleepZone}
                palette={P}
                isLast={currentHrv == null && currentRhr == null}
              />
            )}

            {/* HRV */}
            {currentHrv != null && (
              <FactorRow
                iconName="pulse"
                iconBg={P.isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.12)'}
                iconColor="#10B981"
                label="HRV"
                sub={`${Math.round(currentHrv)} ms${hrvDelta != null ? ` · ${hrvDelta >= 0 ? '↑' : '↓'} ${Math.abs(hrvDelta)} vs avg` : ''}`}
                rightArrow={hrvDelta != null ? (hrvDelta >= 0 ? 'up' : 'down') : null}
                zone={hrvZone}
                palette={P}
                isLast={currentRhr == null}
              />
            )}

            {/* RHR */}
            {currentRhr != null && (
              <FactorRow
                iconName="timer-outline"
                iconBg={P.isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.12)'}
                iconColor="#F59E0B"
                label="Resting HR"
                sub={`${Math.round(currentRhr)} bpm · ${rhrDesc}`}
                rightVal={String(Math.round(currentRhr))}
                zone={rhrZone}
                palette={P}
                isLast
              />
            )}

            {sleepHours == null && currentHrv == null && currentRhr == null && (
              <Text style={[ss.emptyText, { color: P.textFaint, marginTop: 4 }]}>
                Sync Apple Health to see stress factors
              </Text>
            )}
          </View>

          {/* ── Reset tips ───────────────────────────────────────── */}
          <View
            style={[
              ss.card,
              { backgroundColor: P.card, borderColor: P.cardEdge },
              Platform.select({
                ios:     { shadowColor: '#000', shadowOpacity: P.isDark ? 0.22 : 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
                android: { elevation: 2 },
              }),
            ]}
          >
            <Text style={[ss.sectionTitle, { color: P.textFaint }]}>RESET IN 5 MIN OR LESS</Text>
            {RESET_TIPS.map((t, i) => (
              <View
                key={i}
                style={[
                  ss.tipRow,
                  i < RESET_TIPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair },
                ]}
              >
                <View style={[ss.tipIcon, { backgroundColor: P.proteinSoft }]}>
                  <Ionicons name={t.icon as any} size={14} color={P.protein} />
                </View>
                <Text style={[ss.tipText, { color: P.text }]}>{t.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const RESET_TIPS = [
  { icon: 'leaf-outline',        text: 'Box breathing  (4-4-4-4)' },
  { icon: 'walk-outline',        text: '5-min walk outside'        },
  { icon: 'water-outline',       text: 'Cold water on wrists/face' },
  { icon: 'body-outline',        text: 'Progressive muscle relax'  },
];

// ── Factor row ─────────────────────────────────────────────────────────────

function FactorRow({
  iconName, iconBg, iconColor, label, sub,
  rightVal, rightArrow, zone, palette, isLast,
}: {
  iconName:    string;
  iconBg:      string;
  iconColor:   string;
  label:       string;
  sub:         string;
  rightVal?:   string | null;
  rightArrow?: 'up' | 'down' | null;
  zone:        Zone | null;
  palette:     ReturnType<typeof usePalette>;
  isLast:      boolean;
}) {
  const P    = palette;
  const zc   = zone != null ? zoneColor(zone, P) : P.textFaint;
  const zcBg = zone != null ? zoneColor(zone, P) + '22' : P.sunken;

  return (
    <View
      style={[
        ss.factorRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair },
      ]}
    >
      <View style={[ss.factorIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={15} color={iconColor} />
      </View>

      <View style={ss.factorMid}>
        <Text style={[ss.factorLabel, { color: P.text }]}>{label}</Text>
        <Text style={[ss.factorSub,   { color: P.textFaint }]} numberOfLines={1}>{sub}</Text>
      </View>

      <View style={ss.factorRight}>
        {rightArrow != null && (
          <Ionicons
            name={rightArrow === 'up' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={rightArrow === 'up' ? P.protein : P.calories}
          />
        )}
        {rightVal != null && (
          <Text style={[ss.factorVal, { color: P.text }]}>{rightVal}</Text>
        )}
        {zone != null && (
          <View style={[ss.zonePill, { backgroundColor: zcBg }]}>
            <Text style={[ss.zonePillText, { color: zc }]}>{zone}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        8,
    paddingBottom:     14,
    gap:               12,
  },
  backBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    borderWidth:    StyleSheet.hairlineWidth,
    alignItems:     'center',
    justifyContent: 'center',
  },
  infoBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    borderWidth:    StyleSheet.hairlineWidth,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dateEyebrow: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.6,
    marginBottom:  2,
  },
  title: {
    fontFamily:    'Syne_700Bold',
    fontSize:      30,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },

  stack: {
    paddingHorizontal: 20,
    gap:               12,
  },

  // Hero card
  heroCard: {
    borderRadius:   22,
    borderWidth:    StyleSheet.hairlineWidth,
    padding:        20,
    overflow:       'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  heroRight: {
    flex:       1,
    gap:        6,
  },
  rightNow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  headline: {
    fontFamily:    'Syne_700Bold',
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
    lineHeight:    26,
  },
  heroCopy: {
    fontSize:   12,
    fontWeight: '500',
    lineHeight: 17,
  },
  liveBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      999,
    alignSelf:         'flex-start',
    marginTop:         2,
  },
  liveDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  liveText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  // Generic card
  card: {
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     16,
  },

  // Curve card
  curveHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  curveTitle: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  curveStats: {
    fontSize:   11,
    fontWeight: '600',
  },
  curvePlaceholder: {
    height:         CURVE_HEIGHT,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  emptyText: {
    fontSize:   12,
    fontWeight: '500',
    textAlign:  'center',
  },
  timeAxis: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  timeTick: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.2,
  },

  // WHAT'S MOVING IT
  sectionTitle: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  10,
  },
  factorRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 12,
  },
  factorIcon: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  factorMid: {
    flex: 1,
    gap:  2,
  },
  factorLabel: {
    fontSize:   13,
    fontWeight: '700',
  },
  factorSub: {
    fontSize:   11,
    fontWeight: '500',
  },
  factorRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  factorVal: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  zonePill: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      6,
  },
  zonePillText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.0,
  },

  // Reset tips
  tipRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 11,
  },
  tipIcon: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tipText: {
    flex:       1,
    fontSize:   13,
    fontWeight: '500',
  },
});
