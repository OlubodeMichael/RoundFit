import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Circle } from 'react-native-svg';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import type { ReadinessFactor } from '@/types/readiness';
import { useHomeReadiness } from '@/hooks/use-home-readiness';
import { useRecovery } from '@/hooks/use-recovery';
import { useHealth } from '@/context/health-context';

const G   = 88;
const GC  = G / 2;
const GR  = G * 0.41;
const GSW = 7.5;
const GAS = 225;
const GAT = 270;
const GH  = Math.round(G * 0.78);

function degXY(deg: number) {
  const rad = deg * (Math.PI / 180);
  return { x: GC + GR * Math.sin(rad), y: GC - GR * Math.cos(rad) };
}

function arc(start: number, span: number) {
  const s = degXY(start);
  const e = degXY(start + span);
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${GR} ${GR} 0 ${span > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const HEADLINES: Record<string, string> = {
  'Train hard':    'Push it today',
  'Moderate':      'Steady effort',
  'Light workout': 'Take it easy',
  'Rest':          'Rest up today',
};

const LOAD_SHORT: Record<string, string> = {
  'Train hard':    'High',
  'Moderate':      'Mod.',
  'Light workout': 'Light',
  'Rest':          'Rest',
};

function proteinGrams(factor: ReadinessFactor | undefined): string {
  if (!factor?.value || factor.value === '—') return '–';
  const match = factor.value.match(/(\d+)\s*g/);
  if (match) return `${match[1]}g`;
  return factor.value.length > 8 ? factor.value.slice(0, 8) : factor.value;
}

interface StatColumnProps {
  label: string;
  value: string;
  unit?: string;
  badge?: string | null;
  badgeColor?: string;
  textColor: string;
  faintColor: string;
}

function StatColumn({
  label,
  value,
  unit,
  badge,
  badgeColor,
  textColor,
  faintColor,
}: StatColumnProps) {
  return (
    <View style={s.stat}>
      <Text style={[s.statLabel, { color: faintColor }]}>{label}</Text>
      <Text style={[s.statValue, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[s.statUnit, { color: unit ? faintColor : 'transparent' }]} numberOfLines={1}>
        {unit ?? ' '}
      </Text>
      <Text
        style={[s.statBadge, { color: badge != null ? (badgeColor ?? faintColor) : 'transparent' }]}
        numberOfLines={1}
      >
        {badge ?? ' '}
      </Text>
    </View>
  );
}

export interface ReadinessWidgetProps {
  delay?: number;
  /**
   * `home` — local compute only (no recovery API bundle).
   * `passive` — show recovery context after Progress tab has loaded it.
   */
  mode?: 'home' | 'passive';
}

export function ReadinessWidget({ delay = 0, mode = 'passive' }: ReadinessWidgetProps) {
  const router = useRouter();
  const P = usePalette();
  const homeDisplay = useHomeReadiness();
  const { display: recoveryDisplay, today } = useRecovery();
  const { today: healthToday } = useHealth();

  const display = mode === 'home' ? homeDisplay : recoveryDisplay;

  const score = display.score;
  if (score === null) return null;

  const GREEN = P.protein;
  const GREEN_GLOW = P.isDark ? 'rgba(52,211,153,0.18)' : 'rgba(16,185,129,0.12)';
  const TRACK_CLR = P.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  const sleepFactor = display.factors.find((f) => f.pillar === 'sleep');
  const fuelFactor = display.factors.find((f) => f.pillar === 'nutrition');

  const hrv = today?.hrv ?? healthToday?.hrv ?? null;
  const rhr = today?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null;
  const hrvTxt = hrv != null ? `HRV ${Math.round(hrv)} ms` : null;
  const rhrTxt = rhr != null ? `RHR ${Math.round(rhr)} bpm` : null;
  const subtitle = [hrvTxt, rhrTxt].filter(Boolean).join(' · ') || (display.reason ?? '');

  const headline = display.recommendation
    ? (HEADLINES[display.recommendation] ?? display.recommendation)
    : '–';

  const sleepHr = today?.sleep_hours ?? healthToday?.sleep_hours ?? null;
  const sleepLbl = sleepHr != null
    ? `${sleepHr % 1 === 0 ? sleepHr : sleepHr.toFixed(1)}h`
    : (sleepFactor?.value ?? '–');
  const sleepScr = display.sleepScore != null ? Math.round(display.sleepScore) : null;

  const loadLbl = display.recommendation ? (LOAD_SHORT[display.recommendation] ?? '–') : '–';
  const strainScr = display.strainScore != null ? Math.round(display.strainScore) : null;

  const fuelGrams = proteinGrams(fuelFactor);
  const fuelScr = fuelFactor != null ? Math.round(fuelFactor.score) : null;
  const fuelBad = fuelFactor?.status === 'poor';
  const fuelBadge = fuelScr != null ? (fuelBad ? `↓ ${fuelScr}` : String(fuelScr)) : null;

  const fillDeg = (score / 100) * GAT;
  const trackD = arc(GAS, GAT);
  const fillD = fillDeg > 1 ? arc(GAS, fillDeg) : null;
  const tipPt = fillDeg > 1 ? degXY(GAS + fillDeg) : null;

  return (
    <AnimatedCard delay={delay} padding={0} style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={() => router.push('/(tabs)/progress/recovery')}
        style={({ pressed }) => [{ borderRadius: 24 }, pressed && { opacity: 0.88 }]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -22,
            right: -22,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: GREEN_GLOW,
          }}
        />

        <View style={s.top}>
          <View style={{ width: G, height: GH, overflow: 'hidden' }}>
            <Svg width={G} height={G} style={{ position: 'absolute', top: 0 }}>
              <Path d={trackD} fill="none" stroke={TRACK_CLR} strokeWidth={GSW} strokeLinecap="round" />
              {fillD != null && (
                <Path d={fillD} fill="none" stroke={GREEN} strokeWidth={GSW} strokeLinecap="round" />
              )}
              {tipPt != null && (
                <Circle cx={tipPt.x} cy={tipPt.y} r={GSW / 2} fill={GREEN} />
              )}
            </Svg>
            <View style={s.gaugeCenter}>
              <Text style={[s.gaugeNum, { color: P.text }]}>{score}</Text>
              <Text style={[s.gaugeOf, { color: P.textFaint }]}>/100</Text>
            </View>
          </View>

          <View style={s.copy}>
            <View style={s.labelRow}>
              <View style={s.liveRow}>
                <View style={[s.liveDot, { backgroundColor: GREEN }]} />
                <Text style={[s.liveText, { color: GREEN }]}>READINESS · LIVE</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={P.textFaint} />
            </View>
            <Text style={[s.headline, { color: P.text }]} numberOfLines={1}>{headline}</Text>
            {!!subtitle && (
              <Text style={[s.subtitle, { color: P.textFaint }]} numberOfLines={2}>{subtitle}</Text>
            )}
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: P.hair }]} />

        <View style={s.bottom}>
          <StatColumn
            label="SLEEP"
            value={sleepLbl}
            badge={sleepScr != null ? String(sleepScr) : null}
            badgeColor={GREEN}
            textColor={P.text}
            faintColor={P.textFaint}
          />
          <View style={[s.vDivider, { backgroundColor: P.hair }]} />
          <StatColumn
            label="LOAD"
            value={loadLbl}
            badge={strainScr != null ? String(strainScr) : null}
            textColor={P.text}
            faintColor={P.textFaint}
          />
          <View style={[s.vDivider, { backgroundColor: P.hair }]} />
          <StatColumn
            label="FUEL"
            value={fuelGrams}
            unit="protein"
            badge={fuelBadge}
            badgeColor={fuelBad ? P.calories : P.textFaint}
            textColor={P.text}
            faintColor={P.textFaint}
          />
        </View>
      </Pressable>
    </AnimatedCard>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     14,
    gap:               14,
  },
  gaugeCenter: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  gaugeNum: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  gaugeOf: {
    fontSize:   9,
    fontWeight: '700',
    marginTop:  -3,
  },
  copy: {
    flex:    1,
    gap:     3,
    minWidth: 0,
  },
  labelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexShrink:    1,
  },
  liveText: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },
  liveDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  headline: {
    fontSize:      21,
    fontWeight:    '800',
    letterSpacing: -0.5,
    lineHeight:    25,
  },
  subtitle: {
    fontSize:   11,
    lineHeight: 15,
  },
  divider: {
    height:           StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  bottom: {
    flexDirection:     'row',
    alignItems:        'stretch',
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  stat: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-start',
    minWidth:       0,
    paddingHorizontal: 2,
    gap:            2,
  },
  statLabel: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.1,
  },
  statValue: {
    fontSize:      17,
    fontWeight:    '800',
    letterSpacing: -0.3,
    textAlign:     'center',
  },
  statUnit: {
    fontSize:   10,
    fontWeight: '600',
    textAlign:  'center',
    minHeight:  13,
  },
  statBadge: {
    fontSize:   11,
    fontWeight: '700',
    textAlign:  'center',
    minHeight:  14,
  },
  vDivider: {
    width:          StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
});
