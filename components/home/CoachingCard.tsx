import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AnimatedMascot,
  moodFromDirective,
} from "@/components/mascot/AnimatedMascot";
import { GradientCard } from "@/components/ui/GradientCard";
import { AppModal } from "@/components/ui/AppModal";
import { useCoachingBadge } from "@/hooks/use-coaching-badge";
import { useDailyCoaching } from "@/hooks/use-daily-coaching";
import { usePalette } from "@/lib/log-theme";
import type {
  CoachingFocus,
  Directive,
  DailyCoachingDecision,
} from "@/types/daily-coaching";
import type { CoachingMessageSource } from "@/utils/resolve-coaching-message";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type Palette = ReturnType<typeof usePalette>;

const FOCUS_ICON: Record<CoachingFocus, IoniconsName> = {
  training: "barbell",
  nutrition: "restaurant",
  hydration: "water",
  sleep: "moon",
  recovery: "bed",
};

/** Directive → accent key on the log-theme palette. */
function accentFor(directive: Directive, P: Palette): { main: string; soft: string } {
  switch (directive) {
    case "train_hard":
      return { main: P.calories, soft: P.caloriesSoft };
    case "moderate":
      return { main: P.carbs, soft: P.carbsSoft };
    case "light":
      return { main: P.water, soft: P.waterSoft };
    case "rest":
      return { main: P.sleep, soft: P.sleepSoft };
  }
}

const CONFIDENCE_CHIP: Record<DailyCoachingDecision["confidence"], string | null> = {
  full: null,
  partial: "Partial data",
  minimal: "Go by feel",
};

const SOURCE_LABEL: Record<CoachingMessageSource, string> = {
  apple_fm: "Phrased on your device",
  openai: "Phrased by RoundFit AI",
  template: "Standard guidance",
};

export interface CoachingCardProps {
  delay?: number;
}

/**
 * The daily coach surface. Mounts the Phase-2 decision hook, broadcasts the real
 * directive through the mascot (never a mismatched mood), and offers an honest
 * "Why this?" affordance that shows the deterministic reason + what was considered
 * and dropped. Always renders SOMETHING once a decision exists — the hook guarantees
 * a template message even offline.
 */
export function CoachingCard({ delay = 0 }: CoachingCardProps) {
  const P = usePalette();
  const { decision, message } = useDailyCoaching();
  const { count: badge, markOpened } = useCoachingBadge(decision);
  const [whyOpen, setWhyOpen] = useState(false);

  const accent = useMemo(
    () => (decision ? accentFor(decision.directive, P) : null),
    [decision, P],
  );

  if (!decision || !message || !accent) return null;

  const mood = moodFromDirective(decision.directive);
  const focusIcon = FOCUS_ICON[decision.focus];
  const chip = CONFIDENCE_CHIP[decision.confidence];

  const openWhy = () => {
    markOpened();
    setWhyOpen(true);
  };

  const gap = decision.nutrition_gap;

  return (
    <>
      <GradientCard
        variant="insight"
        palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
        delay={delay}
      >
        <Pressable
          onPress={openWhy}
          accessibilityRole="button"
          accessibilityLabel={`Coach: ${message.title}. Tap for why.`}
          style={({ pressed }) => [s.body, pressed && { opacity: 0.9 }]}
        >
          <View style={s.mascotCol}>
            <AnimatedMascot mood={mood} size={64} />
            {badge > 0 && (
              <View style={[s.badge, { backgroundColor: accent.main }]}>
                <Text style={s.badgeText}>{badge}</Text>
              </View>
            )}
          </View>

          <View style={s.copy}>
            <View style={s.titleRow}>
              <View style={[s.focusTile, { backgroundColor: accent.soft }]}>
                <Ionicons name={focusIcon} size={13} color={accent.main} />
              </View>
              <Text style={[s.title, { color: P.text }]} numberOfLines={1}>
                {message.title}
              </Text>
              {chip && (
                <View style={[s.chip, { backgroundColor: P.hair }]}>
                  <Text style={[s.chipText, { color: P.textFaint }]}>{chip}</Text>
                </View>
              )}
            </View>

            <Text style={[s.message, { color: P.textDim }]}>{message.message}</Text>

            <View style={s.whyRow}>
              <Ionicons
                name="help-circle-outline"
                size={13}
                color={accent.main}
              />
              <Text style={[s.whyText, { color: accent.main }]}>Why this?</Text>
            </View>
          </View>
        </Pressable>
      </GradientCard>

      <AppModal
        visible={whyOpen}
        onClose={() => setWhyOpen(false)}
        title="Why this?"
        sheetHeight={0.5}
      >
        <ScrollView
          contentContainerStyle={s.modalBody}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.reasonLabel, { color: P.textFaint }]}>
            TODAY'S CALL
          </Text>
          <Text style={[s.reason, { color: P.text }]}>
            {decision.primary_reason}
          </Text>

          {gap && (
            <View style={[s.detailBox, { backgroundColor: P.sunken }]}>
              <Text style={[s.detailText, { color: P.textDim }]}>
                Averaging {Math.round(gap.avg_consumed)}
                {gap.nutrient === "protein" ? "g" : " cal"} of{" "}
                {Math.round(gap.target)}
                {gap.nutrient === "protein" ? "g" : " cal"} {gap.nutrient} across{" "}
                {gap.days_under} of {gap.logged_days} logged{" "}
                {gap.logged_days === 1 ? "day" : "days"}.
              </Text>
            </View>
          )}

          {decision.dropped.length > 0 && (
            <View style={s.droppedBlock}>
              <Text style={[s.reasonLabel, { color: P.textFaint }]}>
                ALSO CONSIDERED
              </Text>
              {decision.dropped.map((d, i) => (
                <View key={i} style={s.droppedRow}>
                  <View style={[s.droppedDot, { backgroundColor: P.textFaint }]} />
                  <Text style={[s.droppedText, { color: P.textDim }]}>{d}</Text>
                </View>
              ))}
              <Text style={[s.droppedNote, { color: P.textFaint }]}>
                Held back so today stays focused on one thing.
              </Text>
            </View>
          )}

          <Text style={[s.sourceNote, { color: P.textFaint }]}>
            {SOURCE_LABEL[message.source]}
          </Text>
        </ScrollView>
      </AppModal>
    </>
  );
}

const s = StyleSheet.create({
  body: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
  },
  mascotCol: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  copy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  focusTile: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  whyText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  // Modal
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 12,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  reason: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  detailBox: {
    borderRadius: 14,
    padding: 14,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  droppedBlock: {
    gap: 8,
    marginTop: 4,
  },
  droppedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  droppedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  droppedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  droppedNote: {
    fontSize: 11,
    fontWeight: "500",
    fontStyle: "italic",
    marginTop: 2,
  },
  sourceNote: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 6,
  },
});
