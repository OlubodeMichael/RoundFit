import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useFood } from '@/hooks/use-food';
import {
  AnimatedCard,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { SectionCard } from '@/components/log/SectionCard';
import { useToast } from '@/components/ui/Toast';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function localCalendarToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function DailyLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  const { meals, mealGoal, totalCalories, refreshLogs, activeDate } = useFood();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const isFoodDayToday = activeDate === localCalendarToday();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLogs();
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }),
    [],
  );

  const eatenPct = Math.min(totalCalories / Math.max(mealGoal, 1), 1);

  // Hub summary stats — totals across everything logged today.
  const stats = [
    { key: 'food',    icon: 'flame-outline'     as IoniconName, value: totalCalories, unit: 'kcal',   accent: P.calories },
    { key: 'workout', icon: 'barbell-outline'   as IoniconName, value: 0,              unit: 'min',    accent: P.workout  },
    { key: 'sleep',   icon: 'moon-outline'      as IoniconName, value: '—',            unit: 'hours',  accent: P.sleep    },
    { key: 'weight',  icon: 'scale-outline'     as IoniconName, value: '—',            unit: 'lb',     accent: P.weight   },
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
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>
              {today.toUpperCase()}
            </Text>
            <Text style={[styles.title, { color: P.text }]}>
              Daily Log<Text style={{ color: P.calories }}>.</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={P.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero: at-a-glance chips ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <AnimatedCard delay={60}>
            <Text style={[styles.glanceEyebrow, { color: P.textFaint }]}>
              TODAY AT A GLANCE
            </Text>
            <View style={styles.glanceGrid}>
              {stats.map((s) => (
                <View key={s.key} style={styles.glanceCell}>
                  <View style={[styles.glanceIcon, { backgroundColor: s.accent + '22' }]}>
                    <Ionicons name={s.icon} size={14} color={s.accent} />
                  </View>
                  <Text style={[styles.glanceValue, { color: P.text }]} numberOfLines={1}>
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  </Text>
                  <Text style={[styles.glanceUnit, { color: P.textFaint }]}>
                    {s.unit}
                  </Text>
                </View>
              ))}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Sections ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 18 }}>
          <SectionCard
            delay={140}
            accent={P.calories}
            accentSoft={P.caloriesSoft}
            icon="flame"
            title="Food"
            eyebrow={isFoodDayToday ? 'EATEN' : 'ATE'}
            valueBig={totalCalories.toLocaleString()}
            valueSmall="kcal"
            caption={
              meals.length === 0
                ? 'No meals logged yet · tap to add'
                : `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} · ${Math.round(eatenPct * 100)}% of goal`
            }
            progress={eatenPct}
            onPress={() => router.push('/(tabs)/log/food')}
          />

          <SectionCard
            delay={200}
            accent={P.workout}
            accentSoft={P.workoutSoft}
            icon="barbell"
            title="Workout"
            eyebrow="TRAINING"
            valueBig="0"
            valueSmall="min"
            caption="No workout logged · tap to add"
            onPress={() => router.push('/(tabs)/log/workout')}
          />

          <SectionCard
            delay={260}
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
            delay={320}
            accent={P.weight}
            accentSoft={P.weightSoft}
            icon="scale"
            title="Weight"
            eyebrow="TODAY'S READING"
            valueBig="—"
            valueSmall="lb"
            caption="Not logged · tap to add"
            onPress={() => router.push('/(tabs)/log/weight')}
          />

          <SectionCard
            delay={380}
            accent={P.body}
            accentSoft={P.bodySoft}
            icon="body"
            title="Body metrics"
            eyebrow="HOW YOU FEEL"
            valueBig="—"
            valueSmall=""
            caption="No soreness / notes · tap to add"
            onPress={() => router.push('/(tabs)/log/body')}
          />
        </View>

        {/* ── Footer nudge ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <AnimatedCard delay={440} padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.tipIcon, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="sparkles" size={14} color={P.protein} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tipTitle, { color: P.text }]}>
                  {"Log what you can — we'll do the rest"}
                </Text>
                <Text style={[styles.tipBody, { color: P.textFaint }]}>
                  Only need a few fields filled in. Insights get sharper with every log.
                </Text>
              </View>
            </View>
          </AnimatedCard>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    gap:               12,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
  },
  title: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },
  iconBtn: {
    width:           42, height: 42, borderRadius: 21,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     StyleSheet.hairlineWidth,
  },

  glanceEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginBottom:  14,
  },
  glanceGrid: {
    flexDirection: 'row',
    gap:           12,
  },
  glanceCell: {
    flex:       1,
    alignItems: 'flex-start',
    gap:        6,
  },
  glanceIcon: {
    width:          28, height: 28, borderRadius: 9,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   2,
  },
  glanceValue: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  glanceUnit: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  tipIcon: {
    width:          32, height: 32, borderRadius: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tipTitle: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
    marginBottom:  2,
  },
  tipBody: {
    fontSize:      11,
    fontWeight:    '500',
    lineHeight:    15,
  },
});
