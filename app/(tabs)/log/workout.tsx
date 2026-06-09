import {
    CALORIES_PER_MINUTE,
    EXERCISE_LIBRARY,
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
import type { Workout } from "@/context/workout-context";
import {
    UI_INTENSITY_MAP,
    UI_WORKOUT_TYPE_MAP,
    useWorkouts,
} from "@/context/workout-context";
import {
    PrimaryButton,
    ScreenHeader,
    usePalette,
    useScreenPadding,
} from "@/lib/log-theme";
import { LiveSessionSheet } from "@/components/log/workout/LiveSessionSheet";
import { WorkoutHistorySection } from "@/components/log/workout/WorkoutHistorySection";
import { WorkoutTodaySection } from "@/components/log/workout/WorkoutTodaySection";
import { WorkoutLauncher } from "@/components/log/workout/WorkoutLauncher";
import { WorkoutActionRow } from "@/components/log/workout/WorkoutActionRow";
import { WorkoutDurationPicker } from "@/components/log/workout/WorkoutDurationPicker";
import { WorkoutContinueCard } from "@/components/log/workout/WorkoutContinueCard";
import { WorkoutPendingSection } from "@/components/log/workout/WorkoutPendingSection";
import { WorkoutSessionRecoveryBanner } from "@/components/log/workout/WorkoutSessionRecoveryBanner";
import { getCatalogEntryById, getBackendTypeForCatalogId } from "@/config/workout-catalog";
import { useWorkoutSession } from "@/context/workout-session-context";
import { useWorkoutSessionLiveActivity } from "@/hooks/use-workout-session-live-activity";
import { useWorkoutHistory } from "@/hooks/use-workout-history";
import { useWorkoutImportReview } from "@/hooks/use-workout-import-review";
import { usePendingWorkoutImports } from "@/hooks/use-pending-workout-imports";
import { getLocalDateString } from "@/utils/date";
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
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Constants ─────────────────────────────────────────────────────────────────

const INTENSITY_CAL_RATE = {
  light: CALORIES_PER_MINUTE.low,
  moderate: CALORIES_PER_MINUTE.moderate,
  hard: CALORIES_PER_MINUTE.high,
} as const;

// Colors cycle across exercises within a workout
const EX_COLORS = [
  "#22D3EE",
  "#34D399",
  "#F97316",
  "#F59E0B",
  "#A78BFA",
  "#F472B6",
] as const;

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
          weight: String(s.weight ?? ""),
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

  const filteredLibrary = useMemo(() => {
    const sections = EXERCISE_LIBRARY[type];
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map((s) => ({
        category: s.category,
        exercises: s.exercises.filter((e) => e.toLowerCase().includes(q)),
      }))
      .filter((s) => s.exercises.length > 0);
  }, [type, search]);

  const visibleLibrary = useMemo(
    () =>
      activeCategory === "all"
        ? filteredLibrary
        : filteredLibrary.filter((s) => s.category === activeCategory),
    [filteredLibrary, activeCategory],
  );
  const categoryOptions = useMemo(
    () => ["all", ...filteredLibrary.map((s) => s.category)],
    [filteredLibrary],
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

  const addSet = useCallback(
    (n: string) =>
      setSelected((prev) =>
        prev.map((e) =>
          e.name === n ? { ...e, sets: [...e.sets, newSet()] } : e,
        ),
      ),
    [],
  );
  const removeSet = useCallback(
    (n: string, id: string) =>
      setSelected((prev) =>
        prev.map((e) =>
          e.name === n
            ? {
                ...e,
                sets:
                  e.sets.length === 1
                    ? e.sets
                    : e.sets.filter((s) => s.id !== id),
              }
            : e,
        ),
      ),
    [],
  );
  const updateSet = useCallback(
    (n: string, id: string, p: Partial<SetRow>) =>
      setSelected((prev) =>
        prev.map((e) =>
          e.name === n
            ? {
                ...e,
                sets: e.sets.map((s) => (s.id === id ? { ...s, ...p } : s)),
              }
            : e,
        ),
      ),
    [],
  );
  const removeExercise = useCallback(
    (n: string) => setSelected((prev) => prev.filter((e) => e.name !== n)),
    [],
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
              weight: parseFloat(s.weight) || undefined,
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
    >
      {/* ── Inline header ── */}
      <View style={[sh.header, { borderBottomColor: P.hair }]}>
        <Pressable
          onPress={page === "exercises" ? () => setPage("form") : onClose}
          hitSlop={12}
          style={[sh.navBtn, { backgroundColor: P.sunken }]}
        >
          <Ionicons
            name={page === "exercises" ? "chevron-back" : "close"}
            size={16}
            color={P.text}
          />
        </Pressable>
        <Text style={[sh.sheetTitle, { color: P.text }]}>
          {page === "exercises"
            ? "SELECT EXERCISES"
            : editWorkout
              ? "EDIT WORKOUT"
              : "LOG WORKOUT"}
        </Text>
        {page === "exercises" ? (
          <Pressable
            onPress={() => setPage("form")}
            style={[sh.doneSmall, { backgroundColor: P.workout }]}
          >
            <Text style={sh.doneSmallText}>Done</Text>
          </Pressable>
        ) : (
          <View style={sh.navBtn} />
        )}
      </View>

      {/* ── EXERCISE PICKER ── */}
      {page === "exercises" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
            {/* Search */}
            <View
              style={[
                sh.searchBar,
                { backgroundColor: P.sunken, borderColor: P.cardEdge },
              ]}
            >
              <Ionicons name="search-outline" size={15} color={P.textFaint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search exercises…"
                placeholderTextColor={P.textFaint}
                style={[sh.searchInput, { color: P.text }]}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={15} color={P.textFaint} />
                </Pressable>
              )}
            </View>

            {/* Categories */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {categoryOptions.map((cat) => {
                const active = cat === activeCategory;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    style={[
                      sh.catChip,
                      {
                        backgroundColor: active ? P.workout : P.sunken,
                        borderColor: active ? P.workout : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        sh.catText,
                        { color: active ? "#fff" : P.textFaint },
                      ]}
                    >
                      {cat === "all" ? "All" : cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Selected pills */}
            {selected.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {selected.map((ex) => (
                  <Pressable
                    key={ex.name}
                    onPress={() => toggleExercise(ex.name)}
                    style={[
                      sh.selectedPill,
                      {
                        backgroundColor: P.workout + "22",
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
                    <Ionicons name="close" size={11} color={P.workout} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Exercise grid */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {visibleLibrary.map((section) => (
              <View key={section.category} style={{ marginTop: 20 }}>
                <Text style={[sh.sectionHdr, { color: P.textFaint }]}>
                  {section.category.toUpperCase()}
                </Text>
                <View style={sh.exGrid}>
                  {section.exercises.map((name) => {
                    const active = selectedNames.has(name);
                    return (
                      <Pressable
                        key={name}
                        onPress={() => toggleExercise(name)}
                        style={({ pressed }) => [
                          sh.exCard,
                          {
                            backgroundColor: active ? P.workout : P.card,
                            borderColor: active ? P.workout : P.cardEdge,
                          },
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <View style={sh.exCardTop}>
                          <View
                            style={[
                              sh.exCheck,
                              {
                                borderColor: active ? "#fff" : P.cardEdge,
                                backgroundColor: active
                                  ? "rgba(255,255,255,0.2)"
                                  : "transparent",
                              },
                            ]}
                          >
                            {active && (
                              <Ionicons
                                name="checkmark"
                                size={11}
                                color="#fff"
                              />
                            )}
                          </View>
                        </View>
                        <Text
                          style={[
                            sh.exCardText,
                            { color: active ? "#fff" : P.text },
                          ]}
                          numberOfLines={2}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
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
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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

            {/* Selected exercise cards — scoreboard set editor */}
            {selected.map((ex, exIdx) => (
              <View
                key={ex.name}
                style={[
                  fp.exCard,
                  { backgroundColor: P.card, borderColor: P.cardEdge },
                ]}
              >
                {/* Exercise header */}
                <View style={[fp.exCardHead, { borderBottomColor: P.hair }]}>
                  <View
                    style={[
                      fp.exColorBar,
                      { backgroundColor: EX_COLORS[exIdx % EX_COLORS.length] },
                    ]}
                  />
                  <Text style={[fp.exCardName, { color: P.text }]}>
                    {ex.name.toUpperCase()}
                  </Text>
                  <Pressable
                    onPress={() => removeExercise(ex.name)}
                    hitSlop={10}
                    style={[fp.exRemove, { backgroundColor: P.sunken }]}
                  >
                    <Ionicons name="close" size={14} color={P.textFaint} />
                  </Pressable>
                </View>

                {/* Set table header */}
                {isStrength && (
                  <View
                    style={[fp.setTableHead, { borderBottomColor: P.hair }]}
                  >
                    <Text
                      style={[
                        fp.setTableHdr,
                        { color: P.textFaint, width: 36 },
                      ]}
                    >
                      SET
                    </Text>
                    <Text
                      style={[fp.setTableHdr, { color: P.textFaint, flex: 1 }]}
                    >
                      REPS
                    </Text>
                    <View style={{ width: 28 }} />
                    <Text
                      style={[fp.setTableHdr, { color: P.textFaint, flex: 1 }]}
                    >
                      WEIGHT
                    </Text>
                    <View style={{ width: 28 }} />
                  </View>
                )}

                {/* Set rows */}
                {isStrength &&
                  ex.sets.map((set, idx) => (
                    <View
                      key={set.id}
                      style={[
                        fp.setInputRow,
                        idx < ex.sets.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: P.hair,
                        },
                      ]}
                    >
                      {/* Set number */}
                      <View
                        style={[
                          fp.setNumBadge,
                          { backgroundColor: P.sunken, width: 36 },
                        ]}
                      >
                        <Text style={[fp.setNumText, { color: P.textFaint }]}>
                          {String(idx + 1).padStart(2, "0")}
                        </Text>
                      </View>

                      {/* Reps input */}
                      <View
                        style={[
                          fp.setNumInput,
                          {
                            backgroundColor: P.sunken,
                            borderColor: P.cardEdge,
                            flex: 1,
                          },
                        ]}
                      >
                        <TextInput
                          value={set.reps}
                          onChangeText={(t) =>
                            updateSet(ex.name, set.id, {
                              reps: t.replace(/[^0-9]/g, ""),
                            })
                          }
                          placeholder="—"
                          placeholderTextColor={P.cardEdge}
                          keyboardType="number-pad"
                          style={[fp.setInputText, { color: P.text }]}
                        />
                      </View>

                      <Text style={[fp.setX, { color: P.textFaint }]}>×</Text>

                      {/* Weight input */}
                      <View
                        style={[
                          fp.setNumInput,
                          {
                            backgroundColor: P.sunken,
                            borderColor: P.cardEdge,
                            flex: 1,
                          },
                        ]}
                      >
                        <TextInput
                          value={set.weight}
                          onChangeText={(t) =>
                            updateSet(ex.name, set.id, {
                              weight: t.replace(/[^0-9.]/g, ""),
                            })
                          }
                          placeholder="kg"
                          placeholderTextColor={P.cardEdge}
                          keyboardType="decimal-pad"
                          style={[fp.setInputText, { color: P.text }]}
                        />
                      </View>

                      {/* Remove set */}
                      <Pressable
                        onPress={() => removeSet(ex.name, set.id)}
                        hitSlop={10}
                        disabled={ex.sets.length === 1}
                        style={{ width: 28, alignItems: "center" }}
                      >
                        <Ionicons
                          name="remove-circle-outline"
                          size={18}
                          color={
                            ex.sets.length === 1 ? P.cardEdge : P.textFaint
                          }
                        />
                      </Pressable>
                    </View>
                  ))}

                {/* Add set button */}
                {isStrength && (
                  <Pressable
                    onPress={() => addSet(ex.name)}
                    style={({ pressed }) => [
                      fp.addSetRow,
                      { borderTopColor: P.hair },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color={P.workout}
                    />
                    <Text style={[fp.addSetText, { color: P.workout }]}>
                      Add set
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}

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
          <View style={[fp.section, { marginTop: 8 }]}>
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

          {/* Save */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <PrimaryButton
              label={
                editWorkout
                  ? `Save ${activeTypeLabel.toLowerCase()}`
                  : `Log ${activeTypeLabel.toLowerCase()}`
              }
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              accent={P.workout}
            />
          </View>
        </ScrollView>
      )}
    </AppModal>
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
    fontFamily: "Syne_800ExtraBold",
    fontSize: 12,
    letterSpacing: 2,
  },
  doneSmall: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneSmallText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "500" },
  catChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  catText: { fontSize: 12, fontWeight: "700" },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 180,
  },
  selectedPillText: { fontSize: 12, fontWeight: "700" },
  sectionHdr: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  exGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exCard: {
    width: "48.5%",
    minHeight: 80,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    justifyContent: "space-between",
  },
  exCardTop: { flexDirection: "row", justifyContent: "flex-end" },
  exCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  exCardText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 16,
  },
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
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: {
    fontFamily: "Syne_800ExtraBold",
    fontSize: 9,
    letterSpacing: 2.2,
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
  intLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },

  // Exercise cards
  exHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  exBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  exBadgeText: { fontSize: 11, fontWeight: "800" },
  exCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    overflow: "hidden",
  },
  exCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exColorBar: { width: 3, height: 16, borderRadius: 2 },
  exCardName: {
    flex: 1,
    fontFamily: "Syne_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.6,
  },
  exRemove: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Set table
  setTableHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  setTableHdr: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  setInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  setNumBadge: {
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumText: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  setNumInput: {
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  setInputText: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 20,
    letterSpacing: -0.3,
    textAlign: "center",
    width: "100%",
  },
  setX: { fontSize: 15, fontWeight: "700", textAlign: "center", width: 28 },
  addSetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addSetText: { fontSize: 13, fontWeight: "700" },

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
  const toast = useToast();
  const posthog = usePostHog();
  const { workouts, logWorkout, logSets, refreshWorkouts } = useWorkouts();
  const workoutHistory = useWorkoutHistory();
  const importReview = useWorkoutImportReview();
  const pendingImports = usePendingWorkoutImports();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

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
        refreshWorkouts(undefined, true),
        workoutHistory.refresh(true),
        pendingImports.refresh(true),
        importReview.runImport(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [importReview, pendingImports, refreshWorkouts, workoutHistory]);

  const syncOnFocusRef = useRef<() => void>(() => {});
  syncOnFocusRef.current = () => {
    // Cache-first on focus — serve cached workouts without a network round-trip.
    void refreshWorkouts(undefined, false);
    void workoutHistory.refresh(false);
    void pendingImports.refresh(false);
  };

  useFocusEffect(
    useCallback(() => {
      syncOnFocusRef.current();
    }, []),
  );

  const handleOpenDetail = useCallback((workout: Workout) => {
    router.push(`/(tabs)/log/workout/${workout.id}`);
  }, [router]);

  useEffect(() => {
    if (!editId) return;
    const target = workouts.find((workout) => workout.id === editId);
    if (!target) return;
    setEditingWorkout(target);
    setSheetOpen(true);
    router.setParams({ editId: undefined });
  }, [editId, router, workouts]);

  const hasActiveLiveSession =
    session.active != null ||
    workoutSession.status === "active" ||
    workoutSession.status === "paused";

  const todayKey = getLocalDateString();
  const todayPendingGroup = useMemo(
    () => pendingImports.pendingGroups.find((group) => group.date === todayKey) ?? null,
    [pendingImports.pendingGroups, todayKey],
  );
  const olderPendingGroups = useMemo(
    () => pendingImports.pendingGroups.filter((group) => group.date !== todayKey),
    [pendingImports.pendingGroups, todayKey],
  );
  const hasTodayContent = workouts.length > 0 || todayPendingGroup != null;

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
      const { entry, durationMins, intensity, presetExercises, notes } = selection;
      if (!durationMins || durationMins === 0) {
        toast.warning("Missing duration", "How long was this workout?");
        return;
      }
      if (entry.sessionMode === "strength" && (!presetExercises || presetExercises.length === 0)) {
        toast.warning("No exercises", "Pick at least one exercise.");
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
            presetExercises.map((name) => ({
              exercise: name,
              sets: 1,
              weight_unit: "kg" as const,
            })),
          );
        }

        posthog.capture("workout_logged_retroactive", {
          activity_id: entry.id,
          duration_mins: durationMins,
          intensity: backendIntensity,
          exercises_count: presetExercises?.length ?? 0,
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
        <ScreenHeader eyebrow="Training" title="Workouts" accent={P.workout} />

        {/* Live session entry / banner */}
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

        {/* List or empty state */}
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          {pendingImports.isLoading &&
          workouts.length === 0 &&
          pendingImports.totalPending === 0 ? (
            <View style={ms.loading}>
              <ActivityIndicator color={P.workout} />
              <Text style={[ms.loadingText, { color: P.textFaint }]}>
                Loading Apple Fitness workouts…
              </Text>
            </View>
          ) : workouts.length === 0 && pendingImports.totalPending === 0 ? (
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
                No workouts yet
              </Text>
              <Text style={[ms.emptySub, { color: P.textFaint }]}>
                Use Actions above to start a live session or log a workout manually.
              </Text>
            </View>
          ) : (
            <>
              {hasTodayContent ? (
                <WorkoutTodaySection
                  pendingItems={todayPendingGroup?.items ?? []}
                  workouts={workouts}
                  onOpenPending={(uuid) => {
                    router.push(`/(tabs)/log/workout/healthkit/${uuid}`);
                  }}
                  onOpenWorkout={handleOpenDetail}
                />
              ) : null}

              <WorkoutPendingSection
                groups={olderPendingGroups}
                onOpenItem={(uuid) => {
                  router.push(`/(tabs)/log/workout/healthkit/${uuid}`);
                }}
              />
            </>
          )}

          <WorkoutHistorySection
            groups={workoutHistory.groups}
            isLoading={workoutHistory.isLoading}
            error={workoutHistory.error}
            onRetry={() => { void workoutHistory.refresh(true); }}
            onEditWorkout={handleOpenDetail}
          />
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
