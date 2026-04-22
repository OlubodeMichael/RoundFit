import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Pressable, Alert, Animated, Easing, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useCycle } from '@/hooks/use-cycle';
import type { LifeStage, CycleLog } from '@/hooks/use-cycle';
import { AppModal } from '@/components/ui/AppModal';
import { WheelColumn } from '@/components/onboarding/wheel-column';

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark ? {
    bg:        '#0A0B0F',
    card:      '#1C1D23',
    cardEdge:  'rgba(255,255,255,0.10)',
    sunken:    '#0E0F13',
    text:      '#F4F4F5',
    textDim:   '#C4C4C8',
    textFaint: '#909096',
    hair:      'rgba(255,255,255,0.10)',
    accent:    '#A78BFA',
    accentSoft:'rgba(167,139,250,0.18)',
    danger:    '#F87171',
    dangerSoft:'rgba(248,113,113,0.14)',
    isDark:    true,
  } : {
    bg:        '#F6F6F8',
    card:      '#FFFFFF',
    cardEdge:  'rgba(15,23,42,0.06)',
    sunken:    '#F1F1F4',
    text:      '#09090B',
    textDim:   '#52525B',
    textFaint: '#A1A1AA',
    hair:      'rgba(15,23,42,0.08)',
    accent:    '#7C3AED',
    accentSoft:'rgba(124,58,237,0.10)',
    danger:    '#DC2626',
    dangerSoft:'rgba(220,38,38,0.10)',
    isDark:    false,
  };
}

// ── Phase config ───────────────────────────────────────────────────────────

const PHASES = [
  { key: 'menstrual',  label: 'Menstrual',  icon: 'water' as const,  days: '1–5' },
  { key: 'follicular', label: 'Follicular', icon: 'leaf'  as const,  days: '6–13' },
  { key: 'ovulation',  label: 'Ovulation',  icon: 'sunny' as const,  days: '14–16' },
  { key: 'luteal',     label: 'Luteal',     icon: 'moon'  as const,  days: '17–end' },
] as const;

const LIFE_STAGES: { key: LifeStage; label: string; sub: string }[] = [
  { key: 'regular',      label: 'Regular',      sub: 'Standard cycle tracking' },
  { key: 'postpartum',   label: 'Postpartum',   sub: '+400 cal, +20g protein' },
  { key: 'perimenopause',label: 'Perimenopause',sub: '+15g protein' },
  { key: 'menopause',    label: 'Menopause',    sub: '–50 cal, +20g protein' },
];

// ── Date wheel helpers ─────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function buildYears() {
  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) years.push(y);
  return years;
}

// ── Animated card ──────────────────────────────────────────────────────────

function Card({ children, style, delay = 0 }: { children: React.ReactNode; style?: object; delay?: number }) {
  const P   = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 500, delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[{
      backgroundColor: P.card,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: P.cardEdge,
      padding: 20,
      opacity: anim,
      transform: [{ translateY }],
    }, style]}>
      {children}
    </Animated.View>
  );
}

// ── Log Period Modal ───────────────────────────────────────────────────────

