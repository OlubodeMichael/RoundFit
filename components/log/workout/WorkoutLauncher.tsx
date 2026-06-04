import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import {
  getBurnCatalogEntries,
  getCatalogEntryById,
  WORKOUT_CATALOG_ENTRIES,
} from '@/config/workout-catalog';
import { UI_INTENSITY_MAP } from '@/context/workout-context';
import { useWorkoutRecent } from '@/hooks/use-workout-recent';
import { usePalette } from '@/lib/log-theme';
import type {
  WorkoutLauncherIntent,
  WorkoutSelection,
} from '@/types/workout-session';

import { WorkoutActivityGrid } from './WorkoutActivityGrid';
import {
  filterCatalogByCategory,
  getCatalogEntryCategory,
  WorkoutCategoryChips,
  type WorkoutCategoryFilter,
} from './WorkoutCategoryChips';
import { WorkoutConfigureStep } from './WorkoutConfigureStep';
import { WorkoutLauncherHeader } from './WorkoutLauncherHeader';
import type { Intensity } from './types';

export interface WorkoutLauncherProps {
  visible: boolean;
  onClose: () => void;
  intent: WorkoutLauncherIntent;
  initialActivityId?: string;
  initialCalorieGoal?: number;
  onLiveStart: (selection: WorkoutSelection) => void;
  onLogSave?: (selection: WorkoutSelection) => void;
}

type LauncherStep = 'browse' | 'configure';

function isStartIntent(intent: WorkoutLauncherIntent): intent is 'live' | 'burn' {
  return intent === 'live' || intent === 'burn';
}

