import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, Easing, ActivityIndicator, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { useCheckin } from '@/hooks/use-checkin';
import type { EnergyLevel, CheckinInsight } from '@/hooks/use-checkin';
import { useProfile } from '@/hooks/use-profile';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

// ── Data ───────────────────────────────────────────────────────────────────

// Each sleep option has its own vivid color — red→orange→amber→indigo→green
const SLEEP_OPTIONS = [
  { value: 1, label: 'Poor',  icon: 'moon-outline'         as const, color: '#F97066' },
  { value: 2, label: 'Light', icon: 'cloud-outline'        as const, color: '#FB923C' },
  { value: 3, label: 'OK',    icon: 'remove-outline'       as const, color: '#FBBF24' },
  { value: 4, label: 'Good',  icon: 'partly-sunny-outline' as const, color: '#818CF8' },
  { value: 5, label: 'Great', icon: 'sunny-outline'        as const, color: '#34D399' },
];

const ENERGY_OPTIONS: {
  value: EnergyLevel;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  soft: string;
}[] = [
  { value: 'low',    label: 'Low',    icon: 'remove-circle-outline', color: '#F97066', soft: '#F9706622' },
  { value: 'medium', label: 'Medium', icon: 'pulse-outline',         color: '#FBBF24', soft: '#FBBF2422' },
  { value: 'high',   label: 'High',   icon: 'flash',                 color: '#34D399', soft: '#34D39922' },
];

