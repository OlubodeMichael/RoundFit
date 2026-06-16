import { StyleSheet, View } from 'react-native';

import { getExerciseCategoryAppearance } from '@/constants/exercise-category-icons';

import { ExerciseOptionRow, type ExerciseOptionMode } from './ExerciseOptionRow';

interface ExerciseOptionGroupProps {
  category: string;
  exercises: string[];
  selectedNames: Set<string>;
  mode: ExerciseOptionMode;
  onToggle: (name: string) => void;
  accentColor: string;
  accentSoft: string;
  textColor: string;
  textFaintColor: string;
  borderColor: string;
  surfaceColor: string;
  customNames?: Set<string>;
  onRemoveCustom?: (name: string) => void;
}

export function ExerciseOptionGroup({
  category,
  exercises,
  selectedNames,
  mode,
  onToggle,
  accentColor,
  accentSoft,
  textColor,
  textFaintColor,
  borderColor,
  surfaceColor,
  customNames,
  onRemoveCustom,
}: ExerciseOptionGroupProps) {
  const appearance = getExerciseCategoryAppearance(category);

  return (
    <View style={[s.card, { backgroundColor: surfaceColor, borderColor }]}>
      {exercises.map((name, index) => (
        <ExerciseOptionRow
          key={name}
          name={name}
          icon={appearance.icon}
          iconAccent={appearance.accent}
          selected={selectedNames.has(name)}
          mode={mode}
          onPress={() => onToggle(name)}
          accentColor={accentColor}
          accentSoft={accentSoft}
          textColor={textColor}
          textFaintColor={textFaintColor}
          borderColor={borderColor}
          surfaceColor={surfaceColor}
          isLast={index === exercises.length - 1}
          isCustom={customNames?.has(name)}
          onRemove={customNames?.has(name) && onRemoveCustom ? () => onRemoveCustom(name) : undefined}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
