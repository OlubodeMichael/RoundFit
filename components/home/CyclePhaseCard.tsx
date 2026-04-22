import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import type { CurrentCycle } from "@/hooks/use-cycle";
import { AnimatedCard, usePalette } from "@/lib/log-theme";

const CYCLE_PHASES = [
  { key: "menstrual", label: "Menstrual", icon: "water" as const },
  { key: "follicular", label: "Follicular", icon: "leaf" as const },
  { key: "ovulation", label: "Ovulation", icon: "sunny" as const },
  { key: "luteal", label: "Luteal", icon: "moon" as const },
];

type CyclePhaseCardProps = {
  current: CurrentCycle;
  delay?: number;
};

function getDayLabel(current: CurrentCycle): string | null {
  if (current.day_of_cycle != null && current.cycle_length != null) {
    return `Day ${current.day_of_cycle} of ${current.cycle_length}`;
  }

  if (current.days_remaining != null) {
    return `${current.days_remaining}d remaining`;
  }

  return null;
}

export function CyclePhaseCard({ current, delay = 0 }: CyclePhaseCardProps) {
  const P = usePalette();
  const phaseIdx = CYCLE_PHASES.findIndex((phase) => phase.key === current.phase);
  const activeIdx = phaseIdx >= 0 ? phaseIdx : 0;
  const phase = CYCLE_PHASES[activeIdx];
  const dayLabel = getDayLabel(current);

  return (
    <AnimatedCard delay={delay} padding={18}>
      <View style={styles.cycleHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name={phase.icon} size={16} color={P.fat} />
        </View>
        <View style={styles.cycleText}>
          <Text style={[styles.cycleTitle, { color: P.text }]}>
            {phase.label} <Text style={{ color: P.textFaint, fontWeight: "500" }}>phase</Text>
          </Text>
          {dayLabel && <Text style={[styles.cycleSub, { color: P.textFaint }]}>{dayLabel}</Text>}
        </View>
        {current.predicted_next_period && (
          <View style={[styles.nextPeriodPill, { backgroundColor: P.hair }]}>
            <Ionicons name="calendar-outline" size={11} color={P.textFaint} />
            <Text style={[styles.nextPeriodText, { color: P.textFaint }]}>
              {new Date(current.predicted_next_period).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.phaseRow}>
        {CYCLE_PHASES.map((item, index) => {
          const isActive = index === activeIdx;
          return (
            <View key={item.key} style={styles.phaseTick}>
              <View
                style={[
                  styles.phaseBar,
                  {
                    backgroundColor: isActive ? P.fat : P.hair,
                    opacity: isActive ? 1 : 0.7,
                  },
                ]}
              />
              <Text
                style={[
                  styles.phaseCap,
                  { color: isActive ? P.text : P.textFaint, fontWeight: isActive ? "700" : "500" },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  cycleHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cycleText: {
    flex: 1,
    gap: 2,
  },
  cycleTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cycleSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  nextPeriodPill: {
    paddingHorizontal: 8,
    width: "auto",
    gap: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    height: 36,
  },
  nextPeriodText: {
    fontSize: 10,
    fontWeight: "700",
  },
  phaseRow: {
    flexDirection: "row",
    gap: 6,
  },
  phaseTick: {
    flex: 1,
    gap: 6,
  },
  phaseBar: {
    height: 3,
    borderRadius: 2,
  },
  phaseCap: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