export function WorkoutLauncher({
  visible,
  onClose,
  intent,
  initialActivityId,
  initialCalorieGoal,
  onLiveStart,
  onLogSave,
}: WorkoutLauncherProps) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { recordRecentFromSelection } = useWorkoutRecent();

  const [step, setStep] = useState<LauncherStep>('browse');
  const [category, setCategory] = useState<WorkoutCategoryFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<WorkoutCatalogEntry | null>(null);
  const [presetExercises, setPresetExercises] = useState<string[]>([]);
  const [calorieGoalEnabled, setCalorieGoalEnabled] = useState(false);
  const [calorieGoalText, setCalorieGoalText] = useState('');
  const [logHours, setLogHours] = useState('0');
  const [logMinutes, setLogMinutes] = useState('45');
  const [logIntensity, setLogIntensity] = useState<Intensity>('moderate');
  const [logNotes, setLogNotes] = useState('');

  const catalogEntries = useMemo(
    () => (intent === 'burn' ? getBurnCatalogEntries() : [...WORKOUT_CATALOG_ENTRIES]),
    [intent],
  );

  const resetState = useCallback(() => {
    setStep('browse');
    setCategory('all');
    setSelectedEntry(null);
    setPresetExercises([]);
    setCalorieGoalEnabled(false);
    setCalorieGoalText('');
    setLogHours('0');
    setLogMinutes('45');
    setLogIntensity('moderate');
    setLogNotes('');
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
      return;
    }

    posthog.capture('workout_launcher_opened', { intent });

    const preset = initialActivityId ? getCatalogEntryById(initialActivityId) : undefined;
    if (preset && catalogEntries.some((e) => e.id === preset.id)) {
      setSelectedEntry(preset);
      if (isStartIntent(intent) || intent === 'log') setStep('configure');
    }
    if (initialCalorieGoal != null && initialCalorieGoal > 0) {
      setCalorieGoalEnabled(true);
      setCalorieGoalText(String(initialCalorieGoal));
    }
  }, [visible, intent, initialActivityId, initialCalorieGoal, posthog, resetState, catalogEntries]);

  const filteredEntries = useMemo(
    () => filterCatalogByCategory(catalogEntries, category),
    [catalogEntries, category],
  );

  const handleActivitySelect = useCallback(
    (entry: WorkoutCatalogEntry) => {
      setSelectedEntry(entry);
      setPresetExercises([]);
      posthog.capture('workout_activity_selected', {
        activity_id: entry.id,
        category: getCatalogEntryCategory(entry),
        intent,
      });
      if (isStartIntent(intent) || intent === 'log') setStep('configure');
    },
    [intent, posthog],
  );

  const handleStartLive = useCallback(() => {
    if (!selectedEntry || !isStartIntent(intent)) return;

    const parsedGoal = parseInt(calorieGoalText, 10);
    const calorieGoal =
      calorieGoalEnabled && !Number.isNaN(parsedGoal) && parsedGoal > 0 ? parsedGoal : undefined;

    const selection: WorkoutSelection = {
      entry: selectedEntry,
      intent,
      ...(presetExercises.length > 0 ? { presetExercises } : {}),
      ...(calorieGoal != null ? { calorieGoal } : {}),
    };

    posthog.capture('workout_live_started', {
      activity_id: selectedEntry.id,
      session_mode: selectedEntry.sessionMode,
      intent,
      has_preset_exercises: presetExercises.length > 0,
      has_calorie_goal: calorieGoal != null,
    });

    recordRecentFromSelection(selection);
    onLiveStart(selection);
    onClose();
  }, [
    selectedEntry,
    intent,
    calorieGoalText,
    calorieGoalEnabled,
    presetExercises,
    posthog,
    recordRecentFromSelection,
    onLiveStart,
    onClose,
  ]);

  const handleLogSave = useCallback(() => {
    if (!selectedEntry || intent !== 'log' || !onLogSave) return;

    const durationMins =
      (parseInt(logHours, 10) || 0) * 60 + (parseInt(logMinutes, 10) || 0);
    if (durationMins === 0) return;

    if (selectedEntry.sessionMode === 'strength' && presetExercises.length === 0) return;

    const backendIntensity = UI_INTENSITY_MAP[logIntensity] ?? 'moderate';

    const selection: WorkoutSelection = {
      entry: selectedEntry,
      intent: 'log',
      durationMins,
      intensity: backendIntensity,
      ...(presetExercises.length > 0 ? { presetExercises } : {}),
      ...(logNotes.trim() ? { notes: logNotes.trim() } : {}),
    };

    recordRecentFromSelection(selection);
    onLogSave(selection);
    onClose();
  }, [
    selectedEntry,
    intent,
    onLogSave,
    logHours,
    logMinutes,
    logIntensity,
    logNotes,
    presetExercises,
    recordRecentFromSelection,
    onClose,
  ]);

  const logDurationMins =
    (parseInt(logHours, 10) || 0) * 60 + (parseInt(logMinutes, 10) || 0);
  const canSaveLog =
    intent === 'log' &&
    selectedEntry != null &&
    logDurationMins > 0 &&
    (selectedEntry.sessionMode !== 'strength' || presetExercises.length > 0);

  const title =
    step === 'browse'
      ? intent === 'burn'
        ? 'Burn calories'
        : intent === 'live'
          ? 'Start a workout'
          : 'Log a workout'
      : 'Configure workout';

  const browseHint =
    intent === 'burn'
      ? 'Choose an activity to burn remaining calories, then confirm before the timer starts.'
      : intent === 'log'
        ? 'Choose an activity, then enter duration and intensity before saving.'
        : 'Choose an activity, then confirm before the timer starts.';

  const headerBack = step === 'configure' ? () => setStep('browse') : onClose;
  const headerBackIcon = step === 'configure' ? 'chevron-back' : 'close';

  const showFooter = step === 'configure' && selectedEntry != null;
  const footerLabel =
    intent === 'log' ? 'Save workout' : intent === 'burn' ? 'Start burn' : 'Start workout';
  const footerAction = intent === 'log' ? handleLogSave : handleStartLive;
  const footerDisabled = intent === 'log' && !canSaveLog;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: P.bg }]}>
        <WorkoutLauncherHeader
          title={title}
          backIcon={headerBackIcon}
          onBack={headerBack}
          onClose={onClose}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + (showFooter ? 100 : 24) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'browse' && (
            <>
              <Text style={[styles.hint, { color: P.textFaint }]}>{browseHint}</Text>
              {(intent === 'live' || intent === 'log') && (
                <WorkoutCategoryChips value={category} onChange={setCategory} />
              )}
              <WorkoutActivityGrid
                entries={filteredEntries}
                selectedId={selectedEntry?.id ?? null}
                onSelect={handleActivitySelect}
              />
            </>
          )}

          {step === 'configure' && selectedEntry && (
            <WorkoutConfigureStep
              entry={selectedEntry}
              intent={intent}
              presetExercises={presetExercises}
              onPresetExercisesChange={setPresetExercises}
              calorieGoalEnabled={calorieGoalEnabled}
              onCalorieGoalEnabledChange={setCalorieGoalEnabled}
              calorieGoalText={calorieGoalText}
              onCalorieGoalTextChange={setCalorieGoalText}
              logHours={logHours}
              onLogHoursChange={setLogHours}
              logMinutes={logMinutes}
              onLogMinutesChange={setLogMinutes}
              logIntensity={logIntensity}
              onLogIntensityChange={setLogIntensity}
              logNotes={logNotes}
              onLogNotesChange={setLogNotes}
            />
          )}
        </ScrollView>

        {showFooter && (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: P.bg,
                borderTopColor: P.hair,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <Pressable
              onPress={footerAction}
              disabled={footerDisabled}
              style={({ pressed }) => [
                styles.startBtn,
                {
                  backgroundColor: footerDisabled ? P.cardEdge : P.workout,
                },
                pressed && !footerDisabled && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.startBtnText}>{footerLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 16 },
  hint: { fontSize: 13, lineHeight: 19 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  startBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});
