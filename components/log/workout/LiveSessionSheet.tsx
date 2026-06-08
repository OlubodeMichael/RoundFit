import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostHog } from 'posthog-react-native';

import { useToast } from '@/components/ui/Toast';
import { getCatalogEntryById } from '@/config/workout-catalog';
import { useAuth } from '@/context/auth-context';
import { useWorkoutSession } from '@/context/workout-session-context';
import { useWorkouts } from '@/context/workout-context';
import { useHealth } from '@/hooks/use-health';
import { useSessionMetrics } from '@/hooks/use-session-metrics';
import { useWorkoutSessionLiveActivity, type SessionSet } from '@/hooks/use-workout-session-live-activity';
import { useUnits } from '@/hooks/use-units';
import { usePalette } from '@/lib/log-theme';
import type { SessionRecapData } from '@/types/session-recap';
import type { WorkoutSelection } from '@/types/workout-session';
import { LB_PER_KG } from '@/utils/body-units';
import { finishAndSaveWorkoutSession } from '@/utils/finish-workout-session';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutSessionRecapSheet } from './WorkoutSessionRecapSheet';
import type { WorkoutType } from './types';

// ── Small util ───────────────────────────────────────────────────────────────

/** Renders a weight stored in kg using the session's selected display unit.
 *  Shows an integer when the value lands on a whole number, else one decimal. */
function formatWeight(weightKg: number, unit: 'kg' | 'lb'): string {
  const v = unit === 'lb' ? weightKg * LB_PER_KG : weightKg;
  return v % 1 === 0 ? `${v}` : v.toFixed(1);
}

function fmtElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h   = Math.floor(sec / 3600);
  const m   = Math.floor((sec % 3600) / 60);
  const s   = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ActiveSessionView {
  workoutType: string;
  workoutName: string;
  startedAt: number;
  pausedAt: number | null;
  sets: SessionSet[];
  isStrength: boolean;
}

function resolveActiveSession(
  liveActive: ReturnType<typeof useWorkoutSessionLiveActivity>['active'],
  ctxSession: ReturnType<typeof useWorkoutSession>['session'],
  ctxStatus: ReturnType<typeof useWorkoutSession>['status'],
): ActiveSessionView | null {
  if (liveActive) {
    const mode = getCatalogEntryById(liveActive.workoutType)?.sessionMode ?? 'strength';
    return {
      workoutType: liveActive.workoutType,
      workoutName: liveActive.workoutName,
      startedAt: liveActive.startedAt,
      pausedAt: liveActive.pausedAt,
      sets: liveActive.sets,
      isStrength: mode === 'strength',
    };
  }
  if (ctxSession && (ctxStatus === 'active' || ctxStatus === 'paused')) {
    return {
      workoutType: ctxSession.workoutType,
      workoutName: ctxSession.workoutName,
      startedAt: ctxSession.startedAt,
      pausedAt: ctxSession.pausedAt,
      sets: ctxSession.sets,
      isStrength: ctxSession.mode === 'strength',
    };
  }
  return null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  selection?: WorkoutSelection;
}

