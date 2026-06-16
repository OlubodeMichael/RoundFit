import { useContext } from 'react';
import { AppModal, ModalScrollContext } from '@/components/ui/AppModal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseOptionGroup } from './ExerciseOptionGroup';
import { ExercisePickerFilters } from './ExercisePickerFilters';
import { MuscleGroupBanner } from './MuscleGroupBanner';
import type { ExerciseSection, SelectedExercise } from './types';

interface ExerciseSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  textColor: string;
  textDimColor: string;
  textFaintColor: string;
  surfaceColor: string;
  borderColor: string;
  accentColor: string;
  selected: SelectedExercise[];
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categoryOptions: string[];
  visibleLibrary: ExerciseSection[];
  selectedNames: Set<string>;
  onToggleExercise: (name: string) => void;
  onClearFilters: () => void;
}

export function ExerciseSelectionModal({
  visible,
  onClose,
  textColor,
  textDimColor,
  textFaintColor,
  surfaceColor,
  borderColor,
  accentColor,
  selected,
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categoryOptions,
  visibleLibrary,
  selectedNames,
  onToggleExercise,
  onClearFilters,
}: ExerciseSelectionModalProps) {
  const { onScroll } = useContext(ModalScrollContext);

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Select Exercises"
      sheetHeight="full"
      dismissGestureArea="sheet"
    >
      <View style={styles.root}>
        <View style={styles.body}>
          <View style={[styles.summaryRow, { borderColor }]}>
            <View style={[styles.summaryIcon, { backgroundColor: `${accentColor}22` }]}>
              <Ionicons name="barbell-outline" size={16} color={accentColor} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={[styles.summaryTitle, { color: textColor }]}>
                {selected.length > 0 ? `${selected.length} selected` : 'Pick your lifts'}
              </Text>
              <Text style={[styles.summarySub, { color: textFaintColor }]}>
                Search or filter by muscle group.
              </Text>
            </View>
            <Pressable
              onPress={onClearFilters}
              hitSlop={8}
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.clearBtnText, { color: textDimColor }]}>Reset</Text>
            </Pressable>
          </View>

          <ExercisePickerFilters
            search={search}
            onSearchChange={onSearchChange}
            activeCategory={activeCategory}
            onCategoryChange={onCategoryChange}
            categoryOptions={categoryOptions}
            accentColor={accentColor}
            sunkenColor={surfaceColor}
            surfaceColor={surfaceColor}
            borderColor={borderColor}
            textColor={textColor}
            textFaintColor={textFaintColor}
          />

          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedRow}>
              {selected.map((exercise) => (
                <Pressable
                  key={`selected-${exercise.name}`}
                  onPress={() => onToggleExercise(exercise.name)}
                  style={({ pressed }) => [
                    styles.selectedPill,
                    { backgroundColor: `${accentColor}22`, borderColor: accentColor },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.selectedText, { color: accentColor }]} numberOfLines={1}>
                    {exercise.name}
                  </Text>
                  <Ionicons name="close" size={12} color={accentColor} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={e => onScroll(e.nativeEvent.contentOffset.y)}
          >
            {visibleLibrary.length > 0 ? (
              visibleLibrary.map((section) => (
                <View key={section.category} style={styles.sectionWrap}>
                  <MuscleGroupBanner category={section.category} />
                  <ExerciseOptionGroup
                    category={section.category}
                    exercises={section.exercises}
                    selectedNames={selectedNames}
                    mode="multi"
                    onToggle={onToggleExercise}
                    accentColor={accentColor}
                    accentSoft={`${accentColor}22`}
                    textColor={textColor}
                    textFaintColor={textFaintColor}
                    borderColor={borderColor}
                    surfaceColor={surfaceColor}
                  />
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={24} color={textFaintColor} />
                <Text style={[styles.emptyText, { color: textDimColor }]}>No exercises in this view</Text>
                <Text style={[styles.emptySubText, { color: textFaintColor }]}>
                  Try another category or clear your search.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
            <View style={[styles.bottomCount, { borderColor, backgroundColor: surfaceColor }]}>
              <Text style={[styles.bottomCountText, { color: textDimColor }]}>
                {selected.length} exercise{selected.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneBtn,
                { backgroundColor: accentColor },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.doneText}>Done ({selected.length})</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  summarySub: { fontSize: 13, fontWeight: '500' },
  clearBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  clearBtnText: { fontSize: 13, fontWeight: '700' },
  selectedRow: { gap: 8 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  selectedText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  sectionWrap: { marginTop: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptySubText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  bottomBar: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomCount: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCountText: { fontSize: 12, fontWeight: '700' },
  doneBtn: { flex: 1, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});
