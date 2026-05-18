import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Circle } from 'react-native-svg';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { useHomeReadiness } from '@/hooks/use-home-readiness';
import { useRecovery } from '@/hooks/use-recovery';
import { useHealth } from '@/context/health-context';

// ── Arc constants ──────────────────────────────────────────────────────────────

const G   = 88        // gauge diameter
const GC  = G / 2
const GR  = G * 0.41
const GSW = 7.5       // stroke width
const GAS = 225       // arc start (° clockwise from top)
const GAT = 270       // arc total span
const GH  = Math.round(G * 0.78)  // container height — clips bottom gap

function degXY(deg: number) {
  const rad = deg * (Math.PI / 180)
  return { x: GC + GR * Math.sin(rad), y: GC - GR * Math.cos(rad) }
}
function arc(start: number, span: number) {
  const s = degXY(start)
  const e = degXY(start + span)
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${GR} ${GR} 0 ${span > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

// ── Copy maps ──────────────────────────────────────────────────────────────────

const HEADLINES: Record<string, string> = {
  'Train hard':    'Push it today',
  'Moderate':      'Steady effort',
  'Light workout': 'Take it easy',
  'Rest':          'Rest up today',
}
const LOAD_SHORT: Record<string, string> = {
  'Train hard':    'High',
  'Moderate':      'Mod.',
  'Light workout': 'Light',
  'Rest':          'Rest',
}

// ── Widget ────────────────────────────────────────────────────────────────────

export interface ReadinessWidgetProps {
  delay?: number
  /** `home` = local compute from existing contexts; `full` = recovery API bundle. */
  mode?: 'home' | 'full'
}

export function ReadinessWidget({ delay = 0, mode = 'full' }: ReadinessWidgetProps) {
  const router = useRouter()
  const P      = usePalette()
  const homeDisplay = useHomeReadiness()
  const { display: fullDisplay, today, initialized, refresh } = useRecovery()
  const { today: healthToday } = useHealth()

  const display = mode === 'home' ? homeDisplay : fullDisplay

  useEffect(() => {
    if (mode === 'home') return
    if (!initialized) void refresh()
  }, [mode, initialized, refresh])

  const score = display.score
  if (score === null) return null

  // Theme
  const GREEN      = P.protein
  const GREEN_GLOW = P.isDark ? 'rgba(52,211,153,0.18)' : 'rgba(16,185,129,0.12)'
  const TRACK_CLR  = P.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'

  // Factors
  const sleepFactor = display.factors.find(f => f.pillar === 'sleep')
  const fuelFactor  = display.factors.find(f => f.pillar === 'nutrition')

  // HRV / RHR — recovery log wins, fall back to HealthKit
  const hrv = today?.hrv               ?? healthToday?.hrv               ?? null
  const rhr = today?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null
  const hrvTxt = hrv != null ? `HRV ${Math.round(hrv)} ms` : null
  const rhrTxt = rhr != null ? `RHR ${Math.round(rhr)} bpm` : null
  const subtitle = [hrvTxt, rhrTxt].filter(Boolean).join(' · ') || (display.reason ?? '')

  // Headline
  const headline = display.recommendation
    ? (HEADLINES[display.recommendation] ?? display.recommendation)
    : '–'

  // Bottom stats
  const sleepHr  = today?.sleep_hours ?? healthToday?.sleep_hours ?? null
  const sleepLbl = sleepHr != null
    ? `${sleepHr % 1 === 0 ? sleepHr : sleepHr.toFixed(1)}h`
    : (sleepFactor?.value ?? '–')
  const sleepScr = display.sleepScore != null ? Math.round(display.sleepScore) : null

  const loadLbl   = display.recommendation ? (LOAD_SHORT[display.recommendation] ?? '–') : '–'
  const strainScr = display.strainScore != null ? Math.round(display.strainScore) : null

  const fuelLbl = fuelFactor?.value ?? '–'
  const fuelScr = fuelFactor != null ? Math.round(fuelFactor.score) : null
  const fuelBad = fuelFactor?.status === 'poor'

  // Arc paths
  const fillDeg = (score / 100) * GAT
  const trackD  = arc(GAS, GAT)
  const fillD   = fillDeg > 1 ? arc(GAS, fillDeg) : null
  const tipPt   = fillDeg > 1 ? degXY(GAS + fillDeg) : null

  return (
    <AnimatedCard delay={delay} padding={0} style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={() => router.push('/(tabs)/progress/recovery')}
        style={({ pressed }) => [{ borderRadius: 24 }, pressed && { opacity: 0.88 }]}
      >
        {/* Green corner glow */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -22, right: -22,
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: GREEN_GLOW,
          }}
        />

        {/* ── Top: gauge + copy ─────────────────────────────────── */}
        <View style={s.top}>
          {/* Mini arc gauge */}
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

          {/* Copy */}
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
              <Text style={[s.subtitle, { color: P.textFaint }]} numberOfLines={1}>{subtitle}</Text>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: P.hair }]} />

        {/* ── Bottom: SLEEP · LOAD · FUEL ───────────────────────── */}
        <View style={s.bottom}>
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: P.textFaint }]}>SLEEP</Text>
            <View style={s.statValueRow}>
              <Text style={[s.statValue, { color: P.text }]}>{sleepLbl}</Text>
              {sleepScr != null && (
                <Text style={[s.statBadge, { color: GREEN }]}>{sleepScr}</Text>
              )}
            </View>
          </View>

          <View style={[s.vDivider, { backgroundColor: P.hair }]} />

          <View style={s.stat}>
            <Text style={[s.statLabel, { color: P.textFaint }]}>LOAD</Text>
            <View style={s.statValueRow}>
              <Text style={[s.statValue, { color: P.text }]}>{loadLbl}</Text>
              {strainScr != null && (
                <Text style={[s.statBadge, { color: P.textFaint }]}>{strainScr}</Text>
              )}
            </View>
          </View>

          <View style={[s.vDivider, { backgroundColor: P.hair }]} />

          <View style={s.stat}>
            <Text style={[s.statLabel, { color: P.textFaint }]}>FUEL</Text>
            <View style={s.statValueRow}>
              <Text style={[s.statValue, { color: P.text }]}>{fuelLbl}</Text>
              {fuelScr != null && (
                <Text style={[s.statBadge, { color: fuelBad ? P.calories : P.textFaint }]}>
                  {fuelBad ? '↓ ' : ''}{fuelScr}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </AnimatedCard>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    top:            0, left: 0, right: 0, bottom: 0,
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

  copy: { flex: 1, gap: 3 },
  labelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  liveText: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize:      21,
    fontWeight:    '800',
    letterSpacing: -0.5,
    lineHeight:    25,
  },
  subtitle: {
    fontSize: 11,
  },

  divider: {
    height:            StyleSheet.hairlineWidth,
    marginHorizontal:  16,
  },

  bottom: {
    flexDirection:     'row',
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  stat: { flex: 1 },
  statLabel: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.3,
    marginBottom:  3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  statValue: {
    fontSize:      17,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  statBadge: {
    fontSize:   11,
    fontWeight: '700',
  },
  vDivider: {
    width:         StyleSheet.hairlineWidth,
    marginVertical: 2,
    marginRight:   14,
  },
})
