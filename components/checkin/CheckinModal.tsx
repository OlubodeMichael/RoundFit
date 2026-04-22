import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  Animated, Easing, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { useCheckin } from '@/hooks/use-checkin';
import type { EnergyLevel, CheckinInsight } from '@/hooks/use-checkin';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark ? {
    bg:        '#1C1D23',
    surface:   '#0E0F13',
    text:      '#F4F4F5',
    textDim:   '#C4C4C8',
    textFaint: '#909096',
    hair:      'rgba(255,255,255,0.10)',
    cardEdge:  'rgba(255,255,255,0.10)',
    accent:    '#F97316',
    accentSoft:'rgba(249,115,22,0.18)',
    good:      '#34D399',
    goodSoft:  'rgba(52,211,153,0.16)',
    warn:      '#FBBF24',
    warnSoft:  'rgba(251,191,36,0.16)',
    danger:    '#F87171',
    dangerSoft:'rgba(248,113,113,0.14)',
    isDark:    true,
  } : {
    bg:        '#FAFAF8',
    surface:   '#F1F1F4',
    text:      '#111111',
    textDim:   '#52525B',
    textFaint: '#A1A1AA',
    hair:      'rgba(15,23,42,0.08)',
    cardEdge:  'rgba(15,23,42,0.06)',
    accent:    '#F97316',
    accentSoft:'rgba(249,115,22,0.10)',
    good:      '#10B981',
    goodSoft:  'rgba(16,185,129,0.10)',
    warn:      '#D97706',
    warnSoft:  'rgba(217,119,6,0.10)',
    danger:    '#DC2626',
    dangerSoft:'rgba(220,38,38,0.08)',
    isDark:    false,
  };
}

// ── Sleep quality config ───────────────────────────────────────────────────

const SLEEP_OPTIONS = [
  { value: 1, label: 'Poor',      icon: 'sad-outline'      as const },
  { value: 2, label: 'Light',     icon: 'partly-sunny-outline' as const },
  { value: 3, label: 'OK',        icon: 'remove-circle-outline' as const },
  { value: 4, label: 'Good',      icon: 'happy-outline'    as const },
  { value: 5, label: 'Great',     icon: 'star-outline'     as const },
];

const ENERGY_OPTIONS: { value: EnergyLevel; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'low',    label: 'Low',    icon: 'battery-dead-outline'  },
  { value: 'medium', label: 'Medium', icon: 'battery-half-outline'  },
  { value: 'high',   label: 'High',   icon: 'flash'                 },
];

function greetingFor() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Insight reveal ─────────────────────────────────────────────────────────

