import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { usePalette } from '@/lib/log-theme';
import type { SessionRecapData } from '@/types/session-recap';
import type { SessionMetricsSource } from '@/utils/session-metrics';

export interface WorkoutSessionRecapSheetProps {
  visible: boolean;
  data: SessionRecapData | null;
  onDone: () => void;
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function caloriesSourceLabel(source: SessionMetricsSource): string {
  switch (source) {
    case 'healthkit':
      return 'Watch';
    case 'delta':
      return 'Health';
    case 'met':
      return 'Estimated';
  }
}

export function WorkoutSessionRecapSheet({
  visible,
  data,
  onDone,
}: WorkoutSessionRecapSheetProps) {
  const P = usePalette();

  if (!data) return null;

  const showVolume = data.isStrength && data.volumeKg != null && data.volumeKg > 0;
  const showGoal =
    !data.isStrength && data.goalPercent != null && data.goalPercent > 0;

  return (
    <AppModal visible={visible} onClose={onDone} sheetHeight={0.58}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: P.workoutSoft }]}>
            <Ionicons
              name={data.isStrength ? 'barbell-outline' : 'heart-outline'}
              size={28}
              color={P.workout}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>WORKOUT COMPLETE</Text>
            <Text style={[styles.title, { color: P.text }]} numberOfLines={2}>
              {data.workoutName}
            </Text>
          </View>
        </View>

        <View style={[styles.heroCard, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <Text style={[styles.heroLabel, { color: P.textFaint }]}>DURATION</Text>
          <Text style={[styles.heroValue, { color: P.text }]}>{formatDuration(data.durationMs)}</Text>
        </View>

        <View style={[styles.statsGrid, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <StatCell
            label="Calories"
            value={data.caloriesBurned > 0 ? `${data.caloriesBurned}` : '—'}
            suffix={data.caloriesBurned > 0 ? 'kcal' : undefined}
            badge={data.caloriesBurned > 0 ? caloriesSourceLabel(data.caloriesSource) : undefined}
            P={P}
          />
          <StatCell
            label="Avg HR"
            value={data.avgHeartRate != null ? `${data.avgHeartRate}` : '—'}
            suffix={data.avgHeartRate != null ? 'bpm' : undefined}
            P={P}
          />
          <StatCell
            label="Strain"
            value={data.strainScore != null ? `${data.strainScore}` : '—'}
            suffix={data.strainScore != null ? '/ 100' : undefined}
            P={P}
          />
          {showVolume && (
            <StatCell
              label="Volume"
              value={`${Math.round(data.volumeKg!)}`}
              suffix="kg"
              P={P}
            />
          )}
          {showGoal && (
            <StatCell
              label="Goal"
              value={`${Math.round(data.goalPercent!)}`}
              suffix="%"
              P={P}
            />
          )}
        </View>

        <Pressable
          onPress={onDone}
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: P.workout },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

function StatCell({
  label,
  value,
  suffix,
  badge,
  P,
}: {
  label: string;
  value: string;
  suffix?: string;
  badge?: string;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statLabel, { color: P.textFaint }]}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: P.text }]}>{value}</Text>
        {suffix != null && (
          <Text style={[styles.statSuffix, { color: P.textFaint }]}>{suffix}</Text>
        )}
      </View>
      {badge != null && (
        <View style={[styles.badge, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <Text style={[styles.badgeText, { color: P.textFaint }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 24, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  heroCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  statCell: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  statSuffix: { fontSize: 12, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  doneBtn: {
    marginTop: 'auto',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
