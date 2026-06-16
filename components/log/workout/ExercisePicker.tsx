import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';
import { useExerciseLibrary } from '@/hooks/use-exercise-library';
import { ExerciseCustomAddRow } from './ExerciseCustomAddRow';
import { ExerciseOptionGroup } from './ExerciseOptionGroup';
import { ExercisePickerFilters } from './ExercisePickerFilters';
import { MuscleGroupBanner } from './MuscleGroupBanner';
import type { WorkoutType } from './types';

export type ExercisePickerMode = 'single' | 'multi';

interface BaseProps {
  visible: boolean;
  workoutType: WorkoutType;
  onClose: () => void;
  title?: string;
}

interface SingleProps extends BaseProps {
  mode: 'single';
  onSelect: (exercise: string) => void;
}

interface MultiProps extends BaseProps {
  mode: 'multi';
  value: string[];
  onConfirm: (exercises: string[]) => void;
}

export type ExercisePickerProps = SingleProps | MultiProps;

export function ExercisePicker(props: ExercisePickerProps) {
  const { visible, workoutType, onClose, title = 'Choose exercise' } = props;
  const P = usePalette();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setActiveCategory('all');
  }, [visible]);

  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!visible) return;
    if (props.mode === 'multi') {
      setLocalSelected(new Set(props.value));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { sections, customNames, addCustomExercise, removeCustomExercise } =
    useExerciseLibrary(workoutType, search);

  const visibleLibrary = useMemo(
    () =>
      activeCategory === 'all'
        ? sections
        : sections.filter((s) => s.category === activeCategory),
    [sections, activeCategory],
  );

  const categoryOptions = useMemo(
    () => ['all', ...sections.map((s) => s.category)],
    [sections],
  );

  const selectedSet =
    props.mode === 'multi' ? localSelected : new Set<string>();

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

  const handleAddCustom = async (name: string, category: string) => {
    const result = await addCustomExercise(name, category);
    if (result === 'added') {
      setActiveCategory(category);
    }
    return result;
  };

  const handleRemoveCustom = async (name: string) => {
    await removeCustomExercise(name);
    if (props.mode === 'multi') {
      setLocalSelected((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const selectionCount = props.mode === 'multi' ? localSelected.size : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: P.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.header, { borderBottomColor: P.hair }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.hdrBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={P.text} />
          </TouchableOpacity>
          <View style={s.hdrCenter}>
            <Text style={[s.hdrTitle, { color: P.text }]}>{title}</Text>
            {props.mode === 'multi' && selectionCount > 0 && (
              <View style={[s.hdrBadge, { backgroundColor: P.workoutSoft }]}>
                <Text style={[s.hdrBadgeText, { color: P.workout }]}>{selectionCount}</Text>
              </View>
            )}
          </View>
          {props.mode === 'multi' ? (
            <TouchableOpacity
              onPress={handleConfirmMulti}
              hitSlop={10}
              style={s.hdrBtn}
              accessibilityLabel="Confirm selection"
            >
              <Text style={[s.hdrDone, { color: P.workout }]}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.hdrBtn} />
          )}
        </View>

        <View style={s.filters}>
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

          {props.mode === 'multi' && localSelected.size > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.selectedRow}
            >
              {Array.from(localSelected).map((name) => (
                <Pressable
                  key={name}
                  onPress={() => handleTap(name)}
                  style={[s.selectedPill, { backgroundColor: P.workoutSoft, borderColor: P.workout }]}
                >
                  <Text style={[s.selectedPillText, { color: P.workout }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Ionicons name="close" size={12} color={P.workout} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <ScrollView
          style={s.list}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + (props.mode === 'multi' ? 88 : 24) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {visibleLibrary.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIcon, { backgroundColor: P.sunken }]}>
                <Ionicons name="search-outline" size={22} color={P.textFaint} />
              </View>
              <Text style={[s.emptyTitle, { color: P.text }]}>
                {search ? 'No matches found' : 'No exercises here'}
              </Text>
              <Text style={[s.emptySub, { color: P.textFaint }]}>
                {search
                  ? `Nothing matched "${search}". Try another term or add one below.`
                  : 'Pick a category above or add your own exercise.'}
              </Text>
              {activeCategory !== 'all' && (
                <View style={s.addCustomWrap}>
                  <ExerciseCustomAddRow
                    category={activeCategory}
                    onAdd={handleAddCustom}
                    accentColor={P.workout}
                    sunkenColor={P.sunken}
                    borderColor={P.cardEdge}
                    textColor={P.text}
                    textFaintColor={P.textFaint}
                  />
                </View>
              )}
            </View>
          ) : (
            visibleLibrary.map((section) => (
              <View key={section.category} style={s.section}>
                <MuscleGroupBanner category={section.category} />
                <ExerciseOptionGroup
                  category={section.category}
                  exercises={section.exercises}
                  selectedNames={selectedSet}
                  mode={props.mode}
                  onToggle={handleTap}
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
            ))
          )}
        </ScrollView>

        {props.mode === 'multi' && (
          <View
            style={[
              s.bottomBar,
              {
                backgroundColor: P.card,
                borderTopColor: P.hair,
                paddingBottom: insets.bottom + 10,
              },
            ]}
          >
            <View style={[s.bottomCount, { backgroundColor: P.workoutSoft }]}>
              <Text style={[s.bottomCountNum, { color: P.workout }]}>{selectionCount}</Text>
              <Text style={[s.bottomCountLbl, { color: P.workout }]}>picked</Text>
            </View>
            <Pressable
              onPress={handleConfirmMulti}
              style={({ pressed }) => [
                s.bottomCta,
                { backgroundColor: P.workout },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={s.bottomCtaText}>
                {selectionCount > 0 ? `Add ${selectionCount} exercise${selectionCount === 1 ? '' : 's'}` : 'Done'}
              </Text>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hdrBtn: { minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  hdrCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hdrTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  hdrBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  hdrBadgeText: { fontSize: 12, fontWeight: '800' },
  hdrDone: { fontSize: 15, fontWeight: '800' },

  filters: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  selectedRow: { gap: 8 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 200,
  },
  selectedPillText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 6 },
  section: { marginTop: 18 },
  addCustomWrap: { marginTop: 16, width: '100%' },

  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 10 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomCount: {
    width: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  bottomCountNum: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 26,
    lineHeight: 26,
  },
  bottomCountLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  bottomCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    minHeight: 50,
  },
  bottomCtaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});