function LogPeriodModal({
  visible, onClose, onConfirm, defaultCycleLength, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string, cycleLength: number, notes: string) => void;
  defaultCycleLength: number;
  isDark: boolean;
}) {
  const now = new Date();
  const years = useMemo(() => buildYears(), []);

  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [dayIdx,   setDayIdx]   = useState(now.getDate() - 1);
  const [yearIdx,  setYearIdx]  = useState(0);
  const [cycleLen, setCycleLen] = useState(defaultCycleLength);

  const selectedYear  = years[yearIdx] ?? now.getFullYear();
  const maxDay        = daysInMonth(monthIdx, selectedYear);
  const dayLabels     = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay],
  );
  const safeDay = Math.min(dayIdx, maxDay - 1);

  const cycleLenLabels = useMemo(
    () => Array.from({ length: 25 }, (_, i) => `${i + 21} days`),
    [],
  );
  const cycleLenIdx = Math.max(0, cycleLen - 21);

  const bg  = isDark ? '#1C1D23' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#707078' : '#BBBBBB';
  const lo  = isDark ? '#2A2A32' : '#EBEBEB';

  function handleConfirm() {
    const day   = safeDay + 1;
    const month = monthIdx + 1;
    const year  = selectedYear;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const picked = new Date(year, monthIdx, day);
    if (picked > today) {
      Alert.alert('Invalid date', 'Period start date cannot be in the future.');
      return;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onConfirm(dateStr, cycleLen, '');
    onClose();
  }

  return (
    <AppModal visible={visible} onClose={onClose} title="Log Period" sheetHeight={0.72}>
      <View style={{ flex: 1 }}>
        {/* Date wheels */}
        <Text style={{ color: mid, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 24, marginTop: 4, marginBottom: 4 }}>
          PERIOD START DATE
        </Text>
        <View style={{ flexDirection: 'row', height: 220, paddingHorizontal: 12 }}>
          <WheelColumn
            labels={MONTHS}
            selectedIndex={monthIdx}
            onChange={(i) => { setMonthIdx(i); setDayIdx((d) => Math.min(d, daysInMonth(i, selectedYear) - 1)); }}
            isDark={isDark}
          />
          <WheelColumn
            labels={dayLabels}
            selectedIndex={safeDay}
            onChange={setDayIdx}
            isDark={isDark}
          />
          <WheelColumn
            labels={years.map(String)}
            selectedIndex={yearIdx}
            onChange={setYearIdx}
            isDark={isDark}
          />
        </View>

        {/* Cycle length */}
        <View style={[{ marginHorizontal: 24, marginTop: 8, borderTopWidth: 1, borderTopColor: lo, paddingTop: 16 }]}>
          <Text style={{ color: mid, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }}>
            CYCLE LENGTH
          </Text>
          <View style={{ height: 160 }}>
            <WheelColumn
              labels={cycleLenLabels}
              selectedIndex={cycleLenIdx}
              onChange={(i) => setCycleLen(i + 21)}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 24,
            marginTop: 12,
            backgroundColor: '#A78BFA',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}>
            Confirm Period
          </Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}

