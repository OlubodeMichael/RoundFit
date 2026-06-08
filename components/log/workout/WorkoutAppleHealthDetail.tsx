import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WorkoutHeartRateChart } from '@/components/log/workout/WorkoutHeartRateChart';
import { formatWorkoutTimeRange } from '@/components/log/workout/workout-display';
import { getCatalogEntryForHealthKitActivity, getHealthKitActivityDisplayLabel } from '@/config/workout-catalog';
import { useHealthKitWorkoutEnrichment } from '@/hooks/use-healthkit-workout-enrichment';
import { usePalette } from '@/lib/log-theme';
import { formatHealthKitWorkoutDurationHms, type HealthKitWorkoutSample } from '@/utils/healthkit';
import { formatMonthDayLocal, localWeekdayLong } from '@/utils/date';

export interface WorkoutAppleHealthDetailProps {
  sample: HealthKitWorkoutSample;
  onSave?: () => void;
  isSaving?: boolean;
  savedWorkoutId?: string | null;
  onOpenSaved?: () => void;
}

interface MetricTileProps {
  label: string;
  value: string;
  accent: string;
}

function MetricTile({ label, value, accent }: MetricTileProps) {
  const P = usePalette();
  return (
    <View style={[styles.metricTile, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
      <Text style={[styles.metricLabel, { color: P.textFaint }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

export function WorkoutAppleHealthDetail({
  sample,
  onSave,
  isSaving = false,
  savedWorkoutId,
  onOpenSaved,
}: WorkoutAppleHealthDetailProps) {
  const P = usePalette();
  const catalogEntry = getCatalogEntryForHealthKitActivity(sample.workoutActivityType);
  const title = getHealthKitActivityDisplayLabel(sample.workoutActivityType);
  const { energy, heartRatePoints, isLoading } = useHealthKitWorkoutEnrichment(sample);

  const dateIso = sample.startDate.toISOString();
  const dateLabel = `${localWeekdayLong(dateIso)}, ${formatMonthDayLocal(dateIso)}`;
  const timeRange = formatWorkoutTimeRange(
    sample.startDate.toISOString(),
    sample.endDate.toISOString(),
  );

  const activeCalories = energy?.activeCalories
    ?? sample.caloriesBurned
    ?? 0;
  const totalCalories = energy?.totalCalories
    ?? (activeCalories > 0 ? Math.round(activeCalories * 1.15) : 0);
  const avgHeartRate = sample.avgHeartRate
    ?? (heartRatePoints.length > 0
      ? Math.round(heartRatePoints.reduce((sum, p) => sum + p.bpm, 0) / heartRatePoints.length)
      : null);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: P.workoutSoft }]}>
          <Ionicons name={catalogEntry.icon} size={32} color={P.workout} />
        </View>
        <Text style={[styles.date, { color: P.textFaint }]}>{dateLabel}</Text>
        <Text style={[styles.title, { color: P.text }]}>{title}</Text>
        {timeRange != null && (
          <Text style={[styles.timeRange, { color: P.textFaint }]}>{timeRange}</Text>
        )}
        <View style={styles.sourceRow}>
          <Ionicons name="heart" size={13} color={P.workout} />
          <Text style={[styles.source, { color: P.textFaint }]}>Apple Fitness</Text>
        </View>
      </View>

      <Text style={[styles.sectionHeading, { color: P.text }]}>Workout Details</Text>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={P.workout} />
        </View>
      ) : (
        <View style={styles.metricsGrid}>
          <MetricTile
            label="Workout Time"
            value={formatHealthKitWorkoutDurationHms(sample.durationSeconds)}
            accent="#EAB308"
          />
          <MetricTile
            label="Active Calories"
            value={`${Math.round(activeCalories)} CAL`}
            accent="#EF4444"
          />
          <MetricTile
            label="Total Calories"
            value={`${Math.round(totalCalories)} CAL`}
            accent="#EF4444"
          />
          {avgHeartRate != null && (
            <MetricTile
              label="Avg. Heart Rate"
              value={`${avgHeartRate} BPM`}
              accent="#EF4444"
            />
          )}
        </View>
      )}

      {heartRatePoints.length > 0 && (
        <WorkoutHeartRateChart points={heartRatePoints} />
      )}

      {savedWorkoutId != null && onOpenSaved != null ? (
        <Pressable
          onPress={onOpenSaved}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: P.workout },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.primaryBtnText}>View in workout log</Text>
        </Pressable>
      ) : onSave != null ? (
        <Pressable
          onPress={onSave}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: P.workout, opacity: isSaving ? 0.7 : 1 },
            pressed && !isSaving && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {isSaving ? 'Saving…' : 'Save to workout log'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 4 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  date: { fontSize: 13, fontWeight: '600' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  timeRange: { fontSize: 14, fontWeight: '600' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  source: { fontSize: 12, fontWeight: '700' },
  sectionHeading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  loadingRow: { paddingVertical: 24, alignItems: 'center' },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  metricLabel: { fontSize: 12, fontWeight: '700' },
  metricValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
