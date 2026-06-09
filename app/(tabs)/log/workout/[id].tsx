import { useCallback } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutAppleHealthDetail } from '@/components/log/workout/WorkoutAppleHealthDetail';
import { WorkoutDetailContent } from '@/components/log/workout/WorkoutDetailContent';
import { WorkoutDetailSkeleton } from '@/components/log/workout/WorkoutDetailSkeleton';
import { WORKOUT_META } from '@/components/log/workout/workout-display';
import { getHealthKitActivityDisplayLabel } from '@/config/workout-catalog';
import { useToast } from '@/components/ui/Toast';
import { useWorkouts } from '@/hooks/use-workouts';
import { useWorkoutDetail } from '@/hooks/use-workout-detail';
import { useHealthKitWorkoutByUuid } from '@/hooks/use-healthkit-workout-by-uuid';
import { ScreenHeader, usePalette, useScreenPadding } from '@/lib/log-theme';

export default function WorkoutDetailScreen() {
  const P = usePalette();
  const pad = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deleteWorkout } = useWorkouts();
  const { workout, isLoading, error } = useWorkoutDetail(id);
  const shouldLoadHealthKit = workout?.source === 'healthkit' && Boolean(workout.healthkit_uuid);
  const { sample: healthKitSample, isLoading: isHealthKitLoading } = useHealthKitWorkoutByUuid(
    shouldLoadHealthKit ? workout?.healthkit_uuid : undefined,
  );

  const handleEdit = useCallback(() => {
    if (!workout) return;
    router.replace({
      pathname: '/(tabs)/log/workout',
      params: { editId: workout.id },
    });
  }, [router, workout]);

  const handleDelete = useCallback(() => {
    if (!workout) return;

    Alert.alert(
      'Delete workout?',
      'This will remove the workout from your log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteWorkout(workout.id);
                router.back();
              } catch {
                toast.error('Could not delete', 'Please try again.');
              }
            })();
          },
        },
      ],
    );
  }, [deleteWorkout, router, toast, workout]);

  if (isLoading || (shouldLoadHealthKit && isHealthKitLoading)) {
    const skeletonVariant = shouldLoadHealthKit ? 'apple' : 'standard';
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader
          eyebrow={shouldLoadHealthKit ? 'Apple Fitness' : 'Training'}
          title="Workout"
          accent={P.workout}
          onBack={() => router.back()}
        />
        <WorkoutDetailSkeleton variant={skeletonVariant} />
      </View>
    );
  }

  if (error != null || !workout) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Training" title="Workout" accent={P.workout} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: P.textFaint, textAlign: 'center' }}>
            {error ?? 'Workout not found'}
          </Text>
        </View>
      </View>
    );
  }

  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const activityTitle = healthKitSample
    ? getHealthKitActivityDisplayLabel(healthKitSample.workoutActivityType)
    : meta.label;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
      <ScreenHeader
        eyebrow={healthKitSample ? 'Apple Fitness' : 'Training log'}
        title={activityTitle}
        accent={P.workout}
        onBack={() => router.back()}
      />
      {healthKitSample ? (
        <WorkoutAppleHealthDetail
          sample={healthKitSample}
          savedWorkoutId={workout.id}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <WorkoutDetailContent
          workout={workout}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      <View style={{ height: insets.bottom }} />
    </View>
  );
}
