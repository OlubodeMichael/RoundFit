import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { usePostHog } from 'posthog-react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * `base` is the plan-driving goal each option follows — `GOAL_MAP` in
 * utils/onboarding-mapping.ts knows only these four ids, and each maps to one
 * calorie delta and macro split. Options that aren't themselves a base (Sleep
 * better, Get stronger) borrow one, so the list can grow without touching
 * `UserGoal` or the nutrition tables.
 */
type GoalBase = 'lose' | 'muscle' | 'energy' | 'maintain';

const GOALS: { id: string; icon: IoniconsName; label: string; detail: string; base: GoalBase }[] = [
  { id: 'lose',     icon: 'flame-outline',   label: 'Lose weight',  detail: '-500 kcal/day',    base: 'lose'     },
  { id: 'muscle',   icon: 'barbell-outline', label: 'Build muscle', detail: '+300 kcal/day',    base: 'muscle'   },
  { id: 'energy',   icon: 'flash-outline',   label: 'Boost energy', detail: 'Macros tuned',     base: 'energy'   },
  { id: 'sleep',    icon: 'moon-outline',    label: 'Sleep better', detail: 'Recovery first',   base: 'energy'   },
  { id: 'strength', icon: 'fitness-outline', label: 'Get stronger', detail: 'Progressive load', base: 'muscle'   },
  { id: 'maintain', icon: 'swap-horizontal', label: 'Maintain',     detail: 'TDEE balanced',    base: 'maintain' },
];

const BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));

/**
 * Uneven tile widths keep the grid from reading as a rigid table. `minHeight` is
 * a floor, not a fixed height — a label that wraps grows its tile instead of
 * being clipped, and the row's default `stretch` keeps its neighbour flush.
 */
const TILE_MIN_HEIGHT = 104;

const ROWS: { id: string; flex: number }[][] = [
  [{ id: 'lose',     flex: 1.3 }, { id: 'muscle',   flex: 1   }],
  [{ id: 'energy',   flex: 1   }, { id: 'sleep',    flex: 1.25 }],
  [{ id: 'strength', flex: 1.2 }, { id: 'maintain', flex: 1   }],
];

export default function GoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string }>();
  const insets = useSafeAreaInsets();
  const total  = 9;
  const posthog = usePostHog();

  /**
   * Ordered selection — goals combine freely, and the **first** one tapped is the
   * primary (shown in accent). Only the primary's `base` reaches the nutrition
   * maths. Deselecting the primary promotes the next in line.
   */
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const primary     = GOALS.find((g) => g.id === selected[0]) ?? null;
  const canContinue = primary !== null;

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={5} total={total} backHref={{ pathname: '/onboarding/height-weight', params }} isDark={false} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
          <Text style={s.headline}>Your{'\n'}goals.</Text>
          <WhyWeAsk
            text="Pick as many as fit. Your first pick sets your calorie target and macro split."
            style={s.whyWeAsk}
          />

          <View style={s.grid}>
            {ROWS.map((row, ri) => (
              <View key={ri} style={s.row}>
                {row.map((cell) => {
                  const g         = BY_ID[cell.id];
                  const index     = selected.indexOf(g.id);
                  const isOn      = index >= 0;
                  const isPrimary = index === 0;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[s.tile, { flex: cell.flex }, isOn && s.tileOn, isPrimary && s.tilePrimary]}
                      onPress={() => toggle(g.id)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isOn }}
                      accessibilityLabel={isPrimary ? `${g.label}, primary goal` : g.label}
                    >
                      <Ionicons name={g.icon} size={22} color={isPrimary ? '#FFFFFF' : '#F97316'} />
                      <View>
                        <Text style={[s.tileLabel, isOn && s.tileLabelOn]} numberOfLines={2}>
                          {g.label}
                        </Text>
                        <Text
                          style={[s.tileDetail, isOn && s.tileDetailOn, isPrimary && s.tileDetailPrimary]}
                          numberOfLines={1}
                        >
                          {g.detail}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <TouchableOpacity
        style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
        activeOpacity={0.85}
        disabled={!canContinue}
        onPress={() => {
          posthog.capture('onboarding_goal_selected', {
            goal:       primary!.base,
            goal_id:    primary!.id,
            goals:      selected,
            goal_count: selected.length,
          });
          router.push({
            pathname: '/onboarding/activity',
            // `goal` stays a single base id so every downstream consumer —
            // mapOnboardingGoal, utils/nutrition.ts, reveal — is untouched.
            // `goals` carries the ordered full set alongside it.
            params: { ...params, goal: primary!.base, goals: selected.join(',') },
          });
        }}
      >
        <Text style={s.ctaText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 28 },
  progress:   { marginBottom: 8 },
  scrollBody: { paddingBottom: 20 },

  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 8, color: '#111111' },
  whyWeAsk: { marginBottom: 24 },

  grid: { gap: 10 },
  row:  { flexDirection: 'row', gap: 10 },

  tile: {
    minHeight:       TILE_MIN_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     '#EBEBEB',
    padding:         16,
    justifyContent:  'space-between',
  },
  tileOn:      { backgroundColor: '#111111', borderColor: '#111111' },
  tilePrimary: { backgroundColor: '#F97316', borderColor: '#F97316' },

  tileLabel: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.3,
    lineHeight:    20,
    color:         '#111111',
  },
  tileLabelOn: { color: '#FFFFFF' },

  tileDetail: {
    fontSize:   12.5,
    fontWeight: '500',
    color:      '#9A948C',
    marginTop:  3,
  },
  tileDetailOn:      { color: 'rgba(255,255,255,0.55)' },
  tileDetailPrimary: { color: 'rgba(255,255,255,0.80)' },

  cta: {
    backgroundColor: '#111111', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
