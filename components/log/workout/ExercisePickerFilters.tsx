import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ExerciseCategoryRail } from './ExerciseCategoryRail';

interface ExercisePickerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categoryOptions: string[];
  accentColor: string;
  sunkenColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  textFaintColor: string;
}

export function ExercisePickerFilters({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categoryOptions,
  accentColor,
  sunkenColor,
  surfaceColor,
  borderColor,
  textColor,
  textFaintColor,
}: ExercisePickerFiltersProps) {
  return (
    <View style={s.wrap}>
      <View style={[s.searchBar, { backgroundColor: sunkenColor, borderColor }]}>
        <Ionicons name="search-outline" size={16} color={textFaintColor} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search exercises"
          placeholderTextColor={textFaintColor}
          style={[s.searchInput, { color: textColor }]}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => onSearchChange('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={textFaintColor} />
          </Pressable>
        )}
      </View>

      <ExerciseCategoryRail
        activeCategory={activeCategory}
        onCategoryChange={onCategoryChange}
        categoryOptions={categoryOptions}
        accentColor={accentColor}
        sunkenColor={sunkenColor}
        surfaceColor={surfaceColor}
        borderColor={borderColor}
        textColor={textColor}
        textFaintColor={textFaintColor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
});
