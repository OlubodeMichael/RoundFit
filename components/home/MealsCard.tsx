import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { MealItem } from "@/context/food-context";
import { AnimatedCard, usePalette } from "@/lib/log-theme";
import { SectionHead } from "@/components/home/SectionHead";

type MealsCardProps = {
  delay?: number;
  meals: MealItem[];
  totalCalories: number;
  onLogMore: () => void;
};

const MEAL_ICONS: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  breakfast: "cafe",
  lunch: "restaurant",
  dinner: "moon",
  snack: "nutrition",
  other: "fast-food",
};

const TINT_KEYS = ["calories", "protein", "carbs", "fat"] as const;

export function MealsCard({ delay = 0, meals, totalCalories, onLogMore }: MealsCardProps) {
  const P = usePalette();

  return (
    <AnimatedCard padding={0} delay={delay}>
      <View style={styles.headerWrap}>
        <SectionHead
          title="Today's Meals"
          caption={
            meals.length === 0
              ? "Nothing logged yet"
              : `${meals.length} ${meals.length === 1 ? "entry" : "entries"}  ·  ${totalCalories.toLocaleString()} kcal`
          }
          action="See all"
          onAction={onLogMore}
        />
      </View>

      {meals.length === 0 ? (
        <Pressable onPress={onLogMore} style={({ pressed }) => [styles.emptyRow, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add-circle-outline" size={18} color={P.textFaint} />
          <Text style={[styles.emptyText, { color: P.textFaint }]}>Log your first meal</Text>
        </Pressable>
      ) : (
        <View>
          {meals.slice(0, 5).map((meal, index) => {
            const tintKey = TINT_KEYS[index % TINT_KEYS.length];
            const tint = P[tintKey];
            const tintSoft = P[`${tintKey}Soft`];
            const icon = MEAL_ICONS[meal.meal.toLowerCase()] ?? "fast-food";

            return (
              <View key={meal.id}>
                {index > 0 && <View style={[styles.mealDivider, { backgroundColor: P.hair }]} />}
                <Pressable
                  onPress={onLogMore}
                  style={({ pressed }) => [styles.mealRow, pressed && { backgroundColor: P.sunken }]}
                >
                  <View style={[styles.mealIcon, { backgroundColor: tintSoft }]}>
                    <Ionicons name={icon} size={18} color={tint} />
                  </View>
                  <View style={styles.mealTextWrap}>
                    <Text style={[styles.mealName, { color: P.text }]} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <Text style={[styles.mealMeta, { color: P.textFaint }]}>
                      {meal.meal} · {meal.time}
                    </Text>
                  </View>
                  <View style={styles.mealCalsWrap}>
                    <Text style={[styles.mealCals, { color: P.text }]}>{meal.cals}</Text>
                    <Text style={[styles.mealUnit, { color: P.textFaint }]}>kcal</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        onPress={onLogMore}
        activeOpacity={0.7}
        style={[styles.addMealBtn, { borderTopColor: P.hair }]}
      >
        <View style={[styles.addMealIcon, { backgroundColor: P.caloriesSoft }]}>
          <Ionicons name="add" size={16} color={P.calories} />
        </View>
        <Text style={[styles.addMealText, { color: P.text }]}>Log another meal</Text>
        <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  emptyRow: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
  },
  mealDivider: {
    marginLeft: 20,
    marginRight: 20,
    height: StyleSheet.hairlineWidth,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  mealTextWrap: {
    flex: 1,
    gap: 3,
  },
  mealName: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  mealMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  mealCalsWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  mealCals: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  mealUnit: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  addMealBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addMealIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  addMealText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
});
