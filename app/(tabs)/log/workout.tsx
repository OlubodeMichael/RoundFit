import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
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
import type { Intensity, SelectedExercise, SetRow, WorkoutType } from '@/components/log/workout/types';
import {
  CALORIES_PER_MINUTE,
  EXERCISE_LIBRARY,
  INTENSITY_OPTIONS,
  WORKOUT_TYPES,
} from '@/components/log/workout/constants';
import {
  PrimaryButton,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { AppModal } from '@/components/ui/AppModal';
import { useToast } from '@/components/ui/Toast';
import {
  useWorkouts,
  UI_WORKOUT_TYPE_MAP,
  UI_INTENSITY_MAP,
} from '@/context/workout-context';
import type { Workout, WorkoutSet } from '@/context/workout-context';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKOUT_META: Record<string, { icon: IoniconName; label: string }> = {
  gym:        { icon: 'barbell-outline',   label: 'Strength'   },
  running:    { icon: 'footsteps-outline', label: 'Running'    },
  cycling:    { icon: 'bicycle-outline',   label: 'Cycling'    },
  hiit:       { icon: 'flash-outline',     label: 'HIIT'       },
  yoga:       { icon: 'leaf-outline',      label: 'Yoga'       },
  swimming:   { icon: 'water-outline',     label: 'Swimming'   },
  walking:    { icon: 'footsteps-outline', label: 'Walking'    },
  rowing:     { icon: 'boat-outline',      label: 'Rowing'     },
  elliptical: { icon: 'reload-outline',    label: 'Elliptical' },
  other:      { icon: 'apps-outline',      label: 'Workout'    },
};

const INTENSITY_LABEL: Record<string, string> = {
  light: 'Light', moderate: 'Moderate', hard: 'Hard',
};

const INTENSITY_LEVEL: Record<string, number> = {
  light: 1, moderate: 2, hard: 3,
};

// Colors cycle across exercises within a workout
const EX_COLORS = [
  '#22D3EE', '#34D399', '#F97316', '#F59E0B', '#A78BFA', '#F472B6',
] as const;

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function newSet(): SetRow {
  return { id: `s${Date.now()}_${Math.random().toString(36).slice(2)}`, reps: '', weight: '' };
}

// ── WorkoutEntry ──────────────────────────────────────────────────────────────
// Performance-log card. Numbers are the hero — BarlowCondensed for all stats,
// Syne for exercise names. Each set gets a relative weight bar.

function WorkoutEntry({ workout, onDelete }: { workout: Workout; onDelete: (id: string) => void }) {
  const P    = usePalette();
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;

  // Group sets by exercise, preserving insertion order
  const exerciseGroups = useMemo((): [string, WorkoutSet[], string][] => {
    const order: string[] = [];
    const map: Record<string, WorkoutSet[]> = {};
    for (const set of (workout.sets ?? [])) {
      if (!map[set.exercise]) { map[set.exercise] = []; order.push(set.exercise); }
      map[set.exercise].push(set);
    }
    return order.map((name, i) => [name, map[name], EX_COLORS[i % EX_COLORS.length]]);
  }, [workout.sets]);

  const hasSets = exerciseGroups.length > 0;
  const intLevel = INTENSITY_LEVEL[workout.intensity ?? 'moderate'] ?? 2;
  const topColor = EX_COLORS[0];

  return (
    <View style={[card.wrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={card.topLine}>
        <View style={[card.topAccent, { backgroundColor: topColor }]} />
      </View>
      <View style={card.head}>
        <View style={[card.iconRing, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <Ionicons name={meta.icon} size={18} color={P.workout} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[card.workoutName, { color: P.text }]}>{meta.label}</Text>
          <View style={card.metaRow}>
            <Text style={[card.metaText, { color: P.textFaint }]}>{fmtDuration(workout.duration_mins)}</Text>
            {workout.intensity && (
              <>
                <View style={[card.metaDot, { backgroundColor: P.cardEdge }]} />
                <View style={card.intRow}>
                  {[1, 2, 3].map(d => (
                    <View
                      key={d}
                      style={[
                        card.intSegment,
                        { backgroundColor: d <= intLevel ? P.workout : P.cardEdge },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[card.metaText, { color: P.textFaint }]}>
                  {INTENSITY_LABEL[workout.intensity]}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={card.rightCol}>
          <Text style={[card.calsNum, { color: P.text }]}>{Math.round(workout.calories_burned)}</Text>
          <Text style={[card.calsUnit, { color: P.textFaint }]}>kcal</Text>
        </View>
      </View>

      {hasSets && (
        <View style={[card.setsWrap, { borderTopColor: P.hair }]}>
          {exerciseGroups.map(([exName, sets, color], gi) => {
            const maxWeight = Math.max(...sets.map(s => (s.weight ?? 0)), 1);
            return (
              <View key={exName} style={gi > 0 ? { marginTop: 16 } : undefined}>
                <View style={card.exHead}>
                  <View style={[card.exAccentDot, { backgroundColor: color }]} />
                  <Text style={[card.exTitle, { color: P.text }]}>{exName}</Text>
                  <View style={[card.exSetBadge, { backgroundColor: P.sunken }]}>
                    <Text style={[card.exSetCount, { color: P.textFaint }]}>
                      {sets.length} {sets.length === 1 ? 'SET' : 'SETS'}
                    </Text>
                  </View>
                </View>
                {sets.map((set, si) => {
                  const w        = set.weight ?? 0;
                  const relPct   = maxWeight > 0 ? w / maxWeight : 0;
                  const isTop    = w === maxWeight && w > 0;
                  return (
                    <View
                      key={set.id}
                      style={[
                        card.setRow,
                        si < sets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair },
                      ]}
                    >
                      <View style={[card.setNumBadge, { backgroundColor: P.sunken }]}>
                        <Text style={[card.setNum, { color: P.textFaint }]}>{si + 1}</Text>
                      </View>
                      <View style={card.metricPill}>
                        <Text style={[card.metricVal, { color: P.text }]}>{set.reps ?? '—'}</Text>
                        <Text style={[card.metricUnit, { color: P.textFaint }]}>reps</Text>
                      </View>
                      <View style={card.metricPillWide}>
                        <Text style={[card.metricVal, { color: isTop ? color : P.text }]}>{w > 0 ? w : '—'}</Text>
                        <Text style={[card.metricUnit, { color: P.textFaint }]}>{set.weight_unit}</Text>
                      </View>
                      <View style={card.barCol}>
                        <View style={[card.barTrack, { backgroundColor: P.cardEdge }]}>
                          <View
                            style={[
                              card.barFill,
                              { width: `${Math.round(relPct * 100)}%`, backgroundColor: color },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      <View style={[card.footerRow, { borderTopColor: P.hair }]}>
        <Text style={[card.footerText, { color: P.textFaint }]}>Logged manually</Text>
        <TouchableOpacity
          onPress={() => onDelete(workout.id)}
          hitSlop={12}
          style={[card.trash, { backgroundColor: P.sunken }]}
        >
          <Ionicons name="trash-outline" size={13} color={P.textFaint} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrap:        { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 12 },
  topLine:     { height: 3 },
  topAccent:   { width: 64, height: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  head:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  iconRing: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:    { fontSize: 11, fontWeight: '600' },
  metaDot:     { width: 3, height: 3, borderRadius: 2, opacity: 0.75 },
  intRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  intSegment:  { width: 8, height: 3, borderRadius: 2 },
  rightCol:    { alignItems: 'flex-end', gap: 1, marginTop: 2 },
  calsNum:     { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 26, lineHeight: 26, letterSpacing: -0.4 },
  calsUnit:    { fontSize: 10, fontWeight: '600' },
  trash:       { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  setsWrap:    { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  exHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  exAccentDot: { width: 8, height: 8, borderRadius: 4 },
  exTitle:     { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  exSetBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  exSetCount:  { fontSize: 10, fontWeight: '700' },
  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 2,
  },
  setNumBadge: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  setNum:      { fontSize: 11, fontWeight: '700' },
  metricPill:  { width: 72, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'transparent' },
  metricPillWide: { flex: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'transparent' },
  metricVal:   { fontFamily: 'BarlowCondensed_700Bold', fontSize: 22, lineHeight: 22 },
  metricUnit:  { fontSize: 10, fontWeight: '600', marginTop: 2 },
  barCol:      { width: 52, alignItems: 'flex-end' },
  barTrack:    { width: 52, height: 4, borderRadius: 3, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 3 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerText: { fontSize: 11, fontWeight: '500' },
});

// ── Log workout sheet ─────────────────────────────────────────────────────────

type SheetPage = 'form' | 'exercises';

function LogWorkoutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const { logWorkout, logSets } = useWorkouts();

  const [page,       setPage]       = useState<SheetPage>('form');
  const [type,       setType]       = useState<WorkoutType>('strength');
  const [hours,      setHours]      = useState('0');
  const [minutes,    setMinutes]    = useState('45');
  const [intensity,  setIntensity]  = useState<Intensity>('moderate');
  const [notes,      setNotes]      = useState('');
  const [notesOpen,  setNotesOpen]  = useState(false);
  const [selected,   setSelected]   = useState<SelectedExercise[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => { if (!visible) setPage('form'); }, [visible]);

  const isStrength   = type === 'strength';
  const totalMinutes = useMemo(() => (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0), [hours, minutes]);
  const estimatedCals = useMemo(() => Math.round(totalMinutes * CALORIES_PER_MINUTE[intensity]), [totalMinutes, intensity]);

  const filteredLibrary = useMemo(() => {
    const sections = EXERCISE_LIBRARY[type];
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map(s => ({ category: s.category, exercises: s.exercises.filter(e => e.toLowerCase().includes(q)) }))
      .filter(s => s.exercises.length > 0);
  }, [type, search]);

  const visibleLibrary  = useMemo(() => activeCategory === 'all' ? filteredLibrary : filteredLibrary.filter(s => s.category === activeCategory), [filteredLibrary, activeCategory]);
  const categoryOptions = useMemo(() => ['all', ...filteredLibrary.map(s => s.category)], [filteredLibrary]);
  const selectedNames   = useMemo(() => new Set(selected.map(e => e.name)), [selected]);

  const handleTypeChange = (t: WorkoutType) => { setType(t); setSelected([]); setSearch(''); setActiveCategory('all'); };

  const toggleExercise = useCallback((name: string) => {
    setSelected(prev => prev.some(e => e.name === name) ? prev.filter(e => e.name !== name) : [...prev, { name, sets: [newSet()] }]);
  }, []);

  const addSet        = useCallback((n: string) => setSelected(prev => prev.map(e => e.name === n ? { ...e, sets: [...e.sets, newSet()] } : e)), []);
  const removeSet     = useCallback((n: string, id: string) => setSelected(prev => prev.map(e => e.name === n ? { ...e, sets: e.sets.length === 1 ? e.sets : e.sets.filter(s => s.id !== id) } : e)), []);
  const updateSet     = useCallback((n: string, id: string, p: Partial<SetRow>) => setSelected(prev => prev.map(e => e.name === n ? { ...e, sets: e.sets.map(s => s.id === id ? { ...s, ...p } : s) } : e)), []);
  const removeExercise = useCallback((n: string) => setSelected(prev => prev.filter(e => e.name !== n)), []);

  const resetForm = useCallback(() => {
    setType('strength'); setHours('0'); setMinutes('45'); setIntensity('moderate');
    setNotes(''); setSearch(''); setSelected([]); setActiveCategory('all'); setNotesOpen(false); setPage('form');
  }, []);

  const handleSave = async () => {
    if (totalMinutes === 0) { toast.warning('Missing duration', 'How long was this workout?'); return; }
    if (isStrength && selected.length === 0) { toast.warning('No exercises', 'Pick at least one exercise.'); return; }
    const label = (parseInt(hours) || 0) > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
    setSaving(true);
    try {
      const w = await logWorkout({ type: UI_WORKOUT_TYPE_MAP[type] ?? 'other', duration_mins: totalMinutes, intensity: UI_INTENSITY_MAP[intensity] ?? 'moderate', calories_burned: estimatedCals, source: 'manual' });
      if (isStrength && selected.length > 0) {
        await logSets(w.id, selected.flatMap(ex => ex.sets.map(s => ({ exercise: ex.name, sets: 1, reps: parseInt(s.reps) || undefined, weight: parseFloat(s.weight) || undefined, weight_unit: 'kg' as const }))));
      }
      toast.success('Logged!', `${isStrength && selected.length ? `${selected.length} exercise${selected.length !== 1 ? 's' : ''} · ` : ''}${label}`);
      resetForm(); onClose();
    } catch { toast.error('Failed to save', 'Please try again.'); }
    finally { setSaving(false); }
  };

  const activeTypeLabel = WORKOUT_TYPES.find(t => t.id === type)?.label ?? 'Workout';

  return (
    <AppModal visible={visible} onClose={page === 'exercises' ? () => setPage('form') : onClose} sheetHeight="full" openAnimation="ease" dismissGestureArea="handle">

      {/* ── Inline header ── */}
      <View style={[sh.header, { borderBottomColor: P.hair }]}>
        <Pressable
          onPress={page === 'exercises' ? () => setPage('form') : onClose}
          hitSlop={12}
          style={[sh.navBtn, { backgroundColor: P.sunken }]}
        >
          <Ionicons name={page === 'exercises' ? 'chevron-back' : 'close'} size={16} color={P.text} />
        </Pressable>
        <Text style={[sh.sheetTitle, { color: P.text }]}>
          {page === 'exercises' ? 'SELECT EXERCISES' : 'LOG WORKOUT'}
        </Text>
        {page === 'exercises' ? (
          <Pressable
            onPress={() => setPage('form')}
            style={[sh.doneSmall, { backgroundColor: P.workout }]}
          >
            <Text style={sh.doneSmallText}>Done</Text>
          </Pressable>
        ) : (
          <View style={sh.navBtn} />
        )}
      </View>

      {/* ── EXERCISE PICKER ── */}
      {page === 'exercises' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
            {/* Search */}
            <View style={[sh.searchBar, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
              <Ionicons name="search-outline" size={15} color={P.textFaint} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search exercises…" placeholderTextColor={P.textFaint} style={[sh.searchInput, { color: P.text }]} autoCorrect={false} />
              {search.length > 0 && <Pressable onPress={() => setSearch('')} hitSlop={10}><Ionicons name="close-circle" size={15} color={P.textFaint} /></Pressable>}
            </View>

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {categoryOptions.map(cat => {
                const active = cat === activeCategory;
                return (
                  <Pressable key={cat} onPress={() => setActiveCategory(cat)} style={[sh.catChip, { backgroundColor: active ? P.workout : P.sunken, borderColor: active ? P.workout : 'transparent' }]}>
                    <Text style={[sh.catText, { color: active ? '#fff' : P.textFaint }]}>{cat === 'all' ? 'All' : cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Selected pills */}
            {selected.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {selected.map(ex => (
                  <Pressable key={ex.name} onPress={() => toggleExercise(ex.name)} style={[sh.selectedPill, { backgroundColor: P.workout + '22', borderColor: P.workout }]}>
                    <Text style={[sh.selectedPillText, { color: P.workout }]} numberOfLines={1}>{ex.name}</Text>
                    <Ionicons name="close" size={11} color={P.workout} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Exercise grid */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {visibleLibrary.map(section => (
              <View key={section.category} style={{ marginTop: 20 }}>
                <Text style={[sh.sectionHdr, { color: P.textFaint }]}>{section.category.toUpperCase()}</Text>
                <View style={sh.exGrid}>
                  {section.exercises.map(name => {
                    const active = selectedNames.has(name);
                    return (
                      <Pressable
                        key={name}
                        onPress={() => toggleExercise(name)}
                        style={({ pressed }) => [
                          sh.exCard,
                          { backgroundColor: active ? P.workout : P.card, borderColor: active ? P.workout : P.cardEdge },
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <View style={sh.exCardTop}>
                          <View style={[sh.exCheck, { borderColor: active ? '#fff' : P.cardEdge, backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'transparent' }]}>
                            {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                          </View>
                        </View>
                        <Text style={[sh.exCardText, { color: active ? '#fff' : P.text }]} numberOfLines={2}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Bottom bar */}
          <View style={[sh.doneBar, { backgroundColor: P.card, borderTopColor: P.hair, paddingBottom: insets.bottom + 8 }]}>
            <View style={[sh.doneCount, { backgroundColor: P.workoutSoft }]}>
              <Text style={[sh.doneCountNum, { color: P.workout }]}>{selected.length}</Text>
              <Text style={[sh.doneCountLbl, { color: P.workout }]}>selected</Text>
            </View>
            <Pressable onPress={() => setPage('form')} style={[sh.donePrimary, { backgroundColor: P.workout }]}>
              <Text style={sh.donePrimaryText}>Confirm selection</Text>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── FORM ── */}
      {page === 'form' && (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Activity type — horizontal scroll */}
          <View style={fp.section}>
            <Text style={[fp.sectionLabel, { color: P.textFaint }]}>ACTIVITY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
              {WORKOUT_TYPES.map(t => {
                const active = t.id === type;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => handleTypeChange(t.id)}
                    style={({ pressed }) => [
                      fp.typeCard,
                      {
                        backgroundColor: active ? P.workout : P.card,
                        borderColor:     active ? P.workout : P.cardEdge,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={[fp.typeIconWrap, { backgroundColor: active ? 'rgba(255,255,255,0.18)' : P.workoutSoft }]}>
                      <Ionicons name={t.icon} size={22} color={active ? '#fff' : P.workout} />
                    </View>
                    <Text style={[fp.typeLabel, { color: active ? '#fff' : P.textDim }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Duration — scoreboard style */}
          <View style={fp.section}>
            <Text style={[fp.sectionLabel, { color: P.textFaint }]}>DURATION</Text>
            <View style={[fp.durationCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <View style={fp.durationDisplay}>
                {/* Hours */}
                <View style={fp.timeSlot}>
                  <View style={[fp.timeInput, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
                    <TextInput
                      value={hours}
                      onChangeText={t => setHours(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={P.cardEdge}
                      keyboardType="number-pad"
                      style={[fp.timeNum, { color: P.text }]}
                    />
                  </View>
                  <Text style={[fp.timeUnit, { color: P.textFaint }]}>HR</Text>
                </View>

                <Text style={[fp.timeSep, { color: P.cardEdge }]}>:</Text>

                {/* Minutes */}
                <View style={fp.timeSlot}>
                  <View style={[fp.timeInput, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
                    <TextInput
                      value={minutes}
                      onChangeText={t => { const n = t.replace(/[^0-9]/g, ''); setMinutes(n === '' ? '' : String(Math.min(59, parseInt(n)))); }}
                      placeholder="45"
                      placeholderTextColor={P.cardEdge}
                      keyboardType="number-pad"
                      style={[fp.timeNum, { color: P.text }]}
                    />
                  </View>
                  <Text style={[fp.timeUnit, { color: P.textFaint }]}>MIN</Text>
                </View>
              </View>

              {/* Calorie estimate */}
              {totalMinutes > 0 && (
                <View style={[fp.calRow, { borderTopColor: P.hair }]}>
                  <Ionicons name="flame" size={13} color={P.calories} />
                  <Text style={[fp.calText, { color: P.textFaint }]}>Estimated</Text>
                  <Text style={[fp.calNum, { color: P.calories }]}>{estimatedCals}</Text>
                  <Text style={[fp.calUnit, { color: P.textFaint }]}>kcal</Text>
                </View>
              )}
            </View>
          </View>

          {/* Intensity */}
          <View style={fp.section}>
            <Text style={[fp.sectionLabel, { color: P.textFaint }]}>INTENSITY</Text>
            <View style={fp.intGrid}>
              {INTENSITY_OPTIONS.map(opt => {
                const active = opt.id === intensity;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setIntensity(opt.id)}
                    style={({ pressed }) => [
                      fp.intCard,
                      { backgroundColor: active ? P.workout + '18' : P.card, borderColor: active ? P.workout : P.cardEdge },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {/* Dot meter */}
                    <View style={fp.dotMeter}>
                      {[1, 2, 3, 4].map(d => (
                        <View
                          key={d}
                          style={[
                            fp.dotSeg,
                            {
                              backgroundColor: d <= opt.dots
                                ? (active ? P.workout : P.workout + '55')
                                : P.cardEdge,
                              height: 4 + d * 3,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[fp.intLabel, { color: active ? P.workout : P.textDim }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Exercises */}
          <View style={fp.section}>
            <View style={fp.exHead}>
              <Text style={[fp.sectionLabel, { color: P.textFaint }]}>EXERCISES</Text>
              {selected.length > 0 && (
                <View style={[fp.exBadge, { backgroundColor: P.workoutSoft }]}>
                  <Text style={[fp.exBadgeText, { color: P.workout }]}>{selected.length}</Text>
                </View>
              )}
            </View>

            {/* Selected exercise cards — scoreboard set editor */}
            {selected.map((ex, exIdx) => (
              <View key={ex.name} style={[fp.exCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                {/* Exercise header */}
                <View style={[fp.exCardHead, { borderBottomColor: P.hair }]}>
                  <View style={[fp.exColorBar, { backgroundColor: EX_COLORS[exIdx % EX_COLORS.length] }]} />
                  <Text style={[fp.exCardName, { color: P.text }]}>{ex.name.toUpperCase()}</Text>
                  <Pressable onPress={() => removeExercise(ex.name)} hitSlop={10} style={[fp.exRemove, { backgroundColor: P.sunken }]}>
                    <Ionicons name="close" size={14} color={P.textFaint} />
                  </Pressable>
                </View>

                {/* Set table header */}
                {isStrength && (
                  <View style={[fp.setTableHead, { borderBottomColor: P.hair }]}>
                    <Text style={[fp.setTableHdr, { color: P.textFaint, width: 36 }]}>SET</Text>
                    <Text style={[fp.setTableHdr, { color: P.textFaint, flex: 1 }]}>REPS</Text>
                    <View style={{ width: 28 }} />
                    <Text style={[fp.setTableHdr, { color: P.textFaint, flex: 1 }]}>WEIGHT</Text>
                    <View style={{ width: 28 }} />
                  </View>
                )}

                {/* Set rows */}
                {isStrength && ex.sets.map((set, idx) => (
                  <View key={set.id} style={[fp.setInputRow, idx < ex.sets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair }]}>
                    {/* Set number */}
                    <View style={[fp.setNumBadge, { backgroundColor: P.sunken, width: 36 }]}>
                      <Text style={[fp.setNumText, { color: P.textFaint }]}>{String(idx + 1).padStart(2, '0')}</Text>
                    </View>

                    {/* Reps input */}
                    <View style={[fp.setNumInput, { backgroundColor: P.sunken, borderColor: P.cardEdge, flex: 1 }]}>
                      <TextInput
                        value={set.reps}
                        onChangeText={t => updateSet(ex.name, set.id, { reps: t.replace(/[^0-9]/g, '') })}
                        placeholder="—"
                        placeholderTextColor={P.cardEdge}
                        keyboardType="number-pad"
                        style={[fp.setInputText, { color: P.text }]}
                      />
                    </View>

                    <Text style={[fp.setX, { color: P.textFaint }]}>×</Text>

                    {/* Weight input */}
                    <View style={[fp.setNumInput, { backgroundColor: P.sunken, borderColor: P.cardEdge, flex: 1 }]}>
                      <TextInput
                        value={set.weight}
                        onChangeText={t => updateSet(ex.name, set.id, { weight: t.replace(/[^0-9.]/g, '') })}
                        placeholder="kg"
                        placeholderTextColor={P.cardEdge}
                        keyboardType="decimal-pad"
                        style={[fp.setInputText, { color: P.text }]}
                      />
                    </View>

                    {/* Remove set */}
                    <Pressable onPress={() => removeSet(ex.name, set.id)} hitSlop={10} disabled={ex.sets.length === 1} style={{ width: 28, alignItems: 'center' }}>
                      <Ionicons name="remove-circle-outline" size={18} color={ex.sets.length === 1 ? P.cardEdge : P.textFaint} />
                    </Pressable>
                  </View>
                ))}

                {/* Add set button */}
                {isStrength && (
                  <Pressable onPress={() => addSet(ex.name)} style={({ pressed }) => [fp.addSetRow, { borderTopColor: P.hair }, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="add-circle-outline" size={16} color={P.workout} />
                    <Text style={[fp.addSetText, { color: P.workout }]}>Add set</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {/* Add/edit exercises button */}
            <Pressable
              onPress={() => setPage('exercises')}
              style={({ pressed }) => [
                fp.addExBtn,
                selected.length > 0
                  ? { backgroundColor: P.card, borderColor: P.cardEdge }
                  : { backgroundColor: P.workout, borderColor: P.workout },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={selected.length > 0 ? 'pencil-outline' : 'add'}
                size={16}
                color={selected.length > 0 ? P.workout : '#fff'}
              />
              <Text style={[fp.addExText, { color: selected.length > 0 ? P.workout : '#fff' }]}>
                {selected.length > 0 ? 'Edit exercises' : 'Add exercises'}
              </Text>
            </Pressable>
          </View>

          {/* Notes */}
          <View style={[fp.section, { marginTop: 8 }]}>
            <Pressable onPress={() => setNotesOpen(v => !v)} style={fp.notesToggle}>
              <Ionicons name={notesOpen ? 'chevron-down' : 'chevron-forward'} size={14} color={P.textFaint} />
              <Text style={[fp.notesToggleText, { color: P.textFaint }]}>Notes</Text>
              {notes.length > 0 && <View style={[fp.notesDot, { backgroundColor: P.workout }]} />}
            </Pressable>
            {notesOpen && (
              <View style={[fp.notesBox, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                <TextInput value={notes} onChangeText={setNotes} placeholder="PRs, form cues, how it felt…" placeholderTextColor={P.textFaint} multiline style={[fp.notesInput, { color: P.text }]} />
              </View>
            )}
          </View>

          {/* Save */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <PrimaryButton label={`Log ${activeTypeLabel.toLowerCase()}`} icon="checkmark" onPress={handleSave} loading={saving} accent={P.workout} />
          </View>
        </ScrollView>
      )}
    </AppModal>
  );
}

// ── Sheet styles ──────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  navBtn:       { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Syne_800ExtraBold', fontSize: 12, letterSpacing: 2,
  },
  doneSmall:      { height: 32, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneSmallText:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    height: 42, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput:  { flex: 1, fontSize: 14, fontWeight: '500' },
  catChip:      { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  catText:      { fontSize: 12, fontWeight: '700' },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  selectedPillText: { fontSize: 12, fontWeight: '700' },
  sectionHdr:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 10 },
  exGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exCard: {
    width: '48.5%', minHeight: 80, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 10, justifyContent: 'space-between',
  },
  exCardTop:    { flexDirection: 'row', justifyContent: 'flex-end' },
  exCheck:      { width: 18, height: 18, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exCardText:   { fontSize: 12, fontWeight: '700', letterSpacing: -0.1, lineHeight: 16 },
  doneBar: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneCount:    { width: 80, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1 },
  doneCountNum: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 28, lineHeight: 28 },
  doneCountLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  donePrimary:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 50 },
  donePrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
});

// ── Form styles ───────────────────────────────────────────────────────────────

const fp = StyleSheet.create({
  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: { fontFamily: 'Syne_800ExtraBold', fontSize: 9, letterSpacing: 2.2, marginBottom: 12 },

  // Activity type
  typeCard: {
    width: 90, paddingVertical: 16, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 10,
  },
  typeIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  typeLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: -0.1 },

  // Duration — scoreboard display
  durationCard: {
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  durationDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 20 },
  timeSlot:     { alignItems: 'center', gap: 6 },
  timeInput:    { width: 90, height: 72, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  timeNum: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize:   44,
    lineHeight: 44,
    textAlign:  'center',
    width:      80,
  },
  timeUnit:     { fontFamily: 'Syne_800ExtraBold', fontSize: 9, letterSpacing: 2 },
  timeSep:      { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 44, lineHeight: 44, marginBottom: 20 },
  calRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  calText: { fontSize: 11, fontWeight: '600' },
  calNum:  { fontFamily: 'BarlowCondensed_700Bold', fontSize: 16, letterSpacing: 0 },
  calUnit: { fontSize: 11, fontWeight: '600' },

  // Intensity
  intGrid:     { flexDirection: 'row', gap: 8 },
  intCard: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 8,
  },
  dotMeter:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  dotSeg:      { width: 6, borderRadius: 2 },
  intLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

  // Exercise cards
  exHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  exBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  exBadgeText: { fontSize: 11, fontWeight: '800' },
  exCard:  { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, overflow: 'hidden' },
  exCardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exColorBar:  { width: 3, height: 16, borderRadius: 2 },
  exCardName: {
    flex: 1,
    fontFamily: 'Syne_800ExtraBold', fontSize: 10, letterSpacing: 1.6,
  },
  exRemove:    { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Set table
  setTableHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  setTableHdr:  { fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  setInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  setNumBadge: { height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  setNumText:  { fontFamily: 'BarlowCondensed_700Bold', fontSize: 14, letterSpacing: 0.5 },
  setNumInput: { height: 36, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  setInputText:{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 20, letterSpacing: -0.3, textAlign: 'center', width: '100%' },
  setX:        { fontSize: 15, fontWeight: '700', textAlign: 'center', width: 28 },
  addSetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  addSetText:  { fontSize: 13, fontWeight: '700' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 15,
  },
  addExText:   { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

  notesToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, alignSelf: 'flex-start' },
  notesToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  notesDot:        { width: 6, height: 6, borderRadius: 3 },
  notesBox:        { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, minHeight: 80 },
  notesInput:      { fontSize: 14, fontWeight: '500', lineHeight: 21 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WorkoutLogScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const { workouts, totalCaloriesBurned, deleteWorkout } = useWorkouts();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleDelete = useCallback(async (id: string) => {
    try { await deleteWorkout(id); }
    catch { toast.error('Could not delete', 'Please try again.'); }
  }, [deleteWorkout, toast]);

  const totalDuration = workouts.reduce((s, w) => s + w.duration_mins, 0);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Training" title="Workouts" accent={P.workout} />

        {/* Stats strip */}
        {workouts.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
            <View style={[ms.statsStrip, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <View style={ms.statCell}>
                <View style={[ms.statIcon, { backgroundColor: P.sunken }]}>
                  <Ionicons name="time-outline" size={13} color={P.workout} />
                </View>
                <View>
                  <Text style={[ms.statVal, { color: P.text }]}>{fmtDuration(totalDuration)}</Text>
                  <Text style={[ms.statLbl, { color: P.textFaint }]}>duration</Text>
                </View>
              </View>
              <View style={[ms.statSep, { backgroundColor: P.hair }]} />
              <View style={ms.statCell}>
                <View style={[ms.statIcon, { backgroundColor: P.sunken }]}>
                  <Ionicons name="flame-outline" size={13} color={P.calories} />
                </View>
                <View>
                  <Text style={[ms.statVal, { color: P.text }]}>{Math.round(totalCaloriesBurned).toLocaleString()}</Text>
                  <Text style={[ms.statLbl, { color: P.textFaint }]}>burned</Text>
                </View>
              </View>
              <View style={[ms.statSep, { backgroundColor: P.hair }]} />
              <View style={ms.statCell}>
                <View style={[ms.statIcon, { backgroundColor: P.sunken }]}>
                  <Ionicons name="barbell-outline" size={13} color={P.protein} />
                </View>
                <View>
                  <Text style={[ms.statVal, { color: P.text }]}>{workouts.length}</Text>
                  <Text style={[ms.statLbl, { color: P.textFaint }]}>sessions</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* List or empty state */}
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          {workouts.length === 0 ? (
            <View style={[ms.empty, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <View style={[ms.emptyIcon, { backgroundColor: P.sunken }]}>
                <Ionicons name="barbell-outline" size={28} color={P.workout} />
              </View>
              <Text style={[ms.emptyTitle, { color: P.text }]}>No workouts yet</Text>
              <Text style={[ms.emptySub, { color: P.textFaint }]}>Start by logging your first session for today.</Text>
              <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.85} style={[ms.emptyBtn, { backgroundColor: P.workout }]}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={ms.emptyBtnText}>Log a workout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workouts.map(w => <WorkoutEntry key={w.id} workout={w} onDelete={handleDelete} />)
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      {workouts.length > 0 && (
        <View style={[ms.fabWrap, { bottom: insets.bottom + 90 }]}>
          <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.88} style={[ms.fab, { backgroundColor: P.workout }]}>
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <LogWorkoutSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

// ── Main screen styles ────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  statsStrip:  { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 4 },
  statCell:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIcon:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statVal:     { fontFamily: 'BarlowCondensed_700Bold', fontSize: 15, letterSpacing: 0 },
  statLbl:     { fontSize: 10, fontWeight: '600' },
  statSep:     { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 10 },
  empty: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24, gap: 10,
  },
  emptyIcon:    { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, textAlign: 'center' },
  emptySub:     { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  fabWrap: { position: 'absolute', right: 24 },
  fab: {
    width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
});
