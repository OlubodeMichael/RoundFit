import { useEffect, useMemo, useState } from 'react';
import {
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

import { usePalette } from '@/lib/log-theme';
import { EXERCISE_LIBRARY } from './constants';
import type { WorkoutType } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExercisePickerMode = 'single' | 'multi';

interface BaseProps {
  visible:     boolean;
  workoutType: WorkoutType;
  onClose:     () => void;
  /** Optional custom header title. Defaults to "Choose exercise". */
  title?:      string;
}

interface SingleProps extends BaseProps {
  mode:     'single';
  onSelect: (exercise: string) => void;
}

interface MultiProps extends BaseProps {
  mode:    'multi';
  /** Currently-selected exercise names (kept in sync as the user toggles). */
  value:   string[];
  /** Called with the final selection when the user taps "Done". */
  onConfirm: (exercises: string[]) => void;
}

export type ExercisePickerProps = SingleProps | MultiProps;

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Library picker shared by the live-session sheet and (eventually) the
 * log-past-workout sheet. Same UX as the existing inline picker in
 * `app/(tabs)/log/workout.tsx`: search bar + horizontal category chips +
 * vertical grid grouped by category.
 *
 * In `single` mode, tapping a card resolves immediately. In `multi`, cards
 * toggle and the user commits via the "Done" header button.
 */
export function ExercisePicker(props: ExercisePickerProps) {
  const { visible, workoutType, onClose, title = 'Choose exercise' } = props;
  const P      = usePalette();
  const insets = useSafeAreaInsets();

  const [search,         setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Reset filter state when the picker re-opens.
  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setActiveCategory('all');
  }, [visible]);

  // Local selection mirror for multi-select mode.
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!visible) return;
    if (props.mode === 'multi') {
      setLocalSelected(new Set(props.value));
    }
  // Deliberate: only re-seed when the sheet (re)opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Derived lists ──────────────────────────────────────────────────────
  const filteredLibrary = useMemo(() => {
    const sections = EXERCISE_LIBRARY[workoutType] ?? [];
    const q        = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        category:  s.category,
        exercises: s.exercises.filter((e) => e.toLowerCase().includes(q)),
      }))
      .filter((s) => s.exercises.length > 0);
  }, [search, workoutType]);

  const visibleLibrary = useMemo(
    () =>
      activeCategory === 'all'
        ? filteredLibrary
        : filteredLibrary.filter((s) => s.category === activeCategory),
    [filteredLibrary, activeCategory],
  );

  const categoryOptions = useMemo(
    () => ['all', ...filteredLibrary.map((s) => s.category)],
    [filteredLibrary],
  );

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleTap = (name: string) => {
    if (props.mode === 'single') {
      props.onSelect(name);
      onClose();
      return;
    }
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleConfirmMulti = () => {
    if (props.mode !== 'multi') return;
    props.onConfirm(Array.from(localSelected));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: P.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: P.hair }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.hdrBtn}>
            <Ionicons name="close" size={22} color={P.text} />
          </TouchableOpacity>
          <Text style={[s.hdrTitle, { color: P.text }]}>{title}</Text>
          {props.mode === 'multi' ? (
            <TouchableOpacity
              onPress={handleConfirmMulti}
              hitSlop={10}
              style={s.hdrBtn}
            >
              <Text style={[s.hdrDone, { color: P.workout }]}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.hdrBtn} />
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
          {/* Search */}
          <View
            style={[
              s.searchBar,
              { backgroundColor: P.sunken, borderColor: P.cardEdge },
            ]}
          >
            <Ionicons name="search-outline" size={15} color={P.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises"
              placeholderTextColor={P.textFaint}
              style={[s.searchInput, { color: P.text }]}
              autoCorrect={false}
              autoCapitalize="words"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={10}>
                <Ionicons name="close-circle" size={15} color={P.textFaint} />
              </Pressable>
            )}
          </View>

          {/* Category chips */}
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
                    s.catChip,
                    {
                      backgroundColor: active ? P.workout : P.sunken,
                      borderColor:     active ? P.workout : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.catText,
                      { color: active ? '#fff' : P.textFaint },
                    ]}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Selected pills (multi-select only) */}
          {props.mode === 'multi' && localSelected.size > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {Array.from(localSelected).map((name) => (
                <Pressable
                  key={name}
                  onPress={() => handleTap(name)}
                  style={[
                    s.selectedPill,
                    {
                      backgroundColor: P.workout + '22',
                      borderColor:     P.workout,
                    },
                  ]}
                >
                  <Text
                    style={[s.selectedPillText, { color: P.workout }]}
                    numberOfLines={1}
                  >
                    {name}
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
            paddingBottom:     insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {visibleLibrary.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="search" size={22} color={P.textFaint} />
              <Text style={[s.emptyText, { color: P.textFaint }]}>
                No matches for &quot;{search}&quot;.
              </Text>
            </View>
          ) : (
            visibleLibrary.map((section) => (
              <View key={section.category} style={{ marginTop: 20 }}>
                <Text style={[s.sectionHdr, { color: P.textFaint }]}>
                  {section.category.toUpperCase()}
                </Text>
                <View style={s.exGrid}>
                  {section.exercises.map((name) => {
                    const active =
                      props.mode === 'multi' && localSelected.has(name);
                    return (
                      <Pressable
                        key={name}
                        onPress={() => handleTap(name)}
                        style={({ pressed }) => [
                          s.exCard,
                          {
                            backgroundColor: active ? P.workout : P.card,
                            borderColor:     active ? P.workout : P.cardEdge,
                          },
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        {props.mode === 'multi' && (
                          <View style={s.exCardTop}>
                            <View
                              style={[
                                s.exCheck,
                                {
                                  borderColor: active ? '#fff' : P.cardEdge,
                                  backgroundColor: active
                                    ? 'rgba(255,255,255,0.2)'
                                    : 'transparent',
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
                        )}
                        <Text
                          style={[
                            s.exCardText,
                            { color: active ? '#fff' : P.text },
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
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hdrBtn:    { minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  hdrTitle:  { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  hdrDone:   { fontSize: 15, fontWeight: '800' },

  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 12,
    height:            42,
    borderRadius:      12,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  catChip: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      999,
    borderWidth:       1,
  },
  catText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  selectedPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
    borderWidth:       1,
    maxWidth:          180,
  },
  selectedPillText: { fontSize: 12, fontWeight: '700' },

  sectionHdr: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  8,
  },
  exGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exCard: {
    width:        '48.5%',
    minHeight:    72,
    padding:      12,
    borderRadius: 14,
    borderWidth:  StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  exCardTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  exCheck: {
    width:        18,
    height:       18,
    borderRadius: 5,
    borderWidth:  1.5,
    alignItems:   'center',
    justifyContent: 'center',
  },
  exCardText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:             8,
    paddingTop:     60,
  },
  emptyText: { fontSize: 13, fontWeight: '500' },
});
