import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch,
  Animated, Easing, ActivityIndicator, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { useCheckin } from '@/hooks/use-checkin';
import type { EnergyLevel, CheckinInsight } from '@/hooks/use-checkin';
import { useProfile } from '@/hooks/use-profile';
import { usePalette } from '@/lib/log-theme';
import { useTheme } from '@/hooks/use-theme';
import { getLocalDateString } from '@/utils/date';

// ── Data ───────────────────────────────────────────────────────────────────

const SLEEP_OPTIONS = [
  { value: 1, label: 'Poor',  fill: 0.00 },
  { value: 2, label: 'Light', fill: 0.25 },
  { value: 3, label: 'OK',    fill: 0.50 },
  { value: 4, label: 'Good',  fill: 0.75 },
  { value: 5, label: 'Great', fill: 1.00 },
] as const;

const ENERGY_OPTIONS: { value: EnergyLevel; label: string; bars: 1 | 2 | 3 }[] = [
  { value: 'low',    label: 'Low',    bars: 1 },
  { value: 'medium', label: 'Medium', bars: 2 },
  { value: 'high',   label: 'High',   bars: 3 },
];

const O = '#F97316';

function getDayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function greetingIcon(): React.ComponentProps<typeof Ionicons>['name'] {
  const h = new Date().getHours();
  if (h < 12) return 'sunny';
  if (h < 17) return 'partly-sunny';
  return 'moon';
}

function greetingBadgeLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'MORNING CHECK-IN';
  if (h < 17) return 'AFTERNOON CHECK-IN';
  return 'EVENING CHECK-IN';
}

function todayLong() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${date} · ${h}:${m} ${ampm}`;
}

// ── Circle-fill sleep icon ─────────────────────────────────────────────────

function SleepCircle({ fill, active }: { fill: number; active: boolean }) {
  const SIZE  = 22;
  const color = active ? '#FFFFFF' : '#999999';
  if (fill >= 1) {
    return <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: color }} />;
  }
  return (
    <View style={{
      width: SIZE, height: SIZE, borderRadius: SIZE / 2,
      borderWidth: 1.5, borderColor: color, overflow: 'hidden',
      backgroundColor: 'transparent',
    }}>
      {fill > 0 && (
        <View style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${fill * 100}%`, backgroundColor: color,
        }} />
      )}
    </View>
  );
}

// ── Bar-chart energy icon ──────────────────────────────────────────────────

