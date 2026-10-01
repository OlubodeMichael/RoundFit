import {
    CALORIES_PER_MINUTE,
    INTENSITY_OPTIONS,
    WORKOUT_TYPES,
} from "@/components/log/workout/constants";
import type {
    Intensity,
    SelectedExercise,
    SetRow,
    WorkoutType,
} from "@/components/log/workout/types";
import { AppModal } from "@/components/ui/AppModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/auth-context";
import type { Workout } from "@/context/workout-context";
import {
    UI_INTENSITY_MAP,
    UI_WORKOUT_TYPE_MAP,
    useWorkouts,
} from "@/context/workout-context";
import {
    DayNavigator,
    usePalette,
    useScreenPadding,
} from "@/lib/log-theme";
import { LiveSessionSheet } from "@/components/log/workout/LiveSessionSheet";
import { WorkoutHistorySection } from "@/components/log/workout/WorkoutHistorySection";
import { WorkoutTodaySection } from "@/components/log/workout/WorkoutTodaySection";
import { formatHistoryDateLabel } from "@/components/log/workout/workout-display";
import { WorkoutLauncher } from "@/components/log/workout/WorkoutLauncher";
import { WorkoutActionRow } from "@/components/log/workout/WorkoutActionRow";
import { WorkoutDurationPicker } from "@/components/log/workout/WorkoutDurationPicker";
import { WorkoutContinueCard } from "@/components/log/workout/WorkoutContinueCard";
import { WorkoutPendingSection } from "@/components/log/workout/WorkoutPendingSection";
import { WorkoutSessionRecoveryBanner } from "@/components/log/workout/WorkoutSessionRecoveryBanner";
import { MuscleGroupBanner } from "@/components/log/workout/MuscleGroupBanner";
import { ExerciseOptionGroup } from "@/components/log/workout/ExerciseOptionGroup";
import { ExerciseCustomAddRow } from "@/components/log/workout/ExerciseCustomAddRow";
import { ExercisePickerFilters } from "@/components/log/workout/ExercisePickerFilters";
import {
  ExerciseSetsEditorModal,
  type ExerciseSetDraft,
} from "@/components/log/workout/ExerciseSetsEditorModal";
import { useExerciseLibrary } from "@/hooks/use-exercise-library";
import { getCatalogEntryById, getBackendTypeForCatalogId } from "@/config/workout-catalog";
import { useWorkoutSession } from "@/context/workout-session-context";
import { useWorkoutSessionLiveActivity } from "@/hooks/use-workout-session-live-activity";
import { useWorkoutHistory } from "@/hooks/use-workout-history";
import { useWorkoutImportReview } from "@/hooks/use-workout-import-review";
import { usePendingWorkoutImports } from "@/hooks/use-pending-workout-imports";
import { useUnits } from "@/hooks/use-units";
import { formatWeightKgField, storedWeightToKg } from "@/utils/body-units";
import { consumeWorkoutEditId } from "@/utils/pending-workout-edit";
import {
  fetchWorkoutSetsCached,
  findWorkoutByIdCached,
} from "@/utils/workout-cache";
import { addLocalCalendarDays, getLocalDateString } from "@/utils/date";
import type { WorkoutLauncherIntent, WorkoutSelection } from "@/types/workout-session";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Constants ─────────────────────────────────────────────────────────────────

const INTENSITY_CAL_RATE = {
  light: CALORIES_PER_MINUTE.low,
  moderate: CALORIES_PER_MINUTE.moderate,
  hard: CALORIES_PER_MINUTE.high,
} as const;

function newSet(): SetRow {
  return {
    id: `s${Date.now()}_${Math.random().toString(36).slice(2)}`,
    reps: "",
    weight: "",
  };
}

// ── Log workout sheet ─────────────────────────────────────────────────────────

type SheetPage = "form" | "exercises";

