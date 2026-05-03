import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useFood } from '@/hooks/use-food';
import { useWorkouts } from '@/context/workout-context';
import { AnimatedCard, usePalette, useScreenPadding } from '@/lib/log-theme';
import { SectionCard } from '@/components/log/SectionCard';
import { useToast } from '@/components/ui/Toast';
import { useWeight } from '@/hooks/use-weight';
import { useProfile } from '@/hooks/use-profile';
import { useUnits } from '@/hooks/use-units';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function localCalendarToday(): string {
  const d  = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function DailyLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  const { meals, mealGoal, totalCalories, refreshLogs, activeDate } = useFood();
  const { workouts, totalCaloriesBurned: workoutCalsBurned } = useWorkouts();
  const { latest } = useWeight();
  const { profile } = useProfile();
  const { weightUnit, toDisplayWeight } = useUnits();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const isFoodDayToday   = activeDate === localCalendarToday();
  const eatenPct         = Math.min(totalCalories / Math.max(mealGoal, 1), 1);
  const latestWeightKg   = latest?.weight_kg ?? profile?.weightKg ?? null;
  const latestWeight     = latestWeightKg === null ? null : toDisplayWeight(latestWeightKg);
  const totalWorkoutMins = workouts.reduce((s, w) => s + w.duration_mins, 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshLogs(); }
    catch { toast.error('Could not refresh', 'Please try again.'); }
    finally { setRefreshing(false); }
  };

  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }),
    [],
  );

  const stats: { key: string; icon: IoniconName; value: string; unit: string; accent: string }[] = [
    {
      key:    'food',
      icon:   'flame-outline',
      value:  totalCalories > 0 ? totalCalories.toLocaleString() : '—',
      unit:   'kcal',
      accent: P.calories,
    },
    {
      key:    'workout',
      icon:   'barbell-outline',
      value:  totalWorkoutMins > 0 ? String(totalWorkoutMins) : '—',
      unit:   'min',
      accent: P.workout,
    },
    {
      key:    'sleep',
      icon:   'moon-outline',
      value:  '—',
      unit:   'hrs',
      accent: P.sleep,
    },
    {
      key:    'weight',
      icon:   'scale-outline',
      value:  latestWeight === null ? '—' : latestWeight.toFixed(1),
      unit:   weightUnit,
      accent: P.weight,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 80 }}
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
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={[s.date, { color: P.textFaint }]}>
            {today.toUpperCase()}
          </Text>
          <Text style={[s.title, { color: P.text }]}>
            {"Today's Log"}<Text style={{ color: P.calories }}>.</Text>
          </Text>
        </View>

        {/* ── At-a-glance ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <AnimatedCard delay={60} padding={0}>
            {/* Card header */}
            <View style={[s.glanceHeader, { borderBottomColor: P.hair }]}>
              <Text style={[s.glanceTitle, { color: P.textFaint }]}>
                TODAY AT A GLANCE
              </Text>
            </View>

            {/* Single row — each column owns its icon + value + unit */}
            <View style={s.glanceRow}>
              {stats.map((st, i) => (
                <View
                  key={st.key}
                  style={[
                    s.glanceCol,
                    i < stats.length - 1 && {
                      borderRightWidth: StyleSheet.hairlineWidth,
                      borderRightColor: P.hair,
                    },
                  ]}
                >
                  {/* Icon chip */}
                  <View style={[s.glanceIcon, { backgroundColor: st.accent + '1E' }]}>
                    <Ionicons name={st.icon} size={14} color={st.accent} />
                  </View>

                  {/* Value */}
                  <Text
                    style={[
                      s.glanceValue,
                      { color: st.value === '—' ? P.textFaint : P.text },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {st.value}
                  </Text>

                  {/* Unit */}
                  <Text style={[s.glanceUnit, { color: st.accent }]}>
                    {st.unit}
                  </Text>
                </View>
              ))}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Section label ───────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: P.textFaint }]}>
          LOG TODAY
        </Text>

        {/* ── Section cards ───────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <SectionCard
            delay={140}
            accent={P.calories}
            accentSoft={P.caloriesSoft}
            icon="flame"
            title="Food"
            eyebrow={isFoodDayToday ? 'EATEN' : 'ATE'}
            valueBig={totalCalories > 0 ? totalCalories.toLocaleString() : '—'}
            valueSmall="kcal"
            caption={
              meals.length === 0
                ? 'No meals logged yet · tap to add'
                : `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} · ${Math.round(eatenPct * 100)}% of goal`
            }
            progress={totalCalories > 0 ? eatenPct : undefined}
            onPress={() => router.push('/(tabs)/log/food')}
          />

          <SectionCard
            delay={190}
            accent={P.workout}
            accentSoft={P.workoutSoft}
            icon="barbell"
            title="Workout"
            eyebrow="TRAINING"
            valueBig={totalWorkoutMins > 0 ? String(totalWorkoutMins) : '—'}
            valueSmall="min"
            caption={
              workouts.length === 0
                ? 'No workout logged · tap to add'
                : `${workouts.length} ${workouts.length === 1 ? 'session' : 'sessions'} · ${workoutCalsBurned.toLocaleString()} kcal burned`
            }
            onPress={() => router.push('/(tabs)/log/workout')}
          />

          <SectionCard
            delay={240}
            accent={P.sleep}
            accentSoft={P.sleepSoft}
            icon="moon"
            title="Sleep"
            eyebrow="LAST NIGHT"
            valueBig="—"
            valueSmall="hrs"
            caption="Not logged · tap to add"
            onPress={() => router.push('/(tabs)/log/sleep')}
          />

          <SectionCard
            delay={290}
            accent={P.weight}
            accentSoft={P.weightSoft}
            icon="scale"
            title="Weight"
            eyebrow="TODAY'S READING"
            valueBig={latestWeight === null ? '—' : latestWeight.toFixed(1)}
            valueSmall={weightUnit}
            caption={
              latestWeight === null
                ? 'Not logged · tap to add'
                : 'Latest recorded · tap to update'
            }
            onPress={() => router.push('/(tabs)/log/weight')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
  },
  date: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 1.5,
    marginBottom:  6,
  },
  title: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },

  // ── At-a-glance ────────────────────────────────────────────────
  glanceHeader: {
    paddingHorizontal: 18,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  glanceTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  glanceRow: {
    flexDirection: 'row',
  },
  glanceCol: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 18,
    gap:             8,
  },
  glanceIcon: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  glanceValue: {
    fontSize:      20,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  glanceUnit: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.5,
  },

  // ── Section list ───────────────────────────────────────────────
  sectionLabel: {
    fontSize:          10,
    fontWeight:        '700',
    letterSpacing:     1.5,
    paddingHorizontal: 20,
    marginTop:         28,
    marginBottom:      12,
  },
});
