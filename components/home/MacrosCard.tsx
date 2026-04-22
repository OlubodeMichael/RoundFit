import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { SegmentedDial } from "@/components/home/SegmentedDial";
import { AnimatedCard, usePalette } from "@/lib/log-theme";
import { SectionHead } from "@/components/home/SectionHead";

const MACRO_DIAL_SIZE = 102;

export type MacroItem = {
  key: string;
  label: string;
  cur: number;
  goal: number;
  accent: "protein" | "carbs" | "fat";
};

type MacroCellProps = {
  label: string;
  cur: number;
  goal: number;
  accent: MacroItem["accent"];
  delay: number;
};

type MacrosCardProps = {
  macros: MacroItem[];
  delay?: number;
};

function getMacroColors(palette: ReturnType<typeof usePalette>, accent: MacroItem["accent"]) {
  if (accent === "protein") {
    return { fill: palette.protein, soft: palette.proteinSoft, track: palette.proteinSoft };
  }
  if (accent === "carbs") {
    return { fill: palette.carbs, soft: palette.carbsSoft, track: palette.carbsSoft };
  }
  return { fill: palette.fat, soft: palette.fatSoft, track: palette.fatSoft };
}

function MacroCell({ label, cur, goal, accent, delay }: MacroCellProps) {
  const P = usePalette();
  const { fill, track, soft } = getMacroColors(P, accent);

  const target = goal > 0 ? Math.min(cur / goal, 1) : 0;
  const animated = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setProgress(value));
    Animated.timing(animated, {
      toValue: target,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated, target, delay]);

  return (
    <View style={styles.macroCell}>
      <SegmentedDial
        size={MACRO_DIAL_SIZE}
        progress={progress}
        trackColor={track}
        fillColor={fill}
        haloColor={soft}
      >
        <Text style={[styles.macroCur, { color: P.text }]}>{cur}</Text>
        <View style={[styles.macroDivider, { backgroundColor: fill }]} />
        <Text style={[styles.macroOf, { color: P.textFaint }]}>OF {goal}G</Text>
      </SegmentedDial>

      <View style={[styles.macroPill, { backgroundColor: soft }]}>
        <Text style={[styles.macroPillLabel, { color: fill }]}>{label.toUpperCase()}</Text>
        <View style={[styles.macroPillDot, { backgroundColor: fill }]} />
        <Text style={[styles.macroPillPct, { color: fill }]}>{Math.round(progress * 100)}%</Text>
      </View>
    </View>
  );
}

export function MacrosCard({ macros, delay = 0 }: MacrosCardProps) {
  return (
    <AnimatedCard delay={delay}>
      <SectionHead title="Macros" caption="grams today" />
      <View style={styles.macrosRow}>
        {macros.map((macro, index) => (
          <MacroCell
            key={macro.key}
            label={macro.label}
            cur={macro.cur}
            goal={macro.goal}
            accent={macro.accent}
            delay={delay + 200 + index * 100}
          />
        ))}
      </View>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  macroCell: {
    alignItems: "center",
  },
  macroCur: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 26,
  },
  macroDivider: {
    width: 14,
    height: 1,
    marginTop: 4,
    marginBottom: 4,
    opacity: 0.45,
  },
  macroOf: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  macroPill: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  macroPillDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
  macroPillPct: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },
});
