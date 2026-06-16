import { ScrollView } from 'react-native';

import { WorkoutAppleFitnessHeartRate } from '@/components/log/workout/WorkoutAppleFitnessHeartRate';
import { WorkoutAppleFitnessHero } from '@/components/log/workout/WorkoutAppleFitnessHero';
import {
  WorkoutAppleFitnessMetricBento,
  type AppleFitnessMetric,
} from '@/components/log/workout/WorkoutAppleFitnessMetricBento';
import { WorkoutAppleFitnessSkeleton } from '@/components/log/workout/WorkoutAppleFitnessSkeleton';
import { WorkoutDetailActions } from '@/components/log/workout/WorkoutDetailActions';
import { workoutDetailContentStyle } from '@/components/log/workout/workout-detail-layout';
import { formatWorkoutTimeRange } from '@/components/log/workout/workout-display';
import { getCatalogEntryForHealthKitActivity } from '@/config/workout-catalog';
import { useHealthKitWorkoutEnrichment } from '@/hooks/use-healthkit-workout-enrichment';
import { getWorkoutHeartRateWindow } from '@/utils/workout-heart-rate-window';
import type { HealthKitWorkoutSample } from '@/utils/healthkit';
import { formatMonthDayLocal, localWeekdayLong } from '@/utils/date';

export interface WorkoutAppleHealthDetailProps {
  sample: HealthKitWorkoutSample;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkoutAppleHealthDetail({
  sample,
  onEdit,
  onDelete,
}: WorkoutAppleHealthDetailProps) {
  const catalogEntry = getCatalogEntryForHealthKitActivity(sample.workoutActivityType);
  const { energy, heartRatePoints, isLoading } = useHealthKitWorkoutEnrichment(sample);
  const heartRateWindow = getWorkoutHeartRateWindow(sample);

  const dateIso = sample.startDate.toISOString();
  const dateLabel = `${localWeekdayLong(dateIso)}, ${formatMonthDayLocal(dateIso)}`;
  const timeRange = formatWorkoutTimeRange(
    sample.startDate.toISOString(),
    sample.endDate.toISOString(),
  );
  const heroMeta = [dateLabel, timeRange].filter(Boolean).join(' · ');

  const activeCalories = energy?.activeCalories ?? sample.caloriesBurned ?? 0;
  const totalCalories = energy?.totalCalories
    ?? (activeCalories > 0 ? Math.round(activeCalories * 1.15) : 0);
  const avgHeartRate = sample.avgHeartRate
    ?? (heartRatePoints.length > 0
      ? Math.round(heartRatePoints.reduce((sum, p) => sum + p.bpm, 0) / heartRatePoints.length)
      : null);

  const metrics: AppleFitnessMetric[] = isLoading
    ? []
    : [
        {
          id: 'active-cal',
          label: 'Active energy',
          value: Math.round(activeCalories).toLocaleString(),
          unit: 'cal',
          kind: 'calories',
        },
        {
          id: 'total-cal',
          label: 'Total energy',
          value: Math.round(totalCalories).toLocaleString(),
          unit: 'cal',
          kind: 'calories',
        },
        ...(avgHeartRate != null
          ? [{
              id: 'avg-hr',
              label: 'Average heart rate',
              value: String(avgHeartRate),
              unit: 'bpm',
              kind: 'heart' as const,
              wide: true,
            }]
          : []),
      ];

  const showActions = onEdit != null || onDelete != null;

  return (
    <ScrollView contentContainerStyle={workoutDetailContentStyle} showsVerticalScrollIndicator={false}>
      <WorkoutAppleFitnessHero
        title={catalogEntry.label}
        catalogEntry={catalogEntry}
        meta={heroMeta}
        durationSeconds={sample.durationSeconds}
      />

      {isLoading ? (
        <WorkoutAppleFitnessSkeleton showHeartRate={false} />
      ) : (
        <WorkoutAppleFitnessMetricBento metrics={metrics} />
      )}

      {heartRatePoints.length > 0 && (
        <WorkoutAppleFitnessHeartRate
          points={heartRatePoints}
          workoutStart={heartRateWindow.startDate}
          workoutEnd={heartRateWindow.endDate}
        />
      )}

      {showActions && (
        <WorkoutDetailActions onEdit={onEdit} onDelete={onDelete} />
      )}
    </ScrollView>
  );
}
