import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { usePalette } from "@/lib/log-theme";

type SectionHeadProps = {
  title: string;
  caption?: string;
  action?: string;
  onAction?: () => void;
};

export function SectionHead({ title, caption, action, onAction }: SectionHeadProps) {
  const P = usePalette();

  return (
    <View style={styles.sectionHead}>
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: P.text }]}>{title}</Text>
        {caption && <Text style={[styles.sectionCaption, { color: P.textFaint }]}>{caption}</Text>}
      </View>
      {action && (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
          <Text style={[styles.sectionAction, { color: P.calories }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionCaption: {
    fontSize: 11,
    fontWeight: "500",
  },
  sectionAction: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
