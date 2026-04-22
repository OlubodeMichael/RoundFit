import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AnimatedCard, usePalette } from "@/lib/log-theme";

type HydrationCardProps = {
  delay?: number;
  waterGoal?: number;
};

export function HydrationCard({ delay = 0, waterGoal = 8 }: HydrationCardProps) {
  const P = usePalette();
  const [water, setWater] = useState(0);

  return (
    <AnimatedCard delay={delay}>
      <View style={styles.hydrationHead}>
        <View style={[styles.iconTile, { backgroundColor: P.waterSoft }]}>
          <Ionicons name="water" size={16} color={P.water} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={[styles.hydrationTitle, { color: P.text }]}>Water</Text>
        </View>
        <View style={styles.hydrationNum}>
          <Text style={[styles.hydrationCount, { color: P.water }]}>{water}</Text>
          <Text style={[styles.hydrationGoal, { color: P.textFaint }]}>/ {waterGoal}</Text>
        </View>
      </View>

      <View style={styles.dropRow}>
        {Array.from({ length: waterGoal }).map((_, index) => {
          const filled = index < water;
          return (
            <Pressable
              key={index}
              onPress={() => setWater((current) => (index < current ? index : index + 1))}
              style={({ pressed }) => [
                styles.dropCell,
                {
                  backgroundColor: filled ? P.water : P.sunken,
                  borderColor: filled ? P.water : P.cardEdge,
                },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              hitSlop={4}
            >
              <Ionicons
                name={filled ? "water" : "water-outline"}
                size={14}
                color={filled ? "#fff" : P.textFaint}
              />
            </Pressable>
          );
        })}
      </View>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  hydrationHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
  },
  hydrationTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  hydrationNum: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  hydrationCount: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  hydrationGoal: {
    fontSize: 12,
    fontWeight: "600",
  },
  dropRow: {
    flexDirection: "row",
    gap: 8,
  },
  dropCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
