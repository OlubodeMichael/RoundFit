import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutAppleHealthDetail } from '@/components/log/workout/WorkoutAppleHealthDetail';
import { WorkoutDetailSkeleton } from '@/components/log/workout/WorkoutDetailSkeleton';
import { useHealthKitWorkoutByUuid } from '@/hooks/use-healthkit-workout-by-uuid';
import { ScreenHeader, usePalette, useScreenPadding } from '@/lib/log-theme';

export default function HealthKitWorkoutDetailScreen() {
  const P = usePalette();
  const pad = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { sample, isLoading, error } = useHealthKitWorkoutByUuid(uuid);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Apple Fitness" title="Workout Details" accent={P.workout} onBack={() => router.back()} />
        <WorkoutDetailSkeleton variant="apple" />
      </View>
    );
  }

  if (error != null || !sample) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: pad.paddingTop }}>
        <ScreenHeader eyebrow="Apple Fitness" title="Workout Details" accent={P.workout} onBack={() => router.back()} />
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
      <ScreenHeader eyebrow="Apple Fitness" title="Workout Details" accent={P.workout} onBack={() => router.back()} />
      <WorkoutAppleHealthDetail sample={sample} />
      <View style={{ height: insets.bottom }} />
    </View>
  );
}
