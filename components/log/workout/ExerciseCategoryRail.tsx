import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ExerciseCategoryRailProps {
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

function categoryLabel(category: string): string {
  return category === 'all' ? 'All' : category;
}

export function ExerciseCategoryRail({
  activeCategory,
  onCategoryChange,
  categoryOptions,
  accentColor,
  sunkenColor,
  surfaceColor,
  borderColor,
  textColor,
  textFaintColor,
}: ExerciseCategoryRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >
      <View style={[s.track, { backgroundColor: sunkenColor, borderColor }]}>
        {categoryOptions.map((cat) => {
          const active = cat === activeCategory;
          return (
            <Pressable
              key={cat}
              onPress={() => onCategoryChange(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={categoryLabel(cat)}
              style={({ pressed }) => [
                s.segment,
                active && {
                  backgroundColor: surfaceColor,
                  borderColor,
                  borderWidth: StyleSheet.hairlineWidth,
                },
                pressed && s.pressed,
              ]}
            >
              <Text
                style={[
                  s.label,
                  active
                    ? { color: textColor, fontWeight: '700' }
                    : { color: textFaintColor, fontWeight: '600' },
                ]}
              >
                {categoryLabel(cat)}
              </Text>
              {active && <View style={[s.dot, { backgroundColor: accentColor }]} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingVertical: 2 },
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
  },
  segment: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pressed: { opacity: 0.88 },
  label: {
    fontSize: 17,
    letterSpacing: -0.25,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