function InsightReveal({
  insight,
  onDone,
  P,
}: {
  insight: CheckinInsight;
  onDone: () => void;
  P: ReturnType<typeof usePalette>;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      {/* Success tick */}
      <View style={[s.successRing, { borderColor: P.good }]}>
        <Ionicons name="checkmark" size={28} color={P.good} />
      </View>

      <Text style={[s.successTitle, { color: P.text }]}>Check-in complete</Text>
      <Text style={[s.successSub, { color: P.textFaint }]}>Here's your daily insight</Text>

      {/* Insight card */}
      <View style={[s.insightBox, { backgroundColor: P.accentSoft, borderColor: P.hair }]}>
        <View style={[s.insightIcon, { backgroundColor: P.accentSoft }]}>
          <Ionicons name="sparkles" size={16} color={P.accent} />
        </View>
        <Text style={[s.insightText, { color: P.textDim }]}>{insight.message}</Text>
      </View>

      <TouchableOpacity
        onPress={onDone}
        activeOpacity={0.85}
        style={[s.submitBtn, { backgroundColor: P.accent, marginTop: 8 }]}
      >
        <Text style={s.submitText}>Let's go</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  onClose:  () => void;
}

export function CheckinModal({ visible, onClose }: Props) {
  const P = usePalette();
  const { firstName } = useProfile();
  const { submitMorningCheckin, skipCheckin } = useCheckin();

  const [sleepQuality,     setSleepQuality]     = useState<number | null>(null);
  const [energyLevel,      setEnergyLevel]      = useState<EnergyLevel | null>(null);
  const [plannedWorkout,   setPlannedWorkout]   = useState(false);
  const [isSaving,         setIsSaving]         = useState(false);
  const [insight,          setInsight]          = useState<CheckinInsight | null>(null);
  const [done,             setDone]             = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const canSubmit = sleepQuality !== null && energyLevel !== null && !isSaving;

  // Reset state each time the modal opens
  useEffect(() => {
    if (visible) {
      setSleepQuality(null);
      setEnergyLevel(null);
      setPlannedWorkout(false);
      setIsSaving(false);
      setInsight(null);
      setDone(false);
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || sleepQuality === null || energyLevel === null) return;
    setIsSaving(true);
    try {
      const { insight: returned } = await submitMorningCheckin({
        date:            todayStr,
        sleep_quality:   sleepQuality,
        energy_level:    energyLevel,
        planned_workout: plannedWorkout,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInsight(returned);
      setDone(true);
    } catch {
      // Silently fail — don't block the user
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, sleepQuality, energyLevel, plannedWorkout, todayStr, submitMorningCheckin, onClose]);

  const handleSkip = useCallback(async () => {
    try {
      await skipCheckin(todayStr);
    } catch {
      // Best-effort skip
    }
    onClose();
  }, [skipCheckin, todayStr, onClose]);

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight={done ? 0.52 : 0.62}
      openAnimation="ease"
    >
      <View style={s.body}>
        {done && insight ? (
          <InsightReveal insight={insight} onDone={onClose} P={P} />
        ) : done ? (
          // Completed but no insight returned — just close
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={[s.successRing, { borderColor: P.good }]}>
              <Ionicons name="checkmark" size={28} color={P.good} />
            </View>
            <Text style={[s.successTitle, { color: P.text }]}>Check-in complete</Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={[s.submitBtn, { backgroundColor: P.accent, marginTop: 20 }]}
            >
              <Text style={s.submitText}>Let's go</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Greeting ──────────────────────────────────── */}
            <View style={s.greetRow}>
              <View style={[s.sunIcon, { backgroundColor: P.accentSoft }]}>
                <Ionicons name="sunny" size={18} color={P.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.greeting, { color: P.text }]}>
                  {greetingFor()}{firstName ? `, ${firstName}` : ''}
                </Text>
                <Text style={[s.greetSub, { color: P.textFaint }]}>
                  Quick morning check-in
                </Text>
              </View>
            </View>

            {/* ── Sleep quality ──────────────────────────────── */}
            <Text style={[s.sectionLabel, { color: P.textFaint }]}>HOW DID YOU SLEEP?</Text>
            <View style={s.sleepRow}>
              {SLEEP_OPTIONS.map((opt) => {
                const active = sleepQuality === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setSleepQuality(opt.value); Haptics.selectionAsync(); }}
                    style={({ pressed }) => [
                      s.sleepCell,
                      {
                        backgroundColor: active ? P.accent : P.surface,
                        borderColor:     active ? P.accent : P.cardEdge,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={active ? '#fff' : P.textFaint}
                    />
                    <Text style={[s.sleepNum, { color: active ? '#fff' : P.text }]}>
                      {opt.value}
                    </Text>
                    <Text style={[s.sleepLabel, { color: active ? 'rgba(255,255,255,0.8)' : P.textFaint }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Energy level ───────────────────────────────── */}
            <Text style={[s.sectionLabel, { color: P.textFaint }]}>ENERGY TODAY</Text>
            <View style={s.energyRow}>
              {ENERGY_OPTIONS.map((opt) => {
                const active = energyLevel === opt.value;
                const tint   = opt.value === 'high' ? P.good
                             : opt.value === 'medium' ? P.warn
                             : P.textFaint;
                const tintSoft = opt.value === 'high' ? P.goodSoft
                               : opt.value === 'medium' ? P.warnSoft
                               : P.dangerSoft;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setEnergyLevel(opt.value); Haptics.selectionAsync(); }}
                    style={({ pressed }) => [
                      s.energyCell,
                      {
                        backgroundColor: active ? tintSoft : P.surface,
                        borderColor:     active ? tint     : P.cardEdge,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={18} color={active ? tint : P.textFaint} />
                    <Text style={[s.energyLabel, { color: active ? tint : P.text }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Planned workout ────────────────────────────── */}
            <Pressable
              onPress={() => { setPlannedWorkout((v) => !v); Haptics.selectionAsync(); }}
              style={[
                s.workoutRow,
                {
                  backgroundColor: plannedWorkout ? P.goodSoft : P.surface,
                  borderColor:     plannedWorkout ? P.good     : P.cardEdge,
                },
              ]}
            >
              <View style={[s.workoutCheck, {
                backgroundColor: plannedWorkout ? P.good : 'transparent',
                borderColor:     plannedWorkout ? P.good : P.textFaint,
              }]}>
                {plannedWorkout && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Ionicons name="barbell-outline" size={16} color={plannedWorkout ? P.good : P.textFaint} />
              <Text style={[s.workoutLabel, { color: plannedWorkout ? P.good : P.text }]}>
                Planning a workout today
              </Text>
            </Pressable>

            {/* ── Submit ─────────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={canSubmit ? 0.85 : 1}
              disabled={!canSubmit}
              style={[
                s.submitBtn,
                { backgroundColor: canSubmit ? P.accent : P.surface, marginTop: 16 },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[s.submitText, { color: canSubmit ? '#fff' : P.textFaint }]}>
                  Submit Check-in
                </Text>
              )}
            </TouchableOpacity>

            {/* ── Skip ───────────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.6}
              style={s.skipBtn}
            >
              <Text style={[s.skipText, { color: P.textFaint }]}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </AppModal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Greeting
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  sunIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  greeting: {
    fontSize: 17, fontWeight: '800', letterSpacing: -0.4,
  },
  greetSub: {
    fontSize: 12, fontWeight: '500', marginTop: 1,
  },

  // Section labels
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4,
    marginBottom: 10,
  },

  // Sleep quality
  sleepRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 20,
  },
  sleepCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  sleepNum: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.3,
  },
  sleepLabel: {
    fontSize: 8, fontWeight: '700', letterSpacing: 0.3,
  },

  // Energy
  energyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  energyCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  energyLabel: {
    fontSize: 13, fontWeight: '700',
  },

  // Workout toggle
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  workoutCheck: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  workoutLabel: {
    fontSize: 14, fontWeight: '600',
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.2,
    color: '#fff',
  },

  // Skip
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  skipText: {
    fontSize: 13, fontWeight: '500',
  },

  // Insight reveal
  successRing: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  successTitle: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.5,
    textAlign: 'center', marginBottom: 4,
  },
  successSub: {
    fontSize: 13, fontWeight: '500',
    textAlign: 'center', marginBottom: 18,
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  insightIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  insightText: {
    flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 21,
  },
});
