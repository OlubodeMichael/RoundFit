import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutAppleHealthDetail } from '@/components/log/workout/WorkoutAppleHealthDetail';
import { WorkoutDetailContent } from '@/components/log/workout/WorkoutDetailContent';
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
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Training" title="Workout" accent={P.workout} onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={P.workout} />
        </View>
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

  return (
    <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
      <ScreenHeader
        eyebrow={healthKitSample ? 'Apple Fitness' : 'Training'}
        title="Workout"
        accent={P.workout}
        onBack={() => router.back()}
      />
      {healthKitSample ? (
        <>
          <WorkoutAppleHealthDetail
            sample={healthKitSample}
            savedWorkoutId={workout.id}
          />
          <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: insets.bottom + 12 }}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                { backgroundColor: P.sunken, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: P.text, fontWeight: '700' }}>Edit workout</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                { backgroundColor: P.sunken, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete workout</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <WorkoutDetailContent
          workout={workout}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      {!healthKitSample && <View style={{ height: insets.bottom }} />}
    </View>
  );
}
