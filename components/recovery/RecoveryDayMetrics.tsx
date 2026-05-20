import { Platform, StyleSheet, Text, View } from 'react-native';

import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';

const H_PAD = 20;

export interface RecoveryDayMetricsProps {
  rhr:           number | null;
  hrv:           number | null;
  sleepHours:    number | null;
  rhrDelta:      number | null;
  hrvDelta:      number | null;
  sleepScore:    number | null;
  strain:        number | null;
  sorenessLevel: number | null;
  palette:       TrendPalette;
}

interface StatCardProps {
  label:      string;
  value:      string;
  valueUnit:  string;
  tag:        string;
  tagColor:   string;
  sub:        string;
  subColor:   string;
  palette:    TrendPalette;
}

function StatCard({ label, value, valueUnit, tag, tagColor, sub, subColor, palette }: StatCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.cardEdge },
        Platform.select({
          ios: {
            shadowColor:   '#000',
            shadowOpacity: palette.isDark ? 0.22 : 0.07,
            shadowRadius:  10,
            shadowOffset:  { width: 0, height: 2 },
          },
          android: { elevation: 2 },
        }),
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: palette.textFaint }]}>{label}</Text>
        <Text style={[styles.tag, { color: tagColor }]}>{tag}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {valueUnit.length > 0 && (
          <Text style={[styles.unit, { color: palette.textFaint }]}>{valueUnit}</Text>
        )}
      </View>

      <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function fmtDelta(diff: number, unit: string): string {
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff} ${unit} vs avg`;
}

function fmtSleep(h: number): string {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function strainZone(s: number): { tag: string; sub: string } {
  if (s >= 18) return { tag: 'MAX',  sub: 'All out'       };
  if (s >= 14) return { tag: 'HARD', sub: 'Hard training' };
  if (s >= 10) return { tag: 'MOD',  sub: 'Moderate'      };
  return              { tag: 'REC',  sub: 'Recovery'      };
}

function sorenessZone(s: number): { tag: string; sub: string } {
  if (s >= 9) return { tag: 'MAX',  sub: 'Severe soreness'   };
  if (s >= 7) return { tag: 'HIGH', sub: 'High soreness'     };
  if (s >= 4) return { tag: 'MOD',  sub: 'Moderate soreness' };
  return              { tag: 'LOW',  sub: 'Low soreness'      };
}

export function RecoveryDayMetrics({
  rhr, hrv, sleepHours, rhrDelta, hrvDelta, sleepScore, strain, sorenessLevel, palette,
}: RecoveryDayMetricsProps) {
  // ── SLEEP ────────────────────────────────────────────────────────────────────
  const sleepColor  = sleepScore != null
    ? (sleepScore >= 70 ? palette.protein : sleepScore >= 40 ? palette.carbs : palette.calories)
    : palette.textFaint;
  const sleepVal    = sleepHours != null ? fmtSleep(sleepHours) : '—';
  const sleepUnit   = sleepHours != null ? 'hrs' : '';
  const sleepTag    = sleepScore != null ? String(Math.round(sleepScore)) : '—';
  const sleepSub    = sleepScore != null
    ? (sleepScore >= 70 ? 'Good quality' : sleepScore >= 40 ? 'Fair quality' : 'Poor quality')
    : 'No data';

  // ── HRV ──────────────────────────────────────────────────────────────────────
  const hrvColor    = hrv != null
    ? (hrv >= 50 ? palette.protein : hrv >= 30 ? palette.carbs : palette.calories)
    : palette.textFaint;
  const rhrVal      = rhr != null ? String(Math.round(rhr)) : '—';
  const hrvTag      = hrv != null ? `${Math.round(hrv)} ms` : '—';
  const hrvSub      = hrvDelta != null
    ? fmtDelta(hrvDelta, 'ms')
    : (rhrDelta != null ? fmtDelta(rhrDelta, 'bpm') : 'No baseline');
  const hrvSubColor = hrvDelta != null
    ? (hrvDelta >= 0 ? palette.protein : palette.calories)
    : (rhrDelta != null ? (rhrDelta <= 0 ? palette.protein : palette.calories) : palette.textFaint);

  // ── STRAIN ───────────────────────────────────────────────────────────────────
  const strainColor = strain != null
    ? (strain < 10 ? palette.protein : strain < 14 ? palette.carbs : palette.calories)
    : palette.textFaint;
  const strainVal   = strain != null ? strain.toFixed(1) : '—';
  const strainUnit  = strain != null ? '/ 21' : '';
  const { tag: strainTag, sub: strainSub } = strain != null
    ? strainZone(strain)
    : { tag: '—', sub: 'No workout' };

  // ── SORENESS ─────────────────────────────────────────────────────────────────
  const sorenessColor = sorenessLevel != null
    ? (sorenessLevel <= 3 ? palette.protein : sorenessLevel <= 6 ? palette.carbs : palette.calories)
    : palette.textFaint;
  const sorenessVal   = sorenessLevel != null ? String(sorenessLevel) : '—';
  const sorenessUnit  = sorenessLevel != null ? '/ 10' : '';
  const { tag: sorenessTag, sub: sorenessSub } = sorenessLevel != null
    ? sorenessZone(sorenessLevel)
    : { tag: '—', sub: 'No workout data' };

  return (
    <View style={[styles.grid, { paddingHorizontal: H_PAD }]}>
      <View style={styles.row}>
        <StatCard
          label="SLEEP"
          value={sleepVal}
          valueUnit={sleepUnit}
          tag={sleepTag}
          tagColor={sleepColor}
          sub={sleepSub}
          subColor={sleepColor}
          palette={palette}
        />
        <StatCard
          label="HRV"
          value={rhrVal}
          valueUnit="bpm"
          tag={hrvTag}
          tagColor={hrvColor}
          sub={hrvSub}
          subColor={hrvSubColor}
          palette={palette}
        />
      </View>
      <View style={styles.row}>
        <StatCard
          label="STRAIN"
          value={strainVal}
          valueUnit={strainUnit}
          tag={strainTag}
          tagColor={strainColor}
          sub={strainSub}
          subColor={strainColor}
          palette={palette}
        />
        <StatCard
          label="SORENESS"
          value={sorenessVal}
          valueUnit={sorenessUnit}
          tag={sorenessTag}
          tagColor={sorenessColor}
          sub={sorenessSub}
          subColor={sorenessColor}
          palette={palette}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap:           10,
  },
  card: {
    flex:              1,
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop:        12,
    paddingBottom:     14,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  label: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tag: {
    fontSize:   10,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  value: {
    fontFamily:    'Syne_700Bold',
    fontSize:      26,
    fontWeight:    '800',
    letterSpacing: -1,
    lineHeight:    30,
  },
  unit: {
    fontSize:     11,
    fontWeight:   '500',
    marginBottom: 1,
  },
  sub: {
    fontSize:   10,
    fontWeight: '600',
    marginTop:  7,
    letterSpacing: 0.1,
  },
});
