import { Platform, StyleSheet, Text, View } from 'react-native';

import { AnimatedCard } from '@/lib/log-theme';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';

const H_PAD = 20;

export interface RecoveryDayMetricsProps {
  rhr: number | null;
  hrv: number | null;
  sleepHours: number | null;
  rhrDelta: number | null;
  hrvDelta: number | null;
  sleepScore: number | null;
  palette: TrendPalette;
}

interface MetricColumnProps {
  label: string;
  value: string;
  unit: string;
  sub: string;
  subColor: string;
  hasValue: boolean;
  palette: TrendPalette;
  showDivider: boolean;
}

function MetricColumn({
  label,
  value,
  unit,
  sub,
  subColor,
  hasValue,
  palette,
  showDivider,
}: MetricColumnProps) {
  return (
    <>
      {showDivider && <View style={[styles.divider, { backgroundColor: palette.hair }]} />}
      <View style={styles.column}>
        <Text style={[styles.label, { color: palette.textFaint }]}>{label}</Text>
        <View style={styles.reading}>
          <Text style={[styles.value, { color: hasValue ? palette.text : palette.textFaint }]}>
            {value}
          </Text>
          <Text style={[styles.unit, { color: palette.textFaint }]}>{unit}</Text>
        </View>
        <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </>
  );
}

function fmtDelta(diff: number, unit: string): string {
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff} ${unit}`;
}

export function RecoveryDayMetrics({
  rhr,
  hrv,
  sleepHours,
  rhrDelta,
  hrvDelta,
  sleepScore,
  palette,
}: RecoveryDayMetricsProps) {
  const rhrSub = rhrDelta != null
    ? { text: `${fmtDelta(rhrDelta, 'bpm')} avg`, color: rhrDelta <= 0 ? palette.protein : palette.calories }
    : { text: '—', color: palette.textFaint };

  const hrvSub = hrvDelta != null
    ? { text: `${fmtDelta(hrvDelta, 'ms')} avg`, color: hrvDelta >= 0 ? palette.protein : palette.calories }
    : { text: '—', color: palette.textFaint };

  const sleepSub = sleepScore != null
    ? {
        text: `Score ${sleepScore}`,
        color: sleepScore >= 60 ? palette.protein : palette.calories,
      }
    : { text: '—', color: palette.textFaint };

  const sleepVal = sleepHours != null
    ? (sleepHours % 1 === 0 ? String(sleepHours) : sleepHours.toFixed(1))
    : '—';

  return (
    <AnimatedCard
      delay={120}
      padding={0}
      style={[styles.cardOuter, { marginHorizontal: H_PAD }]}
    >
      <View style={styles.cardInner}>
        <MetricColumn
          label="RHR"
          value={rhr != null ? String(Math.round(rhr)) : '—'}
          unit="bpm"
          sub={rhrSub.text}
          subColor={rhrSub.color}
          hasValue={rhr != null}
          palette={palette}
          showDivider={false}
        />
        <MetricColumn
          label="HRV"
          value={hrv != null ? String(Math.round(hrv)) : '—'}
          unit="ms"
          sub={hrvSub.text}
          subColor={hrvSub.color}
          hasValue={hrv != null}
          palette={palette}
          showDivider
        />
        <MetricColumn
          label="Sleep"
          value={sleepVal}
          unit="hrs"
          sub={sleepSub.text}
          subColor={sleepSub.color}
          hasValue={sleepHours != null}
          palette={palette}
          showDivider
        />
      </View>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 18,
    overflow:     'hidden',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOpacity: 0.2,
        shadowRadius:  14,
        shadowOffset:  { width: 0, height: 6 },
      },
      android: { elevation: 3 },
    }),
  },
  cardInner: {
    flexDirection:     'row',
    paddingVertical:   16,
    paddingHorizontal: 8,
  },
  column: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               5,
    paddingHorizontal: 4,
  },
  divider: {
    width:     StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  label: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  reading: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           3,
  },
  value: {
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.6,
    fontVariant:   ['tabular-nums'],
  },
  unit: {
    fontSize:   12,
    fontWeight: '500',
  },
  sub: {
    fontSize:   11,
    fontWeight: '500',
    minHeight:  14,
  },
});
