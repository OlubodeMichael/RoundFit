import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutAppleHealthDetail } from '@/components/log/workout/WorkoutAppleHealthDetail';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/auth-context';
import { useWorkouts } from '@/hooks/use-workouts';
import { useHealthKitWorkoutByUuid } from '@/hooks/use-healthkit-workout-by-uuid';
import { importReviewedWorkout } from '@/services/workout-import';
import { ScreenHeader, usePalette, useScreenPadding } from '@/lib/log-theme';

export default function HealthKitWorkoutDetailScreen() {
  const P = usePalette();
  const pad = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { user } = useAuth();
  const { logWorkout, workouts } = useWorkouts();
  const { sample, isLoading, error } = useHealthKitWorkoutByUuid(uuid);
  const [isSaving, setIsSaving] = useState(false);

  const savedWorkout = workouts.find((workout) => workout.healthkit_uuid === uuid) ?? null;

  const handleSave = useCallback(async () => {
    if (!sample || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await importReviewedWorkout(sample, logWorkout, undefined, user?.id);
      toast.success('Workout saved', 'Added to your workout log.');
      router.replace(`/(tabs)/log/workout/${saved.id}`);
    } catch {
      toast.error('Could not save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, logWorkout, router, sample, toast, user?.id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Apple Fitness" title="Workout" accent={P.workout} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={P.workout} />
        </View>
      </View>
    );
  }

  if (error != null || !sample) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Apple Fitness" title="Workout" accent={P.workout} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: P.textFaint, textAlign: 'center', lineHeight: 20 }}>
            {error ?? 'Workout not found in Apple Health.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
      <ScreenHeader eyebrow="Apple Fitness" title="Workout" accent={P.workout} onBack={() => router.back()} />
      <WorkoutAppleHealthDetail
        sample={sample}
        onSave={savedWorkout ? undefined : handleSave}
        isSaving={isSaving}
        savedWorkoutId={savedWorkout?.id ?? null}
        onOpenSaved={
          savedWorkout
            ? () => { router.replace(`/(tabs)/log/workout/${savedWorkout.id}`); }
            : undefined
        }
      />
      <View style={{ height: insets.bottom }} />
    </View>
  );
}
