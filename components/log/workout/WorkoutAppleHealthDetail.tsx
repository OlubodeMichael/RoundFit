import { ScrollView } from 'react-native';

import { WorkoutMetricsSkeleton } from '@/components/log/workout/WorkoutDetailSkeleton';
import {
  WorkoutDetailActions,
  WorkoutDetailHero,
  WorkoutDetailRows,
  WorkoutHighlightStrip,
  workoutDetailContentStyle,
} from '@/components/log/workout/WorkoutDetailUI';
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
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkoutAppleHealthDetail({
  sample,
  onSave,
  isSaving = false,
  savedWorkoutId,
  onOpenSaved,
  onEdit,
  onDelete,
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
  const heroMeta = [dateLabel, timeRange].filter(Boolean).join(' · ');

  const activeCalories = energy?.activeCalories ?? sample.caloriesBurned ?? 0;
  const totalCalories = energy?.totalCalories
    ?? (activeCalories > 0 ? Math.round(activeCalories * 1.15) : 0);
  const avgHeartRate = sample.avgHeartRate
    ?? (heartRatePoints.length > 0
      ? Math.round(heartRatePoints.reduce((sum, p) => sum + p.bpm, 0) / heartRatePoints.length)
      : null);

  const primaryAction = savedWorkoutId != null && onOpenSaved != null
    ? { label: 'View in workout log', onPress: onOpenSaved }
    : onSave != null
      ? {
          label: 'Save to workout log',
          onPress: onSave,
          loading: isSaving,
          disabled: isSaving,
        }
      : null;

  return (
    <ScrollView contentContainerStyle={workoutDetailContentStyle} showsVerticalScrollIndicator={false}>
      <WorkoutDetailHero
        icon={catalogEntry.icon}
        title={title}
        meta={heroMeta}
        sourceLabel="Apple Fitness"
      />

      {isLoading ? (
        <WorkoutMetricsSkeleton />
      ) : (
        <>
          <WorkoutHighlightStrip
            delay={60}
            metrics={[
              {
                label: 'Workout time',
                value: formatHealthKitWorkoutDurationHms(sample.durationSeconds),
              },
              {
                label: 'Active calories',
                value: Math.round(activeCalories).toLocaleString(),
                unit: 'cal',
              },
            ]}
          />

          <WorkoutDetailRows
            delay={120}
            rows={[
              {
                icon: 'flame-outline',
                label: 'Total calories',
                value: `${Math.round(totalCalories).toLocaleString()} cal`,
                accent: P.calories,
              },
              ...(avgHeartRate != null
                ? [{
                    icon: 'heart-outline' as const,
                    label: 'Avg heart rate',
                    value: `${avgHeartRate} bpm`,
                    accent: P.danger,
                  }]
                : []),
            ]}
          />
        </>
      )}

      {heartRatePoints.length > 0 && (
        <WorkoutHeartRateChart points={heartRatePoints} />
      )}

      {primaryAction != null ? (
        <WorkoutDetailActions
          primaryLabel={primaryAction.label}
          onPrimary={primaryAction.onPress}
          primaryLoading={primaryAction.loading}
          primaryDisabled={primaryAction.disabled}
        />
      ) : (
        <WorkoutDetailActions onEdit={onEdit} onDelete={onDelete} />
      )}
    </ScrollView>
  );
}