function greetingFor() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function greetingIcon(): React.ComponentProps<typeof Ionicons>['name'] {
  const h = new Date().getHours();
  if (h < 12) return 'sunny';
  if (h < 17) return 'partly-sunny';
  return 'moon';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Insight reveal ─────────────────────────────────────────────────────────

function InsightReveal({ insight, onDone }: { insight: CheckinInsight; onDone: () => void }) {
  const P        = usePalette();
  const ringAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(ringAnim, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
      Animated.timing(bodyAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [ringAnim, bodyAnim]);

  const ringScale = ringAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.1, 1] });
  const bodyY     = bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={s.successWrap}>
      <Animated.View style={{ transform: [{ scale: ringScale }], opacity: ringAnim }}>
        <View style={[s.successRing, { borderColor: '#34D399', backgroundColor: '#34D39922' }]}>
          <Ionicons name="checkmark" size={32} color="#34D399" />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: bodyAnim, transform: [{ translateY: bodyY }], alignSelf: 'stretch', marginTop: 20 }}>
        <Text style={[s.successTitle, { color: P.text }]}>All set for today</Text>
        <Text style={[s.successSub, { color: P.textFaint, marginTop: 6 }]}>Here's your morning insight</Text>

        <View style={[s.insightCard, { backgroundColor: P.card, borderColor: P.cardEdge, marginTop: 18 }]}>
          <View pointerEvents="none" style={[s.insightGlow, { backgroundColor: '#FF784922' }]} />
          <View style={[s.insightBadge, { backgroundColor: '#FF784918' }]}>
            <Ionicons name="sparkles" size={11} color="#FF7849" />
            <Text style={[s.insightBadgeText, { color: '#FF7849' }]}>DAILY INSIGHT</Text>
          </View>
          <Text style={[s.insightBody, { color: P.textDim }]}>{insight.message}</Text>
        </View>

        <Pressable
          onPress={onDone}
          style={({ pressed }) => [s.submitBtn, { backgroundColor: '#34D399', marginTop: 14, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={s.submitText}>Let's crush it</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CheckinModal({ visible, onClose }: Props) {
  const P = usePalette();
  const { firstName } = useProfile();
  const { submitMorningCheckin, skipCheckin } = useCheckin();

  const [sleepQuality,   setSleepQuality]   = useState<number | null>(null);
  const [energyLevel,    setEnergyLevel]    = useState<EnergyLevel | null>(null);
  const [plannedWorkout, setPlannedWorkout] = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [insight,        setInsight]        = useState<CheckinInsight | null>(null);
  const [done,           setDone]           = useState(false);

  // Staggered entrance anims
  const anim0 = useRef(new Animated.Value(0)).current;
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anim4 = useRef(new Animated.Value(0)).current;

  // Per-sleep-option scale bounce
  const sleepScales = useRef(SLEEP_OPTIONS.map(() => new Animated.Value(1))).current;

  // Workout pill toggle
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const toggleX    = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  const todayStr  = getLocalDateString();
  const canSubmit = sleepQuality !== null && energyLevel !== null && !isSaving;

  useEffect(() => {
    if (!visible) return;
    setSleepQuality(null); setEnergyLevel(null); setPlannedWorkout(false);
    setIsSaving(false); setInsight(null); setDone(false);
    toggleAnim.setValue(0);
    [anim0, anim1, anim2, anim3, anim4].forEach((a) => a.setValue(0));

    Animated.sequence([
      Animated.delay(80),
      Animated.stagger(60, [anim0, anim1, anim2, anim3, anim4].map((a) =>
        Animated.timing(a, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      )),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function fadeUp(a: Animated.Value) {
    return {
      opacity:   a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    };
  }

  const handleSleepSelect = (value: number) => {
    setSleepQuality(value);
    void Haptics.selectionAsync();
    const i = value - 1;
    Animated.sequence([
      Animated.spring(sleepScales[i], { toValue: 1.18, friction: 4, tension: 300, useNativeDriver: true }),
      Animated.spring(sleepScales[i], { toValue: 1,    friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  };

  const handleEnergySelect = (value: EnergyLevel) => {
    setEnergyLevel(value);
    void Haptics.selectionAsync();
  };

  const handleWorkoutToggle = () => {
    const next = !plannedWorkout;
    setPlannedWorkout(next);
    void Haptics.selectionAsync();
    Animated.spring(toggleAnim, { toValue: next ? 1 : 0, friction: 5, tension: 150, useNativeDriver: true }).start();
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || sleepQuality === null || energyLevel === null) return;
    setIsSaving(true);
    try {
      const { insight: returned } = await submitMorningCheckin({
        date: todayStr, sleep_quality: sleepQuality,
        energy_level: energyLevel, planned_workout: plannedWorkout,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInsight(returned);
      setDone(true);
    } catch {
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, sleepQuality, energyLevel, plannedWorkout, todayStr, submitMorningCheckin, onClose]);

  const handleSkip = useCallback(async () => {
    try { await skipCheckin(todayStr); } catch { /* best-effort */ }
    onClose();
  }, [skipCheckin, todayStr, onClose]);

  return (
    <AppModal visible={visible} onClose={onClose} sheetHeight={0.68} openAnimation="ease">
      <View style={s.body}>

        {done && insight ? (
          <InsightReveal insight={insight} onDone={onClose} />
        ) : done ? (
          <View style={s.successWrap}>
            <View style={[s.successRing, { borderColor: '#34D399', backgroundColor: '#34D39922' }]}>
              <Ionicons name="checkmark" size={32} color="#34D399" />
            </View>
            <Text style={[s.successTitle, { color: P.text, marginTop: 20 }]}>All set for today</Text>
            <Text style={[s.successSub, { color: P.textFaint, marginTop: 6 }]}>Your check-in has been logged</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [s.submitBtn, { backgroundColor: '#34D399', marginTop: 28, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={s.submitText}>Let's go</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Colored header strip ─────────────────────── */}
            <Animated.View style={[s.header, fadeUp(anim0)]}>
              {/* Decorative glow behind icon */}
              <View pointerEvents="none" style={[s.headerGlow, { backgroundColor: P.caloriesSoft }]} />

              <View style={s.headerLeft}>
                <View style={[s.headerBadge, { backgroundColor: P.caloriesSoft }]}>
                  <Ionicons name={greetingIcon()} size={12} color={P.calories} />
                  <Text style={[s.headerBadgeText, { color: P.calories }]}>MORNING CHECK-IN</Text>
                </View>
                <Text style={[s.headerName, { color: P.text }]}>
                  {greetingFor()}{firstName ? `,\n${firstName}` : ''}
                </Text>
                <Text style={[s.headerDate, { color: P.textFaint }]}>{todayLabel()}</Text>
              </View>
            </Animated.View>

            {/* ── Sleep quality ───────────────────────────── */}
            <Animated.View style={fadeUp(anim1)}>
              <Text style={[s.sectionLabel, { color: P.textFaint }]}>HOW DID YOU SLEEP?</Text>
              <View style={s.sleepRow}>
                {SLEEP_OPTIONS.map((opt, idx) => {
                  const active = sleepQuality === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleSleepSelect(opt.value)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, alignItems: 'center', flex: 1 })}
                    >
                      <Animated.View style={[
                        s.sleepCell,
                        active
                          ? { backgroundColor: opt.color, borderColor: opt.color, borderWidth: 0 }
                          : { backgroundColor: P.sunken, borderColor: P.cardEdge, borderWidth: StyleSheet.hairlineWidth },
                        { transform: [{ scale: sleepScales[idx] }] },
                      ]}>
                        <Ionicons
                          name={opt.icon}
                          size={22}
                          color={active ? '#fff' : P.textFaint}
                        />
                      </Animated.View>
                      <Text style={[s.sleepCellLabel, { color: active ? opt.color : P.textFaint }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Energy level ────────────────────────────── */}
            <Animated.View style={[{ marginTop: 20 }, fadeUp(anim2)]}>
              <Text style={[s.sectionLabel, { color: P.textFaint }]}>ENERGY LEVEL</Text>
              <View style={s.energyRow}>
                {ENERGY_OPTIONS.map((opt) => {
                  const active = energyLevel === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleEnergySelect(opt.value)}
                      style={({ pressed }) => [
                        s.energyCell,
                        active
                          ? { backgroundColor: opt.color, borderColor: opt.color, borderWidth: 0 }
                          : { backgroundColor: P.sunken, borderColor: P.cardEdge, borderWidth: StyleSheet.hairlineWidth },
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={20}
                        color={active ? '#fff' : P.textFaint}
                      />
                      <Text style={[s.energyCellLabel, { color: active ? '#fff' : P.textDim }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Planned workout ─────────────────────────── */}
            <Animated.View style={[{ marginTop: 14 }, fadeUp(anim3)]}>
              <Pressable
                onPress={handleWorkoutToggle}
                style={({ pressed }) => [
                  s.workoutRow,
                  {
                    backgroundColor: plannedWorkout ? '#22D3EE18' : P.sunken,
                    borderColor:     plannedWorkout ? '#22D3EE'   : P.cardEdge,
                    borderWidth:     plannedWorkout ? 1.5 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[s.workoutIconBox, { backgroundColor: plannedWorkout ? '#22D3EE22' : P.cardEdge }]}>
                  <Ionicons name="barbell-outline" size={15} color={plannedWorkout ? '#22D3EE' : P.textFaint} />
                </View>
                <Text style={[s.workoutLabel, { color: plannedWorkout ? '#22D3EE' : P.textDim }]}>
                  Planning a workout today
                </Text>
                {/* Pill toggle */}
                <View style={[s.toggleTrack, { backgroundColor: plannedWorkout ? '#22D3EE55' : P.cardEdge }]}>
                  <Animated.View style={[
                    s.toggleNub,
                    { backgroundColor: plannedWorkout ? '#22D3EE' : P.textFaint, transform: [{ translateX: toggleX }] },
                  ]} />
                </View>
              </Pressable>
            </Animated.View>

            {/* ── Submit ──────────────────────────────────── */}
            <Animated.View style={[{ marginTop: 20 }, fadeUp(anim4)]}>
              <Pressable
                onPress={canSubmit ? handleSubmit : undefined}
                style={({ pressed }) => [
                  s.submitBtn,
                  canSubmit
                    ? {
                        backgroundColor: P.calories,
                        opacity: pressed ? 0.88 : 1,
                        transform: pressed ? [{ scale: 0.985 }] : [],
                        ...Platform.select({ ios: {
                          shadowColor: P.calories, shadowOpacity: 0.5,
                          shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
                        }}),
                      }
                    : { backgroundColor: P.sunken },
                ]}
              >
                {isSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Text style={[s.submitText, { color: canSubmit ? '#fff' : P.textFaint }]}>
                        Log Check-in
                      </Text>
                      {canSubmit && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                    </>
                }
              </Pressable>

              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.45 : 1 }]}
              >
                <Text style={[s.skipText, { color: P.textFaint }]}>Skip for now</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </AppModal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop:        2,
    paddingBottom:     8,
  },

  // ── Header
  header: {
    marginBottom: 22,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
  },
  headerLeft: {
    gap: 6,
  },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 2,
  },
  headerBadgeText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
  },
  headerName: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 31,
  },
  headerDate: {
    fontSize: 12, fontWeight: '500', marginTop: 2,
  },

  // ── Section label
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 12,
  },

  // ── Sleep quality
  sleepRow: {
    flexDirection: 'row', gap: 6,
  },
  sleepCell: {
    width: '100%', aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  sleepCellLabel: {
    fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 0.1,
  },

  // ── Energy level
  energyRow: {
    flexDirection: 'row', gap: 8,
  },
  energyCell: {
    flex: 1, height: 72,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  energyCellLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: -0.2,
  },

  // ── Workout
  workoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 16,
  },
  workoutIconBox: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  workoutLabel: {
    flex: 1, fontSize: 13, fontWeight: '600', letterSpacing: -0.2,
  },
  toggleTrack: {
    width: 44, height: 24, borderRadius: 12,
  },
  toggleNub: {
    position: 'absolute', top: 2, left: 0,
    width: 20, height: 20, borderRadius: 10,
  },

  // ── Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
  },
  submitText: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff',
  },
  skipBtn: {
    alignItems: 'center', paddingVertical: 12, marginTop: 2,
  },
  skipText: {
    fontSize: 13, fontWeight: '500',
  },

  // ── Success reveal
  successWrap: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 16,
  },
  successRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24, fontWeight: '800', letterSpacing: -0.7,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13, fontWeight: '500',
    textAlign: 'center',
  },
  insightCard: {
    width: '100%', borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  insightGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, borderRadius: 60,
  },
  insightBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, marginBottom: 10,
  },
  insightBadgeText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.0,
  },
  insightBody: {
    fontSize: 14, fontWeight: '500', lineHeight: 21, letterSpacing: -0.1,
  },
});
