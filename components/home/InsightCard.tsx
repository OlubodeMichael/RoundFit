import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AnimatedCard, usePalette } from "@/lib/log-theme";

type InsightCardProps = {
  delay?: number;
};

export function InsightCard({ delay = 0 }: InsightCardProps) {
  const P = usePalette();
  const router = useRouter();

  return (
    <AnimatedCard delay={delay} style={styles.card}>
      <View pointerEvents="none" style={[styles.insightGlow, { backgroundColor: P.fatSoft }]} />

      <View style={styles.insightHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={15} color={P.fat} />
        </View>
        <View style={styles.headContent}>
          <Text style={[styles.insightEyebrow, { color: P.fat }]}>DAILY INSIGHT</Text>
          <Text style={[styles.insightMeta, { color: P.textFaint }]}>Personalised for you</Text>
        </View>
      </View>

      <Text style={[styles.insightBody, { color: P.text }]}>
        Your protein dips below target every afternoon. Try a{" "}
        <Text style={{ color: P.protein, fontWeight: "700" }}>Greek yogurt</Text> or a{" "}
        <Text style={{ color: P.protein, fontWeight: "700" }}>handful of almonds</Text> around 3 PM to
        stay steady through dinner.
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.insightCta, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
        onPress={() => router.replace("/(tabs)/insights/weekly")}
      >
        <Text style={[styles.insightCtaText, { color: P.text }]}>See weekly report</Text>
        <Ionicons name="arrow-forward" size={14} color={P.text} />
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headContent: {
    flex: 1,
  },
  insightGlow: {
    position: "absolute",
    top: -70,
    right: -55,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.95,
  },
  insightHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  insightEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  insightMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  insightBody: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginBottom: 16,
  },
  insightCta: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  insightCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