function LogWorkoutSheet({
  visible,
  onClose,
  editWorkout,
}: {
  visible: boolean;
  onClose: () => void;
  editWorkout?: Workout | null;
}) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const posthog = usePostHog();
  const units = useUnits();
  const { logWorkout, logSets, deleteWorkout } = useWorkouts();

  const [page, setPage] = useState<SheetPage>("form");
  const [type, setType] = useState<WorkoutType>("strength");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("45");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [editingExercise, setEditingExercise] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setPage("form");
  }, [visible]);

  // Pre-fill form when editing an existing workout
  useEffect(() => {
    if (!visible || !editWorkout) return;
    const reverseType = Object.entries(UI_WORKOUT_TYPE_MAP).find(
      ([, v]) => v === editWorkout.type,
    )?.[0] as WorkoutType | undefined;
    setType(reverseType ?? "other");
    const h = Math.floor(editWorkout.duration_mins / 60);
    const m = editWorkout.duration_mins % 60;
    setHours(String(h));
    setMinutes(String(m));
    const reverseIntensity = Object.entries(UI_INTENSITY_MAP).find(
      ([, v]) => v === editWorkout.intensity,
    )?.[0] as Intensity | undefined;
    setIntensity(reverseIntensity ?? "moderate");
    setNotes(editWorkout.notes ?? "");
    setNotesOpen(!!editWorkout.notes);
    if (editWorkout.sets?.length) {
      const grouped: Record<string, SetRow[]> = {};
      for (const s of editWorkout.sets) {
        if (!grouped[s.exercise]) grouped[s.exercise] = [];
        grouped[s.exercise].push({
          id: s.id,
          reps: String(s.reps ?? ""),
          weight:
            s.weight != null
              ? formatWeightKgField(storedWeightToKg(s.weight, s.weight_unit), units.profileUnit)
              : "",
        });
      }
      setSelected(
        Object.entries(grouped).map(([name, sets]) => ({ name, sets })),
      );
    }
  }, [visible, editWorkout]); // eslint-disable-line react-hooks/exhaustive-deps

  const isStrength = type === "strength";
  const totalMinutes = useMemo(
    () => (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0),
    [hours, minutes],
  );
  const estimatedCals = useMemo(
    () => Math.round(totalMinutes * CALORIES_PER_MINUTE[intensity]),
    [totalMinutes, intensity],
  );

  const { sections, customNames, addCustomExercise, removeCustomExercise } =
    useExerciseLibrary(type, search);

  const visibleLibrary = useMemo(
    () =>
      activeCategory === "all"
        ? sections
        : sections.filter((s) => s.category === activeCategory),
    [sections, activeCategory],
  );
  const categoryOptions = useMemo(
    () => ["all", ...sections.map((s) => s.category)],
    [sections],
  );
  const selectedNames = useMemo(
    () => new Set(selected.map((e) => e.name)),
    [selected],
  );

  const handleTypeChange = (t: WorkoutType) => {
    setType(t);
    setSelected([]);
    setSearch("");
    setActiveCategory("all");
  };

  const toggleExercise = useCallback((name: string) => {
    setSelected((prev) =>
      prev.some((e) => e.name === name)
        ? prev.filter((e) => e.name !== name)
        : [...prev, { name, sets: [newSet()] }],
    );
  }, []);

  const handleAddCustom = useCallback(
    async (name: string, category: string) => {
      const result = await addCustomExercise(name, category);
      if (result === "added") {
        setActiveCategory(category);
      }
      return result;
    },
    [addCustomExercise],
  );

  const handleRemoveCustom = useCallback(
    async (name: string) => {
      await removeCustomExercise(name);
      setSelected((prev) => prev.filter((e) => e.name !== name));
    },
    [removeCustomExercise],
  );

  const resetForm = useCallback(() => {
    setType("strength");
    setHours("0");
    setMinutes("45");
    setIntensity("moderate");
    setNotes("");
    setSearch("");
    setSelected([]);
    setActiveCategory("all");
    setNotesOpen(false);
    setEditingExercise(null);
    setPage("form");
  }, []);

  const handleSave = async () => {
    if (totalMinutes === 0) {
      toast.warning("Missing duration", "How long was this workout?");
      return;
    }
    if (isStrength && selected.length === 0) {
      toast.warning("No exercises", "Pick at least one exercise.");
      return;
    }
    if (
      isStrength &&
      selected.some(
        (exercise) =>
          exercise.sets.length === 0 ||
          exercise.sets.some((set) => {
            const reps = parseInt(set.reps, 10);
            const weight = parseFloat(set.weight);
            return !Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0;
          }),
      )
    ) {
      toast.warning("Incomplete sets", "Add reps and weight for every set.");
      return;
    }
    const label =
      (parseInt(hours) || 0) > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
    setSaving(true);
    try {
      if (editWorkout) await deleteWorkout(editWorkout.id);
      const w = await logWorkout({
        type: UI_WORKOUT_TYPE_MAP[type] ?? "other",
        duration_mins: totalMinutes,
        intensity: UI_INTENSITY_MAP[intensity] ?? "moderate",
        calories_burned: estimatedCals,
        source: "manual",
      });
      if (isStrength && selected.length > 0) {
        await logSets(
          w.id,
          selected.flatMap((ex) =>
            ex.sets.map((s) => ({
              exercise: ex.name,
              sets: 1,
              reps: parseInt(s.reps) || undefined,
              weight: s.weight.trim() === ""
                ? undefined
                : units.toKg(parseFloat(s.weight), units.weightUnit),
              weight_unit: "kg" as const,
            })),
          ),
        );
      }
      posthog.capture("workout_logged", {
        workout_type: type,
        duration_mins: totalMinutes,
        intensity,
        exercises_count: selected.length,
        estimated_cals: estimatedCals,
      });
      toast.success(
        editWorkout ? "Updated!" : "Logged!",
        `${isStrength && selected.length ? `${selected.length} exercise${selected.length !== 1 ? "s" : ""} · ` : ""}${label}`,
      );
      resetForm();
      onClose();
    } catch {
      toast.error("Failed to save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const activeTypeLabel =
    WORKOUT_TYPES.find((t) => t.id === type)?.label ?? "Workout";

  return (
    <AppModal
      visible={visible}
      onClose={page === "exercises" ? () => setPage("form") : onClose}
      sheetHeight="full"
      openAnimation="ease"
      dismissGestureArea="handle"
      keyboardAvoiding
    >
      {/* Exercise picker keeps a compact navigation header. */}
      {page === "exercises" && <View style={[sh.header, { borderBottomColor: P.hair }]}>
        <Pressable
          onPress={() => setPage("form")}
          hitSlop={12}
          style={[sh.navBtn, { backgroundColor: P.sunken }]}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={P.text}
          />
        </Pressable>
        <Text style={[sh.sheetTitle, { color: P.text }]}>
          Select exercises
        </Text>
        <Pressable
          onPress={() => setPage("form")}
          style={[sh.doneSmall, { backgroundColor: P.workout }]}
        >
          <Text style={sh.doneSmallText}>Done</Text>
        </Pressable>
      </View>}

      {/* ── EXERCISE PICKER ── */}
      {page === "exercises" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
            <ExercisePickerFilters
              search={search}
              onSearchChange={setSearch}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              categoryOptions={categoryOptions}
              accentColor={P.workout}
              sunkenColor={P.sunken}
            surfaceColor={P.card}
            borderColor={P.cardEdge}
              textColor={P.text}
              textFaintColor={P.textFaint}
            />

            {selected.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {selected.map((ex) => (
                  <Pressable
                    key={ex.name}
                    onPress={() => toggleExercise(ex.name)}
                    style={[
                      sh.selectedPill,
                      {
                        backgroundColor: P.workoutSoft,
                        borderColor: P.workout,
                      },
                    ]}
                  >
                    <Text
                      style={[sh.selectedPillText, { color: P.workout }]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                    <Ionicons name="close" size={12} color={P.workout} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 6,
              paddingBottom: insets.bottom + 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {visibleLibrary.map((section) => (
              <View key={section.category} style={{ marginTop: 18 }}>
                <MuscleGroupBanner category={section.category} />
                <ExerciseOptionGroup
                  category={section.category}
                  exercises={section.exercises}
                  selectedNames={selectedNames}
                  mode="multi"
                  onToggle={toggleExercise}
                  accentColor={P.workout}
                  accentSoft={P.workoutSoft}
                  textColor={P.text}
                  textFaintColor={P.textFaint}
                  borderColor={P.cardEdge}
                  surfaceColor={P.card}
                  customNames={customNames}
                  onRemoveCustom={handleRemoveCustom}
                />
                <ExerciseCustomAddRow
                  category={section.category}
                  onAdd={handleAddCustom}
                  accentColor={P.workout}
                  sunkenColor={P.sunken}
                  borderColor={P.cardEdge}
                  textColor={P.text}
                  textFaintColor={P.textFaint}
                />
              </View>
            ))}
          </ScrollView>

          {/* Bottom bar */}
          <View
            style={[
              sh.doneBar,
              {
                backgroundColor: P.card,
                borderTopColor: P.hair,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <View style={[sh.doneCount, { backgroundColor: P.workoutSoft }]}>
              <Text style={[sh.doneCountNum, { color: P.workout }]}>
                {selected.length}
              </Text>
              <Text style={[sh.doneCountLbl, { color: P.workout }]}>
                selected
              </Text>
            </View>
            <Pressable
              onPress={() => setPage("form")}
              style={[sh.donePrimary, { backgroundColor: P.workout }]}
            >
              <Text style={sh.donePrimaryText}>Confirm selection</Text>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── FORM ── */}
      {page === "form" && (
        <View style={fp.formRoot}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={fp.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={fp.formHeader}>
            <View style={fp.formHeaderCopy}>
              <Text style={[fp.formEyebrow, { color: P.workout }]}>
                {editWorkout ? "EDIT WORKOUT" : "NEW WORKOUT"}
              </Text>
              <Text style={[fp.formTitle, { color: P.text }]}>
                {editWorkout ? "Workout details" : "Log manually"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={({ pressed }) => [
                fp.formClose,
                { backgroundColor: P.sunken },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={17} color={P.textDim} />
            </Pressable>
          </View>
          {/* Activity type — horizontal scroll */}
          <View style={fp.section}>
            <Text style={[fp.sectionLabel, { color: P.textFaint }]}>
              ACTIVITY
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 20 }}
            >
              {WORKOUT_TYPES.map((t) => {
                const active = t.id === type;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => handleTypeChange(t.id)}
                    style={({ pressed }) => [
                      fp.typeCard,
                      {
                        backgroundColor: active ? P.workout : P.card,
                        borderColor: active ? P.workout : P.cardEdge,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View
                      style={[
                        fp.typeIconWrap,
                        {
                          backgroundColor: active
                            ? "rgba(255,255,255,0.18)"
                            : P.workoutSoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name={t.icon}
                        size={22}
                        color={active ? "#fff" : P.workout}
                      />
                    </View>
                    <Text
                      style={[
                        fp.typeLabel,
                        { color: active ? "#fff" : P.textDim },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={fp.section}>
            <WorkoutDurationPicker
              hours={hours}
              minutes={minutes}
              onHoursChange={setHours}
              onMinutesChange={setMinutes}
              estimatedCals={estimatedCals}
              totalMinutes={totalMinutes}
            />
          </View>

          {/* Intensity */}
          <View style={fp.section}>
            <Text style={[fp.sectionLabel, { color: P.textFaint }]}>
              INTENSITY
            </Text>
            <View style={fp.intGrid}>
              {INTENSITY_OPTIONS.map((opt) => {
                const active = opt.id === intensity;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setIntensity(opt.id)}
                    style={({ pressed }) => [
                      fp.intCard,
                      {
                        backgroundColor: active ? P.workout + "18" : P.card,
                        borderColor: active ? P.workout : P.cardEdge,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {/* Dot meter */}
                    <View style={fp.dotMeter}>
                      {[1, 2, 3, 4].map((d) => (
                        <View
                          key={d}
                          style={[
                            fp.dotSeg,
                            {
                              backgroundColor:
                                d <= opt.dots
                                  ? active
                                    ? P.workout
                                    : P.workout + "55"
                                  : P.cardEdge,
                              height: 4 + d * 3,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text
                      style={[
                        fp.intLabel,
                        { color: active ? P.workout : P.textDim },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Exercises */}
          <View style={fp.section}>
            <View style={fp.exHead}>
              <Text style={[fp.sectionLabel, { color: P.textFaint }]}>
                EXERCISES
              </Text>
              {selected.length > 0 && (
                <View style={[fp.exBadge, { backgroundColor: P.workoutSoft }]}>
                  <Text style={[fp.exBadgeText, { color: P.workout }]}>
                    {selected.length}
                  </Text>
                </View>
              )}
            </View>

            {selected.length > 0 && (
              <View style={[fp.exerciseList, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                {selected.map((exercise, index) => (
                  <EditExerciseSummaryRow
                    key={exercise.name}
                    exercise={exercise}
                    showDivider={index > 0}
                    weightUnit={units.weightUnit}
                    onPress={() => setEditingExercise(exercise.name)}
                  />
                ))}
              </View>
            )}

            {/* Add/edit exercises button */}
            <Pressable
              onPress={() => setPage("exercises")}
              style={({ pressed }) => [
                fp.addExBtn,
                selected.length > 0
                  ? { backgroundColor: P.card, borderColor: P.cardEdge }
                  : { backgroundColor: P.workout, borderColor: P.workout },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={selected.length > 0 ? "pencil-outline" : "add"}
                size={16}
                color={selected.length > 0 ? P.workout : "#fff"}
              />
              <Text
                style={[
                  fp.addExText,
                  { color: selected.length > 0 ? P.workout : "#fff" },
                ]}
              >
                {selected.length > 0 ? "Edit exercises" : "Add exercises"}
              </Text>
            </Pressable>
          </View>

          {/* Notes */}
          <View style={fp.section}>
            <Pressable
              onPress={() => setNotesOpen((v) => !v)}
              style={fp.notesToggle}
            >
              <Ionicons
                name={notesOpen ? "chevron-down" : "chevron-forward"}
                size={14}
                color={P.textFaint}
              />
              <Text style={[fp.notesToggleText, { color: P.textFaint }]}>
                Notes
              </Text>
              {notes.length > 0 && (
                <View style={[fp.notesDot, { backgroundColor: P.workout }]} />
              )}
            </Pressable>
            {notesOpen && (
              <View
                style={[
                  fp.notesBox,
                  { backgroundColor: P.card, borderColor: P.cardEdge },
                ]}
              >
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="PRs, form cues, how it felt…"
                  placeholderTextColor={P.textFaint}
                  multiline
                  style={[fp.notesInput, { color: P.text }]}
                />
              </View>
            )}
          </View>

          </ScrollView>
          <View
            style={[
              fp.saveBar,
              {
                borderTopColor: P.hair,
                paddingBottom: 8,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                fp.cancelButton,
                { borderColor: P.cardEdge },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[fp.cancelButtonText, { color: P.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving, disabled: saving }}
              disabled={saving}
              onPress={handleSave}
              style={({ pressed }) => [
                fp.saveButton,
                { backgroundColor: P.workout },
                pressed && !saving && { opacity: 0.82 },
                saving && { opacity: 0.6 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={fp.saveButtonText}>
                  {editWorkout ? "Save changes" : `Log ${activeTypeLabel.toLowerCase()}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
      <ExerciseSetsEditorModal
        visible={editingExercise != null}
        exercise={editingExercise ?? ""}
        sets={selected.find((exercise) => exercise.name === editingExercise)?.sets ?? []}
        weightUnit={units.weightUnit}
        onChange={(sets: ExerciseSetDraft[]) => {
          if (!editingExercise) return;
          setSelected((current) =>
            current.map((exercise) =>
              exercise.name === editingExercise ? { ...exercise, sets } : exercise,
            ),
          );
        }}
        onClose={() => setEditingExercise(null)}
      />
    </AppModal>
  );
}

function EditExerciseSummaryRow({
  exercise,
  showDivider,
  weightUnit,
  onPress,
}: {
  exercise: SelectedExercise;
  showDivider: boolean;
  weightUnit: "kg" | "lb";
  onPress: () => void;
}) {
  const P = usePalette();
  const complete = exercise.sets.length > 0 && exercise.sets.every((set) => {
    const reps = parseInt(set.reps, 10);
    const weight = parseFloat(set.weight);
    return Number.isFinite(reps) && reps > 0 && Number.isFinite(weight) && weight >= 0;
  });
  const firstSet = exercise.sets[0];
  const preview = firstSet
    ? `${firstSet.reps || "–"} reps × ${firstSet.weight || "–"} ${weightUnit}`
    : "Add set details";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit sets for ${exercise.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        fp.exerciseSummaryRow,
        showDivider && { borderTopColor: P.hair, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: P.sunken },
      ]}
    >
      <View style={[fp.exerciseSummaryIcon, { backgroundColor: P.workoutSoft }]}>
        <Ionicons name="barbell-outline" size={18} color={P.workout} />
      </View>
      <View style={fp.exerciseSummaryCopy}>
        <Text style={[fp.exerciseSummaryName, { color: P.text }]} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[fp.exerciseSummaryMeta, { color: P.textFaint }]} numberOfLines={1}>
          {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"} · {preview}
        </Text>
      </View>
      <View style={fp.exerciseSummaryStatus}>
        {complete && <Ionicons name="checkmark-circle" size={19} color={P.workout} />}
        <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
      </View>
    </Pressable>
  );
}

// ── Sheet styles ──────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  doneSmall: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneSmallText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 200,
  },
  selectedPillText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  doneBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneCount: {
    width: 80,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  doneCountNum: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 28,
    lineHeight: 28,
  },
  doneCountLbl: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  donePrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    height: 50,
  },
  donePrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});

// ── Form styles ───────────────────────────────────────────────────────────────

const fp = StyleSheet.create({
  formRoot: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 20 },
  formHeader: { flexDirection: "row", alignItems: "flex-start", paddingTop: 4 },
  formHeaderCopy: { flex: 1 },
  formEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  formTitle: {
    fontFamily: "Syne_700Bold",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  formClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { fontSize: 15, fontWeight: "700" },
  saveButton: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: "Syne_800ExtraBold",
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Activity type
  typeCard: {
    width: 90,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 10,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: { fontSize: 11, fontWeight: "700", letterSpacing: -0.1 },

  // Intensity
  intGrid: { flexDirection: "row", gap: 8 },
  intCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 8,
  },
  dotMeter: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 16,
  },
  dotSeg: { width: 6, borderRadius: 2 },
  intLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.1 },

  // Exercise cards
  exHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  exBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  exBadgeText: { fontSize: 11, fontWeight: "800" },
  exerciseList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 12,
  },
  exerciseSummaryRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exerciseSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseSummaryCopy: { flex: 1, gap: 4 },
  exerciseSummaryName: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  exerciseSummaryMeta: { fontSize: 12, fontWeight: "600" },
  exerciseSummaryStatus: { flexDirection: "row", alignItems: "center", gap: 2 },
  addExBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 15,
  },
  addExText: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },

  notesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  notesToggleText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  notesDot: { width: 6, height: 6, borderRadius: 3 },
  notesBox: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
  },
  notesInput: { fontSize: 14, fontWeight: "500", lineHeight: 21 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WorkoutLogScreen() {
  const P = usePalette();
  const pad = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const posthog = usePostHog();
  const { workouts, logWorkout, logSets, refreshWorkouts, fetchForDate } = useWorkouts();
  const workoutHistory = useWorkoutHistory();
  const importReview = useWorkoutImportReview();
  const pendingImports = usePendingWorkoutImports();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  const todayKey = getLocalDateString();
  const [viewDate, setViewDate] = useState(todayKey);
  const [pastWorkouts, setPastWorkouts] = useState<Workout[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const viewDateRef = useRef(viewDate);
  viewDateRef.current = viewDate;

  const isToday = viewDate === todayKey;
  const viewWorkouts = isToday ? workouts : pastWorkouts;

  const loadViewDate = useCallback(async (date: string, force = false) => {
    if (date === todayKey) {
      await refreshWorkouts(force);
      return;
    }
    setLoadingPast(true);
    try {
      const rows = await fetchForDate(date, force);
      setPastWorkouts(rows);
    } finally {
      setLoadingPast(false);
    }
  }, [todayKey, refreshWorkouts, fetchForDate]);

  useEffect(() => {
    setViewDate((prev) => (prev > todayKey ? todayKey : prev));
  }, [todayKey]);

  useEffect(() => {
    void loadViewDate(viewDate, false);
  }, [viewDate, loadViewDate]);

  const navigateDate = useCallback(async (direction: -1 | 1) => {
    const next = addLocalCalendarDays(viewDate, direction);
    if (next > todayKey) return;
    setViewDate(next);
    try {
      await loadViewDate(next, false);
    } catch {
      toast.error("Could not load day", "Please try again.");
    }
  }, [viewDate, todayKey, loadViewDate, toast]);

  // Live session + log-past launcher (shared component, different intents).
  const session = useWorkoutSessionLiveActivity();
  const workoutSession = useWorkoutSession();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherIntent, setLauncherIntent] = useState<WorkoutLauncherIntent>("live");
  const [liveSheetOpen, setLiveSheetOpen] = useState(false);
  const [liveSelection, setLiveSelection] = useState<WorkoutSelection | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const openLiveLauncher = useCallback(() => {
    setLauncherIntent("live");
    setLauncherOpen(true);
  }, []);

  const openLogLauncher = useCallback(() => {
    setLauncherIntent("log");
    setLauncherOpen(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadViewDate(viewDate, true),
        workoutHistory.refresh(true),
        pendingImports.refresh(true),
        importReview.runImport(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [importReview, loadViewDate, pendingImports, viewDate, workoutHistory]);

  const syncOnFocusRef = useRef<() => void>(() => {});
  syncOnFocusRef.current = () => {
    void loadViewDate(viewDateRef.current, false);
    void workoutHistory.refresh(false);
    void pendingImports.refresh(false);
  };

  const openWorkoutEditor = useCallback(async (workoutId: string) => {
    const fromToday = workouts.find((workout) => workout.id === workoutId);
    const fromPast = pastWorkouts.find((workout) => workout.id === workoutId);
    const fromHistory = workoutHistory.groups
      .flatMap((group) => group.workouts)
      .find((workout) => workout.id === workoutId);
    let target = fromToday ?? fromPast ?? fromHistory ?? null;

    if (!target && user?.id) {
      target = await findWorkoutByIdCached(user.id, workoutId, workouts);
    }
    if (!target) {
      toast.error("Could not edit", "This workout could not be loaded.");
      return;
    }

    const sets =
      target.sets.length > 0 || !user?.id
        ? target.sets
        : await fetchWorkoutSetsCached(user.id, workoutId);

    setEditingWorkout({ ...target, sets });
    setSheetOpen(true);
  }, [pastWorkouts, toast, user?.id, workoutHistory.groups, workouts]);

  const openWorkoutEditorRef = useRef(openWorkoutEditor);
  openWorkoutEditorRef.current = openWorkoutEditor;

  useFocusEffect(
    useCallback(() => {
      const pendingId = consumeWorkoutEditId();
      if (pendingId) void openWorkoutEditorRef.current(pendingId);
      syncOnFocusRef.current();
    }, []),
  );

  const handleOpenDetail = useCallback((workout: Workout) => {
    router.push(`/(tabs)/log/workout/${workout.id}`);
  }, [router]);

  useEffect(() => {
    if (!editId) return;
    void openWorkoutEditor(editId);
    router.setParams({ editId: undefined });
  }, [editId, openWorkoutEditor, router]);

  const hasActiveLiveSession =
    session.active != null ||
    workoutSession.status === "active" ||
    workoutSession.status === "paused";

  const viewPendingGroup = useMemo(
    () => pendingImports.pendingGroups.find((group) => group.date === viewDate) ?? null,
    [pendingImports.pendingGroups, viewDate],
  );
  const olderPendingGroups = useMemo(
    () =>
      isToday
        ? pendingImports.pendingGroups.filter((group) => group.date !== todayKey)
        : [],
    [isToday, pendingImports.pendingGroups, todayKey],
  );
  const hasViewContent = viewWorkouts.length > 0 || viewPendingGroup != null;
  const showInitialLoad =
    viewWorkouts.length === 0 &&
    (viewPendingGroup?.items.length ?? 0) === 0 &&
    (isToday ? pendingImports.isLoading : loadingPast);

  const activeLiveDisplay = useMemo(() => {
    if (session.active) return session.active;
    if (!workoutSession.session) return null;
    if (workoutSession.status !== "active" && workoutSession.status !== "paused") {
      return null;
    }
    const s = workoutSession.session;
    const entry = getCatalogEntryById(s.workoutType);
    return {
      workoutType: s.workoutType,
      workoutName: s.workoutName,
      workoutIcon: entry?.sfSymbol ?? "dumbbell.fill",
      startedAt: s.startedAt,
      pausedAt: s.pausedAt,
      sets: s.sets,
    };
  }, [session.active, workoutSession.session, workoutSession.status]);

  const liveTimerStartedAt = activeLiveDisplay?.startedAt;
  const liveTimerPausedAt = activeLiveDisplay?.pausedAt ?? null;

  const handleLiveSheetClose = useCallback(() => {
    setLiveSheetOpen(false);
  }, []);

  // Deep-link entry: tapping the Dynamic Island or lock-screen Live Activity
  // routes through `app/workout-session.tsx`, which bumps openSheetSignal.
  // Every increment opens the sheet (only fires when the signal actually
  // changes, so it doesn't fight the user closing the sheet).
  useEffect(() => {
    if (session.openSheetSignal > 0) setLiveSheetOpen(true);
  }, [session.openSheetSignal]);

  // Live banner ticking timer.
  const [liveElapsed, setLiveElapsed] = useState(0);
  useEffect(() => {
    if (liveTimerStartedAt == null) return;
    if (liveTimerPausedAt != null) {
      setLiveElapsed(liveTimerPausedAt - liveTimerStartedAt);
      return;
    }
    const tick = () => setLiveElapsed(Date.now() - liveTimerStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveTimerStartedAt, liveTimerPausedAt]);

  const handleLiveStart = useCallback(
    async (selection: WorkoutSelection) => {
      await workoutSession.start({ ...selection, entrySurface: "log" });
      await session.start({
        workoutType: selection.entry.id,
        workoutName: selection.entry.label,
        workoutIcon: selection.entry.sfSymbol,
      });
      setLiveSelection(selection);
      setLauncherOpen(false);
      setLiveSheetOpen(true);
    },
    [workoutSession, session],
  );

  const handleLogSave = useCallback(
    async (selection: WorkoutSelection) => {
      const { entry, durationMins, intensity, presetExercises, exerciseSets, notes } = selection;
      if (!durationMins || durationMins === 0) {
        toast.warning("Missing duration", "How long was this workout?");
        return;
      }
      if (entry.sessionMode === "strength" && (!presetExercises || presetExercises.length === 0)) {
        toast.warning("No exercise", "Pick an exercise.");
        return;
      }
      if (
        entry.sessionMode === "strength" &&
        presetExercises?.some((exercise) => {
          const sets = exerciseSets?.[exercise];
          return (
            !sets?.length ||
            sets.some((set) => set.reps <= 0 || !Number.isFinite(set.weightKg) || set.weightKg < 0)
          );
        })
      ) {
        toast.warning("Incomplete sets", "Add reps and weight for every set.");
        return;
      }

      const backendType = getBackendTypeForCatalogId(entry.id) ?? "other";
      const backendIntensity = intensity ?? "moderate";
      const estimatedCals = Math.round(
        durationMins * (INTENSITY_CAL_RATE[backendIntensity] ?? INTENSITY_CAL_RATE.moderate),
      );
      const h = Math.floor(durationMins / 60);
      const m = durationMins % 60;
      const label = h > 0 ? `${h}h ${m}m` : `${m} min`;

      try {
        const w = await logWorkout({
          type: backendType,
          duration_mins: durationMins,
          intensity: backendIntensity,
          calories_burned: estimatedCals,
          source: "manual",
          ...(notes ? { notes } : {}),
        });

        if (entry.sessionMode === "strength" && presetExercises && presetExercises.length > 0) {
          await logSets(
            w.id,
            presetExercises.flatMap((name) =>
              (exerciseSets?.[name] ?? []).map((set) => ({
                exercise: name,
                sets: 1,
                reps: set.reps,
                weight: set.weightKg,
                weight_unit: "kg" as const,
              })),
            ),
          );
        }

        posthog.capture("workout_logged_retroactive", {
          activity_id: entry.id,
          duration_mins: durationMins,
          intensity: backendIntensity,
          exercises_count: presetExercises?.length ?? 0,
          sets_count: exerciseSets
            ? Object.values(exerciseSets).reduce((total, sets) => total + sets.length, 0)
            : 0,
          estimated_cals: estimatedCals,
        });

        toast.success(
          "Logged!",
          `${entry.sessionMode === "strength" && presetExercises?.length ? `${presetExercises.length} exercise${presetExercises.length !== 1 ? "s" : ""} · ` : ""}${label}`,
        );
        setLauncherOpen(false);
      } catch {
        toast.error("Failed to save", "Please try again.");
      }
    },
    [logWorkout, logSets, posthog, toast],
  );

  const handleRecoverSession = useCallback(async () => {
    const recoverable = workoutSession.recoverableSession;
    await workoutSession.recover();
    if (recoverable) {
      const entry = getCatalogEntryById(recoverable.workoutType);
      await session.start({
        workoutType: recoverable.workoutType,
        workoutName: recoverable.workoutName,
        workoutIcon: entry?.sfSymbol ?? "figure.mixed.cardio",
      });
    }
    setLiveSheetOpen(true);
  }, [workoutSession, session]);

  const handleSheetClose = useCallback(() => {
    setSheetOpen(false);
    setEditingWorkout(null);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: pad.paddingTop,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void handleRefresh(); }}
            tintColor={P.workout}
          />
        }
      >
        <View style={[ms.header, { paddingHorizontal: 20 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            style={[ms.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[ms.eyebrow, { color: P.textFaint, marginBottom: 10 }]}>
              TRAINING
            </Text>
            <DayNavigator
              label={formatHistoryDateLabel(viewDate, todayKey)}
              isToday={isToday}
              onPrev={() => { void navigateDate(-1); }}
              onNext={() => { void navigateDate(1); }}
              accentColor={P.workout}
            />
          </View>

          <View style={{ width: 40 }} />
        </View>

        {isToday ? (
          <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 8 }}>
            <WorkoutSessionRecoveryBanner onRecover={() => void handleRecoverSession()} />

            {hasActiveLiveSession && activeLiveDisplay ? (
              <WorkoutContinueCard
                workoutType={activeLiveDisplay.workoutType}
                workoutName={activeLiveDisplay.workoutName}
                elapsedMs={liveElapsed}
                setCount={activeLiveDisplay.sets.length}
                isPaused={activeLiveDisplay.pausedAt != null}
                onPress={() => setLiveSheetOpen(true)}
              />
            ) : null}

            <WorkoutActionRow
              onStartWorkout={openLiveLauncher}
              onLogWorkout={openLogLauncher}
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          {showInitialLoad ? (
            <View style={ms.loading}>
              <ActivityIndicator color={P.workout} />
              <Text style={[ms.loadingText, { color: P.textFaint }]}>
                {isToday
                  ? "Loading Apple Fitness workouts…"
                  : "Loading workouts…"}
              </Text>
            </View>
          ) : !hasViewContent ? (
            <View
              style={[
                ms.empty,
                { backgroundColor: P.card, borderColor: P.cardEdge },
              ]}
            >
              <View style={[ms.emptyIcon, { backgroundColor: P.sunken }]}>
                <Ionicons name="barbell-outline" size={28} color={P.workout} />
              </View>
              <Text style={[ms.emptyTitle, { color: P.text }]}>
                {isToday ? "No workouts yet" : "No workouts this day"}
              </Text>
              <Text style={[ms.emptySub, { color: P.textFaint }]}>
                {isToday
                  ? "Use Actions above to start a live session or log a workout manually."
                  : "Try another day or pull to refresh."}
              </Text>
            </View>
          ) : (
            <>
              <WorkoutTodaySection
                sectionLabel={formatHistoryDateLabel(viewDate, todayKey)}
                pendingItems={viewPendingGroup?.items ?? []}
                workouts={viewWorkouts}
                onOpenPending={(uuid) => {
                  router.push(`/(tabs)/log/workout/healthkit/${uuid}`);
                }}
                onOpenWorkout={handleOpenDetail}
              />

              {isToday ? (
                <WorkoutPendingSection
                  groups={olderPendingGroups}
                  onOpenItem={(uuid) => {
                    router.push(`/(tabs)/log/workout/healthkit/${uuid}`);
                  }}
                />
              ) : null}
            </>
          )}

          {isToday ? (
            <WorkoutHistorySection
              groups={workoutHistory.groups}
              isLoading={workoutHistory.isLoading}
              error={workoutHistory.error}
              onRetry={() => { void workoutHistory.refresh(true); }}
              onEditWorkout={handleOpenDetail}
            />
          ) : null}
        </View>
      </ScrollView>

      <LogWorkoutSheet
        visible={sheetOpen}
        onClose={handleSheetClose}
        editWorkout={editingWorkout}
      />

      <WorkoutLauncher
        visible={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        intent={launcherIntent}
        onLiveStart={(selection) => void handleLiveStart(selection)}
        onLogSave={(selection) => void handleLogSave(selection)}
      />

      {/* Live session UI — session must already be started via launcher. */}
      <LiveSessionSheet
        visible={liveSheetOpen}
        onClose={handleLiveSheetClose}
        selection={liveSelection ?? undefined}
      />
    </View>
  );
}

// ── Main screen styles ────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: { fontSize: 13, fontWeight: '600' },
  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    paddingVertical: 42,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },
});
