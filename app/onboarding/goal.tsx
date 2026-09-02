import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
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
    <View style={s.root}>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
          <OnboardingQuestion before="What are you " emphasis="working toward" after="?" />
          <WhyWeAsk
            text="Pick as many as fit. Your first pick sets your calorie target and macro split."
            style={s.whyWeAsk}
          />

          <View style={s.grid}>
            {ROWS.map((row, ri) => (
              <View key={ri} style={s.row}>
                {row.map((cell) => {
                  const g              = BY_ID[cell.id];
                  const selectionIndex = selected.indexOf(g.id);
                  const goalNumber     = GOALS.findIndex((goal) => goal.id === g.id) + 1;
                  const isOn           = selectionIndex >= 0;
                  const isPrimary      = selectionIndex === 0;
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
                      <View style={s.tileTop}>
                        <View style={[s.iconShell, isOn && s.iconShellOn, isPrimary && s.iconShellPrimary]}>
                          <Ionicons name={g.icon} size={20} color={isPrimary ? '#111111' : '#F97316'} />
                        </View>
                        {isPrimary ? (
                          <View style={s.primaryBadge}>
                            <Text style={s.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        ) : isOn ? (
                          <View style={s.checkBadge}>
                            <Ionicons name="checkmark" size={13} color="#111111" />
                          </View>
                        ) : (
                          <Text style={s.tileNumber}>{String(goalNumber).padStart(2, '0')}</Text>
                        )}
                      </View>
                      <View style={s.tileCopy}>
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

      <PrimaryCTA
        label="Continue"
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
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 28 },
  scrollBody: { paddingBottom: 20 },

  whyWeAsk: { marginBottom: 24 },

  grid: { gap: 10 },
  row:  { flexDirection: 'row', gap: 10 },

  tile: {
    minHeight:       TILE_MIN_HEIGHT,
    backgroundColor: '#F1EEE9',
    borderRadius:    22,
    borderWidth:     0,
    padding:         14,
    justifyContent:  'space-between',
  },
  tileOn:      { backgroundColor: '#19181D' },
  tilePrimary: { backgroundColor: '#F97316' },

  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconShell: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  iconShellOn: { backgroundColor: 'rgba(249,115,22,0.16)' },
  iconShellPrimary: { backgroundColor: '#F7F3EE' },
  tileNumber: { marginTop: 3, fontFamily: 'Archivo_600SemiBold', fontSize: 10, letterSpacing: 1, color: '#AAA39A', fontVariant: ['tabular-nums'] },
  primaryBadge: { marginTop: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(17,17,17,0.14)' },
  primaryBadgeText: { fontFamily: 'Archivo_600SemiBold', fontSize: 7.5, letterSpacing: 1, color: '#111111' },
  checkBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F7F3EE', alignItems: 'center', justifyContent: 'center' },
  tileCopy: { marginTop: 18 },

  tileLabel: {
    fontFamily:    'Archivo_600SemiBold',
    fontSize:      16.5,
    letterSpacing: -0.3,
    lineHeight:    21,
    color:         '#111111',
  },
  tileLabelOn: { color: '#FFFFFF' },

  tileDetail: {
    fontFamily: 'Archivo_500Medium',
    fontSize:   12,
    color:      '#918A82',
    marginTop:  3,
  },
  tileDetailOn:      { color: 'rgba(255,255,255,0.55)' },
  tileDetailPrimary: { color: 'rgba(255,255,255,0.80)' },
});