// ── Format helpers ─────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_SHORT[(m ?? 1) - 1]} ${d}, ${y}`;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  return diff;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CycleTrackingScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { current, history, stats, isLoading, logPeriod, updateCycleLength, updateLifeStage, deleteLog, refresh } = useCycle();

  const [logModalOpen,    setLogModalOpen]    = useState(false);
  const [cycleLenModal,   setCycleLenModal]   = useState(false);
  const [lifeStageModal,  setLifeStageModal]  = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);

  // Redirect males away
  useEffect(() => {
    if (profile && profile.sex !== 'female') router.replace('/(tabs)/profile');
  }, [profile, router]);

  const activePhaseIdx = PHASES.findIndex((p) => p.key === current?.phase);
  const defaultCycleLen = current?.cycle_length ?? 28;

  const daysLeft = daysUntil(current?.predicted_next_period);

  // ── Log period ─────────────────────────────────────────────────────────
  const handleLogPeriod = useCallback(async (date: string, cycleLen: number, notes: string) => {
    setIsSaving(true);
    try {
      await logPeriod(date, cycleLen, notes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log period');
    } finally {
      setIsSaving(false);
    }
  }, [logPeriod]);

  // ── Update cycle length ────────────────────────────────────────────────
  const handleCycleLength = useCallback(async (len: number) => {
    setIsSaving(true);
    try {
      await updateCycleLength(len);
      setCycleLenModal(false);
    } catch {
      Alert.alert('Error', 'Could not update cycle length');
    } finally {
      setIsSaving(false);
    }
  }, [updateCycleLength]);

  // ── Update life stage ──────────────────────────────────────────────────
  const handleLifeStage = useCallback(async (stage: LifeStage) => {
    setIsSaving(true);
    try {
      await updateLifeStage(stage);
      setLifeStageModal(false);
    } catch {
      Alert.alert('Error', 'Could not update life stage');
    } finally {
      setIsSaving(false);
    }
  }, [updateLifeStage]);

  // ── Delete log ─────────────────────────────────────────────────────────
  const handleDelete = useCallback((log: CycleLog) => {
    Alert.alert(
      'Delete cycle log?',
      `Remove the period logged on ${fmtDate(log.period_start_date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLog(log.id);
            } catch {
              Alert.alert('Error', 'Could not delete cycle log');
            }
          },
        },
      ],
    );
  }, [deleteLog]);

  const currentLifeStage = LIFE_STAGES.find((s) => s.key === current?.life_stage) ?? LIFE_STAGES[0];

  return (
    <View style={[s.root, { backgroundColor: P.bg }]}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={P.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>Women&apos;s Health</Text>
          <Text style={[s.title, { color: P.text }]}>Cycle Tracking</Text>
        </View>
        <TouchableOpacity
          onPress={() => refresh()}
          style={{ padding: 8 }}
          hitSlop={8}
        >
          <Ionicons name="refresh" size={18} color={P.textFaint} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={P.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Phase card ────────────────────────────────────────── */}
          {current?.available && current.phase ? (
            <Card delay={0}>
              {/* Phase row */}
              <View style={s.phaseHead}>
                <View style={[s.iconTile, { backgroundColor: P.accentSoft }]}>
                  <Ionicons name={PHASES[Math.max(0, activePhaseIdx)].icon} size={18} color={P.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.phaseTitle, { color: P.text }]}>
                    {current.phase.charAt(0).toUpperCase() + current.phase.slice(1)}{' '}
                    <Text style={{ color: P.textFaint, fontWeight: '500' }}>phase</Text>
                  </Text>
                  {current.day_of_cycle != null && current.cycle_length != null && (
                    <Text style={[s.phaseSub, { color: P.textFaint }]}>
                      Day {current.day_of_cycle} of {current.cycle_length}
                    </Text>
                  )}
                </View>
                {daysLeft != null && daysLeft >= 0 && (
                  <View style={[s.pill, { backgroundColor: P.accentSoft }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: P.accent }}>
                      {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: P.accent, marginTop: 1 }}>
                      {daysLeft === 0 ? '' : 'until next'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Phase timeline */}
              <View style={s.phaseRow}>
                {PHASES.map((p, i) => {
                  const isActive = i === activePhaseIdx;
                  return (
                    <View key={p.key} style={s.phaseTick}>
                      <View style={[s.phaseBar, {
                        backgroundColor: isActive ? P.accent : P.hair,
                        height: isActive ? 4 : 3,
                      }]} />
                      <Text style={[s.phaseCap, { color: isActive ? P.text : P.textFaint, fontWeight: isActive ? '700' : '500' }]}>
                        {p.label}
                      </Text>
                      <Text style={{ fontSize: 9, color: P.textFaint, fontWeight: '600', marginTop: 1 }}>
                        {p.days}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Stats row */}
              <View style={[s.statsRow, { borderTopColor: P.hair }]}>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: P.text }]}>{fmtDate(current.last_period_date)}</Text>
                  <Text style={[s.statLbl, { color: P.textFaint }]}>last period</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: P.hair }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: P.text }]}>{fmtDate(current.predicted_next_period)}</Text>
                  <Text style={[s.statLbl, { color: P.textFaint }]}>next period</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: P.hair }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: P.text }]}>{current.cycle_length ?? 28}d</Text>
                  <Text style={[s.statLbl, { color: P.textFaint }]}>cycle length</Text>
                </View>
              </View>

              {/* Phase insight */}
              {current.phase_insight && (
                <View style={[s.insightBox, { backgroundColor: P.accentSoft, borderColor: P.cardEdge }]}>
                  <Ionicons name="sparkles" size={13} color={P.accent} style={{ marginTop: 1 }} />
                  <Text style={[s.insightText, { color: P.textDim ?? P.textFaint }]}>{current.phase_insight}</Text>
                </View>
              )}
            </Card>
          ) : (
            // No period logged yet
            <Card delay={0}>
              <View style={s.phaseHead}>
                <View style={[s.iconTile, { backgroundColor: P.accentSoft }]}>
                  <Ionicons name="calendar" size={18} color={P.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.phaseTitle, { color: P.text }]}>No period logged</Text>
                  <Text style={[s.phaseSub, { color: P.textFaint }]}>
                    Log your last period to enable tracking
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* ── Log Period CTA ─────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => setLogModalOpen(true)}
            activeOpacity={0.85}
            disabled={isSaving}
            style={[s.cta, { backgroundColor: P.accent }]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.ctaText}>Log New Period</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Adjusted targets ──────────────────────────────────── */}
          {current?.adjusted_targets && (
            <Card delay={80}>
              <Text style={[s.cardTitle, { color: P.text }]}>Adjusted Targets</Text>
              {current.adjustment_reason && (
                <Text style={[s.cardSub, { color: P.textFaint }]}>{current.adjustment_reason}</Text>
              )}
              <View style={[s.targetsRow, { marginTop: 16 }]}>
                {[
                  { label: 'Calories', val: `${current.adjusted_targets.calories}`, unit: 'kcal' },
                  { label: 'Protein',  val: `${current.adjusted_targets.protein}`,  unit: 'g'    },
                  { label: 'Carbs',    val: `${current.adjusted_targets.carbs}`,    unit: 'g'    },
                  { label: 'Fat',      val: `${current.adjusted_targets.fat}`,      unit: 'g'    },
                ].map((t) => (
                  <View key={t.label} style={s.targetItem}>
                    <Text style={[s.targetVal, { color: P.accent }]}>{t.val}</Text>
                    <Text style={[s.targetUnit, { color: P.textFaint }]}>{t.unit}</Text>
                    <Text style={[s.targetLbl, { color: P.textFaint }]}>{t.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* ── Settings row ──────────────────────────────────────── */}
          <Card delay={120}>
            <Text style={[s.cardTitle, { color: P.text }]}>Settings</Text>

            {/* Cycle length */}
            <TouchableOpacity
              onPress={() => setCycleLenModal(true)}
              style={[s.settingRow, { borderBottomColor: P.hair }]}
              activeOpacity={0.7}
            >
              <View style={[s.settingIcon, { backgroundColor: P.accentSoft }]}>
                <Ionicons name="repeat" size={16} color={P.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel, { color: P.text }]}>Cycle Length</Text>
                <Text style={[s.settingSub, { color: P.textFaint }]}>Used to predict your next period</Text>
              </View>
              <Text style={[s.settingVal, { color: P.accent }]}>{defaultCycleLen}d</Text>
              <Ionicons name="chevron-forward" size={14} color={P.textFaint} />
            </TouchableOpacity>

            {/* Life stage */}
            <TouchableOpacity
              onPress={() => setLifeStageModal(true)}
              style={[s.settingRow, { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
            >
              <View style={[s.settingIcon, { backgroundColor: P.accentSoft }]}>
                <Ionicons name="person" size={16} color={P.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel, { color: P.text }]}>Life Stage</Text>
                <Text style={[s.settingSub, { color: P.textFaint }]}>Adjusts calorie & macro targets</Text>
              </View>
              <Text style={[s.settingVal, { color: P.accent }]}>{currentLifeStage.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={P.textFaint} />
            </TouchableOpacity>
          </Card>

          {/* ── Stats card ────────────────────────────────────────── */}
          {stats?.available && stats.total_cycles > 0 && (
            <Card delay={160}>
              <Text style={[s.cardTitle, { color: P.text }]}>Cycle Stats</Text>
              <Text style={[s.cardSub, { color: P.textFaint }]}>
                Based on {stats.total_cycles} logged cycle{stats.total_cycles !== 1 ? 's' : ''}
              </Text>
              <View style={s.statsGrid}>
                {[
                  { label: 'Average',  val: stats.avg_cycle_length != null ? `${stats.avg_cycle_length}d` : '—' },
                  { label: 'Shortest', val: stats.shortest_cycle   != null ? `${stats.shortest_cycle}d`   : '—' },
                  { label: 'Longest',  val: stats.longest_cycle    != null ? `${stats.longest_cycle}d`    : '—' },
                ].map((item) => (
                  <View key={item.label} style={[s.statBox, { backgroundColor: P.accentSoft }]}>
                    <Text style={[s.statBoxVal, { color: P.accent }]}>{item.val}</Text>
                    <Text style={[s.statBoxLbl, { color: P.textFaint }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* ── History ───────────────────────────────────────────── */}
          {history.length > 0 && (
            <Card delay={200}>
              <Text style={[s.cardTitle, { color: P.text }]}>History</Text>
              {history.map((log, i) => (
                <View key={log.id}>
                  {i > 0 && <View style={[s.divider, { backgroundColor: P.hair }]} />}
                  <View style={s.historyRow}>
                    <View style={[s.settingIcon, { backgroundColor: P.accentSoft }]}>
                      <Ionicons name="water" size={14} color={P.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.historyDate, { color: P.text }]}>
                        {fmtDate(log.period_start_date)}
                      </Text>
                      <Text style={[s.historySub, { color: P.textFaint }]}>
                        {log.cycle_length}d cycle
                        {log.predicted_next_period ? ` · next ${fmtDate(log.predicted_next_period)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleDelete(log)}
                      hitSlop={10}
                      style={({ pressed }) => [
                        s.deleteBtn,
                        { backgroundColor: P.dangerSoft, opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={14} color={P.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      {/* ── Log period modal ──────────────────────────────────────── */}
      <LogPeriodModal
        visible={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onConfirm={handleLogPeriod}
        defaultCycleLength={defaultCycleLen}
        isDark={P.isDark}
      />

      {/* ── Cycle length picker modal ─────────────────────────────── */}
      <CycleLengthModal
        visible={cycleLenModal}
        onClose={() => setCycleLenModal(false)}
        onConfirm={handleCycleLength}
        current={defaultCycleLen}
        isDark={P.isDark}
      />

      {/* ── Life stage modal ──────────────────────────────────────── */}
      <LifeStageModal
        visible={lifeStageModal}
        onClose={() => setLifeStageModal(false)}
        onSelect={handleLifeStage}
        current={current?.life_stage ?? 'regular'}
        isDark={P.isDark}
        P={P}
      />
    </View>
  );
}

// ── Cycle length picker modal ──────────────────────────────────────────────

function CycleLengthModal({
  visible, onClose, onConfirm, current, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (len: number) => void;
  current: number;
  isDark: boolean;
}) {
  const labels = useMemo(() => Array.from({ length: 25 }, (_, i) => `${i + 21} days`), []);
  const [idx, setIdx] = useState(Math.max(0, current - 21));

  return (
    <AppModal visible={visible} onClose={onClose} title="Cycle Length" sheetHeight={0.48}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ height: 200 }}>
          <WheelColumn labels={labels} selectedIndex={idx} onChange={setIdx} isDark={isDark} />
        </View>
        <TouchableOpacity
          onPress={() => onConfirm(idx + 21)}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#A78BFA',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Save</Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}

// ── Life stage picker modal ────────────────────────────────────────────────

function LifeStageModal({
  visible, onClose, onSelect, current, isDark, P,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (stage: LifeStage) => void;
  current: LifeStage;
  isDark: boolean;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <AppModal visible={visible} onClose={onClose} title="Life Stage" sheetHeight={0.54}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 10 }}>
        {LIFE_STAGES.map((stage) => {
          const isActive = stage.key === current;
          return (
            <TouchableOpacity
              key={stage.key}
              onPress={() => onSelect(stage.key)}
              activeOpacity={0.8}
              style={[s.stageRow, {
                backgroundColor: isActive ? P.accentSoft : P.sunken,
                borderColor: isActive ? P.accent : P.cardEdge,
              }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.stageLabel, { color: isActive ? P.accent : P.text }]}>{stage.label}</Text>
                <Text style={[s.stageSub, { color: P.textFaint }]}>{stage.sub}</Text>
              </View>
              {isActive && <Ionicons name="checkmark-circle" size={20} color={P.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppModal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  back: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -8,
  },
  eyebrow: {
    fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  title: {
    fontSize: 22, fontWeight: '800', letterSpacing: -0.5,
  },

  // Phase card
  phaseHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  iconTile: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  phaseSub:   { fontSize: 12, fontWeight: '500', marginTop: 1 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, alignItems: 'center',
  },
  phaseRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  phaseTick: { flex: 1, gap: 5 },
  phaseBar:  { borderRadius: 2 },
  phaseCap:  { fontSize: 10, letterSpacing: 0.2 },

  statsRow: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 4 },
  statVal:     { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
  statLbl:     { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  insightBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },

  // CTA
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },

  // Targets
  cardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  cardSub:   { fontSize: 12, fontWeight: '500' },
  targetsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  targetItem: { alignItems: 'center', gap: 2 },
  targetVal:  { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  targetUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  targetLbl:  { fontSize: 10, fontWeight: '600' },

  // Settings
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontSize: 14, fontWeight: '700' },
  settingSub:   { fontSize: 11, fontWeight: '500', marginTop: 1 },
  settingVal:   { fontSize: 13, fontWeight: '800', marginRight: 4 },

  // Stats grid
  statsGrid:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  statBox:     { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statBoxVal:  { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statBoxLbl:  { fontSize: 10, fontWeight: '600' },

  // History
  divider:    { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyDate:{ fontSize: 14, fontWeight: '700' },
  historySub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  deleteBtn:  { padding: 8, borderRadius: 8 },

  // Life stage modal
  stageRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  stageLabel: { fontSize: 14, fontWeight: '800' },
  stageSub:   { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
