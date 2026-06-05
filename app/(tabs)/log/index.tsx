import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogTodayCategoryCard } from '@/components/log/LogTodayCategoryCard';
import { LogTodaySummary } from '@/components/log/LogTodaySummary';
import { useFood } from '@/hooks/use-food';
import { usePendingWorkoutImports } from '@/hooks/use-pending-workout-imports';
import { ScreenHeader, usePalette, useScreenPadding } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { useWeight } from '@/hooks/use-weight';
import { useWater } from '@/hooks/use-water';
import { useProfile } from '@/hooks/use-profile';
import { useUnits } from '@/hooks/use-units';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import { formatSleepDuration } from '@/utils/sleep-quality';

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DailyLogScreen() {
  const P = usePalette();
  const router = useRouter();
  const pad = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { meals, mealGoal, totalCalories, refreshLogs } = useFood();
  const pendingWorkouts = usePendingWorkoutImports();
  const { latest } = useWeight();
  const { totalMl, goalMl, refresh: refreshWater, ensureLoaded } = useWater();
  const { profile } = useProfile();
  const { weightUnit, toDisplayWeight } = useUnits();
  const health = useHealth();
  const recovery = useRecovery();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
    }, [ensureLoaded]),
  );

  const sleepHours = health.today?.sleep_hours ?? recovery.today?.sleep_hours ?? null;
  const sleepQuality = recovery.today?.sleep_quality ?? null;
  const sleepFromHK = health.today?.sleep_hours != null;

  const eatenPct = Math.min(totalCalories / Math.max(mealGoal, 1), 1);
  const latestWeightKg = latest?.weight_kg ?? profile?.weightKg ?? null;
  const latestWeight = latestWeightKg === null ? null : toDisplayWeight(latestWeightKg);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshLogs(),
        refreshWater(undefined, { force: true }),
        pendingWorkouts.refresh(),
      ]);
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const dateEyebrow = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const summaryMetrics = useMemo(
    () => [
      {
        icon: 'restaurant' as const,
        label: 'Eaten',
        value: totalCalories > 0 ? totalCalories.toLocaleString() : '0',
        unit: 'kcal',
        variant: 'meals' as const,
      },
      {
        icon: 'barbell' as const,
        label: 'Training',
        value:
          pendingWorkouts.todayDurationMinutes > 0
            ? String(pendingWorkouts.todayDurationMinutes)
            : '0',
        unit: 'min',
        variant: 'workouts' as const,
      },
      {
        icon: 'water' as const,
        label: 'Water',
        value: totalMl > 0 ? totalMl.toLocaleString() : '0',
        unit: 'ml',
        variant: 'water' as const,
      },
    ],
    [totalCalories, pendingWorkouts.todayDurationMinutes, totalMl],
  );

  const sleepCaption =
    sleepHours === null
      ? 'Not logged · tap to add'
      : [
          sleepQuality ? `${capital(sleepQuality)} quality` : null,
          sleepFromHK ? 'Apple Health' : 'Logged',
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View style={[styles.root, { backgroundColor: P.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: pad.paddingTop,
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={P.text}
            colors={[P.calories]}
            progressBackgroundColor={P.card}
          />
        }
      >
        <ScreenHeader
          showBack={false}
          eyebrow={dateEyebrow}
          title="Today"
          accent={P.calories}
        />

        <View style={styles.section}>
          <LogTodaySummary metrics={summaryMetrics} />
        </View>

        <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Log</Text>

        <View style={styles.list}>
          <LogTodayCategoryCard
            variant="meals"
            icon="restaurant"
            title="Food"
            value={totalCalories > 0 ? totalCalories.toLocaleString() : '0'}
            valueUnit="kcal"
            caption={
              meals.length === 0
                ? 'No meals yet · tap to add'
                : `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} · ${Math.round(eatenPct * 100)}% of goal`
            }
            progress={totalCalories > 0 ? eatenPct : undefined}
            onPress={() => router.push('/(tabs)/log/food')}
          />

          <LogTodayCategoryCard
            variant="workouts"
            icon="barbell-outline"
            title="Workout"
            value={
              pendingWorkouts.todaySessionCount > 0
                ? String(pendingWorkouts.todayDurationMinutes)
                : '0'
            }
            valueUnit="min"
            caption={
              pendingWorkouts.todaySessionCount === 0
                ? 'No sessions yet · tap to add'
                : `${pendingWorkouts.todaySessionCount} ${
                    pendingWorkouts.todaySessionCount === 1 ? 'session' : 'sessions'
                  } · ${Math.round(pendingWorkouts.todayCaloriesBurned).toLocaleString()} kcal`
            }
            onPress={() => router.push('/(tabs)/log/workout')}
          />

          <LogTodayCategoryCard
            variant="insight"
            icon="moon"
            title="Sleep"
            value={sleepHours !== null ? formatSleepDuration(sleepHours) : '—'}
            caption={sleepCaption}
            onPress={() => router.push('/(tabs)/log/sleep')}
          />

          <LogTodayCategoryCard
            variant="weight"
            icon="body"
            title="Weight"
            value={latestWeight === null ? '—' : latestWeight.toFixed(1)}
            valueUnit={latestWeight === null ? undefined : weightUnit}
            caption={
              latestWeight === null
                ? 'Not logged · tap to add'
                : 'Latest reading · tap to update'
            }
            onPress={() => router.push('/(tabs)/log/weight')}
          />

          <LogTodayCategoryCard
            variant="water"
            icon="water"
            title="Water"
            value={totalMl > 0 ? totalMl.toLocaleString() : '0'}
            valueUnit="ml"
            caption={
              totalMl === 0
                ? 'Not logged · tap to add'
                : `${Math.round((totalMl / Math.max(goalMl, 1)) * 100)}% of daily goal`
            }
            progress={totalMl > 0 ? Math.min(totalMl / Math.max(goalMl, 1), 1) : undefined}
            onPress={() => router.push('/(tabs)/log/water')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
});
