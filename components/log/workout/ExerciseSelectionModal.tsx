import { useContext } from 'react';
import { AppModal, ModalScrollContext } from '@/components/ui/AppModal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
          <View style={[styles.hero, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={styles.heroTop}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${accentColor}22` }]}>
                <Ionicons name="barbell-outline" size={15} color={accentColor} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.heroTitle, { color: textColor }]}>Build your session</Text>
                <Text style={[styles.heroSub, { color: textFaintColor }]}>
                  Pick exercises by category and fine-tune your list.
                </Text>
              </View>
            </View>
            <View style={styles.heroMetaRow}>
              <View style={[styles.countPill, { backgroundColor: '#00000010', borderColor }]}>
                <Text style={[styles.countText, { color: textDimColor }]}>{selected.length} selected</Text>
              </View>
              <Pressable
                onPress={onClearFilters}
                style={({ pressed }) => [
                  styles.miniReset,
                  { borderColor, backgroundColor: '#00000010' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.miniResetText, { color: textDimColor }]}>Clear filters</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.searchRow, { backgroundColor: surfaceColor, borderColor }]}>
            <Ionicons name="search-outline" size={15} color={textDimColor} />
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search exercises..."
              placeholderTextColor={textFaintColor}
              style={[styles.searchInput, { color: textColor }]}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => onSearchChange('')} hitSlop={10}>
                <Ionicons name="close-circle" size={15} color={textDimColor} />
              </Pressable>
            )}
          </View>

          {selected.length > 0 && (
            <View style={styles.selectedWrap}>
              <Text style={[styles.sectionLabel, { color: textDimColor }]}>SELECTED</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedRow}>
                {selected.map((exercise) => (
                  <Pressable
                    key={`selected-${exercise.name}`}
                    onPress={() => onToggleExercise(exercise.name)}
                    style={({ pressed }) => [
                      styles.selectedPill,
                      { backgroundColor: accentColor },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.selectedText} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.categoryRail, { backgroundColor: surfaceColor, borderColor }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categoryOptions.map((category) => {
                const isActive = category === activeCategory;
                const label = category === 'all' ? 'All' : category;
                return (
                  <Pressable
                    key={category}
                    onPress={() => onCategoryChange(category)}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      {
                        backgroundColor: isActive ? accentColor : 'transparent',
                        borderColor: isActive ? accentColor : 'transparent',
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, { color: isActive ? '#fff' : textDimColor }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

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
                  <Text style={[styles.sectionLabel, { color: textDimColor }]}>{section.category.toUpperCase()}</Text>
                  <View style={styles.optionGrid}>
                    {section.exercises.map((exercise) => {
                      const active = selectedNames.has(exercise);
                      return (
                        <Pressable
                          key={exercise}
                          onPress={() => onToggleExercise(exercise)}
                          style={({ pressed }) => [
                            styles.exerciseCard,
                            {
                              backgroundColor: active ? accentColor : surfaceColor,
                              borderColor: active ? accentColor : borderColor,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <View style={styles.exerciseCardTop}>
                            <Ionicons
                              name={active ? 'checkmark-circle' : 'add-circle-outline'}
                              size={17}
                              color={active ? '#fff' : textDimColor}
                            />
                            <View
                              style={[
                                styles.exerciseCheck,
                                {
                                  borderColor: active ? '#fff' : borderColor,
                                  backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                                },
                              ]}
                            >
                              {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                            </View>
                          </View>
                          <Text style={[styles.exerciseText, { color: active ? '#fff' : textColor }]} numberOfLines={2}>
                            {exercise}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
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
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, marginBottom: 10, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroTextWrap: { flex: 1, gap: 1 },
  heroTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  heroSub: { fontSize: 12, fontWeight: '500' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  countPill: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '700' },
  miniReset: {
    height: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniResetText: { fontSize: 11, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  selectedWrap: { marginBottom: 10 },
  selectedRow: { gap: 8, paddingBottom: 2 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 220,
  },
  selectedText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  categoryRail: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 6, marginBottom: 10 },
  categoryRow: { gap: 6, paddingHorizontal: 4 },
  categoryChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  sectionWrap: { marginTop: 16 },
  sectionLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exerciseCard: {
    width: '48.8%',
    minHeight: 86,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 10,
  },
  exerciseCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseCheck: {
    width: 17,
    height: 17,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1, lineHeight: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  emptySubText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  bottomBar: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomCount: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCountText: { fontSize: 12, fontWeight: '700' },
  doneBtn: { flex: 1, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
});