export function LiveSessionSheet({ visible, onClose, selection }: Props) {
  const P       = usePalette();
  const insets  = useSafeAreaInsets();
  const toast   = useToast();
  const posthog = usePostHog();
  const { user } = useAuth();
  const session = useWorkoutSessionLiveActivity();
  const workoutSession = useWorkoutSession();
  const liveMetrics = useSessionMetrics();
  const { today: healthToday } = useHealth();
  const { logWorkout, logSets } = useWorkouts();
  const units = useUnits();

  const [recapVisible, setRecapVisible] = useState(false);
  const [recapData, setRecapData] = useState<SessionRecapData | null>(null);

  const activeSession = useMemo(
    () =>
      resolveActiveSession(
        session.active,
        workoutSession.session,
        workoutSession.status,
      ),
    [session.active, workoutSession.session, workoutSession.status],
  );

  const timerStartedAt = activeSession?.startedAt;
  const timerPausedAt = activeSession?.pausedAt ?? null;

  // ── Add-set form (strength only) ──────────────────────────────────────────
  // The user picks one or more exercises from the library; sets are logged
  // against whichever exercise is currently `active`. `chosenExercises`
  // preserves the order the user picked them so the chip strip + grouped
  // set list stay stable.
  const [chosenExercises, setChosenExercises] = useState<string[]>([]);
  const [activeExercise,  setActiveExercise]  = useState<string | null>(null);
  const [reps,     setReps]   = useState('');
  const [weight,   setWeight] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // Session-scoped weight unit. Defaults to whatever the user picked in
  // their profile but they can override it for this session via the toggle
  // next to the weight input. Persists in state but resets when the sheet
  // closes (same lifecycle as the rest of the form).
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(units.weightUnit);

  // ── Ticking timer ─────────────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (timerStartedAt == null) return;
    if (timerPausedAt != null) {
      setElapsedMs(timerPausedAt - timerStartedAt);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - timerStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerStartedAt, timerPausedAt]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // No session when opened — close instead of showing a type picker.
  useEffect(() => {
    if (visible && !activeSession && !recapVisible) {
      onCloseRef.current();
    }
  }, [visible, activeSession, recapVisible]);

  // Seed preset exercises from launcher selection or persisted session.
  useEffect(() => {
    if (!visible || !activeSession?.isStrength) return;
    const preset =
      selection?.presetExercises ??
      workoutSession.session?.presetExercises ??
      [];
    if (preset.length === 0) return;
    setChosenExercises(preset);
    setActiveExercise((prev) => prev ?? preset[0] ?? null);
  }, [visible, activeSession?.isStrength, selection, workoutSession.session?.presetExercises]);

  // ── Finish flow ──────────────────────────────────────────────────────────
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  // Reset state when sheet re-opens with no session yet.
  useEffect(() => {
    if (!visible) {
      setChosenExercises([]);
      setActiveExercise(null);
      setReps('');
      setWeight('');
      setWeightUnit(units.weightUnit);
      setPickerOpen(false);
      setConfirmFinish(false);
      setRecapVisible(false);
      setRecapData(null);
    }
  }, [visible, units.weightUnit]);

  const handleRecapDone = useCallback(() => {
    setRecapVisible(false);
    setRecapData(null);
    onClose();
  }, [onClose]);

  const pickerWorkoutType: WorkoutType =
    (activeSession?.workoutType as WorkoutType) ?? 'strength';

  const handlePauseToggle = useCallback(async () => {
    if (activeSession?.pausedAt != null) {
      await session.resume();
    } else {
      await session.pause();
    }
  }, [activeSession?.pausedAt, session]);

  const canAddSet =
    !!activeExercise &&
    parseInt(reps, 10) > 0 &&
    (weight === '' || !Number.isNaN(parseFloat(weight)));

  const handleAddSet = useCallback(async () => {
    if (!canAddSet || !activeExercise) return;
    // SessionSet stores weight in kg internally so the lock-screen widget
    // and back-end logSets always speak one unit. The user's input is in
    // whichever unit is selected on the toggle; convert at the boundary.
    const rawWeight = weight === '' ? 0 : parseFloat(weight);
    const weightKg  = units.toKg(rawWeight, weightUnit);
    await session.addSet({
      exercise: activeExercise,
      reps:     parseInt(reps, 10),
      weightKg,
    });
    setReps('');
    setWeight('');
    // Keep `activeExercise` so the user can quickly log multiple sets of the
    // same lift, then tap a different chip when they're ready to move on.
  }, [canAddSet, activeExercise, reps, weight, weightUnit, units, session]);

  const handleRemoveSet = useCallback(async (setId: string) => {
    await session.removeSet(setId);
  }, [session]);

  // Picker confirm: replace chosen list, keep active if it survives, else
  // promote the first remaining (or null if the list is now empty).
  const handlePickerConfirm = useCallback((next: string[]) => {
    setChosenExercises(next);
    setActiveExercise((prev) =>
      prev && next.includes(prev) ? prev : (next[0] ?? null),
    );
  }, []);

  const handleFinish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const sessionSnapshot = workoutSession.session;
      const completed = await session.end();
      if (!completed) {
        onClose();
        return;
      }

      if (!sessionSnapshot) {
        onClose();
        return;
      }

      const weightKg =
        user?.weightKg != null && user.weightKg > 0 ? user.weightKg : undefined;

      const { recapData } = await finishAndSaveWorkoutSession({
        session: sessionSnapshot,
        completed: {
          workoutType: completed.workoutType,
          workoutName: completed.workoutName,
          startedAt: completed.startedAt,
          sets: completed.sets,
        },
        logWorkout,
        logSets,
        healthToday,
        weightKg,
        userAge: user?.age,
        posthog,
      });

      setRecapData(recapData);
      setRecapVisible(true);

      await workoutSession.end();
    } catch (e) {
      console.error('[LiveSession] finish failed', e);
      toast.error('Could not save', 'Workout ended; sets may be lost.');
      onClose();
    } finally {
      finishingRef.current = false;
      setFinishing(false);
      setConfirmFinish(false);
    }
  }, [
    session,
    workoutSession,
    healthToday,
    user?.weightKg,
    logWorkout,
    logSets,
    posthog,
    toast,
    onClose,
  ]);

  if (recapVisible && recapData) {
    return (
      <WorkoutSessionRecapSheet
        visible={recapVisible}
        data={recapData}
        onDone={handleRecapDone}
      />
    );
  }

  if (!activeSession) return null;

  const isPaused = activeSession.pausedAt != null;
  const isStrength = activeSession.isStrength;
  const totalVolume = activeSession.sets.reduce(
    (acc, s) => acc + (s.weightKg > 0 ? s.weightKg * s.reps : 0), 0,
  );

  const grouped: { exercise: string; sets: SessionSet[] }[] = (() => {
    const map = new Map<string, SessionSet[]>();
    for (const s of activeSession.sets) {
      const arr = map.get(s.exercise) ?? [];
      arr.push(s);
      map.set(s.exercise, arr);
    }
    const out: { exercise: string; sets: SessionSet[] }[] = [];
    for (const name of chosenExercises) {
      if (map.has(name)) {
        out.push({ exercise: name, sets: map.get(name)! });
        map.delete(name);
      }
    }
    for (const [name, sets] of map) out.push({ exercise: name, sets });
    return out;
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: P.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 14, borderBottomColor: P.hair }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.hdrBtn}>
            <Ionicons name="chevron-down" size={22} color={P.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: isPaused ? P.textFaint : '#34D399' }]} />
              <Text style={[styles.liveLabel, { color: isPaused ? P.textFaint : '#34D399' }]}>
                {isPaused ? 'PAUSED' : 'LIVE'}
              </Text>
            </View>
            <Text style={[styles.hdrTitle, { color: P.text }]}>{activeSession.workoutName}</Text>
          </View>
          <View style={styles.hdrBtn} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 220 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Timer hero */}
          <View style={[styles.heroCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Text style={[styles.heroLabel, { color: P.textFaint }]}>ELAPSED</Text>
            <Text style={[styles.heroTime, { color: P.text }]}>{fmtElapsed(elapsedMs)}</Text>
            <View style={styles.heroMetrics}>
              {isStrength ? (
                <>
                  <View style={styles.heroMetricCell}>
                    <Text style={[styles.heroMetricVal, { color: P.text }]}>
                      {activeSession.sets.length}
                    </Text>
                    <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>
                      {activeSession.sets.length === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                  <View style={[styles.heroMetricSep, { backgroundColor: P.hair }]} />
                  <View style={styles.heroMetricCell}>
                    <Text style={[styles.heroMetricVal, { color: P.text }]}>
                      {Math.round(totalVolume)}
                    </Text>
                    <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>kg volume</Text>
                  </View>
                  {liveMetrics != null && (
                    <>
                      <View style={[styles.heroMetricSep, { backgroundColor: P.hair }]} />
                      <View style={styles.heroMetricCell}>
                        <Text style={[styles.heroMetricVal, { color: P.text }]}>
                          {liveMetrics.caloriesBurned}
                        </Text>
                        <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>kcal</Text>
                      </View>
                      {liveMetrics.heartRate != null && (
                        <>
                          <View style={[styles.heroMetricSep, { backgroundColor: P.hair }]} />
                          <View style={styles.heroMetricCell}>
                            <Text style={[styles.heroMetricVal, { color: P.text }]}>
                              {liveMetrics.heartRate}
                            </Text>
                            <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>bpm</Text>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.heroMetricCell}>
                    <Text style={[styles.heroMetricVal, { color: P.text }]}>
                      {liveMetrics?.caloriesBurned ?? 0}
                    </Text>
                    <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>kcal</Text>
                  </View>
                  <View style={[styles.heroMetricSep, { backgroundColor: P.hair }]} />
                  <View style={styles.heroMetricCell}>
                    <Text style={[styles.heroMetricVal, { color: P.text }]}>
                      {liveMetrics?.heartRate != null ? liveMetrics.heartRate : '—'}
                    </Text>
                    <Text style={[styles.heroMetricLbl, { color: P.textFaint }]}>bpm</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {isStrength && (
            <>
          <Text style={[styles.sectionLabel, { color: P.textFaint }]}>EXERCISES</Text>
          {chosenExercises.length === 0 && activeSession.sets.length === 0 ? (
            <View style={[styles.emptyHint, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="add-circle-outline" size={18} color={P.textFaint} />
              <Text style={[styles.emptyHintText, { color: P.textFaint }]}>
                Tap &quot;Choose exercises&quot; below to pick what you&apos;re training.
              </Text>
            </View>
          ) : (
            <>
              {grouped.map((g) => (
                <View
                  key={g.exercise}
                  style={[styles.exGroupCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}
                >
                  <View style={[styles.exGroupHead, { borderBottomColor: P.hair }]}>
                    <Text style={[styles.exGroupName, { color: P.text }]} numberOfLines={1}>
                      {g.exercise}
                    </Text>
                    <Text style={[styles.exGroupCount, { color: P.textFaint }]}>
                      {g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                  {g.sets.length === 0 ? (
                    <Text style={[styles.exGroupEmpty, { color: P.textFaint }]}>
                      No sets logged yet.
                    </Text>
                  ) : (
                    g.sets.map((s, i) => (
                      <SetRow
                        key={s.id}
                        index={i + 1}
                        set={s}
                        onRemove={() => void handleRemoveSet(s.id)}
                        P={P}
                        isLast={i === g.sets.length - 1}
                        displayUnit={weightUnit}
                      />
                    ))
                  )}
                </View>
              ))}
            </>
          )}
            </>
          )}
        </ScrollView>

        {/* Sticky add-set form + action row */}
        <View
          style={[
            styles.dock,
            { backgroundColor: P.bg, borderTopColor: P.cardEdge, paddingBottom: insets.bottom + 12 },
          ]}
        >
          {isStrength && (
            <>
          {/* Chosen-exercise chip strip + Add exercises button */}
          <View style={styles.chipRowOuter}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 6 }}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
            >
              {chosenExercises.length === 0 ? (
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.emptyChoosePill,
                    { backgroundColor: P.card, borderColor: P.cardEdge },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="list-outline" size={14} color={P.textFaint} />
                  <Text style={[styles.emptyChooseText, { color: P.textFaint }]}>
                    Choose exercises
                  </Text>
                </Pressable>
              ) : (
                chosenExercises.map((ex) => {
                  const isActive = ex === activeExercise;
                  return (
                    <Pressable
                      key={ex}
                      onPress={() => setActiveExercise(ex)}
                      style={({ pressed }) => [
                        styles.exChip,
                        {
                          backgroundColor: isActive ? P.workout : P.card,
                          borderColor:     isActive ? P.workout : P.cardEdge,
                        },
                        pressed && !isActive && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.exChipText,
                          { color: isActive ? '#fff' : P.text },
                        ]}
                        numberOfLines={1}
                      >
                        {ex}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                styles.addExerciseBtn,
                { backgroundColor: P.sunken, borderColor: P.cardEdge },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={6}
            >
              <Ionicons name="add" size={18} color={P.text} />
            </Pressable>
          </View>

          <View style={styles.numRow}>
            <View style={[styles.numInputWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Text style={[styles.numInputLabel, { color: P.textFaint }]}>REPS</Text>
              <TextInput
                style={[styles.numInput, { color: P.text }]}
                value={reps}
                onChangeText={setReps}
                placeholder="0"
                placeholderTextColor={P.textFaint}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.numInputWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              {/* Weight label + kg/lb segmented toggle. Toggling unit doesn't
                  rescale the value already typed; the value the user sees is
                  what gets logged in the selected unit, then converted to kg
                  at addSet time. */}
              <View style={styles.weightLabelRow}>
                <Text style={[styles.numInputLabel, { color: P.textFaint }]}>WEIGHT</Text>
                <View style={[styles.unitToggle, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
                  {(['kg', 'lb'] as const).map((u) => {
                    const isActive = u === weightUnit;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => setWeightUnit(u)}
                        hitSlop={4}
                        style={[
                          styles.unitToggleBtn,
                          isActive && { backgroundColor: P.workout },
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitToggleText,
                            { color: isActive ? '#fff' : P.textFaint },
                          ]}
                        >
                          {u}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <TextInput
                style={[styles.numInput, { color: P.text }]}
                value={weight}
                onChangeText={setWeight}
                placeholder="0"
                placeholderTextColor={P.textFaint}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable
              onPress={() => void handleAddSet()}
              disabled={!canAddSet}
              style={({ pressed }) => [
                styles.addSetBtn,
                { backgroundColor: canAddSet ? P.workout : P.sunken },
                pressed && canAddSet && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="checkmark" size={22} color={canAddSet ? '#fff' : P.textFaint} />
            </Pressable>
          </View>
            </>
          )}

          {/* Action row */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => void handlePauseToggle()}
              style={({ pressed }) => [
                styles.pauseBtn,
                { backgroundColor: P.sunken, borderColor: P.cardEdge },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={16} color={P.text} />
              <Text style={[styles.pauseBtnText, { color: P.text }]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmFinish(true)}
              style={({ pressed }) => [
                styles.finishBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="stop" size={16} color="#fff" />
              <Text style={styles.finishBtnText}>Finish</Text>
            </Pressable>
          </View>
        </View>

        {/* Exercise library picker (multi-select). Confirm replaces the
            chosen list; sets logged for an exercise are unaffected even if
            the user removes that exercise from the chips later. */}
        {isStrength && (
        <ExercisePicker
          visible={pickerOpen}
          workoutType={pickerWorkoutType}
          mode="multi"
          value={chosenExercises}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerOpen(false)}
        />
        )}

        {/* Confirm finish modal */}
        <Modal visible={confirmFinish} transparent animationType="fade">
          <Pressable style={styles.confirmOverlay} onPress={() => setConfirmFinish(false)}>
            <Pressable style={[styles.confirmCard, { backgroundColor: P.card }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.confirmTitle, { color: P.text }]}>Finish workout?</Text>
              <Text style={[styles.confirmSub, { color: P.textFaint }]}>
                {activeSession.sets.length} {activeSession.sets.length === 1 ? 'set' : 'sets'} · {fmtElapsed(elapsedMs)}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={() => setConfirmFinish(false)}
                  style={({ pressed }) => [
                    styles.confirmCancel,
                    { backgroundColor: P.sunken },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.confirmCancelText, { color: P.text }]}>Keep going</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleFinish()}
                  disabled={finishing}
                  style={({ pressed }) => [
                    styles.confirmFinish,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.confirmFinishText}>
                    {finishing ? 'Saving…' : 'Finish & save'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  index, set, onRemove, P, isLast, displayUnit,
}: {
  index: number;
  set: SessionSet;
  onRemove: () => void;
  P: ReturnType<typeof usePalette>;
  isLast: boolean;
  /** Unit to render the weight in. Source value in the set is always kg. */
  displayUnit: 'kg' | 'lb';
}) {
  const scale = useRef(new Animated.Value(0.95)).current;
  const op    = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(op,    { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [scale, op]);

  return (
    <Animated.View
      style={[
        styles.setRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair },
        { opacity: op, transform: [{ scale }] },
      ]}
    >
      <View style={[styles.setIndex, { backgroundColor: P.sunken }]}>
        <Text style={[styles.setIndexText, { color: P.textFaint }]}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.setExercise, { color: P.text }]} numberOfLines={1}>
          {set.exercise}
        </Text>
        <Text style={[styles.setMeta, { color: P.textFaint }]}>
          {set.reps} reps
          {set.weightKg > 0
            ? ` · ${formatWeight(set.weightKg, displayUnit)}${displayUnit}`
            : ''}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.setRemove}>
        <Ionicons name="close-circle" size={20} color={P.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hdrBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  // Hero
  heroCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
  },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  heroTime: { fontSize: 56, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  heroMetrics: { flexDirection: 'row', marginTop: 12, gap: 18, alignItems: 'center' },
  heroMetricCell: { alignItems: 'center', minWidth: 70 },
  heroMetricVal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  heroMetricLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  heroMetricSep: { width: StyleSheet.hairlineWidth, height: 28 },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8, paddingHorizontal: 2 },

  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyHintText: { fontSize: 13, fontWeight: '500' },

  setsCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  setIndex: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  setIndexText: { fontSize: 11, fontWeight: '800' },
  setExercise: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  setMeta: { fontSize: 12, marginTop: 2 },
  setRemove: { padding: 4 },

  dock: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exerciseInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  exerciseValue: { flex: 1, fontSize: 15, fontWeight: '600' },

  // Chip strip + Add button row in the sticky dock
  chipRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 180,
  },
  exChipText: { fontSize: 12, fontWeight: '800', letterSpacing: -0.1 },
  emptyChoosePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyChooseText: { fontSize: 13, fontWeight: '700' },
  addExerciseBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Grouped-by-exercise set cards in the main scroll area
  exGroupCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  exGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exGroupName:  { fontSize: 14, fontWeight: '800', letterSpacing: -0.2, flex: 1, marginRight: 8 },
  exGroupCount: { fontSize: 11, fontWeight: '700' },
  exGroupEmpty: { fontSize: 12, paddingHorizontal: 14, paddingVertical: 12, fontStyle: 'italic' },

  numRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  numInputWrap: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  numInputLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.0 },
  numInput: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },

  // kg / lb segmented toggle next to the WEIGHT label
  weightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
  },
  unitToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  addSetBtn: { width: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  actions: { flexDirection: 'row', gap: 10 },
  pauseBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pauseBtnText: { fontSize: 14, fontWeight: '800' },
  finishBtn: {
    flex: 1.4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: 14,
    backgroundColor: 'rgb(158, 43, 46)',
  },
  finishBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Confirm modal
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    width: '100%', borderRadius: 20, padding: 22, gap: 6,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  confirmSub:   { fontSize: 13, fontWeight: '500' },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  confirmCancel: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 14, fontWeight: '800' },
  confirmFinish: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgb(158, 43, 46)' },
  confirmFinishText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