function BarIcon({ bars, active }: { bars: 1 | 2 | 3; active: boolean }) {
  const onColor  = active ? '#FFFFFF' : '#888888';
  const offColor = active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';
  const BAR_HEIGHTS = [10, 16, 22];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 }}>
      {BAR_HEIGHTS.map((h, i) => (
        <View
          key={i}
          style={{
            width: 5, height: h, borderRadius: 2,
            backgroundColor: i < bars ? onColor : offColor,
          }}
        />
      ))}
    </View>
  );
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
  const P              = usePalette();
  const { isDark }     = useTheme();
  const { firstName }  = useProfile();
  const { submitMorningCheckin, skipCheckin } = useCheckin();

  const [sleepQuality,   setSleepQuality]   = useState<number | null>(null);
  const [energyLevel,    setEnergyLevel]    = useState<EnergyLevel | null>(null);
  const [plannedWorkout, setPlannedWorkout] = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [insight,        setInsight]        = useState<CheckinInsight | null>(null);
  const [done,           setDone]           = useState(false);

  const anim0 = useRef(new Animated.Value(0)).current;
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anim4 = useRef(new Animated.Value(0)).current;

  const sleepScales = useRef(SLEEP_OPTIONS.map(() => new Animated.Value(1))).current;

  const todayStr  = getLocalDateString();
  const canSubmit = sleepQuality !== null && energyLevel !== null && !isSaving;

  useEffect(() => {
    if (!visible) return;
    setSleepQuality(null); setEnergyLevel(null); setPlannedWorkout(false);
    setIsSaving(false); setInsight(null); setDone(false);
    [anim0, anim1, anim2, anim3, anim4].forEach((a) => a.setValue(0));

    Animated.sequence([
      Animated.delay(80),
      Animated.stagger(55, [anim0, anim1, anim2, anim3, anim4].map((a) =>
        Animated.timing(a, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      )),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function fadeUp(a: Animated.Value) {
    return {
      opacity:   a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    };
  }

  const handleSleepSelect = (value: number) => {
    setSleepQuality(value);
    void Haptics.selectionAsync();
    const i = value - 1;
    Animated.sequence([
      Animated.spring(sleepScales[i], { toValue: 1.15, friction: 4, tension: 300, useNativeDriver: true }),
      Animated.spring(sleepScales[i], { toValue: 1,    friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  };

  const handleEnergySelect = (value: EnergyLevel) => {
    setEnergyLevel(value);
    void Haptics.selectionAsync();
  };

  const handleWorkoutToggle = () => {
    setPlannedWorkout((v) => !v);
    void Haptics.selectionAsync();
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

  const selectedSleepLabel  = sleepQuality ? SLEEP_OPTIONS[sleepQuality - 1].label : null;
  const selectedEnergyLabel = energyLevel ? ENERGY_OPTIONS.find((e) => e.value === energyLevel)?.label : null;

  return (
    <AppModal visible={visible} onClose={onClose} sheetHeight={0.76} openAnimation="ease">
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
            {/* ── Header ─────────────────────────────────── */}
            <Animated.View style={[s.header, fadeUp(anim0)]}>
              <View style={[s.badge, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name={greetingIcon()} size={11} color={P.calories} />
                <Text style={[s.badgeText, { color: P.calories }]}>{greetingBadgeLabel()}</Text>
              </View>
              <Text style={[s.titleLine1, { color: P.text }]}>How's your</Text>
              <Text style={[s.titleLine2, { color: P.textDim }]}>{getDayName()} starting?</Text>
              <Text style={[s.titleDate, { color: P.textFaint }]}>{todayLong()}</Text>
            </Animated.View>

            {/* ── Sleep quality ───────────────────────────── */}
            <Animated.View style={fadeUp(anim1)}>
              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { color: P.textFaint }]}>HOW DID YOU SLEEP?</Text>
                {selectedSleepLabel && (
                  <Text style={[s.sectionValue, { color: P.text }]}>{selectedSleepLabel}</Text>
                )}
              </View>
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
                          ? { backgroundColor: isDark ? '#FFFFFF' : '#1C1C1E', borderWidth: 0 }
                          : { backgroundColor: P.sunken, borderColor: P.cardEdge, borderWidth: StyleSheet.hairlineWidth },
                        { transform: [{ scale: sleepScales[idx] }] },
                      ]}>
                        <SleepCircle fill={opt.fill} active={active} />
                      </Animated.View>
                      <Text style={[
                        s.sleepCellLabel,
                        { color: active ? (isDark ? '#FFFFFF' : '#1C1C1E') : P.textFaint },
                      ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Energy level ────────────────────────────── */}
            <Animated.View style={[{ marginTop: 18 }, fadeUp(anim2)]}>
              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { color: P.textFaint }]}>ENERGY LEVEL</Text>
                {selectedEnergyLabel && (
                  <Text style={[s.sectionValue, { color: O }]}>{selectedEnergyLabel}</Text>
                )}
              </View>
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
                          ? { backgroundColor: O, borderWidth: 0 }
                          : { backgroundColor: P.sunken, borderColor: P.cardEdge, borderWidth: StyleSheet.hairlineWidth },
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <BarIcon bars={opt.bars} active={active} />
                      <Text style={[s.energyCellLabel, { color: active ? '#fff' : P.textDim }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Planned workout ─────────────────────────── */}
            <Animated.View style={[{ marginTop: 12 }, fadeUp(anim3)]}>
              <Pressable
                onPress={handleWorkoutToggle}
                style={({ pressed }) => [
                  s.workoutRow,
                  { backgroundColor: P.sunken, borderColor: P.cardEdge, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[s.workoutIconBox, { backgroundColor: P.card }]}>
                  <Ionicons name="barbell-outline" size={16} color={plannedWorkout ? O : P.textFaint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.workoutLabel, { color: P.text }]}>Planning a workout today</Text>
                  <Text style={[s.workoutSub, { color: P.textFaint }]}>
                    {plannedWorkout ? "We'll save a slot for it" : 'Tap to plan ahead'}
                  </Text>
                </View>
                <Switch
                  value={plannedWorkout}
                  onValueChange={handleWorkoutToggle}
                  trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: O }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={isDark ? '#3A3A3C' : '#E5E5EA'}
                />
              </Pressable>
            </Animated.View>

            {/* ── Submit ──────────────────────────────────── */}
            <Animated.View style={[{ marginTop: 18 }, fadeUp(anim4)]}>
              <Pressable
                onPress={canSubmit ? handleSubmit : undefined}
                style={({ pressed }) => [
                  s.submitBtn,
                  canSubmit
                    ? {
                        backgroundColor: O,
                        opacity: pressed ? 0.88 : 1,
                        transform: pressed ? [{ scale: 0.985 }] : [],
                        ...Platform.select({ ios: {
                          shadowColor: O, shadowOpacity: 0.45,
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
                        Log check-in
                      </Text>
                      {canSubmit && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                    </>
                }
              </Pressable>

              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.4 : 1 }]}
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
    paddingTop:        4,
    paddingBottom:     8,
  },

  // Header
  header:     { marginBottom: 20 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, marginBottom: 10 },
  badgeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  titleLine1: { fontFamily: 'Syne_700Bold', fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 31 },
  titleLine2: { fontFamily: 'Syne_700Bold', fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 31, marginBottom: 6 },
  titleDate:  { fontSize: 12, fontWeight: '500' },

  // Section label row
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  sectionValue: { fontSize: 12, fontWeight: '700' },

  // Sleep quality
  sleepRow:      { flexDirection: 'row', gap: 6 },
  sleepCell:     { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sleepCellLabel: { fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 0.1 },

  // Energy level
  energyRow:      { flexDirection: 'row', gap: 8 },
  energyCell:     { flex: 1, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  energyCellLabel: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  // Workout toggle
  workoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  workoutIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  workoutLabel:   { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  workoutSub:     { fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
  },
  submitText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  skipBtn:    { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  skipText:   { fontSize: 13, fontWeight: '500' },

  // Success reveal
  successWrap:  { alignItems: 'center', paddingTop: 36, paddingBottom: 16 },
  successRing:  { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: 'Syne_700Bold', fontSize: 24, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center' },
  successSub:   { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  insightCard: {
    width: '100%', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: 16, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  insightGlow:      { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60 },
  insightBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  insightBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.0 },
  insightBody:      { fontSize: 14, fontWeight: '500', lineHeight: 21, letterSpacing: -0.1 },
});
